// AI coach: film or pick a clip / photos on the phone → sample frames (never the video) → skeleton readouts on-device →
// one structured review from the worker → card with "One thing you did really well", "One fix for this week", the
// feet/knees/eyes/arms check, "Try this". Saved to `reviews` (thumbnails only). No chat anywhere.
import { $, esc, toast, uid, expose, todayStr } from "./util.js";
import { S, storeSet, storeDel, dances } from "./store.js";
import { sync } from "./sync.js";
import { coachConfig } from "./firebase-config.js";
import { openFor, addCorrection, TAG_LABEL, TAG_EMOJI } from "./corrections.js";
import { sampleTimes, loudness, peakTime, MAX_CLIP_SEC } from "./frames.js";
import { detectImage, drawSkeleton, poseAvailable } from "./pose.js";
import { readouts } from "./posemath.js";
import { checkBadges } from "./badges.js";
import { openClip, seekTo, isBlank, withTimeout } from "./videoframes.js";

const FRAME_PX = 768, THUMB_PX = 160;
const C = { danceId: "", trick: "", kind: "", frames: [], thumbs: [], pose: null, poseLines: [], busy: false, review: null, saved: null };

export const coachReady = () => !!(coachConfig && coachConfig.url);

// ---------- open / UI ----------
export function openCoach(danceId = "", trick = ""){
  C.danceId = danceId; C.trick = trick; C.frames = []; C.thumbs = []; C.pose = null; C.poseLines = []; C.review = null; C.saved = null; C.busy = false;
  const d = dances().find(x => x.id === danceId);
  $("#coachTitle").textContent = trick ? `Coach me · ${trick}` : d ? `Coach me · ${d.name}` : "Coach me";
  $("#coach").hidden = false; document.body.classList.add("modal");
  step("pick");
}
export function closeCoach(){ $("#coach").hidden = true; document.body.classList.remove("modal"); }
function step(name, html){
  const el = $("#coachBody");
  if (name === "pick") el.innerHTML = `<p class="coach-line">Film or pick a clip (up to 60 s), or use photos.</p>
    <div class="coach-pick"><label class="btn coral big-btn" for="coachVideo">🎥 Film now</label><input type="file" id="coachVideo" accept="video/*" capture="environment" hidden>
    <label class="btn sun big-btn" for="coachPickClip">🎞️ Pick a clip from Photos</label><input type="file" id="coachPickClip" accept="video/*" hidden>
    <label class="btn big-btn" for="coachPhotos">📷 Photos</label><input type="file" id="coachPhotos" accept="image/*" multiple hidden></div>
    <p class="small muted" style="margin-top:10px">The video stays on this phone. Only 20 small still frames go to the coach.${coachReady() ? "" : "<br><b>The coach isn't connected yet</b> — a grown-up needs to set up the worker (README). The skeleton view still works."}</p>`;
  else if (name === "busy") el.innerHTML = `<div class="coach-busy"><div class="spinner"></div><p class="small" id="coachBusyText">${esc(html || "Working…")}</p></div>`;
  else el.innerHTML = html;
  if (name === "pick") { $("#coachVideo").onchange = (e) => { const f = e.target.files[0]; e.target.value = ""; if (f) fromVideo(f); }; $("#coachPickClip").onchange = (e) => { const f = e.target.files[0]; e.target.value = ""; if (f) fromVideo(f); }; $("#coachPhotos").onchange = (e) => { const fs = [...e.target.files]; e.target.value = ""; if (fs.length) fromPhotos(fs); }; }
}
const busy = (t) => { const el = $("#coachBusyText"); if (el) el.textContent = t; };
const errState = (msg, retry = true) => step("err", `<div class="card err-state" style="margin:0"><h3>Hmm.</h3><p class="small">${esc(msg)}</p><div class="row">${retry ? `<button class="btn coral" onclick="coachRetry()">Try again</button>` : ""}<button class="btn ghost" onclick="closeCoach()">Close</button></div></div>`);

// ---------- frames ----------
function canvasFrom(source, sw, sh, max){ const scale = Math.min(1, max / Math.max(sw, sh)); const cv = document.createElement("canvas"); cv.width = Math.max(1, Math.round(sw * scale)); cv.height = Math.max(1, Math.round(sh * scale)); cv.getContext("2d").drawImage(source, 0, 0, cv.width, cv.height); return cv; }
const jpeg = (cv, q) => cv.toDataURL("image/jpeg", q);
const b64 = (dataUrl) => dataUrl.split(",")[1];

async function fromVideo(file){
  step("busy", "Reading the clip…"); C.kind = "video"; let clip = null;
  try {
    clip = await openClip(file); const video = clip.video;
    const duration = video.duration; if (!(duration > 0) || !Number.isFinite(duration)) throw new Error("That clip has no length. Film it again, or pick it from Photos.");
    if (duration > MAX_CLIP_SEC + 1) throw new Error(`Clips are up to ${MAX_CLIP_SEC} seconds — this one is ${Math.round(duration)}. Trim it in Photos, or film a shorter run.`);
    busy("Listening for the loudest moment…"); let peak = null;
    // Optional: skipped on big files and whenever the phone is slow or can't decode the sound.
    if (file.size <= 40 * 1024 * 1024) { try { const ctx = new (window.AudioContext || window.webkitAudioContext)(); const buf = await withTimeout(ctx.decodeAudioData(await file.arrayBuffer()), 8000, "audio timeout"); const ch = buf.getChannelData(0); peak = peakTime(loudness(ch, buf.sampleRate)); ctx.close && ctx.close(); } catch (e) { console.warn("no audio peak", e); } }
    const times = sampleTimes(duration, peak); C.frames = []; C.thumbs = []; const canvases = [], labels = []; let skipped = 0;
    for (let i = 0; i < times.length; i++) {
      busy(`Grabbing frame ${i + 1} of ${times.length}…`);
      const ok = await seekTo(video, times[i]); if (!ok || !video.videoWidth) { skipped++; continue; }
      const cv = canvasFrom(video, video.videoWidth, video.videoHeight, FRAME_PX); if (isBlank(cv)) { skipped++; continue; }
      canvases.push(cv); labels.push(times[i].toFixed(1) + "s"); C.frames.push(b64(jpeg(cv, 0.72)));
    }
    if (canvases.length < 3) throw new Error("This phone couldn't read frames from that clip. Try: pick the clip from Photos instead of filming here, or send 3–4 photos with the 📷 Photos button.");
    if (skipped) console.warn("coach: skipped frames", skipped);
    await finishFrames(canvases, labels);
  } catch (e) { console.warn(e); errState(e.message || String(e)); }
  finally { if (clip) clip.close(); }
}
async function fromPhotos(files){
  step("busy", "Reading photos…"); C.kind = "photo"; C.frames = []; const canvases = [];
  try {
    for (const f of files.slice(0, 8)) { const img = await new Promise((res, rej) => { const u = URL.createObjectURL(f); const im = new Image(); im.onload = () => { URL.revokeObjectURL(u); res(im); }; im.onerror = () => rej(new Error("One photo couldn't be read.")); im.src = u; }); const cv = canvasFrom(img, img.naturalWidth, img.naturalHeight, FRAME_PX); canvases.push(cv); C.frames.push(b64(jpeg(cv, 0.8))); }
    await finishFrames(canvases, canvases.map((_, i) => "photo " + (i + 1)));
  } catch (e) { console.warn(e); errState(e.message || String(e)); }
}
// Skeleton on a few frames (on-device), thumbnails, then the review screen.
async function finishFrames(canvases, labels){
  const pick = canvases.length <= 4 ? canvases.map((_, i) => i) : [0, Math.floor(canvases.length / 3), Math.floor(2 * canvases.length / 3), canvases.length - 1];
  C.poseLines = []; C.pose = null; C.thumbs = [];
  if (poseAvailable()) {
    try { busy("Drawing the skeleton…"); const nums = {}; for (const i of pick) { const lm = await withTimeout(detectImage(canvases[i]), 25000, "pose timeout"); if (lm) { const ctx = canvases[i].getContext("2d"); drawSkeleton(ctx, lm, canvases[i].width, canvases[i].height); const r = readouts(lm); if (!C.poseLines.length && r.lines.length) { C.poseLines = r.lines; Object.assign(nums, r.numbers); } } }
      if (Object.keys(nums).length) C.pose = nums; }
    catch (e) { console.warn("pose failed", e); C.poseLines = ["Skeleton view isn't ready (it needs a connection the first time) — the coach still works."]; }
  }
  for (const i of pick) C.thumbs.push({ label: labels[i], data: jpeg(canvasFrom(canvases[i], canvases[i].width, canvases[i].height, THUMB_PX), 0.6) });
  renderPreview();
}
function renderPreview(){
  step("preview", `<div class="thumbs">${C.thumbs.map(t => `<div class="thumb"><img src="${t.data}" alt=""><small>${esc(t.label)}</small></div>`).join("")}</div>
    ${C.poseLines.length ? `<div class="pose-lines">${C.poseLines.map(l => `<div>🦴 ${esc(l)}</div>`).join("")}</div>` : ""}
    <p class="small muted">${C.frames.length} frame${C.frames.length === 1 ? "" : "s"} ready. Mom can see this review.</p>
    <div class="row"><button class="btn coral big-btn grow" onclick="coachSend()" ${coachReady() ? "" : "disabled"}>✨ Ask the coach</button><button class="btn ghost" onclick="coachRetry()">Redo</button></div>
    ${coachReady() ? "" : `<p class="small bad" style="margin-top:8px">The coach isn't connected yet. Ask a grown-up (worker/README.md).</p>`}`);
}

// ---------- send ----------
async function send(){
  if (C.busy || !C.frames.length) return; if (!coachReady()) return toast("The coach isn't set up yet");
  if (!navigator.onLine) return errState("You're offline. The coach needs a connection — the frames are kept, tap Try again when you're back.", true);
  C.busy = true; step("busy", "The coach is looking…");
  const d = dances().find(x => x.id === C.danceId) || {};
  const body = { familyId: sync.familyId, kind: C.kind, frames: C.frames, dance: d.name || "", style: d.style || "", map: d.map || "", trick: C.trick || "", corrections: openFor(S.corrections, C.danceId).map(c => c.text), pose: C.pose };
  try {
    const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 90000);
    const res = await fetch(coachConfig.url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: ctl.signal }); clearTimeout(timer);
    let j = null; try { j = await res.json(); } catch (e) {}
    if (!res.ok || !j || !j.review) throw new Error((j && j.error) || (res.status === 403 ? "This app isn't allowed to use the coach from here." : "The coach didn't answer (" + res.status + ")."));
    C.review = j.review; await save(); renderReview();
  } catch (e) { console.warn(e); errState(e.name === "AbortError" ? "The coach took too long. Try again with a shorter clip." : (e.message || String(e))); }
  finally { C.busy = false; }
}
async function save(){
  const id = uid(); const rec = { id, danceId: C.danceId, trick: C.trick, kind: C.kind, date: todayStr(), at: new Date().toISOString(), thumbs: C.thumbs.map(t => t.data), pose: C.pose, review: C.review, frames: C.frames.length };
  await storeSet("reviews", id, rec); C.saved = id; checkBadges();
}
export function reviewCard(r, opts = {}){
  const v = r.review || {}; const check = (k) => `<div class="chk-row"><span>${TAG_EMOJI[k]} ${TAG_LABEL[k]}</span><b>${esc(v[k] || "✓")}</b></div>`;
  const d = dances().find(x => x.id === r.danceId);
  return `<div class="card review" data-review="${r.id}">
    <div class="row"><span class="chip violet">🎬 ${esc(r.kind === "photo" ? "Photo review" : "Video review")}</span><span class="small muted grow">${esc(r.date || "")}${d ? " · " + esc(d.name) : ""}${r.trick ? " · " + esc(r.trick) : ""}</span>${opts.del ? `<button class="del" onclick="delReview('${r.id}')">✕</button>` : ""}</div>
    ${(r.thumbs || []).length ? `<div class="thumbs small-thumbs">${r.thumbs.map(t => `<img src="${t}" alt="">`).join("")}</div>` : ""}
    <div class="rv-loved"><div class="field-lab">One thing you did really well</div><p>${esc(v.loved)}</p></div>
    <div class="rv-fix"><div class="field-lab">One fix for this week</div><p>${esc(v.fix)}</p>${opts.addFix !== false ? `<button class="btn sm coral" onclick="coachAddFix('${r.id}')">＋ Make it a note (${esc(TAG_LABEL[v.tag] || "Other")})</button>` : ""}</div>
    <div class="chk">${check("feet")}${check("knees")}${check("eyes")}${check("arms")}</div>
    ${v.try ? `<div class="field-lab">Try this</div><p class="small">${esc(v.try)}</p>` : ""}
    ${r.pose ? `<div class="small muted">🦴 ${Object.entries(r.pose).map(([k, val]) => esc(k) + ": " + esc(val)).join(" · ")}</div>` : ""}
    <p class="small muted" style="margin-top:6px">👀 Mom can see this.</p></div>`;
}
function renderReview(){ const r = S.reviews[C.saved] || { id: C.saved, danceId: C.danceId, trick: C.trick, kind: C.kind, date: todayStr(), thumbs: C.thumbs.map(t => t.data), pose: C.pose, review: C.review }; step("review", reviewCard(r) + `<div class="row" style="margin-top:8px"><button class="btn coral big-btn grow" onclick="closeCoach()">Done</button><button class="btn ghost" onclick="coachRetry()">Another</button></div>`); }
async function addFix(reviewId){ const r = S.reviews[reviewId]; if (!r || !r.review) return; if (r.fixAdded) return toast("Already a note"); await addCorrection({ danceId: r.danceId, text: r.review.fix, tag: r.review.tag, source: "AI coach" }); await storeSet("reviews", reviewId, { ...r, fixAdded: true }); toast("Added as a note ✓"); }
function retry(){ C.frames = []; C.thumbs = []; C.review = null; step("pick"); }

// ---------- Grown-ups → Coach reviews ----------
export function renderReviews(){
  const el = $("#reviewList"); if (!el) return;
  const list = Object.values(S.reviews).filter(r => !r.deleted).sort((a, b) => (b.at || "").localeCompare(a.at || ""));
  el.innerHTML = list.length ? list.map(r => reviewCard(r, { del: true })).join("") : `<p class="small muted">No reviews yet. Tap 🎬 Coach me on a dance.</p>`;
  const st = $("#coachStatus"); if (st) st.textContent = coachReady() ? "Coach worker: connected (" + coachConfig.url.replace(/^https?:\/\//, "").slice(0, 40) + ")" : "Coach worker: not set up yet — see worker/README.md";
}
async function delReview(id){ if (!confirm("Delete this review?")) return; await storeDel("reviews", id); }
export function initCoach(){ $("#coachClose").onclick = closeCoach; }
expose({ openCoach, closeCoach, coachSend: send, coachRetry: retry, coachAddFix: addFix, delReview });
