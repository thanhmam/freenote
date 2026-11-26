// Desktop shell: runs the Freenote server in-process and shows it in a native window.
import { app, BrowserWindow, Menu, shell, dialog, ipcMain } from "electron";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { spawn, execFileSync } from "node:child_process";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { startServer, defaultDataDir } from "../server/app.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PREFERRED_PORT = 37291; // fixed so browser storage (theme, expanded tree…) persists between launches
const SMOKE = process.env.FREENOTE_SMOKE === "1" || process.env.FRNT_SMOKE === "1"; // CI/self-test: load once, print, quit

let server;
let win;

// Self-test runs in its own profile so it works even while the real app is open
// The app used to be called "Frnt": keep using its profile folder so preferences survive the rename
const legacyProfile = path.join(app.getPath("appData"), "Frnt");
if (!SMOKE && !process.env.DATA_DIR && fs.existsSync(legacyProfile) && !fs.existsSync(app.getPath("userData"))) {
  app.setPath("userData", legacyProfile);
}
if (SMOKE) app.setPath("userData", path.join(os.tmpdir(), `freenote-smoke-${process.pid}`));
// A custom DATA_DIR gets its own browser profile, so a second, separate Freenote can run next to the main one
else if (process.env.DATA_DIR) app.setPath("userData", path.join(process.env.DATA_DIR, "electron-profile"));
if (!SMOKE && !app.requestSingleInstanceLock()) app.quit();
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
    title: "Freenote",
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
        "bridge: " + (await js("window.freenoteDesktop?.isDesktop === true")),
        "button: " + (await js("[...document.querySelectorAll('.sb-link')].some((b) => /browser|trình duyệt/i.test(b.textContent))")),
        "open(own page): " + (await js("window.freenoteDesktop.openInBrowser(location.origin + '/#/p/x')")),
        "open(evil): " + (await js("window.freenoteDesktop.openInBrowser('https://evil.example/')")),
        "notion(ok): " + (await js("window.freenoteDesktop.openNotion('https://www.notion.so/templates/x')")),
        "notion(evil): " + (await js("window.freenoteDesktop.openNotion('https://notion.so.evil.example/x')")),
        "update plan: " + JSON.stringify(await js("window.freenoteDesktop.installUpdate()")),
        "assets: " + JSON.stringify(["darwin/arm64", "darwin/x64", "win32/x64", "linux/x64"].map((pa) => {
          const [pl, ar] = pa.split("/");
          const names = ["Freenote-9.9.9-mac-arm64.zip", "Freenote-9.9.9-mac-x64.zip", "Freenote-9.9.9-mac-arm64.dmg", "Freenote-9.9.9-win-x64.exe", "Freenote-9.9.9-linux-x86_64.AppImage", "Freenote-9.9.9-linux-amd64.deb"].map((name) => ({ name }));
          return pa + "→" + pickAsset(names, pl, ar, pl === "linux" ? "/x.AppImage" : undefined)?.name;
        })),
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

// ---------------- self-update (GitHub Releases) ----------------
// Updates may only come from this project's GitHub releases (old and new repository names)
const RELEASES = ["https://github.com/thanhmam/frnt-notes/releases/download/", "https://github.com/thanhmam/freenote/releases/download/"];

/** Pick the release file for this OS/arch. */
function pickAsset(assets, platform = process.platform, arch = process.arch, appImage = process.env.APPIMAGE) {
  const find = (re) => assets.find((a) => re.test(a.name));
  if (platform === "darwin") return find(new RegExp(`-mac-${arch === "arm64" ? "arm64" : "x64"}\\.zip$`));
  if (platform === "win32") return find(/-win-x64\.exe$/);
  if (platform === "linux") return appImage ? find(/\.AppImage$/) : find(/\.deb$/);
  return null;
}

async function installUpdate() {
  const info = await (await fetch(`${server.url}/api/update`)).json();
  if (info.error) throw new Error(info.error);
  if (!info.available) return { action: "up-to-date", version: info.current };
  const asset = pickAsset(info.assets || []);
  if (!asset) throw new Error(`No installer for ${process.platform}/${process.arch} in release ${info.latest}`);
  if (!RELEASES.some((p) => asset.url.startsWith(p))) throw new Error("Refusing to download an update from an unexpected address");
  if (SMOKE) return { action: "plan", asset: asset.name };

  // 1) download to ~/Downloads with progress
  const file = path.join(app.getPath("downloads"), asset.name);
  const res = await fetch(asset.url);
  if (!res.ok) throw new Error(`Download failed (HTTP ${res.status})`);
  const total = Number(res.headers.get("content-length")) || asset.size || 0;
  let received = 0;
  const body = Readable.fromWeb(res.body);
  body.on("data", (c) => {
    received += c.length;
    win?.webContents.send("freenote:update-progress", { phase: "download", received, total });
  });
  await pipeline(body, fs.createWriteStream(file));
  win?.webContents.send("freenote:update-progress", { phase: "install", received: total, total });

  // 2) install
  if (process.platform === "darwin") {
    const bundle = path.resolve(app.getPath("exe"), "..", "..", "..");
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "freenote-update-"));
    execFileSync("/usr/bin/ditto", ["-x", "-k", file, tmp]);
    const newApp = fs.readdirSync(tmp).map((f) => path.join(tmp, f)).find((f) => f.endsWith(".app"));
    if (!newApp) throw new Error("The downloaded update does not contain an app");
    execFileSync("/usr/bin/codesign", ["--verify", "--deep", "--strict", newApp]); // throws if damaged
    let writable = app.isPackaged && bundle.endsWith(".app");
    try {
      fs.accessSync(path.dirname(bundle), fs.constants.W_OK);
    } catch {
      writable = false;
    }
    if (!writable) {
      shell.showItemInFolder(file);
      return { action: "manual", file };
    }
    // replace the bundle after this process exits, then reopen it.
    // Installs under the new app's name (Freenote.app), removing an old Frnt.app.
    const target = path.join(path.dirname(bundle), path.basename(newApp));
    const script = path.join(tmp, "install.sh");
    fs.writeFileSync(
      script,
      `#!/bin/sh\nwhile kill -0 ${process.pid} 2>/dev/null; do sleep 0.3; done\n` +
        `rm -rf "${bundle}" "${target}" && /usr/bin/ditto "${newApp}" "${target}" && open "${target}"\n`
    );
    renamingOnQuit = true;
    spawn("/bin/sh", [script], { detached: true, stdio: "ignore" }).unref();
    setTimeout(() => app.quit(), 600);
    return { action: "restarting", version: info.latest };
  }
  if (process.platform === "win32") {
    await shell.openPath(file); // NSIS installer upgrades in place
    setTimeout(() => app.quit(), 1500);
    return { action: "installer", version: info.latest };
  }
  if (process.env.APPIMAGE) {
    fs.chmodSync(file, 0o755);
    fs.renameSync(file, process.env.APPIMAGE);
    app.relaunch({ execPath: process.env.APPIMAGE });
    setTimeout(() => app.exit(0), 600);
    return { action: "restarting", version: info.latest };
  }
  await shell.openPath(file); // .deb → system software installer
  return { action: "installer", version: info.latest };
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
          { label: app.getLocale().startsWith("vi") ? "Kiểm tra cập nhật…" : "Check for updates…", click: () => win?.webContents.send("freenote:show-update") },
          { label: app.getLocale().startsWith("vi") ? "Mở trong trình duyệt" : "Open in browser", click: () => shell.openExternal(server.url) },
          { label: app.getLocale().startsWith("vi") ? "Mở thư mục dữ liệu" : "Open data folder", click: () => shell.openPath(server.dataDir) },
          { label: "GitHub", click: () => shell.openExternal("https://github.com/thanhmam/freenote") },
        ],
      },
    ])
  );
}

app.whenReady().then(async () => {
  try {
    await boot();
  } catch (e) {
    dialog.showErrorBox("Freenote could not start", String(e?.stack || e));
    app.quit();
    return;
  }
  // "Open in browser": only URLs served by this app's own local server are allowed
  ipcMain.handle("freenote:open-in-browser", (_e, url) => {
    const target = url && url.startsWith(server.url + "/") ? url : server.url;
    if (!SMOKE) shell.openExternal(target);
    return target;
  });
  ipcMain.handle("freenote:open-notion", (_e, url) => {
    let u;
    try {
      u = new URL(url);
    } catch {
      return false;
    }
    const ok = u.protocol === "https:" && /(^|\.)(notion\.so|notion\.site|notion\.com)$/i.test(u.hostname);
    if (ok && !SMOKE) shell.openExternal(u.href);
    return ok;
  });
  ipcMain.handle("freenote:install-update", async () => {
    try {
      return await installUpdate();
    } catch (e) {
      return { action: "error", error: e.message };
    }
  });
  buildMenu();
  createWindow();
  app.on("activate", () => !win && createWindow());
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin" || SMOKE) app.quit();
});
let renamingOnQuit = false; // set when the updater already installs under the new name
app.on("before-quit", () => server?.close());

// The app used to be called "Frnt": an app bundle still named Frnt.app renames itself to Freenote.app after quitting
app.on("will-quit", () => {
  if (process.platform !== "darwin" || !app.isPackaged || SMOKE || renamingOnQuit) return;
  const bundle = path.resolve(app.getPath("exe"), "..", "..", "..");
  const target = path.join(path.dirname(bundle), "Freenote.app");
  if (path.basename(bundle) !== "Frnt.app" || fs.existsSync(target)) return;
  try {
    fs.accessSync(path.dirname(bundle), fs.constants.W_OK);
    const script = path.join(os.tmpdir(), `freenote-rename-${process.pid}.sh`);
    fs.writeFileSync(script, `#!/bin/sh\nwhile kill -0 ${process.pid} 2>/dev/null; do sleep 0.3; done\nmv "${bundle}" "${target}"\nrm -f "$0"\n`);
    spawn("/bin/sh", [script], { detached: true, stdio: "ignore" }).unref();
  } catch {}
});
