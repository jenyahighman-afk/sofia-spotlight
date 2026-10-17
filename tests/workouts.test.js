// My workouts (js/workouts-core.js): the saved-video list, logging one as a quick session, and migration 29.
import { test } from "node:test";
import assert from "node:assert/strict";
import { installEnv } from "./_env.mjs";
installEnv();
const { normalizeWorkouts, normalizeWorkout, workoutList, logWorkout, doneToday, hostName, KINDS, MAX, progressOf, nextOf, presetsLeft } = await import("../js/workouts-core.js");
const { migrateDoc, SCHEMA_VERSION, COLLECTIONS, receive, setBackend, S, saveWorkoutsMove } = await import("../js/store.js");
const { workouts } = await import("../js/workouts.js");
import { readFileSync } from "node:fs";

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

test("schema 31: a video is its own document; one without a link is emptied; the list comes from the collection", () => {
  assert.ok(COLLECTIONS.includes("workouts")); assert.match(readFileSync(new URL("../firestore.rules", import.meta.url), "utf8"), /'workouts'\]/, "the rules know the collection (republish them)");
  const d = migrateDoc("workouts", "a", { _v: 30, name: " Core ", url: "https://www.masterclass.com/x", kind: "flex", at: "2026-10-17T10:00:00Z" }); assert.equal(d._v, SCHEMA_VERSION); assert.equal(d.name, "Core"); assert.equal(d.id, "a"); assert.equal(d.kind, "flex");
  const bad = migrateDoc("workouts", "b", { _v: 30, url: "nope" }); assert.equal(bad.deleted, true); assert.equal("url" in bad, false);
  assert.deepEqual(workoutList({ b: bad, a: d, c: { url: "https://y.com", at: "2026-10-16T10:00:00Z" } }).map(w => w.id), ["c", "a"], "oldest first, emptied ones left out, the key is the id");
  assert.equal(normalizeWorkout(null), null); assert.equal(normalizeWorkout({ url: "https://z.com" }, "zz").id, "zz");
  assert.deepEqual(workouts({ workouts: { a: d }, settings: { workouts: [{ id: "a", url: "https://old.com" }, { id: "s", url: "https://still-in-settings.com", kind: "flex" }] } }).map(w => w.id + ":" + hostName(w.url)), ["a:Masterclass", "s:Still-in-settings"], "the collection wins; a settings-held one shows until it moves");
});

test("settings-held videos move once into the collection, then leave settings", async () => {
  const writes = []; setBackend({ set: async (col, id, rec) => { writes.push({ col, id, rec }); }, del: async () => {} });
  try {
    for (const k of Object.keys(S)) S[k] = {};
    receive("settings", { main: { _v: 30, pin: "2027", workouts: [{ id: "a", name: "Core", url: "https://www.masterclass.com/x", kind: "strength" }, { id: "x", url: "nope" }] } }, { fromCache: true });
    assert.equal(await saveWorkoutsMove(), 0, "nothing moves until the server has confirmed both collections"); assert.equal(writes.length, 0);
    receive("settings", { main: { _v: 30, pin: "2027", workouts: [{ id: "a", name: "Core", url: "https://www.masterclass.com/x", kind: "strength" }, { id: "x", url: "nope" }] } }, { fromCache: false });
    receive("workouts", {}, { fromCache: false });
    assert.equal(await saveWorkoutsMove(), 1); assert.equal(S.workouts.a.name, "Core"); assert.equal(S.workouts.a._v, SCHEMA_VERSION); assert.equal("workouts" in S.settings, false, "the field leaves settings"); assert.equal(S.settings.pin, "2027");
    assert.deepEqual(writes.map(w => w.col + "/" + w.id), ["workouts/a", "settings/main"]);
    assert.equal(await saveWorkoutsMove(), 0, "only once"); assert.equal(writes.length, 2);
    receive("settings", { main: { _v: 30, workouts: [{ id: "a", url: "https://old.com" }] } }, { fromCache: false }); receive("workouts", { a: { _v: 31, name: "Already", url: "https://www.masterclass.com/x", kind: "flex" } }, { fromCache: false });
    assert.equal(await saveWorkoutsMove(), 0, "a video the other phone already moved is not written again"); assert.equal(S.workouts.a.name, "Already"); assert.equal(writes.length, 3); assert.equal(writes[2].col, "settings");
  } finally { setBackend(null); for (const k of Object.keys(S)) S[k] = {}; }
});

test("programs: n and mins survive normalize, progress counts logged days, next loops through n, presets are offered until added", () => {
  const w = normalizeWorkout({ name: "Core Control", url: "https://www.dance-masterclass.com/library?q=section-workouts", kind: "strength", n: 5, mins: 10 }, "cc");
  assert.equal(w.n, 5); assert.equal(w.mins, 10); assert.equal("n" in normalizeWorkout({ url: "https://x.com" }, "x"), false, "no n when unknown"); assert.equal(normalizeWorkout({ url: "https://x.com", n: 999 }, "y").n, 60);
  const practice = { "2026-10-18": { workouts: ["cc"] }, "2026-10-22": { workouts: ["cc", "zz"] }, "2026-10-23": { workouts: ["zz"] }, "2026-10-24": {} };
  assert.equal(progressOf(practice, "cc"), 2); assert.equal(progressOf({}, "cc"), 0);
  assert.equal(nextOf(w, practice), 3); assert.equal(nextOf(w, {}), 1); assert.equal(nextOf(w, { a: { workouts: ["cc"] }, b: { workouts: ["cc"] }, c: { workouts: ["cc"] }, d: { workouts: ["cc"] }, e: { workouts: ["cc"] } }), 1, "after all five it loops"); assert.equal(nextOf(normalizeWorkout({ url: "https://x.com" }, "x"), practice), 0, "no program count → no counter");
  const presets = JSON.parse(readFileSync(new URL("../data/workout-presets.json", import.meta.url), "utf8"));
  assert.equal(presets.programs.length, 8); for (const p of presets.programs) { assert.ok(p.name && /^https:\/\//.test(p.url) && (p.kind in KINDS) && p.n > 0 && p.mins > 0, p.name); }
  assert.deepEqual(presets.programs.map(p => p.kind), ["strength", "strength", "strength", "strength", "flex", "flex", "flex", "flex"]);
  assert.equal(presetsLeft(presets, []).length, 8); assert.equal(presetsLeft(presets, [{ name: "core control for pirouettes (beginners)" }]).length, 7, "matched by name, case-insensitive"); assert.equal(presetsLeft({}, []).length, 0);
});
