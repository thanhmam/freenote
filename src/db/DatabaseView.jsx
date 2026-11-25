import { useMemo, useRef, useState } from "react";
import { api } from "../api.js";
import { usePages, store, navigate, pageTitle } from "../store.js";
import {
  TYPES, ADDABLE_TYPES, allProps, applyView, opsFor, opNeedsValue, isSelectType, getVal,
  saveSchema, updateView, updateProp, setRowValue, createRow, uid, randomColor,
} from "./dbUtils.js";
import { Popover, Cell, Tag } from "./Cells.jsx";
import { t } from "../i18n.js";

const MenuBtn = ({ icon, label, onClick, danger, right }) => (
  <button className={`menu-item ${danger ? "danger" : ""}`} onClick={onClick}>
    <span className="menu-ico">{icon}</span>
    {label}
    {right && <span className="muted" style={{ marginLeft: "auto" }}>{right}</span>}
  </button>
);

/* ---------------- Property header menu ---------------- */
function PropMenu({ dbId, schema, view, prop, anchor, onClose }) {
  const [typeOpen, setTypeOpen] = useState(null);
  const sortBy = (dir) => {
    updateView(dbId, schema, view.id, { sorts: [{ prop: prop.id, dir }, ...(view.sorts || []).filter((s) => s.prop !== prop.id)] });
    onClose();
  };
  const changeType = (type) => {
    const patch = { type };
    if (isSelectType(type) && !prop.options) patch.options = [];
    updateProp(dbId, schema, prop.id, patch);
    // convert values between single <-> multi select so data isn't lost
    const rows = store.get().pages.filter((p) => p.parent_id === dbId);
    for (const r of rows) {
      const v = r.props?.[prop.id];
      if (v == null) continue;
      if (type === "multi_select" && !Array.isArray(v) && isSelectType(prop.type)) setRowValue(r, prop, [v]);
      if ((type === "select" || type === "status") && Array.isArray(v)) setRowValue(r, prop, v[0] ?? null);
    }
    onClose();
  };
  return (
    <Popover anchor={anchor} onClose={onClose} width={240}>
      <input
        className="input"
        autoFocus
        defaultValue={prop.name}
        onKeyDown={(e) => e.key === "Enter" && (e.target.blur(), onClose())}
        onBlur={(e) => e.target.value.trim() && e.target.value !== prop.name && updateProp(dbId, schema, prop.id, { name: e.target.value.trim() })}
      />
      <div className="menu-sep" />
      {prop.type !== "title" && (
        <MenuBtn icon={TYPES[prop.type].icon} label={t("Property type")} right={`${TYPES[prop.type].label} ›`} onClick={(e) => setTypeOpen(e.currentTarget)} />
      )}
      <MenuBtn icon="↑" label={t("Sort ascending")} onClick={() => sortBy("asc")} />
      <MenuBtn icon="↓" label={t("Sort descending")} onClick={() => sortBy("desc")} />
      <MenuBtn
        icon="⚲"
        label={t("Filter by this property")}
        onClick={() => {
          updateView(dbId, schema, view.id, { filters: [...(view.filters || []), { id: uid(), prop: prop.id, op: Object.keys(opsFor(prop.type))[0], value: "" }] });
          onClose();
        }}
      />
      {prop.type !== "title" && (
        <>
          <MenuBtn icon="👁" label={t("Hide in this view")} onClick={() => (updateView(dbId, schema, view.id, { hidden: [...(view.hidden || []), prop.id] }), onClose())} />
          <MenuBtn
            icon="⧉"
            label={t("Duplicate property")}
            onClick={() => {
              const i = schema.properties.findIndex((p) => p.id === prop.id);
              const props = [...schema.properties];
              props.splice(i + 1, 0, { ...prop, id: uid(), name: `${prop.name} (copy)` });
              saveSchema(dbId, { ...schema, properties: props });
              onClose();
            }}
          />
          <div className="menu-sep" />
          <MenuBtn
            icon="🗑"
            label={t("Delete property")}
            danger
            onClick={() => {
              if (!confirm(t('Delete property "{name}"? Its values will no longer be shown.', { name: prop.name }))) return;
              saveSchema(dbId, {
                ...schema,
                properties: schema.properties.filter((p) => p.id !== prop.id),
                views: schema.views.map((v) => ({
                  ...v,
                  sorts: (v.sorts || []).filter((s) => s.prop !== prop.id),
                  filters: (v.filters || []).filter((f) => f.prop !== prop.id),
                  groupBy: v.groupBy === prop.id ? null : v.groupBy,
                })),
              });
              onClose();
            }}
          />
        </>
      )}
      {typeOpen && (
        <Popover anchor={typeOpen} onClose={() => setTypeOpen(null)} width={200}>
          {ADDABLE_TYPES.map((t) => (
            <MenuBtn key={t} icon={TYPES[t].icon} label={TYPES[t].label} right={prop.type === t ? "✓" : ""} onClick={() => changeType(t)} />
          ))}
        </Popover>
      )}
    </Popover>
  );
}

function AddPropMenu({ dbId, schema, anchor, onClose }) {
  const [name, setName] = useState("");
  const add = (type) => {
    const p = { id: uid(), name: name.trim() || TYPES[type].label, type };
    if (isSelectType(type)) p.options = type === "status"
      ? [{ id: uid(), name: t("Not started"), color: "gray" }, { id: uid(), name: t("In progress"), color: "blue" }, { id: uid(), name: t("Done"), color: "green" }]
      : [];
    saveSchema(dbId, { ...schema, properties: [...schema.properties, p] });
    onClose();
  };
  return (
    <Popover anchor={anchor} onClose={onClose} width={220}>
      <input className="input" autoFocus placeholder={t("Property name")} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add("text")} />
      <div className="muted small" style={{ padding: "8px 8px 2px" }}>{t("Type")}</div>
      {ADDABLE_TYPES.map((t) => (
        <MenuBtn key={t} icon={TYPES[t].icon} label={TYPES[t].label} onClick={() => add(t)} />
      ))}
    </Popover>
  );
}

/* ---------------- Filter & Sort editors ---------------- */
function FilterEditor({ dbId, schema, view, anchor, onClose }) {
  const props = allProps(schema);
  const filters = view.filters || [];
  const set = (filters) => updateView(dbId, schema, view.id, { filters });
  const patch = (id, p) => set(filters.map((f) => (f.id === id ? { ...f, ...p } : f)));
  return (
    <Popover anchor={anchor} onClose={onClose} width={480} align="right">
      {filters.length === 0 && <div className="muted pad">{t("No filters yet")}</div>}
      {filters.map((f, i) => {
        const prop = props.find((p) => p.id === f.prop) || props[0];
        const ops = opsFor(prop.type);
        return (
          <div key={f.id} className="rule">
            <span className="muted small rule-and">{i === 0 ? t("Where") : t("And")}</span>
            <select value={f.prop} onChange={(e) => {
              const np = props.find((p) => p.id === e.target.value);
              patch(f.id, { prop: np.id, op: Object.keys(opsFor(np.type))[0], value: "" });
            }}>
              {props.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={f.op} onChange={(e) => patch(f.id, { op: e.target.value })}>
              {Object.entries(ops).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            {opNeedsValue(f.op) ? (
              isSelectType(prop.type) ? (
                <select value={f.value} onChange={(e) => patch(f.id, { value: e.target.value })}>
                  <option value="">{t("— select —")}</option>
                  {(prop.options || []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              ) : (
                <input
                  className="input rule-val"
                  type={prop.type === "number" ? "number" : ["date", "created_time", "updated_time"].includes(prop.type) ? "date" : "text"}
                  defaultValue={f.value}
                  placeholder={t("Value…")}
                  onChange={(e) => patch(f.id, { value: e.target.value })}
                />
              )
            ) : (
              <span className="rule-val" />
            )}
            <button className="icon-btn sm" onClick={() => set(filters.filter((x) => x.id !== f.id))}>✕</button>
          </div>
        );
      })}
      <button className="menu-item" onClick={() => set([...filters, { id: uid(), prop: "title", op: "contains", value: "" }])}>
        <span className="menu-ico">+</span>{t("Add filter")}
      </button>
    </Popover>
  );
}

function SortEditor({ dbId, schema, view, anchor, onClose }) {
  const props = allProps(schema);
  const sorts = view.sorts || [];
  const set = (sorts) => updateView(dbId, schema, view.id, { sorts });
  return (
    <Popover anchor={anchor} onClose={onClose} width={360} align="right">
      {sorts.length === 0 && <div className="muted pad">{t("No sorts, using manual order")}</div>}
      {sorts.map((s, i) => (
        <div key={i} className="rule">
          <select value={s.prop} onChange={(e) => set(sorts.map((x, j) => (j === i ? { ...x, prop: e.target.value } : x)))}>
            {props.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={s.dir} onChange={(e) => set(sorts.map((x, j) => (j === i ? { ...x, dir: e.target.value } : x)))}>
            <option value="asc">{t("Ascending")}</option>
            <option value="desc">{t("Descending")}</option>
          </select>
          <span className="rule-val" />
          <button className="icon-btn sm" onClick={() => set(sorts.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button className="menu-item" onClick={() => set([...sorts, { prop: "title", dir: "asc" }])}>
        <span className="menu-ico">+</span>{t("Add sort")}
      </button>
    </Popover>
  );
}

function PropsVisibility({ dbId, schema, view, anchor, onClose }) {
  const hidden = view.hidden || [];
  return (
    <Popover anchor={anchor} onClose={onClose} width={260} align="right">
      <div className="muted small" style={{ padding: "4px 8px" }}>{t("Visible properties")}</div>
      {schema.properties.map((p) => (
        <label key={p.id} className="menu-item">
          <span className="menu-ico">{TYPES[p.type]?.icon}</span>
          {p.name}
          <input
            type="checkbox"
            style={{ marginLeft: "auto" }}
            checked={!hidden.includes(p.id)}
            onChange={(e) => updateView(dbId, schema, view.id, { hidden: e.target.checked ? hidden.filter((x) => x !== p.id) : [...hidden, p.id] })}
          />
        </label>
      ))}
      {view.type === "board" && (
        <>
          <div className="menu-sep" />
          <div className="muted small" style={{ padding: "4px 8px" }}>{t("Group by")}</div>
          {schema.properties.filter((p) => p.type === "select" || p.type === "status").map((p) => (
            <MenuBtn key={p.id} icon="◉" label={p.name} right={view.groupBy === p.id ? "✓" : ""} onClick={() => updateView(dbId, schema, view.id, { groupBy: p.id })} />
          ))}
        </>
      )}
    </Popover>
  );
}

/* ---------------- Row actions ---------------- */
function RowMenu({ row, anchor, onClose }) {
  return (
    <Popover anchor={anchor} onClose={onClose} width={200}>
      <MenuBtn icon="↗" label={t("Open as page")} onClick={() => navigate(row.id)} />
      <MenuBtn
        icon="⧉"
        label={t("Duplicate")}
        onClick={async () => {
          await api.duplicate(row.id);
          store.setPages(await api.list());
          onClose();
        }}
      />
      <div className="menu-sep" />
      <MenuBtn
        icon="🗑"
        label={t("Delete")}
        danger
        onClick={async () => {
          onClose();
          store.setPages(store.get().pages.filter((p) => p.id !== row.id));
          await api.moveToTrash(row.id);
        }}
      />
    </Popover>
  );
}

/* ---------------- Table view ---------------- */
let dragRowId = null;

function TableView({ dbId, schema, view, rows, visibleProps, manualOrder }) {
  const [propMenu, setPropMenu] = useState(null);
  const [addProp, setAddProp] = useState(null);
  const [rowMenu, setRowMenu] = useState(null);
  const [dropOn, setDropOn] = useState(null);
  const [limit, setLimit] = useState(100); // render big databases progressively
  const shown = rows.slice(0, limit);
  const widths = view.widths || {};
  const w = (p) => widths[p.id] || (p.type === "title" ? 280 : p.type === "checkbox" ? 90 : 180);

  const startResize = (e, p) => {
    e.preventDefault();
    e.stopPropagation();
    const x0 = e.clientX, w0 = w(p);
    const th = e.currentTarget.parentElement;
    let nw = w0;
    const move = (ev) => {
      nw = Math.max(70, w0 + ev.clientX - x0);
      th.style.width = th.style.minWidth = nw + "px";
    };
    const up = () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
      updateView(dbId, schema, view.id, { widths: { ...widths, [p.id]: nw } });
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  };

  const dropRow = async (target) => {
    const id = dragRowId;
    dragRowId = null;
    setDropOn(null);
    if (!id || id === target.id || !manualOrder) return;
    const list = rows.filter((r) => r.id !== id);
    const idx = list.findIndex((r) => r.id === target.id);
    const prev = list[idx - 1];
    const position = prev ? (prev.position + target.position) / 2 : target.position - 1;
    store.patch(id, { position });
    await api.update(id, { position });
  };

  return (
    <div className="db-table-wrap">
      <table className="db-table">
        <thead>
          <tr>
            <th className="row-handle-col" />
            {visibleProps.map((p) => (
              <th key={p.id} style={{ width: w(p), minWidth: w(p) }}>
                <button className="th-btn" onClick={(e) => setPropMenu({ prop: p, anchor: e.currentTarget })}>
                  <span className="th-ico">{TYPES[p.type]?.icon}</span>
                  <span className="th-name">{p.name}</span>
                </button>
                <span className="resizer" onMouseDown={(e) => startResize(e, p)} />
              </th>
            ))}
            <th className="add-col">
              <button className="th-btn" title={t("Add property")} onClick={(e) => setAddProp(e.currentTarget)}>+</button>
            </th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <tr
              key={r.id}
              className={dropOn === r.id ? "drop-target" : ""}
              onDragOver={(e) => manualOrder && dragRowId && (e.preventDefault(), setDropOn(r.id))}
              onDragLeave={() => setDropOn(null)}
              onDrop={() => dropRow(r)}
            >
              <td className="row-handle-col">
                <button
                  className="row-handle"
                  draggable={manualOrder}
                  title={manualOrder ? t("Drag to reorder · click for menu") : t("Click for menu")}
                  onDragStart={() => (dragRowId = r.id)}
                  onClick={(e) => setRowMenu({ row: r, anchor: e.currentTarget })}
                >
                  ⋮⋮
                </button>
              </td>
              {visibleProps.map((p) => (
                <td key={p.id} className={`td-${p.type}`}>
                  <Cell dbId={dbId} schema={schema} prop={p} row={r} />
                </td>
              ))}
              <td />
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > limit && (
        <button className="new-row load-more" onClick={() => setLimit((l) => l + 200)}>
          ↓ {t("Load {n} more", { n: Math.min(200, rows.length - limit) })} ({limit}/{rows.length})
        </button>
      )}
      <button className="new-row" onClick={() => createRow(dbId)}>{t("+ New")}</button>
      <div className="db-count muted small">{t("{n} items", { n: rows.length })}</div>
      {propMenu && <PropMenu dbId={dbId} schema={schema} view={view} prop={propMenu.prop} anchor={propMenu.anchor} onClose={() => setPropMenu(null)} />}
      {addProp && <AddPropMenu dbId={dbId} schema={schema} anchor={addProp} onClose={() => setAddProp(null)} />}
      {rowMenu && <RowMenu row={rowMenu.row} anchor={rowMenu.anchor} onClose={() => setRowMenu(null)} />}
    </div>
  );
}

/* ---------------- Board view ---------------- */
let dragCardId = null;

function BoardView({ dbId, schema, view, rows, visibleProps }) {
  const group = schema.properties.find((p) => p.id === view.groupBy && (p.type === "select" || p.type === "status"));
  const [over, setOver] = useState(null);
  const [rowMenu, setRowMenu] = useState(null);
  const [colLimit, setColLimit] = useState({}); // column id → number of cards shown

  if (!group) {
    const candidates = schema.properties.filter((p) => p.type === "select" || p.type === "status");
    return (
      <div className="muted pad">
        {t("A board needs a Select or Status property to group cards by.")}{" "}
        {candidates[0] ? (
          <button className="btn small" onClick={() => updateView(dbId, schema, view.id, { groupBy: candidates[0].id })}>{t('Group by "{name}"', { name: candidates[0].name })}</button>
        ) : (
          <button
            className="btn small"
            onClick={() => {
              const p = { id: uid(), name: t("Status"), type: "status", options: [{ id: uid(), name: t("Not started"), color: "gray" }, { id: uid(), name: t("In progress"), color: "blue" }, { id: uid(), name: t("Done"), color: "green" }] };
              saveSchema(dbId, { ...schema, properties: [...schema.properties, p], views: schema.views.map((v) => (v.id === view.id ? { ...v, groupBy: p.id } : v)) });
            }}
          >
            {t("Create a Status property")}
          </button>
        )}
      </div>
    );
  }

  const columns = [{ id: null, name: t("No {name}", { name: group.name }), color: "default" }, ...(group.options || [])];
  const cardProps = visibleProps.filter((p) => p.type !== "title" && p.id !== group.id);

  const drop = async (colId) => {
    const id = dragCardId;
    dragCardId = null;
    setOver(null);
    const row = rows.find((r) => r.id === id);
    if (row && (row.props?.[group.id] ?? null) !== colId) setRowValue(row, group, colId);
  };

  return (
    <div className="board">
      {columns.map((c) => {
        const items = rows.filter((r) => (r.props?.[group.id] ?? null) === c.id || (c.id === null && !(group.options || []).some((o) => o.id === r.props?.[group.id])));
        if (c.id === null && items.length === 0) return null;
        return (
          <div
            key={c.id ?? "none"}
            className={`board-col ${over === (c.id ?? "none") ? "over" : ""}`}
            onDragOver={(e) => (e.preventDefault(), setOver(c.id ?? "none"))}
            onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget) && setOver(null)}
            onDrop={() => drop(c.id)}
          >
            <div className="board-col-head">
              <Tag opt={c} />
              <span className="muted small">{items.length}</span>
            </div>
            {items.slice(0, colLimit[c.id ?? "none"] || 50).map((r) => (
              <div
                key={r.id}
                className="card"
                draggable
                onDragStart={() => (dragCardId = r.id)}
                onClick={() => navigate(r.id)}
              >
                <div className="card-top">
                  {r.icon && <span>{r.icon} </span>}
                  <Cell dbId={dbId} schema={schema} prop={{ id: "title", type: "title" }} row={r} compact />
                  <button className="icon-btn sm card-menu" onClick={(e) => (e.stopPropagation(), setRowMenu({ row: r, anchor: e.currentTarget }))}>⋯</button>
                </div>
                {cardProps.map((p) => (
                  <div key={p.id} className="card-line" onClick={(e) => p.type === "checkbox" && e.stopPropagation()}>
                    <Cell dbId={dbId} schema={schema} prop={p} row={r} compact />
                  </div>
                ))}
              </div>
            ))}
            {items.length > (colLimit[c.id ?? "none"] || 50) && (
              <button className="new-card" onClick={() => setColLimit((m) => ({ ...m, [c.id ?? "none"]: (m[c.id ?? "none"] || 50) + 100 }))}>
                ↓ {t("Load {n} more", { n: Math.min(100, items.length - (colLimit[c.id ?? "none"] || 50)) })}
              </button>
            )}
            <button className="new-card" onClick={() => createRow(dbId, c.id ? { [group.id]: c.id } : {})}>{t("+ New")}</button>
          </div>
        );
      })}
      <button
        className="board-add-col"
        onClick={() => {
          const name = prompt(t("New group name:"));
          if (name?.trim())
            saveSchema(dbId, { ...schema, properties: schema.properties.map((p) => (p.id === group.id ? { ...p, options: [...(p.options || []), { id: uid(), name: name.trim(), color: randomColor() }] } : p)) });
        }}
      >
        {t("+ Add group")}
      </button>
      {rowMenu && <RowMenu row={rowMenu.row} anchor={rowMenu.anchor} onClose={() => setRowMenu(null)} />}
    </div>
  );
}

/* ---------------- Main ---------------- */
export default function DatabaseView({ dbId, inline }) {
  const { pages, byId } = usePages();
  const db = byId[dbId];
  const schema = db?.db_schema;
  const [activeId, setActiveId] = useState(() => localStorage.getItem(`view:${dbId}`));
  const [pop, setPop] = useState(null); // {kind, anchor}
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const titleRef = useRef(null);

  const allRows = useMemo(() => pages.filter((p) => p.parent_id === dbId), [pages, dbId]);
  const view = schema?.views?.find((v) => v.id === activeId) || schema?.views?.[0];
  const rows = useMemo(() => (view ? applyView(allRows, view, schema, search) : []), [allRows, view, schema, search]);

  if (!db) return <div className="muted pad">{t("This database was deleted.")}</div>;
  if (!schema || !view) return <div className="muted pad">{t("This database is corrupted.")}</div>;

  const visibleProps = allProps(schema).filter((p) => !(view.hidden || []).includes(p.id));
  const selectView = (id) => {
    setActiveId(id);
    localStorage.setItem(`view:${dbId}`, id);
  };
  const addView = (type) => {
    const v = {
      id: uid(), name: type === "table" ? t("Table") : "Board", type, sorts: [], filters: [], hidden: [], widths: {},
      groupBy: schema.properties.find((p) => p.type === "status" || p.type === "select")?.id || null,
    };
    saveSchema(dbId, { ...schema, views: [...schema.views, v] });
    selectView(v.id);
    setPop(null);
  };
  const open = (kind) => (e) => setPop({ kind, anchor: e.currentTarget });
  const close = () => setPop(null);
  const nFilters = (view.filters || []).length;
  const nSorts = (view.sorts || []).length;

  return (
    <div className={`database ${inline ? "inline" : ""}`}>
      {inline && (
        <div className="db-inline-head">
          <span className="db-inline-icon">{db.icon || "🗃️"}</span>
          <input
            ref={titleRef}
            className="db-inline-title"
            placeholder={t("Untitled")}
            defaultValue={db.title}
            onBlur={(e) => e.target.value !== db.title && (store.patch(dbId, { title: e.target.value }), api.update(dbId, { title: e.target.value }))}
            onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
          />
          <button className="icon-btn sm" title={t("Open as full page")} onClick={() => navigate(dbId)}>↗</button>
        </div>
      )}
      <div className="db-toolbar">
        <div className="view-tabs">
          {schema.views.map((v) => (
            <button
              key={v.id}
              className={`view-tab ${v.id === view.id ? "active" : ""}`}
              onClick={(e) => (v.id === view.id ? setPop({ kind: "viewMenu", anchor: e.currentTarget }) : selectView(v.id))}
              title={v.id === view.id ? t("Click to rename / delete view") : ""}
            >
              <span>{v.type === "table" ? "▦" : "▥"}</span> {v.name}
            </button>
          ))}
          <button className="icon-btn sm" title={t("Add view")} onClick={open("addView")}>+</button>
        </div>
        <div className="db-actions">
          <button className={`tool-btn ${nFilters ? "on" : ""}`} onClick={open("filter")}>{t("Filter")}{nFilters ? ` · ${nFilters}` : ""}</button>
          <button className={`tool-btn ${nSorts ? "on" : ""}`} onClick={open("sort")}>{t("Sort")}{nSorts ? ` · ${nSorts}` : ""}</button>
          {searchOpen ? (
            <input className="input db-search" autoFocus placeholder={t("Search…")} value={search} onChange={(e) => setSearch(e.target.value)} onBlur={() => !search && setSearchOpen(false)} />
          ) : (
            <button className="tool-btn" onClick={() => setSearchOpen(true)}>🔍</button>
          )}
          <button className="tool-btn" title={t("Properties")} onClick={open("props")}>⚙</button>
          <button className="btn small" onClick={() => createRow(dbId)}>{t("New")}</button>
        </div>
      </div>

      {view.type === "board" ? (
        <BoardView dbId={dbId} schema={schema} view={view} rows={rows} visibleProps={visibleProps} />
      ) : (
        <TableView dbId={dbId} schema={schema} view={view} rows={rows} visibleProps={visibleProps} manualOrder={!nSorts} />
      )}

      {pop?.kind === "filter" && <FilterEditor dbId={dbId} schema={schema} view={view} anchor={pop.anchor} onClose={close} />}
      {pop?.kind === "sort" && <SortEditor dbId={dbId} schema={schema} view={view} anchor={pop.anchor} onClose={close} />}
      {pop?.kind === "props" && <PropsVisibility dbId={dbId} schema={schema} view={view} anchor={pop.anchor} onClose={close} />}
      {pop?.kind === "addView" && (
        <Popover anchor={pop.anchor} onClose={close} width={180}>
          <MenuBtn icon="▦" label={t("Table")} onClick={() => addView("table")} />
          <MenuBtn icon="▥" label="Board (Kanban)" onClick={() => addView("board")} />
        </Popover>
      )}
      {pop?.kind === "viewMenu" && (
        <Popover anchor={pop.anchor} onClose={close} width={220}>
          <input
            className="input"
            autoFocus
            defaultValue={view.name}
            onKeyDown={(e) => e.key === "Enter" && (e.target.blur(), close())}
            onBlur={(e) => e.target.value.trim() && updateView(dbId, schema, view.id, { name: e.target.value.trim() })}
          />
          <MenuBtn
            icon="⧉"
            label={t("Duplicate view")}
            onClick={() => {
              const v = { ...view, id: uid(), name: `${view.name} (copy)` };
              saveSchema(dbId, { ...schema, views: [...schema.views, v] });
              selectView(v.id);
              close();
            }}
          />
          {schema.views.length > 1 && (
            <MenuBtn
              icon="🗑"
              label={t("Delete view")}
              danger
              onClick={() => {
                saveSchema(dbId, { ...schema, views: schema.views.filter((v) => v.id !== view.id) });
                close();
              }}
            />
          )}
        </Popover>
      )}
    </div>
  );
}

/* ---------------- Properties panel on a row page ---------------- */
export function RowProperties({ row }) {
  const { byId } = usePages();
  const db = byId[row.parent_id];
  const schema = db?.db_schema;
  const [addProp, setAddProp] = useState(null);
  const [propMenu, setPropMenu] = useState(null);
  if (!schema) return null;
  const live = byId[row.id] || row;
  return (
    <div className="row-props">
      {schema.properties.map((p) => (
        <div key={p.id} className="row-prop">
          <button className="row-prop-name" onClick={(e) => setPropMenu({ prop: p, anchor: e.currentTarget })}>
            <span className="th-ico">{TYPES[p.type]?.icon}</span> {p.name}
          </button>
          <div className={`row-prop-val td-${p.type}`}>
            <Cell dbId={db.id} schema={schema} prop={p} row={live} />
          </div>
        </div>
      ))}
      <button className="row-prop-add muted" onClick={(e) => setAddProp(e.currentTarget)}>{t("+ Add property")}</button>
      <div className="muted small row-prop-db">
        {t("In database")} <button className="crumb" onClick={() => navigate(db.id)}>{db.icon || "🗃️"} {pageTitle(db)}</button>
      </div>
      {addProp && <AddPropMenu dbId={db.id} schema={schema} anchor={addProp} onClose={() => setAddProp(null)} />}
      {propMenu && (
        <PropMenu dbId={db.id} schema={schema} view={schema.views[0]} prop={propMenu.prop} anchor={propMenu.anchor} onClose={() => setPropMenu(null)} />
      )}
    </div>
  );
}

export { getVal };
