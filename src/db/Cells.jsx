import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { COLORS, COLOR_NAMES, formatDate, isSelectType, randomColor, saveSchema, setRowValue, uid, relatedIds, computeRollup, rollupIsPercent } from "./dbUtils.js";
import { navigate, usePages, pageTitle } from "../store.js";
import { t } from "../i18n.js";

// Fixed-position popover rendered in <body>, anchored to an element. Escapes overflow clipping.
export function Popover({ anchor, onClose, children, width, align = "left" }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    const el = ref.current;
    const w = el?.offsetWidth || width || 240;
    const h = el?.offsetHeight || 200;
    let left = align === "right" ? r.right - w : r.left;
    let top = r.bottom + 4;
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
    if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 4);
    setPos({ left, top });
  }, [anchor, width, align]);

  useEffect(() => {
    const down = (e) => {
      if (ref.current?.contains(e.target) || anchor?.contains(e.target)) return;
      // clicks inside another (nested) popover shouldn't close this one
      if (e.target.closest?.(".popover")) return;
      onClose();
    };
    const key = (e) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", down);
      document.removeEventListener("keydown", key);
    };
  }, [anchor, onClose]);

  return createPortal(
    <div
      ref={ref}
      className="popover"
      style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999, width }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body
  );
}

export const Tag = ({ opt, onRemove }) =>
  opt ? (
    <span className={`tag c-${opt.color || "default"}`}>
      {opt.name}
      {onRemove && (
        <button className="tag-x" onClick={(e) => (e.stopPropagation(), onRemove())}>×</button>
      )}
    </span>
  ) : null;

// Pick / create options for select, status, multi_select
export function SelectEditor({ dbId, schema, prop, value, onChange, anchor, onClose }) {
  const multi = prop.type === "multi_select";
  const selected = multi ? value || [] : value ? [value] : [];
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState(null);
  const [editAnchor, setEditAnchor] = useState(null);
  const options = prop.options || [];
  const shown = options.filter((o) => o.name.toLowerCase().includes(q.toLowerCase()));
  const exact = options.some((o) => o.name.toLowerCase() === q.trim().toLowerCase());

  const saveOptions = (opts) =>
    saveSchema(dbId, { ...schema, properties: schema.properties.map((p) => (p.id === prop.id ? { ...p, options: opts } : p)) });

  const toggle = (id) => {
    if (multi) onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
    else {
      onChange(selected[0] === id ? null : id);
      onClose();
    }
  };

  const create = async () => {
    const name = q.trim();
    if (!name) return;
    const opt = { id: uid(), name, color: randomColor() };
    await saveOptions([...options, opt]);
    setQ("");
    toggle(opt.id);
  };

  return (
    <Popover anchor={anchor} onClose={onClose} width={260}>
      <div className="sel-head">
        {selected.map((id) => (
          <Tag key={id} opt={options.find((o) => o.id === id)} onRemove={() => toggle(id)} />
        ))}
        <input
          autoFocus
          className="sel-input"
          placeholder={options.length ? t("Search or create…") : t("Type to create an option…")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              if (shown[0] && (exact || !q.trim())) toggle(shown[0].id);
              else create();
            }
            if (e.key === "Backspace" && !q && selected.length) toggle(selected.at(-1));
          }}
        />
      </div>
      <div className="pop-list">
        {shown.map((o) => (
          <div key={o.id} className="pop-row" onClick={() => toggle(o.id)}>
            <Tag opt={o} />
            <span style={{ flex: 1 }} />
            {selected.includes(o.id) && <span className="muted">✓</span>}
            <button
              className="icon-btn sm"
              onClick={(e) => {
                e.stopPropagation();
                setEditing(o);
                setEditAnchor(e.currentTarget);
              }}
            >
              ⋯
            </button>
          </div>
        ))}
        {q.trim() && !exact && (
          <div className="pop-row" onClick={create}>
            <span className="muted">{t("Create")}</span> <Tag opt={{ name: q.trim(), color: "default" }} />
          </div>
        )}
      </div>
      {editing && (
        <Popover anchor={editAnchor} onClose={() => setEditing(null)} width={200}>
          <input
            className="input"
            defaultValue={editing.name}
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
            onBlur={(e) => {
              const name = e.target.value.trim();
              if (name && name !== editing.name) saveOptions(options.map((o) => (o.id === editing.id ? { ...o, name } : o)));
            }}
          />
          <button
            className="menu-item danger"
            onClick={() => {
              saveOptions(options.filter((o) => o.id !== editing.id));
              setEditing(null);
            }}
          >
            <span className="menu-ico">🗑</span>{t("Delete option")}
          </button>
          <div className="menu-sep" />
          <div className="muted small" style={{ padding: "2px 8px" }}>{t("Color")}</div>
          {COLORS.map((c) => (
            <button
              key={c}
              className="menu-item"
              onClick={() => {
                saveOptions(options.map((o) => (o.id === editing.id ? { ...o, color: c } : o)));
                setEditing({ ...editing, color: c });
              }}
            >
              <span className={`swatch c-${c}`} />
              {COLOR_NAMES[c]}
              {editing.color === c && <span style={{ marginLeft: "auto" }}>✓</span>}
            </button>
          ))}
        </Popover>
      )}
    </Popover>
  );
}

// Inline text-like editor: commits on blur / Enter
function TextInput({ value, onCommit, type = "text", placeholder, className = "" }) {
  const [v, setV] = useState(value ?? "");
  useEffect(() => setV(value ?? ""), [value]);
  return (
    <input
      className={`cell-input ${className}`}
      type={type}
      value={v}
      placeholder={placeholder}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => String(v) !== String(value ?? "") && onCommit(type === "number" ? (v === "" ? null : Number(v)) : v)}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.target.blur();
        if (e.key === "Escape") (setV(value ?? ""), setTimeout(() => e.target.blur()));
      }}
    />
  );
}

// One cell. `compact` = read-mostly rendering for board cards.
/** Pick related pages from the target database (search, toggle). */
export function RelationEditor({ prop, row, anchor, onClose }) {
  const { pages, byId } = usePages();
  const [q, setQ] = useState("");
  const selected = relatedIds(row, prop);
  const target = byId[prop.relation?.dbId];
  const options = pages
    .filter((p) => p.parent_id === prop.relation?.dbId && p.id !== row.id)
    .sort((a, b) => a.position - b.position)
    .filter((p) => !q.trim() || pageTitle(p).toLowerCase().includes(q.trim().toLowerCase()));
  const toggle = (id) => setRowValue(row, prop, selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  return (
    <Popover anchor={anchor} onClose={onClose} width={300}>
      <div className="muted small" style={{ padding: "2px 6px 6px" }}>
        {t("Link to pages in")} {target ? `${target.icon || "🗃️"} ${pageTitle(target)}` : "?"}
      </div>
      <input autoFocus className="input" placeholder={t("Search pages…")} value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="pop-list">
        {options.map((p) => (
          <div key={p.id} className="pop-row" onClick={() => toggle(p.id)}>
            <span>{p.icon || "📄"}</span>
            <span className="tree-title">{pageTitle(p)}</span>
            {selected.includes(p.id) && <span className="muted">✓</span>}
          </div>
        ))}
        {!options.length && <div className="muted pad small">{target ? t("No pages") : t("The linked database was deleted.")}</div>}
      </div>
    </Popover>
  );
}

const RelChips = ({ ids }) => {
  const { byId } = usePages();
  return ids.map((id) => (
    <button key={id} className="rel-chip" title={t("Open page")} onClick={(e) => (e.stopPropagation(), navigate(id))}>
      <span>{byId[id]?.icon || "📄"}</span>
      <span className="rel-title">{pageTitle(byId[id])}</span>
    </button>
  ));
};

export function RollupValue({ row, prop }) {
  usePages(); // recompute when related pages change
  const v = computeRollup(row, prop);
  if (v == null || v === "") return null;
  if (rollupIsPercent(prop))
    return (
      <span className="rollup-pct">
        <span className="rollup-num">{v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 1 })}%</span>
        <span className="progress rollup-bar"><span style={{ width: `${Math.min(100, v)}%` }} /></span>
      </span>
    );
  return <span className="rollup-num">{typeof v === "number" ? v.toLocaleString() : v}</span>;
}

export function Cell({ dbId, schema, prop, row, compact }) {
  const [anchor, setAnchor] = useState(null);
  const v = prop.type === "title" ? row.title : prop.type === "created_time" ? row.created_at : prop.type === "updated_time" ? row.updated_at : row.props?.[prop.id];
  const set = (val) => setRowValue(row, prop, val);

  switch (prop.type) {
    case "title":
      return compact ? (
        <span className="card-title">{v || t("Untitled")}</span>
      ) : (
        <div className="title-cell">
          <span className="row-icon">{row.icon || "📄"}</span>
          <TextInput value={v} onCommit={set} placeholder={t("Untitled")} className="bold" />
          <button className="open-btn" onClick={() => navigate(row.id)} title={t("Open as page")}>{t("↗ OPEN")}</button>
        </div>
      );
    case "text":
    case "url":
      if (compact) return v ? <span className="card-prop">{v}</span> : null;
      return (
        <div className="url-cell">
          <TextInput value={v} onCommit={set} />
          {prop.type === "url" && v && (
            <a className="url-go" href={/^https?:/.test(v) ? v : `https://${v}`} target="_blank" rel="noreferrer">↗</a>
          )}
        </div>
      );
    case "number":
      if (compact) return v != null && v !== "" ? <span className="card-prop">{v}</span> : null;
      return <TextInput value={v} onCommit={set} type="number" className="num" />;
    case "checkbox":
      return (
        <label className="cb-cell" onClick={(e) => e.stopPropagation()}>
          <input type="checkbox" checked={!!v} onChange={(e) => set(e.target.checked)} />
          {compact && <span className="muted small">{prop.name}</span>}
        </label>
      );
    case "date":
      if (compact) return v ? <span className="card-prop">{formatDate(v)}</span> : null;
      return <input className="cell-input" type="date" value={v || ""} onChange={(e) => set(e.target.value || null)} />;
    case "relation": {
      const ids = relatedIds(row, prop);
      if (compact) return ids.length ? <span className="card-tags"><RelChips ids={ids} /></span> : null;
      return (
        <>
          <div className="sel-cell rel-cell" onClick={(e) => setAnchor(e.currentTarget)}>
            <RelChips ids={ids} />
          </div>
          {anchor && <RelationEditor prop={prop} row={row} anchor={anchor} onClose={() => setAnchor(null)} />}
        </>
      );
    }
    case "rollup":
      return compact ? (
        <span className="card-prop"><RollupValue row={row} prop={prop} /></span>
      ) : (
        <div className="cell-ro rollup-cell"><RollupValue row={row} prop={prop} /></div>
      );
    case "created_time":
    case "updated_time":
      return <span className={compact ? "card-prop" : "cell-ro"}>{formatDate(v)}</span>;
    default:
      if (isSelectType(prop.type)) {
        const ids = prop.type === "multi_select" ? v || [] : v ? [v] : [];
        const tags = ids.map((id) => <Tag key={id} opt={(prop.options || []).find((o) => o.id === id)} />);
        if (compact) return ids.length ? <span className="card-tags">{tags}</span> : null;
        return (
          <>
            <div className="sel-cell" onClick={(e) => setAnchor(e.currentTarget)}>
              {tags}
            </div>
            {anchor && (
              <SelectEditor dbId={dbId} schema={schema} prop={prop} value={v} onChange={set} anchor={anchor} onClose={() => setAnchor(null)} />
            )}
          </>
        );
      }
      return null;
  }
}
