import { t, dateLocale } from "./i18n.js";
// Tiny global store so editor blocks (rendered in portals) can read page titles & navigate.
import { useSyncExternalStore } from "react";

let state = { pages: [], byId: {} };
const subs = new Set();

export const store = {
  get: () => state,
  setPages(pages) {
    state = { pages, byId: Object.fromEntries(pages.map((p) => [p.id, p])) };
    subs.forEach((f) => f());
  },
  patch(id, data) {
    store.setPages(state.pages.map((p) => (p.id === id ? { ...p, ...data } : p)));
  },
  subscribe(f) {
    subs.add(f);
    return () => subs.delete(f);
  },
};

export const usePages = () => useSyncExternalStore(store.subscribe, store.get);

export const navigate = (id) => {
  window.location.hash = id ? `#/p/${id}` : "#/";
};

export const pageTitle = (p) => (p?.title?.trim() ? p.title : t("Untitled"));

export function breadcrumbs(id, byId) {
  const out = [];
  let cur = byId[id];
  const seen = new Set();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    out.unshift(cur);
    cur = cur.parent_id ? byId[cur.parent_id] : null;
  }
  return out;
}

export function extractText(node, acc = []) {
  if (Array.isArray(node)) node.forEach((n) => extractText(n, acc));
  else if (node && typeof node === "object") {
    if (typeof node.text === "string") acc.push(node.text);
    for (const k in node) if (k !== "text" && typeof node[k] === "object") extractText(node[k], acc);
  }
  return acc;
}

export function timeAgo(ts) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return t("just now");
  if (s < 3600) return t("{n} min ago", { n: Math.floor(s / 60) });
  if (s < 86400) return t("{n} h ago", { n: Math.floor(s / 3600) });
  return new Date(ts).toLocaleDateString(dateLocale);
}
