import { useEffect, useRef, useState } from "react";
import { api } from "./api.js";
import { store, navigate, timeAgo } from "./store.js";
import { importFiles } from "./importer.js";
import NotionLinkImport from "./NotionLinkImport.jsx";
import UpdateDialog from "./Update.jsx";
import { t, lang, setLang, LOCALES } from "./i18n.js";

export const REPO_URL = "https://github.com/thanhmam/frnt-notes";

export default function Settings({ onClose, theme, toggleTheme }) {
  const [s, setS] = useState(null);
  const [dir, setDir] = useState("");
  const [libSrc, setLibSrc] = useState("");
  const [notion, setNotion] = useState(false);
  const [ver, setVer] = useState(null);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null); // { phase, done, total }
  const [result, setResult] = useState(null); // import summary
  const jsonRef = useRef(null);
  const mdRef = useRef(null);
  const zipRef = useRef(null);

  const load = () =>
    api.settings().then((r) => {
      setS(r);
      setDir(r.backup_dir);
      setLibSrc(r.library_source);
    });
  useEffect(() => {
    load();
    api.version().then(setVer).catch(() => {});
  }, []);

  const run = async (label, fn) => {
    setBusy(true);
    setMsg(label + "…");
    try {
      await fn();
    } catch (e) {
      setMsg("⚠ " + e.message);
    } finally {
      setBusy(false);
    }
  };

  const doImport = (files) =>
    run(t("Importing"), async () => {
      setResult(null);
      try {
        const r = await importFiles(files, (p) => setProgress(p));
        store.setPages(await api.list());
        setMsg("");
        setResult(r);
        navigate(r.rootId);
      } finally {
        setProgress(null);
      }
    });

  const restoreJson = (file) =>
    run(t("Restoring"), async () => {
      const data = JSON.parse(await file.text());
      if (!confirm(t("Restore {n} pages from this backup? Pages with the same ID will be overwritten.", { n: data.pages?.length || 0 }))) return setMsg("");
      const r = await api.importAll(data);
      store.setPages(await api.list());
      setMsg("✓ " + t("Restored {n} pages", { n: r.count }));
    });

  return (
    <div className="overlay" onMouseDown={() => !busy && onClose()}>
      <div className="modal settings" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{t("Settings")}</h2>
          <button className="icon-btn" disabled={busy} onClick={onClose}>✕</button>
        </div>

        <section>
          <h3>{t("Appearance")}</h3>
          <div className="set-row">
            <span>{t("Language")}</span>
            <select className="lang-select" value={lang} onChange={(e) => setLang(e.target.value)}>
              {Object.entries(LOCALES).map(([code, l]) => (
                <option key={code} value={code}>{l.name}</option>
              ))}
            </select>
          </div>
          <div className="set-row">
            <span>{t("Dark mode")}</span>
            <input type="checkbox" className="switch" checked={theme === "dark"} onChange={toggleTheme} />
          </div>
        </section>

        <section>
          <h3>{t("Version & updates")}</h3>
          <div className="set-row">
            <span>
              Frnt {ver?.version}
              <div className="muted small">{t("Checks GitHub for a new version once a day.")}</div>
            </span>
            <button className="btn ghost bordered" onClick={() => setUpdateOpen(true)}>{t("Check for updates")}</button>
          </div>
          <div className="set-row">
            <span>{t("Check for updates automatically")}</span>
            <input
              type="checkbox"
              className="switch"
              checked={ver?.auto ?? true}
              onChange={async (e) => {
                await api.updateSettings({ auto: e.target.checked });
                setVer({ ...ver, auto: e.target.checked });
              }}
            />
          </div>
          {updateOpen && <UpdateDialog onClose={() => setUpdateOpen(false)} />}
        </section>

        <section>
          <h3>{t("Automatic backups")}</h3>
          {s && (
            <>
              <div className="set-row">
                <span>
                  {t("Back up every day (keeps the last 30)")}
                  <div className="muted small">
                    {t("Last backup")}: {s.last_backup ? timeAgo(s.last_backup) : t("never")}
                  </div>
                </span>
                <input
                  type="checkbox"
                  className="switch"
                  checked={s.auto_backup}
                  onChange={async (e) => {
                    await api.saveSettings({ auto_backup: e.target.checked });
                    load();
                  }}
                />
              </div>
              <div className="set-col">
                <span>{t("Backup folder")}</span>
                <div className="muted small">
                  {t("You can point this to iCloud Drive, Google Drive or Dropbox to keep a copy in the cloud. Backups are static snapshots, so syncing them is safe.")}
                </div>
                <div className="row">
                  <input className="input" value={dir} onChange={(e) => setDir(e.target.value)} placeholder={t("/absolute/path")} />
                  <button
                    className="btn ghost"
                    disabled={dir === s.backup_dir}
                    onClick={() =>
                      run(t("Saving"), async () => {
                        const r = await fetch("/api/settings", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ backup_dir: dir }),
                        });
                        if (!r.ok) throw new Error((await r.json()).error);
                        await load();
                        setMsg("✓ " + t("Backup folder changed"));
                      })
                    }
                  >
                    {t("Save")}
                  </button>
                </div>
              </div>
              <div className="row">
                <button
                  className="btn"
                  disabled={busy}
                  onClick={() =>
                    run(t("Backing up"), async () => {
                      const r = await api.backupNow();
                      await load();
                      setMsg("✓ " + t("Backed up to") + ": " + r.file);
                    })
                  }
                >
                  {t("Back up now")}
                </button>
              </div>
              <div className="muted small" style={{ marginTop: 8 }}>
                {t("Data folder")}: <code>{s.data_dir}</code>
              </div>
            </>
          )}
        </section>

        <section>
          <h3>{t("Template library")}</h3>
          {s && (
            <div className="set-col">
              <span>{t("Library address")}</span>
              <div className="muted small">{t("Where the Template library is loaded from. Frnt only connects to it when you open the library.")}</div>
              <div className="row">
                <input className="input" value={libSrc} onChange={(e) => setLibSrc(e.target.value)} placeholder={s.library_default} />
                <button
                  className="btn ghost"
                  disabled={libSrc === s.library_source}
                  onClick={() =>
                    run(t("Saving"), async () => {
                      await api.saveSettings({ library_source: libSrc });
                      await load();
                      setMsg("✓ " + t("Library address saved"));
                    })
                  }
                >
                  {t("Save")}
                </button>
                {s.library_source !== s.library_default && (
                  <button className="btn ghost" onClick={() => run(t("Saving"), async () => (await api.saveSettings({ library_source: "" }), await load(), setMsg("✓ " + t("Library address saved"))))}>
                    {t("Reset")}
                  </button>
                )}
              </div>
            </div>
          )}
        </section>

        <section>
          <h3>{t("Import")}</h3>
          <div className="row wrap">
            <button className="btn ghost bordered" disabled={busy} onClick={() => zipRef.current.click()}>
              📦 {t("From Notion (.zip)")}
            </button>
            <button className="btn ghost bordered" disabled={busy} onClick={() => mdRef.current.click()}>
              📝 {t("Markdown files (.md)")}
            </button>
            <button className="btn ghost bordered" disabled={busy} onClick={() => setNotion(true)}>
              🔗 {t("From a Notion link")}
            </button>
          </div>
          <div className="muted small" style={{ marginTop: 6 }}>
            {t("In Notion: Settings → Export all workspace content → format “Markdown & CSV”, include subpages. Sub-pages, images and databases (CSV) are all imported.")}
          </div>
        </section>

        <section>
          <h3>{t("Export & restore everything")}</h3>
          <div className="row wrap">
            <button className="btn ghost bordered" onClick={() => (window.location.href = "/api/export")}>
              ⬇ {t("Download backup (.json)")}
            </button>
            <button className="btn ghost bordered" disabled={busy} onClick={() => jsonRef.current.click()}>
              ⬆ {t("Restore from .json")}
            </button>
          </div>
        </section>

        {progress && (
          <div className="set-msg">
            <div>
              {progress.phase}
              {progress.total > 1 && ` — ${progress.done}/${progress.total}`}
            </div>
            <div className="progress">
              <div style={{ width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%` }} />
            </div>
            <div className="muted small">{t("Please keep the app open until the import finishes.")}</div>
          </div>
        )}
        {result && (
          <div className={`set-msg ${result.warnings.length ? "warn" : "ok"}`}>
            <b>✓ {t("Import finished")}</b>
            <div>
              {t("{pages} pages, {databases} databases ({rows} rows), {files} images & files", result.stats)}
            </div>
            {result.warnings.length > 0 && (
              <>
                <div style={{ marginTop: 6 }}>
                  ⚠ {t("{n} problems while importing. Everything else was imported.", { n: result.warnings.length })}{" "}
                  {t("See the “⚠️ Import report” page for the full list.")}
                </div>
                <ul className="warn-list">
                  {result.warnings.slice(0, 8).map((w, i) => (
                    <li key={i}>
                      <b>{w.step}</b> — {w.file}: {w.message}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
        {msg && !progress && <div className="set-msg error-msg">{msg}</div>}

        <div className="muted small about">
          Frnt (Free Notes) — {t("open source (MIT)")} ·{" "}
          <a href={REPO_URL} target="_blank" rel="noreferrer">
            GitHub
          </a>
        </div>

        {notion && <NotionLinkImport onClose={() => setNotion(false)} />}
        <input ref={zipRef} type="file" accept=".zip" multiple hidden onChange={(e) => e.target.files.length && doImport(e.target.files)} />
        <input ref={mdRef} type="file" accept=".md,.markdown,.txt" multiple hidden onChange={(e) => e.target.files.length && doImport(e.target.files)} />
        <input ref={jsonRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files[0] && restoreJson(e.target.files[0])} />
      </div>
    </div>
  );
}
