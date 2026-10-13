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
const weekday = (iso) => new Date(iso + "T00:00:00").getDay();
export const isBreak = (e) => /break/i.test(e.type || "") || /break/i.test(e.name || "");
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
