import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api.js";
import { usePages, navigate, pageTitle, store, timeAgo } from "./store.js";
import { createDatabase } from "./db/dbUtils.js";
import Settings from "./Settings.jsx";

function useClickOutside(ref, onClose) {
  useEffect(() => {
    const h = (e) => ref.current && !ref.current.contains(e.target) && onClose();
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [ref, onClose]);
}

export function Menu({ items, onClose, style }) {
  const ref = useRef(null);
  useClickOutside(ref, onClose);
  return (
    <div className="menu" ref={ref} style={style} onClick={(e) => e.stopPropagation()}>
      {items.filter(Boolean).map((it, i) =>
        it === "-" ? (
          <div key={i} className="menu-sep" />
        ) : (
          <button
            key={i}
            className={`menu-item ${it.danger ? "danger" : ""}`}
            onClick={() => {
              onClose();
              it.onClick();
            }}
          >
            <span className="menu-ico">{it.icon}</span>
            {it.label}
          </button>
        )
      )}
    </div>
  );
}

let dragId = null;

function TreeItem({ page, depth, childrenOf, currentId, refresh, createPage, expanded, setExpanded }) {
  const kids = childrenOf[page.id] || [];
  const open = expanded[page.id];
  const [menu, setMenu] = useState(false);
  const [drop, setDrop] = useState(null); // 'before' | 'after' | 'inside'

  const onDragOver = (e) => {
    if (!dragId || dragId === page.id) return;
    e.preventDefault();
    const r = e.currentTarget.getBoundingClientRect();
    const y = (e.clientY - r.top) / r.height;
    setDrop(y < 0.25 ? "before" : y > 0.75 ? "after" : "inside");
  };

  const onDrop = async (e) => {
    e.preventDefault();
    const zone = drop;
    setDrop(null);
    const id = dragId;
    dragId = null;
    if (!id || id === page.id) return;
    let patch;
    if (zone === "inside") {
      const sib = childrenOf[page.id] || [];
      patch = { parent_id: page.id, position: (sib.at(-1)?.position || 0) + 1 };
      setExpanded((x) => ({ ...x, [page.id]: true }));
    } else {
      const sib = (childrenOf[page.parent_id || "root"] || []).filter((p) => p.id !== id);
      const idx = sib.findIndex((p) => p.id === page.id);
      const prev = zone === "before" ? sib[idx - 1] : page;
      const next = zone === "before" ? page : sib[idx + 1];
      const a = prev ? prev.position : next.position - 2;
      const b = next ? next.position : prev.position + 2;
      patch = { parent_id: page.parent_id, position: (a + b) / 2 };
    }
    try {
      await api.update(id, patch);
    } catch {
      alert("Không thể di chuyển trang vào chính nó.");
    }
    refresh();
  };

  return (
    <>
      <div
        className={`tree-row ${currentId === page.id ? "active" : ""} ${drop ? "drop-" + drop : ""}`}
        style={{ paddingLeft: 8 + depth * 14 }}
        draggable
        onDragStart={(e) => {
          dragId = page.id;
          e.dataTransfer.effectAllowed = "move";
        }}
        onDragOver={onDragOver}
        onDragLeave={() => setDrop(null)}
        onDrop={onDrop}
        onClick={() => navigate(page.id)}
      >
        <button
          className="chev"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((x) => ({ ...x, [page.id]: !open }));
          }}
        >
          <span style={{ transform: open ? "rotate(90deg)" : "none" }}>›</span>
        </button>
        <span className="tree-icon">{page.icon || (page.kind === "database" ? "🗃️" : "📄")}</span>
        <span className="tree-title">{pageTitle(page)}</span>
        <span className="tree-actions">
          <button
            className="icon-btn sm"
            title="Thêm, xoá, ..."
            onClick={(e) => {
              e.stopPropagation();
              setMenu(true);
            }}
          >
            ⋯
          </button>
          <button
            className="icon-btn sm"
            title="Thêm trang con"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((x) => ({ ...x, [page.id]: true }));
              createPage(page.id);
            }}
          >
            +
          </button>
        </span>
        {menu && (
          <Menu
            onClose={() => setMenu(false)}
            style={{ right: 4, top: 28 }}
            items={[
              {
                icon: page.is_favorite ? "☆" : "★",
                label: page.is_favorite ? "Bỏ yêu thích" : "Thêm vào yêu thích",
                onClick: async () => {
                  store.patch(page.id, { is_favorite: page.is_favorite ? 0 : 1 });
                  await api.update(page.id, { is_favorite: !page.is_favorite });
                },
              },
              {
                icon: "⧉",
                label: "Nhân bản",
                onClick: async () => {
                  const p = await api.duplicate(page.id);
                  await refresh();
                  navigate(p.id);
                },
              },
              {
                icon: "📋",
                label: "Lưu thành mẫu",
                onClick: async () => {
                  const p = await api.duplicate(page.id, { template: true });
                  await refresh();
                  navigate(p.id);
                },
              },
              {
                icon: "↗",
                label: "Chuyển ra ngoài cùng",
                onClick: async () => {
                  await api.update(page.id, { parent_id: null });
                  refresh();
                },
              },
              "-",
              {
                icon: "🗑",
                label: "Chuyển vào thùng rác",
                danger: true,
                onClick: async () => {
                  await api.moveToTrash(page.id);
                  refresh();
                },
              },
            ]}
          />
        )}
      </div>
      {open &&
        (kids.length ? (
          kids.map((k) => (
            <TreeItem
              key={k.id}
              page={k}
              depth={depth + 1}
              {...{ childrenOf, currentId, refresh, createPage, expanded, setExpanded }}
            />
          ))
        ) : page.kind === "database" ? null : (
          <div className="tree-empty" style={{ paddingLeft: 30 + depth * 14 }}>
            Không có trang con
          </div>
        ))}
    </>
  );
}

function TrashPanel({ onClose, refresh }) {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const ref = useRef(null);
  useClickOutside(ref, onClose);
  const load = () => api.trash().then(setItems);
  useEffect(() => {
    load();
  }, []);
  const shown = items.filter((p) => pageTitle(p).toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="trash-panel" ref={ref}>
      <input className="input" placeholder="Lọc trang trong thùng rác…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      <div className="trash-list">
        {shown.length === 0 && <div className="muted pad">Thùng rác trống</div>}
        {shown.map((p) => (
          <div key={p.id} className="trash-row">
            <span>{p.icon || "📄"}</span>
            <span className="tree-title">
              {pageTitle(p)}
              <small className="muted"> · {timeAgo(p.deleted_at)}</small>
            </span>
            <button
              className="icon-btn sm"
              title="Khôi phục"
              onClick={async () => {
                await api.restore(p.id);
                load();
                refresh();
              }}
            >
              ↺
            </button>
            <button
              className="icon-btn sm"
              title="Xoá vĩnh viễn"
              onClick={async () => {
                if (!confirm(`Xoá vĩnh viễn "${pageTitle(p)}" và các trang con?`)) return;
                await api.destroy(p.id);
                load();
              }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Sidebar({ currentId, refresh, createPage, openSearch, theme, toggleTheme, collapse }) {
  const { pages, byId } = usePages();
  const [expanded, setExpanded] = useState(() => JSON.parse(localStorage.getItem("expanded") || "{}"));
  const [trashOpen, setTrashOpen] = useState(false);
  const [settings, setSettings] = useState(false);
  const [tplOpen, setTplOpen] = useState(() => localStorage.getItem("tplOpen") === "1");

  useEffect(() => localStorage.setItem("tplOpen", tplOpen ? "1" : "0"), [tplOpen]);
  useEffect(() => localStorage.setItem("expanded", JSON.stringify(expanded)), [expanded]);

  // auto-expand ancestors of the current page
  useEffect(() => {
    let p = byId[currentId];
    const add = {};
    while (p?.parent_id) {
      add[p.parent_id] = true;
      p = byId[p.parent_id];
    }
    if (Object.keys(add).some((k) => !expanded[k])) setExpanded((x) => ({ ...x, ...add }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId, byId]);

  const childrenOf = useMemo(() => {
    const m = {};
    for (const p of pages) {
      if (p.is_template && !p.parent_id) continue; // templates have their own section
      if (p.parent_id && byId[p.parent_id]?.kind === "database") continue; // rows live inside the database view
      (m[p.parent_id || "root"] ||= []).push(p);
    }
    for (const k in m) m[k].sort((a, b) => a.position - b.position);
    return m;
  }, [pages, byId]);

  const favorites = pages.filter((p) => p.is_favorite && !p.is_template);
  const templates = pages.filter((p) => p.is_template && !p.parent_id).sort((a, b) => a.position - b.position);
  const treeProps = { childrenOf, currentId, refresh, createPage, expanded, setExpanded };

  return (
    <aside className="sidebar">
      <div className="sb-head">
        <div className="ws">
          <span className="ws-logo">F</span>
          <span>Frnt Notes</span>
        </div>
        <button className="icon-btn" title="Ẩn sidebar (⌘\)" onClick={collapse}>«</button>
      </div>

      <div className="sb-nav">
        <button className="sb-link" onClick={openSearch}>
          <span className="menu-ico">🔍</span> Tìm kiếm <kbd>⌘K</kbd>
        </button>
        <button className="sb-link" onClick={() => createPage(null)}>
          <span className="menu-ico">✚</span> Trang mới
        </button>
        <button className="sb-link" onClick={async () => navigate((await createDatabase(null)).id)}>
          <span className="menu-ico">🗃</span> Database mới
        </button>
      </div>

      <div className="sb-scroll">
        {favorites.length > 0 && (
          <>
            <div className="sb-section">Yêu thích</div>
            {favorites.map((p) => (
              <div
                key={p.id}
                className={`tree-row ${currentId === p.id ? "active" : ""}`}
                style={{ paddingLeft: 8 }}
                onClick={() => navigate(p.id)}
              >
                <span className="chev" />
                <span className="tree-icon">{p.icon || "📄"}</span>
                <span className="tree-title">{pageTitle(p)}</span>
              </div>
            ))}
          </>
        )}
        <div className="sb-section">
          Trang cá nhân
          <button className="icon-btn sm" title="Thêm trang" onClick={() => createPage(null)}>+</button>
        </div>
        {(childrenOf.root || []).map((p) => (
          <TreeItem key={p.id} page={p} depth={0} {...treeProps} />
        ))}
        <div className="sb-section clickable" onClick={() => setTplOpen((v) => !v)}>
          <span>{tplOpen ? "▾" : "▸"} Mẫu ({templates.length})</span>
        </div>
        {tplOpen &&
          templates.map((p) => (
            <div
              key={p.id}
              className={`tree-row ${currentId === p.id ? "active" : ""}`}
              style={{ paddingLeft: 8 }}
              onClick={() => navigate(p.id)}
            >
              <span className="chev" />
              <span className="tree-icon">{p.icon || "📋"}</span>
              <span className="tree-title">{pageTitle(p)}</span>
            </div>
          ))}
      </div>

      <div className="sb-foot">
        <button className="sb-link" onClick={() => setTrashOpen((v) => !v)}>
          <span className="menu-ico">🗑</span> Thùng rác
        </button>
        <button className="sb-link" onClick={() => setSettings(true)}>
          <span className="menu-ico">⚙</span> Cài đặt, sao lưu & nhập
        </button>
        {trashOpen && <TrashPanel onClose={() => setTrashOpen(false)} refresh={refresh} />}
        {settings && <Settings onClose={() => setSettings(false)} theme={theme} toggleTheme={toggleTheme} />}
      </div>
    </aside>
  );
}
