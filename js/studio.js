// One-off studio dates: solo rehearsals with Ms. Brittany are booked when needed (not every Wednesday), plus make-up
// classes. Each is an `events` document with kind "class" (data/events.json for the built-in ones, a doc per booking for
// the rest), so it never counts as a show: no countdown, no comp mode. On a day with any studio class or rehearsal the
// home plan is the short one: a 15-minute memory run. Pure parts up top.
import { $, esc, toast, uid, todayStr, fmt, expose } from "./util.js";
import { storeSet, studioDates, S } from "./store.js";
import { CLASSES } from "./data.js";

const weekdayOf = (date) => new Date(date + "T00:00:00").getDay();
export const isRehearsal = (e) => /rehearsal/i.test(String((e && e.name) || ""));
// What's on at the studio that day: the weekly classes for its weekday and the one-off dates. [{ t, name, room, oneOff }]
export function studioOn(date, classes = [], oneOffs = []){
  const wd = weekdayOf(date);
  return [...classes.filter(c => c.day === wd).map(c => ({ t: c.t, name: c.name, room: c.room || "", oneOff: false })),
    ...oneOffs.filter(e => e && !e.deleted && e.start === date).map(e => ({ t: e.time || "", name: e.name || "Studio", room: e.room || "", oneOff: true, id: e.id }))]
    .sort((a, b) => String(a.t).localeCompare(String(b.t)));
}
// The home plan is the short version (15-minute memory run) on any day with a studio class or rehearsal.
export const isShortDay = (date, classes = [], oneOffs = []) => studioOn(date, classes, oneOffs).length > 0;
// The next booked solo rehearsal on or after `from`.
export const nextRehearsal = (oneOffs = [], from = "") => oneOffs.filter(e => e && !e.deleted && isRehearsal(e) && e.start >= from).sort((a, b) => a.start.localeCompare(b.start))[0] || null;
// The record a booking writes.
export function bookingRecord(date, time, name, room = "", id = "r-" + uid()){
  return { id, kind: "class", name: String(name || "Solo rehearsal with Ms. Brittany").trim().slice(0, 80), start: date, end: date, time: String(time || "").trim().slice(0, 30), room: String(room || "").trim().slice(0, 30), dances: "Solo" };
}

// ---- DOM ----
export const today = () => studioOn(todayStr(), CLASSES, studioDates());
export function upcomingHtml(from = todayStr()){
  const list = studioDates().filter(e => e.start >= from); if (!list.length) return `<p class="small muted">No one-off dates booked.</p>`;
  return list.map(e => `<div class="check"><span class="chip ${isRehearsal(e) ? "coral" : "violet"}">${esc(fmt(e.start))}</span><span class="grow"><b>${esc(e.time || "")}</b> ${esc(e.name)}${e.room ? ` <span class="muted">· ${esc(e.room)}</span>` : ""}</span><button class="del" onclick="studioDel('${esc(e.id)}')" title="Cancel this date">✕</button></div>`).join("");
}
export function openRehearsal(){ $("#rhDate").value = todayStr(); $("#rhTime").value = "15:30"; $("#rhName").value = "Solo rehearsal with Ms. Brittany"; $("#rehearsal").hidden = false; document.body.classList.add("modal"); }
export function closeRehearsal(){ $("#rehearsal").hidden = true; document.body.classList.remove("modal"); }
const label12 = (hm) => { const m = /^(\d{1,2}):(\d{2})$/.exec(hm || ""); if (!m) return ""; const h = +m[1]; const end = new Date(2000, 0, 1, h, +m[2] + 30); const f = (H, M) => `${(H % 12) || 12}:${String(M).padStart(2, "0")}`; return `${f(h, +m[2])}–${f(end.getHours(), end.getMinutes())} ${end.getHours() < 12 ? "AM" : "PM"}`; };
async function saveRehearsal(){
  const date = $("#rhDate").value; if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return toast("Pick a date");
  const rec = bookingRecord(date, label12($("#rhTime").value), $("#rhName").value, "GHD"); await storeSet("events", rec.id, rec);
  closeRehearsal(); toast(`Booked: ${fmt(date)} ✓ That day's home plan is the 15-minute memory run`, 3200);
}
async function studioDel(id){ const e = studioDates().find(x => x.id === id); if (!e || !confirm(`Cancel "${e.name}" on ${fmt(e.start)}?`)) return; await storeSet("events", id, { ...(S.events[id] || {}), ...e, deleted: true }); }
export function initStudio(){ $("#rhClose").onclick = closeRehearsal; $("#rhSave").onclick = saveRehearsal; }
expose({ openRehearsal, studioDel });
