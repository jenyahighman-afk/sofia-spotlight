// AI coach: a filming tip, then film or pick a clip / photos on the phone → sample frames (never the video) → on the
// phone, MediaPipe finds up to 3 people per frame and js/dancer.js picks Sofia (the same person throughout; a grown-up
// taps her when there are several people or a mirror reflection) → frames where she isn't clearly seen (average
// visibility < 0.6) are dropped → each frame is CROPPED to her (+15%) and only the crops are sent, with the pose numbers
// for the joints really seen, the solo's cue table, the teacher's pinned notes and the Memory + knees rule → one
// structured review (incl. missed or unsure steps; "ask Ms. Brittany" when it differs from the teacher) → saved to
// `reviews` (thumbnails only). No chat anywhere.
import { $, esc, toast, uid, expose, todayStr } from "./util.js";
import { S, storeSet, storeDel, dances } from "./store.js";
import { sync } from "./sync.js";
import { coachConfig } from "./firebase-config.js";
import { openFor, addCorrection, pinnedOpen, TAG_LABEL, TAG_EMOJI } from "./corrections.js";
import { renderTeacher } from "./teacher.js";
import { sampleTimes, runTimes, RUN_SEC, loudness, peakTime, MAX_CLIP_SEC } from "./frames.js";
import { normalizeCues, fmtCueTime } from "./cues.js";
import { detectAll, drawSkeleton, poseAvailable } from "./pose.js";
import { pickDancer, needsTap, people, bboxOf, padBox, cropRect, frameReport, avgVisibility, MIN_VIS } from "./dancer.js";
import { memoryKnees } from "./season15.js";
import { readouts } from "./posemath.js";
import { checkBadges } from "./badges.js";
import { openClip, seekTo, isBlank, withTimeout } from "./videoframes.js";

const FRAME_PX = 768, THUMB_PX = 160;
const C = { danceId: "", trick: "", kind: "", frames: [], times: [], reports: [], thumbs: [], pose: null, poseLines: [], busy: false, review: null, saved: null };

export const coachReady = () => !!(coachConfig && coachConfig.url);
const runCheckable = (id) => { const d = dances().find(x => x.id === id); return !!(d && ((d.musicFile && d.musicFile.url) || d.musicUrl)); };

// ---------- open / UI ----------
export function openCoach(danceId = "", trick = "", opts = {}){
  C.danceId = danceId; C.trick = trick; C.frames = []; C.times = []; C.reports = []; C.thumbs = []; C.pose = null; C.poseLines = []; C.review = null; C.saved = null; C.busy = false;
  const d = dances().find(x => x.id === danceId);
  $("#coachTitle").textContent = trick ? `Coach me · ${trick}` : d ? `Coach me · ${d.name}` : "Coach me";
  $("#coach").hidden = false; document.body.classList.add("modal");
  step(opts.tip === false ? "pick" : "tip");
}
// Frames already grabbed elsewhere (Run check): straight to the skeleton + preview step.
export async function openCoachFrames(danceId, canvases, labels){
  openCoach(danceId, "", { tip: false }); C.kind = "video"; step("busy", "Finding the dancer…");
  try { await finishFrames(canvases, labels, labels.map(l => parseFloat(l))); } catch (e) { console.warn(e); errState(e.message || String(e)); }
}
// A clip or photo already picked elsewhere (a goal check-in): no second pick needed.
export function openCoachFile(danceId, trick, file){ openCoach(danceId, trick, { tip: !file }); if (!file) return; if (file.type.startsWith("video/")) fromVideo(file); else fromPhotos([file]); }
export function closeCoach(){ $("#coach").hidden = true; document.body.classList.remove("modal"); }
function step(name, html){
  const el = $("#coachBody");
  if (name === "tip") el.innerHTML = `<h3 style="margin-top:0">🎥 Before you film</h3><ol class="coach-tip">
      <li>📱 <b>Phone sideways</b> (landscape).</li><li>🧍 Phone at <b>hip height</b>, on a stand or a shelf.</li><li>👣 <b>Whole body in the frame</b>, head to toes, the whole time.</li>
      <li>🧱 A <b>plain wall</b> behind if you can (no mirror behind her).</li><li>🙅 <b>Nobody else in the shot.</b></li></ol>
      <p class="small muted">The coach only looks at Sofia: the app finds her, crops each frame to her and leaves out the rest of the room.</p>
      <button class="btn coral big-btn" style="width:100%" onclick="coachStep('pick')">Got it ▶</button>`;
  else if (name === "pick") el.innerHTML = `<p class="coach-line">Film or pick a clip (a full run is fine, up to 3 min), or use photos.</p>
    <p class="small muted">Full run? Start the music right after you tap record.</p>
    ${runCheckable(C.danceId) ? `<button class="btn violet big-btn" style="width:100%;margin-top:8px" onclick="closeCoach();openRunCheck('${C.danceId}')">🎥 Run check — the app plays the music and snaps the frames</button>` : ""}
    <div class="coach-pick"><label class="btn coral big-btn" for="coachVideo">🎥 Film now</label><input type="file" id="coachVideo" accept="video/*" capture="environment" hidden>
    <label class="btn sun big-btn" for="coachPickClip">🎞️ Pick a clip from Photos</label><input type="file" id="coachPickClip" accept="video/*" hidden>
    <label class="btn big-btn" for="coachPhotos">📷 Photos</label><input type="file" id="coachPhotos" accept="image/*" multiple hidden></div>
    <p class="small muted" style="margin-top:10px">The video stays on this phone. Only small still frames, cropped to Sofia, go to the coach. <button class="lnk" onclick="coachStep('tip')">Filming tips</button>${coachReady() ? "" : "<br><b>The coach isn't connected yet</b> — a grown-up needs to set up the worker (README). The skeleton view still works."}</p>`;
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
    if (duration > MAX_CLIP_SEC + 1) throw new Error(`Clips are up to ${Math.round(MAX_CLIP_SEC / 60)} minutes — this one is ${Math.round(duration)} seconds. Trim it in Photos, or film a shorter run.`);
    busy("Listening for the loudest moment…"); let peak = null;
    // Optional: skipped on big files and whenever the phone is slow or can't decode the sound.
    if (file.size <= 40 * 1024 * 1024) { try { const ctx = new (window.AudioContext || window.webkitAudioContext)(); const buf = await withTimeout(ctx.decodeAudioData(await file.arrayBuffer()), 8000, "audio timeout"); const ch = buf.getChannelData(0); peak = peakTime(loudness(ch, buf.sampleRate)); ctx.close && ctx.close(); } catch (e) { console.warn("no audio peak", e); } }
    const cues = normalizeCues((dances().find(x => x.id === C.danceId) || {}).cues);
    const times = duration > RUN_SEC && cues.length >= 6 ? runTimes(duration, cues, peak) : sampleTimes(duration, peak); C.frames = []; C.thumbs = []; const canvases = [], labels = [], at = []; let skipped = 0;
    for (let i = 0; i < times.length; i++) {
      busy(`Grabbing frame ${i + 1} of ${times.length}…`);
      const ok = await seekTo(video, times[i]); if (!ok || !video.videoWidth) { skipped++; continue; }
      const cv = canvasFrom(video, video.videoWidth, video.videoHeight, FRAME_PX); if (isBlank(cv)) { skipped++; continue; }
      canvases.push(cv); labels.push(times[i].toFixed(1) + "s"); at.push(times[i]);
    }
    if (canvases.length < 3) throw new Error("This phone couldn't read frames from that clip. Try: pick the clip from Photos instead of filming here, or send 3–4 photos with the 📷 Photos button.");
    if (skipped) console.warn("coach: skipped frames", skipped);
    await finishFrames(canvases, labels, at);
  } catch (e) { console.warn(e); errState(e.message || String(e)); }
  finally { if (clip) clip.close(); }
}
async function fromPhotos(files){
  step("busy", "Reading photos…"); C.kind = "photo"; C.frames = []; const canvases = [];
  try {
    for (const f of files.slice(0, 8)) { const img = await new Promise((res, rej) => { const u = URL.createObjectURL(f); const im = new Image(); im.onload = () => { URL.revokeObjectURL(u); res(im); }; im.onerror = () => rej(new Error("One photo couldn't be read.")); im.src = u; }); canvases.push(canvasFrom(img, img.naturalWidth, img.naturalHeight, FRAME_PX)); }
    await finishFrames(canvases, canvases.map((_, i) => "photo " + (i + 1)), canvases.map(() => null));
  } catch (e) { console.warn(e); errState(e.message || String(e)); }
}
// Find the dancer in every frame (on-device), drop the frames where she isn't clearly seen, crop the rest to her, then
// thumbnails with the skeleton (drawn on copies only: what is sent stays clean) and the review screen.
async function finishFrames(canvases, labels, times = []){
  C.poseLines = []; C.pose = null; C.thumbs = []; C.frames = []; C.times = []; C.reports = [];
  if (!poseAvailable()) throw new Error("This phone can't run the skeleton tool, which the coach needs to find Sofia in the frames.");
  busy("Finding the dancer…"); let all;
  try { all = []; for (let i = 0; i < canvases.length; i++) { busy(`Finding the dancer… ${i + 1} of ${canvases.length}`); all.push(await withTimeout(detectAll(canvases[i]), 25000, "pose timeout")); } }
  catch (e) { console.warn("pose failed", e); throw new Error("The skeleton tool didn't load (it needs a connection the first time). Try again in a moment."); }
  const tapFrame = needsTap(all); const tap = tapFrame >= 0 ? await askTap(canvases[tapFrame], all[tapFrame]) : null;
  const picks = pickDancer(all, { tap, tapFrame });
  const keep = picks.map((lm, i) => lm && avgVisibility(lm) >= MIN_VIS ? i : -1).filter(i => i >= 0); const dropped = canvases.length - keep.length;
  if (keep.length < (C.kind === "photo" ? 1 : 3)) throw new Error(`Sofia wasn't clearly in enough frames (${keep.length} of ${canvases.length}). Film again: phone sideways at hip height, her whole body in the frame, nobody else in the shot.`);
  const crops = [];
  for (const i of keep) {
    const cv = canvases[i], lm = picks[i]; const r = cropRect(padBox(bboxOf(lm)), cv.width, cv.height);
    const crop = document.createElement("canvas"); crop.width = r.w; crop.height = r.h; crop.getContext("2d").drawImage(cv, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
    crops.push({ crop, lm: lm.map(p => ({ ...p, x: (p.x * cv.width - r.x) / r.w, y: (p.y * cv.height - r.y) / r.h })), label: labels[i] });
    C.frames.push(b64(jpeg(crop, 0.8))); C.times.push(Number.isFinite(times[i]) ? times[i] : null); C.reports.push(frameReport(lm, Number.isFinite(times[i]) ? times[i] : null));
  }
  const first = crops.find(c => readouts(c.lm).lines.length); if (first) { const r = readouts(first.lm); C.poseLines = r.lines; }
  C.poseLines.unshift(`Sofia found in ${keep.length} of ${canvases.length} frames${dropped ? ` (${dropped} left out: not clearly seen)` : ""}${tap ? " · the one you tapped" : ""}. Only these crops go to the coach.`);
  C.pose = poseSummary(C.reports, canvases.length);
  const pick = crops.length <= 4 ? crops.map((_, i) => i) : [0, Math.floor(crops.length / 3), Math.floor(2 * crops.length / 3), crops.length - 1];
  for (const i of pick) { const { crop, lm, label } = crops[i]; const t = canvasFrom(crop, crop.width, crop.height, 240); drawSkeleton(t.getContext("2d"), lm, t.width, t.height); C.thumbs.push({ label, data: jpeg(canvasFrom(t, t.width, t.height, THUMB_PX), 0.6) }); }
  renderPreview();
}
// A short summary kept on the saved review (shown as 🦴 lines): frames used, knee-over-toe tally, straightest knee.
export function poseSummary(reports, total){
  const out = { frames: `${reports.length} of ${total}` }; let over = 0, bent = 0;
  for (const r of reports) for (const k of ["kneeOverToeLeft", "kneeOverToeRight"]) if (r[k]) { bent++; if (r[k] === "over toes") over++; }
  if (bent) out.kneesOverToes = `${over} of ${bent} bent knees`;
  const knees = reports.flatMap(r => [r.kneeLeft, r.kneeRight]).filter(n => typeof n === "number"); if (knees.length) out.straightestKnee = Math.max(...knees) + "°";
  const feet = reports.flatMap(r => [r.footLeft, r.footRight]).filter(n => typeof n === "number"); if (feet.length) out.bestFootPoint = Math.max(...feet) + "°";
  return out;
}
// Several people (or a reflection) in the first frame: the grown-up taps Sofia. Resolves to the tap point (0–1), or null to let the app pick.
function askTap(cv, poses){
  return new Promise(res => {
    const ps = people(poses); const boxes = ps.map(lm => padBox(bboxOf(lm), 0.05));
    step("tap", `<p class="coach-line">👆 Tap Sofia</p><p class="small muted">More than one person (or a mirror reflection) is in the shot. The coach will look only at the one you tap, in every frame.</p>
      <div class="coach-pick-dancer"><img src="${cv.toDataURL("image/jpeg", 0.75)}" alt="" style="width:100%;border-radius:12px;display:block">${boxes.map((b, i) => `<button class="pd-box" data-i="${i}" style="left:${b.x0 * 100}%;top:${b.y0 * 100}%;width:${(b.x1 - b.x0) * 100}%;height:${(b.y1 - b.y0) * 100}%" aria-label="This one"><b>${i + 1}</b></button>`).join("")}</div>
      <button class="btn ghost" onclick="this.disabled=true" id="coachTapSkip">Let the app pick</button>`);
    $("#coachBody").querySelectorAll(".pd-box").forEach(btn => btn.onclick = () => { const b = boxes[+btn.dataset.i]; step("busy", "Following Sofia through the frames…"); res({ x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 }); });
    $("#coachTapSkip").onclick = () => { step("busy", "Finding the dancer…"); res(null); };
  });
}
function renderPreview(){
  step("preview", `<div class="thumbs">${C.thumbs.map(t => `<div class="thumb"><img src="${t.data}" alt=""><small>${esc(t.label)}</small></div>`).join("")}</div>
    ${C.poseLines.length ? `<div class="pose-lines">${C.poseLines.map(l => `<div>🦴 ${esc(l)}</div>`).join("")}</div>` : ""}
    <p class="small muted">${C.frames.length} frame${C.frames.length === 1 ? "" : "s"} ready.</p>
    <div class="row"><button class="btn coral big-btn grow" onclick="coachSend()" ${coachReady() ? "" : "disabled"}>✨ Ask the coach</button><button class="btn ghost" onclick="coachRetry()">Redo</button></div>
    ${coachReady() ? "" : `<p class="small bad" style="margin-top:8px">The coach isn't connected yet. Ask a grown-up (worker/README.md).</p>`}`);
}

// ---------- send ----------
async function send(){
  if (C.busy || !C.frames.length) return; if (!coachReady()) return toast("The coach isn't set up yet");
  if (!navigator.onLine) return errState("You're offline. The coach needs a connection — the frames are kept, tap Try again when you're back.", true);
  C.busy = true; step("busy", "The coach is looking…");
  const d = dances().find(x => x.id === C.danceId) || {};
  const pins = pinnedOpen(S.corrections, C.danceId); const cues = normalizeCues(d.cues).filter(c => c.end !== undefined);
  const body = { familyId: sync.familyId, kind: C.kind, frames: C.frames, times: C.times, dance: d.name || "", style: d.style || "", map: d.map || "", trick: C.trick || "",
    corrections: openFor(S.corrections, C.danceId).filter(c => !c.pinned).map(c => c.text), pinned: pins.map(c => ({ text: c.text, tag: c.tag, by: c.source || "teacher" })), memoryKnees: memoryKnees(todayStr()),
    cues: cues.map(c => `${fmtCueTime(c.t)}–${fmtCueTime(c.end)} ${c.trick ? "★ " : ""}${c.move}`), poseFrames: C.reports, pose: C.pose };
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
    <div class="rv-fix"><div class="field-lab">One fix for this week${v.askTeacher ? ` <span class="chip sun rv-ask">ask Ms. Brittany</span>` : ""}</div><p>${esc(v.fix)}</p>${opts.addFix !== false ? `<button class="btn sm coral" onclick="coachAddFix('${r.id}')">＋ Make it a note (${esc(TAG_LABEL[v.tag] || "Other")})</button>` : ""}</div>
    <div class="chk">${check("feet")}${check("knees")}${check("eyes")}${check("arms")}</div>
    ${v.try ? `<div class="field-lab">Try this</div><p class="small">${esc(v.try)}</p>` : ""}
    ${v.missed ? `<div class="rv-missed"><div class="field-lab">Missed or unsure steps</div><p class="small">${esc(v.missed)}</p></div>` : ""}
    ${r.pose ? `<div class="small muted">🦴 ${Object.entries(r.pose).map(([k, val]) => esc(k) + ": " + esc(val)).join(" · ")}</div>` : ""}</div>`;
}
function renderReview(){ const r = S.reviews[C.saved] || { id: C.saved, danceId: C.danceId, trick: C.trick, kind: C.kind, date: todayStr(), thumbs: C.thumbs.map(t => t.data), pose: C.pose, review: C.review }; step("review", reviewCard(r) + `<div class="row" style="margin-top:8px"><button class="btn coral big-btn grow" onclick="closeCoach()">Done</button><button class="btn ghost" onclick="coachRetry()">Another</button></div>`); }
async function addFix(reviewId){ const r = S.reviews[reviewId]; if (!r || !r.review) return; if (r.fixAdded) return toast("Already a note"); const corr = await addCorrection({ danceId: r.danceId, text: r.review.fix, tag: r.review.tag, source: r.review.askTeacher ? "AI coach (ask Ms. Brittany)" : "AI coach" }); await storeSet("reviews", reviewId, { ...r, fixAdded: true, fixId: corr.id }); toast("Added as a note ✓"); }
function retry(){ C.frames = []; C.times = []; C.reports = []; C.thumbs = []; C.review = null; step("pick"); }

// ---------- Grown-ups → Coach reviews ----------
export function renderReviews(){ renderTeacher();
  const el = $("#reviewList"); if (!el) return;
  const list = Object.values(S.reviews).filter(r => !r.deleted).sort((a, b) => (b.at || "").localeCompare(a.at || ""));
  el.innerHTML = list.length ? list.map(r => reviewCard(r, { del: true })).join("") : `<p class="small muted">No reviews yet. Tap 🎬 Coach me on a dance.</p>`;
  const st = $("#coachStatus"); if (st) st.textContent = coachReady() ? "Coach worker: connected (" + coachConfig.url.replace(/^https?:\/\//, "").slice(0, 40) + ")" : "Coach worker: not set up yet — see worker/README.md";
}
async function delReview(id){ if (!confirm("Delete this review?")) return; await storeDel("reviews", id); }
export function initCoach(){ $("#coachClose").onclick = closeCoach; }
expose({ openCoach, closeCoach, coachSend: send, coachRetry: retry, coachAddFix: addFix, delReview, coachStep: (n) => step(n) });
