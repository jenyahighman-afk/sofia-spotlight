// Today's plan: the dated home-practice checklist (data/plan10.json, the same days as the printed Sofia-Next-10-Days.pdf)
// on the Today tab. Must items (solid box) and "if there's time" items (dashed); ticks are saved per day in
// practice[date].plan (item ids) and the first must-box ticked is the day's "plan" bite, so one must-box done = the day
// counts, like the sheet says. Items with `go` get a ▶ that opens the right place in the app. Pure parts up top.
import { $, esc, todayStr, fmt, expose } from "./util.js";
import { S, storeSet, studioDates } from "./store.js";
import { studioOn } from "./studio.js";
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

// ---- DOM ----
export function renderDayPlan(date = todayStr()){
  const el = $("#dayPlan"); if (!el) return; const p = dayPlan(date); if (!p) { el.hidden = true; el.innerHTML = ""; return; }
  const ticks = new Set(planTicks(S.practice[date])); const row = (it) => { const on = ticks.has(it.id); const go = goFor(it.go); return `<label class="dp-item ${it.must ? "must" : "opt"} ${on ? "on" : ""}"><input type="checkbox" ${on ? "checked" : ""} onchange="dpTick('${esc(it.id)}')"><span class="grow">${esc(it.t)}${!it.must && it === p.opt[0] ? ` <span class="dp-tag">if there's time</span>` : ""}</span>${go && !on ? `<button type="button" class="lnk" onclick="event.preventDefault();${go}">▶</button>` : ""}</label>`; };
  const mustN = p.must.filter(m => ticks.has(m.id)).length; const booked = studioOn(date, [], studioDates()); // a solo rehearsal booked later, on a day planned as home
  el.hidden = false; el.innerHTML = `<div class="row dp-head"><b class="grow">📋 Today's plan</b><span class="chip ${mustN ? "mint" : ""}">${TAGS[p.tag]}${p.label ? " · " + esc(p.label) : ""}</span></div>
    ${p.classes ? `<div class="small muted dp-classes">📍 ${esc(p.classes)}</div>` : ""}
    <div class="dp-list">${p.must.map(row).join("")}${p.opt.map(row).join("")}</div>
    <div class="small muted dp-foot">⏱ ${p.mins[0]} min · +${p.mins[1]} if there's time${mustN ? " · ⭐ plan done" : " · tick a solid box = plan done ⭐"}</div>${p.note ? `<div class="small dp-note">${esc(p.note)}</div>` : ""}${booked.length && p.tag === "home" ? `<div class="small dp-note">🏫 ${booked.map(b => esc(`${b.name}${b.t ? " " + b.t : ""}`)).join(" · ")} today, so do the short version: the 15-minute memory run (Practice → ▶ Start practice).</div>` : ""}`;
}
async function dpTick(id){
  const date = todayStr(); const p = dayPlan(date); if (!p) return; const { rec, on, mustDone } = tickPlan(S.practice[date], p, id);
  await storeSet("practice", date, rec); if (on && mustDone && p.must.some(m => m.id === id)) await markBite("plan", date); renderDayPlan(date);
}
expose({ dpTick });
