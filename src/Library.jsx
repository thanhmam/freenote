import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api.js";
import { store, navigate, timeAgo } from "./store.js";
import { t, lang } from "./i18n.js";
import NotionLinkImport, { NOTION_GALLERY, openExternal } from "./NotionLinkImport.jsx";

export const CATEGORIES = ["Work", "Projects", "Personal", "Education", "Other"];
export const catLabel = (c) => ({ Work: t("Work"), Projects: t("Projects"), Personal: t("Personal"), Education: t("Education"), Other: t("Other") })[c] || c;

export default function Library({ onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [langFilter, setLangFilter] = useState(lang);
  const [busy, setBusy] = useState(null); // template id being installed
  const [done, setDone] = useState(null);
  const fileRef = useRef(null);
  const [notion, setNotion] = useState(false); // false | true | "<prefilled link>"
  const [tab, setTab] = useState("frnt"); // "frnt" | "notion"

  const load = async (refresh) => {
    setLoading(true);
    setError("");
    try {
      const d = await api.library(refresh);
      setData(d);
      api.librarySeen(d.templates).catch(() => {});
      if (d.offline) setError(t("Showing the saved copy: {msg}", { msg: d.error }));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load(false);
  }, []);

  const templates = data?.templates || [];
  const picks = data?.notionPicks || [];
  const L = (o) => (o && typeof o === "object" ? o[lang] || o.en || "" : o || "");
  const shownPicks = picks.filter(
    (x) => (cat === "all" || x.category === cat) && (!q.trim() || `${L(x.title)} ${L(x.description)} ${x.creator}`.toLowerCase().includes(q.trim().toLowerCase()))
  );
  const langs = useMemo(() => [...new Set(templates.map((x) => x.lang))].sort(), [templates]);
  const cats = useMemo(() => [...new Set((tab === "notion" ? picks : templates).map((x) => x.category))].sort((a, b) => (CATEGORIES.indexOf(a) + 99) % 99 - (CATEGORIES.indexOf(b) + 99) % 99), [templates, picks, tab]);
  const shown = templates.filter(
    (x) =>
      (langFilter === "all" || x.lang === langFilter) &&
      (cat === "all" || x.category === cat) &&
      (!q.trim() || `${x.title} ${x.description}`.toLowerCase().includes(q.trim().toLowerCase()))
  );
  const newCount = templates.filter((x) => x.isNew).length;

  const install = async (tpl, asTemplate) => {
    setBusy(tpl.id + (asTemplate ? ":t" : ""));
    setError("");
    try {
      const r = await api.libraryInstall(tpl.id, asTemplate);
      store.setPages(await api.list());
      setDone({ title: tpl.title, rootId: r.rootId, asTemplate });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const installFile = async (file) => {
    setError("");
    try {
      const pkg = JSON.parse(await file.text());
      const r = await api.installTemplateFile(pkg);
      store.setPages(await api.list());
      setDone({ title: pkg.title || file.name, rootId: r.rootId });
    } catch (e) {
      setError(e instanceof SyntaxError ? t("This file is not a valid template (.json).") : e.message);
    }
  };

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="modal library" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>📚 {t("Template library")}</h2>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>
        <div className="lib-tabs">
          <button className={`lib-tab ${tab === "frnt" ? "on" : ""}`} onClick={() => (setTab("frnt"), setCat("all"))}>
            📚 {t("Freenote library")} <span className="muted small">{templates.length || ""}</span>
          </button>
          <button className={`lib-tab ${tab === "notion" ? "on" : ""}`} onClick={() => (setTab("notion"), setCat("all"))}>
            ⭐ {t("Top Notion templates")} <span className="muted small">{picks.length || ""}</span>
          </button>
        </div>
        <div className="lib-bar">
          <input className="input" placeholder={t("Search templates…")} value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
          <select className="lang-select" style={{ display: tab === "notion" ? "none" : undefined }} value={langFilter} onChange={(e) => setLangFilter(e.target.value)}>
            <option value="all">{t("All languages")}</option>
            {langs.map((l) => (
              <option key={l} value={l}>{l === "vi" ? "Tiếng Việt" : l === "en" ? "English" : l}</option>
            ))}
          </select>
          <button className="btn ghost bordered" disabled={loading} onClick={() => load(true)}>
            {loading ? t("Checking…") : `↻ ${t("Check for updates")}`}
          </button>
        </div>
        <div className="lib-cats">
          {["all", ...cats].map((c) => (
            <button key={c} className={`chip ${cat === c ? "on" : ""}`} onClick={() => setCat(c)}>
              {c === "all" ? t("All") : catLabel(c)}
            </button>
          ))}
          <span className="muted small lib-meta">
            {data && (
              <>
                {t("{n} templates", { n: tab === "notion" ? picks.length : templates.length })}
                {tab === "frnt" && newCount > 0 && ` · ${t("{n} new", { n: newCount })}`} · {t("updated {time}", { time: timeAgo(data.fetched_at) })}
              </>
            )}
          </span>
        </div>

        {done && (
          <div className="set-msg ok lib-done">
            ✓ {done.asTemplate ? t("“{title}” was added to your Templates.", { title: done.title }) : t("“{title}” was added to your workspace.", { title: done.title })}
            <button className="btn small" onClick={() => (navigate(done.rootId), onClose())}>{t("Open")}</button>
          </div>
        )}
        {error && <div className="set-msg error-msg">⚠ {error}</div>}

        {tab === "notion" && (
          <div className="muted small lib-notion-note">
            {t("Popular templates from Notion's public gallery. Import one in 3 steps: open it in Notion → Duplicate → Export (Markdown & CSV), then drop the .zip into Freenote. Templates by Notion are free; others may be paid.")}{" "}
            <a href={data?.notionGallery || NOTION_GALLERY} onClick={(e) => (e.preventDefault(), openExternal(data?.notionGallery || "https://www.notion.com/templates"))}>
              {t("Browse the full gallery")} ↗
            </a>
          </div>
        )}
        <div className="lib-grid" style={{ display: tab === "notion" ? "none" : undefined }}>
          {!data && loading && <div className="muted pad">{t("Loading…")}</div>}
          {data && !shown.length && <div className="muted pad">{t("No templates match.")}</div>}
          {shown.map((x) => (
            <div key={x.id} className="lib-card">
              <div className="lib-card-head">
                <span className="lib-icon">{x.icon}</span>
                <div style={{ minWidth: 0 }}>
                  <div className="lib-title">
                    {x.title} {x.isNew && <span className="badge-new">{t("New")}</span>}
                  </div>
                  <div className="muted small">
                    {catLabel(x.category)} · {x.lang.toUpperCase()}
                    {x.databases > 0 && ` · 🗃 ${t("{n} databases", { n: x.databases })}`}
                  </div>
                </div>
              </div>
              <div className="lib-desc">{x.description}</div>
              <div className="lib-actions">
                <button className="btn small" disabled={!!busy} onClick={() => install(x, false)}>
                  {busy === x.id ? t("Adding…") : t("Use template")}
                </button>
                <button className="btn ghost small" disabled={!!busy} title={t("Add to the Templates section of your sidebar")} onClick={() => install(x, true)}>
                  {busy === x.id + ":t" ? t("Adding…") : `+ ${t("My templates")}`}
                </button>
              </div>
            </div>
          ))}
        </div>

        {tab === "notion" && (
          <div className="lib-grid">
            {!data && loading && <div className="muted pad">{t("Loading…")}</div>}
            {data && !shownPicks.length && <div className="muted pad">{t("No templates match.")}</div>}
            {shownPicks.map((x) => (
              <div key={x.id} className="lib-card">
                <div className="lib-card-head">
                  <span className="lib-icon">{x.icon}</span>
                  <div style={{ minWidth: 0 }}>
                    <div className="lib-title">
                      {L(x.title)} {x.official && <span className="badge-notion">{t("by Notion")}</span>}
                    </div>
                    <div className="muted small">
                      {catLabel(x.category)} · {x.official ? "Notion" : x.creator}
                    </div>
                  </div>
                </div>
                <div className="lib-desc">{L(x.description)}</div>
                <div className="lib-actions">
                  <button className="btn small" onClick={() => setNotion(x.url)}>{t("Import…")}</button>
                  <button className="btn ghost small" title={x.url} onClick={() => openExternal(x.url)}>{t("Open in Notion")} ↗</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="lib-foot muted small">
          <span className="lib-source" title={data?.source}>
            {t("Source")}: <code>{data?.source || "…"}</code>
          </span>
          <span className="row" style={{ marginTop: 0 }}>
            <button className="btn ghost small" title={NOTION_GALLERY} onClick={() => openExternal(NOTION_GALLERY)}>{t("Notion template gallery")} ↗</button>
            <button className="btn ghost small bordered" onClick={() => setNotion(true)}>🔗 {t("From a Notion link")}</button>
            <button className="btn ghost small" onClick={() => fileRef.current.click()}>⬆ {t("Install from file (.json)")}</button>
          </span>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => e.target.files[0] && installFile(e.target.files[0])} />
        </div>
        {notion && <NotionLinkImport initialLink={typeof notion === "string" ? notion : ""} onClose={() => setNotion(false)} />}
      </div>
    </div>
  );
}
