const j = async (r) => {
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
};
const send = (method, url, body) =>
  fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    keepalive: method === "PATCH",
  }).then(j);

export const api = {
  list: () => fetch("/api/pages").then(j),
  trash: () => fetch("/api/trash").then(j),
  get: (id) => fetch(`/api/pages/${id}`).then(j),
  create: (data) => send("POST", "/api/pages", data),
  update: (id, data) => send("PATCH", `/api/pages/${id}`, data),
  duplicate: (id, { template = false, parent_id } = {}) =>
    send("POST", `/api/pages/${id}/duplicate${template ? "?template=1" : ""}`, parent_id !== undefined ? { parent_id } : {}),
  versions: (id) => fetch(`/api/pages/${id}/versions`).then(j),
  version: (vid) => fetch(`/api/versions/${vid}`).then(j),
  restoreVersion: (vid) => send("POST", `/api/versions/${vid}/restore`),
  backlinks: (id) => fetch(`/api/pages/${id}/backlinks`).then(j),
  settings: () => fetch("/api/settings").then(j),
  saveSettings: (data) => send("POST", "/api/settings", data),
  backupNow: () => send("POST", "/api/backup"),
  moveToTrash: (id) => send("POST", `/api/pages/${id}/trash`),
  restore: (id) => send("POST", `/api/pages/${id}/restore`),
  destroy: (id) => send("DELETE", `/api/pages/${id}`),
  search: (q) => fetch(`/api/search?q=${encodeURIComponent(q)}`).then(j),
  importAll: (data) => send("POST", "/api/import", data),
  upload: async (file) => {
    const r = await fetch(`/api/upload?name=${encodeURIComponent(file.name || "file")}`, {
      method: "POST",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    });
    return (await j(r)).url;
  },
};
