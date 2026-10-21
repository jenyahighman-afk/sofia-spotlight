// Today's plan (js/dayplan.js): the dated checklist from data/plan10.json, ticks, the "plan" bite rule, ▶ targets, migration 30.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installEnv } from "./_env.mjs";
installEnv();
const { dayPlan, tickPlan, planTicks, goFor, TAGS } = await import("../js/dayplan.js");
const { migrateDoc, SCHEMA_VERSION, BITE_IDS } = await import("../js/store.js");
const plan = JSON.parse(readFileSync(new URL("../data/plan10.json", import.meta.url), "utf8"));

test("the plan is well-formed: every day Oct 17–Nov 9, a tag, must and opt items with unique ids, minutes, known go targets", () => {
  const dates = Object.keys(plan.days).sort(); assert.equal(dates[0], "2026-10-17"); assert.equal(dates[dates.length - 1], "2026-11-09"); assert.equal(dates.length, 24, "no day skipped: Oct 17–31 and Nov 1–9");
  for (const d of dates) {
    const p = dayPlan(d, plan); assert.ok(p, d); assert.ok(TAGS[p.tag], d + " tag"); assert.ok(p.must.length >= 1 && p.must.length <= 4, d + " must count");
    const ids = [...p.must, ...p.opt].map(x => x.id); assert.equal(new Set(ids).size, ids.length, d + " unique ids"); assert.ok(p.mins[0] > 0, d + " minutes");
    for (const it of [...p.must, ...p.opt]) if (it.go) assert.ok(goFor(it.go), d + " go " + it.go);
    if (p.tag !== "home") assert.ok(p.classes, d + " class day lists classes");
  }
  assert.equal(dayPlan("2026-11-10", plan), null); assert.equal(dayPlan("2026-10-17", {}), null); assert.equal(dayPlan("x", { days: { x: { must: [{ id: "a" }] } } }), null, "an item needs text");
  assert.equal(dayPlan("2026-10-26", plan).note.includes("Oct 31"), true);
});

test("the two weeks after Oct 26 carry the checkpoints on their days, on the same weekly schedule", () => {
  const cp = { "2026-10-31": ["trio", "★ trio checkpoint"], "2026-11-01": ["solo", "★ solo checkpoint"], "2026-11-04": ["solo", "★ clean run for Ms. Brittany"], "2026-11-09": ["solo", "★ tricks start"] };
  for (const [d, [dance, label]] of Object.entries(cp)) { const p = dayPlan(d, plan); assert.equal(p.label, label, d); assert.ok(p.must.some(m => m.t.startsWith("★") || m.go === "memo:" + dance), d + " has its checkpoint as a must"); }
  const dances = JSON.parse(readFileSync(new URL("../data/dances.json", import.meta.url), "utf8")); const list = Array.isArray(dances) ? dances : (dances.dances || Object.values(dances));
  for (const d of list.filter(x => x && Array.isArray(x.checkpoints))) for (const c of d.checkpoints) if (c.d >= "2026-10-27" && c.d <= "2026-11-09") assert.ok(cp[c.d], d.id + " checkpoint " + c.d + " is in the plan");
  // Same week as Oct 17–26: the classes on a weekday match that weekday a week or two earlier.
  for (const d of Object.keys(plan.days).filter(x => x >= "2026-10-27")) { const prev = new Date(Date.parse(d + "T12:00:00Z") - 7 * 864e5).toISOString().slice(0, 10); const back = plan.days[prev] || plan.days[new Date(Date.parse(d + "T12:00:00Z") - 14 * 864e5).toISOString().slice(0, 10)]; assert.equal(plan.days[d].tag, back.tag, d + " tag"); assert.equal(plan.days[d].classes || "", back.classes || "", d + " classes"); }
  assert.ok(dayPlan("2026-11-09", plan).note.includes("Tricks start")); assert.ok(dayPlan("2026-10-31", plan).note.includes("Halloween"));
});

test("no weekly solo rehearsal: Wednesdays are Contemporary only; the PITCH jazz hold is on Nov 7–8; schema 40 updates a stored solo", async () => {
  const classes = JSON.parse(readFileSync(new URL("../data/classes.json", import.meta.url), "utf8"));
  assert.ok(!classes.some(c => /solo rehearsal/i.test(c.name)), "no standing solo rehearsal in the weekly classes");
  assert.deepEqual(classes.filter(c => c.day === 3).map(c => c.name), ["Mini Contemporary III"]);
  for (const d of Object.keys(plan.days)) { const v = plan.days[d]; assert.ok(!/solo rehearsal/i.test(v.classes || ""), d); assert.notEqual(v.tag, "rehearsal", d); assert.ok(![...v.must, ...v.opt].some(i => /before rehearsal|at rehearsal|after: write her notes/i.test(i.t)), d + " has no rehearsal-only item"); }
  assert.match(dayPlan("2026-11-07", plan).note, /PITCH jazz/); assert.match(dayPlan("2026-11-08", plan).note, /PITCH jazz/);
  const { fixSoloRehearsal, SOLO_V40 } = await import("../js/store.js");
  const old = { id: "solo", teacher: SOLO_V40.teacher[0], rehearsal: SOLO_V40.rehearsal[0], checkpoints: [{ d: "2026-11-01", text: "Whole solo from memory, on the music" }, { d: "2026-11-04", text: SOLO_V40.checkpoint[0] }] };
  const m = migrateDoc("dances", "solo", { ...old, _v: 39 }); assert.equal(m.teacher, SOLO_V40.teacher[1]); assert.equal(m.rehearsal, SOLO_V40.rehearsal[1]); assert.equal(m.checkpoints[1].text, SOLO_V40.checkpoint[1]); assert.equal(m.checkpoints[1].d, "2026-11-04"); assert.equal(m.checkpoints[0].text, "Whole solo from memory, on the music"); assert.equal(m._v, SCHEMA_VERSION);
  const own = fixSoloRehearsal({ teacher: "Ms. Brittany, Tuesdays", rehearsal: "", checkpoints: [{ d: "2026-11-04", text: "my own goal" }] }); assert.equal(own.teacher, "Ms. Brittany, Tuesdays", "text the family typed stays"); assert.equal(own.checkpoints[0].text, "my own goal");
  assert.equal(migrateDoc("dances", "trio", { _v: 39, teacher: SOLO_V40.teacher[0] }).teacher, SOLO_V40.teacher[0], "only the solo");
  const seed = JSON.parse(readFileSync(new URL("../data/dances.json", import.meta.url), "utf8")); const solo = (Array.isArray(seed) ? seed : seed.dances || Object.values(seed)).find(x => x && x.id === "solo");
  assert.equal(solo.teacher, SOLO_V40.teacher[1]); assert.equal(solo.rehearsal, SOLO_V40.rehearsal[1]); assert.ok(solo.checkpoints.some(c => c.text === SOLO_V40.checkpoint[1]), "the seed matches what the migration writes");
});

test("ticks save per day; a must-box makes the day count; untick removes; ▶ targets", () => {
  const p = dayPlan("2026-10-17", plan);
  let r = tickPlan(undefined, p, "bed"); assert.deepEqual(r.rec.plan, ["bed"]); assert.equal(r.on, true); assert.equal(r.mustDone, false, "an optional box alone doesn't count");
  r = tickPlan(r.rec, p, "knee"); assert.deepEqual(r.rec.plan, ["bed", "knee"]); assert.equal(r.mustDone, true);
  r = tickPlan(r.rec, p, "knee"); assert.deepEqual(r.rec.plan, ["bed"]); assert.equal(r.on, false); assert.equal(r.mustDone, false);
  assert.deepEqual(planTicks({ plan: ["a", 3, "b"] }), ["a", "b"]); assert.deepEqual(planTicks(null), []);
  assert.equal(goFor("memo:trio"), "showPage('dances');memoFocus('trio')"); assert.equal(goFor("quick:flex"), "showPage('practice');openQuick('flex')"); assert.equal(goFor("player:solo"), "openPlayer('solo')"); assert.equal(goFor("note:solo"), "showPage('dances');noteOpen('solo')"); assert.equal(goFor(""), ""); assert.equal(goFor("zzz:1"), "");
  assert.ok(BITE_IDS.includes("plan"));
});

test("schema 30 normalizes practice.plan, never invents it", () => {
  const p = migrateDoc("practice", "2026-10-17", { _v: 29, plan: ["a", "a", 7, " b "] }); assert.deepEqual(p.plan, ["a", "b"]); assert.equal(p._v, SCHEMA_VERSION);
  assert.equal("plan" in migrateDoc("practice", "2026-10-17", { _v: 29 }), false); assert.deepEqual(migrateDoc("practice", "2026-10-17", { _v: 29, plan: "x" }).plan, []);
  assert.deepEqual(migrateDoc("practice", "2026-10-17", { _v: 21, bites: ["plan", "zzz"] }).bites, ["plan"], "plan is a bite kind");
});

test("on Today the plan card comes right after the dance pet, then the show countdown calendar", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8"); const at = (id) => html.indexOf(`id="${id}"`);
  assert.ok(at("petArea") < at("dayPlan") && at("dayPlan") < at("adventCard"), "pet → plan → countdown");
  assert.ok(/id="petArea"[^\n]*\n\s*<div class="card mint dayplan" id="dayPlan"/.test(html), "nothing in between the pet and the plan");
});
