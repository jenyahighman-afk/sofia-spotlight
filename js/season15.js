// The 15-week plan to the Winter Showcase (data/plan15.json): which week it is, its solo / trio / Friday goals, the next
// checkpoint, and what the trick card does (Memory + knees until Nov 9, then the week's trick from the toolkit's
// numbered list). Today shows the week with Ms. Brittany's pinned homework. Pure parts up top (tested in Node).
import { $, esc, fmt, todayStr, daysUntil, expose, toast } from "./util.js";
import { PLAN15, PLAN_SPRING, SKILLS } from "./data.js";
import { S, studioDates, setSettings, normalizeCheckpoints } from "./store.js";
import { pinnedOpen, hashText } from "./corrections.js";
import { nextRehearsal } from "./studio.js";
import { skillState } from "./skills.js";
import { planDone } from "./streak.js";
import { openStage } from "./stage.js";

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
// A checkpoint's id, the same on both phones and after the plan file is edited: the plan's start + a hash of its text
// (the same text sits in both plans — "Family mini show" — so the plan is part of it). settings.checkpoints is keyed by it.
export const cpId = (plan, c) => `${(plan && plan.start) || "plan"}:${hashText(String((c && c.t) || "").trim())}`;
// Every checkpoint of a plan with its id, dated where it can be: the rehearsal one takes the next booked solo rehearsal
// on or after `date` (undated until one is booked); `show: true` is show day and `beforeShow: n` is n days before it (the
// family mini show), both from `showDay`. Dated ones first, in date order; undated last.
export function allCheckpoints(plan = PLAN15, oneOffs = [], date = ""){
  const sd = showDay(plan);
  return (plan.checkpoints || []).map(c => { const id = cpId(plan, c); if (c.show) return { id, d: sd, t: c.t }; if (c.beforeShow > 0) return { id, d: sd ? addDays(sd, -c.beforeShow) : "", t: c.t }; if (!c.rehearsal) return { id, d: c.d, t: c.t }; const r = nextRehearsal(oneOffs, c.after > date ? c.after : date); return { id, d: r ? r.start : "", t: c.t, rehearsal: true, after: c.after || "" }; })
    .sort((a, b) => (a.d || "9999").localeCompare(b.d || "9999"));
}
// Checkpoints from `date` on (the undated rehearsal one included, last).
export function checkpoints(date, plan = activePlan(date), oneOffs = []){ return allCheckpoints(plan, oneOffs, date).filter(c => !c.d || c.d >= date); }
// The ticks (settings.checkpoints, schema 49): { [id]: { done: "YYYY-MM-DD", note? } }.
export const checkpointTicks = (settings = S.settings) => normalizeCheckpoints((settings || {}).checkpoints);
export const tickedOn = (ticks, id) => ((ticks || {})[id] || {}).done || "";
// What Today lists, with a state each: "done" (ticked in the last `keepDone` days, kept as a ✅), "passed" (its day has
// gone by, not ticked, kept for `past` days asking "did you make it?"), "book" (the rehearsal one, undated once its `after`
// day is here: book a private), then the next `n` to come ("today" / "next"). Pure.
export function checkpointsToShow(date, plan = activePlan(date), oneOffs = [], ticks = {}, { past = 7, keepDone = 2, n = 2 } = {}){
  const out = [];
  for (const c of allCheckpoints(plan, oneOffs, date)) {
    const done = tickedOn(ticks, c.id);
    if (done) { if (dnum(date) - dnum(done) < keepDone) out.push({ ...c, state: "done", done }); continue; }
    if (!c.d) { if (c.rehearsal && c.after && date >= c.after) out.push({ ...c, state: "book" }); continue; }
    if (c.d < date) { if (dnum(date) - dnum(c.d) <= past) out.push({ ...c, state: "passed" }); continue; }
    out.push({ ...c, state: c.d === date ? "today" : "next" });
  }
  const coming = out.filter(c => c.state === "today" || c.state === "next").slice(0, n);
  return [...out.filter(c => c.state === "done" || c.state === "passed" || c.state === "book"), ...coming];
}
// The one checkpoint for the top of Today: a passed one still unticked, else today's, else the rehearsal to book (a thing
// to do now beats a date two months off), else the next to come. Never a finished one.
export function nextCheckpoint(date, plan = activePlan(date), oneOffs = [], ticks = {}){ const list = checkpointsToShow(date, plan, oneOffs, ticks); for (const st of ["passed", "today", "book", "next"]) { const c = list.find(x => x.state === st); if (c) return c; } return null; }
// The plans the by-when sheet lists: the one `date` is in, then the one after it (the spring plan after the Showcase's).
export function plansFrom(date){ const cur = activePlan(date); const list = [PLAN15, PLAN_SPRING].filter(p => p && p.start && Array.isArray(p.checkpoints) && p.checkpoints.length); const i = list.indexOf(cur); return i < 0 ? list : list.slice(i); }
export const planLabel = (plan) => plan === PLAN_SPRING ? "Spring: to the Glass House Ball" : "To the Winter Showcase";
const firstSentence = (s) => String(s || "").split(/(?<=[.;])\s/)[0];
// The session rules on `date` (plan15.json `rules`, from the research Jenya approved Oct 26). What the daily plan adds or
// changes: { short (a light week or the night before the show: the 15-minute memory run), nightBefore, imagery: {title,
// how, secs} | null, clips: {text, secs} | null, review: {text, secs} | null (Sundays), run: {text, secs} (the solo run
// line), taper (fewer exercises, still one full-out: rules.taper.from, or a week flagged `taper` in the spring plan),
// judges: {comp, solo, trio, how, secs} | null (the week after a comp: the judges' audio feedback comes first),
// audition: {pickup: {text, how, secs} | null, improv: {text, how, secs} | null} | null (the audition weeks, plan-spring.json
// weeks[].audition + rules.audition: the panel teaches on the day, so full days drill pick-up and improv, not the dances) }.
export function sessionRules(date, plan = activePlan(date)){
  const r = (plan && plan.rules) || {}; const wk = weekOf(date, plan); const wd = new Date(date + "T00:00:00").getDay();
  const nb = Array.isArray(r.nightBefore) ? r.nightBefore : showDay(plan) ? [addDays(showDay(plan), -1)] : []; const nightBefore = nb.includes(date); const taper = !!(wk && (wk.taper || (r.taper && r.taper.from && date >= r.taper.from)));
  const im = r.imagery; const imagery = im && im.from && date >= im.from && wk ? { title: im.title, secs: im.secs || 360, how: [...(im.script || []).map((s, i) => `${i + 1}. ${s}`), date < addDays(im.from, im.parentDays || 0) ? "A grown-up reads the steps out loud for the first two weeks." : "", im.note || ""].filter(Boolean).join(" ") } : null;
  const clips = r.clips && wk && date <= r.clips.to ? { text: r.clips.text, secs: r.clips.secs || 240 } : null;
  const review = r.review && wk && wd === 0 ? { text: taper ? r.review.taper : r.review.sunday, secs: r.review.secs || 300 } : null;
  const fo = r.fullOut || {}; const run = !fo.from || date < fo.from ? { text: fo.before, secs: 300 } : fo.backToBackFrom && date >= fo.backToBackFrom && wd === 0 && !taper ? { text: fo.pair, secs: 480 } : { text: fo.one, secs: 300 };
  const jg = r.judges; const judges = jg && wk && wk.judges ? { comp: String(wk.judges), solo: jg.solo, trio: jg.trio, how: jg.how || "", secs: jg.secs || 300 } : null;
  const ad = r.audition; const audition = ad && wk && wk.audition ? { pickup: ad.pickup ? { text: ad.pickup, how: ad.pickupHow || "", secs: ad.pickupSecs || 180 } : null, improv: ad.improv ? { text: ad.improv, how: ad.improvHow || "", secs: ad.improvSecs || 120 } : null } : null;
  return { short: nightBefore || !!(wk && wk.light), nightBefore, imagery, clips, review, run: run.text ? run : null, taper, judges, audition };
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
// A checkpoint can be ticked once its day is here or gone (Build 4: never ahead of time — the Showcase and the Ball are not
// "made" in October), and cpTick asks once before saving. Pure.
export const canTick = (state) => state === "today" || state === "passed";
export const CP_CONFIRM = "Did you really make it?";
// One checkpoint row on the season card: ✓ Made it on today's or a passed one (a passed one asks "did you make it?"), undo
// on a ticked one, a Book a private button on the undated rehearsal one, the date alone on one still to come.
export function cpRow(c, date = todayStr()){
  const when = c.d ? `<b>${esc(fmt(c.d))}</b>${c.state === "today" ? " <b>· today!</b>" : c.state === "next" ? ` <span class="muted">(${daysUntil(c.d)} day${daysUntil(c.d) === 1 ? "" : "s"})</span>` : ""}` : "";
  if (c.state === "done") return `<div class="sw-next cp cp-done"><span class="grow">✅ <b>${esc(fmt(c.done))}</b> · ${esc(c.t)}</span><button class="lnk" onclick="cpTick('${c.id}',false)">undo</button></div>`;
  if (c.state === "book") return `<div class="sw-next cp cp-book"><span class="grow">📅 <b>Book it:</b> ${esc(c.t)}</span><button class="btn sm coral" onclick="openRehearsal('solo')">📅 Book a private</button></div>`;
  if (c.state === "passed") return `<div class="sw-next cp cp-passed"><span class="grow">🎯 ${when} · ${esc(c.t)}<div class="small muted">Did you make it?</div></span><button class="btn sm coral" onclick="cpTick('${c.id}',true)">✓ Made it</button></div>`;
  if (c.state === "today") return `<div class="sw-next cp"><span class="grow">🎯 ${when} · ${esc(c.t)}</span><button class="btn sm ghost" onclick="cpTick('${c.id}',true)">✓ Made it</button></div>`;
  return `<div class="sw-next cp"><span class="grow">🎯 ${when} · ${esc(c.t)}</span></div>`;
}
export function renderSeasonCard(date = todayStr()){
  const el = $("#seasonCard"); if (!el) return; const wk = weekOf(date);
  const pins = pinnedOpen(S.corrections, "solo"); const cps = checkpointsToShow(date, activePlan(date), studioDates(), checkpointTicks());
  if (!wk && !pins.length) { el.hidden = true; return; }
  const fri = memoryKnees(date) ? "Memory + knees: no new tricks yet" : wk ? wk.fri : "";
  el.hidden = false;
  el.innerHTML = `${wk ? `<div class="row"><b class="grow">📅 Week ${wk.w} of ${wk.total}${wk.phase ? " · " + esc(wk.phase.n) : ""}${wk.light ? " · light week" : ""}</b><span class="chip">${esc(fmt(wk.of).replace(/^\w+, /, ""))} – ${esc(fmt(wk.to).replace(/^\w+, /, ""))}</span></div>
    <div class="sw-goal">🌸 <b>Solo:</b> ${esc(wk.solo)}</div><div class="sw-goal">👯 <b>Trio:</b> ${esc(wk.trio)}</div>${fri ? `<div class="sw-goal">⭐ <b>Friday:</b> ${esc(fri)}</div>` : ""}` : ""}
    ${wk && wk.judges ? `<div class="sw-goal">🎧 <b>Judges' week:</b> their recordings first, then the fixes they named</div>` : ""}${wk && wk.audition ? `<div class="sw-goal">🎟 <b>Audition weeks:</b> the panel teaches on the day — a pick-up drill and improv every full day, nothing to film</div>` : ""}${wk && wk.extra ? `<div class="sw-goal">${esc(wk.extra)}</div>` : ""}
    ${gapNudge(date)}
    ${cps.map(c => cpRow(c, date)).join("")}
    <div class="row sw-foot"><button class="lnk" onclick="openByWhen()">📍 All checkpoints</button></div>
    ${pins.length ? `<div class="sw-pins"><div class="small"><b>📌 Ms. Brittany's homework</b></div>${pins.map(c => `<button class="fixchip pin" onclick="showMe('${c.id}')">${c.tag === "memory" ? "🧠" : "🦵"} ${esc(firstSentence(c.text))}</button>`).join("")}</div>` : ""}`;
}
// Tick a checkpoint done today (or undo). Saved in the family space, so both phones see the ✅.
export async function tickCheckpoint(id, on = true, date = todayStr()){
  const ticks = { ...checkpointTicks() }; if (on) ticks[id] = { ...(ticks[id] || {}), done: date }; else delete ticks[id];
  await setSettings({ checkpoints: ticks }); return ticks;
}
// A tick asks once (CP_CONFIRM) before it is saved; undo never asks.
async function cpTick(id, on){ if (on && !confirm(CP_CONFIRM)) return; await tickCheckpoint(id, on); toast(on ? "Made it! ✅" : "Okay, not yet"); renderSeasonCard(); renderByWhen(); try { document.dispatchEvent(new CustomEvent("checkpoint", { detail: { id, on } })); } catch (e) {} }
// 📍 By when: every checkpoint of this plan and the next, with its ✓ (once its day is here or gone), so "did she make Nov 1?" has an answer.
function renderByWhen(){
  const el = $("#byWhenArea"); if (!el) return; const date = todayStr(); const ticks = checkpointTicks();
  el.innerHTML = plansFrom(date).map(plan => `<div class="card"><h3>${esc(planLabel(plan))}</h3>${allCheckpoints(plan, studioDates(), date).map(c => { const done = tickedOn(ticks, c.id); const st = done ? "done" : !c.d ? "book" : c.d < date ? "passed" : c.d === date ? "today" : "next";
    return `<div class="bw-row ${st}"><span class="bw-when">${done ? "✅" : st === "passed" ? "⬜" : st === "today" ? "🎯" : "○"} ${c.d ? esc(fmt(c.d).replace(/^\w+, /, "")) : "not booked"}</span><span class="grow">${esc(c.t)}${done ? `<div class="small muted">made it ${esc(fmt(done))}</div>` : ""}</span>${done ? `<button class="lnk" onclick="cpTick('${c.id}',false)">undo</button>` : st === "book" ? `<button class="btn sm ghost" onclick="closeStage();openRehearsal('solo')">📅 Book</button>` : canTick(st) ? `<button class="btn sm ${st === "passed" ? "coral" : "ghost"}" onclick="cpTick('${c.id}',true)">✓</button>` : ""}</div>`; }).join("")}</div>`).join("");
}
export function openByWhen(){ renderByWhen(); openStage("📍 By when", [$("#byWhenArea")], `<button class="btn ghost" onclick="closeStage()">Done</button>`); }
export function initSeason(){ document.addEventListener("stageclosed", () => { const a = $("#byWhenArea"); if (a) a.style.display = "none"; }); }
expose({ cpTick, openByWhen });
