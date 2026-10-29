// How ready is the solo (Build 2 of the Oct 28 review): four honest bars from records the app already keeps, nothing new
// to fill in. 🧠 Know = cues she got right in Pause & Predict, twice and the last try a hit, out of the cue table's 28
// (settings.predict) · ✨ Clean = the solo's notes closed, out of all of them, Ms. Brittany's pinned homework included
// (corrections) · 🤸 Tricks = the plan's numbered tricks (skills.json solo `ladder` 1–8) that are clean or teacher-checked
// (skills; her own taps unless ★) · 🎭 Perform = the last 14 days: full runs logged from the player, runs on film (coach
// reviews and run checks) against one per home day — the plan's home days in the window (data/home-days.json weekdays
// with no class, Build 4), not the 14 calendar days — and the days her solo was danced (streak.js planDone).
// The sheet headlines the bar the plan's phase is about (weeks 1–6 Know, 7–9 Clean, 10–15 Perform: readinessHeadline) and
// shows the overall percent only from the Perform it phase. Pure parts up top (tested in Node); the sheet and the card block below.
import { $, esc, todayStr, expose } from "./util.js";
import { SKILLS, CLASSES, HOME_DAYS } from "./data.js";
import { S, dances } from "./store.js";
import { normalizeCues } from "./cues.js";
import { forDance, isDone, isOpen, shiftDate } from "./corrections.js";
import { skillState } from "./skills.js";
import { planDone } from "./streak.js";
import { weekOf } from "./season15.js";
import { openStage } from "./stage.js";

export const KNOW_GOT = 2; // got it this many times, and the last try a hit = a known move
export const PERFORM_TARGET = 6; // full runs (danced or filmed) in 14 days: one per home day — the fallback when no home days are known
export const PERFORM_DAYS = 14;
// The home days in the window: a home weekday (homeDays) with no weekly class on it. Pure.
export function homeDaysIn(from, to, homeDays = HOME_DAYS, classes = CLASSES){
  let n = 0; for (let d = from; d <= to; d = shiftDate(d, 1)) { const wd = new Date(d + "T00:00:00").getDay(); if ((homeDays || {})[wd] && !(classes || []).some(c => c && c.day === wd)) n++; } return n;
}
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
// Cues known / tricky / tried from the Pause & Predict results (settings.predict = { [n]: { got, missed, last } }).
export function knownCues(cues, predict = {}){
  const p = predict && typeof predict === "object" ? predict : {}; const list = normalizeCues(cues).filter(c => c.n);
  const known = list.filter(c => { const e = p[c.n]; return !!e && e.last === "got" && e.got >= KNOW_GOT; });
  const tricky = list.filter(c => { const e = p[c.n]; return !!e && e.last === "missed"; });
  return { of: list.length, known: known.length, tricky: tricky.length, tried: list.filter(c => !!p[c.n]).length, ids: known.map(c => c.n) };
}
// The four bars. `dance` = the solo (its cue table); `today` = the day the 14-day window ends on.
export function soloReadiness({ dance = null, settings = {}, corrections = {}, skills = {}, practice = {}, reviews = {}, today = todayStr(), ladder = SKILLS, days = PERFORM_DAYS, homeDays = HOME_DAYS, classes = CLASSES } = {}){
  const k = knownCues(dance && dance.cues, (settings || {}).predict);
  const know = { n: k.known, of: k.of, tricky: k.tricky, tried: k.tried, pct: k.of ? Math.round(100 * k.known / k.of) : 0 };
  const notes = forDance(corrections, "solo"); const closed = notes.filter(isDone).length, open = notes.filter(isOpen).length;
  const clean = { closed, open, of: closed + open, pct: closed + open ? Math.round(100 * closed / (closed + open)) : 0 };
  // The plan's numbered tricks (ladder 1–8); a number that covers two skills (3 = leap + cartwheel, 4 = walkover + handstand) is done when both are.
  const list = (((ladder || {}).styles || {}).solo || {}).skills || []; const byNum = {}; for (const s of list) if (s.ladder) (byNum[s.ladder] ||= []).push(s);
  const nums = Object.values(byNum); const good = nums.filter(g => g.every(s => ["clean", "checked"].includes(skillState(skills, s.id))));
  const tricks = { n: good.length, of: nums.length, checked: nums.filter(g => g.every(s => skillState(skills, s.id) === "checked")).length, pct: nums.length ? Math.round(100 * good.length / nums.length) : 0 };
  const from = shiftDate(today, -(days - 1)); let runs = 0, soloDays = 0;
  for (const [d, r] of Object.entries(practice || {})) { if (!DATE_RE.test(d) || d < from || d > today || !r) continue; runs += (Array.isArray(r.runs) ? r.runs : []).filter(x => x && (!x.danceId || x.danceId === "solo")).length; if (planDone(r)) soloDays++; }
  const film = Object.values(reviews || {}).filter(r => r && !r.deleted && r.danceId === "solo" && typeof r.date === "string" && r.date >= from && r.date <= today).length;
  // One run per home day: the plan's home days in the window are the target and the "of" of the solo days.
  const target = homeDaysIn(from, today, homeDays, classes) || PERFORM_TARGET;
  const perform = { runs, film, days: soloDays, of: target, window: days, pct: Math.min(100, Math.round(100 * (runs + film) / target)) };
  return { know, clean, tricks, perform, overall: Math.round((know.pct + clean.pct + tricks.pct + perform.pct) / 4) };
}
export const BARS = [["know", "🧠", "Know"], ["clean", "✨", "Clean"], ["tricks", "🤸", "Tricks"], ["perform", "🎭", "Perform"]];
const n = (x, one, many) => `${x} ${x === 1 ? one : many}`;
export function readinessSubs(r){
  return { know: `${r.know.n} / ${r.know.of} moves known${r.know.tricky ? ` · ${r.know.tricky} tricky` : ""}`, clean: `${n(r.clean.closed, "fix", "fixes")} closed · ${r.clean.open} open`,
    tricks: `${r.tricks.n} / ${r.tricks.of} tricks clean${r.tricks.checked ? ` · ${r.tricks.checked} ★` : ""}`, perform: `${n(r.perform.runs, "run", "runs")} · ${r.perform.film} on film · the solo on ${r.perform.days} of ${r.perform.of} home days` };
}
// The bar the plan's phase is about (season15.weekOf(date).phase): Own it → Know, Clean it → Clean, Perform it and the taper →
// Perform; the spring phases by their words (notes and fixes → Clean, the rest → Perform). No week: Know, the first thing to earn.
export function phaseBar(week){
  const name = String(((week || {}).phase || {}).n || "").toLowerCase(); if (!name) return "know";
  if (/own it/.test(name)) return "know"; if (/clean|judges|notes|showstopper|gravit8|after the showcase/.test(name)) return "clean"; return "perform";
}
// The sheet's headline: "Week 5: Know is the bar, 2 / 28" — the count of the bar that counts now; the overall percent only
// once the phase is Perform (before that a 0 % would just say the season isn't over). Pure.
export function readinessHeadline(r, week){
  const bar = phaseBar(week); const name = (BARS.find(b => b[0] === bar) || BARS[0])[2];
  const count = bar === "know" ? `${r.know.n} / ${r.know.of} moves known` : bar === "clean" ? `${r.clean.closed} of ${r.clean.of} fixes closed` : `${r.perform.runs + r.perform.film} of ${r.perform.of} runs`;
  return { bar, name, count, showOverall: bar === "perform", title: `${week && week.w ? `Week ${week.w}: ` : ""}${name} is the bar, ${count}` };
}
// One short line per bar, for the sheet.
export const BAR_LINES = (r) => ({
  know: "🧠 Know: a move counts once she got it right twice in a row in ⏸ Pause & Predict (a grown-up taps Got it / Missed it); tricky = missed last time.",
  clean: "✨ Clean: her solo notes, fixed against open, Ms. Brittany's homework included; a fix closes when it shows on two videos in a row.",
  tricks: "🤸 Tricks: the plan's eight numbered tricks, clean or ★ teacher-checked; her own taps count until a teacher checks them.",
  perform: `🎭 Perform: full runs and runs on film in the last ${r.perform.window || PERFORM_DAYS} days, one per home day (${r.perform.of}), plus the home days her solo was danced on.`,
});
// The bars as HTML (the solo card, the sheet).
export function readinessHtml(r, { compact = false } = {}){
  const sub = readinessSubs(r);
  return `<div class="ready-bars${compact ? " compact" : ""}">${BARS.map(([k, ic, name]) => `<div class="rbar"><span class="rbar-ic">${ic}</span><div class="grow"><div class="row rbar-head"><b>${name}</b><span class="small muted grow">${esc(sub[k])}</span><span class="small rbar-pct">${r[k].pct}%</span></div><div class="rbar-track"><div class="rbar-fill ${k}" style="width:${r[k].pct}%"></div></div></div></div>`).join("")}</div>`;
}
// The same four lines as text (the teacher summary).
export function readinessLines(r){
  return ["Solo readiness (from the app's own records)", `  🧠 Know: ${r.know.n} of ${r.know.of} cues right twice in a row in Pause & Predict${r.know.tricky ? `, ${r.know.tricky} still tricky` : ""}`,
    `  ✨ Clean: ${r.clean.closed} notes fixed, ${r.clean.open} open`, `  🤸 Tricks: ${r.tricks.n} of ${r.tricks.of} numbered tricks clean (${r.tricks.checked} teacher-checked)`,
    `  🎭 Perform, last ${r.perform.window || PERFORM_DAYS} days: ${r.perform.runs} full runs, ${r.perform.film} on film, the solo danced on ${r.perform.days} of ${r.perform.of} home days`];
}

// ---- DOM ----
export const soloDance = () => dances().find(d => d.id === "solo") || null;
export const readinessNow = (today = todayStr()) => soloReadiness({ dance: soloDance(), settings: S.settings, corrections: S.corrections, skills: S.skills, practice: S.practice, reviews: S.reviews, today });
// 🌸 How ready is the solo? — the sheet (Today's "How ready?", the solo card's fold): the phase's bar as the headline, the
// overall percent from Perform it on, the four bars, one line each.
export function openReady(today = todayStr()){
  const el = $("#readyArea"); if (!el) return; const r = readinessNow(today); const h = readinessHeadline(r, weekOf(today)); const lines = BAR_LINES(r);
  el.innerHTML = `<div class="ready-top"><div class="today-what">🌸 ${esc(h.title)}</div><div class="small muted">${h.showOverall ? `${r.overall}% ready overall · ` : ""}Four honest bars, from what the app already knows. Nothing to fill in.</div></div>${readinessHtml(r)}
    <div class="ready-how small">${BARS.map(([k]) => `<p>${esc(lines[k])}</p>`).join("")}</div>
    <div class="row" style="margin-top:8px"><button class="btn sm violet" onclick="closeStage();openMemorize('solo','predict')">⏸ Pause &amp; Predict</button><button class="btn sm violet" onclick="closeStage();openPlayer('solo')">🎵 Run it</button></div>`;
  openStage("🌸 How ready is the solo?", [el], `<button class="btn ghost" onclick="closeStage()">Done</button>`);
}
// The fold on the solo card (Dances): the chip is the phase's count, the percent only from Perform it.
export function readyFold(today = todayStr()){ const r = readinessNow(today); const h = readinessHeadline(r, weekOf(today)); return `<details class="more ready-fold"><summary>🌸 How ready is the solo? <span class="chip">${esc(h.showOverall ? `${r.overall}%` : h.count)}</span></summary>${readinessHtml(r, { compact: true })}<div class="row" style="margin-top:6px"><button class="lnk" onclick="openReady()">What the bars mean</button></div></details>`; }
export function initReady(){ document.addEventListener("stageclosed", () => { const a = $("#readyArea"); if (a) a.style.display = "none"; }); }
expose({ openReady });
