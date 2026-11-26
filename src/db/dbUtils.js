import { api } from "../api.js";
import { store, pageTitle } from "../store.js";
import { t, dateLocale } from "../i18n.js";

export const uid = () => crypto.randomUUID().slice(0, 8);

export const TYPES = {
  title: { label: t("Title"), icon: "Aa" },
  text: { label: t("Text"), icon: "≡" },
  number: { label: t("Number"), icon: "#" },
  select: { label: t("Select"), icon: "◉" },
  multi_select: { label: t("Multi-select"), icon: "☰" },
  status: { label: t("Status"), icon: "◐" },
  date: { label: t("Date"), icon: "📅" },
  checkbox: { label: "Checkbox", icon: "☑" },
  url: { label: "URL", icon: "🔗" },
  created_time: { label: t("Created time"), icon: "🕒" },
  updated_time: { label: t("Last edited time"), icon: "🕘" },
  relation: { label: t("Relation"), icon: "↗" },
  rollup: { label: t("Rollup"), icon: "Σ" },
};
export const ADDABLE_TYPES = Object.keys(TYPES).filter((t) => t !== "title");
export const isSelectType = (t) => t === "select" || t === "status" || t === "multi_select";

export const COLORS = ["default", "gray", "brown", "orange", "yellow", "green", "blue", "purple", "pink", "red"];
export const COLOR_NAMES = {
  default: t("Default"), gray: t("Gray"), brown: t("Brown"), orange: t("Orange"), yellow: t("Yellow"),
  green: t("Green"), blue: t("Blue"), purple: t("Purple"), pink: t("Pink"), red: t("Red"),
};
export const randomColor = () => COLORS[1 + Math.floor(Math.random() * (COLORS.length - 1))];

export const TITLE_PROP = (schema) => ({ id: "title", name: schema?.titleName || t("Name"), type: "title" });

export function defaultSchema() {
  const status = {
    id: uid(),
    name: t("Status"),
    type: "status",
    options: [
      { id: uid(), name: t("Not started"), color: "gray" },
      { id: uid(), name: t("In progress"), color: "blue" },
      { id: uid(), name: t("Done"), color: "green" },
    ],
  };
  return {
    titleName: t("Name"),
    properties: [status, { id: uid(), name: "Tags", type: "multi_select", options: [] }, { id: uid(), name: t("Date"), type: "date" }],
    views: [
      { id: uid(), name: t("Table"), type: "table", sorts: [], filters: [], hidden: [], widths: {} },
      { id: uid(), name: "Board", type: "board", sorts: [], filters: [], hidden: [], groupBy: status.id },
    ],
  };
}

export const allProps = (schema) => [TITLE_PROP(schema), ...(schema?.properties || [])];

export function getVal(row, prop) {
  if (prop.type === "title") return row.title || "";
  if (prop.type === "created_time") return row.created_at;
  if (prop.type === "updated_time") return row.updated_at;
  if (prop.type === "relation") return relatedIds(row, prop);
  if (prop.type === "rollup") return computeRollup(row, prop);
  return row.props?.[prop.id];
}

// ---- relations & rollups ----
// relation property: { type: "relation", relation: { dbId, backProp } }   value: [pageId, …] of rows in dbId
//   backProp = id of the matching relation property in the other database (two-way), or null.
// rollup property:   { type: "rollup", rollup: { via: relationPropId, target: propId | "title", fn, match } }
export const targetDb = (prop) => store.get().byId[prop.relation?.dbId];
export function relatedIds(row, prop) {
  const v = row.props?.[prop.id];
  const byId = store.get().byId;
  return (Array.isArray(v) ? v : []).filter((id) => byId[id]);
}
export const relatedTitles = (row, prop) => relatedIds(row, prop).map((id) => pageTitle(store.get().byId[id]));
const schemaOfRow = (row) => store.get().byId[row.parent_id]?.db_schema;

/** Rollup functions available for a target property type. */
export function rollupFns(targetType) {
  const fns = { count: t("Count related pages"), count_values: t("Count values") };
  if (targetType === "number") Object.assign(fns, { sum: t("Sum"), avg: t("Average"), min: t("Min"), max: t("Max") });
  if (targetType === "checkbox") fns.percent_checked = t("Percent checked");
  if (targetType === "select" || targetType === "status") fns.percent_option = t("Percent with a value…");
  if (targetType === "title" || targetType === "text") fns.show = t("Show values");
  return fns;
}
export const rollupIsPercent = (prop) => /^percent/.test(prop.rollup?.fn || "");
export const rollupIsNumber = (prop) => prop.rollup?.fn !== "show";

export function computeRollup(row, prop) {
  const r = prop.rollup || {};
  const via = schemaOfRow(row)?.properties?.find((p) => p.id === r.via && p.type === "relation");
  if (!via) return null;
  const byId = store.get().byId;
  const items = relatedIds(row, via).map((id) => byId[id]);
  const tSchema = targetDb(via)?.db_schema;
  const tProp = r.target === "title" ? TITLE_PROP(tSchema) : tSchema?.properties?.find((p) => p.id === r.target);
  const vals = tProp ? items.map((x) => getVal(x, tProp)) : [];
  const nums = vals.map(Number).filter((n, i) => !isEmpty(vals[i]) && !isNaN(n));
  const pct = (n) => (items.length ? Math.round((n / items.length) * 1000) / 10 : null);
  switch (r.fn) {
    case "count": return items.length;
    case "count_values": return vals.filter((v) => !isEmpty(v)).length;
    case "sum": return nums.reduce((a, b) => a + b, 0);
    case "avg": return nums.length ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100 : null;
    case "min": return nums.length ? Math.min(...nums) : null;
    case "max": return nums.length ? Math.max(...nums) : null;
    case "percent_checked": return pct(vals.filter(Boolean).length);
    case "percent_option": return pct(vals.filter((v) => (Array.isArray(v) ? v.includes(r.match) : v === r.match)).length);
    case "show": {
      if (!tProp) return "";
      if (isSelectType(tProp.type)) return vals.flatMap((v) => (Array.isArray(v) ? v : [v])).map((id) => tProp.options?.find((o) => o.id === id)?.name).filter(Boolean).join(", ");
      return vals.filter((v) => !isEmpty(v)).join(", ");
    }
    default: return null;
  }
}

export const isEmpty = (v) => v == null || v === "" || (Array.isArray(v) && v.length === 0);

export function opsFor(type) {
  switch (type) {
    case "number":
      return { eq: "=", neq: "≠", gt: ">", lt: "<", is_empty: t("Is empty"), not_empty: t("Is not empty") };
    case "select":
    case "status":
      return { is: t("Is"), is_not: t("Is not"), is_empty: t("Is empty"), not_empty: t("Is not empty") };
    case "multi_select":
    case "relation":
      return { contains: t("Contains"), not_contains: t("Does not contain"), is_empty: t("Is empty"), not_empty: t("Is not empty") };
    case "rollup":
      return { eq: "=", neq: "≠", gt: ">", lt: "<", is_empty: t("Is empty"), not_empty: t("Is not empty") };
    case "checkbox":
      return { checked: t("Is checked"), unchecked: t("Is unchecked") };
    case "date":
    case "created_time":
    case "updated_time":
      return { is: t("Is on"), before: t("Before"), after: t("After"), is_empty: t("Is empty"), not_empty: t("Is not empty") };
    default:
      return { contains: t("Contains"), not_contains: t("Does not contain"), is: t("Is"), is_empty: t("Is empty"), not_empty: t("Is not empty") };
  }
}
export const opNeedsValue = (op) => !["is_empty", "not_empty", "checked", "unchecked"].includes(op);

const day = (v) => (v == null || v === "" ? "" : typeof v === "number" ? new Date(v).toISOString().slice(0, 10) : String(v).slice(0, 10));
const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase();

export function matchFilter(row, f, props) {
  const prop = props.find((p) => p.id === f.prop);
  if (!prop) return true;
  const v = getVal(row, prop);
  const fv = f.value;
  switch (f.op) {
    case "is_empty": return isEmpty(v);
    case "not_empty": return !isEmpty(v);
    case "checked": return !!v;
    case "unchecked": return !v;
  }
  if (fv == null || fv === "") return true; // incomplete filter = ignore
  if (prop.type === "relation") {
    const has = (v || []).includes(fv);
    return f.op === "not_contains" ? !has : has;
  }
  if (prop.type === "number" || prop.type === "rollup") {
    const n = Number(v), m = Number(fv);
    if (v == null || v === "") return f.op === "neq";
    return { eq: n === m, neq: n !== m, gt: n > m, lt: n < m }[f.op] ?? true;
  }
  if (["date", "created_time", "updated_time"].includes(prop.type)) {
    const d = day(v);
    if (!d) return false;
    return { is: d === fv, before: d < fv, after: d > fv }[f.op] ?? true;
  }
  if (prop.type === "multi_select") {
    const has = (v || []).includes(fv);
    return f.op === "not_contains" ? !has : has;
  }
  if (prop.type === "select" || prop.type === "status") {
    return f.op === "is_not" ? v !== fv : v === fv;
  }
  const s = norm(v), q = norm(fv);
  return { contains: s.includes(q), not_contains: !s.includes(q), is: s === q }[f.op] ?? true;
}

export function compare(a, b, prop) {
  const va = getVal(a, prop), vb = getVal(b, prop);
  if (isEmpty(va) && isEmpty(vb)) return 0;
  if (isEmpty(va)) return 1; // empties last
  if (isEmpty(vb)) return -1;
  if (isSelectType(prop.type)) {
    const idx = (v) => (prop.options || []).findIndex((o) => o.id === (Array.isArray(v) ? v[0] : v));
    return idx(va) - idx(vb);
  }
  if (prop.type === "number" || (prop.type === "rollup" && typeof va === "number")) return Number(va) - Number(vb);
  if (prop.type === "relation") return relatedTitles(a, prop).join(", ").localeCompare(relatedTitles(b, prop).join(", "), "vi", { numeric: true });
  if (prop.type === "checkbox") return (va ? 1 : 0) - (vb ? 1 : 0);
  if (typeof va === "number") return va - vb;
  return String(va).localeCompare(String(vb), "vi", { numeric: true });
}

export function applyView(rows, view, schema, search = "") {
  const props = allProps(schema);
  let out = rows.filter((r) => (view.filters || []).every((f) => matchFilter(r, f, props)));
  if (search.trim()) {
    const q = norm(search);
    out = out.filter((r) =>
      props.some((p) => {
        const v = getVal(r, p);
        if (p.type === "relation") return relatedTitles(r, p).some((x) => norm(x).includes(q));
        if (isSelectType(p.type)) {
          const ids = Array.isArray(v) ? v : [v];
          return (p.options || []).some((o) => ids.includes(o.id) && norm(o.name).includes(q));
        }
        return typeof v === "string" && norm(v).includes(q);
      })
    );
  }
  const sorts = (view.sorts || []).map((s) => ({ ...s, p: props.find((p) => p.id === s.prop) })).filter((s) => s.p);
  out.sort((a, b) => {
    for (const s of sorts) {
      const ea = isEmpty(getVal(a, s.p)), eb = isEmpty(getVal(b, s.p));
      if (ea !== eb) return ea ? 1 : -1; // empty values always last, regardless of direction
      const c = compare(a, b, s.p);
      if (c) return s.dir === "desc" ? -c : c;
    }
    return a.position - b.position;
  });
  return out;
}

export function formatDate(v) {
  if (v == null || v === "") return "";
  const d = typeof v === "number" ? new Date(v) : new Date(String(v) + (String(v).length === 10 ? "T00:00:00" : ""));
  if (isNaN(d)) return String(v);
  return d.toLocaleDateString(dateLocale, { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ---- persistence helpers ----
export function saveSchema(dbId, schema) {
  store.patch(dbId, { db_schema: schema });
  return api.update(dbId, { db_schema: schema });
}
export function updateView(dbId, schema, viewId, patch) {
  return saveSchema(dbId, { ...schema, views: schema.views.map((v) => (v.id === viewId ? { ...v, ...patch } : v)) });
}
export function updateProp(dbId, schema, propId, patch) {
  if (propId === "title") return saveSchema(dbId, { ...schema, titleName: patch.name ?? schema.titleName });
  return saveSchema(dbId, { ...schema, properties: schema.properties.map((p) => (p.id === propId ? { ...p, ...patch } : p)) });
}
export function setRowValue(row, prop, value) {
  if (prop.type === "relation" && prop.relation?.backProp) syncBackRelation(row, prop, value);
  if (prop.type === "title") {
    store.patch(row.id, { title: value });
    return api.update(row.id, { title: value });
  }
  const props = { ...(row.props || {}), [prop.id]: value };
  store.patch(row.id, { props, updated_at: Date.now() });
  return api.update(row.id, { props });
}
/** Two-way relations: adding/removing a link here updates the matching property on the other side. */
function syncBackRelation(row, prop, value) {
  const back = prop.relation.backProp;
  const before = new Set(Array.isArray(row.props?.[prop.id]) ? row.props[prop.id] : []);
  const after = new Set(Array.isArray(value) ? value : []);
  const byId = store.get().byId;
  const change = (id, add) => {
    const target = byId[id];
    if (!target) return;
    const cur = Array.isArray(target.props?.[back]) ? target.props[back] : [];
    const next = add ? (cur.includes(row.id) ? cur : [...cur, row.id]) : cur.filter((x) => x !== row.id);
    if (next === cur) return;
    const props = { ...(target.props || {}), [back]: next };
    store.patch(id, { props });
    api.update(id, { props });
  };
  after.forEach((id) => !before.has(id) && change(id, true));
  before.forEach((id) => !after.has(id) && change(id, false));
}

export async function createRow(dbId, props = {}, title = "") {
  const row = await api.create({ parent_id: dbId, props, title });
  store.setPages([...store.get().pages, row]);
  return row;
}
export async function createDatabase(parent_id, title = "") {
  const p = await api.create({ parent_id, kind: "database", title, icon: "🗃️", db_schema: defaultSchema() });
  store.setPages(await api.list());
  return p;
}

// ---- grouping (table view) ----
export const GROUPABLE = ["select", "status", "multi_select", "relation", "checkbox", "date", "created_time", "updated_time", "text", "url", "number"];

const monthKey = (v) => {
  if (v == null || v === "") return null;
  const d = typeof v === "number" ? new Date(v) : new Date(String(v).slice(0, 10) + "T00:00:00");
  return isNaN(d) ? null : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const monthLabel = (k) => {
  const [y, m] = k.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(dateLocale, { month: "long", year: "numeric" });
};

/**
 * Split rows into groups for a property. Each group: { key, label, color, rows, prefill }.
 * prefill = the value a new row created inside the group should get (undefined = none).
 */
export function groupRows(rows, prop) {
  const groups = new Map();
  const add = (key, init, row) => {
    if (!groups.has(key)) groups.set(key, { key, rows: [], ...init });
    groups.get(key).rows.push(row);
  };
  const none = { label: t("No {name}", { name: prop.name }), color: "default", prefill: undefined, empty: true };
  const opts = prop.options || [];

  if (isSelectType(prop.type)) {
    // keep option order, empty group first (like Notion)
    add("\u0000none", none, null);
    opts.forEach((o) => add(o.id, { label: o.name, color: o.color, prefill: prop.type === "multi_select" ? [o.id] : o.id }, null));
    for (const g of groups.values()) g.rows = [];
    for (const r of rows) {
      const v = getVal(r, prop);
      const ids = (Array.isArray(v) ? v : v ? [v] : []).filter((id) => opts.some((o) => o.id === id));
      if (!ids.length) groups.get("\u0000none").rows.push(r);
      else ids.forEach((id) => groups.get(id).rows.push(r)); // a multi-select row appears under each of its tags
    }
    return [...groups.values()].filter((g) => g.rows.length || !g.empty);
  }
  if (prop.type === "relation") {
    // one group per related page (in that database's order); a row linked to 2 pages appears in both
    const targets = store.get().pages.filter((p) => p.parent_id === prop.relation?.dbId).sort((a, b) => a.position - b.position);
    add("\u0000none", none, null);
    targets.forEach((p) => add(p.id, { label: pageTitle(p), icon: p.icon || "📄", pageId: p.id, color: "default", prefill: [p.id] }, null));
    for (const g of groups.values()) g.rows = [];
    for (const r of rows) {
      const ids = relatedIds(r, prop).filter((id) => groups.has(id));
      if (!ids.length) groups.get("\u0000none").rows.push(r);
      else ids.forEach((id) => groups.get(id).rows.push(r));
    }
    return [...groups.values()].filter((g) => g.rows.length);
  }
  if (prop.type === "checkbox") {
    for (const r of rows) {
      const v = !!getVal(r, prop);
      add(v ? "1" : "0", { label: v ? t("Checked") : t("Unchecked"), color: v ? "green" : "default", prefill: v }, r);
    }
    return [...groups.values()].sort((a, b) => b.key.localeCompare(a.key));
  }
  if (["date", "created_time", "updated_time"].includes(prop.type)) {
    for (const r of rows) {
      const k = monthKey(getVal(r, prop));
      add(k ?? "\u0000none", k ? { label: monthLabel(k), color: "default" } : none, r);
    }
    return [...groups.values()].sort((a, b) => (a.empty ? -1 : b.empty ? 1 : b.key.localeCompare(a.key)));
  }
  for (const r of rows) {
    const v = getVal(r, prop);
    if (isEmpty(v)) add("\u0000none", none, r);
    else add(String(v), { label: String(v), color: "default", prefill: v }, r);
  }
  return [...groups.values()].sort((a, b) =>
    a.empty ? -1 : b.empty ? 1 : prop.type === "number" ? Number(a.key) - Number(b.key) : a.key.localeCompare(b.key, "vi", { numeric: true })
  );
}

// ---- column calculations (table footer) ----
export function calcsFor(type, prop) {
  if (type === "rollup") return prop && !rollupIsNumber(prop) ? calcsFor("text") : calcsFor("number");
  const base = { count: t("Count all"), unique: t("Count unique values"), empty: t("Count empty"), filled: t("Count not empty"), pct_empty: t("Percent empty"), pct_filled: t("Percent not empty") };
  if (type === "number") return { ...base, sum: t("Sum"), avg: t("Average"), median: t("Median"), min: t("Min"), max: t("Max"), range: t("Range") };
  if (type === "checkbox") return { count: t("Count all"), checked: t("Checked"), unchecked: t("Unchecked"), pct_checked: t("Percent checked") };
  if (["date", "created_time", "updated_time"].includes(type)) return { ...base, earliest: t("Earliest date"), latest: t("Latest date") };
  return base;
}

export function calculate(rows, prop, calc) {
  const vals = rows.map((r) => getVal(r, prop));
  const filled = vals.filter((v) => !isEmpty(v));
  const pct = (n) => (rows.length ? `${Math.round((n / rows.length) * 100)}%` : "0%");
  const nums = filled.map(Number).filter((n) => !isNaN(n)).sort((a, b) => a - b);
  const fmt = (n) => (Number.isInteger(n) ? n.toLocaleString(dateLocale) : n.toLocaleString(dateLocale, { maximumFractionDigits: 2 }));
  const dates = filled.map((v) => (typeof v === "number" ? v : Date.parse(String(v).slice(0, 10)))).filter((n) => !isNaN(n)).sort((a, b) => a - b);
  switch (calc) {
    case "count": return String(rows.length);
    case "unique": return String(new Set(filled.flatMap((v) => (Array.isArray(v) ? v : [JSON.stringify(v)]))).size);
    case "empty": return String(rows.length - filled.length);
    case "filled": return String(filled.length);
    case "pct_empty": return pct(rows.length - filled.length);
    case "pct_filled": return pct(filled.length);
    case "checked": return String(vals.filter(Boolean).length);
    case "unchecked": return String(vals.filter((v) => !v).length);
    case "pct_checked": return pct(vals.filter(Boolean).length);
    case "sum": return fmt(nums.reduce((a, b) => a + b, 0));
    case "avg": return nums.length ? fmt(nums.reduce((a, b) => a + b, 0) / nums.length) : "—";
    case "median": return nums.length ? fmt(nums.length % 2 ? nums[(nums.length - 1) / 2] : (nums[nums.length / 2 - 1] + nums[nums.length / 2]) / 2) : "—";
    case "min": return nums.length ? fmt(nums[0]) : "—";
    case "max": return nums.length ? fmt(nums.at(-1)) : "—";
    case "range": return nums.length ? fmt(nums.at(-1) - nums[0]) : "—";
    case "earliest": return dates.length ? formatDate(dates[0]) : "—";
    case "latest": return dates.length ? formatDate(dates.at(-1)) : "—";
    default: return "";
  }
}
