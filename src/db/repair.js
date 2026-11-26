// Turning "sub-pages with Notion property lines" into a real database (and back), plus the shared list of
// repair suggestions the app shows (sidebar notice, page banner, import result).
import { useSyncExternalStore } from "react";
import { api } from "../api.js";
import { store, extractText } from "../store.js";
import { splitContentHeader, hasHeader, buildSchemaFromRows } from "./propertyHeader.js";

// ---------- suggestions store ----------
let state = { list: [], loaded: false };
const subs = new Set();
const emit = () => subs.forEach((f) => f());
export const repairStore = {
  get: () => state,
  subscribe: (f) => (subs.add(f), () => subs.delete(f)),
  async refresh() {
    try {
      state = { list: await api.repairSuggestions(), loaded: true };
    } catch {
      state = { ...state, loaded: true };
    }
    emit();
    return state.list;
  },
  async dismiss(id) {
    await api.repairDismiss(id);
    state = { ...state, list: state.list.filter((s) => s.id !== id) };
    emit();
  },
};
export const useRepair = () => useSyncExternalStore(repairStore.subscribe, repairStore.get);

// ---------- analysis & conversion ----------
/** Reads the sub-pages of `pageId` and works out what a database built from their property lines would look like. */
export async function analyze(pageId) {
  const kids = store.get().pages.filter((p) => p.parent_id === pageId).sort((a, b) => a.position - b.position);
  // Was a database before ("Turn into a page"): its schema and row values are still there, just switch back.
  const prev = store.get().byId[pageId]?.db_schema;
  if (prev?.properties) return { rows: kids.map((p) => ({ page: p, title: p.title, props: [] })), withProps: kids.length, ok: kids.length > 0, schema: prev, restore: true };
  const full = await Promise.all(kids.map((k) => api.get(k.id)));
  const rows = full.map((p) => {
    const { props, content } = splitContentHeader(p.content);
    return { page: p, title: p.title, props, content, changed: props.length > 0 };
  });
  const withProps = rows.filter((r) => hasHeader(r.props)).length;
  const { schema, values } = buildSchemaFromRows(rows.map((r) => (hasHeader(r.props) ? r : { ...r, props: [] })));
  return { rows, withProps, ok: rows.length >= 2 && withProps / rows.length >= 0.6, schema, values };
}

/** Converts the page into a database whose rows are its sub-pages. Old content stays in each page's version history. */
export async function convertToDatabase(pageId, analysis) {
  const a = analysis || (await analyze(pageId));
  if (!a.ok) throw new Error("These sub-pages don't look like database rows.");
  if (a.restore) {
    await api.update(pageId, { kind: "database" });
    store.setPages(await api.list());
    return a;
  }
  for (const [i, r] of a.rows.entries()) {
    const patch = { props: a.values[i] };
    if (hasHeader(r.props)) Object.assign(patch, { content: r.content, text: extractText(r.content).join(" ") });
    await api.update(r.page.id, patch);
  }
  await api.update(pageId, { kind: "database", db_schema: a.schema, icon: store.get().byId[pageId]?.icon || "🗃️" });
  store.setPages(await api.list());
  await repairStore.refresh();
  return a;
}

/** Undo: show a database as a normal page again (its rows stay as sub-pages). */
export async function turnIntoPage(dbId) {
  await api.update(dbId, { kind: "page" });
  store.setPages(await api.list());
}
