// What's Next?: rounds come from a dance's step order; options always include the right answer and never repeat.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installEnv } from "./_env.mjs";
installEnv();
const { makeRound, roundOrder, quizDances, ROUNDS } = await import("../js/games/nextmove.js");
const { starsFor } = await import("../js/stars.js");
const dances = JSON.parse(readFileSync(new URL("../data/dances.json", import.meta.url), "utf8"));

test("the solo can be quizzed; dances without steps cannot", () => {
  assert.deepEqual(quizDances(dances).map(d => d.id), ["solo"]);
  assert.deepEqual(quizDances([{ steps: ["a", "b"] }, {}]), []);
});
test("a round shows a step and three distinct options including the real next step; the last step has no round", () => {
  const steps = dances.find(d => d.id === "solo").steps; let seed = 1; const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  for (let i = 0; i + 1 < steps.length; i++) { const r = makeRound(steps, i, rand); assert.equal(r.prompt, steps[i]); assert.equal(r.answer, steps[i + 1]); assert.equal(r.options.length, 3); assert.ok(r.options.includes(r.answer)); assert.equal(new Set(r.options).size, 3); assert.ok(!r.options.includes(r.prompt)); }
  assert.equal(makeRound(steps, steps.length - 1), null); assert.equal(makeRound(steps, -1), null);
});
test("ten rounds at distinct positions, in dance order, never the last step", () => {
  const o = roundOrder(29); assert.equal(o.length, ROUNDS); assert.equal(new Set(o).size, ROUNDS); assert.deepEqual(o, [...o].sort((a, b) => a - b)); assert.ok(o.every(i => i < 28));
  assert.equal(roundOrder(5).length, 4);
  assert.equal(starsFor("nextmove", 9), 3); assert.equal(starsFor("nextmove", 7), 2); assert.equal(starsFor("nextmove", 3), 1);
});
