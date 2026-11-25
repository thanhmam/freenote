import { api } from "../api.js";
import { store } from "../store.js";
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
  return row.props?.[prop.id];
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
      return { contains: t("Contains"), not_contains: t("Does not contain"), is_empty: t("Is empty"), not_empty: t("Is not empty") };
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
  if (prop.type === "number") {
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
  if (prop.type === "number") return Number(va) - Number(vb);
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
  if (prop.type === "title") {
    store.patch(row.id, { title: value });
    return api.update(row.id, { title: value });
  }
  const props = { ...(row.props || {}), [prop.id]: value };
  store.patch(row.id, { props, updated_at: Date.now() });
  return api.update(row.id, { props });
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
