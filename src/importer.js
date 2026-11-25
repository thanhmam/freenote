// Import Markdown files or a Notion "Markdown & CSV" export (.zip) into Frnt.
import { BlockNoteEditor } from "@blocknote/core";
import { unzipSync, strFromU8 } from "fflate";
import { api } from "./api.js";
import { extractText } from "./store.js";
import { uid } from "./db/dbUtils.js";
import { t, dateLocale } from "./i18n.js";

let parser;
const mdToBlocks = (md) => (parser ||= BlockNoteEditor.create()).tryParseMarkdownToBlocks(md);

const NOTION_ID = /\s+[0-9a-f]{32}$/i;
const cleanName = (name) => name.replace(/\.(md|csv)$/i, "").replace(NOTION_ID, "").trim();
const dirOf = (p) => (p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "");
const baseOf = (p) => p.slice(p.lastIndexOf("/") + 1);
const stripExt = (p) => p.replace(/\.(md|csv)$/i, "");
const MIME = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml", pdf: "application/pdf" };

function resolvePath(fromDir, href) {
  let p;
  try {
    p = decodeURIComponent(href.split("#")[0].split("?")[0]);
  } catch {
    p = href;
  }
  const parts = (fromDir ? fromDir.split("/") : []).concat(p.split("/"));
  const out = [];
  for (const s of parts) {
    if (s === "..") out.pop();
    else if (s && s !== ".") out.push(s);
  }
  return out.join("/");
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

function guessProperty(name, values) {
  const filled = values.filter((v) => v.trim());
  const id = uid();
  if (filled.length && filled.every((v) => /^(yes|no)$/i.test(v))) return { id, name, type: "checkbox" };
  if (filled.length && filled.every((v) => !isNaN(Number(v.replace(/,/g, ""))))) return { id, name, type: "number" };
  if (filled.length && filled.every((v) => /^https?:\/\//.test(v))) return { id, name, type: "url" };
  const distinct = [...new Set(filled)];
  if (filled.length >= 2 && distinct.length <= Math.max(3, filled.length / 2) && distinct.length <= 12 && distinct.every((v) => v.length < 40)) {
    const colors = ["gray", "blue", "green", "orange", "purple", "pink", "yellow", "red", "brown"];
    return { id, name, type: "select", options: distinct.map((v, i) => ({ id: uid(), name: v, color: colors[i % colors.length] })) };
  }
  return { id, name, type: "text" };
}

function cellValue(prop, raw) {
  const v = (raw ?? "").trim();
  if (!v) return null;
  if (prop.type === "checkbox") return /^yes$/i.test(v);
  if (prop.type === "number") return Number(v.replace(/,/g, ""));
  if (prop.type === "select") return prop.options.find((o) => o.name === v)?.id ?? null;
  return v;
}

// Remove leading "# Title" and Notion's "Property: value" header lines; return {title, body}
function splitNotionMd(md, fallbackTitle) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  let title = fallbackTitle;
  let i = 0;
  while (i < lines.length && !lines[i].trim()) i++;
  if (/^#\s+/.test(lines[i] || "")) title = lines[i++].replace(/^#\s+/, "").trim();
  return { title, body: lines.slice(i).join("\n") };
}

/** files: Record<path, Uint8Array>. onProgress(msg). Returns id of the import root page. */
async function importFileMap(files, rootTitle, onProgress) {
  // expand nested zips (Notion wraps big exports as zip-in-zip)
  for (const [p, data] of Object.entries(files)) {
    if (/\.zip$/i.test(p)) {
      delete files[p];
      Object.assign(files, unzipSync(data));
    }
  }
  const paths = Object.keys(files).filter((p) => !p.startsWith("__MACOSX") && !p.endsWith("/"));
  const mdPaths = paths.filter((p) => /\.md$/i.test(p));
  const csvPaths = paths.filter((p) => /\.csv$/i.test(p) && !/_all\.csv$/i.test(p));
  const keySet = new Set([...mdPaths, ...csvPaths].map(stripExt));
  const csvKeys = new Set(csvPaths.map(stripExt));

  const root = await api.create({ title: rootTitle, icon: "📥" });
  const idByKey = {}; // "A/B/Page id" -> page id
  const kindByKey = {};

  // parent of an item = nearest ancestor folder that is itself a page/db
  const parentKey = (key) => {
    let d = dirOf(key);
    while (d) {
      if (keySet.has(d)) return d;
      d = dirOf(d);
    }
    return null;
  };

  // 1) create pages and databases, parents first (sorted by depth), so every child finds its parent id
  const rowsOfDb = {}; // dbKey -> [{id, title}]
  const sortedMd = [...mdPaths].sort((a, b) => a.split("/").length - b.split("/").length);
  const items = [...mdPaths, ...csvPaths].sort((a, b) => a.split("/").length - b.split("/").length || (/\.csv$/i.test(a) ? -1 : 1));
  for (const p of items) {
    const key = stripExt(p);
    const pk = parentKey(key);
    const parent_id = pk && idByKey[pk] ? idByKey[pk] : root.id;

    if (/\.csv$/i.test(p)) {
      onProgress?.(`Database: ${cleanName(baseOf(p))}`);
      const table = parseCSV(strFromU8(files[p]));
      if (!table.length) continue;
      const [header, ...body] = table;
      const properties = header.slice(1).map((name, i) => guessProperty(name || t("Column {n}", { n: i + 2 }), body.map((r) => r[i + 1] ?? "")));
      const db = await api.create({
        parent_id,
        kind: "database",
        title: cleanName(baseOf(p)),
        icon: "🗃️",
        db_schema: {
          titleName: header[0] || t("Name"),
          properties,
          views: [{ id: uid(), name: t("Table"), type: "table", sorts: [], filters: [], hidden: [], widths: {} }],
        },
      });
      idByKey[key] = db.id;
      kindByKey[key] = "database";
      rowsOfDb[key] = [];
      for (const r of body) {
        const props = {};
        properties.forEach((pr, i) => {
          const v = cellValue(pr, r[i + 1]);
          if (v != null) props[pr.id] = v;
        });
        const row = await api.create({ parent_id: db.id, title: (r[0] || "").trim(), props });
        rowsOfDb[key].push({ id: row.id, title: (r[0] || "").trim() });
      }
      continue;
    }

    const fallback = cleanName(baseOf(p));
    const { title } = splitNotionMd(strFromU8(files[p]), fallback);
    onProgress?.(title);
    if (pk && kindByKey[pk] === "database") {
      const match = rowsOfDb[pk].find((r) => !r.used && (r.title === title || r.title === fallback));
      if (match) {
        match.used = true;
        idByKey[key] = match.id;
        continue;
      }
    }
    const page = await api.create({ parent_id, title });
    idByKey[key] = page.id;
  }

  // 3) fill content: upload images, convert links to imported pages
  let n = 0;
  for (const p of sortedMd) {
    const key = stripExt(p);
    const dir = dirOf(p);
    onProgress?.(`Trang ${++n}/${sortedMd.length}`);
    let { body } = splitNotionMd(strFromU8(files[p]), "");
    // database row pages: drop the "Prop: value" header block
    if (kindByKey[parentKey(key)] === "database") body = body.replace(/^(\s*\n)*([^\n:]{1,60}: [^\n]*\n)+/, "");

    const uploads = {};
    for (const m of body.matchAll(/!\[[^\]]*\]\(([^)\s]+)\)/g)) {
      const href = m[1];
      if (/^(https?:|data:)/.test(href) || uploads[href]) continue;
      const target = resolvePath(dir, href);
      const data = files[target];
      if (!data) continue;
      const ext = target.split(".").pop().toLowerCase();
      uploads[href] = await api.upload(new File([data], baseOf(target), { type: MIME[ext] || "application/octet-stream" }));
    }
    for (const [a, b] of Object.entries(uploads)) body = body.split(`(${a})`).join(`(${b})`);

    let blocks = mdToBlocks(body);
    blocks = linkify(blocks, dir, idByKey);
    // strip trailing empty paragraphs
    while (blocks.length && blocks.at(-1).type === "paragraph" && !extractText(blocks.at(-1).content).join("").trim()) blocks.pop();
    if (blocks.length) await api.update(idByKey[key], { content: blocks, text: extractText(blocks).join(" ") });
  }
  return root.id;
}

// Turn links to other exported .md/.csv files into internal links / page blocks.
function linkify(blocks, dir, idByKey) {
  const target = (href) => {
    if (!href || /^(https?:|mailto:|#)/.test(href)) return null;
    if (!/\.(md|csv)$/i.test(decodeURIComponent(href.split("#")[0]))) return null;
    return idByKey[stripExt(resolvePath(dir, href))] || null;
  };
  return blocks.map((b) => {
    const inl = Array.isArray(b.content) ? b.content.filter((c) => !(c.type === "text" && !c.text.trim())) : null;
    if (b.type === "paragraph" && inl?.length === 1 && inl[0].type === "link") {
      const id = target(inl[0].href);
      if (id) return { type: "page", props: { pageId: id }, children: [] };
    }
    const fix = (c) => (c?.type === "link" && target(c.href) ? { ...c, href: `#/p/${target(c.href)}` } : c);
    return {
      ...b,
      content: Array.isArray(b.content) ? b.content.map(fix) : b.content,
      children: b.children?.length ? linkify(b.children, dir, idByKey) : b.children,
    };
  });
}

export async function importFiles(fileList, onProgress) {
  const files = {};
  const list = [...fileList];
  for (const f of list) {
    const data = new Uint8Array(await f.arrayBuffer());
    if (/\.zip$/i.test(f.name)) Object.assign(files, unzipSync(data));
    else files[f.webkitRelativePath || f.name] = data;
  }
  const isNotion = list.some((f) => /\.zip$/i.test(f.name));
  const title = isNotion ? `Notion import ${new Date().toLocaleDateString(dateLocale)}` : `Import ${new Date().toLocaleDateString(dateLocale)}`;
  return importFileMap(files, title, onProgress);
}
