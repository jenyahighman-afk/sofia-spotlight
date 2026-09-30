// Practice mode: the checklist one item at a time, full screen. Manual (tap Done) or timed (each item's own length,
// auto-advance with a click). Every Done is saved to the day's practice record immediately — nothing resets.
// The dancer and a ring show progress; confetti at the end.
import { $, esc, todayStr, toast, expose } from "./util.js";
import { PRACTICE_ITEMS, P } from "./data.js";
import { S, storeSet } from "./store.js";
import { avatarSVG } from "./avatar.js";
import { checkBadges } from "./badges.js";
import { confetti } from "./views/practice.js";

const KIND = { warm:"🔥", str:"💪", flex:"🧘", tech:"🩰", run:"▶️" };
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
const pct = () => Math.round(100 * (rec().done || []).filter(id => PRACTICE_ITEMS.some(i => i.id === id)).length / Math.max(1, PRACTICE_ITEMS.length));

function ring(p){ const r = 44, c = 2 * Math.PI * r; return `<svg viewBox="0 0 100 100" class="ring pm-ring"><circle cx="50" cy="50" r="${r}" class="ring-bg"/><circle cx="50" cy="50" r="${r}" class="ring-fg" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - p / 100)}"/><text x="50" y="50" class="ring-txt">${p}%</text></svg>`; }
function render(){
  const items = PRACTICE_ITEMS; const done = rec().done || []; const p = pct(); const n = done.filter(id => items.some(i => i.id === id)).length;
  $("#pmDancer").innerHTML = `<rect x="70" y="240" width="160" height="20" fill="#F7A8C6" opacity=".35"/>${avatarSVG(progressPose(p))}`;
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
function startTimer(){ clearInterval(PM.timer); const it = PRACTICE_ITEMS[PM.i]; if (!PM.timed || !it || !+it.secs) return; PM.left = +it.secs; PM.paused = false;
  PM.timer = setInterval(() => { if (PM.paused) return; PM.left--; const el = $("#pmTimer .pm-clock"); if (el) el.textContent = fmt(PM.left); if (PM.left <= 0) { clearInterval(PM.timer); beep(); done(); } }, 1000); }
function beep(){ try { if (!PM.ctx) PM.ctx = new (window.AudioContext || window.webkitAudioContext)(); const o = PM.ctx.createOscillator(), g = PM.ctx.createGain(); o.frequency.value = 1046; g.gain.value = 0.3; o.connect(g); g.connect(PM.ctx.destination); const t = PM.ctx.currentTime; o.start(t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35); o.stop(t + 0.4); } catch (e) {} }
async function done(){
  if (PM.busy) return; PM.busy = true;
  try {
  const it = PRACTICE_ITEMS[PM.i]; if (!it) return; const r = rec(); const doneIds = [...new Set([...(r.done || []), it.id])];
  const date = todayStr(); await storeSet("practice", date, { ...r, done: doneIds });
  try { localStorage.setItem("spotlight:practice:" + date, JSON.stringify(doneIds)); } catch (e) {}
  advance();
  } finally { PM.busy = false; }
}
function advance(){ PM.i = nextIndex(PRACTICE_ITEMS, rec().done, PM.i + 1); render(); if (PM.i < 0) { clearInterval(PM.timer); confetti(); checkBadges(); } else startTimer(); }
function skip(){ PM.i = nextIndex(PRACTICE_ITEMS, rec().done, PM.i + 1); if (PM.i < 0) PM.i = nextIndex(PRACTICE_ITEMS, rec().done, 0); render(); startTimer(); }
function setTimed(v){ PM.timed = v; try { localStorage.setItem("spotlight:pmode", v ? "timed" : "manual"); } catch (e) {} render(); startTimer(); }
function pause(){ PM.paused = !PM.paused; render(); }
export function openPracticeMode(){
  try { PM.timed = localStorage.getItem("spotlight:pmode") === "timed"; } catch (e) {}
  PM.i = nextIndex(PRACTICE_ITEMS, rec().done, 0); if (PM.i < 0) PM.i = 0;
  $("#pmode").hidden = false; document.body.classList.add("modal"); render(); startTimer();
}
export function closePracticeMode(){ clearInterval(PM.timer); $("#pmode").hidden = true; document.body.classList.remove("modal"); }
export function initPracticeMode(){ $("#pmClose").onclick = closePracticeMode; $("#startPractice").onclick = openPracticeMode; }
expose({ pmDone: done, pmSkip: skip, pmSetTimed: setTimed, pmPause: pause, pmClose: closePracticeMode, openPracticeMode });
