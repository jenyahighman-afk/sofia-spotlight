// Trick Quest: bars seeded from the coach's checks, stations from the trick card, the music loop from the cue sheet.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installEnv } from "./_env.mjs";
installEnv();
const { seedBars, questOf, cleared, trickLoop, buildStations, shotScore, BARS } = await import("../js/games/quest.js");
const { starsFor } = await import("../js/stars.js");
const dances = JSON.parse(readFileSync(new URL("../data/dances.json", import.meta.url), "utf8"));
const skills = JSON.parse(readFileSync(new URL("../data/skills.json", import.meta.url), "utf8"));
const solo = dances.find(d => d.id === "solo");

test("bars: no review = 70 each; a ticked check starts low, a flagged one full", () => {
  assert.deepEqual(seedBars(null), { feet: 70, knees: 70, arms: 70 });
  const b = seedBars({ review: { feet: "✓ pointed", knees: "bent on the landing", arms: "✓" } }); assert.equal(b.feet, 35); assert.equal(b.knees, 100); assert.equal(b.arms, 35);
  assert.equal(cleared({ feet: 0, knees: 0, arms: 0 }), true); assert.equal(cleared({ feet: 0, knees: 5, arms: 0 }), false);
  assert.deepEqual(questOf({ quest: { bars: { feet: 1, knees: 2, arms: 3 }, gems: ["2026-10-01"] } }), { bars: { feet: 1, knees: 2, arms: 3 }, gems: ["2026-10-01"] });
  assert.deepEqual(questOf({}), { bars: null, gems: [] });
});
test("the music loop wraps the trick's cue; a trick without a cue has none", () => {
  const l = trickLoop(solo, "Cartwheel on the swell"); assert.deepEqual(l, { a: 44, b: 58, at: 50 });
  assert.equal(trickLoop(solo, "Tailbone balance").at, 12); assert.equal(trickLoop(solo, "Nope"), null);
});
test("three stations: prep from the drill, slow five with the open note or the tip, music timed to four passes", () => {
  const calypso = skills.styles.solo.skills.find(s => s.id === "s-calypso");
  const st = buildStations(calypso, solo, [{ text: "Calypso: front leg straight and turned out, back knee high" }]);
  assert.deepEqual(st.map(s => s.kind), ["prep", "slow", "music"]); assert.ok(st[0].cue.length > 10 && st[0].cue.length <= 200); assert.ok(st[1].cue.includes("Calypso ×5") && st[1].cue.includes("front leg straight"));
  assert.equal(st[2].loop.fallback, true); assert.equal(st[2].loop.at, null);
  const cw = buildStations(skills.styles.solo.skills.find(s => s.id === "s-cartwheel"), solo, []); assert.equal(cw[2].loop.at, 50); assert.equal(cw[2].secs, Math.round(14 * 4 / 0.93)); assert.ok(cw[1].cue.includes("Dance the 4 counts in"));
  assert.deepEqual(BARS, ["feet", "knees", "arms"]);
});
test("a freeze shot scores 100 against itself and lower the further away; stars for a gem, a good shot, a try", () => {
  const f = [0.5, -1.2, -0.5, -1.2, 0.4, -0.6, -0.4, -0.6, 1, 1]; assert.equal(shotScore(f, f), 100);
  const g = f.map((x, i) => i < 8 ? x + 0.9 : x - 0.5); assert.ok(shotScore(f, g) < 70, "far shape scores low"); assert.ok(shotScore(f, f.map((x, i) => i < 8 ? x + 0.1 : x)) >= 70, "near shape scores well"); assert.equal(shotScore(null, f), 0);
  assert.equal(starsFor("quest", 100), 3); assert.equal(starsFor("quest", 75), 2); assert.equal(starsFor("quest", 40), 1);
});
