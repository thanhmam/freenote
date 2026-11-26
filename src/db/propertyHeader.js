// Notion property headers and database building, shared by the importer and the "repair" tools.
//
// Notion row pages start with their properties, one per line, right under the title:
//   Status: Not Started
//   Assignee: thanhmam
//   Due: June 6, 2023
//   Project: Getting started with Projects & Tasks (../Projects/Getting%20started%20…%20871c….md)
// When Notion exports a database without its CSV, these lines are the only copy of the data.
import { uid } from "./dbUtils.js";
import { t } from "../i18n.js";
import { parseHeaderLines, blockText, contentHeader, rowHasHeader } from "../../server/headerCore.js";

// ---------- value parsing ----------
// Notion dates: "November 5, 2021", "November 5, 2021 9:52 AM", ranges "A → B" (start is kept)
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
export function notionDate(v) {
  const m = String(v).split(" → ")[0].trim().match(/^([A-Za-z]+) (\d{1,2}), (\d{4})(?: \d{1,2}:\d{2}(?: ?[AP]M)?)?(?: \([^)]*\))?$/);
  if (!m) return null;
  const mo = MONTHS.indexOf(m[1].toLowerCase());
  if (mo < 0) return null;
  return `${m[3]}-${String(mo + 1).padStart(2, "0")}-${String(m[2]).padStart(2, "0")}`;
}

/** "Name (../Projects/Name%20<id>.md), Other (…)" → "Name, Other" (relation paths are meaningless outside Notion). */
export function cleanNotionValue(v) {
  return String(v ?? "")
    .replace(/\s*\((?:[^()]|\([^()]*\))*?\.(?:md|csv)\)/gi, "")
    .replace(/\s*\(https?:\/\/www\.notion\.so\/[^)]*\)/gi, "")
    .trim();
}

const COLORS = ["gray", "blue", "green", "orange", "purple", "pink", "yellow", "red", "brown"];
export function guessProperty(name, values) {
  const filled = values.map((v) => String(v ?? "").trim()).filter(Boolean);
  const id = uid();
  if (filled.length && filled.every((v) => /^(yes|no)$/i.test(v))) return { id, name, type: "checkbox" };
  if (filled.length && filled.every((v) => /^-?[\d,]*\.?\d+%?$/.test(v))) return { id, name, type: "number" };
  if (filled.length && filled.every((v) => /^https?:\/\/\S+$/.test(v))) return { id, name, type: "url" };
  if (filled.length && filled.every((v) => /^\d{4}-\d{2}-\d{2}$/.test(v) || notionDate(v))) return { id, name, type: "date" };
  // multi-select: comma-separated short tags drawn from a small vocabulary
  const tokens = filled.flatMap((v) => v.split(/,\s*/)).map((x) => x.trim()).filter(Boolean);
  const vocab = [...new Set(tokens)];
  if (filled.some((v) => v.includes(",")) && tokens.length >= 3 && vocab.length <= Math.max(5, tokens.length / 2) && vocab.length <= 50 && vocab.every((v) => v.length < 40 && !v.includes("("))) {
    return { id, name, type: "multi_select", options: vocab.map((v, i) => ({ id: uid(), name: v, color: COLORS[i % COLORS.length] })) };
  }
  const distinct = [...new Set(filled)];
  if (filled.length >= 2 && distinct.length <= Math.max(3, filled.length / 2) && distinct.length <= 20 && distinct.every((v) => v.length < 60 && !v.includes("("))) {
    return { id, name, type: "select", options: distinct.map((v, i) => ({ id: uid(), name: v, color: COLORS[i % COLORS.length] })) };
  }
  return { id, name, type: "text" };
}

export function cellValue(prop, raw) {
  const v = String(raw ?? "").trim();
  if (!v) return null;
  if (prop.type === "date") return notionDate(v) || v.slice(0, 10);
  if (prop.type === "multi_select") return v.split(/,\s*/).map((x) => prop.options.find((o) => o.name === x.trim())?.id).filter(Boolean);
  if (prop.type === "checkbox") return /^yes$/i.test(v);
  if (prop.type === "number") return Number(v.replace(/[,%]/g, ""));
  if (prop.type === "select" || prop.type === "status") return prop.options.find((o) => o.name === v)?.id ?? null;
  return v;
}

// ---------- headers ----------
export { blockText };
/** Reads consecutive "Key: value" lines from the start of `lines` → { props: [[key, value]], rest }. */
export const parseHeader = parseHeaderLines;
/** A row "has a header" when it starts with at least 2 property lines. */
export const hasHeader = rowHasHeader;

/**
 * Builds a database schema from rows: [{ title, props: [[key, value]] }].
 * Returns { schema, values: [{propId: value}] } with property types guessed from the values.
 */
export function buildSchemaFromRows(rows) {
  const keys = [];
  for (const r of rows) for (const [k] of r.props) if (!keys.includes(k)) keys.push(k);
  const raw = (r, k) => cleanNotionValue(r.props.find(([key]) => key === k)?.[1] ?? "");
  const properties = keys.map((k) => {
    const p = guessProperty(k, rows.map((r) => raw(r, k)));
    if (p.type === "select" && /status|trạng thái|state/i.test(k)) p.type = "status";
    return p;
  });
  const values = rows.map((r) => {
    const out = {};
    properties.forEach((p, i) => {
      const v = cellValue(p, raw(r, keys[i]));
      if (v != null && !(Array.isArray(v) && !v.length)) out[p.id] = v;
    });
    return out;
  });
  const status = properties.find((p) => p.type === "status");
  const project = properties.find((p) => /^(project|projects|dự án)$/i.test(p.name));
  const groupBy = project || status;
  const views = [{ id: uid(), name: t("Table"), type: "table", sorts: [], filters: [], hidden: [], widths: {}, tableGroup: groupBy ? groupBy.id : null }];
  if (status) views.push({ id: uid(), name: "Board", type: "board", sorts: [], filters: [], hidden: [], groupBy: status.id });
  return { schema: { titleName: t("Name"), properties, views }, values };
}

/**
 * Splits the property header off an already-imported page's content (the header was kept as the first paragraph).
 * Returns { props, content } where content has the header lines removed (an emptied first paragraph is dropped).
 */
export function splitContentHeader(content) {
  const blocks = Array.isArray(content) ? content : [];
  const { props, first, rest } = contentHeader(blocks);
  if (!hasHeader(props)) return { props: [], content: blocks };
  const remaining = rest.join("\n").trim();
  const next = [...blocks];
  if (remaining) next[first] = { ...blocks[first], content: [{ type: "text", text: remaining, styles: {} }] };
  else next.splice(first, 1);
  return { props, content: next };
}
