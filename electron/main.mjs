// Desktop shell: runs the Frnt Notes server in-process and shows it in a native window.
import { app, BrowserWindow, Menu, shell, dialog } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startServer, defaultDataDir } from "../server/app.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PREFERRED_PORT = 37291; // fixed so browser storage (theme, expanded tree…) persists between launches
const SMOKE = process.env.FRNT_SMOKE === "1"; // CI/self-test: load once, print, quit

let server;
let win;

if (!app.requestSingleInstanceLock()) app.quit();
app.on("second-instance", () => {
  if (win) (win.isMinimized() && win.restore(), win.focus());
});

async function boot() {
  const opts = { dataDir: defaultDataDir(), distDir: path.join(__dirname, "..", "dist") };
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
    title: "Frnt Notes",
    show: !SMOKE,
    backgroundColor: "#ffffff",
    webPreferences: { contextIsolation: true, sandbox: true },
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
    win.webContents.on("did-finish-load", async () => {
      await new Promise((r) => setTimeout(r, 1500));
      const title = await win.webContents.executeJavaScript("document.querySelector('.ws')?.textContent + ' | pages: ' + document.querySelectorAll('.tree-row').length");
      console.log("SMOKE OK:", title, "| data:", server.dataDir);
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
          { label: "Mở thư mục dữ liệu", click: () => shell.openPath(server.dataDir) },
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
    dialog.showErrorBox("Frnt Notes không khởi động được", String(e?.stack || e));
    app.quit();
    return;
  }
  buildMenu();
  createWindow();
  app.on("activate", () => !win && createWindow());
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin" || SMOKE) app.quit();
});
app.on("before-quit", () => server?.close());
