// Mind skills: weekly lesson, the pre-stage routine, the comp-day fuel data.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installEnv } from "./_env.mjs";
installEnv();
const { weekLesson, ritualSteps, ritualSecs, MAX_RITUAL, DEFAULT_RITUAL } = await import("../js/mind.js");
const { starsFor } = await import("../js/stars.js");
const mind = JSON.parse(readFileSync(new URL("../data/mind.json", import.meta.url), "utf8"));

test("mind.json: 8+ lessons with id, name, why, 3 short steps and a try line; ritual menu with seconds; pescatarian comp fuel", () => {
  assert.ok(mind.lessons.length >= 8); assert.equal(new Set(mind.lessons.map(l => l.id)).size, mind.lessons.length);
  for (const l of mind.lessons) { assert.ok(l.id && l.n && l.ic && l.why.length <= 110 && l.try.length <= 90, l.id); assert.equal(l.steps.length, 3); assert.ok(l.steps.every(s => s.length <= 60), l.id); }
  assert.ok(mind.ritual.length >= 6 && mind.ritual.every(s => s.id && s.n && s.ic && s.secs >= 5 && s.secs <= 30 && s.say.length <= 60));
  assert.ok(mind.compFuel.length >= 5 && mind.compFuel.every(r => r.when && r.eat.length <= 130));
  const all = mind.compFuel.map(r => r.eat.toLowerCase()).join(" "); assert.ok(!/chicken|beef|pork|turkey|ham\b|bacon/.test(all), "no meat"); assert.ok(/fish|tuna/.test(all), "fish is in");
});
test("one lesson per week, changing weekly; the routine keeps menu order, drops unknown ids and caps at six", () => {
  const a = weekLesson("2026-10-05", mind.lessons), b = weekLesson("2026-10-11", mind.lessons), c = weekLesson("2026-10-12", mind.lessons);
  assert.equal(a.id, b.id); assert.notEqual(a.id, c.id);
  const st = ritualSteps(["focal", "nope", "shake", "breathe"], mind.ritual); assert.deepEqual(st.map(s => s.id), ["shake", "breathe", "focal"]); assert.equal(ritualSecs(st), 45);
  assert.equal(ritualSteps(mind.ritual.map(s => s.id), mind.ritual).length, MAX_RITUAL); assert.deepEqual(ritualSteps("junk", mind.ritual), []);
  assert.ok(DEFAULT_RITUAL.every(id => mind.ritual.some(s => s.id === id))); assert.equal(starsFor("mind", 1), 1);
});
