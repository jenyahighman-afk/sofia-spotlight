// Learn vs comp mode, the comp weekend, and the teacher summary.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installEnv } from "./_env.mjs";
installEnv();
const { modeFor, compWeekend, isComp, COMP_STEPS, COMP_DAYS_BEFORE } = await import("../js/mode.js");
const { teacherSummary } = await import("../js/teacher.js");
const { buildPlan } = await import("../js/plan.js");
const events = JSON.parse(readFileSync(new URL("../data/events.json", import.meta.url), "utf8"));
const pool = JSON.parse(readFileSync(new URL("../data/practice-pool.json", import.meta.url), "utf8"));
const dances = JSON.parse(readFileSync(new URL("../data/dances.json", import.meta.url), "utf8"));
const skills = JSON.parse(readFileSync(new URL("../data/skills.json", import.meta.url), "utf8"));

test("comp mode switches on a week before a competition or showcase, not for a convention-only weekend, and a pinned mode wins", () => {
  assert.equal(modeFor("2026-10-07", events).mode, "learn");
  const wk = modeFor("2027-01-02", events); assert.equal(wk.mode, "comp"); assert.equal(wk.event.id, "wf"); assert.equal(wk.auto, true);
  assert.equal(modeFor("2027-01-10", events).mode, "comp"); assert.equal(modeFor("2026-12-31", events).mode, "learn");
  assert.equal(isComp(events.find(e => e.id === "pp")), false); assert.equal(isComp(events.find(e => e.id === "hc")), true);
  assert.equal(modeFor("2027-01-02", events, { mode: "learn" }).mode, "learn"); assert.equal(modeFor("2026-10-07", events, { mode: "comp" }).auto, false);
  assert.equal(COMP_DAYS_BEFORE, 7);
});
test("the comp weekend runs from the day before the event to its last day", () => {
  assert.equal(compWeekend("2027-01-07", events).id, "wf"); assert.equal(compWeekend("2027-01-10", events).id, "wf"); assert.equal(compWeekend("2027-01-06", events), null); assert.equal(compWeekend("2027-01-11", events), null);
  assert.ok(COMP_STEPS.length >= 5 && COMP_STEPS.every(s => s.id && s.t.length <= 45));
});
test("a comp-week plan has one core and one legs item, no trick drill or aerial mission, and still runs every dance", () => {
  const base = { pool, aerial: [], aerialDone: [], dances, tricks: dances.find(d => d.id === "solo").tricks, weekFix: null, preferTags: [], date: "2027-01-05" };
  const learn = buildPlan(base), comp = buildPlan({ ...base, mode: "comp" });
  assert.ok(learn.some(i => i.kind === "trick")); assert.ok(!comp.some(i => i.kind === "trick" || i.kind === "aerial"));
  assert.equal(comp.filter(i => i.kind === "core").length, 1); assert.equal(comp.filter(i => i.kind === "legs").length, 1); assert.ok(comp.filter(i => i.kind === "run").length >= 2); assert.ok(comp.length < learn.length);
});
test("the teacher summary carries notes, coach fixes, trick states and goals — text only, nothing from the family space's media", () => {
  const corrections = { a: { id: "a", danceId: "solo", tag: "feet", text: "Point the back foot", status: "working", date: "2026-10-01" }, b: { id: "b", danceId: "solo", tag: "knees", text: "Straight knee on the kick", status: "done", date: "2026-09-20" } };
  const reviews = { r: { id: "r", danceId: "solo", trick: "Calypso", date: "2026-10-04", at: "2026-10-04T10:00", review: { fix: "Back knee higher", feet: "x" }, thumbs: ["data:image/jpeg;base64,AAAA"] } };
  const goals = { g: { id: "g", name: "Right split", emoji: "🦵", unit: "deg", checkins: [{ value: 150 }, { value: 165 }] } };
  const sk = { "s-calypso": { state: "checked", teacher: "Hannah" } };
  const t = teacherSummary({ dances, corrections, skills: sk, reviews, goals, ladder: skills, today: "2026-10-07" });
  assert.ok(t.includes("working on (Feet): Point the back foot") && t.includes("✓ fixed: Straight knee on the kick") && t.includes("Calypso: Back knee higher"));
  assert.ok(t.includes("★ Calypso — Teacher-checked (Hannah)") && t.includes("Right split: 150 → 165 deg"));
  assert.ok(!/data:image|https?:\/\//.test(t)); assert.ok(t.startsWith("Sofia — practice summary, 2026-10-07"));
});
