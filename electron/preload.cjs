// Minimal, safe bridge between the page and the desktop app.
// Only exposes what the UI needs; the main process validates every call.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("freenoteDesktop", {
  isDesktop: true,
  /** Open a page of this app's local server in the user's default browser. */
  openInBrowser: (url) => ipcRenderer.invoke("freenote:open-in-browser", String(url || "")),
  /** Open a Notion page (notion.so / notion.site / notion.com only) in the default browser. */
  openNotion: (url) => ipcRenderer.invoke("freenote:open-notion", String(url || "")),
  /** Download the latest release for this OS, install it and restart. Progress via onUpdateProgress. */
  installUpdate: () => ipcRenderer.invoke("freenote:install-update"),
  onUpdateProgress: (cb) => {
    const h = (_e, p) => cb(p);
    ipcRenderer.on("freenote:update-progress", h);
    return () => ipcRenderer.removeListener("freenote:update-progress", h);
  },
  /** Help → "Check for updates…" asks the page to show the update dialog. */
  onShowUpdate: (cb) => {
    const h = () => cb();
    ipcRenderer.on("freenote:show-update", h);
    return () => ipcRenderer.removeListener("freenote:show-update", h);
  },
});
