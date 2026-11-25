import { useEffect, useState } from "react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { api } from "./api.js";
import { schema } from "./Editor.jsx";
import { timeAgo } from "./store.js";
import { t, dateLocale } from "./i18n.js";

function Preview({ content, theme }) {
  const editor = useCreateBlockNote({ schema, initialContent: content?.length ? content : undefined });
  return <BlockNoteView editor={editor} theme={theme} editable={false} />;
}

export default function History({ pageId, theme, onClose, onRestored }) {
  const [list, setList] = useState(null);
  const [sel, setSel] = useState(null);
  const [version, setVersion] = useState(null);

  useEffect(() => {
    api.versions(pageId).then((l) => {
      setList(l);
      if (l[0]) setSel(l[0].id);
    });
  }, [pageId]);

  useEffect(() => {
    if (sel) api.version(sel).then(setVersion);
  }, [sel]);

  const restore = async () => {
    await api.restoreVersion(sel);
    onRestored();
    onClose();
  };

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="modal history" onMouseDown={(e) => e.stopPropagation()}>
        <div className="history-preview">
          {version ? (
            <>
              <h1 className="history-title">{version.title || t("Untitled")}</h1>
              <Preview key={version.id} content={version.content} theme={theme} />
            </>
          ) : (
            <div className="muted pad">
              {list?.length === 0
                ? t("No older versions yet. A version is saved automatically at most every 10 minutes while you edit.")
                : t("Loading…")}
            </div>
          )}
        </div>
        <div className="history-side">
          <div className="modal-head">
            <h3>{t("Version history")}</h3>
            <button className="icon-btn" onClick={onClose}>✕</button>
          </div>
          <div className="history-list">
            {list?.map((v) => (
              <button key={v.id} className={`history-item ${v.id === sel ? "sel" : ""}`} onClick={() => setSel(v.id)}>
                <div>{new Date(v.created_at).toLocaleString(dateLocale)}</div>
                <div className="muted small">
                  {timeAgo(v.created_at)} · {v.title || t("Untitled")}
                </div>
              </button>
            ))}
          </div>
          <button className="btn" disabled={!sel} onClick={restore}>
            {t("Restore this version")}
          </button>
          <div className="muted small" style={{ marginTop: 6 }}>
            {t("The current state is saved too, so you can always go back.")}
          </div>
        </div>
      </div>
    </div>
  );
}
