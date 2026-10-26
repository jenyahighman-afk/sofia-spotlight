// The 15-week plan to the Winter Showcase (data/plan15.json): which week it is, its solo / trio / Friday goals, the next
// checkpoint, and what the trick card does (Memory + knees until Nov 9, then the week's trick from the toolkit's
// numbered list). Today shows the week with Ms. Brittany's pinned homework. Pure parts up top (tested in Node).
import { $, esc, fmt, todayStr, daysUntil } from "./util.js";
import { PLAN15, SKILLS } from "./data.js";
import { S, studioDates } from "./store.js";
import { pinnedOpen } from "./corrections.js";
import { nextRehearsal } from "./studio.js";
import { skillState } from "./skills.js";

const DAY = 86400000;
const dnum = (iso) => Math.round(new Date(iso + "T00:00:00").getTime() / DAY);
const addDays = (iso, n) => { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + n); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
// The week `date` falls in ({ w, of, to, solo, trio, fri, tricks, light, weakest, phase }), or null outside the 15 weeks.
export function weekOf(date, plan = PLAN15){
  if (!plan || !plan.start || !Array.isArray(plan.weeks)) return null; const i = Math.floor((dnum(date) - dnum(plan.start)) / 7);
  const wk = plan.weeks[i]; if (i < 0 || !wk) return null;
  return { ...wk, to: addDays(wk.of, 6), phase: (plan.phases || []).find(p => wk.w >= p.from && wk.w <= p.to) || null, total: plan.weeks.length };
}
export const memoryKnees = (date, plan = PLAN15) => !!(plan && plan.memoryKneesUntil && date < plan.memoryKneesUntil);
// What the trick card does on `date`: { kind: "knees" } until Nov 9 · { kind: "rest" } on a light week · { kind: "none" }
// in the taper · { kind: "trick", ids } for the week's numbered tricks · { kind: "weakest" } · null outside the plan.
export function trickFocus(date, plan = PLAN15, ladder = SKILLS){
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
// Checkpoints from `date` on, dated; the rehearsal one takes the next booked solo rehearsal (undated until one is booked).
export function checkpoints(date, plan = PLAN15, oneOffs = []){
  return (plan.checkpoints || []).map(c => { if (!c.rehearsal) return { d: c.d, t: c.t }; const r = nextRehearsal(oneOffs, c.after > date ? c.after : date); return { d: r ? r.start : "", t: c.t, rehearsal: true }; })
    .filter(c => !c.d || c.d >= date).sort((a, b) => (a.d || "9999").localeCompare(b.d || "9999"));
}
const firstSentence = (s) => String(s || "").split(/(?<=[.;])\s/)[0];
// The session rules on `date` (plan15.json `rules`, from the research Jenya approved Oct 26). What the daily plan adds or
// changes: { short (a light week or the night before the show: the 15-minute memory run), nightBefore, imagery: {title,
// how, secs} | null, clips: {text, secs} | null, review: {text, secs} | null (Sundays), run: {text, secs} (the solo run
// line), taper (fewer exercises, still one full-out) }.
export function sessionRules(date, plan = PLAN15){
  const r = (plan && plan.rules) || {}; const wk = weekOf(date, plan); const wd = new Date(date + "T00:00:00").getDay();
  const nightBefore = (r.nightBefore || []).includes(date); const taper = !!(r.taper && r.taper.from && date >= r.taper.from && wk);
  const im = r.imagery; const imagery = im && im.from && date >= im.from && wk ? { title: im.title, secs: im.secs || 360, how: [...(im.script || []).map((s, i) => `${i + 1}. ${s}`), date < addDays(im.from, im.parentDays || 0) ? "A grown-up reads the steps out loud for the first two weeks." : "", im.note || ""].filter(Boolean).join(" ") } : null;
  const clips = r.clips && wk && date <= r.clips.to ? { text: r.clips.text, secs: r.clips.secs || 240 } : null;
  const review = r.review && wk && wd === 0 ? { text: taper ? r.review.taper : r.review.sunday, secs: r.review.secs || 300 } : null;
  const fo = r.fullOut || {}; const run = !fo.from || date < fo.from ? { text: fo.before, secs: 300 } : fo.backToBackFrom && date >= fo.backToBackFrom && wd === 0 && !taper ? { text: fo.pair, secs: 480 } : { text: fo.one, secs: 300 };
  return { short: nightBefore || !!(wk && wk.light), nightBefore, imagery, clips, review, run: run.text ? run : null, taper };
}
// Whole days since she last danced (any practice item, run, bite, plan tick or quick session), 0 = today. Infinity if never.
export function daysSinceDance(practice, today){
  const danced = (r) => r && [r.done, r.runs, r.bites, r.plan, r.quick].some(a => Array.isArray(a) && a.length);
  const days = Object.keys(practice || {}).filter(d => d <= today && danced(practice[d])).sort(); if (!days.length) return Infinity;
  return Math.round((dnum(today) - dnum(days[days.length - 1])));
}

// ---- DOM (Today) ----
// Never more than 2 days without dancing: after two empty days the card asks for the memory run today.
function gapNudge(date){ const max = ((PLAN15.rules || {}).maxGap) || 2; const gap = daysSinceDance(S.practice, date); return Number.isFinite(gap) && gap >= max ? `<div class="sw-next sw-gap">🧠 ${gap} days without dancing: do the 15-minute memory run today <button class="btn sm coral" onclick="showPage('practice')">▶ Go</button></div>` : ""; }
export function renderSeasonCard(date = todayStr()){
  const el = $("#seasonCard"); if (!el) return; const wk = weekOf(date);
  const pins = pinnedOpen(S.corrections, "solo"); const cps = checkpoints(date, PLAN15, studioDates()); const next = cps[0];
  if (!wk && !pins.length) { el.hidden = true; return; }
  const fri = memoryKnees(date) ? "Memory + knees: no new tricks yet" : wk ? wk.fri : "";
  el.hidden = false;
  el.innerHTML = `${wk ? `<div class="row"><b class="grow">📅 Week ${wk.w} of ${wk.total}${wk.phase ? " · " + esc(wk.phase.n) : ""}${wk.light ? " · light week" : ""}</b><span class="chip">${esc(fmt(wk.of).replace(/^\w+, /, ""))} – ${esc(fmt(wk.to).replace(/^\w+, /, ""))}</span></div>
    <div class="sw-goal">🌸 <b>Solo:</b> ${esc(wk.solo)}</div><div class="sw-goal">👯 <b>Trio:</b> ${esc(wk.trio)}</div>${fri ? `<div class="sw-goal">⭐ <b>Friday:</b> ${esc(fri)}</div>` : ""}` : ""}
    ${wk && wk.extra ? `<div class="sw-goal">${esc(wk.extra)}</div>` : ""}
    ${gapNudge(date)}
    ${next ? `<div class="sw-next">🎯 ${next.d ? `<b>${esc(fmt(next.d))}</b>${daysUntil(next.d) > 0 ? ` <span class="muted">(${daysUntil(next.d)} day${daysUntil(next.d) === 1 ? "" : "s"})</span>` : " <b>· today!</b>"}` : `<b>Book it:</b>`} ${esc(next.t)}</div>` : ""}
    ${pins.length ? `<div class="sw-pins"><div class="small"><b>📌 Ms. Brittany's homework</b></div>${pins.map(c => `<button class="fixchip pin" onclick="showMe('${c.id}')">${c.tag === "memory" ? "🧠" : "🦵"} ${esc(firstSentence(c.text))}</button>`).join("")}</div>` : ""}`;
}
