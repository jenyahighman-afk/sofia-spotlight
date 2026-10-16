// First "Create family space": carry over what Sofia already saved (seed-data/) and the printable documents (files/).
// Later, refreshSeedFiles() swaps the family's copy of a printable for the new one when files/ gets a new version.
import { S, storeSet, storeDel, migrateDoc, settled, setSettings } from "./store.js";
import { media } from "./sync.js";
import { uid } from "./util.js";

export async function seedFamily(onProgress = () => {}){
  const man = await (await fetch("./seed-data/manifest.json", { cache: "no-cache" })).json();
  const total = man.docs.length + man.files.length; let n = 0; const errors = [];
  for (const d of man.docs) {
    try { const raw = await (await fetch("./" + d.path, { cache: "no-cache" })).json(); await storeSet(d.col, d.id, migrateDoc(d.col, d.id, raw), { preserveTime: true }); }
    catch (e) { console.warn("seed doc failed", d, e); errors.push(d.path); }
    onProgress(++n, total);
  }
  for (const f of man.files) {
    try {
      const blob = await (await fetch("./" + f.path)).blob(); const id = uid();
      const { path, url } = await media.upload("files", id, blob, { contentType: f.type, name: f.name });
      await storeSet("files", id, { path, url, name: f.name, type: f.type, size: blob.size, at: new Date().toISOString(), ...(f.rev ? { seedRev: f.rev } : {}) });
    } catch (e) { console.warn("seed file failed", f, e); errors.push(f.path); }
    onProgress(++n, total);
  }
  return { imported: total - errors.length, errors };
}

// Pure: what to do about each built-in file (manifest entries carry name, rev, size). A family file matches by name.
// Already has this rev → nothing. No rev yet but the same size → it is the copy that was seeded: just stamp the rev
// (size stands in for content here: reading the stored bytes back needs the bucket's CORS setup).
// Anything else → replace it. A built-in file the family doesn't have is added once when the manifest marks it with
// `since` (a printable added after the first set) and its name isn't in `seen` (settings.seedSeen: names already added,
// so a file the family deleted is never added back). Files without `since` are never added back either.
export function planFileRefresh(manifestFiles, familyFiles, seen = []){
  const stamp = [], replace = [], add = [];
  for (const m of manifestFiles || []) {
    if (!m || !m.rev || !m.name) continue;
    const have = Object.entries(familyFiles || {}).filter(([, f]) => f && f.name === m.name);
    if (!have.length) { if (m.since && !(seen || []).includes(m.name)) add.push(m); continue; }
    if (have.some(([, f]) => f.seedRev === m.rev)) continue;
    if (have.every(([, f]) => !f.seedRev && f.size === m.size)) stamp.push(...have.map(([id]) => ({ id, rev: m.rev })));
    else replace.push({ file: m, old: have.map(([id]) => id) });
  }
  return { stamp, replace, add };
}
export const seedFileId = (rev) => "f-" + rev;
async function sha12(blob){ const buf = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()); return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 12); }

// Runs once per app open, after the cloud has confirmed the files. The new copy goes to a new path (so no phone keeps a
// cached old one), then the old record and its stored file are removed. The download is checked against the manifest's
// rev first: a web cache still serving the old file must not be uploaded as the new one. Two phones doing it at once
// write the same id and path. Returns the names that were replaced.
let refreshDone = false;
export async function refreshSeedFiles(){
  if (refreshDone || !settled("files") || (typeof navigator !== "undefined" && navigator.onLine === false)) return [];
  refreshDone = true; const replaced = [];
  const man = await (await fetch("./seed-data/manifest.json", { cache: "no-cache" })).json();
  const { stamp, replace, add } = planFileRefresh(man.files, S.files, S.settings.seedSeen);
  for (const { id, rev } of stamp) await storeSet("files", id, { ...S.files[id], seedRev: rev }, { preserveTime: true });
  for (const file of add) {
    const blob = await (await fetch("./" + file.path, { cache: "no-cache" })).blob();
    if (await sha12(blob) !== file.rev) { console.warn("add skipped, download doesn't match the manifest yet", file.name); continue; }
    const id = seedFileId(file.rev);
    const { path, url } = await media.upload("files", id, blob, { contentType: file.type, name: file.name });
    await storeSet("files", id, { path, url, name: file.name, type: file.type, size: blob.size, at: new Date().toISOString(), seedRev: file.rev });
    await setSettings({ seedSeen: [...new Set([...(S.settings.seedSeen || []), file.name])] }); replaced.push(file.name);
  }
  for (const { file, old } of replace) {
    const blob = await (await fetch("./" + file.path, { cache: "no-cache" })).blob();
    if (await sha12(blob) !== file.rev) { console.warn("refresh skipped, download doesn't match the manifest yet", file.name); continue; }
    const id = seedFileId(file.rev);
    const { path, url } = await media.upload("files", id, blob, { contentType: file.type, name: file.name });
    await storeSet("files", id, { path, url, name: file.name, type: file.type, size: blob.size, at: new Date().toISOString(), seedRev: file.rev });
    for (const oid of old) {
      if (oid === id) continue; const f = S.files[oid]; await storeDel("files", oid);
      if (f && f.path && f.path !== path) { try { await media.remove(f.path); } catch (e) { console.warn("old file not removed", f.path, e); } }
    }
    replaced.push(file.name);
  }
  return replaced;
}
