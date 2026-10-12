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
const files = fs.readdirSync(path.join(ROOT, "files")).filter(f => !f.startsWith(".")).sort().map(name => {
  const buf = fs.readFileSync(path.join(ROOT, "files", name));
  return { name, path: `files/${name}`, type: TYPES[path.extname(name).toLowerCase()] || "application/octet-stream", size: buf.length, rev: crypto.createHash("sha256").update(buf).digest("hex").slice(0, 12) };
});
fs.writeFileSync(path.join(ROOT, "seed-data", "manifest.json"), JSON.stringify({ docs, files }, null, 1) + "\n");
console.log(`seed-data/manifest.json: ${docs.length} docs, ${files.length} files`);
