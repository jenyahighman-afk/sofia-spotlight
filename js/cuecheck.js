// Grown-ups → 🎯 Cue check: play the track with the solo's cue table, nudge any cue ±0.25 s (saved as dances.cueTimes over
// the built-in times), replace a cue's photo with a frame grabbed from a video at the cue time, and import the cue pack
// (the 28 photos, Hannah's clips cNN.m4a, the cue-cards PDF) into the family's Firebase Storage. Nothing here ever goes to
// the public repo. Pure parts up top.
import { $, esc, toast, uid, todayStr, expose } from "./util.js";
import { S, storeSet, dances } from "./store.js";
import { DEFAULT_DANCES } from "./data.js";
import { normalizeCues, cueAt, fmtCueTime, nudgeCue, cueTimesDiff, isCueTable } from "./cues.js";
import { media, friendlyError } from "./sync.js";
import { resizeImage } from "./media.js";
import { trackUrl } from "./track.js";
import { cuePhoto, cueClip, cueRange } from "./cuecards.js";
import { openClip, seekTo } from "./videoframes.js";

export const NUDGE = 0.25, PHOTO_PX = 900, RUNTHROUGH_OFFSET = 4.98;
// Which cue a cue-pack file belongs to: a photo by its exact cue-pack name (01-opening-walk….jpg), a clip by cNN.m4a
// (cut from Hannah's walkthrough on the family computer), the cue-cards PDF by name. Anything else is skipped — the
// old hannah-cues/ files are numbered by clip, not by cue, so they never match.
export function matchPackFile(name, cues){
  const n0 = String(name || "").trim(); const list = normalizeCues(cues);
  const photo = list.find(c => c.photo && c.photo.toLowerCase() === n0.toLowerCase()); if (photo) return { kind: "photo", n: photo.n };
  const m = /^c(\d{1,2})\.(m4a|mp3|aac|wav)$/i.exec(n0); if (m && list.some(c => c.n === +m[1])) return { kind: "clip", n: +m[1] };
  if (/\.pdf$/i.test(n0)) return { kind: "pdf" };
  return null;
}
// Where to grab a cue's photo in a video: its photo moment (else its start) plus where the music starts in the video.
export const frameTime = (c, offset = 0) => Math.max(0, (typeof c.pt === "number" ? c.pt : c.t) + (+offset || 0));

const CK = { cues: [], audio: null, raf: 0, clip: null, offset: RUNTHROUGH_OFFSET, grab: null, busy: false };
const solo = () => dances().find(d => d.id === "solo");
const builtin = () => (DEFAULT_DANCES.find(d => d.id === "solo") || {}).cues || [];
const dirty = () => Object.keys(cueTimesDiff(solo().cues, CK.cues)).length > 0;

export function renderCueCheck(){
  const d = solo(); const box = $("#ckList"); if (!box || !d || !isCueTable(d.cues)) { if (box) box.innerHTML = `<p class="small muted">No cue table for the solo.</p>`; return; }
  if (!CK.cues.length || !dirty()) CK.cues = normalizeCues(d.cues);
  const nudged = Object.keys(d.cueTimes || {}).length;
  $("#ckSource").innerHTML = `Source: <b>${esc(d.cueSource || "")}</b>${nudged ? ` · ${nudged} cue${nudged === 1 ? "" : "s"} nudged here${d.cueCheckedAt ? " (" + esc(d.cueCheckedAt) + ")" : ""}` : ""}`;
  const t = CK.audio ? CK.audio.currentTime : -1; const on = t >= 0 ? cueAt(CK.cues, t).cur : null;
  box.innerHTML = CK.cues.map(c => { const ph = cuePhoto(d, c.n); const moved = Math.abs(c.t - (normalizeCues(builtin()).find(x => x.n === c.n) || c).t) > 1e-6;
    return `<div class="ck-row ${c.trick ? "trick" : ""} ${on && on.n === c.n ? "on" : ""}" data-n="${c.n}">
      <div class="ck-thumb">${ph ? `<img src="${esc(ph)}" alt="" loading="lazy">` : `<span>${c.n}</span>`}</div>
      <div class="grow"><div><b>${c.n}. ${c.trick ? "★ " : ""}${esc(c.move)}</b>${cueClip(d, c.n) ? " 🔊" : ""}</div><div class="small ${moved ? "coral-t" : "muted"}">${cueRange(c)}${moved ? " · moved" : ""}</div></div>
      <div class="ck-btns"><button class="btn sm ghost" onclick="ckNudge(${c.n},-1)" title="0.25 s earlier">−¼</button><button class="btn sm ghost" onclick="ckNudge(${c.n},1)" title="0.25 s later">+¼</button><button class="btn sm" onclick="ckPlay(${c.n})" title="Play from 1 s before">▶</button><button class="btn sm ghost" onclick="ckGrab(${c.n})" title="Photo from the video">📷</button></div>
    </div>${CK.grab && CK.grab.n === c.n ? `<div class="ck-grab" id="ckGrab"></div>` : ""}`; }).join("");
  $("#ckSave").disabled = !dirty(); $("#ckUndo").disabled = !dirty(); $("#ckReset").hidden = !nudged;
  $("#ckOffset").value = CK.offset; $("#ckVideoName").textContent = CK.clip ? "🎞️ " + CK.clip.name : "No video picked";
  if (CK.grab) drawGrab();
}
function nudge(n, dir){ CK.cues = nudgeCue(CK.cues, n, dir * NUDGE); renderCueCheck(); const c = CK.cues.find(x => x.n === n); if (c) play(c.n, true); }
async function save(){ const times = cueTimesDiff(builtin(), CK.cues); await storeSet("dances", "solo", { ...(S.dances.solo || {}), id: "solo", cueTimes: times, cueCheckedAt: todayStr() }); toast("Saved ✓ The player and cue cards use the new times"); CK.cues = []; renderCueCheck(); }
function undo(){ CK.cues = []; renderCueCheck(); }
async function resetAll(){ if (!confirm("Go back to the checked times from the cue pack (Hannah run-through, Oct 25)?")) return; const rest = { ...(S.dances.solo || {}), id: "solo" }; delete rest.cueTimes; delete rest.cueCheckedAt; await storeSet("dances", "solo", rest); CK.cues = []; renderCueCheck(); toast("Back to the checked times"); }

// ---- the track ----
async function ensureAudio(){
  if (CK.audio) return CK.audio; const got = await trackUrl(solo()); if (!got) { toast("Add the solo's music first (Dances → the solo → More ▸)"); return null; }
  const a = new Audio(got.url); a.preload = "auto"; CK.audio = a; a.addEventListener("ended", () => { $("#ckPlay").textContent = "▶"; }); return a;
}
function tick(){ const a = CK.audio; if (!a) return; $("#ckTime").textContent = fmtCueTime(a.currentTime); const { cur } = cueAt(CK.cues, a.currentTime); $("#ckNow").innerHTML = cur ? `${cur.trick ? "★ " : ""}${esc(cur.move)} <span class="muted small">${cueRange(cur)}</span>` : "…";
  document.querySelectorAll("#ckList .ck-row").forEach(r => r.classList.toggle("on", !!cur && +r.dataset.n === cur.n)); if (CK.stopAt && a.currentTime >= CK.stopAt) { a.pause(); CK.stopAt = 0; $("#ckPlay").textContent = "▶"; } if (!a.paused) CK.raf = requestAnimationFrame(tick); }
async function toggle(){ const a = await ensureAudio(); if (!a) return; if (a.paused) { CK.stopAt = 0; await a.play().catch(() => {}); $("#ckPlay").textContent = "❚❚"; cancelAnimationFrame(CK.raf); tick(); } else { a.pause(); $("#ckPlay").textContent = "▶"; } }
async function play(n, short){ const c = CK.cues.find(x => x.n === n); const a = await ensureAudio(); if (!a || !c) return; a.currentTime = Math.max(0, c.t - 1); CK.stopAt = short ? c.t + 1.5 : c.end; await a.play().catch(() => {}); $("#ckPlay").textContent = "❚❚"; cancelAnimationFrame(CK.raf); tick(); }

// ---- photo from a video frame ----
async function pickVideo(file){ if (!file) return; if (CK.clip) CK.clip.close(); CK.clip = null; toast("Opening the video…", 3000); try { const c = await openClip(file); CK.clip = { ...c, name: file.name }; toast("Video ready. Tap 📷 on a cue"); } catch (e) { console.warn(e); toast(e.message || "Couldn't open that video", 3500); } renderCueCheck(); }
function grab(n){ if (!CK.clip) { $("#ckVideoIn").click(); return toast("Pick the run-through video first (the music should start at " + CK.offset + " s)", 3500); } const c = CK.cues.find(x => x.n === n); if (!c) return; CK.grab = { n, t: frameTime(c, CK.offset) }; renderCueCheck(); }
async function drawGrab(){
  const g = CK.grab, box = $("#ckGrab"); if (!g || !box || !CK.clip) return; const v = CK.clip.video;
  box.innerHTML = `<div class="small muted">Frame at ${fmtCueTime(g.t)} in the video…</div>`;
  const ok = await seekTo(v, g.t); if (!ok || !v.videoWidth || CK.grab !== g) { if (CK.grab === g) box.innerHTML = `<p class="small bad">This frame didn't load. Try ±¼ s.</p>${grabBtns()}`; return; }
  const scale = Math.min(1, PHOTO_PX / Math.max(v.videoWidth, v.videoHeight)); const cv = document.createElement("canvas"); cv.width = Math.round(v.videoWidth * scale); cv.height = Math.round(v.videoHeight * scale); cv.getContext("2d").drawImage(v, 0, 0, cv.width, cv.height); g.canvas = cv;
  box.innerHTML = `<img src="${cv.toDataURL("image/jpeg", 0.8)}" alt=""><div class="small muted">${fmtCueTime(g.t)} in the video · cue ${g.n}</div>${grabBtns()}`;
}
const grabBtns = () => `<div class="row"><button class="btn sm ghost" onclick="ckGrabMove(-1)">◀ ¼ s</button><button class="btn sm ghost" onclick="ckGrabMove(1)">¼ s ▶</button><span class="grow"></span><button class="btn sm ghost" onclick="ckGrabCancel()">Cancel</button><button class="btn sm coral" onclick="ckGrabSave()">Use this photo</button></div>`;
function grabMove(dir){ if (!CK.grab) return; CK.grab = { n: CK.grab.n, t: Math.max(0, CK.grab.t + dir * NUDGE) }; drawGrab(); }
function grabCancel(){ CK.grab = null; renderCueCheck(); }
async function grabSave(){
  const g = CK.grab; if (!g || !g.canvas || CK.busy) return; CK.busy = true;
  try { const blob = await new Promise((res, rej) => g.canvas.toBlob(b => b ? res(b) : rej(new Error("Couldn't make the photo")), "image/jpeg", 0.85)); await saveMedia({ [g.n]: { photo: blob } }); CK.grab = null; toast("Photo saved ✓"); }
  catch (e) { console.warn(e); toast("Couldn't save: " + friendlyError(e), 3500); } finally { CK.busy = false; renderCueCheck(); }
}

// ---- uploads ----
// items = { [n]: { photo?: Blob, clip?: Blob } } → uploaded to the family's Storage, then one write of dances.solo.cueMedia.
// The old object of a replaced photo or clip is removed after the write.
async function saveMedia(items, onEach = () => {}){
  const all = { ...((S.dances.solo || {}).cueMedia || {}) }; const old = []; let i = 0;
  for (const [n, it] of Object.entries(items)) {
    const e = { ...(all[n] || {}) };
    if (it.photo) { const { path, url } = await media.upload("photos", "cue-" + n + "-" + uid(), it.photo, { contentType: "image/jpeg", name: "cue-" + n + ".jpg" }); if (e.photo && e.photo.path) old.push(e.photo.path); e.photo = { url, path, at: todayStr() }; }
    if (it.clip) { const { path, url } = await media.upload("music", "clip-" + n + "-" + uid(), it.clip, { contentType: it.clip.type || "audio/mp4", name: "hannah-" + n + ".m4a" }); if (e.clip && e.clip.path) old.push(e.clip.path); e.clip = { url, path }; }
    all[n] = e; onEach(++i);
  }
  await storeSet("dances", "solo", { ...(S.dances.solo || {}), id: "solo", cueMedia: all });
  for (const p of old) { try { await media.remove(p); } catch (e) { console.warn("old cue media not removed", p, e); } }
}
async function importPack(fileList){
  const files = [...fileList]; if (!files.length || CK.busy) return; const cues = solo().cues; const items = {}; const pdfs = []; const skipped = [];
  for (const f of files) { const m = matchPackFile(f.name, cues); if (!m) { skipped.push(f.name); continue; } if (m.kind === "pdf") { pdfs.push(f); continue; } (items[m.n] ||= {})[m.kind] = f; }
  const n = Object.keys(items).length; if (!n && !pdfs.length) return toast("None of those are cue-pack files (photos 01-….jpg, clips c12.m4a, the cue-cards PDF)", 4500);
  CK.busy = true; const st = $("#ckImportStatus");
  try {
    for (const it of Object.values(items)) if (it.photo) it.photo = (await resizeImage(it.photo, PHOTO_PX)).blob;
    await saveMedia(items, (k) => { st.textContent = `Uploading ${k} of ${n}…`; });
    for (const f of pdfs) { if (Object.values(S.files || {}).some(x => x && x.name === f.name)) { skipped.push(f.name + " (already in My files)"); continue; } const id = uid(); const { path, url } = await media.upload("files", id, f, { contentType: "application/pdf", name: f.name }); await storeSet("files", id, { path, url, name: f.name, type: "application/pdf", size: f.size, at: new Date().toISOString() }); }
    const photos = Object.values(items).filter(x => x.photo).length, clips = Object.values(items).filter(x => x.clip).length;
    st.textContent = `Done: ${photos} photo${photos === 1 ? "" : "s"}, ${clips} clip${clips === 1 ? "" : "s"}${pdfs.length ? ", the PDF in My files" : ""}.${skipped.length ? " Skipped: " + skipped.slice(0, 6).join(", ") + (skipped.length > 6 ? "…" : "") : ""}`;
    toast("Cue pack saved to the family space ✓");
  } catch (e) { console.warn(e); st.textContent = "Stopped: " + friendlyError(e); toast("Upload failed: " + friendlyError(e), 3500); }
  finally { CK.busy = false; renderCueCheck(); }
}
export function leaveCueCheck(){ if (CK.audio) { try { CK.audio.pause(); } catch (e) {} } cancelAnimationFrame(CK.raf); }
export function initCueCheck(){
  $("#ckPlay").onclick = toggle; $("#ckSave").onclick = save; $("#ckUndo").onclick = undo; $("#ckReset").onclick = resetAll;
  $("#ckImport").addEventListener("change", e => { const fs = e.target.files; importPack(fs).finally(() => { e.target.value = ""; }); });
  $("#ckVideoIn").addEventListener("change", e => { const f = e.target.files[0]; e.target.value = ""; pickVideo(f); });
  $("#ckOffset").addEventListener("change", e => { const v = parseFloat(e.target.value); CK.offset = Number.isFinite(v) && v >= 0 ? v : 0; if (CK.grab) { const c = CK.cues.find(x => x.n === CK.grab.n); CK.grab = { n: CK.grab.n, t: frameTime(c, CK.offset) }; drawGrab(); } });
}
expose({ ckNudge: nudge, ckPlay: play, ckGrab: grab, ckGrabMove: grabMove, ckGrabCancel: grabCancel, ckGrabSave: grabSave });
