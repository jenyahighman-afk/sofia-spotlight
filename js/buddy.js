// The talking helper: her dance pet peeks out of the corner with a speech bubble (text, so it works with the sound off;
// 🔊 reads it aloud when she wants) and ONE next step, worked out from the app's own data: comp weekend → today's plan
// must-box → comp mode → rest day → a Today card; once the day counts → the plan's next box, then the dare, the
// countdown door, the flipbook photo, the full practice list, then something fun. Every line is an opener + the step
// (+ sometimes a true fact) picked at random from data/buddy.json, never the same line twice in a row.
// Pops up once per app open on Today and right after a bite counts; otherwise it waits in the corner (tap = another tip).
// "🤫 Quiet today" stops the pop-ups for the day. Nothing is stored in the family space (per-phone localStorage only).
// Pure parts up top (tested in Node); the DOM below.
import { $, esc, todayStr, daysUntil, expose, toast } from "./util.js";
import { speakBunny, stopSpeaking, nextVoice, canSpeak } from "./voice.js";
import { S, events, dances } from "./store.js";
import { BUDDY, CLASSES, HOME_DAYS, PRACTICE_ITEMS } from "./data.js";
import { dayCounts, planDone, planDays, computeStreak, skipsLeft } from "./streak.js";
import { cardsFor } from "./habit.js";
import { dayPlan, planTicks, goFor } from "./dayplan.js";
import { compWeekend, todayMode } from "./mode.js";
import { todayPick, shortName } from "./memo.js";
import { doneOn as dareDoneOn, shownDare } from "./dares.js";
import { doorsFor, openedDates, showEvent } from "./advent.js";
import { showNudge } from "./glow.js";
import { cardList, cardCounts } from "./cards.js";
import { nextUnlock, totalStars } from "./stars.js";
import { petState, petSVG, furFor } from "./pet.js";
import { nudgeFor as passNudge, todayTip, tipSaidToday, markTipSaid } from "./pass.js";

const KEY = "spotlight:buddy";
const KID_PAGES = ["home", "dances", "practice", "play", "me"];
const short = (t) => String(t || "").replace(/\s*\([^)]*\)/g, "").trim();
const pick = (arr, rng = Math.random) => arr.length ? arr[Math.min(arr.length - 1, Math.floor(rng() * arr.length))] : null;
// Fill {placeholders}; a line with a placeholder that has no value is not used (so nothing says "undefined").
export function fill(t, vars){ let ok = true; const out = String(t).replace(/\{(\w+)\}/g, (_, k) => { const v = vars[k]; if (v === undefined || v === null || v === "") { ok = false; return ""; } return String(v); }); return ok ? out : null; }

// ---------- the brain (pure) ----------
// ctx: what the app knows about today (built by buddyContext). Returns { key, go, vars } for the ONE next step.
export function pickStep(ctx, rng = Math.random){
  const c = ctx || {}; const v = {};
  if (c.comp) return { key: "comp-weekend", go: "buddyScroll('#compCard')" };
  const mustLeft = (c.plan && c.plan.must || []).filter(m => !(c.ticks || []).includes(m.id));
  if (!c.dayDone) {
    if (mustLeft.length) { const m = mustLeft[0]; return { key: "plan", vars: { item: m.t }, go: goFor(m.go) || "buddyScroll('#dayPlan')" }; }
    if (c.compMode) return { key: "comp-mode", go: "showPage('practice')" };
    if (c.restDay) return { key: "rest", go: "habitTired('stretch')" };
    // Streak safe (a bite is done) but the solo isn't: the one next step is the solo, never another game.
    if (c.safe) return { key: "solo", go: "showPage('practice')" };
    const open = (c.cards || []).filter(x => !x.done); const card = pick(open.length ? open : (c.cards || []), rng);
    if (card) { const key = { trick: "trick", game: "game", move: "move", memo: "memo" }[card.id] || "trick"; return { key, vars: { trick: card.sub, game: card.sub, move: card.sub, memo: card.sub }, go: card.go }; }
    return { key: "rest", go: "habitTired('stretch')" };
  }
  if (mustLeft.length) { const m = mustLeft[0]; return { key: "plan-more", vars: { item: m.t }, go: goFor(m.go) || "buddyScroll('#dayPlan')" }; }
  // The day counts: first the small "for today" things that are still open, then something fun.
  const tier1 = [];
  if (c.dare === false) tier1.push({ key: "dare", go: "showPage('home');buddyScroll('#dareCard')" });
  if (c.door === false) tier1.push({ key: "door", go: "showPage('home');openAdvent()" });
  if (c.glow) tier1.push({ key: "glow", go: "showPage('me');buddyScroll('#meGlow')" });
  const memo = (c.cards || []).find(x => x.id === "memo" && !x.done); if (memo) tier1.push({ key: "memo", vars: { memo: memo.sub }, go: memo.go });
  if (!c.fullDone && !c.restDay) tier1.push({ key: "full", go: "showPage('practice')" });
  // The Backstage Pass: the next part to read, once nothing has been read for two days (pass.js nudgeFor).
  if (c.passPart) tier1.push({ key: "pass", vars: { part: c.passPart }, go: "openPass()" });
  if (tier1.length) return pick(tier1, rng);
  const fun = [{ key: "all-done", go: "showPage('play')" }, { key: "teach", go: "showPage('play');playOpen('teach')" }, { key: "count", go: "showPage('play');playOpen('count')" }, { key: "costume", go: "showPage('me');openCostumes()" }];
  if (c.cardsEarned > 0) fun.push({ key: "cards", vars: { cards: c.cardsEarned }, go: "showPage('me');openCards()" });
  if (c.starsLeft > 0 && c.starsLeft <= 5 && c.unlock) fun.push({ key: "stars", vars: { starsLeft: c.starsLeft, unlock: c.unlock }, go: "showPage('play')" });
  return pick(fun, rng);
}
// True facts that may ride along (one at most).
export function factsFor(c){
  const f = [];
  if (c.event && c.event.days >= 1 && c.event.days <= 90) f.push(["event", { event: c.event.name, eventDays: c.event.days }]);
  if (c.streak >= 2) f.push(["streak", { streak: c.streak }]);
  if (!c.dayDone && c.skips <= 1 && c.streak >= 1) f.push(["skips", { skips: c.skips }]);
  if (c.classes && c.classes.length && !c.dayDone) f.push(["class", { class: c.classes[0].name, time: c.classes[0].t }]);
  if (c.petDays >= 3) f.push(["pet", { petDays: c.petDays }]);
  return f;
}
// The whole message: { opener, text, fact, button, go, key, id } (id = which step line, to avoid repeats).
export function compose(ctx, { rng = Math.random, last = "", lines = BUDDY, justDone = false } = {}){
  const c = ctx || {}; const step = pickStep(c, rng); const base = { name: c.name || "Sofia", pet: c.pet || "Bun-Bun" }; const vars = { ...base, ...(step.vars || {}) };
  const opts = ((lines.steps || {})[step.key] || []).map((t, i) => ({ t: fill(t, vars), id: step.key + ":" + i })).filter(x => x.t);
  const fresh = opts.filter(x => x.id !== last); const chosen = pick(fresh.length ? fresh : opts, rng) || { t: "", id: "" };
  let opener;
  if (justDone) opener = pick(((lines.steps || {})["just-done"] || []).map(t => fill(t, vars)).filter(Boolean), rng);
  else if (!c.dayDone && c.streak === 0 && c.petDays > 0 && !c.comp) opener = pick(((lines.steps || {}).comeback || []).map(t => fill(t, vars)).filter(Boolean), rng);
  if (!opener) opener = pick((lines.openers || []).map(t => fill(t, vars)).filter(Boolean), rng) || "";
  let fact = "", tipUsed = false; const fs = factsFor(c);
  // The Backstage Pass's tip of the day rides along the first time the Bunny speaks that day (c.tip, pass.js); else a true fact, sometimes.
  if (c.tip && (lines.facts || {}).tip) { fact = pick((lines.facts.tip || []).map(t => fill(t, { ...vars, tip: c.tip })).filter(Boolean), rng) || ""; tipUsed = !!fact; }
  if (!fact && fs.length && rng() < 0.6) { const [k, fv] = pick(fs, rng); fact = pick(((lines.facts || {})[k] || []).map(t => fill(t, { ...vars, ...fv })).filter(Boolean), rng) || ""; }
  const button = step.go ? (pick(lines.buttons || [], rng) || "Let's go ▶") : "";
  return { opener, text: chosen.t, fact, button, go: step.go || "", key: step.key, id: chosen.id, tipUsed };
}

// ---------- what the app knows right now ----------
export function buddyContext(date = todayStr()){
  const total = PRACTICE_ITEMS.length; const rec = S.practice[date]; const dow = new Date(date + "T00:00:00").getDay();
  const evs = events(); const ctxS = { practice: S.practice, classes: CLASSES, events: evs, totalItems: total, today: date };
  const bites = rec && Array.isArray(rec.bites) ? rec.bites : [];
  const mp = todayPick(dances(), S.settings, date); const memo = mp ? { danceId: mp.dance.id, label: mp.run ? `${shortName(mp.dance)} · full run` : `${shortName(mp.dance)} · ${mp.chunk.n}` } : null;
  const plan = dayPlan(date); const classes = CLASSES.filter(c => c.day === dow).sort((a, b) => String(a.t).localeCompare(String(b.t)));
  const doors = doorsFor(); const door = doors.find(d => d.date === date); const ev = events().find(e => daysUntil(e.end || e.start) >= 0) || null;
  const nu = nextUnlock(); const ps = petState(date); const cc = cardCounts(cardList());
  return {
    date, name: String(((S.settings || {}).avatar || {}).name || "").trim() || "Sofia", pet: ps.name,
    dayDone: planDone(rec), safe: dayCounts(rec, total), fullDone: !!rec && dayCounts({ done: rec.done, total: rec.total }, total),
    streak: computeStreak(ctxS), skips: skipsLeft(ctxS), petDays: planDays(S.practice),
    comp: compWeekend(date, evs), compMode: todayMode().mode === "comp",
    plan, ticks: planTicks(rec), classes, restDay: !classes.length && !HOME_DAYS[dow] && !plan,
    cards: cardsFor(date, { skills: S.skills, bites, memo }),
    dare: shownDare(date) ? dareDoneOn(date) : null,
    door: door && showEvent() ? openedDates().includes(date) : null,
    glow: showNudge(date), cardsEarned: cc.earned,
    starsLeft: nu ? nu[2] - totalStars() : 0, unlock: nu ? nu[3] : "",
    event: ev ? { name: short(ev.name), days: daysUntil(ev.start) } : null,
    passPart: (() => { const p = passNudge(S.settings, date); return p ? `${p.e || ""} ${p.n}`.trim() : ""; })(),
    tip: tipSaidToday(date) ? "" : String(((todayTip(date) || {}).t) || ""),
  };
}

// ---------- the DOM ----------
let msg = null, autoDone = false, pending = false;
const lastId = () => { try { return (JSON.parse(localStorage.getItem(KEY) || "{}").last) || ""; } catch (e) { return ""; } };
const quietToday = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}").quiet === todayStr(); } catch (e) { return false; } };
function save(patch){ try { const cur = JSON.parse(localStorage.getItem(KEY) || "{}"); localStorage.setItem(KEY, JSON.stringify({ ...cur, ...patch })); } catch (e) {} }
const blocked = () => document.body.classList.contains("modal");
export function renderBuddy(){
  const el = $("#buddy"); if (!el) return; let ps; try { ps = petState(); } catch (e) { return; }
  const pet = $("#buddyPet"); if (pet) pet.innerHTML = petSVG({ fur: furFor(ps.fur), outfit: ps.outfit, scale: 1 });
  const b = $("#buddyBubble"); if (!b) return;
  if (!msg) { b.hidden = true; b.innerHTML = ""; el.classList.remove("talking"); return; }
  b.hidden = false; el.classList.add("talking");
  b.innerHTML = `<button class="buddy-x" onclick="buddyHide()" aria-label="Close">✕</button>
    ${msg.opener ? `<div class="buddy-open">${esc(msg.opener)}</div>` : ""}<div class="buddy-text">${esc(msg.text)}</div>${msg.fact ? `<div class="buddy-fact">${esc(msg.fact)}</div>` : ""}
    <div class="row buddy-btns">${msg.go ? `<button class="btn sm coral" onclick="buddyHide();${esc(msg.go)}">${esc(msg.button)}</button>` : ""}<button class="btn sm ghost" onclick="buddyMore()" aria-label="Another tip">🎲</button>${canSpeak() ? `<button class="btn sm ghost" onclick="buddySay()" aria-label="Read it to me">🔊</button><button class="btn sm ghost" onclick="buddyVoice()" aria-label="Try another voice">🎙️</button>` : ""}</div>
    ${msg.heard ? `<div class="buddy-hint">No sound? Turn off Silent mode and turn the volume up 🔈</div>` : ""}
    <button class="lnk buddy-quiet" onclick="buddyQuiet()">🤫 Quiet today</button>`;
}
export function showBuddy({ justDone = false } = {}){
  let ctx; try { ctx = buddyContext(); } catch (e) { console.warn("buddy", e); return null; }
  msg = compose(ctx, { last: lastId(), justDone }); save({ last: msg.id }); if (msg.tipUsed) markTipSaid(); renderBuddy(); return msg;
}
export function hideBuddy(){ msg = null; stopSpeaking(); renderBuddy(); }
function scrollTo(sel){ setTimeout(() => { const e = $(sel); if (e && e.scrollIntoView) try { e.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (x) {} }, 60); }
function say(){ if (!msg) return; speakBunny([msg.opener, msg.text, msg.fact].filter(Boolean).join(". ")); if (!msg.heard) { msg.heard = true; renderBuddy(); } }
// 🎙️: the next of this phone's best voices, and a short hello in it.
function voice(){ const n = nextVoice(); if (!n) return; toast("🎙️ Voice: " + n); speakBunny("Hi! Is this my voice? Boing boing!"); }
function tap(){ if (msg) hideBuddy(); else showBuddy(); }
function quiet(){ save({ quiet: todayStr() }); hideBuddy(); }
// Once per app open, when the day's data is in, on Today. Called by app.js on each data change. The bubble waits until
// she has looked at the plan: her first scroll on Today, or AUTO_MS — never over the one card at the top (Build 2).
export const AUTO_MS = 10000;
export function buddyAuto(ready){
  if (autoDone || !ready) return; autoDone = true; if (quietToday()) return;
  let fired = false; const wrap = document.querySelector(".wrap");
  const go = () => { if (fired) return; fired = true; try { window.removeEventListener("scroll", go); if (wrap) wrap.removeEventListener("scroll", go); } catch (e) {} const home = document.body.classList.contains("pg-home"); if (home && !blocked() && !msg) showBuddy(); };
  try { window.addEventListener("scroll", go, { passive: true }); if (wrap) wrap.addEventListener("scroll", go, { passive: true }); } catch (e) {}
  setTimeout(go, AUTO_MS);
}
export function initBuddy(){
  renderBuddy();
  document.addEventListener("bitedone", () => { if (quietToday()) return; if (blocked()) { pending = true; return; } setTimeout(() => showBuddy({ justDone: true }), 900); });
  const later = () => { if (pending && !blocked()) { pending = false; setTimeout(() => showBuddy({ justDone: true }), 600); } };
  document.addEventListener("stageclosed", later);
  document.addEventListener("page", (e) => { const el = $("#buddy"); if (el) el.hidden = !KID_PAGES.includes(e.detail); if (msg && e.detail !== "home") hideBuddy(); later(); });
}
expose({ buddyTap: tap, buddyHide: hideBuddy, buddyMore: () => showBuddy(), buddySay: say, buddyVoice: voice, buddyQuiet: quiet, buddyScroll: scrollTo });
