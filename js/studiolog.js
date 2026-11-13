// 🏫 Studio log (1.70.0, Jenya Nov 13: "can she have an option to log dances and skills that she worked on at the studio and
// what date and add some notes if she wants them there? She should be able to update last 2 weeks at any time. Maybe a
// regular nudge to log her work at the studio would help. The updates should be very easy to record - just a few clicks -
// more emojies and symbols and less words."). One sheet: a strip of the last LOG_DAYS days (🏫 marks a class day, a dot a
// day that has a log), her competition dances and her goals as chips, four faces, a note if she wants one. Every tap saves
// at once; there is no Save button. A day's log lives in that day's practice record:
//   practice[date].studio = { dances: [dance id, …], skills: [goal id, …], feel: "" | FEELS key, note: "", skip: true? }
// It counts where her work counts (js/working.js): a dance and a skill logged here are stepping stones, a skill's page shows
// the day as a filled dot, a dance's row on Today says how many times at the studio. Nothing here touches the day's home
// practice (done, runs, skills). The nudge on Today asks about a class day of the last NUDGE_DAYS days that has no log yet;
// 🚫 marks that day "nothing to log" (skip) and it is not asked about again. Pure parts up top (tested in Node).
import { $, esc, todayStr, expose, toast } from "./util.js";
import { S, storeSet, dances, studioDates } from "./store.js";
import { CLASSES } from "./data.js";
import { studioOn } from "./studio.js";
import { shiftDate } from "./corrections.js";
import { openStage } from "./stage.js";
import { workingIds, goalRow, danceLabel, renderStones } from "./working.js";

export const LOG_DAYS = 14, NUDGE_DAYS = 3, NOTE_MAX = 200;
export const FEELS = [["great", "🤩"], ["good", "🙂"], ["ok", "😐"], ["hard", "😓"]];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const isClassDance = (d) => /class dance/i.test((d && d.name) || "") || /^wf-/.test((d && d.id) || "");
const strs = (a) => Array.isArray(a) ? [...new Set(a.filter(x => typeof x === "string" && x))] : [];
// A day's studio log, whatever is stored: always the same five fields. Pure.
export function studioRec(practice, date){
  const s = ((practice || {})[date] || {}).studio || {};
  return { dances: strs(s.dances), skills: strs(s.skills), feel: FEELS.some(f => f[0] === s.feel) ? s.feel : "", note: String(s.note || "").slice(0, NOTE_MAX), skip: !!s.skip };
}
// Is there anything in it? (skip alone is "she said there was nothing".) Pure.
export const hasLog = (r) => !!r && (r.dances.length > 0 || r.skills.length > 0 || !!r.feel || !!r.note);
// The day's practice record with its studio log changed; everything else in the record stays. Logging something lifts a skip. Pure.
export function withStudio(rec, patch){
  const base = rec && typeof rec === "object" ? rec : { done: [], note: "", runs: [] }; const cur = studioRec({ d: base }, "d"); const next = { ...cur, ...patch };
  const out = { dances: strs(next.dances), skills: strs(next.skills), feel: next.feel || "", note: String(next.note || "").slice(0, NOTE_MAX) };
  if (next.skip && !hasLog({ ...out })) out.skip = true;
  return { ...base, studio: out };
}
export const toggleIn = (list, id) => list.includes(id) ? list.filter(x => x !== id) : [...list, id];
// The strip's days, oldest → today. Pure.
export const logDays = (today, n = LOG_DAYS) => Array.from({ length: n }, (_, i) => shiftDate(today, i - (n - 1)));
// The class days of the last few days (today too) with no log and no skip, newest first. Pure: `isClassDay(date)` is given.
export function nudgeDays(practice, today, isClassDay, span = NUDGE_DAYS){
  return logDays(today, span).reverse().filter(d => isClassDay(d) && !hasLog(studioRec(practice, d)) && !studioRec(practice, d).skip);
}
const WD = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const dayParts = (date) => { const d = new Date(date + "T00:00:00"); return { wd: WD[d.getDay()], n: d.getDate() }; };
export const dayWords = (date, today) => date === today ? "Today" : date === shiftDate(today, -1) ? "Yesterday" : new Date(date + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
// The sheet. `list` = her competition dances [{ id, n }], `goals` = her goals [{ id, n, ic }]. Pure.
export function sheetHtml({ date, today, practice = {}, list = [], goals = [], isClassDay = () => false } = {}){
  const r = studioRec(practice, date);
  const strip = logDays(today).map(d => { const p = dayParts(d), has = hasLog(studioRec(practice, d)); return `<button class="sl-day${d === date ? " on" : ""}${has ? " has" : ""}" onclick="slDay('${d}')" aria-label="${esc(dayWords(d, today))}${has ? ", logged" : ""}"><small>${p.wd}</small><b>${p.n}</b><span>${isClassDay(d) ? "🏫" : "·"}</span></button>`; }).join("");
  const chip = (fn, id, label, on) => `<button class="sl-chip${on ? " on" : ""}" onclick="${fn}('${id}')" aria-pressed="${on}">${on ? "✅ " : ""}${label}</button>`;
  const dn = list.length ? list.map(d => chip("slDance", d.id, esc(d.n), r.dances.includes(d.id))).join("") : `<span class="small muted">—</span>`;
  const sk = goals.length ? goals.map(g => chip("slSkill", g.id, `${g.ic} ${esc(g.n)}`, r.skills.includes(g.id))).join("") : `<button class="lnk" onclick="closeStage();showPage('skills');wkPick()">＋ ⭐</button>`;
  const feel = FEELS.map(([k, e]) => `<button class="sl-feel${r.feel === k ? " on" : ""}" onclick="slFeel('${k}')" aria-label="${k}" aria-pressed="${r.feel === k}">${e}</button>`).join("");
  return `<div class="sl-strip" id="slStrip">${strip}</div>
    <div class="sl-date">🏫 ${esc(dayWords(date, today))}${hasLog(r) ? " ✅" : ""}</div>
    <div class="sl-lab">💃</div><div class="sl-chips">${dn}</div>
    <div class="sl-lab">⭐</div><div class="sl-chips">${sk}</div>
    <div class="sl-lab">💬</div><div class="sl-feels">${feel}</div>
    <input type="text" class="sl-note" id="slNote" maxlength="${NOTE_MAX}" placeholder="✏️ …" value="${esc(r.note)}" onchange="slNote(this.value)" aria-label="Note">
    <p class="small muted sl-hint">Tap = saved ✓ · tap again = off</p>`;
}
// Today's nudge: the newest class day with no log. Pure.
export function nudgeHtml(days, today){
  if (!days.length) return "";
  return `<div class="row"><span class="grow"><b>🏫 ${esc(dayWords(days[0], today))}</b><small class="sl-nsub">What did you work on at the studio? 💃 ⭐${days.length > 1 ? ` · ＋${days.length - 1}` : ""}</small></span><button class="btn sm coral" onclick="openStudioLog('${days[0]}')">✏️ Log</button><button class="btn sm ghost" onclick="slSkip('${days[0]}')" aria-label="Nothing to log">🚫</button></div>`;
}

// ---- DOM ----
let cur = "", box = null;
const classDay = (d) => studioOn(d, CLASSES, studioDates()).length > 0;
const compDances = () => dances().filter(d => !isClassDance(d)).map(d => ({ id: d.id, n: danceLabel(d) }));
const myGoals = () => { const working = workingIds(S.settings); return working.map(id => goalRow(id, { working })).filter(Boolean).map(r => ({ id: r.id, n: r.n, ic: r.ic })); };
function draw(){
  if (!box) return; box.innerHTML = sheetHtml({ date: cur, today: todayStr(), practice: S.practice, list: compDances(), goals: myGoals(), isClassDay: classDay });
  const on = box.querySelector && box.querySelector(".sl-day.on"); if (on && on.scrollIntoView) on.scrollIntoView({ inline: "center", block: "nearest" });
}
export function renderStudioNudge(){ const el = $("#studioNudge"); if (!el) return; const h = nudgeHtml(nudgeDays(S.practice, todayStr(), classDay), todayStr()); el.hidden = !h; el.innerHTML = h; }
export function openStudioLog(date){
  const today = todayStr(); cur = DATE.test(String(date)) && logDays(today).includes(date) ? date : today;
  box = document.createElement("div"); box.className = "sl"; openStage("🏫 ✏️ Studio log", [box], `<button class="btn coral" onclick="closeStage()">✓ Done</button>`); draw();
}
async function save(date, patch){ await storeSet("practice", date, withStudio(S.practice[date], patch)); draw(); renderStudioNudge(); renderStones(); }
const now = () => studioRec(S.practice, cur);
function slDay(d){ if (!logDays(todayStr()).includes(d)) return; cur = d; draw(); }
async function slDance(id){ await save(cur, { dances: toggleIn(now().dances, id) }); }
async function slSkill(id){ await save(cur, { skills: toggleIn(now().skills, id) }); }
async function slFeel(k){ await save(cur, { feel: now().feel === k ? "" : k }); }
async function slNote(v){ await save(cur, { note: String(v || "").trim() }); toast("✓"); }
async function slSkip(d){ if (!DATE.test(String(d))) return; await storeSet("practice", d, withStudio(S.practice[d], { skip: true })); renderStudioNudge(); toast("👌"); }
expose({ openStudioLog, slDay, slDance, slSkill, slFeel, slNote, slSkip });
