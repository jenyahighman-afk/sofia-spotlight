// Mirror game: the phone camera + on-device pose. Three rounds — hold a relevé 10 s, match three arm positions to the
// dancer, then hit count 1 on the beat at the dance's BPM. Nothing is recorded or uploaded.
import { $, esc, toast, expose } from "../util.js";
import { P } from "../data.js";
import { S, dances } from "../store.js";
import { avatarSVG } from "../avatar.js";
import { videoDetector, detectVideoFrame, drawSkeleton, poseAvailable } from "../pose.js";
import { onReleve, armPose } from "../posemath.js";

const M = { on: false, stream: null, raf: 0, round: 0, score: 0, t0: 0, hold: 0, targets: [], ti: 0, matched: 0, beats: [], hits: 0, lastWristY: 0, lastVel: 0 };
const ARMS = { up: { el: [-22, -70], er: [22, -70], hl: [-14, -100], hr: [14, -100] }, second: { el: [-40, -40], er: [40, -40], hl: [-66, -30], hr: [66, -30] }, low: { el: [-26, -18], er: [26, -18], hl: [-34, 8], hr: [34, 8] } };
const say = (t) => { $("#mgMsg").textContent = t; };

export async function startMirror(){
  if (!poseAvailable() || !navigator.mediaDevices) return toast("The mirror needs a camera and a newer phone");
  $("#mirror").hidden = false; document.body.classList.add("modal"); say("Loading the mirror…"); $("#mgScore").textContent = "0";
  try {
    M.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 } }, audio: false });
    const v = $("#mgVideo"); v.srcObject = M.stream; await v.play(); await videoDetector();
  } catch (e) { console.warn(e); say("No camera here. Allow the camera, or try on a phone."); $("#mgActions").innerHTML = `<button class="btn ghost" onclick="stopMirror()">Close</button>`; return; }
  M.on = true; M.score = 0; M.round = 0; nextRound(); loop();
}
export function stopMirror(){ M.on = false; cancelAnimationFrame(M.raf); if (M.stream) { M.stream.getTracks().forEach(t => t.stop()); M.stream = null; } $("#mirror").hidden = true; document.body.classList.remove("modal"); }

function nextRound(){
  M.round++; M.t0 = performance.now(); M.hold = 0; M.ti = 0; M.matched = 0; M.hits = 0;
  if (M.round === 1) { say("Round 1: rise to relevé and hold for 10 seconds"); $("#mgTarget").innerHTML = ""; }
  else if (M.round === 2) { M.targets = ["second", "up", "low"]; say("Round 2: match the dancer's arms"); showTarget(); }
  else if (M.round === 3) { const d = dances().find(x => +x.bpm) || {}; const bpm = +d.bpm || 76; M.beat = 60000 / bpm; M.count = 0; M.beats = []; say(`Round 3: lift your arms on every count 1 · ${bpm} BPM`); $("#mgTarget").innerHTML = `<div class="pl-count" id="mgCount">…</div>`; }
  else { M.on = false; say(`Done! ${M.score} points ✨`); if (M.score > (S.settings.mirrorBest || 0)) { import("../store.js").then(m => m.setSettings({ mirrorBest: M.score })); } $("#mgActions").innerHTML = `<button class="btn coral" onclick="startMirror()">Again</button><button class="btn ghost" onclick="stopMirror()">Done</button>`; }
  $("#mgActions").innerHTML = M.on ? `<button class="btn ghost" onclick="stopMirror()">✕ Stop</button>` : $("#mgActions").innerHTML;
}
function showTarget(){ const k = M.targets[M.ti]; $("#mgTarget").innerHTML = `<svg viewBox="70 30 160 230" class="mg-avatar">${avatarSVG(P({ ...ARMS[k], lift: 4 }))}</svg><div class="small">${k === "up" ? "Arms up" : k === "second" ? "Arms in second" : "Arms low"}</div>`; }
function addScore(n){ M.score += n; $("#mgScore").textContent = M.score; }

async function loop(){
  if (!M.on) return; const v = $("#mgVideo"), cv = $("#mgCanvas");
  if (v.videoWidth) { cv.width = v.videoWidth; cv.height = v.videoHeight; const ctx = cv.getContext("2d"); ctx.clearRect(0, 0, cv.width, cv.height);
    let lm = null; try { lm = await detectVideoFrame(v, performance.now()); } catch (e) {}
    if (lm) drawSkeleton(ctx, lm, cv.width, cv.height, "#2ED3C8");
    const now = performance.now();
    if (M.round === 1) { if (lm && onReleve(lm)) { M.hold += 1 / 30; say(`Hold it… ${Math.max(0, 10 - M.hold).toFixed(0)} s`); if (M.hold >= 10) { addScore(100); toast("Relevé held! +100"); nextRound(); } } else if (M.hold > 0) { say("Heels up! Back on relevé"); M.hold = Math.max(0, M.hold - 0.05); } }
    else if (M.round === 2) { if (lm && armPose(lm) === M.targets[M.ti]) { M.matched++; if (M.matched > 20) { addScore(50); toast("Match! +50"); M.ti++; M.matched = 0; if (M.ti >= M.targets.length) nextRound(); else showTarget(); } } else M.matched = Math.max(0, M.matched - 1); }
    else if (M.round === 3) {
      const beatN = Math.floor((now - M.t0) / M.beat); const c = (beatN % 8) + 1; const el = $("#mgCount"); if (el && +el.textContent !== c) { el.textContent = c; el.classList.toggle("one", c === 1); }
      if (lm) { const wy = ((lm[15] ? lm[15].y : 0) + (lm[16] ? lm[16].y : 0)) / 2; const vel = M.lastWristY - wy; const peak = vel > 0.02 && M.lastVel <= 0.02; M.lastVel = vel; M.lastWristY = wy;
        if (peak) { const phase = ((now - M.t0) % (M.beat * 8)) / M.beat; const near = phase < 0.5 || phase > 7.5; if (near) { M.hits++; addScore(30); say(`On it! ${M.hits}/4`); } else say("Early or late — wait for 1"); if (M.hits >= 4) nextRound(); } }
      if (now - M.t0 > M.beat * 8 * 6) { say("Time! Nice try"); nextRound(); }
    }
  }
  M.raf = requestAnimationFrame(loop);
}
export function initMirror(){ $("#mgClose").onclick = stopMirror; }
expose({ startMirror, stopMirror });
