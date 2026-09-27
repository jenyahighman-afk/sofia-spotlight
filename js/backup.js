// Backup: one .zip with every collection as JSON plus every photo/file/music/video. Import merges by record id, newer wins.
import { S, COLLECTIONS, SCHEMA_VERSION, migrateDoc, docTime, storeSet } from "./store.js";
import { media, sync } from "./sync.js";
import { loadScript, saveBlob, todayStr } from "./util.js";

const JSZIP_URL = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
async function jszip(){ await loadScript(JSZIP_URL); return window.JSZip; }

// Every media object referenced by the data, with a way to rewrite its location.
function mediaRefs(){
  const out = [];
  for (const [id, p] of Object.entries(S.photos)) if (p.path) out.push({ col: "photos", id, path: p.path, url: p.url });
  for (const [id, f] of Object.entries(S.files)) if (f.path) out.push({ col: "files", id, path: f.path, url: f.url });
  for (const [id, d] of Object.entries(S.dances)) if (d.musicFile && d.musicFile.path) out.push({ col: "dances", id, path: d.musicFile.path, url: d.musicFile.url });
  return out;
}
const pathOf = (col, doc) => col === "dances" ? (doc.musicFile && doc.musicFile.path) : doc.path;
const withPath = (col, doc, path, url) => col === "dances" ? { ...doc, musicFile: { ...doc.musicFile, path, url } } : { ...doc, path, url };
const kindOf = (path) => path.split("/")[2];
const idOf = (path) => path.split("/").slice(3).join("/");

export async function buildBackup(onProgress = () => {}){
  const JSZip = await jszip(); const zip = new JSZip();
  zip.file("manifest.json", JSON.stringify({ app: "sofia-spotlight", version: self.APP_VERSION || "", schema: SCHEMA_VERSION, familyId: sync.familyId, exportedAt: new Date().toISOString() }, null, 1));
  let docs = 0;
  for (const col of COLLECTIONS) { const data = col === "settings" ? { main: S.settings } : S[col]; docs += Object.keys(data).length; zip.file(`data/${col}.json`, JSON.stringify(data, null, 1)); }
  const refs = mediaRefs(); const missing = []; let i = 0;
  for (const r of refs) { try { zip.file("media/" + r.path, await media.download(r.path, r.url)); } catch (e) { console.warn("backup: media missing", r.path, e); missing.push(r.path); } onProgress(++i, refs.length); }
  if (missing.length) zip.file("missing-media.json", JSON.stringify({ note: "These files could not be read back from storage when the backup was made. If every file is listed, the storage bucket is missing its CORS config (see README → Storage CORS).", missing }, null, 1));
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  return { blob, docs, media: refs.length - missing.length, missing: missing.length };
}

export async function exportBackup(onProgress){
  const r = await buildBackup(onProgress);
  await saveBlob(r.blob, `spotlight-backup-${todayStr()}.zip`);
  return r;
}

// Merge a backup into the current family space. A record is written when it's missing locally or the backup's copy is newer.
// Media that lived under another family space is re-uploaded from the zip into this one.
export async function importBackup(file, onProgress = () => {}){
  const JSZip = await jszip(); const zip = await JSZip.loadAsync(file);
  const manFile = zip.file("manifest.json"); if (!manFile) throw new Error("That zip isn't a Spotlight backup.");
  const manifest = JSON.parse(await manFile.async("string"));
  const result = { added: 0, updated: 0, skipped: 0, uploaded: 0, failed: 0, manifest };
  const mine = `families/${sync.familyId}/`;
  for (const col of COLLECTIONS) {
    const f = zip.file(`data/${col}.json`); if (!f) continue;
    const incoming = JSON.parse(await f.async("string"));
    for (const [id, raw] of Object.entries(incoming)) {
      let doc = migrateDoc(col, id, raw);
      const local = col === "settings" ? (id === "main" && Object.keys(S.settings).length ? S.settings : null) : S[col][id];
      if (local && docTime(local) >= docTime(doc)) { result.skipped++; continue; }
      const p = pathOf(col, doc);
      if (p && !p.startsWith(mine)) {
        const entry = zip.file("media/" + p);
        if (entry) { try { const blob = await entry.async("blob"); const up = await media.upload(kindOf(p), idOf(p), blob, { contentType: doc.type || (doc.musicFile && doc.musicFile.type) || blob.type }); doc = withPath(col, doc, up.path, up.url); result.uploaded++; } catch (e) { console.warn("import: upload failed", p, e); result.failed++; } }
      }
      await storeSet(col, id, doc, { preserveTime: true });
      local ? result.updated++ : result.added++;
      onProgress(result);
    }
  }
  return result;
}
