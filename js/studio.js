// One-off studio dates: solo rehearsals with Ms. Brittany are booked when needed (not every Wednesday), plus make-up
// classes. Each is an `events` document with kind "class" (data/events.json for the built-in ones, a doc per booking for
// the rest), so it never counts as a show: no countdown, no comp mode. On a day with any studio class or rehearsal the
// home plan is the short one: a memory run. Pure parts up top.
import { $, esc, toast, uid, todayStr, fmt, expose } from "./util.js";
import { storeSet, studioDates, calendarOnly, allEvents, closures, S } from "./store.js";
import { CLASSES } from "./data.js";

const weekdayOf = (date) => new Date(date + "T00:00:00").getDay();
export const isRehearsal = (e) => /rehearsal/i.test(String((e && e.name) || ""));
// What's on at the studio that day: the weekly classes for its weekday and the one-off dates. [{ t, name, room, oneOff }]
// `closed`: the studio's closures (store.closures, kind "closed"): no weekly classes on their dates (1.58.0).
export const closedOn = (date, closed = []) => (closed || []).some(e => e && !e.deleted && date >= e.start && date <= (e.end || e.start));
export function studioOn(date, classes = [], oneOffs = [], closed = closures()){
  const wd = weekdayOf(date); const shut = closedOn(date, closed);
  return [...(shut ? [] : classes).filter(c => c.day === wd).map(c => ({ t: c.t, name: c.name, room: c.room || "", oneOff: false })),
    ...oneOffs.filter(e => e && !e.deleted && e.start === date).map(e => ({ t: e.time || "", name: e.name || "Studio", room: e.room || "", oneOff: true, id: e.id }))]
    .sort((a, b) => String(a.t).localeCompare(String(b.t)));
}
// The home plan is the short version (memory run) on any day with a studio class or rehearsal.
export const isShortDay = (date, classes = [], oneOffs = []) => studioOn(date, classes, oneOffs).length > 0;
// What a booking is for: "solo" (a solo private / rehearsal), "trio" (a trio private) or "other" (a make-up class and the like).
export const ROUTINES = { solo: { label: "Solo private", name: "Solo rehearsal with Ms. Brittany", dances: "Solo" }, trio: { label: "Trio private", name: "Trio private", dances: "Trio" }, other: { label: "Make-up class / other", name: "Make-up class", dances: "" } };
export function routineOf(e){
  if (!e || e.showing) return "other"; const d = String(e.dances || ""), n = String(e.name || ""); // a showing is not a private
  if (/^trio$/i.test(d) || /\btrio\b/i.test(n)) return "trio";
  if (/^solo$/i.test(d) && (isRehearsal(e) || /private/i.test(n))) return "solo";
  return "other";
}
// The next booked solo rehearsal on or after `from` (a trio private or a make-up class never counts here).
export const nextRehearsal = (oneOffs = [], from = "") => oneOffs.filter(e => e && !e.deleted && isRehearsal(e) && routineOf(e) === "solo" && e.start >= from).sort((a, b) => a.start.localeCompare(b.start))[0] || null;
// The record a booking writes. `routine` is a ROUTINES key; the solo default keeps the original record shape.
export function bookingRecord(date, time, name, room = "", id = "r-" + uid(), routine = "solo"){
  const r = ROUTINES[routine] || ROUTINES.solo;
  return { id, kind: "class", name: String(name || r.name).trim().slice(0, 80), start: date, end: date, time: String(time || "").trim().slice(0, 30), room: String(room || "").trim().slice(0, 30), dances: r.dances };
}

// Required privates (Solo/Duo/Trio Handbook 2026–27): at least two 30-minute privates per routine each month through
// May 2027, one in June 2027; none before the routine was learned (both were learned by October 2026) or after June 2027.
export const PRIVATES_FROM = "2026-10", PRIVATES_TO = "2027-06";
export const privatesRequired = (month) => month < PRIVATES_FROM || month > PRIVATES_TO ? 0 : month === PRIVATES_TO ? 1 : 2;
// Booked privates for a routine in a month ("YYYY-MM"), past and upcoming dates alike; cancelled ones don't count.
export const privatesBooked = (oneOffs = [], month, routine) => oneOffs.filter(e => e && !e.deleted && String(e.start || "").slice(0, 7) === month && routineOf(e) === routine).length;
// [{ routine, label, need, have, short }] for the solo and the trio in a month.
export const privatesStatus = (oneOffs = [], month) => ["solo", "trio"].map(r => { const need = privatesRequired(month), have = privatesBooked(oneOffs, month, r); return { routine: r, label: r === "solo" ? "Solo" : "Trio", need, have, short: have < need }; });
export const nextMonth = (month) => { const [y, m] = month.split("-").map(Number); return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`; };

// ---- DOM ----
export const today = () => studioOn(todayStr(), CLASSES, studioDates());
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthName = (m) => MONTHS[+m.slice(5) - 1];
// The privates line on Schedule: this month and next, Solo n/2 · Trio n/2, coral when a routine is short.
export function privatesHtml(month = todayStr().slice(0, 7), list = studioDates()){
  const row = (m) => { const st = privatesStatus(list, m); if (!st[0].need) return ""; return `<div class="row priv-row"><b class="grow">${monthName(m)}</b>${st.map(s => `<span class="chip ${s.short ? "coral" : "mint"}">${s.short ? "" : "✓ "}${s.label} ${s.have}/${s.need}</span>`).join("")}</div>`; };
  const rows = row(month) + row(nextMonth(month));
  return rows ? `<div class="priv"><div class="small muted">Required privates: at least ${privatesRequired(month) || 2} × 30 min per routine each month (handbook, through May 2027; one in June).</div>${rows}</div>` : "";
}
export function upcomingHtml(from = todayStr()){
  const list = studioDates().filter(e => e.start >= from); if (!list.length) return `<p class="small muted">No one-off dates booked.</p>`;
  return list.map(e => `<div class="check"><span class="chip ${isRehearsal(e) ? "coral" : "violet"}">${esc(fmt(e.start))}</span><span class="grow"><b>${esc(e.time || "")}</b> ${esc(e.name)}${e.room ? ` <span class="muted">· ${esc(e.room)}</span>` : ""}</span>${e.pick ? `<button class="del" onclick="studioUnpick('${esc(e.id)}')" title="Not this one after all">↺</button>` : `<button class="del" onclick="studioDel('${esc(e.id)}')" title="Cancel this date">✕</button>`}</div>`).join("");
}
// The calendar-only dates from `from` on (store.calendarOnly): a "sign up for one" pair with ✓ This one, a hold weekend, a deadline.
export function calendarHtml(from = todayStr(), list = calendarOnly()){
  const l = list.filter(e => (e.end || e.start) >= from); if (!l.length) return "";
  return `<div class="small muted" style="margin-top:8px">On the calendar (not a studio day):</div>` + l.map(e => `<div class="check"><span class="chip">${esc(fmt(e.start))}${e.end && e.end !== e.start ? " – " + esc(fmt(e.end)) : ""}</span><span class="grow">${esc(e.name)}${e.pick ? " <b>· sign up for one</b>" : ""}${e.notes ? `<div class="small muted">${esc(e.notes)}</div>` : ""}</span>${e.pick ? `<button class="btn sm coral" onclick="studioPick('${esc(e.id)}')">✓ This one</button>` : ""}</div>`).join("");
}
export function openRehearsal(routine = "solo"){ $("#rhDate").value = todayStr(); $("#rhTime").value = "15:30"; $("#rhFor").value = ROUTINES[routine] ? routine : "solo"; $("#rhName").value = ROUTINES[$("#rhFor").value].name; $("#rehearsal").hidden = false; document.body.classList.add("modal"); }
export function closeRehearsal(){ $("#rehearsal").hidden = true; document.body.classList.remove("modal"); }
const label12 = (hm) => { const m = /^(\d{1,2}):(\d{2})$/.exec(hm || ""); if (!m) return ""; const h = +m[1]; const end = new Date(2000, 0, 1, h, +m[2] + 30); const f = (H, M) => `${(H % 12) || 12}:${String(M).padStart(2, "0")}`; return `${f(h, +m[2])}–${f(end.getHours(), end.getMinutes())} ${end.getHours() < 12 ? "AM" : "PM"}`; };
async function saveRehearsal(){
  const date = $("#rhDate").value; if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return toast("Pick a date");
  const routine = ROUTINES[$("#rhFor").value] ? $("#rhFor").value : "solo";
  const rec = bookingRecord(date, label12($("#rhTime").value), $("#rhName").value, "GHD", undefined, routine); await storeSet("events", rec.id, rec);
  closeRehearsal(); const st = routine === "other" ? null : privatesStatus(studioDates(), date.slice(0, 7)).find(s => s.routine === routine);
  toast(`Booked: ${fmt(date)} ✓${st && st.need ? ` ${st.label} privates in ${monthName(date.slice(0, 7))}: ${st.have}/${st.need}.` : ""} That day's home plan is the memory run`, 3600);
}
// ✓ This one: the picked date becomes a studio day (the memory run at home), the other of the pair goes back to the calendar only.
async function studioPick(id){ const e = calendarOnly().find(x => x.id === id); if (!e || !e.pick) return; const pair = allEvents().filter(x => x.pick === e.pick);
  for (const x of pair) await storeSet("events", x.id, { ...(S.events[x.id] || {}), chosen: x.id === id }); toast(`✓ ${fmt(e.start)}. That day's home plan is the memory run`, 3200); }
async function studioUnpick(id){ const e = studioDates().find(x => x.id === id); if (!e || !e.pick) return; for (const x of allEvents().filter(y => y.pick === e.pick)) await storeSet("events", x.id, { ...(S.events[x.id] || {}), chosen: null }); }
async function studioDel(id){ const e = studioDates().find(x => x.id === id); if (!e || !confirm(`Cancel "${e.name}" on ${fmt(e.start)}?`)) return; await storeSet("events", id, { ...(S.events[id] || {}), ...e, deleted: true }); }
export function initStudio(){ $("#rhClose").onclick = closeRehearsal; $("#rhSave").onclick = saveRehearsal;
  $("#rhFor").onchange = () => { const known = Object.values(ROUTINES).map(r => r.name); if (!$("#rhName").value.trim() || known.includes($("#rhName").value)) $("#rhName").value = ROUTINES[$("#rhFor").value].name; }; }
expose({ openRehearsal, studioDel, studioPick, studioUnpick });
