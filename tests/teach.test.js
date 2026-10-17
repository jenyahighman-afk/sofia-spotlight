// Teach It: 8 slots, routines normalized and capped at 5, the schema-38 migration, the play sequence (lead-in, slow,
// lead-in, full speed) as pure timing, and the builder / feedback panel rendering in the fake DOM.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installEnv, resetDom, el } from "./_env.mjs";
installEnv();
const read = (f) => JSON.parse(readFileSync(new URL("../" + f, import.meta.url), "utf8"));
const { applyData, DATA_FILES } = await import("../js/data.js");
const got = {}; for (const f of DATA_FILES) got[f] = read("data/" + f + ".json"); applyData(got);
const T = await import("../js/games/teach.js");
const { S, migrateDoc, SCHEMA_VERSION, TEACH_MOVE_IDS, setBackend } = await import("../js/store.js");
const { starsFor } = await import("../js/stars.js");

test("the move list: every Teach It id is a real move, no acro tricks, hold is there for empty counts", () => {
  const ids = got.moves.moves.map(m => m.id);
  for (const id of TEACH_MOVE_IDS) assert.ok(ids.includes(id), id + " is in data/moves.json");
  for (const id of ["cartwheel", "walkover", "handstand", "aerial", "bridge", "backroll", "donut"]) assert.ok(!TEACH_MOVE_IDS.includes(id), id + " is not offered");
  assert.ok(TEACH_MOVE_IDS.includes(T.FILL)); assert.deepEqual(T.teachMoves().map(m => m.id), ids.filter(id => TEACH_MOVE_IDS.includes(id)));
});

test("8 slots: unknown moves become a hold in place, long lists trimmed, short ones padded", () => {
  assert.deepEqual(T.normalizeMoves(["plie", "cartwheel", 3, " releve "]), ["plie", "hold", "hold", "releve", "hold", "hold", "hold", "hold"]);
  assert.equal(T.normalizeMoves(Array(12).fill("kick")).length, 8); assert.deepEqual(T.normalizeMoves(null), Array(8).fill("hold"));
  let s = T.setSlot([], 2, "plie"); assert.equal(s.length, 8); assert.equal(s[2], "plie"); assert.equal(T.nextSlot(s), 0, "first empty");
  s = T.setSlot(s, 0, "kick"); assert.equal(T.nextSlot(s), 1); assert.equal(T.nextSlot(s, 5), 5, "the selected slot wins");
  assert.equal(T.nextSlot(Array(8).fill("kick")), 7, "full: the last count"); assert.equal(T.setSlot(s, 0, null)[0], null);
});

test("routines: normalized and flat, unique ids, names ≤ 20, at most 5, new ones refused when full, update in place", () => {
  const r = T.normalizeRoutine({ id: "Abc", name: "  " + "x".repeat(30), moves: ["plie"], made: "2026-10-17", taught: "2", extra: 1 });
  assert.deepEqual(r, { id: "abc", name: "x".repeat(20), moves: ["plie", ...Array(7).fill("hold")], made: "2026-10-17", taught: 2 });
  assert.equal(T.normalizeRoutine({ name: "" }, 3).id, "t4"); assert.equal(T.normalizeRoutine({ name: "" }).name, "My 8-count"); assert.equal(T.normalizeRoutine("junk"), null); assert.equal(T.normalizeRoutine({ made: "soon" }).made, "");
  const seven = Array.from({ length: 7 }, (_, i) => ({ id: "a", name: "R" + i, moves: [] }));
  const n = T.normalizeTeach([...seven, "junk", [1]]); assert.equal(n.length, 5); assert.equal(new Set(n.map(x => x.id)).size, 5, "ids made unique");
  for (const x of n) { assert.ok(Array.isArray(x.moves) && x.moves.length === 8 && x.moves.every(m => typeof m === "string"), "moves: 8 strings"); assert.ok(Object.values(x).every(v => !Array.isArray(v) || v.every(e => !Array.isArray(e) && typeof e !== "object")), "no nested arrays / objects"); }
  let list = []; for (let i = 0; i < 5; i++) list = T.saveRoutine(list, { id: "r" + i, name: "R" + i, moves: ["kick"] }); assert.equal(list.length, 5); assert.equal(list[0].id, "r4", "newest first");
  assert.equal(T.saveRoutine(list, { id: "r9", moves: [] }), null, "a 6th is refused"); assert.equal(T.saveRoutine(list, { id: "r2", name: "New", moves: ["plie"] }).find(x => x.id === "r2").name, "New", "updating one is fine when full");
  assert.equal(T.removeRoutine(list, "r2").length, 4); assert.equal(T.markTaught(list, "r1").find(x => x.id === "r1").taught, 1);
});

test("schema 38: settings.teach normalized when present, other documents untouched", () => {
  assert.equal(SCHEMA_VERSION, 38);
  const d = migrateDoc("settings", "main", { _v: 33, teach: [{ id: "x", name: "Mine", moves: ["plie", "aerial", "kick", "kick", "kick", "kick", "kick", "kick", "kick"], made: "2026-10-17", taught: 3 }, ...Array(6).fill({ name: "more" })] });
  assert.equal(d._v, 38); assert.equal(d.teach.length, 5); assert.deepEqual(d.teach[0].moves, ["plie", "hold", "kick", "kick", "kick", "kick", "kick", "kick"]); assert.equal(d.teach[0].taught, 3);
  assert.deepEqual(migrateDoc("settings", "main", { _v: 33, teach: "junk" }).teach, []);
  assert.equal("teach" in migrateDoc("settings", "main", { _v: 33, pin: "2027" }), false);
  assert.deepEqual(migrateDoc("dances", "solo", { _v: 33, teach: [1] }).teach, [1], "only settings");
});

test("play sequence: 5-6-7-8, counts 1-8 at half speed, 5-6-7-8 again, then 1-8 at full speed", () => {
  const moves = ["plie", "releve", "passe", "arab", "kick", "pivot", "reach", "hold"]; const seq = T.teachSequence(moves, { beat: 500 });
  assert.equal(seq.length, 24); assert.deepEqual(seq.map(s => s.count), [5, 6, 7, 8, 1, 2, 3, 4, 5, 6, 7, 8, 5, 6, 7, 8, 1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual([...new Set(seq.map(s => s.phase))], ["lead", "slow", "full"]);
  assert.ok(seq.slice(0, 12).every(s => s.dur === 1000), "slow pass: twice as long a count"); assert.ok(seq.slice(12).every(s => s.dur === 500), "full speed");
  assert.deepEqual(seq.filter(s => s.phase === "slow").map(s => s.move), moves); assert.ok(seq.filter(s => s.phase === "lead").every(s => s.move === null));
  assert.equal(T.sequenceMs(seq), 12 * 1000 + 12 * 500); for (let i = 1; i < seq.length; i++) assert.equal(seq[i].at, seq[i - 1].at + seq[i - 1].dur, "back to back");
  assert.equal(T.stepAt(seq, 0).step.count, 5); assert.equal(T.stepAt(seq, 4000).step.phase, "slow"); assert.equal(T.stepAt(seq, 4500).t, 0.5);
  assert.equal(T.stepAt(seq, 12000).step.pace, "full"); assert.equal(T.stepAt(seq, 14000).step.move, "plie"); assert.equal(T.stepAt(seq, 18000), null); assert.equal(T.stepAt(seq, -1), null);
  const fast = T.teachSequence(moves, { slow: false }); assert.equal(fast.length, 12); assert.equal(T.sequenceMs(fast), 12 * T.BEAT_MS, "Count them in: full speed only");
  assert.equal(T.teachSequence([null, "plie"]).filter(s => s.phase === "slow")[0].move, "hold", "empty counts are a hold");
  assert.equal(T.spokenCount(seq[0]), "five"); assert.equal(T.spokenCount(seq[4]), "one"); assert.match(T.phaseLabel(seq[0]), /slow/); assert.match(T.phaseLabel(seq[12]), /full/i);
});

test("feedback: 1-3 stars, kind tips, students are the friends and a grown-up (not Sofia); Sofia earns a modest 2", () => {
  assert.equal(T.clampStars(0), 1); assert.equal(T.clampStars(7), 3); assert.equal(T.clampStars(2), 2);
  assert.ok(T.TIPS.length >= 3 && T.TIPS.includes("Great energy!") && T.TIPS.includes("Point those toes") && T.TIPS.includes("Watch the counts"));
  assert.deepEqual(T.students({ friends: { f1: "Mia" } }).map(s => s.n), ["Mia", "Lauren", "A grown-up"]);
  assert.equal(starsFor("teach", 1), 2); assert.equal(starsFor("teach", 3), 2, "not tied to the stars she gives");
});

test("renders: the 8-count builder, saved routines, teaching to a student pays stars, counts taught and marks the game bite", async () => {
  resetDom(); for (const k of Object.keys(S)) S[k] = {}; const writes = []; setBackend({ set: async (c, id, d) => writes.push([c, id, d]), del: async () => {} });
  S.settings = { friends: { f1: "Hannah", f2: "Lauren" } };
  T.renderTeach(); let h = el("#teachBuild").innerHTML;
  assert.equal((h.match(/class="teach-slot /g) || []).length, 8, "eight slots"); assert.ok(h.includes("teachAdd('plie')") && !h.includes("teachAdd('aerial')") && !h.includes("teachAdd('cartwheel')"), "only safe moves"); assert.ok(h.includes("up to 5"));
  window.teachAdd("plie"); window.teachAdd("kick"); assert.deepEqual(T.TEACH.slots.slice(0, 3), ["plie", "kick", null]);
  window.teachSel(5); window.teachAdd("reach"); assert.equal(T.TEACH.slots[5], "reach"); assert.equal(T.TEACH.sel, -1);
  window.teachNameIn("Hannah's 8"); await window.teachSave(); assert.equal(S.settings.teach.length, 1); const r = S.settings.teach[0]; assert.equal(r.name, "Hannah's 8"); assert.equal(r.moves.length, 8); assert.match(r.id, /^[a-z0-9-]+$/); assert.match(r.made, /^\d{4}-\d{2}-\d{2}$/);
  h = el("#teachBuild").innerHTML; assert.ok(h.includes("Hannah&#39;s 8") || h.includes("Hannah's 8")); assert.ok(h.includes(`teachLoad('${r.id}')`) && h.includes("Update"));
  T.renderRate(); h = el("#teachRate").innerHTML; assert.ok(h.includes("teachStudent('f1')") && h.includes("teachStudent('grownup')") && !h.includes("teachStudent('sofia')") && h.includes("Point those toes"));
  window.teachStudent("grownup"); window.teachStars(3); window.teachTip(0); await window.teachDone();
  h = el("#teachRate").innerHTML; assert.ok(h.includes("You taught A grown-up") && h.includes("⭐⭐⭐") && h.includes("Great energy!"));
  assert.equal(S.settings.teach[0].taught, 1, "taught count"); assert.ok(S.settings.stars >= 2, "stars paid");
  await new Promise(r => setTimeout(r, 10)); const day = Object.values(S.practice)[0]; assert.ok(day && day.bites.includes("game"), "the game bite");
  assert.ok(writes.every(([, , d]) => !JSON.stringify(d).includes("[[")), "no nested arrays written");
  setBackend(null);
});
