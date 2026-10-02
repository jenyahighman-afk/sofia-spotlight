// Dance Along: learn a routine from a real video. Pick a clip (a tutorial you saved, a clip of a teacher, anything on the
// phone) → the dancer's moves are read from it on-device at 8 frames a second → the clip is kept in the family space.
// Play: the video (with its own music) beside the camera; her moves are compared to the clip's, Perfect / Good / Miss
// as it goes, a score and stars at the end. Nothing is recorded; the camera feed never leaves the phone.
import { $, esc, toast, uid, expose } from "../util.js";
import { S, storeSet, storeDel, setSettings } from "../store.js";
import { media, friendlyError } from "../sync.js";
import { VIDEO_MAX_BYTES } from "../media.js";
import { imageDetector, videoDetector, detectVideoFrame, drawSkeleton, poseAvailable } from "../pose.js";
import { poseFeatures, featureDistance } from "../posemath.js";
import { awardStars } from "../stars.js";

export const FPS = 8, MAX_SEC = 120;
const A = { on: false, stream: null, raf: 0, routine: null, video: null, score: 0, hits: { perfect: 0, good: 0, miss: 0 }, lastJudged: -1, speak: true, synth: null };
const routines = () => Object.entries(S.choreo).filter(([, c]) => c && c.kind === "along" && !c.deleted).map(([id, c]) => ({ id, ...c })).sort((a, b) => (b.at || "").localeCompare(a.at || ""));

const say = (t, speak = true) => { $("#alSay").textContent = t; if (speak && A.speak) speakOut(t); };
function speakOut(t){ try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(String(t).replace(/[^\p{L}\p{N} ,.!?'-]/gu, "")); u.rate = 1.05; u.pitch = 1.1; speechSynthesis.speak(u); } catch (e) {} }

// ---------- list / setup ----------
export function renderAlong(){
  const el = $("#alongList"); if (!el) return; const list = routines();
  el.innerHTML = (list.length ? list.map(r => `<div class="check"><span class="chip violet">🕺</span><span class="grow"><b>${esc(r.name)}</b><br><span class="small muted">${Math.round(r.duration || 0)} s · best ${r.best || 0}</span></span><button class="btn sm coral" onclick="alongPlay('${r.id}')">▶ Dance</button><button class="del" onclick="alongDel('${r.id}')">✕</button></div>`).join("") : `<p class="small muted">No routines yet. Add a clip of a dance you want to learn.</p>`);
  const st = $("#alongStatus"); if (st) st.textContent = "";
}
async function addRoutine(file){
  if (!poseAvailable()) return toast("Needs a newer phone");
  if (file.size > VIDEO_MAX_BYTES) return toast("Clips up to 50 MB — trim it first", 3000);
  const st = $("#alongStatus"); const status = (t) => { if (st) st.textContent = t; };
  const url = URL.createObjectURL(file); const v = document.createElement("video"); v.muted = true; v.playsInline = true; v.preload = "auto"; v.src = url;
  try {
    status("Reading the clip…");
    await new Promise((res, rej) => { v.onloadedmetadata = res; v.onerror = () => rej(new Error("This clip can't be read on this phone.")); });
    const duration = Math.min(v.duration, MAX_SEC); if (!(duration > 1)) throw new Error("That clip is too short.");
    if (v.duration > MAX_SEC + 1) toast(`Using the first ${MAX_SEC} seconds`, 2500);
    const det = await imageDetector(); const cv = document.createElement("canvas"); const sc = Math.min(1, 480 / Math.max(v.videoWidth, v.videoHeight)); cv.width = Math.round(v.videoWidth * sc); cv.height = Math.round(v.videoHeight * sc); const ctx = cv.getContext("2d");
    const frames = []; const n = Math.floor(duration * FPS); let found = 0;
    for (let i = 0; i < n; i++) {
      const t = i / FPS; await new Promise((res, rej) => { const done = () => { v.removeEventListener("seeked", done); res(); }; v.addEventListener("seeked", done); v.onerror = () => rej(new Error("Couldn't read a frame.")); v.currentTime = t; });
      ctx.drawImage(v, 0, 0, cv.width, cv.height); const r = det.detect(cv); const lm = r && r.landmarks && r.landmarks[0]; const f = lm ? poseFeatures(lm) : null; if (f) found++; frames.push(f);
      if (i % 8 === 0) status(`Learning the moves… ${Math.round(100 * i / n)}%`);
    }
    if (found < n * 0.4) throw new Error("I couldn't see a dancer clearly in most of the clip. Try one where the whole body is in view.");
    status("Saving the clip…"); const id = uid(); const up = await media.upload("videos", id, file, { contentType: file.type || "video/mp4", name: file.name });
    const name = prompt("Name this dance", file.name.replace(/\.[a-z0-9]+$/i, "").slice(0, 40)) || "My dance";
    await storeSet("choreo", id, { kind: "along", name, path: up.path, url: up.url, size: file.size, duration, fps: FPS, frames, at: new Date().toISOString(), best: 0, style: "along", seq: [] });
    toast("Ready to dance! 🕺"); renderAlong();
  } catch (e) { console.warn(e); status(""); toast(e.message && !e.code ? e.message : "Couldn't add it: " + friendlyError(e), 4000); }
  finally { URL.revokeObjectURL(url); }
}
async function delRoutine(id){ const r = S.choreo[id]; if (!r || !confirm(`Remove "${r.name}"?`)) return; await storeDel("choreo", id); if (r.path) { try { await media.remove(r.path); } catch (e) { console.warn(e); } } renderAlong(); }

// ---------- play ----------
export async function playAlong(id){
  const r = S.choreo[id]; if (!r || r.kind !== "along") return toast("That dance isn't here");
  if (!poseAvailable() || !navigator.mediaDevices) return toast("Dance Along needs a camera and a newer phone");
  A.routine = r; A.score = 0; A.hits = { perfect: 0, good: 0, miss: 0 }; A.lastJudged = -1; A.speak = localStorage.getItem("spotlight:alongVoice") !== "off";
  $("#along").hidden = false; document.body.classList.add("modal"); $("#alScore").textContent = "0"; $("#alTitle").textContent = r.name; $("#alJudge").textContent = ""; $("#alVoice").textContent = A.speak ? "🔊" : "🔇";
  $("#alActions").innerHTML = `<button class="btn ghost" onclick="stopAlong()">✕ Stop</button>`;
  const v = $("#alVideo"); v.src = r.url; v.muted = false; v.currentTime = 0;
  try {
    say("Getting the camera…", false);
    A.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 } }, audio: false });
    const cam = $("#alCam"); cam.srcObject = A.stream; await cam.play(); await videoDetector();
  } catch (e) { console.warn(e); say("No camera here. Allow the camera, or try on a phone.", false); $("#alActions").innerHTML = `<button class="btn ghost" onclick="stopAlong()">Close</button>`; return; }
  for (const n of [3, 2, 1]) { say(String(n)); await new Promise(res => setTimeout(res, 800)); }
  say("Go! Copy the video", true);
  try { await v.play(); } catch (e) { say("Tap ▶ on the video to start", false); }
  A.on = true; v.onended = finishAlong; loop();
}
export function stopAlong(){ A.on = false; cancelAnimationFrame(A.raf); const v = $("#alVideo"); try { v.pause(); v.onended = null; } catch (e) {} if (A.stream) { A.stream.getTracks().forEach(t => t.stop()); A.stream = null; } $("#along").hidden = true; document.body.classList.remove("modal"); try { speechSynthesis.cancel(); } catch (e) {} }
function toggleVoice(){ A.speak = !A.speak; localStorage.setItem("spotlight:alongVoice", A.speak ? "on" : "off"); $("#alVoice").textContent = A.speak ? "🔊" : "🔇"; }

async function loop(){
  if (!A.on) return; const v = $("#alVideo"), cam = $("#alCam"), cv = $("#alCanvas");
  if (cam.videoWidth && !v.paused) {
    cv.width = cam.videoWidth; cv.height = cam.videoHeight; const ctx = cv.getContext("2d"); ctx.clearRect(0, 0, cv.width, cv.height);
    let lm = null; try { lm = await detectVideoFrame(cam, performance.now()); } catch (e) {}
    const idx = Math.floor(v.currentTime * (A.routine.fps || FPS));
    // judge once every half second against the nearest reference frames (±0.4 s): forgiving on timing
    if (idx !== A.lastJudged && idx % Math.round((A.routine.fps || FPS) / 2) === 0) {
      A.lastJudged = idx; const mine = lm ? poseFeatures(lm) : null; const fr = A.routine.frames || [];
      const near = []; for (let k = idx - 3; k <= idx + 3; k++) if (fr[k]) near.push(fr[k]);
      if (mine && near.length) { const d = Math.min(...near.map(f => featureDistance(mine, f))); const r = d < 0.45 ? "perfect" : d < 0.85 ? "good" : "miss"; A.hits[r]++; A.score += r === "perfect" ? 100 : r === "good" ? 50 : 0; $("#alScore").textContent = A.score; judge(r); }
      else if (!mine) judge("nobody");
    }
    if (lm) drawSkeleton(ctx, lm, cv.width, cv.height, "#2ED3C8");
  }
  A.raf = requestAnimationFrame(loop);
}
let judgeTimer = 0;
function judge(r){ const el = $("#alJudge"); el.textContent = r === "perfect" ? "PERFECT ✨" : r === "good" ? "Good!" : r === "miss" ? "Keep going" : "Step back, I can't see you"; el.className = "al-judge " + r; clearTimeout(judgeTimer); judgeTimer = setTimeout(() => { el.textContent = ""; }, 700); }
async function finishAlong(){
  A.on = false; cancelAnimationFrame(A.raf); if (A.stream) { A.stream.getTracks().forEach(t => t.stop()); A.stream = null; }
  const total = A.hits.perfect + A.hits.good + A.hits.miss || 1; const pct = Math.round(100 * (A.hits.perfect + A.hits.good * 0.5) / total);
  say(`${pct}% with the video! ${pct >= 80 ? "Amazing!" : pct >= 50 ? "Nice!" : "Keep practicing!"}`, true); $("#alJudge").textContent = "";
  const r = A.routine; if (A.score > (r.best || 0)) await storeSet("choreo", r.id, { ...S.choreo[r.id], best: A.score });
  const st = await awardStars("along", pct, r.name);
  $("#alActions").innerHTML = `<span class="chip sun">⭐ +${st.earned + st.bonus} · Perfect ${A.hits.perfect} · Good ${A.hits.good}</span><button class="btn coral" onclick="alongPlay('${r.id}')">▶ Again</button><button class="btn ghost" onclick="stopAlong()">Done</button>`;
}
export function initAlong(){ $("#alClose").onclick = stopAlong; $("#alVoice").onclick = toggleVoice; $("#alongFile").onchange = (e) => { const f = e.target.files[0]; e.target.value = ""; if (f) addRoutine(f); }; }
expose({ alongPlay: playAlong, stopAlong, alongDel: delRoutine });
