// Frnt Notes server: Express + SQLite (node:sqlite, built into Node ≥ 22.13).
// Used by both the CLI (server/index.js) and the desktop app (electron/main.mjs).
import express from "express";
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { seedTemplates, seedWelcome } from "./seed.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

/** Default data folder per OS. Kept out of cloud-synced folders on purpose (SQLite + sync = corruption risk). */
export function defaultDataDir() {
  if (process.env.DATA_DIR) return process.env.DATA_DIR;
  const home = os.homedir();
  if (process.platform === "darwin") return path.join(home, "Library", "Application Support", "FrntNotes");
  if (process.platform === "win32") return path.join(process.env.APPDATA || path.join(home, "AppData", "Roaming"), "FrntNotes");
  return path.join(process.env.XDG_DATA_HOME || path.join(home, ".local", "share"), "frnt-notes");
}

const VERSION_INTERVAL = 10 * 60 * 1000; // snapshot a page at most every 10 minutes while editing
const MAX_VERSIONS = 100; // per page
const BACKUP_INTERVAL = 24 * 60 * 60 * 1000;
const BACKUPS_KEPT = 30;

export async function startServer({ port = 3001, host = "127.0.0.1", dataDir = defaultDataDir(), dev = false, distDir = path.join(ROOT, "dist") } = {}) {
  const UPLOAD_DIR = path.join(dataDir, "uploads");
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });

  const db = new DatabaseSync(path.join(dataDir, "notes.db"));
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS pages (
      id TEXT PRIMARY KEY,
      parent_id TEXT,
      title TEXT NOT NULL DEFAULT '',
      icon TEXT,
      cover TEXT,
      content TEXT,
      text TEXT NOT NULL DEFAULT '',
      position REAL NOT NULL DEFAULT 0,
      is_favorite INTEGER NOT NULL DEFAULT 0,
      full_width INTEGER NOT NULL DEFAULT 0,
      deleted_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_pages_parent ON pages(parent_id);
    CREATE TABLE IF NOT EXISTS page_versions (
      id TEXT PRIMARY KEY,
      page_id TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      content TEXT,
      text TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_versions_page ON page_versions(page_id, created_at);
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
  `);
  // ---- migrations ----
  const cols = db.prepare(`PRAGMA table_info(pages)`).all().map((c) => c.name);
  const addCol = (name, def) => !cols.includes(name) && db.exec(`ALTER TABLE pages ADD COLUMN ${name} ${def}`);
  addCol("kind", "TEXT NOT NULL DEFAULT 'page'");
  addCol("db_schema", "TEXT");
  addCol("props", "TEXT");
  addCol("is_template", "INTEGER NOT NULL DEFAULT 0");

  const META = `id, parent_id, kind, title, icon, cover, db_schema, props, position, is_favorite, is_template, full_width, deleted_at, created_at, updated_at`;
  const JSON_COLS = ["content", "db_schema", "props"];
  const parseRow = (p) => {
    if (p) for (const k of JSON_COLS) if (k in p) p[k] = p[k] ? JSON.parse(p[k]) : null;
    return p;
  };
  const now = () => Date.now();

  const getSetting = (k, d = null) => db.prepare(`SELECT value FROM settings WHERE key = ?`).get(k)?.value ?? d;
  const setSetting = (k, v) => db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`).run(k, v == null ? null : String(v));

  const descendants = (id) =>
    db.prepare(`WITH RECURSIVE t(id) AS (SELECT ? UNION ALL SELECT p.id FROM pages p JOIN t ON p.parent_id = t.id) SELECT id FROM t`)
      .all(id).map((r) => r.id);

  const getPage = (id) => parseRow(db.prepare(`SELECT ${META}, content FROM pages WHERE id = ?`).get(id));

  function createPage({ parent_id = null, title = "", icon = null, cover = null, content = null, text = "", kind = "page", db_schema = null, props = null, position = null, is_template = 0 }) {
    const id = randomUUID();
    const { m } = db.prepare(`SELECT COALESCE(MAX(position), 0) AS m FROM pages WHERE parent_id IS ?`).get(parent_id);
    db.prepare(
      `INSERT INTO pages (id, parent_id, kind, title, icon, cover, content, text, db_schema, props, position, is_template, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, parent_id, kind, title, icon, cover, content ? JSON.stringify(content) : null, text,
      db_schema ? JSON.stringify(db_schema) : null, props ? JSON.stringify(props) : null, position ?? m + 1, is_template ? 1 : 0, now(), now());
    return getPage(id);
  }

  // Deep copy a page (and for databases: their rows). Used by duplicate + templates.
  function copyPage(srcId, overrides = {}) {
    const src = getPage(srcId);
    const text = db.prepare(`SELECT text FROM pages WHERE id = ?`).get(srcId).text;
    const copy = createPage({ ...src, text, position: null, is_template: 0, ...overrides });
    const kids = db.prepare(`SELECT id FROM pages WHERE parent_id = ? AND deleted_at IS NULL ORDER BY position`).all(srcId);
    for (const { id } of kids) copyPage(id, { parent_id: copy.id, position: getPage(id).position });
    // re-point inline database / page-link blocks to the copied children
    if (kids.length && copy.content) {
      const map = {};
      const newKids = db.prepare(`SELECT id, position FROM pages WHERE parent_id = ? ORDER BY position`).all(copy.id);
      kids.forEach(({ id }, i) => newKids[i] && (map[id] = newKids[i].id));
      let s = JSON.stringify(copy.content);
      for (const [a, b] of Object.entries(map)) s = s.split(a).join(b);
      db.prepare(`UPDATE pages SET content = ? WHERE id = ?`).run(s, copy.id);
    }
    return getPage(copy.id);
  }

  if (db.prepare(`SELECT COUNT(*) AS c FROM pages`).get().c === 0) seedWelcome(createPage);
  if (!getSetting("templates_seeded")) {
    seedTemplates(createPage);
    setSetting("templates_seeded", 1);
  }

  // ---- version history ----
  function snapshot(pageId, force = false) {
    const last = db.prepare(`SELECT created_at FROM page_versions WHERE page_id = ? ORDER BY created_at DESC LIMIT 1`).get(pageId);
    if (!force && last && now() - last.created_at < VERSION_INTERVAL) return;
    const cur = db.prepare(`SELECT title, content, text FROM pages WHERE id = ?`).get(pageId);
    if (!cur || !cur.content) return;
    db.prepare(`INSERT INTO page_versions (id, page_id, title, content, text, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(randomUUID(), pageId, cur.title, cur.content, cur.text, now());
    db.prepare(
      `DELETE FROM page_versions WHERE page_id = ? AND id NOT IN
         (SELECT id FROM page_versions WHERE page_id = ? ORDER BY created_at DESC LIMIT ${MAX_VERSIONS})`
    ).run(pageId, pageId);
  }

  // ---- automatic backups ----
  const backupDir = () => getSetting("backup_dir") || path.join(dataDir, "backups");
  function runBackup() {
    const dir = backupDir();
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16);
    const file = path.join(dir, `notes-${stamp}.db`);
    if (fs.existsSync(file)) fs.rmSync(file);
    db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
    // uploads: copy new files only (incremental)
    const upDst = path.join(dir, "uploads");
    fs.mkdirSync(upDst, { recursive: true });
    for (const f of fs.readdirSync(UPLOAD_DIR)) {
      const d = path.join(upDst, f);
      if (!fs.existsSync(d)) fs.copyFileSync(path.join(UPLOAD_DIR, f), d);
    }
    const old = fs.readdirSync(dir).filter((f) => /^notes-.*\.db$/.test(f)).sort().reverse().slice(BACKUPS_KEPT);
    old.forEach((f) => fs.rmSync(path.join(dir, f)));
    setSetting("last_backup", now());
    return file;
  }
  function maybeBackup() {
    if (getSetting("auto_backup", "1") !== "1") return;
    if (now() - Number(getSetting("last_backup", 0)) < BACKUP_INTERVAL) return;
    try {
      console.log("Auto backup →", runBackup());
    } catch (e) {
      console.error("Auto backup failed:", e.message);
    }
  }
  maybeBackup();
  const backupTimer = setInterval(maybeBackup, 60 * 60 * 1000);
  backupTimer.unref?.();

  // ---- search normalisation: case- and accent-insensitive ("chao" matches "Chào") ----
  const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
  db.function("norm", { deterministic: true }, norm);

  // ======================= routes =======================
  const app = express();
  app.use(express.json({ limit: "50mb" }));

  app.get("/api/pages", (_req, res) => {
    res.json(db.prepare(`SELECT ${META} FROM pages WHERE deleted_at IS NULL ORDER BY position`).all().map(parseRow));
  });

  app.get("/api/trash", (_req, res) => {
    res.json(
      db.prepare(
        `SELECT ${META} FROM pages p WHERE deleted_at IS NOT NULL AND
           (parent_id IS NULL OR NOT EXISTS (SELECT 1 FROM pages q WHERE q.id = p.parent_id AND q.deleted_at IS NOT NULL))
         ORDER BY deleted_at DESC`
      ).all().map(parseRow)
    );
  });

  app.get("/api/pages/:id", (req, res) => {
    const p = getPage(req.params.id);
    p ? res.json(p) : res.status(404).json({ error: "not found" });
  });

  app.post("/api/pages", (req, res) => res.json(createPage(req.body || {})));

  const EDITABLE = ["title", "icon", "cover", "content", "text", "parent_id", "position", "is_favorite", "is_template", "full_width", "db_schema", "props"];
  app.patch("/api/pages/:id", (req, res) => {
    const sets = [];
    const vals = [];
    for (const k of EDITABLE) {
      if (!(k in req.body)) continue;
      let v = req.body[k];
      if (JSON_COLS.includes(k)) v = v == null ? null : JSON.stringify(v);
      if (typeof v === "boolean") v = v ? 1 : 0;
      if (k === "parent_id" && v && descendants(req.params.id).includes(v)) {
        return res.status(400).json({ error: "cannot move page into itself" });
      }
      sets.push(`${k} = ?`);
      vals.push(v);
    }
    if ("content" in req.body) snapshot(req.params.id); // keep the state *before* this edit
    if (sets.length) db.prepare(`UPDATE pages SET ${sets.join(", ")}, updated_at = ? WHERE id = ?`).run(...vals, now(), req.params.id);
    res.json({ ok: true, updated_at: now() });
  });

  app.post("/api/pages/:id/duplicate", (req, res) => {
    const src = getPage(req.params.id);
    if (!src) return res.status(404).end();
    const asTemplate = req.query.template === "1";
    const fromTemplate = !!src.is_template && !asTemplate;
    res.json(
      copyPage(src.id, {
        title: fromTemplate || asTemplate ? src.title : `${src.title} (copy)`,
        is_template: asTemplate ? 1 : 0,
        parent_id: asTemplate ? null : fromTemplate ? (req.body?.parent_id ?? null) : src.parent_id,
      })
    );
  });

  app.post("/api/pages/:id/trash", (req, res) => {
    const stmt = db.prepare(`UPDATE pages SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL`);
    const t = now();
    descendants(req.params.id).forEach((id) => stmt.run(t, id));
    res.json({ ok: true });
  });

  app.post("/api/pages/:id/restore", (req, res) => {
    const stmt = db.prepare(`UPDATE pages SET deleted_at = NULL WHERE id = ?`);
    descendants(req.params.id).forEach((id) => stmt.run(id));
    const p = db.prepare(`SELECT parent_id FROM pages WHERE id = ?`).get(req.params.id);
    if (p?.parent_id) {
      const parent = db.prepare(`SELECT deleted_at FROM pages WHERE id = ?`).get(p.parent_id);
      if (!parent || parent.deleted_at) db.prepare(`UPDATE pages SET parent_id = NULL WHERE id = ?`).run(req.params.id);
    }
    res.json({ ok: true });
  });

  app.delete("/api/pages/:id", (req, res) => {
    const del = db.prepare(`DELETE FROM pages WHERE id = ?`);
    const delV = db.prepare(`DELETE FROM page_versions WHERE page_id = ?`);
    descendants(req.params.id).forEach((id) => (del.run(id), delV.run(id)));
    res.json({ ok: true });
  });

  // ---- versions ----
  app.get("/api/pages/:id/versions", (req, res) => {
    res.json(
      db.prepare(`SELECT id, title, created_at, length(content) AS size FROM page_versions WHERE page_id = ? ORDER BY created_at DESC`)
        .all(req.params.id)
    );
  });
  app.get("/api/versions/:vid", (req, res) => {
    const v = db.prepare(`SELECT * FROM page_versions WHERE id = ?`).get(req.params.vid);
    if (!v) return res.status(404).end();
    res.json({ ...v, content: v.content ? JSON.parse(v.content) : null });
  });
  app.post("/api/versions/:vid/restore", (req, res) => {
    const v = db.prepare(`SELECT * FROM page_versions WHERE id = ?`).get(req.params.vid);
    if (!v) return res.status(404).end();
    snapshot(v.page_id, true); // current state stays recoverable
    db.prepare(`UPDATE pages SET title = ?, content = ?, text = ?, updated_at = ? WHERE id = ?`).run(v.title, v.content, v.text, now(), v.page_id);
    res.json({ ok: true });
  });

  // ---- backlinks: pages whose content references this page id ----
  app.get("/api/pages/:id/backlinks", (req, res) => {
    res.json(
      db.prepare(
        `SELECT id, title, icon, kind FROM pages WHERE deleted_at IS NULL AND is_template = 0 AND id != ? AND instr(content, ?) > 0 ORDER BY updated_at DESC`
      ).all(req.params.id, `"${req.params.id}"`)
    );
  });

  // ---- search ----
  app.get("/api/search", (req, res) => {
    const q = norm(String(req.query.q || "").trim());
    const rows = db.prepare(
      `SELECT id, parent_id, title, icon, updated_at, text, instr(norm(title), ?) > 0 AS in_title
       FROM pages WHERE deleted_at IS NULL AND is_template = 0 AND (instr(norm(title), ?) > 0 OR instr(norm(text), ?) > 0)
       ORDER BY in_title DESC, updated_at DESC LIMIT 30`
    ).all(q, q, q);
    res.json(
      rows.map(({ text, in_title, ...r }) => {
        const i = norm(text).indexOf(q);
        return { ...r, snippet: i >= 0 ? text.slice(Math.max(0, i - 40), i + 80) : "" };
      })
    );
  });

  // ---- uploads ----
  app.post("/api/upload", express.raw({ type: () => true, limit: "200mb" }), (req, res) => {
    const ext = path.extname(String(req.query.name || "")).toLowerCase().replace(/[^.a-z0-9]/g, "");
    const name = `${randomUUID()}${ext}`;
    fs.writeFileSync(path.join(UPLOAD_DIR, name), req.body);
    res.json({ url: `/uploads/${name}` });
  });
  app.use("/uploads", express.static(UPLOAD_DIR, { maxAge: "1y", immutable: true }));

  // ---- settings & backups ----
  app.get("/api/settings", (_req, res) => {
    res.json({
      data_dir: dataDir,
      backup_dir: backupDir(),
      auto_backup: getSetting("auto_backup", "1") === "1",
      last_backup: Number(getSetting("last_backup", 0)) || null,
    });
  });
  app.post("/api/settings", (req, res) => {
    if ("backup_dir" in req.body) {
      const d = String(req.body.backup_dir || "").trim();
      if (d && !path.isAbsolute(d)) return res.status(400).json({ error: "Đường dẫn phải là đường dẫn tuyệt đối" });
      setSetting("backup_dir", d || null);
    }
    if ("auto_backup" in req.body) setSetting("auto_backup", req.body.auto_backup ? "1" : "0");
    res.json({ ok: true });
  });
  app.post("/api/backup", (_req, res) => {
    try {
      res.json({ ok: true, file: runBackup() });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // ---- full JSON export / import ----
  app.get("/api/export", (_req, res) => {
    const pages = db.prepare(`SELECT * FROM pages`).all();
    res.setHeader("Content-Disposition", `attachment; filename="frnt-notes-backup-${new Date().toISOString().slice(0, 10)}.json"`);
    res.json({ version: 2, exported_at: now(), pages });
  });
  app.post("/api/import", (req, res) => {
    const pages = req.body?.pages || [];
    const cols = ["id", "parent_id", "kind", "title", "icon", "cover", "content", "text", "db_schema", "props", "position", "is_favorite", "is_template", "full_width", "deleted_at", "created_at", "updated_at"];
    const defaults = { title: "", text: "", kind: "page", position: 0, is_favorite: 0, is_template: 0, full_width: 0, created_at: now(), updated_at: now() };
    const stmt = db.prepare(`INSERT OR REPLACE INTO pages (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`);
    for (const p of pages) {
      stmt.run(...cols.map((c) => {
        const v = p[c] ?? defaults[c] ?? null;
        return v !== null && typeof v === "object" ? JSON.stringify(v) : v;
      }));
    }
    res.json({ ok: true, count: pages.length });
  });

  // ---- frontend ----
  if (!dev && fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get(/^(?!\/api|\/uploads).*/, (_req, res) => res.sendFile(path.join(distDir, "index.html")));
  } else {
    const { createServer } = await import("vite");
    const vite = await createServer({ root: ROOT, server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  }

  return new Promise((resolve, reject) => {
    const server = app.listen(port, host, () => {
      const actual = server.address().port;
      resolve({
        port: actual,
        url: `http://localhost:${actual}`,
        dataDir,
        close: () => {
          clearInterval(backupTimer);
          server.close();
          db.close();
        },
      });
    });
    server.on("error", reject);
  });
}
