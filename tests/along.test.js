// Dance Along routines: frames are stored flat (Firestore can't hold an array inside an array) and unpacked to play.
import { test } from "node:test";
import assert from "node:assert/strict";
import { packFrames, unpackFrames, routineFrames, FDIM } from "../js/posemath.js";
import { migrateDoc, SCHEMA_VERSION } from "../js/store.js";

const f1 = [0.5, -1.2, -0.5, -1.2, 0.4, -0.6, -0.4, -0.6, 1, 0.98], f2 = f1.map(x => x / 2);
// True when nothing in the doc would be refused by Firestore: no array directly inside an array, no undefined.
function firestoreSafe(v, inArray = false){
  if (Array.isArray(v)) return !inArray && v.every(x => firestoreSafe(x, true));
  if (v && typeof v === "object") return Object.values(v).every(x => firestoreSafe(x, false));
  return v !== undefined;
}

test("frames pack flat with a null frame as ten nulls, and unpack back to the same list", () => {
  const flat = packFrames([f1, null, f2]);
  assert.equal(flat.length, 3 * FDIM); assert.deepEqual(flat.slice(0, FDIM), f1); assert.ok(flat.slice(FDIM, 2 * FDIM).every(x => x === null));
  assert.deepEqual(unpackFrames(flat), [f1, null, f2]);
  assert.deepEqual(packFrames([]), []); assert.deepEqual(unpackFrames([]), []); assert.deepEqual(unpackFrames("junk"), []);
  assert.deepEqual(unpackFrames(packFrames([[1, 2, 3]])), [null], "a malformed frame becomes a missing one");
});

test("a saved routine is Firestore-safe and plays from the unpacked frames; old nested docs still play", () => {
  const saved = { kind: "along", name: "Groove", fps: 8, frames: packFrames([f1, null, f2]), fdim: FDIM, best: 0, seq: [] };
  assert.equal(firestoreSafe(saved), true);
  assert.equal(firestoreSafe({ kind: "along", frames: [f1, null] }), false, "the old shape is what Firestore refused");
  assert.deepEqual(routineFrames(saved), [f1, null, f2]);
  assert.deepEqual(routineFrames({ kind: "along", frames: [f1, null] }), [f1, null]); assert.deepEqual(routineFrames(null), []);
});

test("20 → 21: a nested frames list is packed; a packed doc and other choreo docs are left alone", () => {
  const d = migrateDoc("choreo", "a", { _v: 20, kind: "along", frames: [f1, null], fps: 8 });
  assert.deepEqual(d.frames, packFrames([f1, null])); assert.equal(d.fdim, FDIM); assert.equal(d._v, SCHEMA_VERSION); assert.equal(firestoreSafe(d), true);
  const packed = { _v: 20, kind: "along", frames: packFrames([f1]), fdim: FDIM }; assert.deepEqual(migrateDoc("choreo", "b", packed).frames, packed.frames);
  const other = migrateDoc("choreo", "c", { _v: 20, kind: "studio", seq: ["pose"] }); assert.equal("fdim" in other, false);
  const v9 = migrateDoc("choreo", "d", { _v: 9, kind: "along" }); assert.deepEqual(v9.frames, []); assert.equal(v9.fdim, FDIM, "an old empty routine gets the packed shape too");
});
