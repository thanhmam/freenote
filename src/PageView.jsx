import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { api } from "./api.js";
import { store, usePages, navigate, pageTitle, breadcrumbs, timeAgo } from "./store.js";
import Editor from "./Editor.jsx";
import { Menu, desktop, openInBrowser } from "./Sidebar.jsx";
import DatabaseView, { RowProperties } from "./db/DatabaseView.jsx";
import History from "./History.jsx";
import ExportTemplate from "./ExportTemplate.jsx";
import { Popover } from "./db/Cells.jsx";
import { t } from "./i18n.js";

function Backlinks({ id }) {
  const { byId } = usePages();
  const [links, setLinks] = useState([]);
  const updated = byId[id]?.updated_at;
  useEffect(() => {
    api.backlinks(id).then(setLinks);
  }, [id, updated]);
  // ignore links from a parent page whose only reference is the sub-page block (Notion shows those too, so keep all)
  if (!links.length) return null;
  return (
    <div className="backlinks">
      <div className="muted small backlinks-head">↙ {t("{n} pages link here", { n: links.length })}</div>
      {links.map((l) => (
        <button key={l.id} className="backlink" onClick={() => navigate(l.id)}>
          <span>{l.icon || (l.kind === "database" ? "🗃️" : "📄")}</span> {pageTitle(l)}
        </button>
      ))}
    </div>
  );
}

const EMOJIS =
  "📘📕📗📙📓📒📔📄📑🗂📁📂🗒🗓📅📌📍📎✏️🖊📝💡🔥⭐️✨🎯🚀✅☑️❗️❓💬💭🧠💼💰📈📊🏠🏢🌍🌱🌸🍀🍎☕️🍜🎵🎨🎬📷🎮⚽️🏃✈️🚗🛠⚙️🔧🔒🔑💻📱🖥🧪📚🎓🧾🏷❤️💙💚💛💜🖤😀😎🤔🥳😴🙌👍👀🐱🐶🦊🐼🌈☀️🌙⚡️❄️🎁🔔⏰⌛️";
const EMOJI_LIST = [...new Intl.Segmenter().segment(EMOJIS)].map((s) => s.segment);

const COVERS = [
  "linear-gradient(135deg,#f6d365,#fda085)",
  "linear-gradient(135deg,#a1c4fd,#c2e9fb)",
  "linear-gradient(135deg,#d4fc79,#96e6a1)",
  "linear-gradient(135deg,#fbc2eb,#a6c1ee)",
  "linear-gradient(135deg,#667eea,#764ba2)",
  "linear-gradient(135deg,#232526,#414345)",
  "linear-gradient(135deg,#ff9a9e,#fecfef)",
  "linear-gradient(135deg,#43e97b,#38f9d7)",
];
const coverStyle = (c) => (c?.startsWith("linear") ? { background: c } : { backgroundImage: `url(${c})` });

function EmojiPicker({ onPick, onRemove, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => ref.current && !ref.current.contains(e.target) && onClose();
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);
  return (
    <div className="emoji-picker" ref={ref}>
      <div className="ep-head">
        <input
          className="input"
          placeholder={t("Paste any emoji, then press Enter…")}
          onKeyDown={(e) => e.key === "Enter" && e.target.value.trim() && onPick(e.target.value.trim())}
        />
        <button className="btn ghost" onClick={() => onPick(EMOJI_LIST[Math.floor(Math.random() * EMOJI_LIST.length)])}>
          {t("Random")}
        </button>
        <button className="btn ghost" onClick={onRemove}>{t("Remove")}</button>
      </div>
      <div className="ep-grid">
        {EMOJI_LIST.map((e) => (
          <button key={e} onClick={() => onPick(e)}>{e}</button>
        ))}
      </div>
    </div>
  );
}

/** Long paths collapse like Notion: first / … / last two. "…" lists the hidden levels. */
function Breadcrumbs({ crumbs }) {
  const [more, setMore] = useState(null); // anchor element of the "…" button
  const crumb = (c, last) => (
    <button key={c.id} className={`crumb ${last ? "current" : ""}`} title={pageTitle(c)} onClick={() => navigate(c.id)}>
      {c.icon && <span>{c.icon} </span>}
      {pageTitle(c)}
    </button>
  );
  const collapse = crumbs.length > 4;
  const hidden = collapse ? crumbs.slice(1, -2) : [];
  const shown = collapse ? [crumbs[0], null, ...crumbs.slice(-2)] : crumbs;
  return (
    <div className="crumbs">
      {shown.map((c, i) => (
        <span key={c ? c.id : "more"} className="crumb-item">
          {i > 0 && <span className="crumb-sep">/</span>}
          {c ? (
            crumb(c, i === shown.length - 1)
          ) : (
            <>
              <button className="crumb" title={t("{n} more levels", { n: hidden.length })} onClick={(e) => setMore(e.currentTarget)}>…</button>
              {more && (
                <Popover anchor={more} onClose={() => setMore(null)} width={300}>
                  {hidden.map((h, i) => (
                    <button
                      key={h.id}
                      className="menu-item"
                      style={{ paddingLeft: 8 + i * 12 }}
                      onClick={() => {
                        setMore(null);
                        navigate(h.id);
                      }}
                    >
                      <span className="menu-ico">{h.icon || "📄"}</span>
                      <span className="tree-title">{pageTitle(h)}</span>
                    </button>
                  ))}
                </Popover>
              )}
            </>
          )}
        </span>
      ))}
    </div>
  );
}

export default function PageView({ id, theme, sidebarOpen, openSidebar }) {
  const { byId } = usePages();
  const meta = byId[id];
  const [page, setPage] = useState(null);
  const [status, setStatus] = useState("saved");
  const [title, setTitle] = useState(meta?.title || "");
  const [picker, setPicker] = useState(false);
  const [coverMenu, setCoverMenu] = useState(false);
  const [menu, setMenu] = useState(false);
  const [history, setHistory] = useState(false);
  const [exportTpl, setExportTpl] = useState(false);
  const [editorKey, setEditorKey] = useState(0);
  const titleRef = useRef(null);
  const titleTimer = useRef(null);
  const coverFile = useRef(null);

  useEffect(() => {
    api.get(id).then((p) => {
      setPage(p);
      setTitle(p.title);
    });
  }, [id]);

  useEffect(() => {
    document.title = `${meta?.icon ? meta.icon + " " : ""}${pageTitle(meta)} – Frnt`;
  }, [meta?.icon, meta?.title]);

  useLayoutEffect(() => {
    const el = titleRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px";
    }
  }, [title, page]);

  const save = async (data) => {
    store.patch(id, data);
    setStatus("saving");
    const r = await api.update(id, data);
    store.patch(id, { updated_at: r.updated_at });
    setStatus("saved");
  };

  const onTitle = (v) => {
    setTitle(v);
    store.patch(id, { title: v });
    clearTimeout(titleTimer.current);
    titleTimer.current = setTimeout(() => save({ title: v }), 400);
  };

  const exportMarkdown = () => {
    const md = `# ${pageTitle(meta)}\n\n` + window.__editor.blocksToMarkdownLossy(window.__editor.document);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([md], { type: "text/markdown" }));
    a.download = `${pageTitle(meta).replace(/[\\/:*?"<>|]/g, "_")}.md`;
    a.click();
  };

  if (!meta) return null;
  const crumbs = breadcrumbs(id, byId);
  const isDb = meta.kind === "database";
  const isRow = byId[meta.parent_id]?.kind === "database";

  return (
    <div className={`page ${meta.full_width || isDb ? "full" : ""} ${isDb ? "db-page" : ""}`}>
      <div className="topbar">
        {!sidebarOpen && (
          <button className="icon-btn" title={t("Show sidebar") + " (⌘\\)"} onClick={openSidebar}>☰</button>
        )}
        <Breadcrumbs crumbs={crumbs} />
        <span className="muted status">
          {status === "saving" ? t("Saving…") : status === "error" ? t("⚠ Save failed") : t("Edited {time}", { time: timeAgo(meta.updated_at) })}
        </span>
        <button
          className="icon-btn"
          title={meta.is_favorite ? t("Remove from favorites") : t("Add to favorites")}
          onClick={() => save({ is_favorite: meta.is_favorite ? 0 : 1 })}
        >
          {meta.is_favorite ? "★" : "☆"}
        </button>
        <div style={{ position: "relative" }}>
          <button className="icon-btn" onClick={() => setMenu(true)}>⋯</button>
          {menu && (
            <Menu
              onClose={() => setMenu(false)}
              style={{ right: 0, top: 32 }}
              items={[
                { icon: "↔", label: meta.full_width ? t("Default width") : t("Full width"), onClick: () => save({ full_width: meta.full_width ? 0 : 1 }) },
                !isDb && { icon: "🕘", label: t("Version history"), onClick: () => setHistory(true) },
                !isDb && { icon: "⬇", label: t("Export Markdown"), onClick: exportMarkdown },
                !meta.is_template && {
                  icon: "📋",
                  label: t("Save as template"),
                  onClick: async () => {
                    const p = await api.duplicate(id, { template: true });
                    store.setPages(await api.list());
                    navigate(p.id);
                  },
                },
                { icon: "📦", label: t("Export as library template…"), onClick: () => setExportTpl(true) },
                { icon: "🖨", label: t("Print / Save as PDF"), onClick: () => window.print() },
                desktop && { icon: "🌐", label: t("Open in browser"), onClick: () => openInBrowser() },
                {
                  icon: "⧉",
                  label: t("Duplicate"),
                  onClick: async () => {
                    const p = await api.duplicate(id);
                    store.setPages(await api.list());
                    navigate(p.id);
                  },
                },
                "-",
                {
                  icon: "🗑",
                  label: t("Move to trash"),
                  danger: true,
                  onClick: async () => {
                    await api.moveToTrash(id);
                    store.setPages(await api.list());
                    navigate(meta.parent_id);
                  },
                },
              ]}
            />
          )}
        </div>
      </div>

      {exportTpl && <ExportTemplate id={id} onClose={() => setExportTpl(false)} />}
      {history && (
        <History
          pageId={id}
          theme={theme}
          onClose={() => setHistory(false)}
          onRestored={async () => {
            const p = await api.get(id);
            setPage(p);
            setTitle(p.title);
            store.patch(id, { title: p.title, updated_at: Date.now() });
            setEditorKey((k) => k + 1);
          }}
        />
      )}
      <div className="scroll">
        {!!meta.is_template && (
          <div className="tpl-banner">
            <span>📋 {t("This is a template. Edits here change the template itself.")}</span>
            <button
              className="btn small"
              onClick={async () => {
                const p = await api.duplicate(id, { parent_id: null });
                store.setPages(await api.list());
                navigate(p.id);
              }}
            >
              {t("Use this template")}
            </button>
          </div>
        )}
        {meta.cover && (
          <div className="cover" style={coverStyle(meta.cover)}>
            <div className="cover-actions">
              <button className="btn small" onClick={() => setCoverMenu(true)}>{t("Change cover")}</button>
              <button className="btn small" onClick={() => save({ cover: null })}>{t("Remove")}</button>
            </div>
          </div>
        )}
        {coverMenu && (
          <div className="cover-menu-wrap">
            <div className="cover-menu">
              <div className="ep-grid covers">
                {COVERS.map((c) => (
                  <button key={c} style={{ background: c }} onClick={() => { save({ cover: c }); setCoverMenu(false); }} />
                ))}
              </div>
              <div className="row">
                <button className="btn ghost" onClick={() => coverFile.current.click()}>{t("Upload image…")}</button>
                <button className="btn ghost" onClick={() => setCoverMenu(false)}>{t("Close")}</button>
              </div>
              <input
                ref={coverFile}
                type="file"
                accept="image/*"
                hidden
                onChange={async (e) => {
                  const f = e.target.files[0];
                  if (f) save({ cover: await api.upload(f) });
                  setCoverMenu(false);
                }}
              />
            </div>
          </div>
        )}

        <div className={`page-inner ${meta.cover ? "has-cover" : ""}`}>
          <div className="page-head">
            {meta.icon && (
              <button className="page-icon" onClick={() => setPicker(true)}>{meta.icon}</button>
            )}
            <div className="head-actions">
              {!meta.icon && (
                <button className="btn ghost small" onClick={() => setPicker(true)}>{t("☺ Add icon")}</button>
              )}
              {!meta.cover && (
                <button className="btn ghost small" onClick={() => save({ cover: COVERS[Math.floor(Math.random() * COVERS.length)] })}>
                  {t("🖼 Add cover")}
                </button>
              )}
            </div>
            {picker && (
              <EmojiPicker
                onClose={() => setPicker(false)}
                onPick={(e) => { save({ icon: e }); setPicker(false); }}
                onRemove={() => { save({ icon: null }); setPicker(false); }}
              />
            )}
            <textarea
              ref={titleRef}
              className="title"
              rows={1}
              placeholder={t("Untitled")}
              value={title}
              autoFocus={!title}
              onChange={(e) => onTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || (e.key === "ArrowDown" && e.target.selectionStart === title.length)) {
                  e.preventDefault();
                  const ed = isDb ? null : window.__editor;
                  ed?.setTextCursorPosition(ed.document[0], "start");
                  ed?.focus();
                }
              }}
            />
          </div>
          {isRow && page && <RowProperties row={meta} />}
          {isDb ? (
            <DatabaseView dbId={id} />
          ) : page && (
            <Editor
              key={editorKey}
              page={page}
              theme={theme}
              onSaving={setStatus}
              onSaved={() => setStatus("saved")}
            />
          )}
          {!meta.is_template && <Backlinks id={id} />}
        </div>
      </div>
    </div>
  );
}
