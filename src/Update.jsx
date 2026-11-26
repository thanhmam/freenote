import { useEffect, useState } from "react";
import { api } from "./api.js";
import { t } from "./i18n.js";

const desktop = typeof window !== "undefined" ? window.frntDesktop : undefined;
const mb = (n) => (n / 1048576).toFixed(1);

/** Small sidebar notice shown when a newer release exists (checked at most daily, can be turned off). */
export function UpdateBanner({ onOpen }) {
  const [info, setInfo] = useState(null);
  useEffect(() => {
    api.updateCheck({ auto: true }).then((r) => r.available && setInfo(r)).catch(() => {});
    return desktop?.onShowUpdate?.(() => onOpen());
  }, []);
  if (!info) return null;
  return (
    <button className="update-banner" onClick={onOpen}>
      <span>✨ {t("Frnt {v} is available", { v: info.latest })}</span>
      <span className="update-cta">{t("Update")}</span>
    </button>
  );
}

/** Update dialog: release notes + one-click update (desktop) or download link (browser). */
export default function UpdateDialog({ onClose }) {
  const [info, setInfo] = useState(null);
  const [error, setError] = useState("");
  const [state, setState] = useState(null); // {phase, received, total} | {done}
  useEffect(() => {
    api.updateCheck({ force: true }).then(setInfo).catch((e) => setError(e.message));
    return desktop?.onUpdateProgress?.((p) => setState(p));
  }, []);

  const update = async () => {
    setError("");
    setState({ phase: "download", received: 0, total: 0 });
    const r = await desktop.installUpdate();
    if (r.action === "error") {
      setState(null);
      setError(r.error);
    } else if (r.action === "manual") {
      setState(null);
      setError(t("The new version was downloaded to {file}. Quit Frnt and replace the app with it.", { file: r.file }));
    } else setState({ done: r.action });
  };

  const pct = state?.total ? Math.round((state.received / state.total) * 100) : 0;
  return (
    <div className="overlay" onMouseDown={() => !state && onClose()}>
      <div className="modal settings" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>✨ {t("Updates")}</h2>
          <button className="icon-btn" disabled={!!state && !state.done} onClick={onClose}>✕</button>
        </div>
        {!info && !error && <div className="muted pad">{t("Checking…")}</div>}
        {info && !info.available && (
          <div className="set-msg ok">✓ {t("You're using the latest version ({v}).", { v: info.current })}</div>
        )}
        {info?.available && (
          <>
            <div className="update-head">
              <b>Frnt {info.latest}</b>
              <span className="muted small">
                {t("You have {v}", { v: info.current })} · {new Date(info.published_at).toLocaleDateString()}
              </span>
            </div>
            <pre className="release-notes">{info.notes || t("No release notes.")}</pre>
            {state?.done ? (
              <div className="set-msg ok">
                ✓ {state.done === "restarting" ? t("Installing… Frnt will restart in a moment.") : t("The installer has been opened. Follow its steps to finish.")}
              </div>
            ) : state ? (
              <div className="set-msg">
                {state.phase === "install" ? t("Installing…") : t("Downloading… {a} / {b} MB", { a: mb(state.received), b: mb(state.total || 0) })}
                <div className="progress">
                  <div style={{ width: `${state.phase === "install" ? 100 : pct}%` }} />
                </div>
              </div>
            ) : desktop ? (
              <div className="row" style={{ justifyContent: "flex-end" }}>
                <a className="btn ghost" href={info.url} target="_blank" rel="noreferrer">{t("Release page")}</a>
                <button className="btn" onClick={update}>{t("Update now")}</button>
              </div>
            ) : (
              <div className="row" style={{ justifyContent: "flex-end" }}>
                <a className="btn" href={info.url} target="_blank" rel="noreferrer">{t("Download from GitHub")} ↗</a>
              </div>
            )}
            {!desktop && <div className="muted small" style={{ marginTop: 8 }}>{t("Running from source? Update with: git pull && npm install")}</div>}
          </>
        )}
        {error && <div className="set-msg error-msg">⚠ {error}</div>}
      </div>
    </div>
  );
}
