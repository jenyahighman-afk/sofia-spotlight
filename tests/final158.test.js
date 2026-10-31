// 1.58.0, the Oct 30 final re-audit before the binder print: plan done is the solo's (trio work alone opened Play), the Bunny
// follows the trio gate, a pick settles its pair, show day has no home practice (Jenya), the studio's closures make her class
// days full home days (Jenya), today's finish line comes first, the unpicked showing follows its dates, the week strip and
// Mom's card say what the plan holds, the streak pauses on a booked date and the Showcase weekend, kick-overs only in class.
// Every date here is fixed; nothing reads the clock's weekday.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installEnv } from "./_env.mjs";
installEnv();
const json = (f) => JSON.parse(readFileSync(new URL("../data/" + f + ".json", import.meta.url), "utf8"));
const src = (f) => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const { applyData, DATA_FILES } = await import("../js/data.js");
const got = {}; for (const f of DATA_FILES) got[f] = json(f); applyData(got);
const ST = await import("../js/store.js"); const { S } = ST;
const { planDone, gateOpen, isPaused } = await import("../js/streak.js");
const { pickStep } = await import("../js/buddy.js");
const { dayKind, dayOpts, homeLine } = await import("../js/daykind.js");
const { planFor } = await import("../js/planToday.js");
const { startButton } = await import("../js/views/home.js");
const { gamesFor } = await import("../js/views/play.js");
const { studioOn } = await import("../js/studio.js");
const { allCheckpoints, nextCheckpoint, sessionRules } = await import("../js/season15.js");
const { momTodayLine } = await import("../js/momweek.js");
const plan15 = json("plan15");

test("plan done is the solo's: a trio run or the trio's five Memorize steps never finish the plan or open Play", () => {
  const items = [{ id: "solo-run" }, { id: "trio-mark" }];
  assert.equal(planDone({ runs: [{ danceId: "trio" }] }), false, "a trio run"); assert.equal(planDone({ bites: ["memo"], memo: { trio: ["story", "mark", "count", "test", "picture"] } }), false, "the trio's five steps");
  assert.equal(gateOpen({ runs: [{ danceId: "trio" }] }, items), false);
  assert.equal(planDone({ runs: [{ danceId: "solo" }] }), true); assert.equal(planDone({ runs: [{ at: "x" }] }), true, "a run without a dance is the solo's");
  assert.equal(planDone({ bites: ["memo"], memo: { solo: ["story", "mark", "count", "test", "picture"] } }), true); assert.equal(planDone({ bites: ["memo"] }), true, "an older record without per-dance steps");
  assert.match(src("js/player.js"), /if \(planDone\(next\)\) try \{ pingDone\(\); \}/, "a trio run never cancels tonight's nudge");
});

test("the Bunny: once the solo is done but the trio isn't on a home day, the one next step is the trio", () => {
  const base = { dayDone: true, safe: true, fullDone: false, streak: 2, skips: 2, comp: null, compMode: false, plan: null, ticks: [], classes: [], restDay: false, cards: [], dare: false, door: false, glow: true };
  assert.deepEqual(pickStep({ ...base, gate: true }, () => 0), { key: "trio", go: "showPage('practice')" });
  assert.notEqual(pickStep({ ...base, gate: false }, () => 0).key, "trio");
  assert.ok(json("buddy").steps.trio.length >= 3, "the Bunny has trio lines");
});

test("a pick settles its pair: the other date leaves the calendar; un-picking brings both back", () => {
  S.events = { "sdt-showing-1206": { chosen: true }, "sdt-showing-1212": { chosen: false } };
  assert.ok(!ST.calendarOnly().some(e => /sdt-showing/.test(e.id))); assert.deepEqual(ST.studioDates().filter(e => e.pick).map(e => e.id), ["sdt-showing-1206"]);
  S.events = { "sdt-showing-1206": { chosen: null }, "sdt-showing-1212": { chosen: null } };
  assert.deepEqual(ST.calendarOnly().filter(e => e.pick).map(e => e.id), ["sdt-showing-1206", "sdt-showing-1212"]);
  assert.match(src("js/studio.js"), /chosen: null \}\); \}/); S.events = {};
});

test("show day (Fri Jan 8): no home practice, no Play lock, the checklist; the night before stays the marking memory run", () => {
  S.events = {}; S.practice = {};
  assert.equal(dayKind("2027-01-08", dayOpts()), "show"); assert.equal(sessionRules("2027-01-08").show, true); assert.deepEqual(planFor("2027-01-08"), []);
  assert.equal(startButton({ kind: "show" }).label, "🎒 Show day checklist"); assert.equal(gamesFor("2027-01-08", { home: false, done: false }).gate, false);
  assert.equal(homeLine("2027-01-08", dayOpts()), "Show day ★"); assert.match(momTodayLine("2027-01-08", { kind: "show" }).text, /show day ★ no home practice/);
  assert.notEqual(dayKind("2027-01-07", dayOpts()), "show"); assert.ok(planFor("2027-01-07").length > 0, "the night before keeps its run");
  const wf = json("events").find(e => e.id === "wf"); assert.equal(wf.paused, true); assert.ok(isPaused("2027-01-08", [], [wf]), "the streak pauses on the Showcase weekend");
  assert.match(wf.type, /Competitive Showcase Jan 7–8/); assert.match(wf.type, /Informal Performance Showcase Jan 9–10/);
});

test("the studio's closures (its important dates): no classes, her class days are full home days; calendar-only, never a show", () => {
  S.events = {};
  const ids = ST.calendarOnly().map(e => e.id); assert.ok(ids.includes("closed-thanksgiving") && ids.includes("closed-winter")); assert.ok(!ST.events().some(e => e.kind === "closed"));
  assert.deepEqual(studioOn("2026-12-21", got.classes, [], []).length > 0 ? "class" : "none", "class", "without the closures Monday has classes");
  assert.equal(studioOn("2026-12-21", got.classes, [], ST.closures()).length, 0, "Winter Break: no classes");
  for (const d of ["2026-12-19", "2026-12-21", "2026-12-22", "2026-12-23", "2026-12-26", "2026-12-28", "2026-12-30"]) assert.equal(dayKind(d, dayOpts()), "home", d + " is a home day");
  assert.ok(planFor("2026-12-21").length > 10, "a full session on a break Monday");
  assert.notEqual(dayKind("2027-01-02", dayOpts()), "home", "back Sat Jan 2: the studio"); assert.notEqual(dayKind("2026-12-15", dayOpts()), "home", "Tue Dec 15: classes as usual");
  assert.equal(dayKind("2026-11-25", dayOpts()), "home", "Thanksgiving Wednesday"); assert.equal(homeLine("2026-11-26", dayOpts()), "memory run", "the light week's home days say the memory run");
  assert.equal(homeLine("2026-12-21", dayOpts()), "Home practice");
});

test("finish lines: today's first even when an older one waits for a tick; the unpicked showing follows its dates", () => {
  const cps = allCheckpoints(plan15, [], "2026-12-08"); const s = cps.find(c => /Solo \+ trio showing/.test(c.t)); assert.equal(s.d, "2026-12-12", "after Dec 6 it moves to Dec 12");
  assert.equal(allCheckpoints(plan15, [], "2026-11-01").find(c => c.id === s.id).d, "2026-12-06");
  const cp = nextCheckpoint("2027-01-08", plan15, [], {}); assert.equal(cp.state, "today"); assert.match(cp.t, /Winter Showcase/);
});

test("the rest: kick-overs only in class (schema 54), the trio card, Mom's taper flag, the gap nudge off on Mondays, the late-night Pass line", () => {
  assert.ok(ST.SCHEMA_VERSION >= 54); const solo = ST.migrateDoc("dances", "solo", { _v: 53, tricks: ["x. Kick-overs only with a spotter."] }); assert.deepEqual(solo.tricks, ["x. Kick-overs and aerials only in class."]);
  assert.equal(ST.migrateDoc("dances", "trio", { _v: 53, rehearsal: ST.SOLO_V54.trio[0] }).rehearsal, ST.SOLO_V54.trio[1]); assert.equal(ST.migrateDoc("dances", "trio", { _v: 53, rehearsal: "ours" }).rehearsal, "ours");
  assert.doesNotMatch(src("data/dances.json"), /Kick-overs only with a spotter|mark it once a week at home/);
  assert.match(src("js/momweek.js"), /plan\.rules\.taper\.from && date >= plan\.rules\.taper\.from\) \? " · taper"/);
  assert.match(src("js/season15.js"), /\[String\(new Date\(date \+ "T00:00:00"\)\.getDay\(\)\)\] === "watch"\) return "";/);
  assert.match(src("data/pass.json"), /dinner, the memory run on Tuesday, shower, bed/);
  assert.doesNotMatch(src("data/dances.json"), /girth d|inseam d|bust d|waist d|hips d/, "no measurements in the public data");
});
