// Prints the CHANGELOG.md section for a version (default: package.json version).
//   node scripts/release-notes.mjs 0.6.1
// Exits with an error if the section is missing or empty, so a release can't ship without notes.
import fs from "node:fs";
import path from "node:path";

const root = path.join(path.dirname(new URL(import.meta.url).pathname), "..");
const version = (process.argv[2] || JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version).replace(/^v/, "");
const md = fs.readFileSync(path.join(root, "CHANGELOG.md"), "utf8");
const start = md.search(new RegExp(`^## \\[${version.replace(/\./g, "\\.")}\\]`, "m"));
if (start < 0) {
  console.error(`✗ CHANGELOG.md has no "## [${version}]" section. Add one before releasing.`);
  process.exit(1);
}
const rest = md.slice(start).split("\n").slice(1);
const end = rest.findIndex((l) => /^## \[/.test(l) || /^\[[^\]]+\]: /.test(l));
const body = rest.slice(0, end < 0 ? undefined : end).join("\n").trim();
if (!body) {
  console.error(`✗ CHANGELOG.md section for ${version} is empty.`);
  process.exit(1);
}
console.log(body + `\n\n**Full changelog:** https://github.com/thanhmam/freenote/blob/main/CHANGELOG.md`);
