// Content sanity checks: run `npm test` after editing anything in data/ or seed-data/.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { DATA_FILES, applyData, expandMoves } from "../js/data.js";
import * as D from "../js/data.js";

const read = (rel) => JSON.parse(readFileSync(new URL("../" + rel, import.meta.url), "utf8"));
const got = {}; for (const f of DATA_FILES) got[f] = read("data/" + f + ".json");

test("every data file parses and loads", () => { applyData(got); assert.ok(D.DEFAULT_DANCES.length >= 1); assert.ok(D.DEFAULT_EVENTS.length >= 1); });

test("dances and events have unique ids and the fields the app reads", () => {
  const ids = new Set();
  for (const d of got.dances) { assert.ok(d.id && !ids.has(d.id), "duplicate/missing dance id " + d.id); ids.add(d.id); assert.equal(typeof d.name, "string"); assert.ok(Array.isArray(d.corrections), d.id + " needs a corrections array"); }
  const eids = new Set();
  for (const e of got.events) { assert.ok(e.id && !eids.has(e.id), "duplicate/missing event id " + e.id); eids.add(e.id); assert.match(e.start, /^\d{4}-\d{2}-\d{2}$/, e.id + " start must be YYYY-MM-DD"); assert.match(e.end, /^\d{4}-\d{2}-\d{2}$/); assert.ok(e.end >= e.start, e.id + " ends before it starts"); assert.ok(!e.pack || got.packs[e.pack], e.id + " points at an unknown packing list"); }
});

test("classes use weekday numbers and H:MM–H:MM times", () => {
  for (const c of got.classes) { assert.ok(Number.isInteger(c.day) && c.day >= 0 && c.day <= 6); assert.match(c.t, /^\d{1,2}:\d{2}[–-]\d{1,2}:\d{2}$/, c.name); }
});

test("practice items and aerial steps have unique ids (they are what check-offs are stored against)", () => {
  const p = new Set(got["practice-items"].map(i => i.id)); assert.equal(p.size, got["practice-items"].length);
  const a = new Set(got.aerial.map(i => i.id)); assert.equal(a.size, got.aerial.length);
  for (const i of got["practice-items"]) assert.ok(i.text && i.kind);
  for (const i of got.aerial) assert.ok(i.text && i.section);
});

test("moves expand to full poses and reference known styles; games reference known moves", () => {
  const moves = expandMoves(got.moves);
  const joints = ["h","sl","sr","el","er","hl","hr","kl","kr","fl","fr","rot","lift"];
  for (const m of moves) { assert.ok(m.k.length >= 1, m.id); for (const kf of m.k) for (const j of joints) assert.ok(j in kf, `${m.id} keyframe missing ${j}`); for (const s of m.st) assert.ok(got.styles[s], `${m.id} unknown style ${s}`); }
  const ids = new Set(moves.map(m => m.id));
  for (const id of got.oops.moves) assert.ok(ids.has(id), "oops uses unknown move " + id);
  for (const id of got.trio.moves) assert.ok(ids.has(id), "trio uses unknown move " + id);
  for (const f of got.trio.forms ? Object.values(got.trio.forms) : []) assert.equal(f.pos.length, 3);
  assert.equal(got.trio.dancers.length, 3);
});

test("comp day scenes have three options with e/f/s effects", () => {
  for (const sc of got.compday) { assert.ok(sc.t); assert.equal(sc.o.length, 3); for (const o of sc.o) { assert.equal(o.length, 3); for (const k of ["e","f","s"]) assert.equal(typeof o[1][k], "number"); } }
});

test("seed manifest points at files that exist", () => {
  const man = read("seed-data/manifest.json");
  for (const d of man.docs) assert.ok(existsSync(new URL("../" + d.path, import.meta.url)), d.path);
  for (const f of man.files) assert.ok(existsSync(new URL("../" + f.path, import.meta.url)), f.path);
});
