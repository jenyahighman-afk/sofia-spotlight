// Mind skills: one lesson a week with a one-minute try (Today), the pre-stage routine Sofia builds from a menu (Me) and
// runs step by step (comp card, Me), and the comp-day fuel plan (comp card). Data in data/mind.json. Pure parts up top.
import { $, esc, todayStr, expose } from "./util.js";
import { MIND } from "./data.js";
import { S, setSettings } from "./store.js";
import { dayNumber } from "./plan.js";
import { openStage, stageActions, closeStage } from "./stage.js";
import { awardStars } from "./stars.js";

// Weeks run Monday → Sunday (the epoch day was a Thursday, hence the +3).
export const weekLesson = (date, lessons = MIND.lessons) => lessons.length ? lessons[Math.floor((dayNumber(date) + 3) / 7) % lessons.length] : null;
export const MAX_RITUAL = 6;
// The routine as ordered steps: menu order, only the chosen ids, at most MAX_RITUAL.
export function ritualSteps(ids, menu = MIND.ritual){ const set = new Set(Array.isArray(ids) ? ids : []); return menu.filter(s => set.has(s.id)).slice(0, MAX_RITUAL); }
export const ritualSecs = (steps) => steps.reduce((a, s) => a + (+s.secs || 0), 0);
export const DEFAULT_RITUAL = ["shake", "breathe", "story", "focal"];

const M = { timer: 0, left: 0, steps: [], i: 0, kind: "" };
function chime(f = 1046){ try { const ctx = M.ctx || (M.ctx = new (window.AudioContext || window.webkitAudioContext)()); const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = f; g.gain.value = 0.25; o.connect(g); g.connect(ctx.destination); const t = ctx.currentTime; o.start(t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3); o.stop(t + 0.35); } catch (e) {} }
const fmt = (s) => Math.floor(s / 60) + ":" + String(Math.max(0, s) % 60).padStart(2, "0");

// ---- Today: this week's lesson ----
export function renderMindCard(){
  const el = $("#mindCard"); if (!el) return; const l = weekLesson(todayStr()); if (!l) { el.hidden = true; return; }
  const done = !!(((S.settings.starLog || {})[todayStr()] || {}).mind);
  el.hidden = false; el.innerHTML = `<div class="row"><span class="chip violet">🧠 This week's mind skill</span><span class="grow"></span>${done ? `<span class="chip mint">✓ today</span>` : ""}</div>
    <div class="today-what">${l.ic} ${esc(l.n)}</div><div class="small">${esc(l.why)}</div>
    <div class="row" style="margin-top:8px"><button class="btn sm coral" onclick="mindTry()">▶ Try it · 1 min</button><span class="small muted grow">${esc(l.try)}</span></div>`;
}
function mindTry(){
  const l = weekLesson(todayStr()); if (!l) return; stopTimer(); M.kind = "mind";
  openStage(`${l.ic} ${l.n}`, [$("#mindArea")], `<button class="btn ghost" onclick="closeStage()">Done</button>`);
  M.left = 60; $("#mindArea").innerHTML = `<div class="small" style="text-align:center">${esc(l.why)}</div><ol class="mind-steps">${l.steps.map(s => `<li>${esc(s)}</li>`).join("")}</ol><div class="pm-timer"><div class="pm-clock" id="mindClock">1:00</div></div><div class="small muted" style="text-align:center">Do the steps slowly until the clock runs out.</div>`;
  M.timer = setInterval(() => { M.left--; const c = $("#mindClock"); if (c) c.textContent = fmt(M.left); if (M.left <= 0) { stopTimer(); chime(1760); $("#mindArea").innerHTML += `<div class="cheer" style="text-align:center">Done. ${esc(l.try)}</div>`; awardStars("mind", 1, "Mind skill"); renderMindCard(); } }, 1000);
}

// ---- Me: build the routine ----
export function renderRitualCard(){
  const el = $("#ritualCard"); if (!el) return; const ids = Array.isArray(S.settings.ritual) ? S.settings.ritual : DEFAULT_RITUAL; const steps = ritualSteps(ids);
  el.innerHTML = `<h3>✨ My pre-stage routine</h3><p class="small muted">Tap to pick up to ${MAX_RITUAL}. The app walks you through it before you go on.</p>
    <div class="row" style="flex-wrap:wrap;gap:6px">${MIND.ritual.map(s => `<button class="chip ${ids.includes(s.id) ? "coral" : ""}" onclick="ritualToggle('${s.id}')">${s.ic} ${esc(s.n)}</button>`).join("")}</div>
    <div class="row" style="margin-top:8px"><span class="small muted grow">${steps.length} step${steps.length === 1 ? "" : "s"} · ${fmt(ritualSecs(steps))}</span><button class="btn sm coral" onclick="ritualRun()" ${steps.length ? "" : "disabled"}>▶ Run it</button></div>`;
}
async function toggle(id){ const cur = Array.isArray(S.settings.ritual) ? S.settings.ritual : DEFAULT_RITUAL; const next = cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id]; if (ritualSteps(next).length > MAX_RITUAL) return; await setSettings({ ritual: next }); renderRitualCard(); }
// ---- run it ----
export function ritualRun(){
  const steps = ritualSteps(Array.isArray(S.settings.ritual) ? S.settings.ritual : DEFAULT_RITUAL); if (!steps.length) return;
  stopTimer(); M.kind = "ritual"; M.steps = steps; M.i = 0;
  openStage("✨ Pre-stage routine", [$("#mindArea")], `<button class="btn ghost" onclick="closeStage()">✕</button>`); ritualStep();
}
function ritualStep(){
  stopTimer(); const s = M.steps[M.i];
  if (!s) { $("#mindArea").innerHTML = `<div class="pm-item"><div class="pm-kind">🌟</div><div class="pm-text">Ready. Go shine.</div></div>`; stageActions(`<button class="btn coral big-btn grow" onclick="closeStage()">Go</button>`); chime(1760); awardStars("mind", 1, "Pre-stage routine"); return; }
  M.left = +s.secs || 10;
  $("#mindArea").innerHTML = `<div class="row"><span class="chip sun">Step ${M.i + 1}/${M.steps.length}</span></div><div class="pm-item"><div class="pm-kind">${s.ic}</div><div class="pm-text">${esc(s.n)}</div><div class="small" style="margin-top:6px">${esc(s.say)}</div></div><div class="pm-timer"><div class="pm-clock" id="mindClock">${fmt(M.left)}</div></div>`;
  stageActions(`<button class="btn ghost" onclick="closeStage()">✕</button><button class="btn coral big-btn grow" onclick="ritualNext()">Next</button>`);
  M.timer = setInterval(() => { M.left--; const c = $("#mindClock"); if (c) c.textContent = fmt(M.left); if (M.left <= 0) { chime(); M.i++; ritualStep(); } }, 1000);
}
function next(){ M.i++; ritualStep(); }
function stopTimer(){ clearInterval(M.timer); }
document.addEventListener("stageclosed", stopTimer);
// ---- comp card: fuel + routine button ----
export function compFuelHtml(){ const rows = MIND.compFuel || []; if (!rows.length) return ""; return `<details class="more"><summary>🍎 Comp-day fuel (veggie + fish) ▸</summary>${rows.map(r => `<div class="check"><span class="chip sun">${esc(r.when)}</span><span class="small">${esc(r.eat)}</span></div>`).join("")}</details>`; }
expose({ mindTry, ritualToggle: toggle, ritualRun, ritualNext: next });
