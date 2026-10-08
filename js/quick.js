// Quick sessions: a 5-minute strength or stretch session for home, any day, on top of (or instead of) the full practice.
// Items come from the same pools as the daily plan and rotate by day. Finishing one is saved to practice.quick for the day,
// counts toward the streak, and pays stars. Pure parts up top (tested in Node).
import { $, esc, todayStr, expose } from "./util.js";
import { PRACTICE_POOL } from "./data.js";
import { S } from "./store.js";
import { rotate, dayNumber, poolItems } from "./plan.js";
import { openPracticeMode } from "./pmode.js";

export const QUICK = {
  strength: { n: "5-min strength", ic: "💪", warm: { id: "quick-warm", text: "Quick warm-up 1 min: march, arm circles, leg swings", secs: 60, pose: "jacks", kind: "warm" } },
  flex:     { n: "5-min stretch",  ic: "🧘", warm: { id: "quick-warm-flex", text: "Warm up 1 min: march on the spot, then cobra and seal", secs: 60, pose: "jacks", kind: "warm" } }
};
const short = (it, max) => ({ ...it, secs: Math.min(+it.secs || max, max) });
// A session for `kind` on `date`: a 1-minute warm-up, then 3 timed items (strength: 2 core + 1 legs one day, 1 core + 2 legs the next;
// stretch: 3 of the flexibility pool). Items are capped at 90 s so the whole thing stays around five minutes.
export function buildQuick(kind, date, pool = PRACTICE_POOL){
  const q = QUICK[kind]; if (!q) return [];
  const day = dayNumber(date); let picks;
  if (kind === "strength") { const core = poolItems(pool, "core"), legs = poolItems(pool, "legs"); const a = day % 2 === 0 ? 2 : 1; picks = [...rotate(core, a, day), ...rotate(legs, 3 - a, day)]; }
  else picks = rotate(poolItems(pool, "flex"), 3, day);
  return [q.warm, ...picks.map(it => short(it, 90))];
}
export const quickSecs = (items) => items.reduce((a, it) => a + (+it.secs || 0), 0);
export const quickDone = (rec, kind) => (Array.isArray((rec || {}).quick) ? rec.quick : []).filter(k => k === kind).length;

export function openQuick(kind){ const items = buildQuick(kind, todayStr()); if (!items.length) return; openPracticeMode(items, { quick: kind, title: `${QUICK[kind].ic} ${QUICK[kind].n}` }); }
export function renderQuick(){
  const el = $("#quickRow"); if (!el) return; const rec = S.practice[todayStr()] || {};
  el.innerHTML = `<div class="field-lab">Short on time? Five minutes still counts.</div><div class="row">${Object.entries(QUICK).map(([k, q]) => { const n = quickDone(rec, k); return `<button class="btn big-btn grow ${k === "strength" ? "sun" : "aqua"}" onclick="openQuick('${k}')">${q.ic} ${esc(q.n)}${n ? ` <span class="chip">✓${n > 1 ? " ×" + n : ""}</span>` : ""}</button>`; }).join("")}</div>`;
}
expose({ openQuick });
