// Pure helpers (no dependencies) to read Notion "Key: value" property headers.
// Shared by the server (repair suggestions) and the app (src/db/propertyHeader.js).
const PROP_LINE = /^([^:\n]{1,60}):[ \t]?(.*)$/;
const NOT_A_KEY = /^(https?|mailto|ftp)$/i;

/** Consecutive "Key: value" lines at the start of `lines` → { props: [[key, value]], rest }. */
export function parseHeaderLines(lines) {
  let i = 0;
  while (i < lines.length && !lines[i].trim()) i++;
  const props = [];
  for (; i < lines.length; i++) {
    const m = lines[i].trim().match(PROP_LINE);
    if (!m || NOT_A_KEY.test(m[1].trim()) || /[#*>`[\]]/.test(m[1])) break;
    props.push([m[1].trim(), m[2].trim()]);
  }
  return { props, rest: lines.slice(i) };
}

/** Text of a BlockNote block's inline content. */
export const blockText = (b) =>
  Array.isArray(b?.content) ? b.content.map((c) => c.text ?? (Array.isArray(c.content) ? c.content.map((x) => x.text || "").join("") : "")).join("") : "";

/** Property header kept in the first non-empty paragraph of a page's content (BlockNote blocks). */
export function contentHeader(content) {
  const blocks = Array.isArray(content) ? content : [];
  const first = blocks.findIndex((b) => b.type === "paragraph" && blockText(b).trim());
  if (first < 0) return { props: [], first: -1, rest: [] };
  const { props, rest } = parseHeaderLines(blockText(blocks[first]).split("\n"));
  return { props, first, rest };
}

/** Rules for "these sub-pages are really database rows". */
export const MIN_ROWS = 2;
export const MIN_SHARE = 0.6;
export const rowHasHeader = (props) => props.length >= 2;
