// Dance Pet: a bunny in leg warmers who lives at the top of Today and grows with Sofia's practice. Every practice day
// (a day that counts for the streak, streak.js dayCounts) is one step: it gets bigger by level, learns a new dance move
// every few days and earns outfits; the week before a show it wears its show costume. A day with no practice is never
// sad: after a day off it just naps until the next bite wakes it up. Growth is read from the practice records the app
// already keeps; only the pet's name and fur colour are stored (settings.pet = { name, fur }, schema 32).
// Content (levels, moves, outfits, lines) lives in data/pet.json. Pure parts up top (tested in Node).
import { $, esc, todayStr, dateStr, expose, toast } from "./util.js";
import { S, setSettings, events } from "./store.js";
import { PET, PRACTICE_ITEMS, CLASSES } from "./data.js";
import { planDays, planDone, isPaused } from "./streak.js";
import { dayKindNow } from "./daykind.js";
import { todayMode } from "./mode.js";
import { openStage } from "./stage.js";

export const NAME_MAX = 16;
const pick = (list, seed) => (list && list.length ? list[Math.abs(seed) % list.length] : "");
const daySeed = (date) => { const [y, m, d] = String(date).split("-").map(Number); return Math.floor(Date.UTC(y, (m || 1) - 1, d || 1) / 86400000); };
const byAt = (a, b) => a.at - b.at;
// The level for a number of practice days: the highest whose `at` is reached.
export function petLevel(days, pet = PET){ const ls = [...(pet.levels || [])].sort(byAt); let cur = ls[0] || { at: 0, n: "Tiny", scale: 1 }; for (const l of ls) if (days >= l.at) cur = l; return cur; }
export const learnedMoves = (days, pet = PET) => [...(pet.moves || [])].sort(byAt).filter(m => days >= m.at);
export const nextMove = (days, pet = PET) => [...(pet.moves || [])].sort(byAt).find(m => m.at > days) || null;
export const earnedOutfits = (days, pet = PET) => (pet.outfits || []).filter(o => !o.show && days >= o.at).sort(byAt);
// What it wears: the show costume in show week, else the newest outfit it earned (leg warmers always stay on).
export function outfitFor(days, showWeek, pet = PET){ if (showWeek) { const s = (pet.outfits || []).find(o => o.show); if (s) return s; } const e = earnedOutfits(days, pet); return e[e.length - 1] || null; }
// Mood: "danced" once today counts; "hello" for a brand-new pet (no practice day yet), so it never meets her asleep;
// "nap" after a day with no practice (until today's first bite); otherwise "ready". Only a home day the plan was missed
// counts as "no practice" (yesterdayOk below): after a studio day, Monday's watch day or a school break it is "ready".
export function petMood({ todayDone, yesterdayDone, days = 1 }){ return todayDone ? "danced" : !days ? "hello" : yesterdayDone ? "ready" : "nap"; }
// The move it just learned today (the practice day that reached a move's `at`), else null.
export function justLearned(days, todayDone, pet = PET){ if (!todayDone) return null; return (pet.moves || []).find(m => m.at > 0 && m.at === days) || null; }
// The pet's line for a day: show-week lines take over unless it's napping; {move} and {who} are filled in.
export function petLine(mood, { date = todayStr(), showWeek = false, move = "", who = "Sofia", name = "" } = {}, pet = PET){
  const lines = pet.lines || {}; const set = showWeek && mood === "ready" ? lines.show : lines[mood];
  return String(pick(set, daySeed(date)) || "").replace(/\{move\}/g, move || "wiggle").replace(/\{who\}/g, who).replace(/\{name\}/g, name || pet.defaultName || "Bun-Bun");
}
export function furFor(id, pet = PET){ const fs = pet.furs || []; return fs.find(f => f.id === id) || fs[0] || { id: "cream", c: "#FFF3E6", in: "#FFD6E2" }; }
export function petSettings(settings = S.settings, pet = PET){ const p = (settings || {}).pet || {}; const name = String(p.name || "").trim() || pet.defaultName || "Bun-Bun"; return { name: name.slice(0, NAME_MAX), fur: furFor(p.fur, pet).id }; }

// ---------- the bunny (SVG) ----------
// Drawn on a 120×140 box, feet on the floor at y≈128. `outfit` adds one accessory; `nap` closes the eyes and adds z's.
export function petSVG({ fur, outfit = null, nap = false, scale = 1 } = {}){
  const f = fur || furFor(); const o = outfit ? outfit.id : ""; const ink = "#4A2340"; const ol = `stroke="rgba(74,35,64,.16)" stroke-width="1.2"`;
  const eyes = nap ? `<path d="M48 58q4 3 8 0M64 58q4 3 8 0" stroke="${ink}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`
    : `<circle cx="52" cy="57" r="3.6" fill="${ink}"/><circle cx="68" cy="57" r="3.6" fill="${ink}"/><circle cx="53.3" cy="55.6" r="1.2" fill="#fff"/><circle cx="69.3" cy="55.6" r="1.2" fill="#fff"/>`;
  const warmers = `<g class="pet-legs"><rect x="44" y="108" width="12" height="18" rx="5" fill="${f.c}"/><rect x="64" y="108" width="12" height="18" rx="5" fill="${f.c}"/>
    <rect x="43" y="112" width="14" height="11" rx="3" fill="#FF5C93"/><rect x="63" y="112" width="14" height="11" rx="3" fill="#FF5C93"/>
    <path d="M43 115.5h14M43 119.5h14M63 115.5h14M63 119.5h14" stroke="#FFD1E1" stroke-width="1.6"/>
    <ellipse cx="50" cy="128" rx="9" ry="4" fill="${f.c}"/><ellipse cx="70" cy="128" rx="9" ry="4" fill="${f.c}"/></g>`;
  const acc = {
    bow: `<path d="M60 31l-10-6v12zM60 31l10-6v12z" fill="#FF5C93"/><circle cx="60" cy="31" r="3" fill="#FF8DB5"/>`,
    tutu: `<path d="M38 100q22 12 44 0l4 9q-26 12-52 0z" fill="#FFB3CF" opacity=".95"/><path d="M40 104q20 9 40 0" stroke="#fff" stroke-width="1.4" fill="none" opacity=".8"/>`,
    star: `<path d="M44 35q16-9 32 0" stroke="#F4C86A" stroke-width="3" fill="none"/><path d="M60 22l3 6 6.5 1-4.7 4.5 1.1 6.5L60 37l-5.9 3 1.1-6.5L50.5 29l6.5-1z" fill="#F4C86A"/>`,
    jacket: `<path d="M41 84q19-8 38 0l3 22q-22 6-44 0z" fill="#B98BEF"/><path d="M60 80v26" stroke="#fff" stroke-width="1.6"/><text x="60" y="99" text-anchor="middle" font-size="7" font-weight="800" fill="#fff">GHD</text>`,
    crown: `<path d="M46 34l4-11 5 7 5-10 5 10 5-7 4 11z" fill="#F4C86A" stroke="#E0A93A" stroke-width="1"/><circle cx="60" cy="24" r="1.8" fill="#FF5C93"/>`,
    show: `<path d="M40 86q20-9 40 0l2 20q-22 6-44 0z" fill="#7FB3E6"/><path d="M42 90l36 14" stroke="#F4C86A" stroke-width="3"/><path d="M60 22l3 6 6.5 1-4.7 4.5 1.1 6.5L60 37l-5.9 3 1.1-6.5L50.5 29l6.5-1z" fill="#F4C86A"/>`,
  }[o] || "";
  const zzz = nap ? `<text x="88" y="34" font-size="12" font-weight="800" fill="#B98BEF" class="pet-z">z</text><text x="97" y="22" font-size="9" font-weight="800" fill="#B98BEF" class="pet-z z2">z</text>` : "";
  return `<svg class="pet-svg" viewBox="0 0 120 140" role="img" aria-label="Dance pet"><ellipse cx="60" cy="131" rx="30" ry="4" fill="rgba(74,35,64,.1)"/>
    <g class="pet-body" transform="translate(60 130) scale(${+scale || 1}) translate(-60 -130)">
    <ellipse cx="47" cy="22" rx="8" ry="22" fill="${f.c}" ${ol} transform="rotate(-12 47 40)"/><ellipse cx="47" cy="24" rx="4" ry="15" fill="${f.in}" transform="rotate(-12 47 40)"/>
    <ellipse cx="73" cy="22" rx="8" ry="22" fill="${f.c}" ${ol} transform="rotate(12 73 40)"/><ellipse cx="73" cy="24" rx="4" ry="15" fill="${f.in}" transform="rotate(12 73 40)"/>
    ${warmers}<ellipse cx="60" cy="94" rx="21" ry="20" fill="${f.c}" ${ol}/><ellipse cx="60" cy="98" rx="12" ry="11" fill="#fff" opacity=".55"/>
    <path d="M40 88q-8 4-10 12M80 88q8 4 10 12" stroke="${f.c}" stroke-width="7" stroke-linecap="round" fill="none"/>
    <circle cx="60" cy="58" r="22" fill="${f.c}" ${ol}/>${eyes}<circle cx="46" cy="65" r="4.2" fill="#FF9EC0" opacity=".6"/><circle cx="74" cy="65" r="4.2" fill="#FF9EC0" opacity=".6"/>
    <path d="M57.5 63.5h5l-2.5 3z" fill="#FF7FAE"/><path d="M56 68q4 3.5 8 0" stroke="${ink}" stroke-width="1.8" fill="none" stroke-linecap="round"/>
    ${acc}</g>${zzz}</svg>`;
}

// ---------- today ----------
const yesterday = (date) => { const d = new Date(date + "T00:00:00"); d.setDate(d.getDate() - 1); return dateStr(d); };
// Did yesterday leave the pet awake? Yes when her solo was danced (plan done), or when yesterday asked for no home session:
// a studio day (Monday's watch day, the memory-run days), a rest day, a school break. The review (Oct 28): it napped on
// Tuesday after a Monday with three classes. Pure: kind = daykind.dayKind for that date, paused = streak.isPaused.
export const yesterdayOk = (rec, kind, paused = false) => planDone(rec) || kind !== "home" || !!paused;
export function petState(date = todayStr()){
  const days = planDays(S.practice); // days the plan was done (her solo danced), not just streak-safe days
  const y = yesterday(date); const todayDone = planDone(S.practice[date]), yesterdayDone = yesterdayOk(S.practice[y], dayKindNow(y), isPaused(y, CLASSES, events()));
  const showWeek = todayMode().mode === "comp"; const mood = petMood({ todayDone, yesterdayDone, days });
  const moves = learnedMoves(days); const move = moves[moves.length - 1] || null; const ps = petSettings();
  return { ...ps, days, todayDone, showWeek, mood, level: petLevel(days), moves, move, next: nextMove(days), outfit: outfitFor(days, showWeek), learned: justLearned(days, todayDone) };
}
let dancing = "";
export function renderPet(){
  const el = $("#petCard"); if (!el) return; const p = petState(); const who = String((S.settings.avatar || {}).name || "").trim() || "Sofia";
  const line = p.learned ? `I just learned the ${p.learned.n}! 🎉` : petLine(p.mood, { showWeek: p.showWeek, move: p.move ? p.move.n : "", who, name: p.name });
  const nx = p.next ? `${p.next.at - p.days} more practice day${p.next.at - p.days === 1 ? "" : "s"} to learn the ${p.next.n}` : "It knows every move! 🌟";
  el.innerHTML = `<button class="pet-stage ${p.mood} ${dancing ? "move-" + dancing : ""}" onclick="petDance()" aria-label="Dance with ${esc(p.name)}">${petSVG({ fur: furFor(p.fur), outfit: p.outfit, nap: p.mood === "nap", scale: p.level.scale })}</button>
    <div class="pet-info grow"><div class="row"><b class="pet-name">${esc(p.name)}</b><span class="chip violet">${esc(p.level.n)}</span><span class="grow"></span><button class="lnk" onclick="openPet()" aria-label="Pet settings">✏️</button></div>
    <div class="pet-bubble">${esc(line)}</div><div class="small muted">${esc(nx)}</div></div>`;
}
// Tap: it dances its newest move (napping, it just stretches awake for a moment).
function dance(){ const p = petState(); dancing = p.mood === "nap" ? "stretch" : (p.move ? p.move.id : "wiggle"); renderPet(); clearTimeout(dance.t); dance.t = setTimeout(() => { dancing = ""; renderPet(); }, 1600); }

// ---------- the pet sheet: name, fur, moves and outfits it has (and the ones still to come) ----------
function openPet(){ renderSheet(); openStage("🐰 My dance pet", [$("#petArea")], `<button class="btn ghost" onclick="closeStage()">Done</button>`); }
function renderSheet(){
  const el = $("#petArea"); if (!el) return; const p = petState(); const all = PET.moves || [], outs = (PET.outfits || []).filter(o => !o.show);
  el.innerHTML = `<div class="pet-sheet-top">${petSVG({ fur: furFor(p.fur), outfit: p.outfit, nap: false, scale: p.level.scale })}</div>
    <div class="row"><b class="grow">Name</b><input type="text" maxlength="${NAME_MAX}" value="${esc(p.name)}" onchange="petName(this.value)" aria-label="Pet name" style="max-width:180px"></div>
    <div class="row" style="margin-top:8px"><b class="grow">Fur</b>${(PET.furs || []).map(f => `<button class="pet-fur ${p.fur === f.id ? "on" : ""}" style="background:${f.c}" onclick="petFur('${f.id}')" aria-label="${esc(f.n)}"></button>`).join("")}</div>
    <p class="small muted" style="margin-top:10px">${esc(p.name)} has danced ${p.days} day${p.days === 1 ? "" : "s"} with you · ${esc(p.level.n)}</p>
    <h4>💃 Moves</h4><div class="pet-list">${all.map(m => `<span class="chip ${p.days >= m.at ? "coral" : ""}">${p.days >= m.at ? "✓ " + esc(m.n) : "🔒 " + esc(m.n) + " · day " + m.at}</span>`).join("")}</div>
    <h4>👗 Outfits</h4><div class="pet-list">${outs.map(o => `<span class="chip ${p.days >= o.at ? "sun" : ""}">${p.days >= o.at ? "✓ " + esc(o.n) : "🔒 " + esc(o.n) + " · day " + o.at}</span>`).join("")}<span class="chip ${p.showWeek ? "sun" : ""}">${p.showWeek ? "✓ " : "🌟 "}Show costume · show week</span></div>`;
}
async function setName(v){ const n = String(v || "").trim().slice(0, NAME_MAX); await setSettings({ pet: { ...petSettings(), name: n || PET.defaultName } }); renderSheet(); renderPet(); if (n) toast(`Hi, ${n}! 🐰`); }
async function setFur(id){ await setSettings({ pet: { ...petSettings(), fur: furFor(id).id } }); renderSheet(); renderPet(); }
export function initPet(){ document.addEventListener("stageclosed", () => { const a = $("#petArea"); if (a) a.style.display = "none"; }); }
expose({ petDance: dance, openPet, petName: setName, petFur: setFur });
