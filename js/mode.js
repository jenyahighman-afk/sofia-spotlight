// Learn mode vs comp mode, and the comp-weekend card. Auto: the week before (and during) a competition or showcase the app
// switches to comp mode — shorter plan, no new tricks, a full run every day. Grown-ups can pin a mode in Settings.
// Pure parts up top (tested in Node).
import { $, esc, todayStr, expose } from "./util.js";
import { S, events, storeSet, setSettings } from "./store.js";
import { shiftDate } from "./corrections.js";
import { dayNumber } from "./plan.js";

export const MODES = ["auto", "learn", "comp"];
export const COMP_DAYS_BEFORE = 7;
// A competition or showcase: something Sofia performs at (a convention-only weekend is not one).
export const isComp = (e) => !!e && /compet|showcase|performance/i.test(e.type || "") && !/convention only/i.test(e.type || "");
const until = (date, iso) => dayNumber(iso) - dayNumber(date);
export function modeFor(date, evs, settings = {}){
  const pinned = settings.mode; if (pinned === "learn" || pinned === "comp") return { mode: pinned, auto: false, event: null };
  const ev = (evs || []).filter(isComp).find(e => until(date, e.end || e.start) >= 0 && until(date, e.start) <= COMP_DAYS_BEFORE);
  return { mode: ev ? "comp" : "learn", auto: true, event: ev || null };
}
// The event whose weekend today is (from the day before it starts to its last day).
export function compWeekend(date, evs){ return (evs || []).filter(e => isComp(e) || e.pack === "comp").find(e => date >= shiftDate(e.start, -1) && date <= (e.end || e.start)) || null; }
export const COMP_STEPS = [
  { id: "pack", t: "Pack check: everything on the list" },
  { id: "warm", t: "Warm up 10 min. No tricks." },
  { id: "look", t: "Hair, makeup, costume on. Check it." },
  { id: "mark", t: "Mark each dance once, eyes up" },
  { id: "story", t: "Say the story. Pick your focal point." },
  { id: "breathe", t: "Four slow breaths before the stage" }
];
export const FEEL = [[1, "😅 Shaky"], [2, "🙂 Good"], [3, "🤩 Best ever"]];

// ---- UI ----
export const todayMode = () => modeFor(todayStr(), events(), S.settings);
export function renderComp(){
  const el = $("#compCard"); if (!el) return; const date = todayStr(); const ev = compWeekend(date, events());
  if (!ev) { el.hidden = true; el.innerHTML = ""; return; }
  const rec = S.practice[date] || {}; const done = new Set(Array.isArray(rec.compDone) ? rec.compDone : []); const before = date < ev.start;
  el.hidden = false; el.innerHTML = `<div class="row"><span class="chip sun">🏆 ${before ? "Tomorrow" : "Comp weekend"}</span><span class="grow"></span><span class="small">${done.size}/${COMP_STEPS.length}</span></div>
    <div class="today-what">${esc(ev.name)}</div>${ev.venue ? `<div class="small muted">${esc(ev.venue.split(",")[0])}</div>` : ""}
    ${COMP_STEPS.map(s => `<label class="pitem ${done.has(s.id) ? "done" : ""}"><input type="checkbox" ${done.has(s.id) ? "checked" : ""} onchange="compStep('${s.id}')"><span class="grow">${esc(s.t)}</span>${s.id === "pack" ? `<button type="button" class="lnk" onclick="event.preventDefault();openPack('${esc(ev.pack || "comp")}')">list</button>` : ""}</label>`).join("")}
    ${before ? "" : `<div class="field-lab">After the stage: how did it feel?</div><div class="row">${FEEL.map(([v, t]) => `<button class="btn sm ${rec.compFeel === v ? "coral" : "ghost"}" onclick="compFeel(${v})">${t}</button>`).join("")}</div>`}`;
}
async function step(id){ const date = todayStr(); const rec = S.practice[date] || { done: [], note: "", runs: [] }; const set = new Set(Array.isArray(rec.compDone) ? rec.compDone : []); set.has(id) ? set.delete(id) : set.add(id); await storeSet("practice", date, { ...rec, compDone: [...set] }); renderComp(); }
async function feel(v){ const date = todayStr(); const rec = S.practice[date] || { done: [], note: "", runs: [] }; await storeSet("practice", date, { ...rec, compFeel: v }); renderComp(); }
export function renderModeRow(){
  const el = $("#modeRow"); if (!el) return; const cur = MODES.includes(S.settings.mode) ? S.settings.mode : "auto"; const m = todayMode();
  el.innerHTML = MODES.map(k => `<button class="chip ${cur === k ? "coral" : ""}" onclick="setMode('${k}')">${k === "auto" ? "Auto" : k === "learn" ? "📚 Learn" : "🏆 Comp"}</button>`).join("") + `<span class="small muted grow" style="margin-left:6px">Now: ${m.mode === "comp" ? "comp" : "learn"} mode${m.auto && m.event ? " · " + esc(m.event.name) : ""}</span>`;
}
async function setMode(k){ await setSettings({ mode: MODES.includes(k) ? k : "auto" }); renderModeRow(); }
expose({ compStep: step, compFeel: feel, setMode });
