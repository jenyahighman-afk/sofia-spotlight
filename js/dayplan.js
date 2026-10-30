// Today's plan: the dated home-practice sheet (data/plan10.json, the same days as the printed Sofia-Next-10-Days.pdf) on
// the Today tab — since Build 4 only its headline and note (see dayNoteHtml). The data model stays: must items (solid box)
// and "if there's time" items (dashed); ticks are saved per day in practice[date].plan (item ids) and the first must-box
// ticked is the day's "plan" bite. Items with `go` map to a place in the app (goFor; the Bunny uses it). Pure parts up top.
import { $, esc, todayStr, fmt, expose } from "./util.js";
import { S, storeSet } from "./store.js";
import { PLAN10 } from "./data.js";
import { markBite } from "./habit.js";

export const TAGS = { class: "class day", home: "home day", rehearsal: "rehearsal day" };
const item = (x, must) => x && typeof x === "object" && x.id && x.t ? { id: String(x.id), t: String(x.t), go: x.go ? String(x.go) : "", must } : null;
// The plan for one date, cleaned; null when the file has no entry for it.
export function dayPlan(date, plan = PLAN10){
  const d = plan && plan.days && plan.days[date]; if (!d) return null;
  const must = (Array.isArray(d.must) ? d.must : []).map(x => item(x, true)).filter(Boolean), opt = (Array.isArray(d.opt) ? d.opt : []).map(x => item(x, false)).filter(Boolean);
  if (!must.length && !opt.length) return null;
  const mins = Array.isArray(d.mins) ? d.mins.map(n => Math.max(0, +n || 0)) : [0, 0];
  return { date, tag: TAGS[d.tag] ? d.tag : "class", label: d.label ? String(d.label) : "", classes: d.classes ? String(d.classes) : "", must, opt, mins, note: d.note ? String(d.note) : "" };
}
export const planTicks = (rec) => Array.isArray(rec && rec.plan) ? rec.plan.filter(x => typeof x === "string") : [];
// What a tick writes: the id added (or removed) on the day; mustDone says whether a must item is now ticked.
export function tickPlan(rec, plan, id){
  const r = rec || { done: [], note: "", runs: [] }; const have = planTicks(r); const on = !have.includes(id);
  const next = on ? [...have, id] : have.filter(x => x !== id); const mustDone = plan.must.some(m => next.includes(m.id));
  return { rec: { ...r, plan: next }, on, mustDone };
}
// Where a ▶ goes (onclick text), from an item's `go`.
export function goFor(go){
  const [k, v] = String(go || "").split(":");
  if (k === "memo") return `showPage('dances');memoFocus('${v}')`; if (k === "quick") return `showPage('practice');openQuick('${v}')`;
  if (k === "player" || k === "run") return `openPlayer('${v}')`; if (k === "note") return `showPage('dances');noteOpen('${v}')`; return "";
}

// Build 4 (the Oct 29 audit): Today's one card and the Practice session carry the day's items now, so the box no longer lists
// its own (they said "trio, the ending, a trio chunk" under a card that said "the solo first"). What's left of the dated sheet
// is its headline and its note: "📋 ★ solo checkpoint · home day", "Halloween: the checkpoint takes 5 minutes…". A day with
// neither (or no entry at all) shows nothing — the one card above is the plan. The ticks (tickPlan, dpTick: a must box =
// the "plan" bite) stay as they were for anything that still reads them. Since 1.52.0 it is one line inside the one card
// (the card already says the kind of day), and a memory-run day adds nothing: the big button says the same words. Pure.
export function dayNoteHtml(p){
  if (!p || (!p.label && !p.note) || /memory run/i.test(p.label)) return "";
  return `📋 ${p.label ? `<b>${esc(p.label)}</b>` : ""}${p.label && p.note ? " · " : ""}${p.note ? esc(p.note) : ""}`;
}

// ---- DOM ----
export function renderDayPlan(date = todayStr()){
  const el = $("#dayPlan"); if (!el) return; const h = dayNoteHtml(dayPlan(date));
  if (!h) { el.hidden = true; el.innerHTML = ""; return; } // nothing dated to add: the one card is the day's plan
  el.hidden = false; el.innerHTML = h;
}
async function dpTick(id){
  const date = todayStr(); const p = dayPlan(date); if (!p) return; const { rec, on, mustDone } = tickPlan(S.practice[date], p, id);
  await storeSet("practice", date, rec); if (on && mustDone && p.must.some(m => m.id === id)) await markBite("plan", date); renderDayPlan(date);
}
expose({ dpTick });
