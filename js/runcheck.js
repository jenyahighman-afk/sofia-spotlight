// Run check: prop the phone up, the app counts down, plays the dance's music and snaps frames on its own at the cue
// moments (plus a few spread evenly), then hands them to the coach. No video is recorded; only the stills leave the phone.
// Pure parts up top (tested in Node).
import { $, esc, toast, expose } from "./util.js";
import { dances } from "./store.js";
import { normalizeCues } from "./cues.js";
import { runTimes, sampleTimes, RUN_SEC } from "./frames.js";
import { srcFor } from "./player.js";
import { poseAvailable, detectVideoFrame, drawSkeleton } from "./pose.js";
import { openCoachFrames } from "./coach.js";
import { prompterHtml } from "./prompter.js";
import { S, setSettings } from "./store.js";

export const FRAME_PX = 768, LATE_SEC = 1.5;
// Snap times for a run of `duration` seconds: the cue sheet when there is one, else even spacing.
export function snapTimes(duration, cues){ const cs = normalizeCues(cues || []); return duration > RUN_SEC && cs.length >= 6 ? runTimes(duration, cs, null) : sampleTimes(duration, null); }
// Which frame to grab now: the first not-yet-taken time at or before `t`. Times missed by more than LATE_SEC are skipped
// (returned in `skipped`), so a stalled phone doesn't fire a burst of stale frames.
export function dueFrame(times, t, from){ let i = from, skipped = 0; while (i < times.length && times[i] <= t - LATE_SEC) { i++; skipped++; } if (i < times.length && times[i] <= t) return { index: i, skipped }; return { index: -1, next: i, skipped }; }
// Whole body in view: both shoulders and both ankles seen with confidence.
export const fullBody = (lm) => !!lm && [11, 12, 27, 28].every(i => lm[i] && (lm[i].visibility === undefined || lm[i].visibility > 0.5) && lm[i].y > 0.02 && lm[i].y < 0.98);

// iPhone: a sound can only start inside a tap. Start the music for a moment (and an empty utterance) on the tap itself, then the real play after the countdown is allowed.
function unlock(a){ try { const p = a.play(); if (p && p.then) p.then(() => { if (!a._armed) { a.pause(); a.currentTime = 0; } }).catch(() => {}); } catch (e) {} try { speechSynthesis.speak(new SpeechSynthesisUtterance("")); } catch (e) {} }
const RC = { dance: null, stream: null, audio: null, pending: null, times: [], at: 0, canvases: [], labels: [], tick: 0, on: false, facing: "user", lock: null, check: 0 };
const say = (t) => { try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(String(t)); u.rate = 1.1; speechSynthesis.speak(u); } catch (e) {} };
function chime(f = 1320){ try { const ctx = RC.ctx || (RC.ctx = new (window.AudioContext || window.webkitAudioContext)()); const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = f; g.gain.value = 0.25; o.connect(g); g.connect(ctx.destination); const t = ctx.currentTime; o.start(t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2); o.stop(t + 0.25); } catch (e) {} }
function status(html){ $("#rcStatus").innerHTML = html; }
function big(t){ $("#rcBig").textContent = t; $("#rcBig").hidden = !t; }
function grab(label){
  const v = $("#rcCam"); if (!v.videoWidth) return; const scale = Math.min(1, FRAME_PX / Math.max(v.videoWidth, v.videoHeight));
  const cv = document.createElement("canvas"); cv.width = Math.round(v.videoWidth * scale); cv.height = Math.round(v.videoHeight * scale);
  // Only the on-screen preview is mirrored; the coach gets the real left and right.
  const ctx = cv.getContext("2d"); ctx.drawImage(v, 0, 0, cv.width, cv.height);
  RC.canvases.push(cv); RC.labels.push(label); const strip = $("#rcStrip"); const im = document.createElement("img"); im.src = cv.toDataURL("image/jpeg", 0.5); strip.appendChild(im); strip.scrollLeft = strip.scrollWidth;
  $("#rcCount").textContent = `${RC.canvases.length} / ${RC.times.length}`; const flash = $("#rcFlash"); flash.classList.remove("on"); void flash.offsetWidth; flash.classList.add("on"); chime();
}
async function startCamera(){
  stopCamera(); RC.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: RC.facing, width: { ideal: 960 } }, audio: false });
  const v = $("#rcCam"); v.srcObject = RC.stream; v.classList.toggle("mirrored", RC.facing === "user"); await v.play();
}
function stopCamera(){ if (RC.stream) { RC.stream.getTracks().forEach(t => t.stop()); RC.stream = null; } }
async function flip(){ RC.facing = RC.facing === "user" ? "environment" : "user"; try { await startCamera(); } catch (e) { status(`<span class="bad">${esc(e.message || "No camera")}</span>`); } }
// A few seconds of "can I see all of you?" before the start button; never blocks it.
async function bodyCheck(){
  if (!poseAvailable()) return; const id = ++RC.check; const v = $("#rcCam");
  for (let i = 0; i < 12 && RC.on && id === RC.check && !RC.audio; i++) {
    try { const lm = await detectVideoFrame(v, performance.now()); const ok = fullBody(lm); $("#rcSeen").textContent = ok ? "👀 I see all of you" : lm ? "Step back until I see your feet" : "Step into the picture"; $("#rcSeen").className = "chip " + (ok ? "mint" : "sun"); } catch (e) { break; }
    await new Promise(r => setTimeout(r, 700));
  }
}
export async function openRunCheck(danceId){
  const d = dances().find(x => x.id === danceId); const src = d && srcFor(d);
  if (!src) return toast("Add the music to this dance first (More ▸ Add music file).", 3000);
  RC.dance = d; RC.canvases = []; RC.labels = []; RC.audio = null; RC.on = true; RC.check++;
  $("#runcheck").hidden = false; document.body.classList.add("modal"); $("#rcTitle").textContent = `🎥 Run check · ${d.name.split(" · ")[0]}`; $("#rcStrip").innerHTML = ""; $("#rcCount").textContent = ""; $("#rcPrompt").hidden = true; $("#rcPrompt").innerHTML = ""; big(""); $("#rcSeen").textContent = ""; $("#rcSeen").className = "chip";
  $("#rcActions").innerHTML = `<button class="btn ghost" onclick="closeRunCheck()">✕</button><button class="btn sm ghost" onclick="rcFlip()">🔄 Flip</button><button class="btn sm ${S.settings.prompter ? "coral" : "ghost"}" id="rcLines" onclick="rcLines()">📜 Lines</button><button class="btn coral big-btn grow" id="rcStart" onclick="rcStart()" disabled>▶ Start</button>`;
  status("Prop the phone up so the whole stage is in the picture. Tap ▶ Start: 5 count-in, then the music.");
  try { await startCamera(); } catch (e) { status(`<span class="bad">Camera didn't open: ${esc(e.message || e)}. Allow the camera for this app and try again.</span>`); return; }
  const a = new Audio(); a.preload = "auto"; a.src = src.url; RC.pending = a;
  a.addEventListener("loadedmetadata", () => { if (!RC.on) return; RC.times = snapTimes(a.duration, d.cues); $("#rcStart").disabled = false; status(`Music ${Math.round(a.duration)} s · ${RC.times.length} frames at the moves. Tap ▶ Start when she's ready.`); }, { once: true });
  a.addEventListener("error", () => { if (RC.on && a === RC.pending) status(`<span class="bad">The music won't load on this phone. Try another music file.</span>`); });
  a.load(); bodyCheck();
}
async function start(){
  const a = RC.pending; if (!a || !RC.on) return; $("#rcStart").disabled = true; RC.check++; unlock(a);
  try { const lock = await navigator.wakeLock.request("screen"); if (RC.on) RC.lock = lock; else lock.release(); } catch (e) {}
  for (let n = 5; n >= 1; n--) { if (!RC.on) return; big(String(n)); say(n); chime(n === 1 ? 1760 : 880); await new Promise(r => setTimeout(r, 1000)); }
  big("GO"); setTimeout(() => big(""), 700); RC.audio = a; RC.at = 0; $("#rcActions").innerHTML = `<button class="btn ghost" onclick="rcStop()">■ Stop</button>`;
  a._armed = true; a.currentTime = 0;
  try { await a.play(); } catch (e) { status(`<span class="bad">Couldn't play the music: ${esc(e.message || e)}</span>`); return; }
  status("Dancing… frames snap on their own. Keep going to the end.");
  a.onended = () => finish();
  const pr = $("#rcPrompt"); pr.hidden = !S.settings.prompter; let lastPr = -1;
  const loop = () => { if (!RC.on || !RC.audio) return clearInterval(RC.tick); const t = a.currentTime; if (S.settings.prompter) { const sec = Math.floor(t * 2); if (sec !== lastPr) { lastPr = sec; pr.innerHTML = prompterHtml(RC.dance.cues, t); } } const r = dueFrame(RC.times, t, RC.at); if (r.index >= 0) { grab(RC.times[r.index].toFixed(1) + "s"); RC.at = r.index + 1; } else RC.at = r.next; if (RC.at >= RC.times.length && t > (RC.times[RC.times.length - 1] || 0) + 1) return finish(); };
  clearInterval(RC.tick); RC.tick = setInterval(loop, 80); // a timer, not rAF: keeps snapping if the screen dims
}
function finish(){
  if (!RC.audio) return; clearInterval(RC.tick); try { RC.audio.pause(); } catch (e) {} RC.audio = null; stopCamera(); if (RC.lock) { try { RC.lock.release(); } catch (e) {} RC.lock = null; }
  const n = RC.canvases.length; big("");
  if (n < 3) { status(`<span class="bad">Only ${n} frame${n === 1 ? "" : "s"} came out. Check the camera is allowed and try again.</span>`); $("#rcActions").innerHTML = `<button class="btn ghost" onclick="closeRunCheck()">Close</button><button class="btn coral big-btn grow" onclick="openRunCheck('${RC.dance.id}')">Again</button>`; return; }
  status(`${n} frames. Send them to the coach, or do it again.`);
  $("#rcActions").innerHTML = `<button class="btn ghost" onclick="openRunCheck('${RC.dance.id}')">Again</button><button class="btn coral big-btn grow" onclick="rcSend()">✨ Send to the coach</button>`;
}
function stop(){ if (RC.audio) finish(); else closeRunCheck(); }
async function lines(){ await setSettings({ prompter: !S.settings.prompter }); const b = $("#rcLines"); if (b) b.className = `btn sm ${S.settings.prompter ? "coral" : "ghost"}`; const pr = $("#rcPrompt"); if (pr) pr.hidden = !S.settings.prompter; }
async function send(){ const d = RC.dance, cvs = RC.canvases, labels = RC.labels; if (cvs.length < 3) return; closeRunCheck(); await openCoachFrames(d.id, cvs, labels); }
export function closeRunCheck(){ RC.on = false; RC.check++; clearInterval(RC.tick); if (RC.audio) { try { RC.audio.pause(); } catch (e) {} RC.audio = null; } if (RC.pending) { try { RC.pending.pause(); RC.pending.src = ""; } catch (e) {} RC.pending = null; } stopCamera(); if (RC.lock) { try { RC.lock.release(); } catch (e) {} RC.lock = null; } try { speechSynthesis.cancel(); } catch (e) {} $("#runcheck").hidden = true; document.body.classList.remove("modal"); }
export function initRunCheck(){ $("#rcClose").onclick = closeRunCheck; }
expose({ openRunCheck, closeRunCheck, rcStart: start, rcStop: stop, rcFlip: flip, rcSend: send, rcLines: lines });
