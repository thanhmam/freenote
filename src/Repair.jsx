import { useEffect, useState } from "react";
import { navigate, pageTitle, usePages } from "./store.js";
import { useRepair, repairStore, analyze, convertToDatabase } from "./db/repair.js";
import { t } from "./i18n.js";

const cols = (props) => props.slice(0, 4).join(", ") + (props.length > 4 ? "…" : "");

/** Asks for confirmation, then converts. Returns true when converted. */
export async function confirmAndConvert(pageId, title) {
  const a = await analyze(pageId);
  if (!a.ok) {
    alert(t("The sub-pages of “{title}” don't start with property lines (like “Status: Done”), so they can't be turned into a database.", { title }));
    return false;
  }
  const names = a.schema.properties.map((p) => p.name);
  const ok = confirm(
    t("Turn “{title}” into a database with {n} rows and the columns {cols}?\n\nThe property lines move out of each page's text into columns (the old text stays in Version history). You can undo it with “Turn into a page”.", {
      title,
      n: a.rows.length,
      cols: cols(names),
    })
  );
  if (!ok) return false;
  await convertToDatabase(pageId, a);
  return true;
}

/** Sidebar notice shown when imported pages can be repaired. */
export function RepairNotice({ onOpen }) {
  const { list } = useRepair();
  if (!list.length) return null;
  return (
    <button className="update-banner repair-banner" onClick={onOpen}>
      <span>🛠 {t("{n} imported pages can be repaired", { n: list.length })}</span>
      <span className="update-cta">{t("Review")}</span>
    </button>
  );
}

/** Banner at the top of a page that looks like a database exported without its table. */
export function RepairBanner({ pageId }) {
  const { list } = useRepair();
  const { byId } = usePages();
  const [busy, setBusy] = useState(false);
  const s = list.find((x) => x.id === pageId);
  if (!s) return null;
  return (
    <div className="tpl-banner repair-page-banner">
      <span>
        🛠 {t("This looks like a Notion database ({n} sub-pages with {cols}). Show it as a table?", { n: s.rows, cols: cols(s.properties) })}
      </span>
      <span className="row" style={{ marginTop: 0 }}>
        <button className="btn small" disabled={busy} onClick={async () => (setBusy(true), await confirmAndConvert(pageId, pageTitle(byId[pageId])).finally(() => setBusy(false)))}>
          {busy ? t("Converting…") : t("Turn into a database")}
        </button>
        <button className="btn ghost small" onClick={() => repairStore.dismiss(pageId)}>{t("Not now")}</button>
      </span>
    </div>
  );
}

/** Lists every suggestion with Convert / Open / Dismiss and Convert all. */
export default function RepairDialog({ onClose }) {
  const { list } = useRepair();
  const [busy, setBusy] = useState(null);
  const [done, setDone] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => {
    repairStore.refresh();
  }, []);

  const convert = async (s, ask = true) => {
    setBusy(s.id);
    setError("");
    try {
      const ok = ask ? await confirmAndConvert(s.id, s.title) : (await convertToDatabase(s.id), true);
      if (ok) setDone((d) => [...d, s]);
    } catch (e) {
      setError(`${s.title}: ${e.message}`);
    } finally {
      setBusy(null);
    }
  };
  const convertAll = async () => {
    if (!confirm(t("Turn all {n} pages into databases? Each can be undone with “Turn into a page”.", { n: list.length }))) return;
    for (const s of [...list]) await convert(s, false);
  };

  return (
    <div className="overlay" onMouseDown={() => !busy && onClose()}>
      <div className="modal settings" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>🛠 {t("Repair imported pages")}</h2>
          <button className="icon-btn" disabled={!!busy} onClick={onClose}>✕</button>
        </div>
        <p className="muted small">
          {t("Notion sometimes exports a database without its table: only the row pages, each starting with lines like “Status: Done”. These pages look like that. Turning them into databases shows the rows as a table and board again.")}
        </p>
        {done.length > 0 && (
          <div className="set-msg ok">
            ✓ {t("Converted: {list}", { list: done.map((d) => d.title).join(", ") })}
          </div>
        )}
        {error && <div className="set-msg error-msg">⚠ {error}</div>}
        {!list.length && <div className="muted pad">✓ {t("Nothing to repair.")}</div>}
        <div className="repair-list">
          {list.map((s) => (
            <div key={s.id} className="repair-item">
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="lib-title">🗃️ {s.title}</div>
                <div className="muted small">{[...s.path, s.title].join(" / ")}</div>
                <div className="muted small">
                  {t("{n} rows", { n: s.rows })} · {cols(s.properties)}
                </div>
              </div>
              <div className="lib-actions">
                <button className="btn small" disabled={!!busy} onClick={() => convert(s)}>
                  {busy === s.id ? t("Converting…") : t("Turn into a database")}
                </button>
                <button className="btn ghost small" onClick={() => (navigate(s.id), onClose())}>{t("Open")}</button>
                <button className="btn ghost small" disabled={!!busy} onClick={() => repairStore.dismiss(s.id)}>{t("Dismiss")}</button>
              </div>
            </div>
          ))}
        </div>
        {list.length > 1 && (
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button className="btn" disabled={!!busy} onClick={convertAll}>{t("Convert all")}</button>
          </div>
        )}
      </div>
    </div>
  );
}
