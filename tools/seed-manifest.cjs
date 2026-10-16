// Regenerates seed-data/manifest.json from what's in seed-data/ and files/. Run after adding, removing or replacing seed files:
//   node tools/seed-manifest.cjs
// Each file gets its size and `rev` (first 12 hex of its SHA-256). A changed rev is what makes the app swap the family's
// copy in "My files" for the new one (js/seed.js refreshSeedFiles).
const fs = require("fs"); const path = require("path"); const crypto = require("crypto");
const ROOT = path.join(__dirname, "..");
const TYPES = { ".pdf": "application/pdf", ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".txt": "text/plain", ".md": "text/markdown", ".csv": "text/csv", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg" };
const docs = [];
for (const col of fs.readdirSync(path.join(ROOT, "seed-data"), { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name).sort()) {
  for (const f of fs.readdirSync(path.join(ROOT, "seed-data", col)).filter(f => f.endsWith(".json")).sort()) {
    docs.push({ col, id: f.replace(/\.json$/, ""), path: `seed-data/${col}/${f}` });
  }
}
// `since`: the app version a printable first appeared in. Kept from the previous manifest; a name not in it gets the
// current version. A file with `since` is added once to a family that doesn't have it (js/seed.js refreshSeedFiles);
// files without it (the original set) are only ever replaced, never added back.
let prev = {}; try { prev = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(ROOT, "seed-data", "manifest.json"), "utf8")).files.map(f => [f.name, f.since])); } catch (e) {}
const version = /APP_VERSION = "([^"]+)"/.exec(fs.readFileSync(path.join(ROOT, "js", "version.js"), "utf8"))[1];
const files = fs.readdirSync(path.join(ROOT, "files")).filter(f => !f.startsWith(".")).sort().map(name => {
  const buf = fs.readFileSync(path.join(ROOT, "files", name)); const since = name in prev ? prev[name] : version;
  return { name, path: `files/${name}`, type: TYPES[path.extname(name).toLowerCase()] || "application/octet-stream", size: buf.length, rev: crypto.createHash("sha256").update(buf).digest("hex").slice(0, 12), ...(since ? { since } : {}) };
});
fs.writeFileSync(path.join(ROOT, "seed-data", "manifest.json"), JSON.stringify({ docs, files }, null, 1) + "\n");
console.log(`seed-data/manifest.json: ${docs.length} docs, ${files.length} files`);
