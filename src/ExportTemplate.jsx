import { useState } from "react";
import { usePages, pageTitle } from "./store.js";
import { t, lang } from "./i18n.js";

import { CATEGORIES, catLabel } from "./Library.jsx";

/** Maintainers: export a page (with sub-pages, databases and images) as a library template package. */
export default function ExportTemplate({ id, onClose }) {
  const { byId } = usePages();
  const page = byId[id];
  const [title, setTitle] = useState(pageTitle(page));
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Work");
  const [tplLang, setTplLang] = useState(lang);
  const download = () => {
    const q = new URLSearchParams({ title, description, category, lang: tplLang });
    window.location.href = `/api/pages/${id}/export-template?${q}`;
    onClose();
  };
  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="modal settings" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>📦 {t("Export as library template")}</h2>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>
        <p className="muted small">
          {t("Creates a .json package with this page, its sub-pages, databases and images. Put it in the repository's library/templates folder, run “npm run library:build” and push: every Freenote app will see it in the Template library.")}
        </p>
        <div className="form-grid">
          <label>{t("Title")}</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
          <label>{t("Description")}</label>
          <textarea className="input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("One sentence about what this template is for")} />
          <label>{t("Category")}</label>
          <select className="lang-select" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{catLabel(c)}</option>
            ))}
          </select>
          <label>{t("Language")}</label>
          <select className="lang-select" value={tplLang} onChange={(e) => setTplLang(e.target.value)}>
            <option value="en">English</option>
            <option value="vi">Tiếng Việt</option>
          </select>
        </div>
        <div className="row" style={{ justifyContent: "flex-end", marginTop: 16 }}>
          <button className="btn ghost" onClick={onClose}>{t("Cancel")}</button>
          <button className="btn" disabled={!title.trim() || !description.trim()} onClick={download}>⬇ {t("Download template")}</button>
        </div>
      </div>
    </div>
  );
}
