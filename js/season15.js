// The 15-week plan to the Winter Showcase (data/plan15.json): which week it is, its solo / trio / Friday goals, the next
// checkpoint, and what the trick card does (Memory + knees until Nov 9, then the week's trick from the toolkit's
// numbered list). Today shows the week with Ms. Brittany's pinned homework. Pure parts up top (tested in Node).
import { $, esc, fmt, todayStr, daysUntil } from "./util.js";
import { PLAN15, PLAN_SPRING, SKILLS } from "./data.js";
import { S, studioDates } from "./store.js";
import { pinnedOpen } from "./corrections.js";
import { nextRehearsal } from "./studio.js";
import { skillState } from "./skills.js";
import { planDone } from "./streak.js";

const DAY = 86400000;
const dnum = (iso) => Math.round(new Date(iso + "T00:00:00").getTime() / DAY);
const addDays = (iso, n) => { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + n); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
// Which plan a date belongs to: the 15-week plan to the Showcase (plan15.json), then the spring plan (plan-spring.json)
// from the Monday after it to the Glass House Ball. Every function below takes a `plan` and defaults to its date's plan.
const inPlan = (plan, date) => !!(plan && plan.start && Array.isArray(plan.weeks) && plan.weeks.length && date >= plan.start && date < addDays(plan.start, 7 * plan.weeks.length));
export function activePlan(date){ if (inPlan(PLAN15, date)) return PLAN15; if (inPlan(PLAN_SPRING, date)) return PLAN_SPRING; return PLAN15.start && date < PLAN15.start ? PLAN15 : (PLAN_SPRING && PLAN_SPRING.start ? PLAN_SPRING : PLAN15); }
// The week `date` falls in ({ w, of, to, solo, trio, fri, tricks, light, weakest, taper, judges, phase }), or null outside the plan.
export function weekOf(date, plan = activePlan(date)){
  if (!plan || !plan.start || !Array.isArray(plan.weeks)) return null; const i = Math.floor((dnum(date) - dnum(plan.start)) / 7);
  const wk = plan.weeks[i]; if (i < 0 || !wk) return null;
  return { ...wk, to: addDays(wk.of, 6), phase: (plan.phases || []).find(p => wk.w >= p.from && wk.w <= p.to) || null, total: plan.weeks.length };
}
export const memoryKnees = (date, plan = activePlan(date)) => !!(plan && plan.memoryKneesUntil && date < plan.memoryKneesUntil);
// Show day (plan15.json `showDay`, most likely Fri Jan 8 until the studio confirms): the one field the ★ checkpoint, the
// family mini show and the night-before rule all follow. "" when the plan has none.
export const showDay = (plan = PLAN15) => (plan && /^\d{4}-\d{2}-\d{2}$/.test(plan.showDay || "") ? plan.showDay : "");
// What the short home plan is on a studio day (plan15.json rules.studioDays by weekday): "watch" = Hannah's videos and
// picturing the solo in the car (Monday, after three classes), otherwise "memory" = the 15-minute memory run.
export function studioKind(date, plan = activePlan(date)){ const wd = new Date(date + "T00:00:00").getDay(); const k = (((plan || {}).rules || {}).studioDays || {})[String(wd)]; return k === "watch" ? "watch" : "memory"; }
// What the trick card does on `date`: { kind: "knees" } until Nov 9 · { kind: "rest" } on a light week · { kind: "none" }
// in the taper · { kind: "trick", ids } for the week's numbered tricks · { kind: "weakest" } · null outside the plan.
export function trickFocus(date, plan = activePlan(date), ladder = SKILLS){
  if (memoryKnees(date, plan)) return { kind: "knees" };
  const wk = weekOf(date, plan); if (!wk) return null;
  if (wk.light || /^rest$/i.test(wk.fri)) return { kind: "rest" };
  if (/nothing new/i.test(wk.fri)) return { kind: "none" };
  if (wk.weakest) return { kind: "weakest" };
  const skills = ((ladder && ladder.styles && ladder.styles.solo) || {}).skills || [];
  const ids = skills.filter(s => (wk.tricks || []).includes(s.ladder)).map(s => s.id);
  return ids.length ? { kind: "trick", ids, label: wk.fri } : null;
}
// The solo skill to work on when the week says "weakest": the first one that isn't clean yet, in plan order.
export function weakestTrick(skills = {}, ladder = SKILLS){ const list = (((ladder || {}).styles || {}).solo || {}).skills || []; const open = list.filter(s => s.ladder && !["clean", "checked"].includes(skillState(skills, s.id))); return (open[0] || list.find(s => s.ladder) || null); }
// Checkpoints from `date` on, dated; the rehearsal one takes the next booked solo rehearsal (undated until one is booked);
// `show: true` is show day and `beforeShow: n` is n days before it (the family mini show), both from `showDay`.
export function checkpoints(date, plan = activePlan(date), oneOffs = []){
  const sd = showDay(plan);
  return (plan.checkpoints || []).map(c => { if (c.show) return { d: sd, t: c.t }; if (c.beforeShow > 0) return { d: sd ? addDays(sd, -c.beforeShow) : "", t: c.t }; if (!c.rehearsal) return { d: c.d, t: c.t }; const r = nextRehearsal(oneOffs, c.after > date ? c.after : date); return { d: r ? r.start : "", t: c.t, rehearsal: true }; })
    .filter(c => !c.d || c.d >= date).sort((a, b) => (a.d || "9999").localeCompare(b.d || "9999"));
}
const firstSentence = (s) => String(s || "").split(/(?<=[.;])\s/)[0];
// The session rules on `date` (plan15.json `rules`, from the research Jenya approved Oct 26). What the daily plan adds or
// changes: { short (a light week or the night before the show: the 15-minute memory run), nightBefore, imagery: {title,
// how, secs} | null, clips: {text, secs} | null, review: {text, secs} | null (Sundays), run: {text, secs} (the solo run
// line), taper (fewer exercises, still one full-out: rules.taper.from, or a week flagged `taper` in the spring plan),
// judges: {comp, solo, trio, how, secs} | null (the week after a comp: the judges' audio feedback comes first) }.
export function sessionRules(date, plan = activePlan(date)){
  const r = (plan && plan.rules) || {}; const wk = weekOf(date, plan); const wd = new Date(date + "T00:00:00").getDay();
  const nb = Array.isArray(r.nightBefore) ? r.nightBefore : showDay(plan) ? [addDays(showDay(plan), -1)] : []; const nightBefore = nb.includes(date); const taper = !!(wk && (wk.taper || (r.taper && r.taper.from && date >= r.taper.from)));
  const im = r.imagery; const imagery = im && im.from && date >= im.from && wk ? { title: im.title, secs: im.secs || 360, how: [...(im.script || []).map((s, i) => `${i + 1}. ${s}`), date < addDays(im.from, im.parentDays || 0) ? "A grown-up reads the steps out loud for the first two weeks." : "", im.note || ""].filter(Boolean).join(" ") } : null;
  const clips = r.clips && wk && date <= r.clips.to ? { text: r.clips.text, secs: r.clips.secs || 240 } : null;
  const review = r.review && wk && wd === 0 ? { text: taper ? r.review.taper : r.review.sunday, secs: r.review.secs || 300 } : null;
  const fo = r.fullOut || {}; const run = !fo.from || date < fo.from ? { text: fo.before, secs: 300 } : fo.backToBackFrom && date >= fo.backToBackFrom && wd === 0 && !taper ? { text: fo.pair, secs: 480 } : { text: fo.one, secs: 300 };
  const jg = r.judges; const judges = jg && wk && wk.judges ? { comp: String(wk.judges), solo: jg.solo, trio: jg.trio, how: jg.how || "", secs: jg.secs || 300 } : null;
  return { short: nightBefore || !!(wk && wk.light), nightBefore, imagery, clips, review, run: run.text ? run : null, taper, judges };
}
// Whole days since she last danced her solo (streak.js planDone: a logged run, the solo part of a session, a plan box or
// a Memorize chunk — a game or a dare doesn't reset this clock), 0 = today. Infinity if never.
export function daysSinceDance(practice, today){
  const days = Object.keys(practice || {}).filter(d => d <= today && planDone(practice[d])).sort(); if (!days.length) return Infinity;
  return Math.round((dnum(today) - dnum(days[days.length - 1])));
}

// ---- DOM (Today) ----
// Never more than 2 days without the solo: after two days without it the card asks for the memory run today.
function gapNudge(date){ const max = ((activePlan(date).rules || {}).maxGap) || 2; const gap = daysSinceDance(S.practice, date); return Number.isFinite(gap) && gap >= max ? `<div class="sw-next sw-gap">🧠 ${gap} days without your solo: do the 15-minute memory run today <button class="btn sm coral" onclick="showPage('practice')">▶ Go</button></div>` : ""; }
export function renderSeasonCard(date = todayStr()){
  const el = $("#seasonCard"); if (!el) return; const wk = weekOf(date);
  const pins = pinnedOpen(S.corrections, "solo"); const cps = checkpoints(date, activePlan(date), studioDates()); const next = cps[0];
  if (!wk && !pins.length) { el.hidden = true; return; }
  const fri = memoryKnees(date) ? "Memory + knees: no new tricks yet" : wk ? wk.fri : "";
  el.hidden = false;
  el.innerHTML = `${wk ? `<div class="row"><b class="grow">📅 Week ${wk.w} of ${wk.total}${wk.phase ? " · " + esc(wk.phase.n) : ""}${wk.light ? " · light week" : ""}</b><span class="chip">${esc(fmt(wk.of).replace(/^\w+, /, ""))} – ${esc(fmt(wk.to).replace(/^\w+, /, ""))}</span></div>
    <div class="sw-goal">🌸 <b>Solo:</b> ${esc(wk.solo)}</div><div class="sw-goal">👯 <b>Trio:</b> ${esc(wk.trio)}</div>${fri ? `<div class="sw-goal">⭐ <b>Friday:</b> ${esc(fri)}</div>` : ""}` : ""}
    ${wk && wk.judges ? `<div class="sw-goal">🎧 <b>Judges' week:</b> their recordings first, then the fixes they named</div>` : ""}${wk && wk.extra ? `<div class="sw-goal">${esc(wk.extra)}</div>` : ""}
    ${gapNudge(date)}
    ${next ? `<div class="sw-next">🎯 ${next.d ? `<b>${esc(fmt(next.d))}</b>${daysUntil(next.d) > 0 ? ` <span class="muted">(${daysUntil(next.d)} day${daysUntil(next.d) === 1 ? "" : "s"})</span>` : " <b>· today!</b>"}` : `<b>Book it:</b>`} ${esc(next.t)}</div>` : ""}
    ${pins.length ? `<div class="sw-pins"><div class="small"><b>📌 Ms. Brittany's homework</b></div>${pins.map(c => `<button class="fixchip pin" onclick="showMe('${c.id}')">${c.tag === "memory" ? "🧠" : "🦵"} ${esc(firstSentence(c.text))}</button>`).join("")}</div>` : ""}`;
}
