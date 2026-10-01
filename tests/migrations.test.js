// Schema migrations: data written by the original (schema 1) app must load correctly today.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SCHEMA_VERSION, MIGRATIONS, COLLECTIONS, migrateDoc, migrateCollection, docVersion, docTime } from "../js/store.js";
import { applyData } from "../js/data.js";
import { PRACTICE_ITEMS, AERIAL } from "../js/data.js";

const json = (f) => JSON.parse(readFileSync(new URL("../data/" + f + ".json", import.meta.url), "utf8"));
const loadAll = () => { const got = {}; for (const f of ["dances","events","classes","home-days","practice-items","phases","packs","aerial","season","styles","moves","avatar-options","oops","trio","compday","sparkle"]) got[f] = json(f); applyData(got); };

test("every version step from 2 up to SCHEMA_VERSION has a migration", () => {
  for (let v = 2; v <= SCHEMA_VERSION; v++) assert.equal(typeof MIGRATIONS[v], "function", `MIGRATIONS[${v}] missing`);
});

test("documents without _v are treated as schema 1", () => {
  assert.equal(docVersion({ title: "x" }), 1);
  assert.equal(docVersion({ _v: 2 }), 2);
  assert.equal(docVersion(null), 1);
});

test("schema 1 practice log (positional indices) → item ids", () => {
  loadAll();
  // Exactly what the original app stored: indices into the old PRACTICE_ITEMS array, plus a note.
  const v1 = { done: [0, 1, 4, 10], note: "solo felt good" };
  const out = migrateDoc("practice", "2026-09-24", v1);
  assert.equal(out._v, SCHEMA_VERSION);
  assert.deepEqual(out.done, ["warmup", "hollow-superman", "leg-lifts", "solo-run"]);
  assert.equal(out.note, "solo felt good");
  // Those ids still exist in the current data file, so old check-offs keep pointing at the same items.
  for (const id of out.done) assert.ok(PRACTICE_ITEMS.some(it => it.id === id), id + " should be a current practice item");
});

test("schema 1 settings (aerial indices, avatar, best scores) → aerial ids, everything else untouched", () => {
  loadAll();
  const v1 = { avatar: { acc: "flower", hairStyle: "ponytail", name: "Sofia" }, gameBest: 1350, aerial: [0, 1, 5, 16], top3: ["a", "b"] };
  const out = migrateDoc("settings", "main", v1);
  assert.equal(out._v, SCHEMA_VERSION);
  assert.deepEqual(out.aerial, ["cartwheel-clean", "one-hand-far", "single-leg-squats", "twenty-in-a-row"]);
  for (const id of out.aerial) assert.ok(AERIAL.some(a => a.id === id), id + " should be a current aerial step");
  assert.deepEqual(out.avatar, v1.avatar);
  assert.equal(out.gameBest, 1350);
  assert.deepEqual(out.top3, ["a", "b"]);
});

test("the shipped seed data (schema 1 exports from the Claude-hosted app) migrates cleanly", () => {
  const settings = JSON.parse(readFileSync(new URL("../seed-data/settings/main.json", import.meta.url), "utf8"));
  const out = migrateDoc("settings", "main", settings);
  assert.equal(out._v, SCHEMA_VERSION);
  assert.equal(out.gameBest, 1350);
  assert.equal(out.avatar.name, "Sofia");
  const choreo = JSON.parse(readFileSync(new URL("../seed-data/choreo/muj95hewz968.json", import.meta.url), "utf8"));
  const c = migrateDoc("choreo", "muj95hewz968", choreo);
  assert.equal(c.seq.length, 17); assert.equal(c.style, "lyrical"); assert.equal(c._v, SCHEMA_VERSION);
});

test("out-of-range or already-migrated values survive", () => {
  const out = migrateDoc("practice", "d", { done: [99, "warmup", -1] });
  assert.deepEqual(out.done, ["warmup"]);
  const already = migrateDoc("practice", "d", { _v: SCHEMA_VERSION, done: ["kicks"] });
  assert.deepEqual(already.done, ["kicks"]);
});

// ---- schema 3 (kid mode / practice player / corrections / skills & badges) ----
test("2 → 3: practice records gain runs:[], settings gain the default PIN, both without touching what was there", () => {
  const v2p = migrateDoc("practice", "2026-09-28", { _v: 2, done: ["warmup", "kicks"], note: "ok" });
  assert.equal(v2p._v, SCHEMA_VERSION); assert.deepEqual(v2p.runs, []); assert.deepEqual(v2p.done, ["warmup", "kicks"]); assert.equal(v2p.note, "ok");
  const v1p = migrateDoc("practice", "2026-09-24", { done: [0, 8] });               // straight from schema 1
  assert.deepEqual(v1p.done, ["warmup", "kicks"]); assert.deepEqual(v1p.runs, []);
  const kept = migrateDoc("practice", "d", { _v: 2, done: [], runs: [{ at: "x", danceId: "solo", speed: 100, full: true, ending: true, eyes: false }] });
  assert.equal(kept.runs.length, 1);
  const s = migrateDoc("settings", "main", { _v: 2, avatar: { name: "Sofia" }, gameBest: 1350, aerial: ["hollow-hold"], top3: ["a"] });
  assert.equal(s.pin, "2027"); assert.equal(s.pinOn, true); assert.equal(s.gameBest, 1350); assert.deepEqual(s.aerial, ["hollow-hold"]); assert.deepEqual(s.top3, ["a"]);
  const custom = migrateDoc("settings", "main", { _v: 3, pin: "1234", pinOn: false });
  assert.equal(custom.pin, "1234"); assert.equal(custom.pinOn, false);
});

test("2 → 3: corrections and skills written by an older build get their defaults; the new collections are known", () => {
  const c = migrateDoc("corrections", "c1", { danceId: "solo", text: "Point the foot" });
  assert.equal(c.status, "working"); assert.equal(c.tag, "other"); assert.equal(c.source, "notes"); assert.equal(c._v, SCHEMA_VERSION);
  const done = migrateDoc("corrections", "c2", { _v: 3, status: "done", tag: "feet", source: "Hannah" });
  assert.equal(done.status, "done"); assert.equal(done.tag, "feet"); assert.equal(done.source, "Hannah");
  assert.equal(migrateDoc("skills", "a-aerial", { style: "acro" }).state, "learning");
  assert.equal(migrateDoc("skills", "a-aerial", { state: "checked", teacher: "Hannah" }).state, "checked");
  for (const col of ["corrections", "skills", "badges", "reports"]) assert.ok(COLLECTIONS.includes(col), col + " must be synced and backed up");
});

test("3 → 4: dance cue sheets are normalized when present and never invented when absent", () => {
  const d = migrateDoc("dances", "solo", { _v: 3, name: "Solo", cues: [{ t: "0:50", move: "Cartwheel" }, { t: 12, lyric: "words", move: "Floor" }, { t: "x", move: "bad" }] });
  assert.equal(d._v, SCHEMA_VERSION); assert.deepEqual(d.cues, [{ t: 12, lyric: "words", move: "Floor" }, { t: 50, lyric: "", move: "Cartwheel" }]);
  const partial = migrateDoc("dances", "solo", { _v: 3, musicUrl: "x" });
  assert.equal("cues" in partial, false, "a partial override must not hide the built-in cue sheet");
  assert.deepEqual(migrateDoc("dances", "d", { cues: "junk" }).cues, []);
});

test("4 → 5: reviews and goals get their defaults; the two collections are known", () => {
  const rv = migrateDoc("reviews", "v", { danceId: "solo", review: { loved: "x", fix: "y", tag: "feet" } });
  assert.equal(rv._v, SCHEMA_VERSION); assert.deepEqual(rv.thumbs, []); assert.equal(rv.kind, "video"); assert.equal(rv.review.tag, "feet");
  const g = migrateDoc("goals", "g", { name: "Bridge", target: "20" });
  assert.deepEqual(g.checkins, []); assert.equal(g.target, 20); assert.equal(g.unit, "");
  for (const col of ["reviews", "goals"]) assert.ok(COLLECTIONS.includes(col), col);
});

test("5 → 6: practice.total is kept when valid and dropped when junk; days without it still count against the old 12", () => {
  assert.equal(migrateDoc("practice", "d", { _v: 5, done: ["warmup"], total: "14" }).total, 14);
  assert.equal("total" in migrateDoc("practice", "d", { _v: 5, done: [], total: "x" }), false);
  assert.equal("total" in migrateDoc("practice", "d", { done: [0, 1] }), false);
});

test("a whole collection migrates and other collections pass through unchanged", () => {
  const out = migrateCollection("notes", { a: { title: "t", body: "b", tag: "Ideas", at: "2026-09-27T03:01:15.743Z" } });
  assert.equal(out.a._v, SCHEMA_VERSION); assert.equal(out.a.title, "t");
  assert.equal(docTime(out.a), Date.parse("2026-09-27T03:01:15.743Z"));
  assert.equal(docTime({ _at: 5, at: "2026-01-01" }), 5);
});
