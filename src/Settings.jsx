import { useEffect, useRef, useState } from "react";
import { api } from "./api.js";
import { store, navigate, timeAgo } from "./store.js";
import { importFiles } from "./importer.js";

export const REPO_URL = "https://github.com/thanhmam/frnt-notes";

export default function Settings({ onClose, theme, toggleTheme }) {
  const [s, setS] = useState(null);
  const [dir, setDir] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const jsonRef = useRef(null);
  const mdRef = useRef(null);
  const zipRef = useRef(null);

  const load = () =>
    api.settings().then((r) => {
      setS(r);
      setDir(r.backup_dir);
    });
  useEffect(() => {
    load();
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
    run("Đang nhập", async () => {
      const id = await importFiles(files, (m) => setMsg("Đang nhập: " + m));
      store.setPages(await api.list());
      setMsg("✓ Đã nhập xong");
      navigate(id);
      onClose();
    });

  const restoreJson = (file) =>
    run("Đang khôi phục", async () => {
      const data = JSON.parse(await file.text());
      if (!confirm(`Khôi phục ${data.pages?.length || 0} trang từ file sao lưu? Trang trùng ID sẽ bị ghi đè.`)) return setMsg("");
      const r = await api.importAll(data);
      store.setPages(await api.list());
      setMsg(`✓ Đã khôi phục ${r.count} trang`);
    });

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="modal settings" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Cài đặt</h2>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>

        <section>
          <h3>Giao diện</h3>
          <div className="set-row">
            <span>Chế độ tối</span>
            <input type="checkbox" className="switch" checked={theme === "dark"} onChange={toggleTheme} />
          </div>
        </section>

        <section>
          <h3>Sao lưu tự động</h3>
          {s && (
            <>
              <div className="set-row">
                <span>
                  Sao lưu mỗi ngày (giữ 30 bản gần nhất)
                  <div className="muted small">Lần gần nhất: {s.last_backup ? timeAgo(s.last_backup) : "chưa có"}</div>
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
                <span>Thư mục sao lưu</span>
                <div className="muted small">
                  Có thể trỏ tới iCloud Drive / Google Drive / Dropbox để có bản sao trên cloud. File sao lưu là ảnh chụp tĩnh nên đồng bộ an toàn.
                </div>
                <div className="row">
                  <input className="input" value={dir} onChange={(e) => setDir(e.target.value)} placeholder="/đường/dẫn/tuyệt/đối" />
                  <button
                    className="btn ghost"
                    disabled={dir === s.backup_dir}
                    onClick={() =>
                      run("Đang lưu", async () => {
                        const r = await fetch("/api/settings", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ backup_dir: dir }),
                        });
                        if (!r.ok) throw new Error((await r.json()).error);
                        await load();
                        setMsg("✓ Đã đổi thư mục sao lưu");
                      })
                    }
                  >
                    Lưu
                  </button>
                </div>
              </div>
              <div className="row">
                <button
                  className="btn"
                  disabled={busy}
                  onClick={() =>
                    run("Đang sao lưu", async () => {
                      const r = await api.backupNow();
                      await load();
                      setMsg("✓ Đã sao lưu: " + r.file);
                    })
                  }
                >
                  Sao lưu ngay
                </button>
              </div>
              <div className="muted small" style={{ marginTop: 8 }}>
                Dữ liệu chính: <code>{s.data_dir}</code>
              </div>
            </>
          )}
        </section>

        <section>
          <h3>Nhập dữ liệu</h3>
          <div className="row wrap">
            <button className="btn ghost bordered" disabled={busy} onClick={() => zipRef.current.click()}>
              📦 Từ Notion (.zip)
            </button>
            <button className="btn ghost bordered" disabled={busy} onClick={() => mdRef.current.click()}>
              📝 File Markdown (.md)
            </button>
          </div>
          <div className="muted small" style={{ marginTop: 6 }}>
            Notion: Settings → Export all workspace content → định dạng <b>Markdown &amp; CSV</b>, có cả subpages. Trang con, ảnh và
            database (CSV) đều được nhập.
          </div>
        </section>

        <section>
          <h3>Xuất &amp; khôi phục toàn bộ</h3>
          <div className="row wrap">
            <button className="btn ghost bordered" onClick={() => (window.location.href = "/api/export")}>
              ⬇ Tải file sao lưu (.json)
            </button>
            <button className="btn ghost bordered" disabled={busy} onClick={() => jsonRef.current.click()}>
              ⬆ Khôi phục từ file .json
            </button>
          </div>
        </section>

        {msg && <div className="set-msg">{msg}</div>}

        <div className="muted small about">
          Frnt Notes — mã nguồn mở (MIT) ·{" "}
          <a href={REPO_URL} target="_blank" rel="noreferrer">
            GitHub
          </a>
        </div>

        <input ref={zipRef} type="file" accept=".zip" hidden onChange={(e) => e.target.files.length && doImport(e.target.files)} />
        <input ref={mdRef} type="file" accept=".md,.markdown,.txt" multiple hidden onChange={(e) => e.target.files.length && doImport(e.target.files)} />
        <input ref={jsonRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files[0] && restoreJson(e.target.files[0])} />
      </div>
    </div>
  );
}
