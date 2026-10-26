// Cue sheets: text form round-trip, what shows at a given time, seeding from a music map.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseCueText, formatCueText, normalizeCues, cueAt, cuesFromMap, parseTime, fmtTime, fmtCueTime, isCueTable, trickAhead, nudgeCue, applyCueTimes, cueTimesDiff } from "../js/cues.js";

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
  assert.ok(fromMap.some(c => c.t === 49.5 && c.move === "cartwheel"), "0:49.5 cartwheel");
  assert.ok(fromMap.some(c => c.t === 67.75 && c.move === "walkover to knees"), "1:07.75 walkover, parenthetical dropped");
});

// The verified table from Hannah's run-through (cue pack, Oct 25): track time, 0:00 = start of the 2:04 file.
const TABLE = [[1, "0:00", "0:07"], [2, "0:07", "0:10.5"], [3, "0:10.5", "0:12.5", 1], [4, "0:12.5", "0:16.5"], [5, "0:16.5", "0:19.5", 1], [6, "0:19.5", "0:22"], [7, "0:22", "0:31.5"], [8, "0:31.5", "0:34", 1], [9, "0:34", "0:38.5"], [10, "0:38.5", "0:43.75"], [11, "0:43.75", "0:48"], [12, "0:48", "0:49.5", 1], [13, "0:49.5", "0:52", 1], [14, "0:52", "0:58"], [15, "0:58", "1:07.75"], [16, "1:07.75", "1:10.5", 1], [17, "1:10.5", "1:17"], [18, "1:17", "1:18.25"], [19, "1:18.25", "1:21", 1], [20, "1:21", "1:28.5"], [21, "1:28.5", "1:30.5", 1], [22, "1:30.5", "1:40.75"], [23, "1:40.75", "1:42.5", 1], [24, "1:42.5", "1:49.5"], [25, "1:49.5", "1:53", 1], [26, "1:53", "1:57.5"], [27, "1:57.5", "2:00.5"], [28, "2:00.5", "2:04", 1]];
test("the solo ships the verified 28-cue table: exact starts and ends, gapless, 11 key tricks, a photo each, no lyrics", () => {
  const solo = JSON.parse(readFileSync(new URL("../data/dances.json", import.meta.url), "utf8")).find(x => x.id === "solo");
  const c = normalizeCues(solo.cues); assert.equal(c.length, 28); assert.ok(isCueTable(solo.cues)); assert.equal(solo.cueSource, "Hannah run-through, checked Oct 25");
  TABLE.forEach(([n, a, b, trick], i) => { assert.equal(c[i].n, n); assert.equal(c[i].t, parseTime(a), `cue ${n} start`); assert.equal(c[i].end, parseTime(b), `cue ${n} end`); assert.equal(!!c[i].trick, !!trick, `cue ${n} trick`); assert.match(c[i].photo, new RegExp("^" + String(n).padStart(2, "0") + "-.+\\.jpg$")); assert.ok(!c[i].lyric); });
  for (let i = 1; i < c.length; i++) assert.equal(c[i - 1].end, c[i].t, "no gap, no overlap");
  assert.equal(c[18].move, "Donut roll on the mat"); assert.equal(fmtCueTime(c[18].t), "1:18.25"); assert.equal(fmtCueTime(c[15].t), "1:07.75"); assert.equal(fmtCueTime(c[11].t), "0:48"); assert.equal(fmtCueTime(c[2].t), "0:10.5");
  assert.equal(parseTime("1:07.75"), 67.75); assert.equal(parseTime("0:10.5"), 10.5);
});
test("a cue with an end is shown for [start, end) only: nothing holds past it, the next key trick previews 2 s ahead", () => {
  const cues = [{ n: 1, t: 0, end: 7, move: "Walk" }, { n: 2, t: 10, end: 12, move: "Leap", trick: true }];
  assert.equal(cueAt(cues, 6.9).cur.move, "Walk"); assert.equal(cueAt(cues, 7).cur, null, "past its end: nothing on"); assert.equal(cueAt(cues, 9).cur, null);
  assert.equal(cueAt(cues, 11.99).cur.move, "Leap"); assert.equal(cueAt(cues, 12).cur, null);
  assert.equal(trickAhead(cues, 7.9), null, "more than 2 s away"); assert.equal(trickAhead(cues, 8).move, "Leap"); assert.equal(trickAhead(cues, 10.5), null, "already on");
  // The old point cues (no end) still hold until the next one, as before.
  assert.equal(cueAt([{ t: 0, move: "A" }, { t: 30, move: "B" }], 29).cur.move, "A");
  // The real solo: 1:08 is the walkover (it used to sit on a cue from 0:50 for ~30 s); the donut roll lands at 1:18.25, not at ~0:19.
  const solo = JSON.parse(readFileSync(new URL("../data/dances.json", import.meta.url), "utf8")).find(x => x.id === "solo");
  assert.equal(cueAt(solo.cues, 68).cur.n, 16); assert.equal(cueAt(solo.cues, 78.2).cur.n, 18); assert.equal(cueAt(solo.cues, 78.25).cur.move, "Donut roll on the mat"); assert.equal(cueAt(solo.cues, 20).cur.n, 6);
  assert.equal(trickAhead(solo.cues, 76.5).n, 19); assert.equal(trickAhead(solo.cues, 46).n, 12);
});
test("the cue check tool: ±0.25 s nudges keep the table gapless and stay between the neighbours; only changed starts are saved", () => {
  const solo = JSON.parse(readFileSync(new URL("../data/dances.json", import.meta.url), "utf8")).find(x => x.id === "solo");
  let t = nudgeCue(solo.cues, 19, 0.25); const c19 = t.find(c => c.n === 19), c18 = t.find(c => c.n === 18);
  assert.equal(c19.t, 78.5); assert.equal(c18.end, 78.5); assert.equal(c19.end, 81, "its own end stays");
  t = nudgeCue(t, 19, -10); assert.equal(t.find(c => c.n === 19).t, 77.25, "no earlier than its neighbour + 0.25");
  assert.deepEqual(cueTimesDiff(solo.cues, t), { 19: 77.25 });
  const applied = applyCueTimes(solo.cues, { 19: 77.25 }); assert.equal(applied.find(c => c.n === 18).end, 77.25); assert.equal(applied.find(c => c.n === 19).t, 77.25); assert.equal(applied.length, 28);
  assert.deepEqual(applyCueTimes(solo.cues, null).map(c => c.t), normalizeCues(solo.cues).map(c => c.t));
  assert.equal(nudgeCue(solo.cues, 1, -0.25).find(c => c.n === 1).t, 0, "never below 0:00");
  assert.equal(isCueTable([{ t: 0, move: "x" }]), false);
});

test("the solo carries the step order from the walkthrough: short lines, tricks in the teacher's order, the donut roll over one shoulder", () => {
  const dances = JSON.parse(readFileSync(new URL("../data/dances.json", import.meta.url), "utf8"));
  const solo = dances.find(x => x.id === "solo"); const st = solo.steps;
  assert.ok(Array.isArray(st) && st.length >= 25); assert.ok(st.every(x => typeof x === "string" && x.length > 0 && x.length <= 70));
  const at = (w) => st.findIndex(x => x.toLowerCase().includes(w)); const order = ["handstand", "walkover", "donut roll", "calypso", "scorpion"].map(at);
  assert.ok(order.every(i => i >= 0)); assert.deepEqual(order, [...order].sort((a, b) => a - b));
  // Oct 25 drill text, word for word; nothing on the card still says to put the head back.
  assert.ok(solo.tricks.includes("Donut roll (1:18.25): Mat only. Cobra + seal 20 s first. Kneel, sit back, roll back over ONE shoulder (head to the side, chin tucked), up to the knees ×5. Never over the head."));
  assert.ok(![...solo.corrections, ...solo.tricks, ...solo.steps].some(c => /head ALL the way back/i.test(c)));
  // None of the old times or labels are left anywhere on the card.
  const card = JSON.stringify({ ...solo, cuesOld: undefined }); for (const old of ["tailbone", "~0:15", "~0:34", "~1:42", "~1:50", "~0:19", "Walkover/handstand", "walkover/handstand", "Wednesdays 3:30"]) assert.ok(!card.includes(old), old);
});
test("Hannah's cue words (approved Oct 25): 1–4 words on 9 key tricks, none on 21 and 25; never the transcript", () => {
  const solo = JSON.parse(readFileSync(new URL("../data/dances.json", import.meta.url), "utf8")).find(x => x.id === "solo");
  const w = solo.cues.filter(c => c.hannahWord); assert.deepEqual(w.map(c => c.n), [3, 5, 8, 12, 13, 16, 19, 23, 28]); assert.ok(w.every(c => c.trick));
  assert.ok(w.every(c => c.hannahWord.split(/[\s,]+/).filter(Boolean).length <= 4)); assert.equal(solo.cues.find(c => c.n === 19).hannahWord, "Arms down");
  assert.ok(!solo.cues.some(c => c.hannahClip), "clips are family uploads (cueMedia), never in the repo");
  assert.equal(normalizeCues(solo.cues).find(c => c.n === 12).hannahWord, "Chassé leap", "kept by normalizeCues");
});
