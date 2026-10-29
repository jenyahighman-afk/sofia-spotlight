// Build 1 from the Oct 28 review (1.43.0): two tiers of done (streak safe vs plan done), one showDay field, Monday as a
// watching day, the safety gates (no aerial drills during Memory + knees, Trick Quest hidden until Nov 9, gems never flip a
// trick to clean), the tool buttons under a practice item, filler games waiting for the solo on home days, and the Bunny
// pointing at the solo once the streak is safe.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installEnv } from "./_env.mjs";
installEnv();
const json = (f) => JSON.parse(readFileSync(new URL("../data/" + f + ".json", import.meta.url), "utf8"));
const src = (f) => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const { applyData, DATA_FILES } = await import("../js/data.js");
const got = {}; for (const f of DATA_FILES) got[f] = json(f); applyData(got);
const { dayCounts, planDone, planDays, SOLO_ITEMS } = await import("../js/streak.js");
const { buildPlan, WATCH_DAY, MEMORY_RUN } = await import("../js/plan.js");
const { showDay, studioKind, sessionRules, checkpoints, daysSinceDance } = await import("../js/season15.js");
const { toolsFor } = await import("../js/pmode.js");
const { gamesFor, GAMES, SOLO_GAMES } = await import("../js/views/play.js");
const { cardsFor } = await import("../js/habit.js");
const { bitesFor } = await import("../js/bites.js");
const B = await import("../js/buddy.js");
const plan = json("plan15"), pool = json("practice-pool"), aerial = json("aerial"), dances = json("dances");
const base = { pool, aerial, aerialDone: [], dances, tricks: dances.find(d => d.id === "solo").tricks, weekFix: null, preferTags: [] };

test("two tiers: any bite keeps the streak, only the solo (a run, a solo item, a plan box, a Memorize chunk) makes the plan done", () => {
  for (const rec of [{ bites: ["game"] }, { bites: ["dare", "tired"] }, { quick: ["flex"] }, { done: Array.from({ length: 8 }, (_, i) => "ex" + i), total: 10 }]) { assert.ok(dayCounts(rec, 10), "streak safe"); assert.equal(planDone(rec), false, "but not plan done: " + JSON.stringify(rec)); }
  for (const rec of [{ runs: [{ at: "x" }] }, { done: ["solo-run"] }, { done: ["mem-top"] }, { done: ["watch-run"] }, { done: ["imagery"] }, { bites: ["plan"] }, { bites: ["memo"] }]) assert.ok(planDone(rec), "plan done: " + JSON.stringify(rec));
  assert.equal(planDone(null), false); assert.equal(planDone({ done: ["warm-1"], bites: ["game"] }), false);
  assert.deepEqual(SOLO_ITEMS, ["solo-run", "mem-top", "mem-chunk", "watch-walk", "watch-run", "imagery"]);
  assert.equal(planDays({ "2026-10-20": { bites: ["game"] }, "2026-10-21": { runs: [{}] }, "2026-10-22": { done: ["mem-top"] }, "note": { runs: [{}] } }), 2);
  assert.equal(daysSinceDance({ "2026-10-20": { done: ["solo-run"] }, "2026-10-22": { bites: ["game"] } }, "2026-10-23"), 3, "a game doesn't reset the 2-day clock");
});

test("one showDay field: the ★ checkpoint, the family mini show two days before and the night-before rule all follow it", () => {
  assert.equal(showDay(plan), "2027-01-08"); assert.equal(showDay({}), "");
  assert.equal(sessionRules("2027-01-07", plan).nightBefore, true); assert.equal(sessionRules("2027-01-08", plan).nightBefore, false); assert.equal(sessionRules("2027-01-06", plan).nightBefore, false);
  const moved = { ...plan, showDay: "2027-01-09" }; assert.equal(sessionRules("2027-01-08", moved).nightBefore, true, "move the show and the night before moves");
  assert.equal(checkpoints("2026-10-26", moved, []).find(c => /mini show/.test(c.t)).d, "2027-01-07");
  assert.ok(!("nightBefore" in (plan.rules || {})), "no second copy of the date in the rules");
  assert.match(plan.phases.find(p => p.n === "Taper").g, /Fri Jan 8/); assert.match(json("phases").find(p => p.n === "Taper").g, /Fri Jan 8/);
  assert.match(plan.weeks[14].solo, /Wed Jan 6/); assert.match(plan.weeks[14].extra, /Thu Jan 7/);
});

test("Monday is a watching day (Hannah's videos, the solo in her head in the car), every other studio day the memory run", () => {
  assert.equal(studioKind("2026-11-02", plan), "watch", "Monday"); assert.equal(studioKind("2026-11-03", plan), "memory", "Tuesday"); assert.equal(studioKind("2026-11-07", plan), "memory", "Saturday");
  const mon = buildPlan({ ...base, date: "2026-11-02", short: "watch" }); assert.deepEqual(mon.map(i => i.id), WATCH_DAY.map(i => i.id)); assert.ok(mon.every(i => i.kind === "watch" || i.kind === "mind"), "no dancing on Monday");
  assert.ok(/walkthrough/i.test(WATCH_DAY[0].text) && /run-through/i.test(WATCH_DAY[1].text) && /car/i.test(WATCH_DAY[2].text));
  assert.deepEqual(buildPlan({ ...base, date: "2026-11-03", short: "memory" }).map(i => i.id), MEMORY_RUN.map(i => i.id), "Tuesday: the 15-minute memory run");
  assert.deepEqual(buildPlan({ ...base, date: "2026-11-03", short: true }).map(i => i.id), MEMORY_RUN.map(i => i.id), "short: true still means the memory run");
  for (const f of ["tools/print/Sofia-Practice-Toolkit.html", "tools/print/Sofia-Backstage-Pass.html", "tools/pass/backstage.json"]) { const t = src(f); assert.match(t, /Hannah's (two )?videos/, f); assert.doesNotMatch(t, /No home practice on Mon and Tue|Mon and Tue are rest days|Never 2 days in a row/, f); }
});

test("safety gates: no aerial drills during Memory + knees, and in the mission's own order after; Trick Quest hidden until Nov 9; gems never flip a trick to clean", () => {
  assert.equal(buildPlan({ ...base, date: "2026-11-05", focus: "knees" }).filter(i => i.kind === "aerial").length, 0, "Thursday during Memory + knees: no aerial");
  const after = buildPlan({ ...base, date: "2026-11-12", focus: null }).filter(i => i.kind === "aerial"); assert.equal(after.length, 2, "Thursday after Nov 9: two strength steps");
  const strength = aerial.filter(a => a.section === "Strength").map(a => a.id); assert.deepEqual(after.map(i => i.aerialId), strength.slice(0, 2), "the first two open steps, in order, not a rotation");
  const later = buildPlan({ ...base, date: "2026-11-12", focus: null, aerialDone: [strength[0]] }).filter(i => i.kind === "aerial"); assert.deepEqual(later.map(i => i.aerialId), strength.slice(1, 3), "a ticked step moves the next one up");
  assert.ok(gamesFor("2026-11-05", { knees: true }).games.every(g => g.id !== "quest")); assert.ok(gamesFor("2026-11-12", { knees: false }).games.some(g => g.id === "quest"));
  assert.equal(bitesFor("big", { noQuest: true })[1].id, "strength"); assert.equal(bitesFor("big", {})[1].id, "quest");
  const q = src("js/games/quest.js"); assert.ok(!q.includes("kidCycle"), "a gem count never changes the trick's circle"); assert.match(q, /Ask Ms\. Brittany or a grown-up/);
});

test("filler games wait for the solo on a home day during Own it; the solo games stay; the Today game card becomes What's Next?", () => {
  const g = gamesFor("2026-11-05", { home: true, knees: true, done: false }); assert.equal(g.gate, true); assert.deepEqual(g.games.map(x => x.id), SOLO_GAMES);
  assert.equal(gamesFor("2026-11-05", { home: true, knees: true, done: true }).gate, false, "plan done: everything opens");
  assert.equal(gamesFor("2026-11-04", { home: false, knees: true, done: false }).gate, false, "a studio day isn't gated");
  assert.equal(gamesFor("2026-11-12", { home: true, knees: false, done: false }).games.length, GAMES.length, "after Own it nothing is hidden");
  const c = cardsFor("2026-11-05", { soloOnly: true }).find(x => x.id === "game"); assert.equal(c.sub, "What's Next?"); assert.match(c.go, /playOpen\('nextmove'\)/);
  assert.notEqual(cardsFor("2026-11-05", {}).find(x => x.id === "game").go, c.go);
});

test("tool buttons under a practice item: the music, Hannah's videos by name, Chunks, Pause & Predict; nothing for an exercise", () => {
  const vids = { solo: ["Walkthrough", "Run-through"], trio: ["Trio run-through"] };
  assert.deepEqual(toolsFor({ id: "watch-walk" }, vids), [{ label: "📹 Walkthrough", go: "hvWatch('solo',0)" }]);
  assert.deepEqual(toolsFor({ id: "watch-run" }, vids), [{ label: "📹 Run-through", go: "hvWatch('solo',1)" }]);
  assert.deepEqual(toolsFor({ id: "watch-run" }, { solo: ["Hannah 1", "Hannah 2"] }), [{ label: "📹 Hannah 2", go: "hvWatch('solo',1)" }], "no name match: by position");
  assert.deepEqual(toolsFor({ id: "watch-run" }, {}), [], "no videos uploaded yet: no button");
  assert.deepEqual(toolsFor({ id: "solo-run", dance: "solo" }, vids), [{ label: "🎵 Solo music", go: "openPlayer('solo')" }]);
  assert.deepEqual(toolsFor({ id: "trio-mark", dance: "trio" }, vids).map(t => t.go), ["openPlayer('trio')", "hvWatch('trio',0)"]);
  assert.deepEqual(toolsFor({ id: "mem-chunk" }, vids).map(t => t.label), ["🧩 Chunks", "🎵 Solo music"]); assert.deepEqual(toolsFor({ id: "mem-predict" }, vids).map(t => t.label), ["⏸ Pause & Predict"]);
  assert.deepEqual(toolsFor({ id: "core-plank", kind: "core" }, vids), []); assert.deepEqual(toolsFor(null, vids), []);
  const pm = src("js/pmode.js"); assert.match(pm, /PM\.ask = true/, "the timer asks instead of ticking off"); assert.match(pm, /✅ Did it/); assert.match(pm, /↻ Again/); assert.match(pm, /!== "manual"/, "timed unless she picked Manual");
});

test("the Bunny: once the streak is safe but the solo isn't done, the one next step is the solo; plan done is what makes the day done", () => {
  const lines = json("buddy"); assert.ok(lines.steps.solo.length >= 2); assert.ok(lines.openers.length >= 12);
  const ctx = { name: "Sofia", pet: "Bun-Bun", dayDone: false, safe: true, fullDone: false, streak: 2, skips: 2, petDays: 3, comp: null, compMode: false, plan: null, ticks: [], classes: [], restDay: false, cards: [{ id: "game", sub: "Mirror", go: "x", done: false }], dare: null, door: null, glow: false, cardsEarned: 0, starsLeft: 0, unlock: "", event: null };
  assert.equal(B.pickStep(ctx).key, "solo"); assert.equal(B.pickStep({ ...ctx, safe: false }).key, "game", "nothing done yet: a Today card");
  assert.equal(B.pickStep({ ...ctx, plan: { must: [{ id: "a", t: "Solo chunk", go: "memo:solo" }] } }).key, "plan", "a plan box comes first");
  for (const t of [...lines.steps["just-done"], ...lines.steps.plan, ...lines.steps.game, ...lines.openers]) assert.doesNotMatch(t, /today counts|Grown-up plan alert|carrot|whiskers|Knock knock/i, t);
  const home = src("js/views/home.js"); assert.match(home, /⭐ Plan done/); assert.match(home, /Streak safe · solo next/); assert.match(home, /off left this week/); assert.doesNotMatch(home, /free skip/);
  assert.match(src("js/dayplan.js"), /tick a solid box = plan done/);
});

test("the trio's videos: Today's 📹 Videos, a videos row on the trio card, the solo card unchanged; the food line; the flipbook's name", () => {
  const d = src("js/views/dances.js"); assert.match(d, /d\.id==="solo"\|\|d\.id==="trio"\?videosEdit\(d\)/); assert.match(d, /isCueTable\(d\.cues\)\?tableTools\(d\):videosRow\(d\)/);
  assert.match(src("js/views/home.js"), /openVideos\(\)/); assert.match(src("js/cuecards.js"), /export function openVideos/);
  for (const f of ["tools/print/Sofia-Backstage-Pass.html", "tools/pass/backstage.json"]) { const t = src(f); assert.doesNotMatch(t, /feel lighter/, f); assert.match(t, /Never skip a meal\. Dancers run on fuel\./, f); }
  assert.doesNotMatch(src("js/glow.js") + src("README.md") + src("data/news.json"), /Glow-Up/); assert.match(src("js/glow.js"), /Growing-up Flipbook/);
  assert.match(JSON.stringify(json("compday")), /in for 4, out for 6/); assert.match(src("js/habit.js"), /in for 4, out for 6/); assert.match(JSON.stringify(json("daily")), /nine to twelve hours/);
});
