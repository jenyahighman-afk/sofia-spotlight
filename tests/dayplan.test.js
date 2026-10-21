// Today's plan (js/dayplan.js): the dated checklist from data/plan10.json, ticks, the "plan" bite rule, ▶ targets, migration 30.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installEnv } from "./_env.mjs";
installEnv();
const { dayPlan, tickPlan, planTicks, goFor, TAGS } = await import("../js/dayplan.js");
const { migrateDoc, SCHEMA_VERSION, BITE_IDS } = await import("../js/store.js");
const plan = JSON.parse(readFileSync(new URL("../data/plan10.json", import.meta.url), "utf8"));

test("the ten days are well-formed: Oct 17–26, a tag, must and opt items with unique ids, minutes, known go targets", () => {
  const dates = Object.keys(plan.days).sort(); assert.equal(dates[0], "2026-10-17"); assert.equal(dates[dates.length - 1], "2026-10-26"); assert.equal(dates.length, 10);
  for (const d of dates) {
    const p = dayPlan(d, plan); assert.ok(p, d); assert.ok(TAGS[p.tag], d + " tag"); assert.ok(p.must.length >= 1 && p.must.length <= 4, d + " must count");
    const ids = [...p.must, ...p.opt].map(x => x.id); assert.equal(new Set(ids).size, ids.length, d + " unique ids"); assert.ok(p.mins[0] > 0, d + " minutes");
    for (const it of [...p.must, ...p.opt]) if (it.go) assert.ok(goFor(it.go), d + " go " + it.go);
    if (p.tag !== "home") assert.ok(p.classes, d + " class day lists classes");
  }
  assert.equal(dayPlan("2026-10-27", plan), null); assert.equal(dayPlan("2026-10-17", {}), null); assert.equal(dayPlan("x", { days: { x: { must: [{ id: "a" }] } } }), null, "an item needs text");
  assert.equal(dayPlan("2026-10-26", plan).note.includes("Oct 31"), true);
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
