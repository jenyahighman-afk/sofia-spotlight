// Mirror game: copy the dancer with the front camera. Big target dancer beside (or above) the camera, one instruction at a
// time, a match meter that fills while she holds the pose, green skeleton when it matches, a chime + flash on success.
// Rounds: 5 poses to copy (hold 2 s each), relevé hold (6 s), then "hit count 1" to the solo's track (or a click track).
// Nothing is recorded or uploaded; the camera feed never leaves the phone.
import { $, esc, toast, expose } from "../util.js";
import { P } from "../data.js";
import { S, dances, setSettings } from "../store.js";
import { avatarSVG } from "../avatar.js";
import { videoDetector, detectVideoFrame, drawSkeleton, poseAvailable } from "../pose.js";
import { onReleve, armPose } from "../posemath.js";
import { awardStars } from "../stars.js";

const ARMS = { up: { el: [-22, -70], er: [22, -70], hl: [-14, -100], hr: [14, -100] }, second: { el: [-40, -40], er: [40, -40], hl: [-66, -30], hr: [66, -30] }, low: { el: [-26, -18], er: [26, -18], hl: [-34, 8], hr: [34, 8] } };
const POSES = [
  { key: "up", say: "Arms up high!", emoji: "🙌" }, { key: "second", say: "Arms out wide!", emoji: "🤸" }, { key: "low", say: "Arms down, stand tall", emoji: "🧍" },
  { key: "up", say: "Up again — reach!", emoji: "🙌" }, { key: "second", say: "Wide, like wings", emoji: "🕊️" },
];
const M = { speak: true, on: false, stream: null, raf: 0, phase: "", score: 0, pi: 0, hold: 0, need: 2, t0: 0, ctx: null, audio: null, beat: 0, hits: 0, lastWristY: 0, lastVel: 0, lastBeat: -1, sway: 0, matching: false, armed: false };

const say = (t, speak = true) => { if ($("#mgSay").textContent === t) return; $("#mgSay").textContent = t; if (speak && M.speak) speakOut(t); };
function speakOut(t){ try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(String(t).replace(/[^\p{L}\p{N} ,.!?'-]/gu, "")); u.rate = 1.05; u.pitch = 1.1; speechSynthesis.speak(u); } catch (e) {} }
const seen = (t) => { $("#mgSeen").textContent = t; };
const SEE = { up: "I see: arms up", second: "I see: arms wide", low: "I see: arms down", mixed: "I see: one arm up, one down" };
const meter = (f) => { $("#mgMeterFill").style.width = Math.round(Math.max(0, Math.min(1, f)) * 100) + "%"; };
function ensureCtx(){ try { if (!M.ctx) M.ctx = new (window.AudioContext || window.webkitAudioContext)(); if (M.ctx.state === "suspended") M.ctx.resume(); } catch (e) {} }
function tone(freq, dur = 0.12, gain = 0.25, type = "sine"){ if (!M.ctx) return; const o = M.ctx.createOscillator(), g = M.ctx.createGain(); o.type = type; o.frequency.value = freq; g.gain.value = gain; o.connect(g); g.connect(M.ctx.destination); const t = M.ctx.currentTime; o.start(t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.stop(t + dur + 0.02); }
const chime = () => { tone(784, .12); setTimeout(() => tone(1046, .14), 90); setTimeout(() => tone(1318, .2), 180); };
const click = (one) => tone(one ? 1320 : 880, .06, .2, "square");
function flash(){ const el = $("#mgFlash"); el.classList.remove("on"); void el.offsetWidth; el.classList.add("on"); }
function addScore(n){ M.score += n; $("#mgScore").textContent = M.score; }

// The target dancer: mirrored so she can copy without thinking, with a gentle sway so she isn't a statue.
function drawTarget(key, extra = {}){
  const t = performance.now() / 1000; const sway = Math.sin(t * 1.6) * 3, breathe = Math.sin(t * 2.2) * 1.5;
  const pose = P({ ...(ARMS[key] || {}), ...extra }); pose.h = [pose.h[0] + sway * 0.6, pose.h[1] + breathe * 0.4]; pose.hl = [pose.hl[0] + sway, pose.hl[1] + breathe]; pose.hr = [pose.hr[0] + sway, pose.hr[1] + breathe]; pose.lift = (pose.lift || 0) + breathe * 0.5;
  $("#mgTargetSvg").innerHTML = `<g transform="translate(300 0) scale(-1 1)"><rect x="70" y="240" width="160" height="20" fill="#F7A8C6" opacity=".35"/>${avatarSVG(pose)}</g>`;
}

export async function startMirror(){
  if (!poseAvailable() || !navigator.mediaDevices) return toast("The mirror needs a camera and a newer phone");
  $("#mirror").hidden = false; document.body.classList.add("modal"); M.speak = localStorage.getItem("spotlight:mirrorVoice") !== "off"; $("#mgVoice").textContent = M.speak ? "🔊" : "🔇"; seen(""); M.score = 0; $("#mgScore").textContent = "0"; say("Loading the mirror…"); meter(0); drawTarget("up"); $("#mgActions").innerHTML = `<button class="btn ghost" onclick="stopMirror()">✕ Stop</button>`; $("#mgRound").textContent = "";
  try {
    M.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 } }, audio: false });
    const v = $("#mgVideo"); v.srcObject = M.stream; await v.play(); await videoDetector();
  } catch (e) { console.warn(e); say("No camera here. Allow the camera, or try on a phone."); $("#mgActions").innerHTML = `<button class="btn ghost" onclick="stopMirror()">Close</button>`; return; }
  ensureCtx(); M.on = true; M.pi = 0; drawTarget("low"); await countdown("Copy the dancer!"); if (!M.on) return; startPose(); loop();
}
export function stopMirror(){ M.on = false; cancelAnimationFrame(M.raf); if (M.stream) { M.stream.getTracks().forEach(t => t.stop()); M.stream = null; } if (M.audio) { try { M.audio.pause(); } catch (e) {} M.audio = null; } $("#mirror").hidden = true; document.body.classList.remove("modal"); }

async function countdown(label){ speakOut(label); await new Promise(r => setTimeout(r, 900)); for (const n of [3, 2, 1]) { if (!M.on) return; $("#mgRound").textContent = label; say(String(n)); click(n === 1); await new Promise(r => setTimeout(r, 700)); } }

// ---- round 1: copy poses ----
function startPose(){ M.phase = "pose"; M.hold = 0; M.need = 2; const p = POSES[M.pi]; $("#mgRound").textContent = `Pose ${M.pi + 1} of ${POSES.length}`; say(`${p.emoji} ${p.say}`); meter(0); }
async function posePassed(){ addScore(40); chime(); flash(); say("YES! ✨"); meter(1); M.phase = "pause"; await new Promise(r => setTimeout(r, 900)); if (!M.on) return; M.pi++; if (M.pi < POSES.length) startPose(); else startReleve(); }
// ---- round 2: relevé ----
async function startReleve(){ M.phase = "pause"; await countdown("Now rise up on your toes"); if (!M.on) return; M.phase = "releve"; M.hold = 0; M.need = 6; $("#mgRound").textContent = "Relevé"; say("🩰 Up on your toes and hold!"); drawTarget("second", { lift: 8, kl: [-4, 36], kr: [4, 36], fl: [-6, 70], fr: [6, 70] }); meter(0); }
async function relevePassed(){ addScore(80); chime(); flash(); say("Held it! ✨"); M.phase = "pause"; await new Promise(r => setTimeout(r, 900)); if (M.on) startBeat(); }
// ---- round 3: count 1 ----
async function startBeat(){
  M.phase = "pause"; const d = dances().find(x => x.id === "solo") || dances().find(x => +x.bpm) || {}; const bpm = +d.bpm || 76; M.beat = 60000 / bpm; M.hits = 0; M.lastBeat = -1;
  await countdown("Last one: lift your arms on count 1"); if (!M.on) return;
  if (d.musicFile && d.musicFile.url) { try { M.audio = new Audio(d.musicFile.url); M.audio.currentTime = +d.countOffset || 0; await M.audio.play(); } catch (e) { console.warn("no music, using clicks", e); M.audio = null; } }
  M.phase = "beat"; M.t0 = performance.now(); $("#mgRound").textContent = `${bpm} BPM · ${M.audio ? "with the solo" : "click track"}`; say("🎵 Arms UP on every 1!"); meter(0);
}
async function beatDone(){ M.phase = "pause"; if (M.audio) { try { M.audio.pause(); } catch (e) {} M.audio = null; } const bonus = M.hits * 30; addScore(bonus); chime(); flash(); say(`${M.hits} on the beat! ✨`); await new Promise(r => setTimeout(r, 900)); finish(); }

async function finish(){
  M.on = false; cancelAnimationFrame(M.raf); $("#mgRound").textContent = "Done!"; say(`${M.score} points ⭐`); meter(1);
  if (M.score > (S.settings.mirrorBest || 0)) await setSettings({ mirrorBest: M.score });
  const r = await awardStars("mirror", M.score, "Mirror"); $("#mgRound").textContent = `Done! +${r.earned + r.bonus} ⭐`;
  $("#mgActions").innerHTML = `<button class="btn coral" onclick="startMirror()">▶ Again</button><button class="btn ghost" onclick="stopMirror()">Done</button>`;
  if (M.stream) { M.stream.getTracks().forEach(t => t.stop()); M.stream = null; }
}

async function loop(){
  if (!M.on) return; const v = $("#mgVideo"), cv = $("#mgCanvas");
  if (M.phase === "pose") drawTarget(POSES[M.pi].key); else if (M.phase === "beat") { const beatN = Math.floor((performance.now() - M.t0) / M.beat); const c = (beatN % 8) + 1; drawTarget(c === 1 ? "up" : "low"); $("#mgCount").textContent = c; $("#mgCount").classList.toggle("one", c === 1); if (beatN !== M.lastBeat) { M.lastBeat = beatN; if (!M.audio) click(c === 1); } }
  if (v.videoWidth) {
    cv.width = v.videoWidth; cv.height = v.videoHeight; const ctx = cv.getContext("2d"); ctx.clearRect(0, 0, cv.width, cv.height);
    let lm = null; try { lm = await detectVideoFrame(v, performance.now()); } catch (e) {}
    const dt = 1 / 30;
    if (M.phase === "pose") { const ap = lm ? armPose(lm) : null; seen(ap ? SEE[ap] || "" : ""); const ok = !!lm && ap === POSES[M.pi].key; M.matching = ok; if (ok) { M.hold += dt; meter(M.hold / M.need); if (M.hold >= M.need) { await posePassed(); } } else { M.hold = Math.max(0, M.hold - dt * 2); meter(M.hold / M.need); if (lm && M.hold === 0) say(`${POSES[M.pi].emoji} ${POSES[M.pi].say}`, false); } }
    else if (M.phase === "releve") { const ok = !!lm && onReleve(lm); seen(lm ? (ok ? "I see: on your toes" : "I see: heels down") : ""); M.matching = ok; if (ok) { M.hold += dt; meter(M.hold / M.need); say(`Hold… ${Math.ceil(M.need - M.hold)}`, false); if (M.hold >= M.need) await relevePassed(); } else { M.hold = Math.max(0, M.hold - dt); meter(M.hold / M.need); if (lm) say("🩰 Heels up! Rise and hold", false); } }
    else if (M.phase === "beat" && lm) { const wy = ((lm[15] ? lm[15].y : 0) + (lm[16] ? lm[16].y : 0)) / 2; const vel = M.lastWristY - wy; const peak = vel > 0.02 && M.lastVel <= 0.02; M.lastVel = vel; M.lastWristY = wy;
      if (peak) { const phase = ((performance.now() - M.t0) % (M.beat * 8)) / M.beat; const near = phase < 0.6 || phase > 7.4; M.matching = near; if (near) { M.hits++; addScore(0); meter(M.hits / 4); say(`On it! ${M.hits} of 4 ✨`); chime(); } else say("Almost — wait for the 1"); if (M.hits >= 4) await beatDone(); }
      if (performance.now() - M.t0 > M.beat * 8 * 6) await beatDone(); }
    if (lm) drawSkeleton(ctx, lm, cv.width, cv.height, M.matching ? "#2E9E6B" : "#FF5C93");
    else if (M.phase === "pose" || M.phase === "releve") say("Step back so I can see all of you", false);
  }
  M.raf = requestAnimationFrame(loop);
}
export function initMirror(){ $("#mgClose").onclick = stopMirror; $("#mgVoice").onclick = () => { M.speak = !M.speak; localStorage.setItem("spotlight:mirrorVoice", M.speak ? "on" : "off"); $("#mgVoice").textContent = M.speak ? "🔊" : "🔇"; }; }
expose({ startMirror, stopMirror });
