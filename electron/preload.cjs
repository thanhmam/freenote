// Minimal, safe bridge between the page and the desktop app.
// Only exposes what the UI needs; the main process validates every call.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("frntDesktop", {
  isDesktop: true,
  /** Open a page of this app's local server in the user's default browser. */
  openInBrowser: (url) => ipcRenderer.invoke("frnt:open-in-browser", String(url || "")),
  /** Open a Notion page (notion.so / notion.site / notion.com only) in the default browser. */
  openNotion: (url) => ipcRenderer.invoke("frnt:open-notion", String(url || "")),
});
