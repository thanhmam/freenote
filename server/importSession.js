// Server side of the Notion/zip import.
// The browser streams the .zip to disk (no size limit, nothing held in memory), the server extracts it
// into a temporary "session" folder, and the browser then reads files one by one and asks the server to
// copy attachments straight into uploads/. Large exports (hundreds of MB, thousands of pages) stay cheap.
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { pipeline } from "node:stream/promises";
import yauzl from "yauzl";

const openZip = (file) =>
  new Promise((resolve, reject) =>
    yauzl.open(file, { lazyEntries: true, autoClose: true, strictFileNames: false, validateEntrySizes: true }, (e, z) => (e ? reject(e) : resolve(z)))
  );

/** Normalise a zip entry name into a safe relative POSIX path (no "..", no absolute paths). */
function safeRel(name) {
  const parts = String(name).replace(/\\/g, "/").split("/").filter((s) => s && s !== ".");
  if (parts.some((s) => s === "..")) return null;
  return parts.join("/");
}

async function extractZip(zipPath, destRoot, prefix, files, depth, displayName = path.basename(zipPath)) {
  let zip;
  try {
    zip = await openZip(zipPath);
  } catch (e) {
    throw Object.assign(new Error(`Cannot open "${displayName}" as a zip file (${e.message.replace(/\.+$/, "")}). The file may be incomplete or damaged; try downloading the export from Notion again.`), { status: 400 });
  }
  await new Promise((resolve, reject) => {
    zip.on("error", reject);
    zip.on("end", resolve);
    zip.on("entry", (entry) => {
      const rel = safeRel(path.posix.join(prefix, entry.fileName));
      if (!rel || entry.fileName.endsWith("/") || rel.startsWith("__MACOSX/") || /(^|\/)\._/.test(rel) || rel.endsWith(".DS_Store")) {
        return zip.readEntry();
      }
      const out = path.join(destRoot, rel);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      zip.openReadStream(entry, async (err, rs) => {
        try {
          if (err) throw err;
          await pipeline(rs, fs.createWriteStream(out));
          if (/\.zip$/i.test(rel) && depth < 3) {
            // Notion splits big exports into nested "Part-N.zip" files: merge their content at the same level
            await extractZip(out, destRoot, path.posix.dirname(rel) === "." ? "" : path.posix.dirname(rel), files, depth + 1);
            fs.rmSync(out, { force: true });
          } else {
            files.push({ path: rel, size: entry.uncompressedSize });
          }
          zip.readEntry();
        } catch (e) {
          zip.close();
          reject(new Error(`Failed to extract "${rel}": ${e.message}`));
        }
      });
    });
    zip.readEntry();
  });
}

export function mountImport(app, { dataDir, uploadDir }) {
  const TMP = path.join(dataDir, "import-tmp");
  fs.rmSync(TMP, { recursive: true, force: true }); // leftovers from an interrupted import
  fs.mkdirSync(TMP, { recursive: true });

  const sessionDir = (sid) => {
    if (!/^[0-9a-f-]{36}$/.test(sid)) throw Object.assign(new Error("Invalid import session"), { status: 400 });
    const d = path.join(TMP, sid);
    if (!fs.existsSync(d)) throw Object.assign(new Error("Import session expired. Please start the import again."), { status: 404 });
    return d;
  };
  const fileIn = (dir, rel) => {
    const r = safeRel(rel);
    if (!r) throw Object.assign(new Error(`Invalid path: ${rel}`), { status: 400 });
    const full = path.join(dir, r);
    if (!fs.existsSync(full)) throw Object.assign(new Error(`File not found in export: ${r}`), { status: 404 });
    return full;
  };

  // 1) upload + extract
  app.post("/api/import/upload", async (req, res, next) => {
    const sid = randomUUID();
    const dir = path.join(TMP, sid);
    const zipPath = dir + ".zip";
    try {
      fs.mkdirSync(dir, { recursive: true });
      await pipeline(req, fs.createWriteStream(zipPath));
      const size = fs.statSync(zipPath).size;
      if (!size) throw Object.assign(new Error("The uploaded file is empty."), { status: 400 });
      const files = [];
      await extractZip(zipPath, dir, "", files, 0, String(req.query.name || "upload.zip"));
      res.json({ sid, files, zipSize: size });
    } catch (e) {
      fs.rmSync(dir, { recursive: true, force: true });
      next(e);
    } finally {
      fs.rmSync(zipPath, { force: true });
    }
  });

  // 2) read a file from the session (text files: md / csv)
  app.get("/api/import/:sid/file", (req, res, next) => {
    try {
      res.sendFile(fileIn(sessionDir(req.params.sid), String(req.query.path || "")), { dotfiles: "allow" });
    } catch (e) {
      next(e);
    }
  });

  // 3) copy attachments (images, pdf…) from the session into uploads/
  app.post("/api/import/:sid/attach", (req, res, next) => {
    try {
      const dir = sessionDir(req.params.sid);
      const out = {};
      for (const rel of req.body?.paths || []) {
        try {
          const src = fileIn(dir, rel);
          const ext = path.extname(src).toLowerCase().replace(/[^.a-z0-9]/g, "");
          const name = `${randomUUID()}${ext}`;
          fs.copyFileSync(src, path.join(uploadDir, name));
          out[rel] = { url: `/uploads/${name}` };
        } catch (e) {
          out[rel] = { error: e.message };
        }
      }
      res.json(out);
    } catch (e) {
      next(e);
    }
  });

  // 4) cleanup
  app.delete("/api/import/:sid", (req, res) => {
    if (/^[0-9a-f-]{36}$/.test(req.params.sid)) fs.rmSync(path.join(TMP, req.params.sid), { recursive: true, force: true });
    res.json({ ok: true });
  });
}
