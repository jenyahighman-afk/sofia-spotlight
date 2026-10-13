// Streak rules: one bite, ≥60% checklist, a logged run or a quick session counts; studio days and school breaks pause;
// two missed home days a week are free, the third breaks.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { computeStreak, bestStreak, dayCounts, isPaused, practicedDays, skipsLeft, FREE_SKIPS } from "../js/streak.js";

const classes = JSON.parse(readFileSync(new URL("../data/classes.json", import.meta.url), "utf8")); // Mon, Tue, Wed, Sat
const events = JSON.parse(readFileSync(new URL("../data/events.json", import.meta.url), "utf8"));   // includes Mid-winter break Feb 15–21 2027
const T = 12; // practice items
const full = { done: Array.from({ length: 12 }, (_, i) => "i" + i) };
const seven = { done: Array.from({ length: 7 }, (_, i) => "i" + i) };   // 58% → doesn't count
const eight = { done: Array.from({ length: 8 }, (_, i) => "i" + i) };   // 67% → counts

test("a day counts at 60% or with any run", () => {
  assert.equal(dayCounts({ done: Array.from({ length: 9 }, (_, i) => "i" + i), total: 16 }, T), false, "9/16 is under 60% even though 9/12 would pass");
  assert.equal(dayCounts({ done: Array.from({ length: 10 }, (_, i) => "i" + i), total: 16 }, T), true);
  assert.equal(dayCounts(seven, T), false);
  assert.equal(dayCounts(eight, T), true);
  assert.equal(dayCounts({ done: [], runs: [{ at: "x" }] }, T), true);
  assert.equal(dayCounts({ done: [], bites: ["tired"] }, T), true, "one bite counts"); assert.equal(dayCounts({ done: [], bites: [] }, T), false);
  assert.equal(dayCounts(undefined, T), false);
});

test("studio days and school breaks pause the streak", () => {
  assert.equal(isPaused("2026-09-28", classes, events), true);  // Monday
  assert.equal(isPaused("2026-10-01", classes, events), false); // Thursday (home day)
  assert.equal(isPaused("2027-02-18", classes, events), true);  // Thursday inside mid-winter break
});

test("streak counts back over studio days without breaking, and breaks on a missed home day", () => {
  // Thu Sep 24, Fri Sep 25, Sun Sep 27 practiced; Mon/Tue/Wed studio; today Thu Oct 1 not yet done.
  const practice = { "2026-09-24": full, "2026-09-25": eight, "2026-09-27": { done: [], runs: [{ at: "r" }] } };
  assert.equal(computeStreak({ practice, classes, events, totalItems: T, today: "2026-10-01" }), 3);
  // Practicing today extends it.
  assert.equal(computeStreak({ practice: { ...practice, "2026-10-01": full }, classes, events, totalItems: T, today: "2026-10-01" }), 4);
  // A missed Friday is a free skip: Thursday and Sunday both count. A 58% day is a skip too, not a break.
  const gap = { "2026-09-24": full, "2026-09-27": full };
  assert.equal(computeStreak({ practice: gap, classes, events, totalItems: T, today: "2026-09-28" }), 2);
  assert.equal(computeStreak({ practice: { "2026-09-24": full, "2026-09-25": seven, "2026-09-27": full }, classes, events, totalItems: T, today: "2026-09-28" }), 2);
  assert.equal(computeStreak({ practice: {}, classes, events, totalItems: T, today: "2026-09-28" }), 0);
});

test("two free skips a week; the third missed home day in a Sun–Sat week breaks the streak", () => {
  assert.equal(FREE_SKIPS, 2);
  // Week of Sun Sep 20: Sun 20, Thu 24, Fri 25 all missed → three skips → the streak before them is gone.
  assert.equal(computeStreak({ practice: { "2026-09-17": full }, classes, events, totalItems: T, today: "2026-10-01" }), 0);
  // Thu Sep 24 practiced: Sun 20 and Fri 25 are that week's two free skips; then Sun 27 (next week) is free; Thu 17 counts; Sun 13 + Fri 11 + Thu 10 → the week of Sep 6 breaks it.
  assert.equal(computeStreak({ practice: { "2026-09-17": full, "2026-09-24": full }, classes, events, totalItems: T, today: "2026-10-01" }), 2);
  // Free skips left this week (Sun–Sat), today itself still open.
  assert.equal(skipsLeft({ practice: {}, classes, events, totalItems: T, today: "2026-09-24" }), 1, "Thu: Sunday was missed");
  assert.equal(skipsLeft({ practice: { "2026-09-20": full }, classes, events, totalItems: T, today: "2026-09-24" }), 2);
  assert.equal(skipsLeft({ practice: {}, classes, events, totalItems: T, today: "2026-09-26" }), 0, "Sat: Sun, Thu, Fri missed");
  assert.equal(skipsLeft({ practice: { "2026-09-24": { bites: ["move"] } }, classes, events, totalItems: T, today: "2026-09-26" }), 0, "Sun and Fri missed, Thu had a bite");
});

test("best streak and practiced-day count", () => {
  const practice = { "2026-09-24": full, "2026-09-25": full, "2026-09-27": full, "2026-10-08": full, "2026-10-09": seven };
  assert.equal(bestStreak({ practice, classes, events, totalItems: T, today: "2026-10-10" }), 4, "Oct 1, 2 and 4 are free skips, so Oct 8 joins the September days");
  assert.equal(practicedDays(practice, T), 4);
});
