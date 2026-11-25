// Verifies every t("...") string used in src/ has a translation in each locale, and reports unused keys.
// Usage: node scripts/i18n-check.mjs
import fs from "node:fs";
import path from "node:path";

const SRC = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "src");
const files = fs.readdirSync(SRC, { recursive: true }).filter((f) => /\.(jsx?|mjs)$/.test(f) && !f.startsWith("locales"));
const used = new Set();
const re = /\bt\(\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g;
for (const f of files) {
  for (const m of fs.readFileSync(path.join(SRC, f), "utf8").matchAll(re)) {
    used.add(m[1].startsWith("'") ? m[1].slice(1, -1).replace(/\\'/g, "'") : JSON.parse(m[1]));
  }
}
let failed = false;
for (const file of fs.readdirSync(path.join(SRC, "locales"))) {
  const dict = (await import(path.join(SRC, "locales", file))).default;
  const missing = [...used].filter((k) => !(k in dict));
  const unused = Object.keys(dict).filter((k) => !used.has(k));
  console.log(`${file}: ${used.size} strings used, ${missing.length} missing, ${unused.length} unused`);
  missing.forEach((k) => console.log("  MISSING:", JSON.stringify(k)));
  unused.forEach((k) => console.log("  unused: ", JSON.stringify(k)));
  if (missing.length) failed = true;
}
process.exit(failed ? 1 : 0);
