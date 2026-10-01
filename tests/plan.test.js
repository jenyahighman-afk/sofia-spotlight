// Daily practice plan: rotation, dance-driven items, aerial on home days, exercise poses.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildPlan, rotate, dayNumber, applyCustom, poolItems } from "../js/plan.js";
import { expandMoves } from "../js/data.js";

const read = (f) => JSON.parse(readFileSync(new URL("../data/" + f + ".json", import.meta.url), "utf8"));
const pool = read("practice-pool"), aerial = read("aerial"), dances = read("dances"), moves = read("moves"), exercises = read("exercises");
const base = { pool, aerial, aerialDone: [], dances, tricks: dances.find(d => d.id === "solo").tricks, weekFix: null, preferTags: [] };

test("pool ids are unique and every pose exists (a move or an exercise)", () => {
  const ids = new Set(); const poses = new Set([...expandMoves(moves).map(m => m.id), ...Object.keys(exercises).filter(k => k !== "_note")]);
  for (const slot of pool.slots) for (const it of slot.pool) { assert.ok(!ids.has(it.id), "dup " + it.id); ids.add(it.id); assert.ok(it.text && it.secs > 0, it.id); assert.ok(poses.has(it.pose), it.id + " pose " + it.pose); }
  for (const r of pool.runs) assert.ok(poses.has(r.pose), r.id);
  for (const p of Object.values(pool.fixPoses)) assert.ok(poses.has(p), "fix pose " + p);
  for (const p of Object.values(pool.aerialPoses)) assert.ok(poses.has(p), "aerial pose " + p);
  // the 1.x checklist ids still exist somewhere so old check-offs keep their meaning
  for (const id of ["warmup","hollow-superman","planks","releves-balance","leg-lifts","splits","passe-balance","pirouettes","kicks","arms-mirror"]) assert.ok(ids.has(id), id);
  assert.ok(pool.runs.some(r => r.id === "solo-run") && pool.runs.some(r => r.id === "trio-mark"));
});

test("exercise keyframes carry only known joints and a few core/leg moves lie down (rot) or lift", () => {
  const joints = new Set(["h","sl","sr","el","er","hl","hr","kl","kr","fl","fr","rot","lift","arms"]);
  for (const [id, frames] of Object.entries(exercises)) { if (id === "_note") continue; assert.ok(Array.isArray(frames) && frames.length >= 1, id); for (const f of frames) for (const k of Object.keys(f)) assert.ok(joints.has(k), id + " has unknown joint " + k); }
  assert.equal(exercises.plank[0].rot, -90); assert.equal(exercises.superman[0].rot, 90); assert.ok(exercises.jacks.length === 2);
});

test("the plan changes from day to day but keeps the same shape, and the same date always gives the same plan", () => {
  const a = buildPlan({ ...base, date: "2026-10-05" }), b = buildPlan({ ...base, date: "2026-10-06" }), a2 = buildPlan({ ...base, date: "2026-10-05" });
  assert.deepEqual(a.map(i => i.id), a2.map(i => i.id));
  const kinds = (p) => p.map(i => i.kind); assert.deepEqual(kinds(a).filter(k => k === "core").length, 2); assert.deepEqual(kinds(a).filter(k => k === "legs").length, 2);
  assert.notDeepEqual(a.filter(i => i.kind === "core").map(i => i.id), b.filter(i => i.kind === "core").map(i => i.id), "core moves rotate");
  assert.notDeepEqual(a.filter(i => i.kind === "legs").map(i => i.id), b.filter(i => i.kind === "legs").map(i => i.id), "leg moves rotate");
  const seen = new Set(); for (let d = 0; d < 8; d++) for (const i of buildPlan({ ...base, date: "2026-10-0" + (d + 1) })) if (i.kind === "core") seen.add(i.id);
  assert.ok(seen.size >= 6, "over a week she sees most of the core pool: " + seen.size);
  assert.ok(a.some(i => i.id === "solo-run") && a.some(i => i.id === "trio-mark"), "runs every day");
  assert.ok(a.some(i => i.kind === "trick" && i.text.startsWith("Trick drill:")), "a trick drill from the solo card");
  assert.notEqual(a.find(i => i.kind === "trick").id, b.find(i => i.kind === "trick").id, "trick drills rotate");
});

test("open-correction tags steer the technique picks; the week's fix becomes a drill", () => {
  const eyes = buildPlan({ ...base, date: "2026-10-05", preferTags: ["eyes"] });
  assert.ok(eyes.filter(i => i.kind === "tech").every(i => (i.tags || []).includes("eyes")), eyes.filter(i => i.kind === "tech").map(i => i.id).join());
  const fix = buildPlan({ ...base, date: "2026-10-05", weekFix: { id: "c1", text: "Point your foot on the kick", tag: "feet" } });
  const f = fix.find(i => i.kind === "fix"); assert.equal(f.id, "fix-c1"); assert.ok(f.text.includes("Point your foot on the kick")); assert.equal(f.pose, "pike");
});

test("aerial mission steps join the plan on home days only: two strength steps Thursday, one drill Friday, none on studio days", () => {
  const thu = buildPlan({ ...base, date: "2026-10-01" }); // Thursday
  const ae = thu.filter(i => i.kind === "aerial"); assert.equal(ae.length, 2); assert.ok(ae.every(i => aerial.find(a => a.id === i.aerialId).section === "Strength"));
  const fri = buildPlan({ ...base, date: "2026-10-02" }); const af = fri.filter(i => i.kind === "aerial"); assert.equal(af.length, 1); assert.ok(aerial.find(a => a.id === af[0].aerialId).section.startsWith("Drills"));
  assert.equal(buildPlan({ ...base, date: "2026-10-05" }).filter(i => i.kind === "aerial").length, 0, "Monday is a studio day");
  const allDone = buildPlan({ ...base, date: "2026-10-01", aerialDone: aerial.map(a => a.id) }); assert.equal(allDone.filter(i => i.kind === "aerial").length, 0, "checked steps drop out");
  assert.ok(!thu.some(i => i.kind === "aerial" && /20 in a row|spotted|unspotted|teacher/i.test(i.text)), "in-class-only steps never appear at home");
});

test("rotate: deterministic window over the pool, preferred tags first, no duplicates", () => {
  const p = [{ id: "a", tags: ["x"] }, { id: "b" }, { id: "c", tags: ["x"] }, { id: "d" }];
  assert.deepEqual(rotate(p, 2, 0).map(i => i.id), ["a", "b"]); assert.deepEqual(rotate(p, 2, 1).map(i => i.id), ["c", "d"]); assert.deepEqual(rotate(p, 2, 2).map(i => i.id), ["a", "b"]);
  assert.deepEqual(rotate(p, 2, 1, ["x"]).map(i => i.id), ["c", "a"]);
  assert.deepEqual(rotate([], 2, 0), []); assert.equal(dayNumber("2026-10-02") - dayNumber("2026-10-01"), 1);
});

test("swap / add / skip for the day: same-pool only, stale ids ignored, groups stay together", () => {
  const plan = buildPlan({ ...base, date: "2026-10-05" });
  const core = plan.filter(i => i.kind === "core"); const other = poolItems(pool, "core").find(i => !core.some(c => c.id === i.id));
  const swapped = applyCustom(plan, pool, { swap: { [core[0].id]: other.id } });
  assert.ok(swapped.some(i => i.id === other.id) && !swapped.some(i => i.id === core[0].id), "swapped in from the core pool");
  assert.equal(swapped.filter(i => i.kind === "core").length, 2);
  const legs = poolItems(pool, "legs").find(i => !plan.some(p => p.id === i.id));
  const added = applyCustom(plan, pool, { add: [legs.id, "nope", legs.id] });
  assert.equal(added.filter(i => i.kind === "legs").length, 3, "one real add, duplicates and unknown ids ignored");
  const legIdx = added.map(i => i.kind); assert.equal(legIdx.lastIndexOf("legs") < legIdx.indexOf("flex"), true, "added item sits with its group");
  const dropped = applyCustom(plan, pool, { drop: [core[1].id] }); assert.equal(dropped.filter(i => i.kind === "core").length, 1);
  const wrongPool = applyCustom(plan, pool, { swap: { [core[0].id]: legs.id } }); assert.ok(wrongPool.some(i => i.id === core[0].id), "a swap to another pool is ignored");
  assert.deepEqual(applyCustom(plan, pool, null).map(i => i.id), plan.map(i => i.id));
  assert.ok(poolItems(pool, "core").every(i => i.kind === "core") && poolItems(pool, "x").length === 0);
});
