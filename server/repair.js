// Finds imported pages that are really databases (Notion exported the rows but not the table) so the app
// can offer to turn them into databases. Read-only: the conversion itself is done by the app via the API.
import { contentHeader, rowHasHeader, MIN_ROWS, MIN_SHARE } from "./headerCore.js";

export function mountRepair(app, { db, getSetting, setSetting }) {
  const dismissed = () => new Set(JSON.parse(getSetting("repair_dismissed") || "[]"));

  function suggestions() {
    const skip = dismissed();
    // parents: plain pages without own content and with at least 2 live sub-pages
    const parents = db
      .prepare(
        `SELECT p.id, p.title, p.parent_id, COUNT(c.id) AS kids
         FROM pages p JOIN pages c ON c.parent_id = p.id AND c.deleted_at IS NULL
         WHERE p.deleted_at IS NULL AND p.kind = 'page' AND p.is_template = 0
           AND (p.content IS NULL OR p.content = '[]' OR trim(p.text) = '')
         GROUP BY p.id HAVING kids >= ?`
      )
      .all(MIN_ROWS);
    const kidsOf = db.prepare(`SELECT title, content FROM pages WHERE parent_id = ? AND deleted_at IS NULL`);
    const titleOf = db.prepare(`SELECT title, parent_id FROM pages WHERE id = ?`);
    const out = [];
    for (const p of parents) {
      if (skip.has(p.id)) continue;
      const kids = kidsOf.all(p.id);
      const keys = [];
      let withProps = 0;
      for (const k of kids) {
        let content = null;
        try {
          content = k.content ? JSON.parse(k.content) : null;
        } catch {}
        const { props } = contentHeader(content);
        if (!rowHasHeader(props)) continue;
        withProps++;
        for (const [key] of props) if (!keys.includes(key)) keys.push(key);
      }
      if (withProps / kids.length < MIN_SHARE) continue;
      // breadcrumb path for the list
      const path = [];
      let cur = p.parent_id ? titleOf.get(p.parent_id) : null;
      for (let i = 0; cur && i < 20; i++) {
        path.unshift(cur.title || "Untitled");
        cur = cur.parent_id ? titleOf.get(cur.parent_id) : null;
      }
      out.push({ id: p.id, title: p.title, path, rows: kids.length, withProps, properties: keys.slice(0, 12) });
    }
    return out;
  }

  app.get("/api/repair/suggestions", (_req, res) => res.json(suggestions()));
  app.post("/api/repair/dismiss", (req, res) => {
    const set = dismissed();
    if (typeof req.body?.id === "string") set.add(req.body.id);
    setSetting("repair_dismissed", JSON.stringify([...set]));
    res.json({ ok: true });
  });
}
