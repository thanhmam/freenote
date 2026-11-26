// Builds library/index.json from the template packages in library/templates/*.json.
//   npm run library:build          regenerate the index
//   npm run library:build -- --check   fail if the index is out of date (used in CI)
import fs from "node:fs";
import path from "node:path";
import { validatePackage } from "../server/templates.js";

const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "library");
const DIR = path.join(ROOT, "templates");
const check = process.argv.includes("--check");

const entries = [];
const ids = new Map();
let failed = false;
for (const file of fs.readdirSync(DIR).filter((f) => f.endsWith(".json")).sort()) {
  const full = path.join(DIR, file);
  try {
    const pkg = validatePackage(JSON.parse(fs.readFileSync(full, "utf8")));
    if (!/^[a-z0-9][a-z0-9-]*$/.test(pkg.id)) throw new Error(`id "${pkg.id}" must be lowercase letters, digits and dashes`);
    if (ids.has(pkg.id)) throw new Error(`duplicate id "${pkg.id}" (also in ${ids.get(pkg.id)})`);
    ids.set(pkg.id, file);
    for (const k of ["title", "description", "category", "lang", "updated"]) if (!pkg[k]) throw new Error(`missing "${k}"`);
    entries.push({
      id: pkg.id,
      file: `templates/${file}`,
      title: pkg.title,
      description: pkg.description,
      category: pkg.category,
      lang: pkg.lang,
      icon: pkg.icon || "📄",
      author: pkg.author || "",
      updated: pkg.updated,
      pages: pkg.pages.filter((p) => p.kind !== "database").length,
      databases: pkg.pages.filter((p) => p.kind === "database").length,
      size: fs.statSync(full).size,
    });
  } catch (e) {
    console.error(`✗ ${file}: ${e.message}`);
    failed = true;
  }
}
if (failed) process.exit(1);

// Top Notion templates (hand-edited list of links to Notion's gallery)
const picksFile = path.join(ROOT, "notion-picks.json");
if (fs.existsSync(picksFile)) {
  try {
    const picks = JSON.parse(fs.readFileSync(picksFile, "utf8"));
    const seen = new Set();
    for (const t of picks.templates || []) {
      if (!/^https:\/\/www\.notion\.com\/templates\/[\w-]+$/.test(t.url || "")) throw new Error(`${t.id}: url must be https://www.notion.com/templates/<slug>`);
      if (seen.has(t.id)) throw new Error(`duplicate id ${t.id}`);
      seen.add(t.id);
      if (!t.title?.en || !t.description?.en) throw new Error(`${t.id}: needs title.en and description.en`);
    }
    console.log(`✓ notion-picks.json: ${seen.size} links`);
  } catch (e) {
    console.error(`✗ notion-picks.json: ${e.message}`);
    process.exit(1);
  }
}

entries.sort((a, b) => a.category.localeCompare(b.category) || a.title.localeCompare(b.title));
const index = { name: "Frnt Template Library", format: 1, templates: entries };
const out = JSON.stringify(index, null, 2) + "\n";
const target = path.join(ROOT, "index.json");
if (check) {
  const current = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : "";
  if (current !== out) {
    console.error("✗ library/index.json is out of date. Run: npm run library:build");
    process.exit(1);
  }
  console.log(`✓ library index up to date (${entries.length} templates)`);
} else {
  fs.writeFileSync(target, out);
  console.log(`✓ library/index.json: ${entries.length} templates`);
  for (const e of entries) console.log(`  ${e.icon} [${e.lang}] ${e.category} / ${e.title}  (${e.pages} pages, ${e.databases} db, ${Math.round(e.size / 1024)} KB)`);
}
