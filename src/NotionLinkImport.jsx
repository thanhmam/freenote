import { useRef, useState } from "react";
import { api } from "./api.js";
import { store, navigate } from "./store.js";
import { importFiles } from "./importer.js";
import RepairDialog from "./Repair.jsx";
import { repairStore } from "./db/repair.js";
import { t } from "./i18n.js";

/** Accepts links to Notion pages and templates (notion.so, *.notion.site, notion.com/templates). */
export function parseNotionLink(text) {
  let u;
  try {
    u = new URL(String(text).trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || !/(^|\.)(notion\.so|notion\.site|notion\.com)$/i.test(u.hostname)) return null;
  return u.href;
}

export const NOTION_GALLERY = "https://www.notion.com/templates";
export const openExternal = (url) => (window.freenoteDesktop?.openNotion ? window.freenoteDesktop.openNotion(url) : window.open(url, "_blank", "noopener"));

/**
 * "Add from a Notion link": guides the user through Notion's own Duplicate → Export, then imports the .zip.
 * (Notion has no official API to read public pages, so Freenote doesn't scrape them.)
 */
export default function NotionLinkImport({ onClose, initialLink = "" }) {
  const [link, setLink] = useState(initialLink);
  const [opened, setOpened] = useState(false);
  const [asTemplate, setAsTemplate] = useState(true);
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [over, setOver] = useState(false);
  const [repairOpen, setRepairOpen] = useState(false);
  const fileRef = useRef(null);
  const url = parseNotionLink(link);

  const run = async (files) => {
    const zips = [...files].filter((f) => /\.zip$/i.test(f.name));
    if (!zips.length) return setError(t("Please choose the .zip file that Notion exported."));
    setError("");
    setResult(null);
    try {
      const r = await importFiles(zips, (p) => setProgress(p));
      // A single exported page: put it at the top level (or in Templates) instead of inside "Notion import …"
      const pages = await api.list();
      const kids = pages.filter((p) => p.parent_id === r.rootId && !/Import report|Báo cáo nhập/.test(p.title));
      let openId = r.rootId;
      if (kids.length === 1 && !r.warnings.length) {
        await api.update(kids[0].id, { parent_id: null, is_template: asTemplate ? 1 : 0 });
        await api.moveToTrash(r.rootId);
        openId = kids[0].id;
      } else if (asTemplate) {
        await api.update(r.rootId, { is_template: 1, title: kids[0]?.title || "Notion template" });
      }
      store.setPages(await api.list());
      setResult({ ...r, openId, title: kids[0]?.title, repair: (await repairStore.refresh()).length });
    } catch (e) {
      setError(e.message);
    } finally {
      setProgress(null);
    }
  };

  return (
    <div className="overlay" onMouseDown={() => !progress && onClose()}>
      <div className="modal settings notion-link" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>🔗 {t("Add a template from a Notion link")}</h2>
          <button className="icon-btn" disabled={!!progress} onClick={onClose}>✕</button>
        </div>

        <div className="nl-step">
          <span className="nl-num">1</span>
          <div className="nl-body">
            <b>{t("Paste the Notion link")}</b>
            <div className="muted small">
              {t("Looking for ideas?")}{" "}
              <a href={NOTION_GALLERY} onClick={(e) => (e.preventDefault(), openExternal(NOTION_GALLERY))}>
                {t("Browse Notion's free template gallery")} ↗
              </a>
            </div>
            <div className="row">
              <input
                className="input"
                autoFocus
                placeholder="https://www.notion.so/templates/…  ·  https://….notion.site/…"
                value={link}
                onChange={(e) => (setLink(e.target.value), setOpened(false))}
              />
              <button className="btn" disabled={!url} onClick={() => (openExternal(url), setOpened(true))}>
                {t("Open in Notion")} ↗
              </button>
            </div>
            {link && !url && <div className="nl-err small">{t("This doesn't look like a Notion link (notion.so, notion.site or notion.com).")}</div>}
          </div>
        </div>

        <div className={`nl-step ${opened ? "" : "dim"}`}>
          <span className="nl-num">2</span>
          <div className="nl-body">
            <b>{t("In Notion, copy it to your workspace")}</b>
            <div className="muted small">{t("Click “Duplicate” (or “Get template”) at the top right of the page. Sign in to Notion if asked.")}</div>
          </div>
        </div>

        <div className={`nl-step ${opened ? "" : "dim"}`}>
          <span className="nl-num">3</span>
          <div className="nl-body">
            <b>{t("Export it as Markdown & CSV")}</b>
            <div className="muted small">
              {t("On your copy: ⋯ (top right) → Export → Export format: “Markdown & CSV”, turn on “Include subpages” and “Create folders for subpages” → Export. Notion downloads a .zip file.")}
            </div>
          </div>
        </div>

        <div className="nl-step">
          <span className="nl-num">4</span>
          <div className="nl-body">
            <b>{t("Drop the .zip here")}</b>
            <div
              className={`dropzone ${over ? "over" : ""}`}
              onDragOver={(e) => (e.preventDefault(), setOver(true))}
              onDragLeave={() => setOver(false)}
              onDrop={(e) => (e.preventDefault(), setOver(false), run(e.dataTransfer.files))}
              onClick={() => !progress && fileRef.current.click()}
            >
              {progress ? (
                <div style={{ width: "100%" }}>
                  <div>
                    {progress.phase}
                    {progress.total > 1 && ` — ${progress.done}/${progress.total}`}
                  </div>
                  <div className="progress">
                    <div style={{ width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%` }} />
                  </div>
                </div>
              ) : (
                <span>📦 {t("Drag the exported .zip here, or click to choose it")}</span>
              )}
            </div>
            <label className="nl-check">
              <input type="checkbox" checked={asTemplate} onChange={(e) => setAsTemplate(e.target.checked)} />
              {t("Save it under “Templates” in the sidebar (reuse it with “Use this template”)")}
            </label>
            <input ref={fileRef} type="file" accept=".zip" multiple hidden onChange={(e) => e.target.files.length && run(e.target.files)} />
          </div>
        </div>

        {error && <div className="set-msg error-msg">⚠ {error}</div>}
        {result && (
          <div className={`set-msg ${result.warnings.length ? "warn" : "ok"} lib-done`}>
            <span>
              ✓ {t("Imported")}
              {result.title ? ` “${result.title}”` : ""} · {t("{pages} pages, {databases} databases ({rows} rows), {files} images & files", result.stats)}
            </span>
            <button className="btn small" onClick={() => (navigate(result.openId), onClose())}>{t("Open")}</button>
          </div>
        )}
        {result?.repair > 0 && (
          <div className="set-msg warn">
            🛠 {t("{n} pages look like Notion databases that were exported without their table.", { n: result.repair })}{" "}
            <button className="btn small" onClick={() => setRepairOpen(true)}>{t("Review")}</button>
          </div>
        )}
        {repairOpen && <RepairDialog onClose={() => setRepairOpen(false)} />}
        <div className="muted small" style={{ marginTop: 12 }}>
          {t("Freenote uses Notion's own Duplicate and Export features. It doesn't read Notion pages automatically, because Notion offers no official way to do that.")}
        </div>
      </div>
    </div>
  );
}
