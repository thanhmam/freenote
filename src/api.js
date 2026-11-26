// HTTP client for the local Freenote server. Errors always say which call failed and why.
const KEEPALIVE_MAX = 60 * 1024; // browsers reject keepalive requests with bodies > 64 KB ("Failed to fetch")

async function request(method, url, { body, json = true, headers = {}, keepalive = false } = {}) {
  const init = { method, headers: { ...headers } };
  if (body !== undefined) {
    if (json) {
      init.body = JSON.stringify(body);
      init.headers["Content-Type"] = "application/json";
    } else init.body = body;
  }
  // keepalive lets a save finish while the page unloads, but only small bodies are allowed
  if (keepalive && typeof init.body === "string" && init.body.length < KEEPALIVE_MAX) init.keepalive = true;

  let res;
  try {
    res = await fetch(url, init);
  } catch (e) {
    throw new Error(`Cannot reach the Freenote server (${method} ${url.split("?")[0]}): ${e.message}. Is the app still running?`);
  }
  if (!res.ok) {
    let msg = "";
    try {
      const t = await res.text();
      try {
        msg = JSON.parse(t).error || t;
      } catch {
        msg = t;
      }
    } catch {}
    throw new Error(`${method} ${url.split("?")[0]} failed (HTTP ${res.status}): ${String(msg).slice(0, 300) || res.statusText}`);
  }
  return res.status === 204 ? null : res.json();
}

const get = (url) => request("GET", url);
const send = (method, url, body, opts) => request(method, url, { body, ...opts });

/** Upload with progress (fetch has no upload progress). The file is streamed from disk, not read into memory. */
function uploadWithProgress(url, file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onload = () => {
      let data = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {}
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new Error(`Upload failed (HTTP ${xhr.status}): ${data?.error || xhr.responseText.slice(0, 300) || xhr.statusText}`));
    };
    xhr.onerror = () => reject(new Error("Cannot reach the Freenote server while uploading. Is the app still running?"));
    xhr.send(file);
  });
}

export const api = {
  list: () => get("/api/pages"),
  trash: () => get("/api/trash"),
  get: (id) => get(`/api/pages/${id}`),
  create: (data) => send("POST", "/api/pages", data),
  createMany: (pages) => send("POST", "/api/pages/batch", { pages }),
  update: (id, data) => send("PATCH", `/api/pages/${id}`, data, { keepalive: true }),
  duplicate: (id, { template = false, parent_id } = {}) =>
    send("POST", `/api/pages/${id}/duplicate${template ? "?template=1" : ""}`, parent_id !== undefined ? { parent_id } : {}),
  versions: (id) => get(`/api/pages/${id}/versions`),
  version: (vid) => get(`/api/versions/${vid}`),
  restoreVersion: (vid) => send("POST", `/api/versions/${vid}/restore`),
  backlinks: (id) => get(`/api/pages/${id}/backlinks`),
  settings: () => get("/api/settings"),
  saveSettings: (data) => send("POST", "/api/settings", data),
  backupNow: () => send("POST", "/api/backup"),
  moveToTrash: (id) => send("POST", `/api/pages/${id}/trash`),
  restore: (id) => send("POST", `/api/pages/${id}/restore`),
  destroy: (id) => send("DELETE", `/api/pages/${id}`),
  search: (q) => get(`/api/search?q=${encodeURIComponent(q)}`),
  importAll: (data) => send("POST", "/api/import", data),
  upload: async (file) =>
    (await request("POST", `/api/upload?name=${encodeURIComponent(file.name || "file")}`, {
      body: file,
      json: false,
      headers: { "Content-Type": file.type || "application/octet-stream" },
    })).url,
  // zip import sessions
  importUpload: (file, onProgress) => uploadWithProgress(`/api/import/upload?name=${encodeURIComponent(file.name)}`, file, onProgress),
  importFileText: async (sid, path) => {
    const url = `/api/import/${sid}/file?path=${encodeURIComponent(path)}`;
    let res;
    try {
      res = await fetch(url);
    } catch (e) {
      throw new Error(`Cannot reach the Freenote server while reading "${path}": ${e.message}`);
    }
    if (!res.ok) throw new Error(`Reading "${path}" failed (HTTP ${res.status}): ${(await res.json().catch(() => ({}))).error || res.statusText}`);
    return res.text();
  },
  importAttach: (sid, paths) => send("POST", `/api/import/${sid}/attach`, { paths }),
  importCleanup: (sid) => send("DELETE", `/api/import/${sid}`),
  // repair (imported pages that are really databases)
  repairSuggestions: () => get("/api/repair/suggestions"),
  repairDismiss: (id) => send("POST", "/api/repair/dismiss", { id }),
  // updates
  updateCheck: ({ force = false, auto = false } = {}) => get(`/api/update?${force ? "force=1&" : ""}${auto ? "auto=1" : ""}`),
  updateSettings: (data) => send("POST", "/api/update/settings", data),
  version: () => get("/api/version"),
  // template library
  library: (refresh = false) => get(`/api/library${refresh ? "?refresh=1" : ""}`),
  librarySeen: (templates) => send("POST", "/api/library/seen", { templates: templates.map((t) => ({ id: t.id, updated: t.updated })) }),
  libraryInstall: (id, asTemplate = false) => send("POST", `/api/library/install/${encodeURIComponent(id)}`, { asTemplate }),
  installTemplateFile: (pkg, asTemplate = false) => send("POST", `/api/templates/install${asTemplate ? "?asTemplate=1" : ""}`, pkg),
};
