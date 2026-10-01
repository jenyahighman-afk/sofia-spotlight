// Demo pictures for practice moves: replace the animated dancer with a photo or clip of Sofia doing the move (kept in the
// family space, hidden from the photo grid, in backups) or a web link. settings.demos[itemId] = { kind, photoId?, url, name, at }.
import { $, esc, toast, uid, expose, todayStr } from "./util.js";
import { S, storeSet, storeDel, setSettings } from "./store.js";
import { media, friendlyError } from "./sync.js";
import { resizeImage, VIDEO_MAX_BYTES } from "./media.js";

const MEDIA_RE = /\.(jpe?g|png|gif|webp|mp4|m4v|mov|webm)(\?.*)?$/i;
export const demoFor = (itemId) => (S.settings.demos || {})[itemId] || null;
export function demoKindForUrl(url){ const u = String(url || ""); if (/\.(jpe?g|png|gif|webp)(\?.*)?$/i.test(u)) return "photo"; if (/\.(mp4|m4v|mov|webm)(\?.*)?$/i.test(u)) return "video"; return "link"; }
// HTML for a demo, sized like the dancer box. Returns "" when there is none (caller shows the dancer).
export function demoHtml(d){
  if (!d) return "";
  if (d.kind === "photo") return `<img class="demo-media" src="${esc(d.url)}" alt="">`;
  if (d.kind === "video") return `<video class="demo-media" src="${esc(d.url)}" autoplay muted loop playsinline></video>`;
  return `<a class="demo-link" href="${esc(d.url)}" target="_blank" rel="noopener">▶ Open the clip</a>`;
}
async function setDemo(itemId, d){ await setSettings({ demos: { ...(S.settings.demos || {}), [itemId]: d } }); }
export async function clearDemo(itemId){
  const d = demoFor(itemId); const demos = { ...(S.settings.demos || {}) }; delete demos[itemId]; await setSettings({ demos });
  if (d && d.photoId && S.photos[d.photoId]) { const p = S.photos[d.photoId]; await storeDel("photos", d.photoId); if (p.path) { try { await media.remove(p.path); } catch (e) { console.warn(e); } } }
}
export async function uploadDemo(itemId, file, label){
  const id = uid(); let rec;
  if (file.type.startsWith("video/")) { if (file.size > VIDEO_MAX_BYTES) throw new Error("Clips up to 50 MB — keep it short"); const up = await media.upload("videos", id, file, { contentType: file.type, name: file.name }); rec = { kind: "video", path: up.path, url: up.url, size: file.size }; }
  else { const { blob, w, h } = await resizeImage(file, 1200); const up = await media.upload("photos", id, blob, { contentType: "image/jpeg", name: file.name }); rec = { path: up.path, url: up.url, w, h, size: blob.size }; }
  await clearDemo(itemId);
  await storeSet("photos", id, { ...rec, cap: label || itemId, dance: "", demo: itemId, at: new Date().toISOString() });
  await setDemo(itemId, { kind: rec.kind || "photo", photoId: id, url: rec.url, name: file.name, at: todayStr() });
}
export async function linkDemo(itemId, url){ const u = String(url || "").trim(); if (!/^https?:\/\//i.test(u)) throw new Error("Paste a link that starts with http"); await clearDemo(itemId); await setDemo(itemId, { kind: demoKindForUrl(u), url: u, name: u.slice(0, 80), at: todayStr() }); }

// ---- sheet ----
let target = null, targetLabel = "";
export function openDemoSheet(itemId, label){
  target = itemId; targetLabel = label || itemId; const d = demoFor(itemId);
  $("#demoTitle").textContent = "Picture for: " + label;
  $("#demoBody").innerHTML = `${d ? `<div class="demo-now">${demoHtml(d)}</div><p class="small muted">Now: ${esc(d.name || d.kind)}</p>` : `<p class="small muted">Right now the dancer shows this move.</p>`}
    <div class="coach-pick"><label class="btn coral big-btn" for="demoFile">🎥 Record or pick a photo / clip</label><input type="file" id="demoFile" accept="image/*,video/*" capture="environment" hidden>
    <div class="row"><input type="url" id="demoUrl" placeholder="Paste a web link"><button class="btn sm" onclick="demoLink()">Use</button></div>
    ${d ? `<button class="btn ghost" onclick="demoClear()">Back to the dancer</button>` : ""}</div>
    <p class="small muted" style="margin-top:8px">Clips and photos stay in the family space and only show here. Links to a video or picture file play inline; other links open in the browser.</p>`;
  $("#demoFile").onchange = async (e) => { const f = e.target.files[0]; e.target.value = ""; if (!f) return; try { toast("Saving…", 6000); await uploadDemo(target, f, targetLabel); toast("Picture set ✓"); closeDemoSheet(); } catch (err) { console.warn(err); toast(err.message && !err.code ? err.message : "Upload failed: " + friendlyError(err), 3500); } };
  $("#demo").hidden = false; document.body.classList.add("modal");
}
export function closeDemoSheet(){ $("#demo").hidden = true; document.body.classList.remove("modal"); document.dispatchEvent(new CustomEvent("demochanged")); }
async function link(){ try { await linkDemo(target, $("#demoUrl").value); toast("Link set ✓"); closeDemoSheet(); } catch (e) { toast(e.message || "Couldn't use that link", 3000); } }
async function clear(){ await clearDemo(target); toast("Back to the dancer"); closeDemoSheet(); }
export function initDemos(){ $("#demoClose").onclick = closeDemoSheet; $("#demo").addEventListener("click", e => { if (e.target === $("#demo")) closeDemoSheet(); }); }
expose({ openDemoSheet, demoLink: link, demoClear: clear });
