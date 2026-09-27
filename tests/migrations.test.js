// Schema migrations: data written by the original (schema 1) app must load correctly today.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SCHEMA_VERSION, MIGRATIONS, migrateDoc, migrateCollection, docVersion, docTime } from "../js/store.js";
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

test("a whole collection migrates and other collections pass through unchanged", () => {
  const out = migrateCollection("notes", { a: { title: "t", body: "b", tag: "Ideas", at: "2026-09-27T03:01:15.743Z" } });
  assert.equal(out.a._v, SCHEMA_VERSION); assert.equal(out.a.title, "t");
  assert.equal(docTime(out.a), Date.parse("2026-09-27T03:01:15.743Z"));
  assert.equal(docTime({ _at: 5, at: "2026-01-01" }), 5);
});
