// My workouts (js/workouts-core.js): the saved-video list, logging one as a quick session, and migration 29.
import { test } from "node:test";
import assert from "node:assert/strict";
import { installEnv } from "./_env.mjs";
installEnv();
const { normalizeWorkouts, logWorkout, doneToday, hostName, KINDS, MAX } = await import("../js/workouts-core.js");
const { migrateDoc, SCHEMA_VERSION } = await import("../js/store.js");

test("normalize: http links only, short names, a known kind, unique ids, at most MAX", () => {
  const list = normalizeWorkouts([
    { id: "a", name: " Core blast ", url: "https://www.masterclass.com/classes/x/chapters/y", kind: "strength", at: "2026-10-17T10:00:00Z" },
    { id: "b", name: "", url: "https://youtu.be/abc", kind: "flex" },
    { id: "a", name: "dupe", url: "https://example.com", kind: "flex" },
    { id: "c", name: "bad", url: "ftp://nope", kind: "flex" }, { id: "d", name: "bad2", url: "not a link" }, null, "x",
    { id: "e", name: "x".repeat(60), url: "https://e.com", kind: "zzz" },
  ]);
  assert.deepEqual(list.map(w => w.id), ["a", "b", "e"]);
  assert.equal(list[0].name, "Core blast"); assert.equal(list[0].at, "2026-10-17T10:00:00Z");
  assert.equal(list[1].name, "Youtu", "a blank name falls back to the host"); assert.equal(list[1].kind, "flex");
  assert.equal(list[2].name.length, 40); assert.equal(list[2].kind, "strength", "unknown kind → strength");
  assert.ok(normalizeWorkouts([{ url: "https://x.com" }])[0].id, "a missing id is made up");
  assert.equal(normalizeWorkouts(Array.from({ length: 12 }, (_, i) => ({ id: "w" + i, url: "https://x.com/" + i }))).length, MAX);
  assert.equal(hostName("https://www.masterclass.com/classes/x"), "Masterclass"); assert.equal(hostName("junk"), "Video");
  assert.deepEqual(Object.keys(KINDS), ["strength", "flex"]);
});

test("logging a workout adds the quick session of its kind and remembers the id, once a day", () => {
  const w = { id: "a", name: "Core", url: "https://x.com", kind: "strength" };
  const r1 = logWorkout(undefined, w); assert.deepEqual(r1.quick, ["strength"]); assert.deepEqual(r1.workouts, ["a"]); assert.deepEqual(r1.done, []);
  const r2 = logWorkout({ done: ["warmup"], quick: ["flex"], workouts: ["z"] }, { ...w, kind: "flex" }); assert.deepEqual(r2.quick, ["flex", "flex"]); assert.deepEqual(r2.workouts, ["z", "a"]); assert.deepEqual(r2.done, ["warmup"]);
  assert.equal(logWorkout(r1, w), null, "same workout again today → nothing"); assert.equal(doneToday(r1, "a"), true); assert.equal(doneToday(r1, "b"), false); assert.equal(doneToday(null, "a"), false);
});

test("schema 29 normalizes settings.workouts and practice.workouts, never invents them", () => {
  const s = migrateDoc("settings", "main", { _v: 28, workouts: [{ id: "a", url: "https://x.com", kind: "flex" }, { url: "nope" }] });
  assert.equal(s.workouts.length, 1); assert.equal(s.workouts[0].name, "X"); assert.equal(s._v, SCHEMA_VERSION);
  assert.equal("workouts" in migrateDoc("settings", "main", { _v: 28 }), false);
  const p = migrateDoc("practice", "2026-10-17", { _v: 28, workouts: ["a", "a", 3, " b "], quick: ["strength"] });
  assert.deepEqual(p.workouts, ["a", "b"]); assert.deepEqual(p.quick, ["strength"]);
  assert.deepEqual(migrateDoc("practice", "2026-10-17", { _v: 28, workouts: "x" }).workouts, []);
});
