// First "Create family space": carry over what Sofia already saved (seed-data/) and the printable documents (files/).
import { storeSet, migrateDoc } from "./store.js";
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
      await storeSet("files", id, { path, url, name: f.name, type: f.type, size: blob.size, at: new Date().toISOString() });
    } catch (e) { console.warn("seed file failed", f, e); errors.push(f.path); }
    onProgress(++n, total);
  }
  return { imported: total - errors.length, errors };
}
