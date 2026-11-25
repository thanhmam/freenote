import { useEffect, useState } from "react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { api } from "./api.js";
import { schema } from "./Editor.jsx";
import { timeAgo } from "./store.js";

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
              <h1 className="history-title">{version.title || "Untitled"}</h1>
              <Preview key={version.id} content={version.content} theme={theme} />
            </>
          ) : (
            <div className="muted pad">
              {list?.length === 0
                ? "Chưa có phiên bản cũ. Phiên bản được lưu tự động tối đa 10 phút một lần khi bạn chỉnh sửa."
                : "Đang tải…"}
            </div>
          )}
        </div>
        <div className="history-side">
          <div className="modal-head">
            <h3>Lịch sử phiên bản</h3>
            <button className="icon-btn" onClick={onClose}>✕</button>
          </div>
          <div className="history-list">
            {list?.map((v) => (
              <button key={v.id} className={`history-item ${v.id === sel ? "sel" : ""}`} onClick={() => setSel(v.id)}>
                <div>{new Date(v.created_at).toLocaleString("vi-VN")}</div>
                <div className="muted small">
                  {timeAgo(v.created_at)} · {v.title || "Untitled"}
                </div>
              </button>
            ))}
          </div>
          <button className="btn" disabled={!sel} onClick={restore}>
            Khôi phục phiên bản này
          </button>
          <div className="muted small" style={{ marginTop: 6 }}>
            Trạng thái hiện tại cũng được lưu lại, nên bạn có thể quay lại nếu cần.
          </div>
        </div>
      </div>
    </div>
  );
}
