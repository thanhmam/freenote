// Desktop shell: runs the Frnt server in-process and shows it in a native window.
import { app, BrowserWindow, Menu, shell, dialog, ipcMain } from "electron";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { startServer, defaultDataDir } from "../server/app.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PREFERRED_PORT = 37291; // fixed so browser storage (theme, expanded tree…) persists between launches
const SMOKE = process.env.FRNT_SMOKE === "1"; // CI/self-test: load once, print, quit

let server;
let win;

// Self-test runs in its own profile so it works even while the real app is open
if (SMOKE) app.setPath("userData", path.join(os.tmpdir(), `frnt-smoke-${process.pid}`));
else if (!app.requestSingleInstanceLock()) app.quit();
app.on("second-instance", () => {
  if (win) (win.isMinimized() && win.restore(), win.focus());
});

async function boot() {
  const opts = { dataDir: defaultDataDir(), distDir: path.join(__dirname, "..", "dist"), lang: app.getLocale() };
  try {
    server = await startServer({ ...opts, port: PREFERRED_PORT });
  } catch (e) {
    if (e.code !== "EADDRINUSE") throw e;
    server = await startServer({ ...opts, port: 0 });
  }
}

function createWindow() {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 720,
    minHeight: 480,
    title: "Frnt",
    show: !SMOKE,
    backgroundColor: "#ffffff",
    webPreferences: { contextIsolation: true, sandbox: true, preload: path.join(__dirname, "preload.cjs") },
  });
  win.loadURL(server.url);
  // external links → default browser; internal links stay in the app
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(server.url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (!url.startsWith(server.url)) (e.preventDefault(), shell.openExternal(url));
  });
  if (SMOKE) {
    win.webContents.on("preload-error", (_e, p, err) => console.log("SMOKE preload error:", p, err?.message));
    win.webContents.on("did-fail-load", (_e, code, desc, url) => console.log("SMOKE load failed:", code, desc, url));
    win.webContents.on("render-process-gone", (_e, d) => console.log("SMOKE renderer gone:", d.reason));
    setTimeout(() => (console.log("SMOKE FAILED: timeout, url=" + win.webContents.getURL()), app.exit(1)), 20000);
    win.webContents.on("did-finish-load", async () => {
      await new Promise((r) => setTimeout(r, 1500));
      try {
      const js = (code) =>
        Promise.race([win.webContents.executeJavaScript(code), new Promise((_, rej) => setTimeout(() => rej(new Error("timeout: " + code)), 5000))]);
      const parts = [
        await js("document.querySelector('.ws')?.textContent + ' | pages: ' + document.querySelectorAll('.tree-row').length"),
        "bridge: " + (await js("window.frntDesktop?.isDesktop === true")),
        "button: " + (await js("[...document.querySelectorAll('.sb-link')].some((b) => /browser|trình duyệt/i.test(b.textContent))")),
        "open(own page): " + (await js("window.frntDesktop.openInBrowser(location.origin + '/#/p/x')")),
        "open(evil): " + (await js("window.frntDesktop.openInBrowser('https://evil.example/')")),
      ];
      const title = parts.join(" | ");
      console.log("SMOKE OK:", title, "| data:", server.dataDir);
      } catch (e) {
        console.log("SMOKE FAILED:", e?.message || e);
        process.exitCode = 1;
      }
      app.quit();
    });
  }
  win.on("closed", () => (win = null));
}

function buildMenu() {
  const isMac = process.platform === "darwin";
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      ...(isMac ? [{ role: "appMenu" }] : []),
      { role: "fileMenu" },
      { role: "editMenu" },
      {
        label: "View",
        submenu: [{ role: "reload" }, { role: "toggleDevTools" }, { type: "separator" }, { role: "resetZoom" }, { role: "zoomIn" }, { role: "zoomOut" }, { type: "separator" }, { role: "togglefullscreen" }],
      },
      { role: "windowMenu" },
      {
        role: "help",
        submenu: [
          { label: app.getLocale().startsWith("vi") ? "Mở trong trình duyệt" : "Open in browser", click: () => shell.openExternal(server.url) },
          { label: app.getLocale().startsWith("vi") ? "Mở thư mục dữ liệu" : "Open data folder", click: () => shell.openPath(server.dataDir) },
          { label: "GitHub", click: () => shell.openExternal("https://github.com/thanhmam/frnt-notes") },
        ],
      },
    ])
  );
}

app.whenReady().then(async () => {
  try {
    await boot();
  } catch (e) {
    dialog.showErrorBox("Frnt could not start", String(e?.stack || e));
    app.quit();
    return;
  }
  // "Open in browser": only URLs served by this app's own local server are allowed
  ipcMain.handle("frnt:open-in-browser", (_e, url) => {
    const target = url && url.startsWith(server.url + "/") ? url : server.url;
    if (!SMOKE) shell.openExternal(target);
    return target;
  });
  buildMenu();
  createWindow();
  app.on("activate", () => !win && createWindow());
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin" || SMOKE) app.quit();
});
app.on("before-quit", () => server?.close());
