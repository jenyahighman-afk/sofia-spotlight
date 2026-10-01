// Streak rules: ≥60% checklist or a logged run counts; studio days and school breaks pause; other misses break.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { computeStreak, bestStreak, dayCounts, isPaused, practicedDays } from "../js/streak.js";

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
  // A missed Friday breaks it: only Sunday counts.
  const gap = { "2026-09-24": full, "2026-09-27": full };
  assert.equal(computeStreak({ practice: gap, classes, events, totalItems: T, today: "2026-09-28" }), 1);
  // A 58% day does not count and does break.
  assert.equal(computeStreak({ practice: { "2026-09-24": full, "2026-09-25": seven, "2026-09-27": full }, classes, events, totalItems: T, today: "2026-09-28" }), 1);
  assert.equal(computeStreak({ practice: {}, classes, events, totalItems: T, today: "2026-09-28" }), 0);
});

test("best streak and practiced-day count", () => {
  const practice = { "2026-09-24": full, "2026-09-25": full, "2026-09-27": full, "2026-10-08": full, "2026-10-09": seven };
  assert.equal(bestStreak({ practice, classes, events, totalItems: T, today: "2026-10-10" }), 3);
  assert.equal(practicedDays(practice, T), 4);
});
