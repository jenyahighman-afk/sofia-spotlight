// Today in bites, the scrolling lines, the color schemes, and the daily lines data.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installEnv } from "./_env.mjs";
installEnv();
const { levelFor, bitesFor, nextLevel, pickDaily, ENERGY, MOOD } = await import("../js/bites.js");
const { prompterLines, prompterHtml } = await import("../js/prompter.js");
const { PALETTES } = await import("../js/palette.js");
const { fallbackLoop, buildStations } = await import("../js/games/quest.js");
const daily = JSON.parse(readFileSync(new URL("../data/daily.json", import.meta.url), "utf8"));
const dances = JSON.parse(readFileSync(new URL("../data/dances.json", import.meta.url), "utf8"));
const skills = JSON.parse(readFileSync(new URL("../data/skills.json", import.meta.url), "utf8"));

test("the check-in picks the day's size; three bites each; done bites are skipped in order", () => {
  assert.equal(levelFor(null), null); assert.equal(levelFor({ e: 1 }), null);
  assert.equal(levelFor({ e: 1, m: 2 }), "easy"); assert.equal(levelFor({ e: 2, m: 2 }), "normal"); assert.equal(levelFor({ e: 3, m: 3 }), "big"); assert.equal(levelFor({ e: 3, m: 2 }), "normal");
  for (const l of ["easy", "normal", "big"]) { const b = bitesFor(l, {}); assert.equal(b.length, 3); assert.ok(b.every(x => x.text.length <= 45 && x.go)); assert.ok(b.every(x => !x.done)); }
  const b = bitesFor("easy", { flex: 1, runs: 0 }); assert.equal(b[0].done, true); assert.equal(b.find(x => !x.done).id, "run");
  assert.equal(bitesFor("big", { reviewed: true })[2].id, "run"); assert.equal(bitesFor("big", {})[2].id, "coach");
  assert.equal(nextLevel("easy"), "normal"); assert.equal(nextLevel("big"), null); assert.equal(ENERGY.length, 3); assert.equal(MOOD.length, 3);
});
test("daily lines: short, kid-sized, one per day by date and never the same two days in a row at the list's length", () => {
  for (const k of ["cheers", "mind", "fuel"]) { assert.ok(daily[k].length >= 12, k); assert.ok(daily[k].every(s => s.length <= 90 && s.length > 8), k + " line length"); }
  assert.equal(pickDaily(daily.cheers, "2026-10-08"), daily.cheers[Math.floor(new Date("2026-10-08T00:00:00").getTime() / 86400000) % daily.cheers.length]);
  assert.notEqual(pickDaily(daily.mind, "2026-10-08"), pickDaily(daily.mind, "2026-10-09")); assert.equal(pickDaily([], "2026-10-08"), "");
});
test("scrolling lines: two past, the current one, three coming; before the first cue a placeholder is current", () => {
  const cues = [0, 12, 18, 34, 48, 50, 68].map(t => ({ t, move: "m" + t }));
  const at40 = prompterLines(cues, 40); assert.deepEqual(at40.map(l => l.state), ["past", "past", "now", "next", "next", "next"]); assert.equal(at40[2].move, "m34");
  assert.equal(prompterLines(cues, 100).filter(l => l.state === "next").length, 0);
  const before = prompterLines(cues, -1); assert.equal(before[0].state, "now"); assert.equal(before[0].move, "…");
  assert.deepEqual(prompterLines([], 5), []); assert.ok(prompterHtml(cues, 40).includes("pl now") && prompterHtml(cues, 40).includes("0:34"));
});
test("five color schemes, blush first; a trick without a cue falls back to the dance's tricks loop, twice at full speed", () => {
  assert.equal(PALETTES[0][0], "blush"); assert.equal(PALETTES.length, 5);
  const solo = dances.find(d => d.id === "solo"); const fb = fallbackLoop(solo); assert.deepEqual(fb, { a: 48, b: 112, at: null, fallback: true });
  const st = buildStations(skills.styles.solo.skills.find(s => s.id === "s-calypso"), solo, []); assert.equal(st[2].loop.fallback, true); assert.equal(st[2].secs, 128); assert.ok(st[2].cue.includes("No cue for the Calypso yet"));
  assert.equal(fallbackLoop({ loops: [] }), null);
});
