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

// ---- DOM (Today) ----
export function renderSeasonCard(date = todayStr()){
  const el = $("#seasonCard"); if (!el) return; const wk = weekOf(date);
  const pins = pinnedOpen(S.corrections, "solo"); const cps = checkpoints(date, PLAN15, studioDates()); const next = cps[0];
  if (!wk && !pins.length) { el.hidden = true; return; }
  const fri = memoryKnees(date) ? "Memory + knees: no new tricks yet" : wk ? wk.fri : "";
  el.hidden = false;
  el.innerHTML = `${wk ? `<div class="row"><b class="grow">📅 Week ${wk.w} of ${wk.total}${wk.phase ? " · " + esc(wk.phase.n) : ""}${wk.light ? " · light week" : ""}</b><span class="chip">${esc(fmt(wk.of).replace(/^\w+, /, ""))} – ${esc(fmt(wk.to).replace(/^\w+, /, ""))}</span></div>
    <div class="sw-goal">🌸 <b>Solo:</b> ${esc(wk.solo)}</div><div class="sw-goal">👯 <b>Trio:</b> ${esc(wk.trio)}</div>${fri ? `<div class="sw-goal">⭐ <b>Friday:</b> ${esc(fri)}</div>` : ""}` : ""}
    ${next ? `<div class="sw-next">🎯 ${next.d ? `<b>${esc(fmt(next.d))}</b>${daysUntil(next.d) > 0 ? ` <span class="muted">(${daysUntil(next.d)} day${daysUntil(next.d) === 1 ? "" : "s"})</span>` : " <b>· today!</b>"}` : `<b>Book it:</b>`} ${esc(next.t)}</div>` : ""}
    ${pins.length ? `<div class="sw-pins"><div class="small"><b>📌 Ms. Brittany's homework</b></div>${pins.map(c => `<button class="fixchip pin" onclick="showMe('${c.id}')">${c.tag === "memory" ? "🧠" : "🦵"} ${esc(firstSentence(c.text))}</button>`).join("")}</div>` : ""}`;
}
