// Update check against GitHub Releases. The desktop app downloads and installs; the server only reports.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPO = "thanhmam/freenote";
const CHECK_TTL = 24 * 60 * 60 * 1000; // automatic checks hit GitHub at most once a day

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const APP_VERSION = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8")).version;
  } catch {
    return "0.0.0";
  }
})();

/** "0.10.2" > "0.9.9"; ignores a leading "v" and pre-release suffixes. */
export function newerThan(a, b) {
  const p = (v) => String(v).replace(/^v/, "").split("-")[0].split(".").map((n) => parseInt(n, 10) || 0);
  const [x, y] = [p(a), p(b)];
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  return false;
}

export function mountUpdates(app, { getSetting, setSetting }) {
  async function check(force) {
    const cached = JSON.parse(getSetting("update_cache") || "null");
    if (!force && cached && Date.now() - cached.checked_at < CHECK_TTL) return cached;
    let res;
    try {
      res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
        headers: { Accept: "application/vnd.github+json", "User-Agent": "Freenote-update-check" },
        signal: AbortSignal.timeout(20000),
      });
    } catch (e) {
      throw Object.assign(new Error(`Cannot reach GitHub to check for updates: ${e.cause?.code || e.message}`), { status: 502 });
    }
    if (!res.ok) throw Object.assign(new Error(`GitHub answered HTTP ${res.status} while checking for updates`), { status: 502 });
    const r = await res.json();
    const out = {
      checked_at: Date.now(),
      latest: String(r.tag_name || "").replace(/^v/, ""),
      name: r.name || r.tag_name,
      notes: String(r.body || "").slice(0, 8000),
      url: r.html_url,
      published_at: r.published_at,
      assets: (r.assets || [])
        .filter((a) => !/\.(blockmap|yml)$/.test(a.name))
        .map((a) => ({ name: a.name, size: a.size, url: a.browser_download_url })),
    };
    setSetting("update_cache", JSON.stringify(out));
    return out;
  }

  app.get("/api/update", async (req, res, next) => {
    try {
      const auto = getSetting("auto_update_check", "1") === "1";
      if (req.query.auto === "1" && !auto) return res.json({ current: APP_VERSION, disabled: true });
      const info = await check(req.query.force === "1");
      res.json({ current: APP_VERSION, auto, ...info, available: newerThan(info.latest, APP_VERSION) });
    } catch (e) {
      next(e);
    }
  });
  app.post("/api/update/settings", (req, res) => {
    if ("auto" in (req.body || {})) setSetting("auto_update_check", req.body.auto ? "1" : "0");
    res.json({ ok: true, auto: getSetting("auto_update_check", "1") === "1" });
  });
  app.get("/api/version", (_req, res) => res.json({ version: APP_VERSION, auto: getSetting("auto_update_check", "1") === "1" }));
}
