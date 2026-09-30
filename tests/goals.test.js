// Goals: progress rings, the two-week cadence, chart points, presets.
import { test } from "node:test";
import assert from "node:assert/strict";
import { installEnv } from "./_env.mjs";
installEnv();
const { PRESETS, progress, dueOn, isDue, dueGoals, chartPoints, latest, first } = await import("../js/goals.js");

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
