// Memorize it (js/memo.js): chunk of the day, the two-perfect-days rule, step tracking, the Today pick, checkpoints,
// video links, and the schema-28 migration. Pure parts only; the card itself is covered by the smoke test.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { installEnv } from "./_env.mjs";
installEnv();
const M = await import("../js/memo.js");
const { STEPS, STEP_IDS, memoDances, chunks, chunkLabel, chunkMoves, chunkOfDay, markTested, setKnown, stepsDone, allDone, todayPick, nextCheckpoint, daysBetween, videoLinks, KNOWN_AFTER } = M;
const { migrateDoc, SCHEMA_VERSION, BITE_IDS } = await import("../js/store.js");
const { cardsFor } = await import("../js/habit.js");

const trio = { id: "trio", name: "Trio · Enjoy the Silence", story: "Safe together.", loops: [{ n: "Opening + floor", a: 0, b: 34 }, { n: "Build", a: 34, b: 66 }], cues: [{ t: 0, move: "Kneeling line" }, { t: 12, move: "Floor phrase" }, { t: 36, move: "Low crawl" }], checkpoints: [{ d: "2026-10-31", text: "Whole trio with no video" }], links: ["Hannah video 1 | https://photos.app.goo.gl/abc", "Costume | https://shop.example.com/x", "https://youtu.be/xyz"] };
const solo = { id: "solo", name: "Solo · Stay a Little Longer", loops: [{ n: "Soft half", a: 0, b: 48 }], cues: [{ t: 11, move: "Drop to the floor" }], checkpoints: [{ d: "2026-11-01", text: "Whole solo from memory" }, { d: "2026-11-04", text: "Show Ms. Brittany" }] };
const plain = { id: "wf-tap", name: "Tap", loops: [], cues: [] };

test("five steps, dances with chunks, chunk labels and the moves inside a chunk", () => {
  assert.deepEqual(STEP_IDS, ["story", "mark", "count", "test", "picture"]); assert.ok(STEPS.every(s => s.ic && s.n && s.t && s.how));
  assert.deepEqual(memoDances([trio, plain, solo]).map(d => d.id), ["trio", "solo"]);
  assert.deepEqual(chunks(trio).map(c => c.n), ["Opening + floor", "Build"]); assert.equal(chunkLabel(chunks(trio)[1]), "Build · 0:34–1:06");
  assert.deepEqual(chunkMoves(trio, chunks(trio)[0]), ["Kneeling line", "Floor phrase"]); assert.deepEqual(chunkMoves(trio, chunks(trio)[1]), ["Low crawl"]);
  assert.deepEqual(chunks({ loops: [{ n: "bad", a: 10, b: 5 }, { n: "", a: 0, b: 3 }] }), [], "a chunk needs a name and b > a");
});

test("chunk of the day is the first unknown one; two perfect Test me days make it known; a miss doesn't count", () => {
  let settings = {};
  assert.equal(chunkOfDay(trio, settings).n, "Opening + floor");
  settings = { memo: markTested(settings, "trio", "Opening + floor", "2026-10-20") }; assert.equal(chunkOfDay(trio, settings).n, "Opening + floor", "one perfect day isn't enough");
  settings = { memo: markTested(settings, "trio", "Opening + floor", "2026-10-20") }; assert.equal(chunkOfDay(trio, settings).n, "Opening + floor", "the same day twice is still one day");
  settings = { memo: markTested(settings, "trio", "Opening + floor", "2026-10-21", false) }; assert.equal(settings.memo.trio.tested["Opening + floor"].length, 1, "a miss records nothing");
  settings = { memo: markTested(settings, "trio", "Opening + floor", "2026-10-22") }; assert.deepEqual(settings.memo.trio.known, ["Opening + floor"]); assert.equal(KNOWN_AFTER, 2);
  assert.equal(chunkOfDay(trio, settings).n, "Build");
  settings = { memo: setKnown(settings, "trio", "Build", true) }; assert.equal(chunkOfDay(trio, settings), null, "all known → run days");
  settings = { memo: setKnown(settings, "trio", "Build", false) }; assert.equal(chunkOfDay(trio, settings).n, "Build", "a known chunk can go back in the plan");
  assert.equal(settings.memo.trio.tested["Opening + floor"].length, 2, "tested days survive the known toggles");
});

test("steps done per dance per day, the Today pick (trio first, then run days) and the fourth Today card", () => {
  const rec = { done: [], memo: { trio: ["story", "mark", "bogus"], solo: STEP_IDS } };
  assert.deepEqual(stepsDone(rec, "trio"), ["story", "mark"]); assert.equal(allDone(rec, "trio"), false); assert.equal(allDone(rec, "solo"), true); assert.deepEqual(stepsDone({}, "trio"), []);
  let pick = todayPick([solo, trio, plain], {}, "2026-10-20"); assert.equal(pick.dance.id, "trio", "the soonest checkpoint goes first (trio Oct 31 before solo Nov 1), whatever the list order");
  assert.equal(todayPick([solo, trio], {}, "2026-11-02").dance.id, "solo", "after the trio checkpoint the solo (Nov 4) is first"); assert.equal(todayPick([solo, { ...trio, checkpoints: [] }], {}).dance.id, "solo", "no checkpoints → list order");
  pick = todayPick([trio, solo], {}); assert.equal(pick.dance.id, "trio"); assert.equal(pick.chunk.n, "Opening + floor"); assert.equal(pick.run, false);
  const all = { memo: { trio: { known: ["Opening + floor", "Build"], tested: {} }, solo: { known: ["Soft half"], tested: {} } } };
  pick = todayPick([trio, solo], all); assert.equal(pick.run, true); assert.equal(pick.dance.id, "trio");
  assert.equal(todayPick([plain], {}), null);
  const cards = cardsFor("2026-10-20", { bites: ["memo"], memo: { danceId: "trio", label: "Trio · Build" } });
  assert.equal(cards.length, 4); assert.equal(cards[3].id, "memo"); assert.equal(cards[3].done, true); assert.match(cards[3].go, /memoFocus\('trio'\)/); assert.equal(cards[3].sub, "Trio · Build");
  assert.equal(cardsFor("2026-10-20").length, 3, "no pick, no fourth card");
  assert.ok(BITE_IDS.includes("memo"));
});

test("checkpoints and video links", () => {
  assert.equal(nextCheckpoint(solo, "2026-10-20").d, "2026-11-01"); assert.equal(nextCheckpoint(solo, "2026-11-02").text, "Show Ms. Brittany"); assert.equal(nextCheckpoint(solo, "2026-11-05"), null); assert.equal(nextCheckpoint(plain, "2026-10-20"), null);
  assert.equal(daysBetween("2026-10-20", "2026-11-01"), 12);
  assert.deepEqual(videoLinks(trio), [{ name: "Hannah video 1", url: "https://photos.app.goo.gl/abc" }, { name: "Video 2", url: "https://youtu.be/xyz" }], "shop links are not videos");
  assert.deepEqual(videoLinks(solo), []);
});

test("schema 28 normalizes settings.memo and practice.memo, never invents them", () => {
  const s = migrateDoc("settings", "main", { _v: 27, memo: { trio: { known: ["Build", "Build", 7, " x "], tested: { Build: ["2026-10-20", "nope", "2026-10-19"], Empty: [] } }, bad: 3 } });
  assert.deepEqual(s.memo, { trio: { known: ["Build", "x"], tested: { Build: ["2026-10-19", "2026-10-20"] } } }); assert.equal(s._v, SCHEMA_VERSION);
  assert.equal("memo" in migrateDoc("settings", "main", { _v: 27 }), false);
  const p = migrateDoc("practice", "2026-10-20", { _v: 27, memo: { trio: ["story", "story", "nope", "test"], solo: "x", none: [] } });
  assert.deepEqual(p.memo, { trio: ["story", "test"] });
  assert.deepEqual(migrateDoc("practice", "2026-10-20", { _v: 21, bites: ["memo", "trick", "zzz"] }).bites, ["memo", "trick"], "memo is a bite kind (step 22 keeps it)");
});
