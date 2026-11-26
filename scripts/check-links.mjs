// Checks that every Notion link the app shows actually opens (HTTP 200).
//   npm run library:links
import fs from "node:fs";
import path from "node:path";

const root = path.join(path.dirname(new URL(import.meta.url).pathname), "..");
const picks = JSON.parse(fs.readFileSync(path.join(root, "library", "notion-picks.json"), "utf8"));
const src = fs.readFileSync(path.join(root, "src", "NotionLinkImport.jsx"), "utf8");
const gallery = src.match(/NOTION_GALLERY = "([^"]+)"/)?.[1];
const urls = [...new Set([gallery, picks.gallery, ...picks.templates.map((t) => t.url)].filter(Boolean))];
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";
let bad = 0;
await Promise.all(
  urls.map(async (u) => {
    let code;
    try {
      code = (await fetch(u, { headers: { "User-Agent": UA }, redirect: "follow", signal: AbortSignal.timeout(20000) })).status;
    } catch (e) {
      code = e.cause?.code || e.message;
    }
    if (code !== 200) bad++;
    console.log(`${code === 200 ? "✓" : "✗"} ${code} ${u}`);
  })
);
console.log(bad ? `✗ ${bad} of ${urls.length} links are broken` : `✓ all ${urls.length} links work`);
process.exit(bad ? 1 : 0);
