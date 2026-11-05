// Goals: progress rings, the two-week cadence, chart points, presets.
import { test } from "node:test";
import assert from "node:assert/strict";
import { installEnv } from "./_env.mjs";
installEnv();
const { PRESETS, progress, dueOn, isDue, dueGoals, chartPoints, latest, first, SPLIT_KEYS, isSplit, splitGoal, splitNote, splitRowsHtml, draftGoal } = await import("../js/goals.js");
import { readFileSync } from "node:fs";
const src = (f) => readFileSync(new URL("../" + f, import.meta.url), "utf8").replace(/\r\n/g, "\n");

test("ten presets, each flexibility / strength / balance, no body-size measures", () => {
  assert.equal(PRESETS.length, 10);
  for (const p of PRESETS) { assert.ok(p.key && p.name && p.emoji); assert.ok(["sec", "deg", ""].includes(p.unit), p.key); assert.ok(!/weight|waist|size/i.test(p.name)); }
  assert.ok(PRESETS.some(p => p.name === "Aerial progression" && p.unit === ""));
});
test("progress: numeric goals against the target, photo-only goals by check-ins toward six", () => {
  const g = { unit: "deg", target: 180, checkins: [{ date: "2026-09-01", value: 150 }, { date: "2026-09-15", value: 162 }] };
  assert.equal(progress(g), 90); assert.equal(latest(g).value, 162); assert.equal(first(g).value, 150);
  assert.equal(progress({ target: 0, checkins: [{ date: "2026-09-01" }, { date: "2026-09-15" }, { date: "2026-09-29" }] }), 50);
  assert.equal(progress({ target: 10, checkins: [] }), 0);
  assert.equal(progress({ target: 10, checkins: [{ date: "2026-09-01", value: 25 }] }), 100, "capped");
});
test("check-in cadence: due 14 days after the last one, never daily; snooze hides the reminder", () => {
  const g = { id: "g", createdAt: "2026-09-01", checkins: [{ date: "2026-09-10", value: 1 }] };
  assert.equal(dueOn(g), "2026-09-24"); assert.equal(isDue(g, "2026-09-23"), false); assert.equal(isDue(g, "2026-09-24"), true);
  assert.equal(dueOn({ createdAt: "2026-09-05", checkins: [] }), "2026-09-05");
  assert.equal(dueGoals({ g }, "2026-09-30").length, 1); assert.equal(dueGoals({ g }, "2026-09-30", "2026-10-02").length, 0, "snoozed"); assert.equal(dueGoals({ g: { ...g, deleted: true } }, "2026-09-30").length, 0);
});
test("chart points scale to the target and keep date order", () => {
  const g = { target: 180, checkins: [{ date: "2026-09-15", value: 180 }, { date: "2026-09-01", value: 90 }] };
  assert.equal(chartPoints(g), "0.0,50.0 100.0,0.0");
  assert.equal(chartPoints({ target: 0, checkins: [{ date: "2026-09-01" }] }), "");
});

// 1.64.2 (Jenya, Nov 5: splits are just one of the skills she is working on)
test("the three splits are rows in the skill list from the start: no goal to set up, no target, no minus", () => {
  assert.deepEqual(SPLIT_KEYS, ["split-r", "split-l", "split-m"]); assert.ok(isSplit({ preset: "split-m" })); assert.ok(!isSplit({ preset: "bridge" })); assert.ok(!isSplit(null));
  const none = splitRowsHtml({}); assert.equal((none.match(/class="skill-row"/g) || []).length, 3); for (const n of ["Right split", "Left split", "Middle split"]) assert.ok(none.includes(n), n);
  assert.equal((none.match(/＋ first photo/g) || []).length, 3, "nothing yet: an invitation, not a zero"); assert.match(none, /onclick="splitOpen\('split-l'\)"/); assert.doesNotMatch(none, /180|%|target|due/i);
  assert.equal(splitNote(null), "📷 ＋ first photo"); assert.equal(splitNote({ checkins: [{ date: "2026-11-01" }] }), "📷 1 time so far");
  assert.equal(splitNote({ checkins: [{ date: "2026-11-01", value: 150 }, { date: "2026-11-15", value: 162 }] }), "▲ 12° since your first one");
  assert.equal(splitNote({ checkins: [{ date: "2026-11-01", value: 150 }, { date: "2026-11-15", value: 141 }] }), "📷 2 times so far", "a smaller number never shows as a minus");
  assert.equal(splitNote({ checkins: [{ date: "2026-11-01", value: 150 }, { date: "2026-11-15" }, { date: "2026-11-29", value: 155 }] }), "▲ 5° since your first one", "a check-in without a number is skipped");
});
test("a split made as a goal before is the same row, with everything it had; nothing is stored until a first check-in", () => {
  const old = { id: "g1", preset: "split-r", createdAt: "2026-09-01", checkins: [{ date: "2026-09-01", value: 150 }, { date: "2026-09-15", value: 160 }] };
  const goals = { g1: old, g9: { id: "g9", preset: "split-r", createdAt: "2026-10-01", checkins: [] }, gx: { id: "gx", preset: "split-l", createdAt: "2026-09-01", deleted: true, checkins: [{ date: "2026-09-01", value: 100 }] }, b: { id: "b", preset: "bridge", createdAt: "2026-09-01", checkins: [] } };
  assert.equal(splitGoal(goals, "split-r"), old, "the oldest one kept"); assert.equal(splitGoal(goals, "split-l"), null, "a removed one is not a row's goal"); assert.equal(splitGoal(goals, "split-m"), null);
  const rows = splitRowsHtml(goals); assert.match(rows, /Right split<\/span><small>▲ 10° since your first one</); assert.match(rows, /Left split<\/span><small>📷 ＋ first photo</);
  const d = draftGoal("new:split-m"); assert.equal(d.name, "Middle split"); assert.equal(d.measure, "split"); assert.equal(d.draft, true); assert.deepEqual(d.checkins, []); assert.equal(draftGoal("g1"), null); assert.equal(draftGoal("new:nope"), null);
  assert.deepEqual(dueGoals(goals, "2026-12-01").map(g => g.id), ["b"], "a split never asks for a check-in on Today; other goals do");
  const g = src("js/goals.js"), me = src("js/views/me.js");
  assert.match(g, /if \(draftGoal\(id\)\) id = \(await addGoal\(String\(id\)\.slice\(DRAFT\.length\)\)\)\.id; await checkIn\(id, pendingFile, v\)/, "the goal document is written at the first check-in");
  assert.match(g, /filter\(g => !g\.deleted && !isSplit\(g\)\)\.sort/, "the Goals card leaves the splits to the skill list"); assert.match(g, /PRESETS\.filter\(p => !SPLIT_KEYS\.includes\(p\.key\)\)\.map/, "and New goal doesn't offer them twice");
  assert.match(g, /\$\{split \? "" : `<button class="btn sm ghost" onclick="goalRemove/, "a split row is always there: no Remove"); assert.match(me, /\$\("#skillList"\)\.innerHTML = splitRowsHtml\(S\.goals\) \+/);
  assert.match(src("js/version.js"), /APP_VERSION = "1\.(64\.[2-9]|6[5-9]|[7-9]\d)/); assert.match(src("README.md"), /\*\*1\.64\.2:\*\* the three splits are rows/);
});
