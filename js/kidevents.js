// 🎀 Events on Today (1.61.0, Jenya Nov 5: no Calendar tab, she uses her own calendars; "a folded card Events that unfolds
// and shows all events of the competition season"). Readable without the PIN: each event's name, dates and days to go, which
// dances, the place, when to be there, the fun line and its packing list. Costs, charge dates, hotels and notes stay on
// Grown-ups → Events, where the events are edited. School breaks are not events for her. Pure parts up top (tested in Node).
import { $, esc, fmt, daysUntil, todayStr, expose } from "./util.js";
import { S, events, storeSet } from "./store.js"; // dances: below
import { PACKS } from "./data.js";
import { openStage } from "./stage.js";
import { dances } from "./store.js";

// What a kid row may show, in order: [field, label]. Never cost, charge, hotel, link or notes.
export const KID_FIELDS = [["dances", "💃 Which dances"], ["venue", "📍 Where"], ["times", "⏰ When to be there"], ["fun", "✨ Fun to know"]];
export const isBreak = (e) => /break/i.test((e && e.type) || "") || /\(school\)/i.test((e && e.name) || "");
// The season's events for her: the ones still to come first (soonest on top), then the ones done. Pure.
export function kidEvents(list, today = todayStr()){
  const all = (list || []).filter(e => e && !e.deleted && !isBreak(e));
  return { next: all.filter(e => (e.end || e.start) >= today), done: all.filter(e => (e.end || e.start) < today) };
}
// 👗 What to wear (1.64.0, one of the four ideas Jenya picked): each dance's costume, shoes and hair, from the dance's own
// card (More ▸ → Edit). The competition dances, and the class dances too when the event's dances mention a class. Pure.
const isClass = (d) => /class dance/i.test((d && d.name) || "") || /^wf-/.test((d && d.id) || "");
export function wearRows(list, e){
  const withClass = /class/i.test((e && e.dances) || "");
  return (list || []).filter(d => d && !d.deleted && (withClass || !isClass(d))).map(d => ({ name: d.name, bits: [["👗", d.costume], ["🩰", d.shoes], ["💇", d.hair]].filter(([, v]) => String(v || "").trim()).map(([ic, v]) => [ic, String(v).trim()]) })).filter(r => r.bits.length);
}
export function wearHtml(rows){ return rows && rows.length ? `<details class="kev-wear"><summary>👗 Costume, shoes and hair</summary>${rows.map(r => `<div class="kev-f"><b>${esc(r.name)}</b>${r.bits.map(([ic, v]) => `<div>${ic} ${esc(v)}</div>`).join("")}</div>`).join("")}</details>` : ""; }
export const datesLine = (e) => `${fmt(e.start)}${e.end && e.end !== e.start ? " – " + fmt(e.end) : ""}`;
const days = (e, today) => { const d = Math.round((new Date(e.start + "T00:00:00") - new Date(today + "T00:00:00")) / 86400000); return d <= 0 ? "now" : d === 1 ? "1 day" : d + " days"; };
// One event, folded: the name, the dates and the days to go; open, the kid fields and the packing list. Pure.
export function kidEventRow(e, today = todayStr(), packs = PACKS, danceList = []){
  const body = KID_FIELDS.filter(([k]) => String(e[k] || "").trim()).map(([k, lab]) => `<div class="kev-f"><b>${lab}</b><div>${esc(String(e[k]).trim())}</div></div>`).join("");
  const pack = packs && packs[e.pack || "comp"] ? `<button class="btn sm aqua" onclick="openKidPack('${esc(e.pack || "comp")}')">🧳 Packing list</button>` : "";
  return `<details class="kev"><summary><span class="grow"><b>${esc(e.name)}</b><span class="small muted kev-when">${esc(datesLine(e))}${e.type ? " · " + esc(e.type) : ""}</span></span><span class="chip sun">${days(e, today)}</span></summary>${body || `<div class="small muted">More soon.</div>`}${wearHtml(wearRows(danceList, e))}${pack ? `<div class="row" style="margin-top:8px">${pack}</div>` : ""}</details>`;
}
export function kidEventsHtml(list, today = todayStr(), packs = PACKS, danceList = []){
  const { next, done } = kidEvents(list, today);
  if (!next.length && !done.length) return `<p class="small muted">No events yet.</p>`;
  return next.map(e => kidEventRow(e, today, packs, danceList)).join("") + (done.length ? `<div class="small muted kev-done">Done: ${done.map(e => `✓ ${esc(e.name)}`).join(" · ")}</div>` : "");
}

// ---- DOM ----
export function renderKidEvents(){
  const el = $("#kidEvents"); if (!el) return; const today = todayStr(); const list = events();
  // keep an opened event open across a re-render (a sync update draws the list again)
  const open = [...el.querySelectorAll("details.kev[open] summary b")].map(b => b.textContent);
  el.innerHTML = kidEventsHtml(list, today, PACKS, dances());
  el.querySelectorAll("details.kev").forEach(d => { const b = d.querySelector("summary b"); if (b && open.includes(b.textContent)) d.open = true; });
  const n = kidEvents(list, today).next.length; const c = $("#eventsCount"); if (c) c.textContent = n ? `${n} to come` : "";
  renderKidPack();
}
// The packing list as a sheet she can tick, no PIN: the same list and the same ticks as Grown-ups → Lists (packs/<key>).
let packKey = "";
function renderKidPack(){
  const el = $("#kidPackArea"); if (!el || !packKey || !PACKS[packKey]) return; const base = PACKS[packKey].items; const saved = S.packs[packKey] || { extra: [], checked: [] }; const items = [...base, ...(saved.extra || [])]; const checked = saved.checked || [];
  el.innerHTML = `<div class="card aqua"><p class="small muted">${checked.length} of ${items.length} packed</p>${items.map((it, i) => `<div class="check ${checked.includes(i) ? "done" : ""}"><input type="checkbox" ${checked.includes(i) ? "checked" : ""} onchange="kidPackTick('${packKey}',${i})"><span class="grow">${esc(it)}</span></div>`).join("")}</div>`;
}
async function kidPackTick(k, i){ const s = S.packs[k] || { extra: [], checked: [] }; const c = new Set(s.checked || []); c.has(i) ? c.delete(i) : c.add(i); await storeSet("packs", k, { ...s, checked: [...c] }); renderKidPack(); }
function openKidPack(k){ if (!PACKS[k]) return; packKey = k; renderKidPack(); openStage("🧳 " + PACKS[k].name, [$("#kidPackArea")], `<button class="btn ghost" onclick="closeStage()">Done</button>`); }
export function initKidEvents(){ document.addEventListener("stageclosed", () => { const a = $("#kidPackArea"); if (a) a.style.display = "none"; packKey = ""; }); }
expose({ openKidPack, kidPackTick });
