// Template packages and the shared Template Library.
//
// A template package ("frnt-template" v1) is a self-contained JSON file: a page (with sub-pages,
// databases and rows) plus the images/files it uses, base64-encoded. Maintainers export packages
// from the app, put them in the repo's library/ folder, and every client can browse and install them.
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

export const DEFAULT_LIBRARY = "https://raw.githubusercontent.com/thanhmam/frnt-notes/main/library";
const INDEX_TTL = 60 * 60 * 1000; // re-check the library at most hourly unless the user asks
const MAX_INDEX = 2 * 1024 * 1024;
const MAX_TEMPLATE = 40 * 1024 * 1024;
const MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml", ".pdf": "application/pdf" };

const httpError = (status, message) => Object.assign(new Error(message), { status });

/** Only http(s) sources; plain http only for local testing. */
function checkSource(src) {
  let u;
  try {
    u = new URL(src);
  } catch {
    throw httpError(400, `Invalid library address: ${src}`);
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
  if (!(u.protocol === "https:" || (u.protocol === "http:" && local))) throw httpError(400, "The library address must start with https://");
  return src.replace(/\/+$/, "");
}

async function fetchLimited(url, max) {
  let res;
  try {
    res = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(30000) });
  } catch (e) {
    throw httpError(502, `Cannot reach the template library (${new URL(url).host}): ${e.cause?.code || e.message}. Check your internet connection.`);
  }
  if (!res.ok) throw httpError(502, `Template library answered HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > max) throw httpError(413, `File too large from library: ${url}`);
  try {
    return JSON.parse(buf.toString("utf8"));
  } catch {
    throw httpError(502, `The library returned invalid JSON: ${url}`);
  }
}

/** Links inside imported content may only point to the web, e-mail, or other pages of this app. */
function sanitizeContent(node) {
  if (Array.isArray(node)) return node.map(sanitizeContent);
  if (node && typeof node === "object") {
    const out = {};
    for (const [k, v] of Object.entries(node)) out[k] = sanitizeContent(v);
    if (out.type === "link" && typeof out.href === "string" && !/^(https?:|mailto:|#\/p\/|\/uploads\/)/i.test(out.href)) out.href = "#";
    if (typeof out.url === "string" && !/^(https?:|\/uploads\/)/i.test(out.url)) out.url = "";
    return out;
  }
  return node;
}

export function validatePackage(pkg) {
  if (!pkg || pkg.format !== "frnt-template") throw httpError(400, "Not a Frnt template file (format must be \"frnt-template\").");
  if (pkg.version !== 1) throw httpError(400, `Unsupported template version ${pkg.version}. Please update Frnt.`);
  if (!Array.isArray(pkg.pages) || !pkg.pages.length) throw httpError(400, "The template contains no pages.");
  const keys = new Set(pkg.pages.map((p) => p.key));
  if (keys.size !== pkg.pages.length || [...keys].some((k) => typeof k !== "string" || !k)) throw httpError(400, "The template has invalid page keys.");
  if (!pkg.pages.some((p) => !p.parent || !keys.has(p.parent))) throw httpError(400, "The template has no top-level page.");
  return pkg;
}

export function mountTemplates(app, { db, dataDir, uploadDir, getPage, createPage, descendants, getSetting, setSetting }) {
  const CACHE = path.join(dataDir, "library-cache");
  fs.mkdirSync(CACHE, { recursive: true });
  const source = () => checkSource(getSetting("library_source") || DEFAULT_LIBRARY);

  // ---------- export a page (and everything under it) as a package ----------
  function exportPackage(rootId, meta = {}) {
    const root = getPage(rootId);
    if (!root || root.deleted_at) throw httpError(404, "Page not found");
    const ids = descendants(rootId).filter((id) => {
      const p = db.prepare(`SELECT deleted_at FROM pages WHERE id = ?`).get(id);
      return p && !p.deleted_at;
    });
    const pages = [];
    const assets = {};
    for (const id of ids) {
      const p = getPage(id);
      const text = db.prepare(`SELECT text FROM pages WHERE id = ?`).get(id).text;
      pages.push({
        key: p.id,
        parent: p.id === rootId ? null : p.parent_id,
        kind: p.kind,
        title: p.title,
        icon: p.icon,
        cover: p.cover,
        content: p.content,
        text,
        db_schema: p.db_schema,
        props: p.props,
        position: p.position,
        full_width: p.full_width,
      });
      const blob = JSON.stringify([p.content, p.cover]);
      for (const m of blob.matchAll(/\/uploads\/([0-9a-f-]{36}\.[a-z0-9]{1,8})/gi)) {
        const ref = `/uploads/${m[1]}`;
        if (assets[ref]) continue;
        const file = path.join(uploadDir, m[1]);
        if (!fs.existsSync(file)) continue;
        const ext = path.extname(file).toLowerCase();
        assets[ref] = { name: m[1], type: MIME[ext] || "application/octet-stream", data: fs.readFileSync(file).toString("base64") };
      }
    }
    const slug = (meta.id || root.title || "template")
      .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "template";
    return {
      format: "frnt-template",
      version: 1,
      id: slug,
      title: meta.title || root.title || "Untitled",
      description: meta.description || "",
      category: meta.category || "Other",
      lang: meta.lang || "en",
      icon: root.icon || "📄",
      author: meta.author || "",
      updated: new Date().toISOString().slice(0, 10),
      pages,
      assets,
    };
  }

  // ---------- install a package as new pages ----------
  function installPackage(pkg, { asTemplate = false } = {}) {
    validatePackage(pkg);
    const idMap = new Map(pkg.pages.map((p) => [p.key, randomUUID()]));
    const urlMap = new Map();
    for (const [ref, a] of Object.entries(pkg.assets || {})) {
      if (!a?.data) continue;
      const ext = path.extname(String(a.name || ref)).toLowerCase().replace(/[^.a-z0-9]/g, "").slice(0, 9);
      const name = `${randomUUID()}${ext}`;
      fs.writeFileSync(path.join(uploadDir, name), Buffer.from(a.data, "base64"));
      urlMap.set(ref, `/uploads/${name}`);
    }
    const remap = (v) => {
      if (v == null) return v;
      let s = JSON.stringify(v);
      for (const [a, b] of idMap) s = s.split(a).join(b);
      for (const [a, b] of urlMap) s = s.split(a).join(b);
      return JSON.parse(s);
    };
    const keys = new Set(idMap.keys());
    let rootId = null;
    db.exec("BEGIN");
    try {
      for (const p of pkg.pages) {
        const isRoot = !p.parent || !keys.has(p.parent);
        const id = idMap.get(p.key);
        if (isRoot && !rootId) rootId = id;
        createPage({
          id,
          parent_id: isRoot ? null : idMap.get(p.parent),
          kind: p.kind === "database" ? "database" : "page",
          title: String(p.title ?? ""),
          icon: p.icon ?? null,
          cover: typeof p.cover === "string" ? remap(p.cover) : null,
          content: p.content ? sanitizeContent(remap(p.content)) : null,
          text: String(p.text ?? ""),
          db_schema: p.db_schema ?? null,
          props: p.props ? remap(p.props) : null,
          position: isRoot ? null : p.position,
          is_template: isRoot && asTemplate ? 1 : 0,
        });
      }
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
    return { rootId, pages: pkg.pages.length };
  }

  // ---------- library index (cached) ----------
  async function loadIndex(refresh) {
    const src = source();
    const cacheFile = path.join(CACHE, "index.json");
    let cached = null;
    try {
      cached = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
    } catch {}
    const fresh = cached && cached.source === src && Date.now() - cached.fetched_at < INDEX_TTL;
    if (!refresh && fresh) return { ...cached, cached: true };
    try {
      const index = await fetchLimited(`${src}/index.json`, MAX_INDEX);
      if (!Array.isArray(index?.templates)) throw httpError(502, "The library index is invalid (missing \"templates\").");
      const out = { source: src, fetched_at: Date.now(), name: index.name || "", templates: index.templates };
      fs.writeFileSync(cacheFile, JSON.stringify(out));
      return out;
    } catch (e) {
      if (cached && cached.source === src) return { ...cached, cached: true, offline: true, error: e.message };
      throw e;
    }
  }

  app.get("/api/library", async (req, res, next) => {
    try {
      const idx = await loadIndex(req.query.refresh === "1");
      const seen = JSON.parse(getSetting("library_seen") || "{}");
      res.json({
        ...idx,
        templates: idx.templates.map((t) => ({ ...t, isNew: !!seen.__init && seen[t.id] !== t.updated })),
      });
    } catch (e) {
      next(e);
    }
  });

  // remember what the user has seen so new/updated templates can be highlighted
  app.post("/api/library/seen", (req, res) => {
    const seen = { __init: 1 };
    for (const t of req.body?.templates || []) seen[t.id] = t.updated;
    setSetting("library_seen", JSON.stringify(seen));
    res.json({ ok: true });
  });

  app.post("/api/library/install/:id", async (req, res, next) => {
    try {
      const idx = await loadIndex(false);
      const entry = idx.templates.find((t) => t.id === req.params.id);
      if (!entry) throw httpError(404, `Template "${req.params.id}" is not in the library (try "Check for updates").`);
      if (!/^[\w./-]+\.json$/.test(entry.file || "") || entry.file.includes("..")) throw httpError(400, "Invalid template file name in library index.");
      const cacheFile = path.join(CACHE, `${entry.id}@${entry.updated || "0"}.json`.replace(/[^\w.@-]/g, "_"));
      let pkg;
      if (fs.existsSync(cacheFile)) pkg = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
      else {
        pkg = await fetchLimited(`${idx.source}/${entry.file}`, MAX_TEMPLATE);
        validatePackage(pkg);
        fs.writeFileSync(cacheFile, JSON.stringify(pkg));
      }
      res.json(installPackage(pkg, { asTemplate: req.body?.asTemplate === true }));
    } catch (e) {
      next(e);
    }
  });

  // install a package file chosen by the user
  app.post("/api/templates/install", (req, res, next) => {
    try {
      res.json(installPackage(req.body, { asTemplate: req.query.asTemplate === "1" }));
    } catch (e) {
      next(e);
    }
  });

  app.get("/api/pages/:id/export-template", (req, res, next) => {
    try {
      const pkg = exportPackage(req.params.id, {
        id: req.query.id,
        title: req.query.title,
        description: req.query.description,
        category: req.query.category,
        lang: req.query.lang,
        author: req.query.author,
      });
      res.setHeader("Content-Disposition", `attachment; filename="${pkg.id}.json"`);
      res.json(pkg);
    } catch (e) {
      next(e);
    }
  });

  return { exportPackage, installPackage };
}
