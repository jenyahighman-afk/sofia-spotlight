// Practice streak rules (pure; tested in Node).
// A day counts when any bite was done (habit.js), the checklist is ≥60% done, a "Run it" was logged, or a quick session was
// finished. Studio days and school breaks pause the streak: they neither count nor break it. A missed home/rest day is a
// skip: the first FREE_SKIPS skips in a week (Sun–Sat) are free, the next one breaks the streak. Today doesn't break it while
// it's still in progress.
import { shiftDate, weekKey } from "./corrections.js";

export const PRACTICE_MIN = 0.6, FREE_SKIPS = 2;

export function dayCounts(rec, totalItems){
  if (!rec) return false;
  if (Array.isArray(rec.bites) && rec.bites.length) return true;
  if (Array.isArray(rec.runs) && rec.runs.length) return true;
  if (Array.isArray(rec.quick) && rec.quick.length) return true;
  const done = Array.isArray(rec.done) ? rec.done.length : 0; const total = rec.total > 0 ? rec.total : totalItems;
  return total > 0 && done / total >= PRACTICE_MIN;
}
// Two tiers of done. dayCounts above is "streak safe": any bite, a game, a tired stretch. planDone is "the plan is done":
// she danced her solo (or did the studio-day version of it): a run logged from the player, a solo item of the session
// (plan.js SOLO_ITEMS: the solo run, the memory run's top and chunk, a watch-day video, the show in her head), a must-box
// of the dated plan, or a Memorize chunk. The pet grows, the reminder goes quiet and the 2-day clock resets on this tier.
export const SOLO_ITEMS = ["solo-run", "mem-top", "mem-chunk", "watch-walk", "watch-run", "imagery"];
// The trio's part of a day (Jenya, Oct 30: solo first on every home day, "but she also needs time to work on memorizing and
// practicing her trio"): the plan's trio item (the week's trio goal on a full day, the memory run's trio), a trio run logged
// from the player, or all five of the trio's Memorize steps. It never makes ⭐ Plan done: the streak and the reminders count the solo.
export const TRIO_ITEMS = ["trio-mark", "mem-trio"];
export function trioDone(rec){
  if (!rec) return false;
  if (Array.isArray(rec.done) && rec.done.some(id => TRIO_ITEMS.includes(id))) return true;
  if (Array.isArray(rec.runs) && rec.runs.some(r => r && r.danceId === "trio")) return true;
  const m = rec.memo && typeof rec.memo === "object" ? rec.memo.trio : null; return Array.isArray(m) && new Set(m).size >= 5;
}
// What opens Play's weekend games, the countdown door and the dare on a home day: the plan done (the solo) and, when today's
// plan has a trio item, the trio too. `items` = today's plan (planToday.planFor).
export const gateOpen = (rec, items = []) => planDone(rec) && (!(items || []).some(it => it && TRIO_ITEMS.includes(it.id)) || trioDone(rec));
export function planDone(rec){
  if (!rec) return false;
  // A run of the solo from the player (a run without a dance is the solo's, as in ready.js); a trio run is the trio's part
  // (trioDone), never the plan (the Oct 30 re-audit: trio work alone showed ⭐ Plan done and opened Play).
  if (Array.isArray(rec.runs) && rec.runs.some(r => r && (!r.danceId || r.danceId === "solo"))) return true;
  if (Array.isArray(rec.done) && rec.done.some(id => SOLO_ITEMS.includes(id))) return true;
  // The "memo" bite is any dance's five Memorize steps: only the solo's finish the plan (a record from before the per-dance steps counts).
  const bites = Array.isArray(rec.bites) ? rec.bites : []; const m = rec.memo && typeof rec.memo === "object" ? rec.memo : null;
  return bites.includes("plan") || (bites.includes("memo") && (!m || (Array.isArray(m.solo) && new Set(m.solo).size >= 5)));
}
export function planDays(practice){ return Object.entries(practice || {}).filter(([d, r]) => /^\d{4}-\d{2}-\d{2}$/.test(d) && planDone(r)).length; }
const weekday = (iso) => new Date(iso + "T00:00:00").getDay();
// A break pauses the streak, and so do a booked studio date (kind "class": a picked showing, a private on a home day) and a
// show weekend (`paused`: the Winter Showcase) since 1.58.0: she is at the studio or on stage, not at home.
export const isBreak = (e) => /break/i.test(e.type || "") || /break/i.test(e.name || "") || e.kind === "class" || !!e.paused;
export function isPaused(iso, classes, events){
  const wd = weekday(iso);
  if ((classes || []).some(c => c.day === wd)) return true;
  return (events || []).some(e => isBreak(e) && iso >= e.start && iso <= (e.end || e.start));
}

// Current streak length in practice days, counting back from `today`.
export function computeStreak({ practice = {}, classes = [], events = [], totalItems = 1, today }){
  let n = 0, day = today, guard = 0; const skips = {};
  if (!dayCounts(practice[day], totalItems)) day = shiftDate(day, -1); // today still open
  while (guard++ < 400) {
    if (dayCounts(practice[day], totalItems)) n++;
    else if (!isPaused(day, classes, events)) { const w = weekKey(day); skips[w] = (skips[w] || 0) + 1; if (skips[w] > FREE_SKIPS) break; }
    day = shiftDate(day, -1);
  }
  return n;
}
// Free skips left this week: FREE_SKIPS minus the home/rest days before today (same Sun–Sat week) with nothing done.
export function skipsLeft({ practice = {}, classes = [], events = [], totalItems = 1, today }){
  const w = weekKey(today); let used = 0;
  for (let day = shiftDate(today, -1); weekKey(day) === w; day = shiftDate(day, -1)) if (!dayCounts(practice[day], totalItems) && !isPaused(day, classes, events)) used++;
  return Math.max(0, FREE_SKIPS - used);
}
// Longest streak ever (for personal bests).
export function bestStreak({ practice = {}, classes = [], events = [], totalItems = 1, today }){
  const days = Object.keys(practice).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort(); if (!days.length) return 0;
  let best = 0; for (const d of days) if (dayCounts(practice[d], totalItems)) best = Math.max(best, computeStreak({ practice, classes, events, totalItems, today: d }));
  return Math.max(best, computeStreak({ practice, classes, events, totalItems, today }));
}
export function practicedDays(practice, totalItems){ return Object.entries(practice || {}).filter(([d, r]) => /^\d{4}-\d{2}-\d{2}$/.test(d) && dayCounts(r, totalItems)).length; }
