// Dance Dares: one silly, tricky, freeze or style dance challenge a day from data/dares.json, the same all day on every
// phone (picked from the date, no randomness) with one "🎲 Try another" a day. "I did it! 🎉" saves the date, is the
// day's "dare" bite (habit.js markBite) and pays 1 star the first time each day. Stored flat:
// settings.dares = { done: ["YYYY-MM-DD", ...], reroll: "YYYY-MM-DD" (the last day she used her reroll) }, schema 34.
// Pure parts up top (tested in Node); the Today card below.
import { $, esc, todayStr, expose, toast } from "./util.js";
import { S, setSettings } from "./store.js";
import { DARES } from "./data.js";
import { dayNumber } from "./plan.js";
import { markBite } from "./habit.js";
import { totalStars, UNLOCKS } from "./stars.js";

export const DARE_STARS = 1;
const isDate = (d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);
const pool = (dares = DARES) => (dares && Array.isArray(dares.dares) ? dares.dares : []);
// The day's slot: stepping by 17 walks the whole pool before a dare comes back (when the pool size shares no factor with 17).
const slot = (date, n) => ((dayNumber(date) * 17 + 5) % n + n) % n;
// Today's dare: the same for everyone all day; `reroll` swaps it for the dare half the pool away (always a different one).
export function dareFor(date, reroll = false, dares = DARES){
  const list = pool(dares); if (!list.length || !isDate(date)) return null; const n = list.length; let i = slot(date, n);
  if (reroll && n > 1) i = (i + Math.max(1, Math.floor(n / 2))) % n; return list[i];
}
export const dareState = (settings = S.settings) => { const d = (settings || {}).dares || {}; return { done: Array.isArray(d.done) ? d.done.filter(isDate) : [], reroll: isDate(d.reroll) ? d.reroll : "" }; };
export const rerolledOn = (date, settings = S.settings) => dareState(settings).reroll === date;
export const doneOn = (date, settings = S.settings) => dareState(settings).done.includes(date);
export const doneCount = (settings = S.settings) => new Set(dareState(settings).done).size;
// The dare showing on a day (the rerolled one once she used her reroll that day).
export const shownDare = (date, settings = S.settings, dares = DARES) => dareFor(date, rerolledOn(date, settings), dares);
// What a reroll saves: only once a day, and not after the dare is done.
export function rerollPatch(date, settings = S.settings){ const st = dareState(settings); if (!isDate(date) || st.reroll === date || st.done.includes(date)) return null; return { dares: { done: st.done, reroll: date } }; }
// What "I did it" saves: the date added once, plus the day's star the first time.
export function donePatch(date, settings = S.settings){
  const st = dareState(settings); if (!isDate(date) || st.done.includes(date)) return null;
  return { dares: { done: [...new Set([...st.done, date])].sort(), reroll: st.reroll }, stars: (+(settings || {}).stars || 0) + DARE_STARS };
}

// ---------- Today card ----------
export function renderDares(){
  const el = $("#dareCard"); if (!el) return; const today = todayStr(); const d = shownDare(today);
  if (!d) { el.hidden = true; el.innerHTML = ""; return; }
  el.hidden = false; const done = doneOn(today); const n = doneCount(); const canReroll = !done && !rerolledOn(today);
  el.className = `card dare-card ${done ? "done" : ""}`;
  el.innerHTML = `<div class="row dare-head"><span class="dare-ic">${esc(d.e || "🎯")}</span><div class="grow"><div class="small muted">${done ? "✅ Dare done!" : "🎯 Today's dance dare"}</div><div class="dare-text">${esc(d.text)}</div></div></div>
    ${done ? `<div class="small muted dare-count">🎯 ${n} dare${n === 1 ? "" : "s"} done. New dare tomorrow!</div>`
    : `<div class="row dare-btns"><button class="btn sm coral" onclick="dareDone()">I did it! 🎉</button>${canReroll ? `<button class="btn sm ghost" onclick="dareReroll()">🎲 Try another</button>` : `<span class="small muted">That's today's dare 💪</span>`}${n ? `<span class="grow"></span><span class="small muted">🎯 ${n}</span>` : ""}</div>`}`;
}
async function dareDone(){
  const today = todayStr(); const before = totalStars(); const patch = donePatch(today); if (!patch) return renderDares();
  try { await setSettings(patch); } catch (e) { console.warn("dares", e); }
  try { await markBite("dare", today); } catch (e) { console.warn("bite", e); }
  const u = UNLOCKS.find(x => x[2] > before && x[2] <= before + DARE_STARS);
  try { toast(`🎉 Dare done! ⭐ +${DARE_STARS} star${u ? ` · 🎁 ${u[3]} unlocked!` : ""}`, u ? 4000 : 2600); } catch (e) {}
  renderDares();
}
async function dareReroll(){
  const today = todayStr(); const patch = rerollPatch(today); if (!patch) return renderDares();
  try { await setSettings(patch); } catch (e) { console.warn("dares", e); } renderDares();
}
expose({ dareDone, dareReroll });
