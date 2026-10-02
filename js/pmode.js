// Practice mode: the checklist one item at a time, full screen. Manual (tap Done) or timed (each item's own length,
// auto-advance with a click). Every Done is saved to the day's practice record immediately — nothing resets.
// The dancer and a ring show progress; confetti at the end.
import { $, esc, todayStr, toast, expose } from "./util.js";
import { PRACTICE_ITEMS, P, MOVES, EXERCISES, ARMS, BASE } from "./data.js";
import { planFor } from "./planToday.js";
import { poseAt } from "./games/choreo.js";
import { S, storeSet } from "./store.js";
import { avatarSVG } from "./avatar.js";
import { checkBadges } from "./badges.js";
import { confetti } from "./views/practice.js";
import { demoFor, demoHtml } from "./demos.js";
import { awardStars } from "./stars.js";

const KIND = { warm:"🔥", core:"💪", legs:"🦵", str:"💪", flex:"🧘", tech:"🩰", run:"▶️", fix:"🎯", trick:"✨", aerial:"🤸" };
let ITEMS = [];
const PM = { i: 0, timed: false, left: 0, total: 0, timer: 0, paused: false, ctx: null };

// Pure: which item to show next — the first unchecked one at or after `from`, else the first unchecked anywhere, else -1.
export function nextIndex(items, done, from = 0){
  const d = new Set(done || []);
  for (let i = from; i < items.length; i++) if (!d.has(items[i].id)) return i;
  for (let i = 0; i < from; i++) if (!d.has(items[i].id)) return i;
  return -1;
}
// The dancer rises with progress: slumped arms at 0% → arms wide → arms up on relevé at 100%.
export function progressPose(pct){
  const t = Math.max(0, Math.min(1, pct / 100)); const mix = (a, b) => a + (b - a) * t;
  return P({ el: [mix(-26, -22), mix(-16, -70)], er: [mix(26, 22), mix(-16, -70)], hl: [mix(-30, -14), mix(12, -100)], hr: [mix(30, 14), mix(12, -100)], h: [0, mix(-74, -80)], lift: mix(0, 8), fl: [mix(-12, -6), 70], fr: [mix(12, 6), 70] });
}
const rec = () => S.practice[todayStr()] || { done: [], note: "", runs: [] };
const pct = () => Math.round(100 * (rec().done || []).filter(id => ITEMS.some(i => i.id === id)).length / Math.max(1, ITEMS.length));
// Keyframes for an item's pose: a game move (moves.json) or an exercise (exercises.json, same joint schema).
export function framesFor(pose){ const mv = MOVES.find(x => x.id === pose); if (mv) return mv.k; const ex = EXERCISES[pose]; if (!ex) return null; return ex.map(kf => { const { arms, ...rest } = kf; return Object.assign({}, BASE, arms && ARMS[arms] ? ARMS[arms] : {}, rest); }); }
let animRaf = 0, animT0 = 0;
function animate(frames){ cancelAnimationFrame(animRaf); if (!frames) return;
  // Lying-down poses are wide, standing ones tall: pick the frame to fit.
  const lying = frames.some(f => Math.abs(f.rot || 0) >= 45 && Math.abs(f.rot || 0) <= 135); $("#pmDancer").setAttribute("viewBox", lying ? "20 70 260 170" : "70 30 160 230"); const k = frames.length > 1 ? frames : [frames[0], frames[0]]; const mv = { id: "ex", k }; animT0 = performance.now(); const dur = 1400 * Math.max(1, k.length - 1);
  const f = () => { const t = ((performance.now() - animT0) % (dur * 2)) / dur; const u = t <= 1 ? t : 2 - t; const pose = poseAt(mv, u); $("#pmDancer").innerHTML = `<rect x="70" y="240" width="160" height="20" fill="#F7A8C6" opacity=".35"/>${avatarSVG(pose)}`; animRaf = requestAnimationFrame(f); }; f(); }

function ring(p){ const r = 44, c = 2 * Math.PI * r; return `<svg viewBox="0 0 100 100" class="ring pm-ring"><circle cx="50" cy="50" r="${r}" class="ring-bg"/><circle cx="50" cy="50" r="${r}" class="ring-fg" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - p / 100)}"/><text x="50" y="50" class="ring-txt">${p}%</text></svg>`; }
function render(){
  const items = ITEMS; const done = rec().done || []; const p = pct(); const n = done.filter(id => items.some(i => i.id === id)).length;
  const cur = PM.i >= 0 ? items[PM.i] : null; const frames = cur ? framesFor(cur.pose) : null; const demo = cur ? demoFor(cur.id) : null;
  const box = $("#pmDemo"); box.hidden = !demo; box.style.display = demo ? "grid" : "none"; const dancer = $("#pmDancer"); dancer.hidden = !!demo; dancer.style.display = demo ? "none" : ""; if (demo) { cancelAnimationFrame(animRaf); box.innerHTML = demoHtml(demo); }
  const pic = $("#pmPic"); pic.hidden = !cur; if (cur) pic.innerHTML = `<button class="lnk" onclick="openDemoSheet('${cur.id}','${esc(cur.text.split(/[:—(]/)[0].trim())}')">${demo ? "📷 Change picture" : "📷 Use a photo or clip"}</button>`;
  if (demo) {} else if (frames) animate(frames); else { cancelAnimationFrame(animRaf); $("#pmDancer").setAttribute("viewBox", "70 30 160 230"); $("#pmDancer").innerHTML = `<rect x="70" y="240" width="160" height="20" fill="#F7A8C6" opacity=".35"/>${avatarSVG(progressPose(p))}`; }
  $("#pmRing").innerHTML = ring(p); $("#pmCount").textContent = `${n} / ${items.length}`;
  if (PM.i < 0) { $("#pmItem").innerHTML = `<div class="pm-text">All done! 🎉</div><div class="small muted">Today counts. Go you.</div>`; $("#pmActions").innerHTML = `<button class="btn coral big-btn" onclick="pmClose()">Done</button>`; $("#pmTimer").hidden = true; return; }
  const it = items[PM.i];
  $("#pmItem").innerHTML = `<div class="pm-kind">${KIND[it.kind] || "✨"}</div><div class="pm-text">${esc(it.text)}</div>`;
  const secs = +it.secs || 0;
  $("#pmTimer").hidden = !PM.timed; if (PM.timed) $("#pmTimer").innerHTML = secs ? `<div class="pm-clock ${PM.paused ? "paused" : ""}">${fmt(PM.left)}</div><button class="btn sm ghost" onclick="pmPause()">${PM.paused ? "▶ Go" : "❚❚ Pause"}</button>` : `<div class="small muted">No timer for this one — tap Done when finished.</div>`;
  $("#pmActions").innerHTML = `<button class="btn ghost" onclick="pmSkip()">Skip</button><button class="btn coral big-btn grow" onclick="pmDone()">✅ Done</button>`;
  $("#pmMode").innerHTML = `<button class="btn sm ${PM.timed ? "ghost" : "coral"}" onclick="pmSetTimed(false)">Manual</button><button class="btn sm ${PM.timed ? "coral" : "ghost"}" onclick="pmSetTimed(true)">Timed</button>`;
}
const fmt = (s) => Math.floor(s / 60) + ":" + String(Math.max(0, s) % 60).padStart(2, "0");
function startTimer(){ clearInterval(PM.timer); const it = ITEMS[PM.i]; if (!PM.timed || !it || !+it.secs) return; PM.left = +it.secs; PM.paused = false;
  PM.timer = setInterval(() => { if (PM.paused) return; PM.left--; const el = $("#pmTimer .pm-clock"); if (el) el.textContent = fmt(PM.left); if (PM.left <= 0) { clearInterval(PM.timer); beep(); done(); } }, 1000); }
function beep(){ try { if (!PM.ctx) PM.ctx = new (window.AudioContext || window.webkitAudioContext)(); const o = PM.ctx.createOscillator(), g = PM.ctx.createGain(); o.frequency.value = 1046; g.gain.value = 0.3; o.connect(g); g.connect(PM.ctx.destination); const t = PM.ctx.currentTime; o.start(t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35); o.stop(t + 0.4); } catch (e) {} }
async function done(){
  if (PM.busy) return; PM.busy = true;
  try {
  const it = ITEMS[PM.i]; if (!it) return; const r = rec(); const doneIds = [...new Set([...(r.done || []), it.id])];
  const date = todayStr(); await storeSet("practice", date, { ...r, done: doneIds, total: ITEMS.length });
  if (it.aerialId) { const ad = new Set(S.settings.aerial || []); if (!ad.has(it.aerialId)) { ad.add(it.aerialId); await storeSet("settings", "main", { ...S.settings, aerial: [...ad] }); } }
  try { localStorage.setItem("spotlight:practice:" + date, JSON.stringify(doneIds)); } catch (e) {}
  advance();
  } finally { PM.busy = false; }
}
function advance(){ PM.i = nextIndex(ITEMS, rec().done, PM.i + 1); render(); if (PM.i < 0) { clearInterval(PM.timer); confetti(); checkBadges(); awardStars("practice", 100, "Practice done"); } else startTimer(); }
function skip(){ PM.i = nextIndex(ITEMS, rec().done, PM.i + 1); if (PM.i < 0) PM.i = nextIndex(ITEMS, rec().done, 0); render(); startTimer(); }
function setTimed(v){ PM.timed = v; try { localStorage.setItem("spotlight:pmode", v ? "timed" : "manual"); } catch (e) {} render(); startTimer(); }
function pause(){ PM.paused = !PM.paused; render(); }
export function openPracticeMode(){
  try { PM.timed = localStorage.getItem("spotlight:pmode") === "timed"; } catch (e) {}
  ITEMS = planFor(todayStr()); PM.i = nextIndex(ITEMS, rec().done, 0); if (PM.i < 0) PM.i = 0;
  $("#pmode").hidden = false; document.body.classList.add("modal"); render(); startTimer();
}
export function closePracticeMode(){ clearInterval(PM.timer); cancelAnimationFrame(animRaf); $("#pmode").hidden = true; document.body.classList.remove("modal"); }
export function initPracticeMode(){ $("#pmClose").onclick = closePracticeMode; $("#startPractice").onclick = openPracticeMode; document.addEventListener("demochanged", () => { if (!$("#pmode").hidden) render(); }); }
expose({ pmDone: done, pmSkip: skip, pmSetTimed: setTimed, pmPause: pause, pmClose: closePracticeMode, openPracticeMode });
