// Practice streak rules (pure; tested in Node).
// A day counts when the checklist is ≥60% done or a "Run it" was logged. Studio days and school breaks pause the streak: they
// neither count nor break it. A missed home/rest day breaks it. Today doesn't break it while it's still in progress.
import { shiftDate } from "./corrections.js";

export const PRACTICE_MIN = 0.6;

export function dayCounts(rec, totalItems){
  if (!rec) return false;
  if (Array.isArray(rec.runs) && rec.runs.length) return true;
  const done = Array.isArray(rec.done) ? rec.done.length : 0;
  return totalItems > 0 && done / totalItems >= PRACTICE_MIN;
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
  let n = 0, day = today, guard = 0;
  if (!dayCounts(practice[day], totalItems)) day = shiftDate(day, -1); // today still open
  while (guard++ < 400) {
    if (dayCounts(practice[day], totalItems)) n++;
    else if (!isPaused(day, classes, events)) break;
    day = shiftDate(day, -1);
  }
  return n;
}
// Longest streak ever (for personal bests).
export function bestStreak({ practice = {}, classes = [], events = [], totalItems = 1, today }){
  const days = Object.keys(practice).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort(); if (!days.length) return 0;
  let best = 0; for (const d of days) if (dayCounts(practice[d], totalItems)) best = Math.max(best, computeStreak({ practice, classes, events, totalItems, today: d }));
  return Math.max(best, computeStreak({ practice, classes, events, totalItems, today }));
}
export function practicedDays(practice, totalItems){ return Object.entries(practice || {}).filter(([d, r]) => /^\d{4}-\d{2}-\d{2}$/.test(d) && dayCounts(r, totalItems)).length; }
