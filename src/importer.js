// Import a Notion export ("Markdown & CSV" .zip) or plain Markdown files into Frnt.
//
// Notion export layout (2024+):
//   Export-<uuid>/Page <32hex>.md            a page
//   Export-<uuid>/Page/Child <32hex>.md       its children live in a folder named after the title (no id)
//   Export-<uuid>/DB <32hex>_all.csv          a database (all rows); optional DB <32hex>.md next to it
//   Export-<uuid>/DB/Row <32hex>.md           row pages (title + "Prop: value" lines + body)
// Older exports used folders *with* the id and plain DB <id>.csv; both are handled.
//
// Every step records problems per file instead of aborting; a report page lists them at the end.
import { BlockNoteEditor } from "@blocknote/core";
import { api } from "./api.js";
import { extractText } from "./store.js";
import { uid } from "./db/dbUtils.js";
import { t, dateLocale } from "./i18n.js";

let parser;
const mdToBlocks = (md) => (parser ||= BlockNoteEditor.create()).tryParseMarkdownToBlocks(md);

const NOTION_ID = /\s+[0-9a-f]{32}$/i;
const stripExt = (p) => p.replace(/(_all)?\.csv$/i, "").replace(/\.(md|markdown)$/i, "");
const cleanName = (name) => stripExt(name).replace(NOTION_ID, "").trim();
const dirOf = (p) => (p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "");
const baseOf = (p) => p.slice(p.lastIndexOf("/") + 1);
const isMd = (p) => /\.(md|markdown)$/i.test(p);
const isCsv = (p) => /\.csv$/i.test(p);
const newId = () => crypto.randomUUID();

function resolvePath(fromDir, href) {
  let p;
  try {
    p = decodeURIComponent(href.split("#")[0].split("?")[0]);
  } catch {
    p = href.split("#")[0];
  }
  const out = [];
  for (const s of (fromDir ? fromDir.split("/") : []).concat(p.split("/"))) {
    if (s === "..") out.pop();
    else if (s && s !== ".") out.push(s);
  }
  return out.join("/");
}

/** Run fn over items with limited concurrency, reporting progress. */
async function pool(items, n, fn, onTick) {
  let i = 0;
  let done = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        await fn(items[k], k);
        onTick?.(++done, items.length);
      }
    })
  );
}

// RFC-4180-ish CSV parser
function parseCSV(text) {
  const rows = [];
  let row = [], cell = "", q = false;
  text = text.replace(/^﻿/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') (cell += '"'), i++;
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") row.push(cell), (cell = "");
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell), rows.push(row), (row = []), (cell = "");
    } else cell += c;
  }
  if (cell || row.length) row.push(cell), rows.push(row);
  return rows.filter((r) => r.some((c) => c.trim()));
}

// Notion CSV dates: "November 5, 2021", "November 5, 2021 9:52 AM", ranges "A → B" (start is kept)
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
function notionDate(v) {
  const m = String(v).split(" → ")[0].trim().match(/^([A-Za-z]+) (\d{1,2}), (\d{4})(?: \d{1,2}:\d{2}(?: ?[AP]M)?)?(?: \([^)]*\))?$/);
  if (!m) return null;
  const mo = MONTHS.indexOf(m[1].toLowerCase());
  if (mo < 0) return null;
  return `${m[3]}-${String(mo + 1).padStart(2, "0")}-${String(m[2]).padStart(2, "0")}`;
}

const COLORS = ["gray", "blue", "green", "orange", "purple", "pink", "yellow", "red", "brown"];
function guessProperty(name, values) {
  const filled = values.map((v) => v.trim()).filter(Boolean);
  const id = uid();
  if (filled.length && filled.every((v) => /^(yes|no)$/i.test(v))) return { id, name, type: "checkbox" };
  if (filled.length && filled.every((v) => /^-?[\d,]*\.?\d+$/.test(v))) return { id, name, type: "number" };
  if (filled.length && filled.every((v) => /^https?:\/\/\S+$/.test(v))) return { id, name, type: "url" };
  if (filled.length && filled.every((v) => /^\d{4}-\d{2}-\d{2}$/.test(v) || notionDate(v))) return { id, name, type: "date" };
  // multi-select: comma-separated short tags drawn from a small vocabulary
  const tokens = filled.flatMap((v) => v.split(/,\s*/)).map((x) => x.trim()).filter(Boolean);
  const vocab = [...new Set(tokens)];
  if (filled.some((v) => v.includes(",")) && tokens.length >= 3 && vocab.length <= Math.max(5, tokens.length / 2) && vocab.length <= 50 && vocab.every((v) => v.length < 40 && !v.includes("("))) {
    return { id, name, type: "multi_select", options: vocab.map((v, i) => ({ id: uid(), name: v, color: COLORS[i % COLORS.length] })) };
  }
  const distinct = [...new Set(filled)];
  if (filled.length >= 2 && distinct.length <= Math.max(3, filled.length / 2) && distinct.length <= 20 && distinct.every((v) => v.length < 40 && !v.includes("("))) {
    return { id, name, type: "select", options: distinct.map((v, i) => ({ id: uid(), name: v, color: COLORS[i % COLORS.length] })) };
  }
  return { id, name, type: "text" };
}
function cellValue(prop, raw) {
  const v = (raw ?? "").trim();
  if (!v) return null;
  if (prop.type === "date") return notionDate(v) || v.slice(0, 10);
  if (prop.type === "multi_select") return v.split(/,\s*/).map((x) => prop.options.find((o) => o.name === x.trim())?.id).filter(Boolean);
  if (prop.type === "checkbox") return /^yes$/i.test(v);
  if (prop.type === "number") return Number(v.replace(/,/g, ""));
  if (prop.type === "select") return prop.options.find((o) => o.name === v)?.id ?? null;
  return v;
}

/** Split "# Title" off the top of a Notion markdown file. */
function splitTitle(md) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  while (i < lines.length && !lines[i].trim()) i++;
  if (/^#\s+/.test(lines[i] || "")) return { title: lines[i].replace(/^#\s+/, "").trim(), body: lines.slice(i + 1).join("\n") };
  return { title: null, body: lines.join("\n") };
}

class Report {
  constructor() {
    this.items = [];
  }
  warn(file, step, err) {
    const message = err?.message || String(err);
    this.items.push({ file, step, message });
    console.warn(`[import] ${step}: ${file}: ${message}`);
  }
}

/**
 * source = { paths: string[], text(path) → Promise<string>, attach(paths[]) → Promise<{[path]: {url}|{error}}> }
 * onProgress({ phase, done, total })
 */
async function importFromSource(source, rootTitle, onProgress) {
  const report = new Report();
  const step = (phase, done = 0, total = 0) => onProgress?.({ phase, done, total });
  const paths = source.paths.filter((p) => !p.startsWith("__MACOSX/") && !/(^|\/)\._/.test(p) && !p.endsWith(".DS_Store"));
  const mdPaths = paths.filter(isMd);
  const csvPaths = paths.filter(isCsv);
  if (!mdPaths.length && !csvPaths.length) {
    const html = paths.filter((p) => /\.html?$/i.test(p)).length;
    throw new Error(
      html
        ? t("This export is in HTML format. In Notion, export again and choose “Markdown & CSV”.")
        : t("No Markdown (.md) or CSV files found ({n} files in total). Is this a Notion “Markdown & CSV” export?", { n: paths.length })
    );
  }
  const fileSet = new Set(paths);

  // ---------- 1. nodes ----------
  /** key = path without extension (and without _all) → node */
  const nodes = new Map();
  for (const p of mdPaths) {
    const key = stripExt(p);
    nodes.set(key, { key, id: newId(), kind: "page", mdPath: p, dir: dirOf(p), fileTitle: cleanName(baseOf(p)) });
  }
  for (const p of csvPaths) {
    const key = stripExt(p);
    const n = nodes.get(key) || { key, id: newId(), dir: dirOf(p), fileTitle: cleanName(baseOf(p)) };
    // prefer the "_all" export (all rows) over the current-view csv
    if (!n.csvPath || /_all\.csv$/i.test(p)) n.csvPath = p;
    n.kind = "database";
    nodes.set(key, n);
  }

  // ---------- 2. read markdown ----------
  const texts = new Map();
  await pool(
    mdPaths,
    8,
    async (p) => {
      try {
        texts.set(stripExt(p), await source.text(p));
      } catch (e) {
        report.warn(p, t("read file"), e);
      }
    },
    (d, n) => step(t("Reading pages"), d, n)
  );
  for (const n of nodes.values()) {
    const tx = texts.get(n.key);
    n.title = (tx && splitTitle(tx).title) || n.fileTitle || t("Untitled");
  }

  // ---------- 3. hierarchy ----------
  // a) links from a page to files inside "its" folder are the most reliable parent signal (handles duplicate titles)
  const linkParent = new Map();
  const linkOrder = new Map();
  for (const [key, tx] of texts) {
    const self = nodes.get(key);
    const ownFolder = (self.dir ? self.dir + "/" : "") + self.fileTitle;
    const ownFolderOld = key; // older exports: folder named with the id
    let i = 0;
    for (const m of tx.matchAll(/\]\(([^)\s]+\.(?:md|csv))\)/gi)) {
      const childKey = stripExt(resolvePath(self.dir, m[1]));
      const child = nodes.get(childKey);
      if (!child || child === self) continue;
      if ((child.dir === ownFolder || child.dir === ownFolderOld) && !linkParent.has(childKey)) {
        linkParent.set(childKey, key);
        linkOrder.set(childKey, i++);
      }
    }
  }
  // b) folder name → page/database in the parent directory with that (clean) title
  const byDirTitle = new Map();
  for (const n of nodes.values()) {
    const k = n.dir + "\u0000" + n.fileTitle;
    (byDirTitle.get(k) || byDirTitle.set(k, []).get(k)).push(n);
    byDirTitle.set(n.dir + "\u0000" + baseOf(n.key), byDirTitle.get(n.dir + "\u0000" + baseOf(n.key)) || [n]); // old style "Title <id>" folders
  }
  // c) folders with no matching page/database (e.g. a database whose CSV wasn't exported) become plain pages,
  //    so their content keeps its place in the tree instead of landing at the top level
  const firstSegs = new Set(paths.map((p) => p.split("/")[0]));
  const exportRoot = firstSegs.size === 1 && paths[0].includes("/") ? [...firstSegs][0] : "";
  const folderNodes = new Map();
  const folderNode = (d) => {
    if (!d || d === exportRoot) return null;
    const cands = byDirTitle.get(dirOf(d) + "\u0000" + baseOf(d));
    if (cands?.length) return (cands.find((c) => c.kind === "database") || cands[0]).key;
    if (/(^|\/)attachments$/.test(d)) return null;
    let f = folderNodes.get(d);
    if (!f) {
      f = { key: "\u0000folder:" + d, id: newId(), kind: "page", dir: dirOf(d), fileTitle: baseOf(d), title: baseOf(d) };
      folderNodes.set(d, f);
      f.parentKey = folderNode(dirOf(d));
    }
    return f.key;
  };
  for (const n of [...nodes.values()]) n.parentKey = linkParent.get(n.key) ?? folderNode(n.dir);
  for (const f of folderNodes.values()) nodes.set(f.key, f);

  // ---------- 4. databases ----------
  const dbs = [...nodes.values()].filter((n) => n.kind === "database");
  const extraRows = [];
  let dbDone = 0;
  for (const db of dbs) {
    step(t("Databases"), dbDone++, dbs.length);
    let table;
    try {
      table = parseCSV(await source.text(db.csvPath));
    } catch (e) {
      report.warn(db.csvPath, t("read database"), e);
      table = [];
    }
    const [header = [t("Name")], ...body] = table;
    const properties = header.slice(1).map((name, i) => guessProperty(name || t("Column {n}", { n: i + 2 }), body.map((r) => r[i + 1] ?? "")));
    db.schema = {
      titleName: header[0] || t("Name"),
      properties,
      views: [{ id: uid(), name: t("Table"), type: "table", sorts: [], filters: [], hidden: [], widths: {} }],
    };
    // rows from csv, matched to their markdown pages by title
    const rowPages = [...nodes.values()].filter((n) => n.parentKey === db.key && n.kind === "page");
    const unused = new Set(rowPages);
    body.forEach((r, i) => {
      const title = (r[0] || "").trim();
      const props = {};
      properties.forEach((pr, j) => {
        const v = cellValue(pr, r[j + 1]);
        if (v != null) props[pr.id] = v;
      });
      const match = [...unused].find((n) => n.title === title || n.fileTitle === title);
      if (match) {
        unused.delete(match);
        Object.assign(match, { isRow: true, props, position: i + 1, title: title || match.title });
      } else {
        extraRows.push({ id: newId(), parent_id: db.id, title, props, position: i + 1 });
      }
    });
    unused.forEach((n) => (n.isRow = true)); // row pages without a csv line are kept as rows without values
  }

  // ---------- 5. attachments (images, pdf…) ----------
  const attachRefs = new Map(); // node key → [{href, path}]
  const allAttach = new Set();
  const external = /^(https?:|data:|mailto:|#)/i;
  for (const [key, tx] of texts) {
    const n = nodes.get(key);
    const refs = [];
    for (const m of tx.matchAll(/!?\[[^\]]*\]\(([^)\s]+)\)/g)) {
      const href = m[1];
      if (external.test(href) || /\.(md|csv)$/i.test(href.split("#")[0])) continue;
      const p = resolvePath(n.dir, href);
      if (fileSet.has(p)) {
        refs.push({ href, path: p });
        allAttach.add(p);
      } else if (m[0].startsWith("!")) report.warn(n.mdPath, t("image"), new Error(t("not found in export: {path}", { path: p })));
    }
    if (refs.length) attachRefs.set(key, refs);
  }
  const attachUrl = new Map();
  const attachList = [...allAttach];
  for (let i = 0; i < attachList.length; i += 50) {
    step(t("Copying images & files"), i, attachList.length);
    const chunk = attachList.slice(i, i + 50);
    try {
      const res = await source.attach(chunk);
      for (const p of chunk) {
        if (res[p]?.url) attachUrl.set(p, res[p].url);
        else report.warn(p, t("copy file"), new Error(res[p]?.error || "unknown error"));
      }
    } catch (e) {
      chunk.forEach((p) => report.warn(p, t("copy file"), e));
    }
  }

  // ---------- 6. convert markdown → blocks ----------
  const idByKey = new Map([...nodes.values()].map((n) => [n.key, n]));
  const pageNodes = [...nodes.values()].filter((n) => n.kind === "page");
  let converted = 0;
  for (const n of pageNodes) {
    if (++converted % 25 === 0) {
      step(t("Converting pages"), converted, pageNodes.length);
      await new Promise((r) => setTimeout(r)); // keep the UI responsive
    }
    const tx = texts.get(n.key);
    if (tx == null) continue;
    let { body } = splitTitle(tx);
    if (n.isRow) body = body.replace(/^(\s*\n)*([^\n:]{1,60}: [^\n]*\n)+/, ""); // drop "Prop: value" header lines
    for (const r of attachRefs.get(n.key) || []) {
      const url = attachUrl.get(r.path);
      if (url) body = body.split(`(${r.href})`).join(`(${url})`);
    }
    try {
      let blocks = linkify(mdToBlocks(body), n.dir, idByKey);
      while (blocks.length && blocks.at(-1).type === "paragraph" && !extractText(blocks.at(-1).content).join("").trim()) blocks.pop();
      n.content = blocks.length ? blocks : null;
    } catch (e) {
      report.warn(n.mdPath, t("convert Markdown"), e);
      n.content = body.split(/\n{2,}/).filter((s) => s.trim()).map((s) => ({ type: "paragraph", content: s.trim() }));
    }
  }

  // ---------- 7. save ----------
  step(t("Saving"), 0, 1);
  const root = await api.create({ title: rootTitle, icon: "📥" });
  const rows = [];
  for (const n of nodes.values()) {
    const parent = n.parentKey ? nodes.get(n.parentKey) : null;
    rows.push({
      id: n.id,
      parent_id: parent ? parent.id : root.id,
      kind: n.kind,
      title: n.title,
      icon: n.kind === "database" ? "🗃️" : null,
      content: n.content || null,
      text: n.content ? extractText(n.content).join(" ") : "",
      db_schema: n.schema || null,
      props: n.props || null,
      position: n.position ?? (linkOrder.has(n.key) ? linkOrder.get(n.key) + 1 : 100000 + rows.length),
      depth: n.key.split("/").length,
    });
  }
  rows.sort((a, b) => a.depth - b.depth);
  rows.forEach((r) => delete r.depth);
  rows.push(...extraRows);

  // send in chunks of ~4 MB / 300 pages
  let saved = 0;
  let chunk = [];
  let size = 0;
  const flush = async () => {
    if (!chunk.length) return;
    try {
      await api.createMany(chunk);
    } catch (e) {
      // retry one by one so a single bad page doesn't lose the others
      for (const p of chunk) {
        try {
          await api.createMany([p]);
        } catch (e2) {
          report.warn(p.title || p.id, t("save page"), e2);
        }
      }
    }
    saved += chunk.length;
    step(t("Saving"), saved, rows.length);
    chunk = [];
    size = 0;
  };
  for (const r of rows) {
    const s = JSON.stringify(r).length;
    if (chunk.length && (size + s > 4e6 || chunk.length >= 300)) await flush();
    chunk.push(r);
    size += s;
  }
  await flush();

  const stats = {
    pages: pageNodes.filter((n) => !n.isRow).length,
    databases: dbs.length,
    rows: pageNodes.filter((n) => n.isRow).length + extraRows.length,
    files: attachUrl.size,
    warnings: report.items.length,
  };

  // ---------- 8. report page ----------
  if (report.items.length) {
    const lines = report.items.slice(0, 1000).map((w) => ({ type: "bulletListItem", content: `${w.step} — ${w.file}: ${w.message}` }));
    await api.createMany([
      {
        id: newId(),
        parent_id: root.id,
        title: t("⚠️ Import report"),
        position: 0,
        content: [
          { type: "paragraph", content: t("{n} problems while importing. Everything else was imported.", { n: report.items.length }) },
          ...lines,
        ],
        text: "import report",
      },
    ]).catch(() => {});
  }
  return { rootId: root.id, stats, warnings: report.items };
}

/** Links to other exported .md/.csv files → internal links, page blocks or inline databases. */
function linkify(blocks, dir, nodesByKey) {
  const target = (href) => {
    if (!href || /^(https?:|mailto:|#)/.test(href)) return null;
    if (!/\.(md|csv)$/i.test(href.split("#")[0])) return null;
    return nodesByKey.get(stripExt(resolvePath(dir, href))) || null;
  };
  return blocks.map((b) => {
    const inl = Array.isArray(b.content) ? b.content.filter((c) => !(c.type === "text" && !c.text.trim())) : null;
    if (b.type === "paragraph" && inl?.length === 1 && inl[0].type === "link") {
      const n = target(inl[0].href);
      if (n) return n.kind === "database" ? { type: "database", props: { dbId: n.id }, children: [] } : { type: "page", props: { pageId: n.id }, children: [] };
    }
    const fix = (c) => {
      const n = c?.type === "link" ? target(c.href) : null;
      return n ? { ...c, href: `#/p/${n.id}` } : c;
    };
    return {
      ...b,
      content: Array.isArray(b.content) ? b.content.map(fix) : b.content,
      children: b.children?.length ? linkify(b.children, dir, nodesByKey) : b.children,
    };
  });
}

/** Entry point used by Settings. files: FileList (one or more .zip, or .md files). */
export async function importFiles(fileList, onProgress) {
  const list = [...fileList];
  const zips = list.filter((f) => /\.zip$/i.test(f.name));
  const date = new Date().toLocaleDateString(dateLocale);

  if (!zips.length) {
    const byPath = new Map(list.map((f) => [f.webkitRelativePath || f.name, f]));
    return importFromSource(
      {
        paths: [...byPath.keys()],
        text: (p) => byPath.get(p).text(),
        attach: async (paths) => {
          const out = {};
          for (const p of paths) out[p] = { url: await api.upload(byPath.get(p)) };
          return out;
        },
      },
      `Import ${date}`,
      onProgress
    );
  }

  // zip(s): stream to the server, extract there, then read file by file
  const sessions = [];
  try {
    const paths = [];
    const where = new Map();
    for (const [i, f] of zips.entries()) {
      onProgress?.({ phase: t("Uploading {name}", { name: f.name }), done: 0, total: 100 });
      const r = await api.importUpload(f, (x) =>
        onProgress?.({ phase: x < 1 ? t("Uploading {name}", { name: f.name }) : t("Unzipping {name}", { name: f.name }), done: Math.round(x * 100), total: 100 })
      );
      sessions.push(r.sid);
      for (const file of r.files) {
        if (!where.has(file.path)) paths.push(file.path);
        where.set(file.path, r.sid);
      }
      if (i === zips.length - 1 && !paths.length) throw new Error(t("The zip file is empty."));
    }
    return await importFromSource(
      {
        paths,
        text: (p) => api.importFileText(where.get(p), p),
        attach: async (ps) => {
          const out = {};
          const bySid = new Map();
          ps.forEach((p) => (bySid.get(where.get(p)) || bySid.set(where.get(p), []).get(where.get(p))).push(p));
          for (const [sid, group] of bySid) Object.assign(out, await api.importAttach(sid, group));
          return out;
        },
      },
      `Notion import ${date}`,
      onProgress
    );
  } finally {
    sessions.forEach((sid) => api.importCleanup(sid).catch(() => {}));
  }
}
