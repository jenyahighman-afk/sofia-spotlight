// The group dances in the days before the Dec 5 group showing (1.87.0, "build the next two weeks"): plan15 week 10's
// `group` puts one PITCH jazz and one Listening Chair run on the full home days up to Fri Dec 4; class days stay the
// memory run, and nothing changes from the showing on.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installEnv } from "./_env.mjs";
installEnv();
const json = (f) => JSON.parse(readFileSync(new URL("../data/" + f + ".json", import.meta.url), "utf8"));
const { applyData, DATA_FILES } = await import("../js/data.js");
const got = {}; for (const f of DATA_FILES) got[f] = json(f); applyData(got);
const { sessionRules } = await import("../js/season15.js");
const { buildPlan, planSummary } = await import("../js/plan.js");
const { toolsFor } = await import("../js/pmode.js");
const pool = json("practice-pool"), dances = json("dances");
const full = (date) => buildPlan({ pool, date, dances, session: sessionRules(date) });

test("week 10 carries the group runs up to Fri Dec 4, the day before the group showing", () => {
  const ev = json("events").find(e => e.start === "2026-12-05" && /GROUP routine showings/.test(e.name)); assert.ok(ev, "the Dec 5 group showing is on the calendar");
  const g = json("plan15").weeks.find(w => w.w === 10).group; assert.equal(g.to, "2026-12-04");
  assert.deepEqual(g.runs.map(r => r.dance), ["pitch-jazz", "pitch-contemp"]); for (const r of g.runs) assert.ok(dances.some(d => d.id === r.dance), r.dance + " is a dance");
  assert.deepEqual(sessionRules("2026-12-03").group.map(x => x.dance), ["pitch-jazz", "pitch-contemp"]);
  for (const d of ["2026-11-27", "2026-12-05", "2026-12-06", "2026-12-10"]) assert.equal(sessionRules(d).group, null, d);
});

test("a full home day runs both group dances after the solo and trio; a memory-run day does not", () => {
  const ids = full("2026-12-03").map(i => i.id); const at = (id) => ids.indexOf(id);
  assert.ok(at("group-pitch-jazz") > at("trio-mark") && at("group-pitch-contemp") > at("group-pitch-jazz"), ids.join(","));
  assert.equal(full("2026-12-03").find(i => i.id === "group-pitch-jazz").dance, "pitch-jazz");
  assert.ok(!buildPlan({ pool, date: "2026-12-02", dances, short: "memory", session: sessionRules("2026-12-02") }).some(i => /^group-/.test(i.id)), "Wednesday's class day stays the memory run");
  assert.ok(!full("2026-12-06").some(i => /^group-/.test(i.id)), "after the showing: no group runs");
  assert.ok(!buildPlan({ pool, date: "2026-12-03", dances: dances.filter(d => !/^pitch-/.test(d.id)), session: sessionRules("2026-12-03") }).some(i => /^group-/.test(i.id)), "a dance that isn't here is skipped");
  assert.match(planSummary(full("2026-12-04")), /group dances/);
});

test("practice mode's button opens that group dance's music", () => {
  assert.deepEqual(toolsFor({ id: "group-pitch-jazz", dance: "pitch-jazz" }), [{ label: "🎵 Music", go: "openPlayer('pitch-jazz')" }]);
  assert.deepEqual(toolsFor({ id: "group-pitch-contemp", dance: "pitch-contemp" }), [{ label: "🎵 Music", go: "openPlayer('pitch-contemp')" }]);
});
