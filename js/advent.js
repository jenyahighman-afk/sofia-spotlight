// Show countdown: an advent calendar with one door a day from data/advent.json `from` until the show (the event named by
// `event`, the Winter Showcase). Behind each door: a sticker for her sticker book, a true dance fact or a mini challenge;
// every 7th door is a star bonus and the last door is show day. Today's door and any she missed can be opened; tomorrow's
// stays locked. Opened doors are stored as dates (settings.advent = { open: ["YYYY-MM-DD", ...] }, schema 33).
// Pure parts up top (tested in Node); the calendar below. Play's ✨ Extras tile ("🎁 Show countdown") opens it (1.52.0: no
// Today row any more; the header's sticker is the countdown).
import { $, esc, todayStr, expose, toast } from "./util.js";
import { S, setSettings, events } from "./store.js";
import { ADVENT } from "./data.js";
import { openStage } from "./stage.js";

const DAY = 86400000;
const ms = (d) => Date.parse(d + "T00:00:00Z");
const iso = (t) => new Date(t).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((ms(b) - ms(a)) / DAY);
// The doors from `from` to the show's first day: [{ date, n, left, kind, item }]. `left` is the number painted on the door
// (days to the show; 0 on show day). Kinds: sticker | fact | challenge | stars | show.
export function doorsFor(advent = ADVENT, evs = events()){
  const ev = (evs || []).find(e => e.id === advent.event); if (!ev || !advent.from || !(ms(advent.from) <= ms(ev.start))) return [];
  const total = daysBetween(advent.from, ev.start) + 1; const out = []; let j = 0;
  const st = advent.stickers || [], fa = advent.facts || [], ch = advent.challenges || [];
  for (let i = 0; i < total; i++) {
    const date = iso(ms(advent.from) + i * DAY); const left = total - 1 - i; let kind, item;
    if (left === 0) { kind = "show"; item = advent.showDay || { e: "🏆", n: "Show star", text: "Show day!" }; }
    else if ((i + 1) % 7 === 0) { kind = "stars"; item = { n: +advent.starBonus || 3 }; }
    else { const k = j % 3, r = Math.floor(j / 3); kind = ["sticker", "fact", "challenge"][k]; const pool = [st, fa, ch][k]; item = pool.length ? pool[r % pool.length] : null; if (!item) kind = "sticker"; j++; }
    out.push({ date, n: i + 1, left, kind, item });
  }
  return out;
}
export const showEvent = (advent = ADVENT, evs = events()) => (evs || []).find(e => e.id === advent.event) || null;
export const canOpen = (door, today = todayStr()) => !!door && door.date <= today;
export const openedDates = (settings = S.settings) => { const o = ((settings || {}).advent || {}).open; return Array.isArray(o) ? o.filter(d => typeof d === "string") : []; };
// Stickers in her book: every opened sticker door (and the show-day sticker), in door order.
export const stickerBook = (doors, opened) => { const set = new Set(opened); return doors.filter(d => set.has(d.date) && (d.kind === "sticker" || d.kind === "show") && d.item).map(d => d.item); };
export const missedDoors = (doors, opened, today = todayStr()) => { const set = new Set(opened); return doors.filter(d => d.date < today && !set.has(d.date)); };
// What opening a door saves: the date added once, and stars added only for a star door opened for the first time.
export function openPatch(door, settings = S.settings, today = todayStr()){
  if (!canOpen(door, today)) return null; const open = openedDates(settings); if (open.includes(door.date)) return null;
  const patch = { advent: { open: [...open, door.date].sort() } };
  if (door.kind === "stars") patch.stars = (+settings.stars || 0) + (+door.item.n || 0);
  return patch;
}
// One line for what's behind a door.
export function doorText(door){
  const it = door.item || {};
  return { sticker: `${it.e} New sticker: ${it.n}!`, fact: `🤓 Did you know? ${it}`, challenge: `🎯 Mini challenge: ${it}`, stars: `⭐ Surprise! +${it.n} stars for your dancer`, show: `${it.e} ${it.text}` }[door.kind] || "";
}

// ---------- the calendar ----------
let shown = "";
function openAdvent(date){ shown = date || todayStr(); const door = doorsFor().find(d => d.date === shown); if (door && !openedDates().includes(door.date) && canOpen(door)) return openDoor(door.date, true); renderCalendar(); openStage("🎁 Show countdown", [$("#adventArea")], `<button class="btn ghost" onclick="closeStage()">Done</button>`); }
async function openDoor(date, fromToday){
  const door = doorsFor().find(d => d.date === date); if (!door) return;
  if (!canOpen(door)) { const n = daysBetween(todayStr(), door.date); toast(`No peeking! This door opens in ${n} day${n === 1 ? "" : "s"} 🔒`, 2500); return; }
  const patch = openPatch(door); shown = date; if (patch) { try { await setSettings(patch); } catch (e) { console.warn("advent", e); } }
  renderCalendar(patch ? date : ""); if (fromToday) openStage("🎁 Show countdown", [$("#adventArea")], `<button class="btn ghost" onclick="closeStage()">Done</button>`);
}
function renderCalendar(justOpened = ""){
  const el = $("#adventArea"); if (!el) return; const doors = doorsFor(); const today = todayStr(); const opened = new Set(openedDates()); const book = stickerBook(doors, [...opened]);
  const cur = doors.find(d => d.date === shown && opened.has(d.date));
  el.innerHTML = `${cur ? `<div class="advent-reveal ${justOpened === cur.date ? "pop" : ""}"><div class="small muted">Door ${cur.left || "🌟"} · ${esc(cur.date)}</div><div class="advent-text">${esc(doorText(cur))}</div></div>` : `<p class="small muted">Open a door for a surprise. Missed one? You can still open it!</p>`}
    <div class="advent-book"><b>📒 My sticker book</b> <span class="small muted">${book.length} collected</span><div class="advent-stickers">${book.length ? book.map(s => `<span title="${esc(s.n)}">${s.e}</span>`).join("") : `<span class="small muted">Your first sticker is behind a door!</span>`}</div></div>
    <div class="advent-grid">${doors.map(d => { const o = opened.has(d.date), can = canOpen(d, today); const ic = o ? (d.kind === "sticker" || d.kind === "show" ? d.item.e : d.kind === "stars" ? "⭐" : d.kind === "fact" ? "🤓" : "🎯") : can ? "" : "🔒";
      return `<button class="door ${o ? "open" : can ? "ready" : "locked"} ${d.date === today ? "today" : ""} ${d.kind === "show" ? "show" : ""}" onclick="adventDoor('${d.date}')" aria-label="Door ${d.left}"><span class="door-n">${d.left || "🌟"}</span>${ic ? `<span class="door-ic">${ic}</span>` : ""}</button>`; }).join("")}</div>`;
  const t = el.querySelector && el.querySelector(".door.today"); if (t && t.scrollIntoView) try { t.scrollIntoView({ block: "center" }); } catch (e) {}
}
export function initAdvent(){ document.addEventListener("stageclosed", () => { const a = $("#adventArea"); if (a) a.style.display = "none"; }); }
expose({ openAdvent, adventDoor: (d) => openDoor(d, false) });
