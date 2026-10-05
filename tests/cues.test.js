// Cue sheets: text form round-trip, what shows at a given time, seeding from a music map.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseCueText, formatCueText, normalizeCues, cueAt, cuesFromMap, parseTime, fmtTime } from "../js/cues.js";

test("text form: m:ss | words | move, tolerant of blanks and bad lines, sorted by time", () => {
  const cues = parseCueText("0:50 | on the swell | Cartwheel\n0:12 || Floor work\nnot a cue\n1:08 | | Walkover | with a pipe\n0:18 | just words |");
  assert.deepEqual(cues, [{ t: 12, lyric: "", move: "Floor work" }, { t: 18, lyric: "just words", move: "" }, { t: 50, lyric: "on the swell", move: "Cartwheel" }, { t: 68, lyric: "", move: "Walkover | with a pipe" }]);
  assert.equal(formatCueText(cues), "0:12 |  | Floor work\n0:18 | just words | \n0:50 | on the swell | Cartwheel\n1:08 |  | Walkover | with a pipe");
  assert.deepEqual(parseCueText(formatCueText(cues)), cues, "round-trips");
  assert.equal(parseTime("1:52"), 112); assert.equal(parseTime("1:52.5"), 112.5); assert.equal(parseTime("7"), 7); assert.equal(parseTime("x"), null); assert.equal(fmtTime(112.7), "1:52");
  assert.deepEqual(normalizeCues([{ t: 5 }, { t: 3, move: "a" }]), [{ t: 3, lyric: "", move: "a" }]);
});

test("cueAt: current cue, next cue, and 'soon' inside the 4-second lead", () => {
  const cues = [{ t: 10, move: "A" }, { t: 20, move: "B" }, { t: 30, move: "C" }];
  let r = cueAt(cues, 0); assert.equal(r.cur, null); assert.equal(r.next.move, "A"); assert.equal(r.soon, false); assert.equal(r.index, -1); assert.equal(r.total, 3);
  r = cueAt(cues, 17); assert.equal(r.cur.move, "A"); assert.equal(r.next.move, "B"); assert.equal(r.soon, true); assert.equal(r.untilNext, 3); assert.equal(r.index, 0);
  r = cueAt(cues, 31); assert.equal(r.cur.move, "C"); assert.equal(r.next, null); assert.equal(r.untilNext, null);
  assert.deepEqual(cueAt([], 5), { cur: null, next: null, soon: false, untilNext: null, index: -1, total: 0 });
});

test("the built-in dances ship cue sheets seeded from their maps, moves only (words left for the parent)", () => {
  const dances = JSON.parse(readFileSync(new URL("../data/dances.json", import.meta.url), "utf8"));
  for (const id of ["solo", "trio", "pitch-jazz"]) { const d = dances.find(x => x.id === id); const c = normalizeCues(d.cues); assert.ok(c.length >= 8, id + " cues"); assert.ok(c.every(x => x.move && !x.lyric), id + " moves only, no lyrics"); assert.deepEqual(c.map(x => x.t), [...c.map(x => x.t)].sort((a, b) => a - b)); }
  const fromMap = cuesFromMap(dances.find(x => x.id === "solo").map);
  assert.ok(fromMap.some(c => c.t === 50 && c.move === "cartwheel"), "0:50 cartwheel, parenthetical dropped");
});

test("the solo carries the step order from the walkthrough: short lines, tricks in the teacher's order, head back on the donut roll", () => {
  const dances = JSON.parse(readFileSync(new URL("../data/dances.json", import.meta.url), "utf8"));
  const solo = dances.find(x => x.id === "solo"); const st = solo.steps;
  assert.ok(Array.isArray(st) && st.length >= 25); assert.ok(st.every(x => typeof x === "string" && x.length > 0 && x.length <= 70));
  const at = (w) => st.findIndex(x => x.toLowerCase().includes(w)); const order = ["handstand", "walkover", "donut roll", "calypso", "scorpion"].map(at);
  assert.ok(order.every(i => i >= 0)); assert.deepEqual(order, [...order].sort((a, b) => a - b));
  assert.ok(solo.corrections.some(c => /Donut roll/.test(c) && /head ALL the way back/.test(c))); assert.ok(!solo.corrections.some(c => /chin tucked/i.test(c))); assert.ok(!solo.tricks.some(c => /chin tucked/i.test(c)));
});
