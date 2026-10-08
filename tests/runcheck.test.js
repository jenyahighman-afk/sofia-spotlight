// Run check: snap times from the cue sheet, which frame is due now, whole-body check.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installEnv } from "./_env.mjs";
installEnv();
const { snapTimes, dueFrame, fullBody, LATE_SEC } = await import("../js/runcheck.js");
const dances = JSON.parse(readFileSync(new URL("../data/dances.json", import.meta.url), "utf8"));

test("snap times: the solo's cue sheet for a full run, even spacing for a short clip or no cues", () => {
  const solo = dances.find(d => d.id === "solo"); const t = snapTimes(124, solo.cues);
  assert.ok(t.length >= 16 && t.length <= 20); assert.ok(t.includes(50.8), "one just after the cartwheel cue"); assert.ok(t.every(x => x < 124));
  assert.equal(snapTimes(30, solo.cues).length, 16); assert.equal(snapTimes(124, []).length, 16);
});
test("the due frame is the first untaken time at or before now; stale ones are skipped, not fired in a burst", () => {
  const times = [1, 2, 3, 10];
  assert.deepEqual(dueFrame(times, 0.5, 0), { index: -1, next: 0, skipped: 0 });
  assert.deepEqual(dueFrame(times, 1.2, 0), { index: 0, skipped: 0 });
  assert.deepEqual(dueFrame(times, 1.2, 1), { index: -1, next: 1, skipped: 0 });
  const late = dueFrame(times, 3 + LATE_SEC + 0.1, 0); assert.equal(late.index, -1); assert.equal(late.next, 3); assert.equal(late.skipped, 3);
  assert.deepEqual(dueFrame(times, 10, 3), { index: 3, skipped: 0 }); assert.equal(dueFrame(times, 99, 4).next, 4);
});
test("whole body means shoulders and ankles seen with confidence and inside the frame", () => {
  const lm = Array.from({ length: 33 }, () => ({ x: .5, y: .5, visibility: .9 })); lm[27].y = .9; lm[28].y = .9; lm[11].y = .2; lm[12].y = .2;
  assert.equal(fullBody(lm), true);
  assert.equal(fullBody(null), false);
  assert.equal(fullBody(lm.map((p, i) => i === 27 ? { ...p, visibility: .2 } : p)), false);
  assert.equal(fullBody(lm.map((p, i) => i === 28 ? { ...p, y: .995 } : p)), false);
});
