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

export const pageTitle = (p) => (p?.title?.trim() ? p.title : "Untitled");

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
  if (s < 60) return "vừa xong";
  if (s < 3600) return `${Math.floor(s / 60)} phút trước`;
  if (s < 86400) return `${Math.floor(s / 3600)} giờ trước`;
  return new Date(ts).toLocaleDateString("vi-VN");
}
