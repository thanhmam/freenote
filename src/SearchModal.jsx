import { useEffect, useState } from "react";
import { api } from "./api.js";
import { usePages, navigate, pageTitle, breadcrumbs, timeAgo } from "./store.js";
import { t } from "./i18n.js";

export default function SearchModal({ onClose }) {
  const { pages, byId } = usePages();
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [sel, setSel] = useState(0);

  useEffect(() => {
    if (!q.trim()) {
      setResults([...pages].sort((a, b) => b.updated_at - a.updated_at).slice(0, 10));
      setSel(0);
      return;
    }
    const t = setTimeout(() => api.search(q).then((r) => (setResults(r), setSel(0))), 120);
    return () => clearTimeout(t);
  }, [q, pages]);

  const go = (r) => {
    if (!r) return;
    navigate(r.id);
    onClose();
  };

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="search" onMouseDown={(e) => e.stopPropagation()}>
        <input
          className="search-input"
          autoFocus
          placeholder={t("Search all pages…")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") (e.preventDefault(), setSel((s) => Math.min(s + 1, results.length - 1)));
            if (e.key === "ArrowUp") (e.preventDefault(), setSel((s) => Math.max(s - 1, 0)));
            if (e.key === "Enter") go(results[sel]);
          }}
        />
        <div className="search-label">{q.trim() ? t("{n} results", { n: results.length }) : t("Recent")}</div>
        <div className="search-results">
          {results.map((r, i) => {
            const path = breadcrumbs(r.id, byId).slice(0, -1).map(pageTitle).join(" / ");
            return (
              <div
                key={r.id}
                className={`search-row ${i === sel ? "sel" : ""}`}
                onMouseEnter={() => setSel(i)}
                onClick={() => go(r)}
              >
                <span className="tree-icon">{r.icon || "📄"}</span>
                <div className="sr-body">
                  <div>
                    {pageTitle(r)} {path && <span className="muted small">— {path}</span>}
                  </div>
                  {r.snippet && <div className="muted small snippet">…{r.snippet}…</div>}
                </div>
                <span className="muted small">{timeAgo(r.updated_at)}</span>
              </div>
            );
          })}
          {q && results.length === 0 && <div className="muted pad">{t("No results")}</div>}
        </div>
      </div>
    </div>
  );
}
