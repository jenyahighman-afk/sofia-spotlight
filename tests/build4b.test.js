// Build 4, Part A of the Oct 29 audit, the weeks half: the plan-week keys (schema 51) and the auto-picked fix, the Sunday
// sheet's title and Mom's card (today's line, last Sunday's sheet), the checkpoint ticks, the readiness headline and its
// home-day denominator, the second nudge (8 pm, home kinds only), the Pass star, the news split, the plan items' full text.
// Every expectation here is computed from fixed dates or the same gates the views use — never from today's weekday or the zone.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installEnv, resetDom, el } from "./_env.mjs";
installEnv();
const json = (f) => JSON.parse(readFileSync(new URL("../data/" + f + ".json", import.meta.url), "utf8"));
const src = (f) => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const { applyData, DATA_FILES } = await import("../js/data.js");
const got = {}; for (const f of DATA_FILES) got[f] = json(f); applyData(got);
const data = await import("../js/data.js");
const ST = await import("../js/store.js");
const C = await import("../js/corrections.js");
const SU = await import("../js/sunday.js");
const MW = await import("../js/momweek.js");
const SE = await import("../js/season15.js");
const RD = await import("../js/ready.js");
const RM = await import("../js/remind.js");
const W = await import("../worker/src/remind-core.js");
const P = await import("../js/pass.js");
const NW = await import("../js/news.js");
const PL = await import("../js/plan.js");
const { todayStr } = await import("../js/util.js");
const plan15 = json("plan15"), spring = json("plan-spring"), news = json("news"), pool = json("practice-pool"), aerial = json("aerial"), dances = json("dances");
const solo = dances.find(d => d.id === "solo");
const S = ST.S;
const clearS = () => { for (const k of Object.keys(S)) S[k] = {}; };
const shift = (iso, n) => { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + n); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const OPEN = (id, text, tag, extra = {}) => ({ id, danceId: "solo", text, tag, status: "working", date: "2026-10-20", source: "Hannah", ...extra });

test("1. the week's fix and the Sunday sheet are keyed by the plan week (Monday → Sunday, season15.weekOf's `of`); the streak keeps its own Sunday week", () => {
  assert.equal(C.mondayKey("2026-10-29"), "2026-10-26"); assert.equal(C.mondayKey("2026-11-01"), "2026-10-26", "a Sunday closes the week that began the Monday before"); assert.equal(C.mondayKey("2026-11-02"), "2026-11-02");
  for (const plan of [plan15, spring]) { for (const [i, wk] of plan.weeks.entries()) { assert.equal(new Date(wk.of + "T00:00:00").getDay(), 1, `${plan.start} week ${wk.w} starts on a Monday`); assert.equal(wk.of, shift(plan.start, 7 * i), "the weeks run on from the start");
    for (let k = 0; k < 7; k++) { const d = shift(wk.of, k); assert.equal(C.planWeekKey(d), SE.weekOf(d).of, d); assert.equal(C.planWeekKey(d), C.mondayKey(d)); } } }
  assert.equal(C.planWeekKey("2026-09-01"), "2026-08-31", "outside any plan: the Monday on or before"); assert.equal(C.planWeekKey("2027-07-01"), "2027-06-28");
  assert.equal(C.weekKey("2026-10-29"), "2026-10-25", "the streak's Sunday → Saturday week is untouched");
  clearS(); S.corrections = { a: OPEN("a", "Eyes up", "eyes") }; S.settings = { weekFix: { id: "a", week: "2026-10-26", pickedAt: "2026-10-29" } };
  assert.equal(C.currentWeekFix("2026-10-29").id, "a"); assert.equal(C.currentWeekFix("2026-11-01").id, "a", "the Sunday film review still sees the week's fix"); assert.equal(C.currentWeekFix("2026-11-02"), null, "Monday: a new week");
  clearS();
});

test("1b. the fix is picked on the first open of a new week (weekFixOrPick): once the family space has answered, saved with auto: true, returned at once, never twice, a pinned note first", async () => {
  clearS(); const writes = []; ST.setBackend({ set: async (c, id, doc) => { writes.push([c, id, doc]); }, del: async () => {} });
  try {
    S.corrections = { a: OPEN("a", "Eyes up", "eyes"), b: OPEN("b", "Point the foot", "feet", { date: "2026-10-21" }) };
    assert.equal(C.weekFixOrPick("2026-11-02"), null, "the tracker hasn't arrived from the cloud: no pick"); assert.equal(writes.length, 0);
    ST.receive("corrections", S.corrections, { fromCache: false }); ST.receive("settings", { main: { pin: "2027" } }, { fromCache: false });
    const pick = C.weekFixOrPick("2026-11-02"); assert.ok(pick && ["a", "b"].includes(pick.id)); assert.equal(pick.id, C.chooseWeekFix(S.corrections, "2026-11-02").id, "chooseWeekFix's pick");
    assert.deepEqual({ ...S.settings.weekFix }, { id: pick.id, week: "2026-11-02", pickedAt: "2026-11-02", auto: true }, "saved in memory before the cloud write");
    assert.equal(C.currentWeekFix("2026-11-02").id, pick.id); assert.equal(C.currentWeekFix("2026-11-08").id, pick.id, "all week, Sunday included");
    await new Promise(r => setTimeout(r, 0)); const n = writes.length; assert.equal(n, 1);
    assert.equal(C.weekFixOrPick("2026-11-04").id, pick.id); await new Promise(r => setTimeout(r, 0)); assert.equal(writes.length, n, "a week that has its fix is never re-picked");
    S.corrections = { ...S.corrections, p: OPEN("p", "Knees over toes", "knees", { pinned: true, source: "Ms. Brittany" }) };
    assert.equal(C.weekFixOrPick("2026-11-09").id, "p", "a teacher's pinned note is the week's fix"); await new Promise(r => setTimeout(r, 0)); assert.equal(writes.length, n, "and needs no pick saved");
    assert.match(src("js/planToday.js"), /weekFixOrPick\(date\)/); assert.match(src("js/sunday.js"), /if \(isSunday\(date\)\) return weekFixOrPick\(date\);/); assert.match(src("js/sunday.js"), /sheetFix\(today\(\)\)/); assert.match(src("js/momweek.js"), /fix: weekFixOrPick\(date\)/);
  } finally { ST.setBackend(null); ST.receive("corrections", {}, { fromCache: false }); ST.receive("settings", {}, { fromCache: false }); clearS(); }
});

test("1c. schema 51 re-keys settings.sunday and settings.weekFix.week from the old Sunday key to the plan week's Monday — nothing invented, nothing dropped", () => {
  assert.ok(ST.SCHEMA_VERSION >= 51);
  assert.equal(ST.sundayKeyToPlanWeek("2026-11-01"), "2026-10-26", "Sunday K → Monday K − 6"); assert.equal(ST.sundayKeyToPlanWeek("2026-10-26"), "2026-10-26", "a Monday stays"); assert.equal(ST.sundayKeyToPlanWeek("2026-10-28"), "2026-10-28", "anything else is left alone"); assert.equal(ST.sundayKeyToPlanWeek("nope"), "nope");
  const d = ST.migrateDoc("settings", "main", { _v: 50, sunday: { "2026-11-01": { went: "arms", fix: "yes", fixId: "p1", note: "", done: "2026-11-01" }, "2026-11-08": { went: "x" } }, weekFix: { id: "a", week: "2026-11-01", pickedAt: "2026-11-04" }, stars: 3 });
  assert.equal(d._v, ST.SCHEMA_VERSION); assert.deepEqual(Object.keys(d.sunday).sort(), ["2026-10-26", "2026-11-02"]); assert.deepEqual(d.sunday["2026-10-26"], { went: "arms", fix: "yes", fixId: "p1", note: "", done: "2026-11-01" }); assert.equal(d.sunday["2026-11-02"].went, "x");
  assert.deepEqual(d.weekFix, { id: "a", week: "2026-11-02", pickedAt: "2026-11-04" }, "picked on Wed Nov 4 under the Sunday key Nov 1: its own week, Mon Nov 2"); assert.equal(d.stars, 3);
  assert.equal(ST.migrateDoc("settings", "main", { _v: 50, weekFix: { id: "a", week: "2026-11-01", pickedAt: "2026-11-01" } }).weekFix.week, "2026-10-26", "picked on the Sunday itself: the week that Sunday closes");
  assert.equal(ST.migrateDoc("settings", "main", { _v: 50, weekFix: { id: "a", week: "2026-11-01" } }).weekFix.week, "2026-10-26", "no pickedAt: the Sunday rule (a stale key only means the next open picks again)");
  assert.deepEqual(ST.migrateDoc("settings", "main", { _v: 50, weekFix: { id: "a", week: "2026-11-02", pickedAt: "2026-11-04" } }).weekFix, { id: "a", week: "2026-11-02", pickedAt: "2026-11-04" }, "a Monday key stays");
  const m = ST.rekeySunday({ "2026-11-01": { went: "arms", done: "2026-11-01" }, "2026-10-26": { note: "film the second half", went: "feet" } });
  assert.deepEqual(m, { "2026-10-26": { went: "arms", fix: "", fixId: "", note: "film the second half", done: "2026-11-01" } }, "two records on one key merge, the finished one leading, the other filling what it left empty");
  const u = ST.migrateDoc("settings", "main", { _v: 50, stars: 3 }); assert.equal("sunday" in u, false); assert.equal("weekFix" in u, false);
  assert.equal(ST.migrateDoc("practice", "2026-11-01", { _v: 50, sunday: "x" }).sunday, "x", "only settings carry them");
});

test("2. the Sunday sheet reviews a Sunday: today's on a Sunday, last Sunday's on the days after (its title says so); Mom's card says which", () => {
  assert.equal(SU.reviewSunday("2026-11-01"), "2026-11-01"); assert.equal(SU.reviewSunday("2026-11-04"), "2026-11-01"); assert.equal(SU.reviewSunday("2026-11-07"), "2026-11-01"); assert.equal(SU.reviewSunday("2026-11-08"), "2026-11-08");
  assert.equal(SU.sheetTitle("2026-11-01"), "🎬 Sunday sheet"); assert.match(SU.sheetTitle("2026-11-04"), /^🎬 Last Sunday \(.*Nov 1\)$/); assert.match(src("js/sunday.js"), /openStage\(sheetTitle\(today\(\)\)/);
  const by = (lines, k) => lines.find(l => l.k === k);
  assert.match(by(MW.momWeekLines("2026-11-01", { sunday: { "2026-10-26": { went: "arms", done: "2026-11-01" } } }), "sunday").text, /^Sunday sheet: done /, "done on its Sunday");
  assert.match(by(MW.momWeekLines("2026-11-03", { sunday: { "2026-10-26": { went: "arms", done: "2026-11-02" } } }), "sunday").text, /^Last Sunday's sheet \(.*Nov 1\): done$/, "filled on the Monday after: still last Sunday's, done");
  const nf = by(MW.momWeekLines("2026-11-06", {}), "sunday"); assert.match(nf.text, /^Last Sunday's sheet \(.*Nov 1\): not filled$/); assert.equal(nf.warn, true); assert.equal(nf.btn, "🎬 Fill it");
  assert.match(by(MW.momWeekLines("2026-11-08", {}), "sunday").text, /^Sunday sheet: today$/, "the next Sunday is its own sheet");
  assert.doesNotMatch(src("js/momweek.js") + src("js/sunday.js"), /not filled this week/);
});

test("2b. Mom's card opens with today: the kind of day, what the plan is, and the one item that wants a grown-up", () => {
  const t = MW.momTodayLine("2026-10-29", { kind: "memory", classes: [{ t: "5:30", name: "Acro make-up class" }], items: PL.MEMORY_RUN });
  assert.equal(t.k, "today"); assert.equal(t.text, "Thursday, studio day: the memory run after Acro make-up · Pause & Predict wants a grown-up");
  assert.equal(MW.momTodayLine("2026-11-02", { kind: "watch", classes: data.CLASSES.filter(c => c.day === 1), items: PL.WATCH_DAY }).text, "Monday, studio day: Hannah's videos, then the solo in the car — no dancing tonight");
  assert.equal(MW.momTodayLine("2026-11-05", { kind: "home", homePlan: "Strength + flex + solo run", items: [{ id: "x", text: "Plank", secs: 600 }, { id: "imagery", text: "Show in your head (6 min)", how: "1. Stand… A grown-up reads the steps out loud for the first two weeks.", secs: 360 }] }).text, "Thursday, home day: Strength + flex + solo run · 16 min · Show in your head wants a grown-up");
  assert.equal(MW.momTodayLine("2026-11-07", { kind: "rest" }).text, "Saturday, rest day: nothing planned, a stretch if she likes");
  assert.equal(MW.grownUpItem([{ id: "film-review", text: "🎬 Sunday film review with a grown-up: what went well first, then ONE fix" }]), "🎬 Sunday film review"); assert.equal(MW.grownUpItem([{ id: "plank", text: "Plank 30 s" }]), ""); assert.equal(MW.grownUpItem([]), "");
  assert.equal(MW.shortClass("Mini/Jr Acro II/III"), "Acro"); assert.equal(MW.shortClass("Mini Jazz Technique III"), "Jazz Technique"); assert.equal(MW.shortClass("Mini/Jr Ballroom"), "Ballroom"); assert.equal(MW.shortClass("PITCH rehearsal"), "PITCH rehearsal");
  assert.equal(MW.momWeekLines("2026-11-04", { today: { kind: "home", items: [] } })[0].k, "today"); assert.equal(MW.momWeekLines("2026-11-04", {})[0].k, "week", "handed nothing about today, the card starts with the week (the older tests)");
  const ts = MW.momToday("2026-10-29"); assert.equal(ts.kind, "memory", "Thu Oct 29: the Acro make-up class (data/events.json) makes it a studio day"); assert.ok(ts.classes.length >= 1); assert.ok(ts.items.some(i => i.id === "mem-predict"));
  assert.equal(MW.momToday("2026-11-05").kind, "home"); assert.equal(MW.momToday("2026-11-02").kind, "watch");
});

test("3. a checkpoint is ticked only once its day is here or gone, and the tick asks first — on the season card and in the by-when sheet", async () => {
  assert.equal(SE.canTick("today"), true); assert.equal(SE.canTick("passed"), true); for (const st of ["next", "book", "done", ""]) assert.equal(SE.canTick(st), false, st);
  assert.equal(SE.CP_CONFIRM, "Did you really make it?"); assert.match(src("js/season15.js"), /if \(on && !confirm\(CP_CONFIRM\)\) return;/);
  assert.doesNotMatch(SE.cpRow({ id: "x:1", d: "2026-12-20", t: "Costume run #1", state: "next" }, "2026-11-03"), /cpTick|Made it/, "a checkpoint still to come has no ✓");
  assert.match(SE.cpRow({ id: "x:1", d: "2026-11-03", t: "Whole solo", state: "today" }, "2026-11-03"), /cpTick\('x:1',true\)[^<]*>✓ Made it/); assert.match(SE.cpRow({ id: "x:1", d: "2026-11-01", t: "Whole solo", state: "passed" }, "2026-11-03"), /Did you make it\?[\s\S]*cpTick\('x:1',true\)/);
  resetDom(); clearS(); const stage = await import("../js/stage.js"); stage.initStage(); SE.initSeason(); const today = todayStr();
  window.openByWhen(); const bw = el("#byWhenArea").innerHTML; const due = SE.plansFrom(today).flatMap(p => SE.allCheckpoints(p, [], today)).filter(c => c.d && c.d <= today).length;
  assert.equal((bw.match(/cpTick\('[^']+',true\)/g) || []).length, due, "a ✓ on the rows whose day is here or gone, none on the rest"); assert.ok((bw.match(/class="bw-row next"/g) || []).length >= 2);
  const id = SE.cpId(plan15, { t: "Whole trio, no video" }); window.confirm = () => false; await window.cpTick(id, true); assert.equal(S.settings.checkpoints, undefined, "no answer, no tick");
  window.confirm = () => true; await window.cpTick(id, true); assert.equal(S.settings.checkpoints[id].done, today); await window.cpTick(id, false); assert.equal(id in S.settings.checkpoints, false, "undo never asks");
  window.confirm = () => false; window.closeStage(); resetDom(); clearS();
});

test("4. readiness: one run per home day in the window (not per calendar day), the phase's bar as the headline, the overall percent only from Perform it, one line per bar", async () => {
  assert.equal(RD.homeDaysIn("2026-11-10", "2026-11-23"), 6, "Thu, Fri, Sun twice"); assert.equal(RD.homeDaysIn("2026-11-10", "2026-11-23", data.HOME_DAYS, [{ day: 4 }]), 4, "a Thursday class takes the Thursdays out"); assert.equal(RD.homeDaysIn("2026-11-10", "2026-11-23", {}), 0);
  const practice = { "2026-11-12": { runs: [{ danceId: "solo" }], done: ["solo-run"] }, "2026-11-15": { done: ["mem-top"] }, "2026-11-20": { runs: [{ danceId: "solo" }] } }; const reviews = { r1: { id: "r1", danceId: "solo", date: "2026-11-15" } };
  const r = RD.soloReadiness({ dance: solo, practice, reviews, today: "2026-11-23" }); assert.deepEqual(r.perform, { runs: 2, film: 1, days: 3, of: 6, window: 14, pct: 50 });
  assert.equal(RD.soloReadiness({ dance: solo, practice, reviews, today: "2026-11-23", classes: [{ day: 4 }] }).perform.pct, 75, "3 of 4 home days");
  assert.equal(RD.soloReadiness({ dance: solo, practice, reviews, today: "2026-11-23", homeDays: {} }).perform.of, RD.PERFORM_TARGET, "no home days known: the old target");
  assert.match(RD.readinessSubs(r).perform, /^2 runs · 1 on film · the solo on 3 of 6 home days$/); assert.match(RD.readinessLines(r)[4], /the solo danced on 3 of 6 home days$/);
  for (const [d, bar] of [["2026-10-29", "know"], ["2026-11-08", "know"], ["2026-11-09", "clean"], ["2026-11-29", "clean"], ["2026-11-30", "perform"], ["2027-01-05", "perform"], ["2027-02-03", "clean"], ["2027-03-02", "clean"], ["2027-04-07", "perform"], ["2027-06-10", "perform"]]) assert.equal(RD.phaseBar(SE.weekOf(d)), bar, d);
  assert.equal(RD.phaseBar(null), "know");
  const h5 = RD.readinessHeadline({ ...r, know: { ...r.know, n: 2 } }, SE.weekOf("2026-10-29")); assert.equal(h5.title, "Week 5: Know is the bar, 2 / 28 moves known"); assert.equal(h5.showOverall, false);
  assert.equal(RD.readinessHeadline(r, SE.weekOf("2026-11-13")).title, "Week 7: Clean is the bar, 0 of 0 fixes closed"); const h10 = RD.readinessHeadline(r, SE.weekOf("2026-12-02")); assert.equal(h10.title, "Week 10: Perform is the bar, 3 of 6 runs"); assert.equal(h10.showOverall, true);
  assert.equal(RD.readinessHeadline(r, null).title, "Know is the bar, 0 / 28 moves known");
  resetDom(); clearS(); const stage = await import("../js/stage.js"); stage.initStage(); RD.initReady();
  RD.openReady("2026-10-29"); let a = el("#readyArea").innerHTML; assert.match(a, /Week 5: Know is the bar, 0 \/ 28 moves known/); assert.doesNotMatch(a, /% ready/); assert.equal((a.match(/<p>/g) || []).length, 4, "one line per bar"); window.closeStage();
  RD.openReady("2026-12-02"); a = el("#readyArea").innerHTML; assert.match(a, /Week 10: Perform is the bar/); assert.match(a, /0% ready overall/); window.closeStage();
  assert.match(RD.readyFold("2026-10-29"), /<span class="chip">0 \/ 28 moves known<\/span>/); assert.match(RD.readyFold("2026-12-02"), /<span class="chip">0%<\/span>/); resetDom(); clearS();
});

test("5. the second nudge: a 6:30 pm last call (8:00 pm until 1.56.0) unless the family set a time, on home kinds only (never after three classes or a memory run); the plan days follow the date's plan", () => {
  assert.deepEqual(RM.DEFAULT_SECOND, { h: 18, m: 30 }); const r = RM.reminderOf({}); assert.equal(r.h2, 18); assert.equal(r.m2, 30); assert.deepEqual(RM.reminderOf({ reminder: { h2: 19, m2: 30 } }), { on: false, h: 16, m: 30, second: true, h2: 19, m2: 30 }, "her own time stays");
  assert.equal(W.secondSlotFor("home"), true); assert.equal(W.secondSlotFor("watch"), false); assert.equal(W.secondSlotFor("memory"), false); assert.equal(W.secondSlotFor(undefined), true, "an older subscription without kinds keeps it");
  const sub = { h: 16, m: 30, h2: 20, m2: 0, tz: "America/Los_Angeles", lastSent: "2026-10-13" }; const t1 = new Date("2026-10-13T23:32:00Z"), t2 = new Date("2026-10-14T03:05:00Z"); // Tue Oct 13 2026, 16:32 and 20:05 PDT
  assert.equal(W.dueSlot({ ...sub, kinds: { 2: "memory" } }, t2), null, "Tuesday is a memory-run day: no evening nudge"); assert.equal(W.dueSlot({ ...sub, kinds: { 1: "watch", 2: "watch" } }, t2), null);
  assert.deepEqual(W.dueSlot({ ...sub, kinds: { 2: "home" } }, t2), { slot: 2, date: "2026-10-13" }); assert.deepEqual(W.dueSlot(sub, t2), { slot: 2, date: "2026-10-13" }, "no kinds: as before");
  assert.deepEqual(W.dueSlot({ ...sub, lastSent: "", kinds: { 2: "memory" } }, t1), { slot: 1, date: "2026-10-13" }, "the dance-time nudge is not the second slot: it still goes");
  assert.match(src("js/remind.js"), /plan = activePlan\(todayStr\(\)\)/); assert.doesNotMatch(src("js/remind.js"), /PLAN15/); assert.deepEqual(RM.planWeekdays(data.CLASSES, data.HOME_DAYS, spring).kinds, RM.planWeekdays(data.CLASSES, data.HOME_DAYS, plan15).kinds, "both plans keep Monday as the watch day");
  resetDom(); clearS(); S.settings = {}; RM.renderReminder(); assert.match(el("#meReminder").innerHTML, /last call at <b>6:30 pm<\/b> on home days/); resetDom(); clearS();
});

test("6. the Pass star only on a first-try right answer; a later right answer reads the part with a kind line; the hour is the caller's", () => {
  const check = { ok: 0, yay: "Yes! App = today 📱", hint: "Which helper knows what day it is?" };
  assert.deepEqual(P.passOutcome({ right: true, check }), { save: true, star: true, msg: "⭐ Yes! App = today 📱" });
  assert.deepEqual(P.passOutcome({ right: true, missed: true, check }), { save: true, star: false, msg: "✓ Right! Next part tomorrow earns the star." });
  assert.deepEqual(P.passOutcome({ right: true, read: true, missed: true, check }), { save: false, star: false, msg: "⭐ Still right!" });
  assert.deepEqual(P.passOutcome({ right: false, check }), { save: false, star: false, msg: "🤔 Which helper knows what day it is?" }); assert.equal(P.passOutcome({ right: false }).msg, "🤔 Try again.");
  localStorage.removeItem("spotlight:pass"); assert.equal(P.missedParts().has("crew"), false); P.markMissed("crew"); assert.equal(P.missedParts().has("crew"), true, "a miss is remembered on this phone"); P.markTipSaid("2026-11-02"); assert.equal(P.missedParts().has("crew"), true, "beside the tip day"); localStorage.removeItem("spotlight:pass");
  const h = P.clockHour(); assert.ok(Number.isInteger(h) && h >= 0 && h <= 23); assert.doesNotMatch(src("js/pass.js"), /hour = new Date\(\)\.getHours\(\)/, "todayTip never reads the clock itself");
  const mon = "2026-11-02"; assert.equal(P.todayTip(mon, 18), P.tipFor(mon, P.momentsFor(mon, { studio: true, home: false, hour: 18 }))); assert.equal(P.todayTip(mon, 8), P.tipFor(mon, P.momentsFor(mon, { studio: true, home: false, hour: 8 })));
  assert.equal(P.todayTip(mon), P.tipFor(mon, P.momentsFor(mon, { studio: true, home: false })), "no hour: a midday tip"); assert.match(src("js/pass.js"), /todayTip\(todayStr\(\), clockHour\(\)\)/);
});

test("7. What's new for Sofia is three kid lines about three kid things (the 1.52.0 edition since); Mom's items are one line on her Grown-ups card until she taps Got it", () => {
  assert.deepEqual(NW.newsItems(news).map(i => i.id), ["today", "me", "extras"]); const sentences = news.intro.split(/(?<=[.!?])\s+/); assert.ok(sentences.length >= 2 && sentences.length <= 3, "two or three lines: " + sentences.length);
  assert.match(news.intro, /Today/); assert.match(news.intro, /Me/); assert.match(news.intro, /Play/); assert.doesNotMatch(news.intro, /Mom gets|nudge/, "nothing about Mom's things");
  assert.ok(news.title.startsWith("3 ")); const m = NW.momNews(news); assert.equal(m.id, news.id); assert.match(m.text, /^New for Mom:/); assert.match(m.text, /on Me/); assert.match(m.text, /Practice/);
  localStorage.removeItem("spotlight:momnews"); assert.equal(NW.momNewsFor(news).id, news.id); assert.match(NW.momNewsHtml(news), /mom-news[\s\S]*New for Mom[\s\S]*momNewsGotIt\(\)/);
  assert.equal(NW.momNews({ id: "x", items: [] }), null); assert.equal(NW.momNewsHtml({ id: "x", items: [] }), "");
  resetDom(); clearS(); MW.renderMomWeek(); assert.match(el("#momWeek").innerHTML, /New for Mom/); window.momNewsGotIt(); assert.equal(localStorage.getItem("spotlight:momnews"), news.id); assert.doesNotMatch(el("#momWeek").innerHTML, /New for Mom/, "Got it: gone on this phone, the card re-drawn");
  assert.match(el("#momWeek").innerHTML, /<span class="mom-ic">(🏫|🏠|📹|🌙)<\/span>/, "the card opens with today's line"); localStorage.removeItem("spotlight:momnews"); resetDom(); clearS();
});

test("8. plan items carry their full words: the first sentence as the item, the rest as `how`; the fix item is the tag's drill with the note's words under it; the aerial step carries its watch-for; the memory run's item is 'Solo from the top · 5 min'", () => {
  assert.deepEqual(PL.splitLine("A b. C d. E"), { text: "A b.", how: "C d. E" }); assert.deepEqual(PL.splitLine("No end here"), { text: "No end here", how: "" }); assert.deepEqual(PL.splitLine("  x!  y  "), { text: "x!", how: "y" });
  assert.doesNotMatch(src("js/plan.js"), /slice\(0, 110\)/, "nothing is cut at 110 characters any more");
  const top = PL.MEMORY_RUN.find(i => i.id === "mem-top"); assert.ok(top.text.startsWith("Solo from the top · 5 min")); assert.equal(top.secs, 300); assert.equal(PL.MEMORY_RUN.reduce((s, i) => s + i.secs, 0), 960, "the list is still the 15 minutes");
  assert.match(PL.buildPlan({ pool, date: "2027-01-07", short: true, nightBefore: true, dances: [] }).find(i => i.id === "mem-top").text, /no full-out tonight/);
  const base = { pool, aerial, aerialDone: [], dances, tricks: solo.tricks, weekFix: null, preferTags: [] };
  for (const date of ["2026-10-05", "2026-10-06", "2026-10-07"]) { const t = PL.buildPlan({ ...base, date }).find(i => i.kind === "trick"); const line = solo.tricks[PL.dayNumber(date) % solo.tricks.length]; const { text, how } = PL.splitLine(line);
    assert.equal(t.text, "Trick drill: " + text, date); assert.equal(t.how, how); assert.ok(!t.how || !t.text.includes(t.how)); }
  assert.ok(solo.tricks.some(l => PL.splitLine(l).text.length > 110), "a card line's first sentence can be longer than the old cut");
  const pin = { id: "p1", text: "Knee alignment: knees over toes in every plié, lunge, landing and floor entry.", tag: "knees", source: "Ms. Brittany", pinned: true };
  const f = PL.buildPlan({ ...base, date: "2026-10-08", weekFix: pin }).find(i => i.kind === "fix"); assert.equal(f.id, "fix-p1"); assert.ok(f.text.startsWith("This week's fix · Knee drill: pliés in 1st and 2nd")); assert.equal(f.how, "📌 Ms. Brittany: " + pin.text); assert.equal(f.pose, "kick"); assert.equal(f.secs, 120);
  assert.equal(PL.buildPlan({ ...base, date: "2026-10-08", weekFix: { id: "m", text: "Eyes up on the leap", tag: "eyes", source: "Mom" } }).find(i => i.kind === "fix").how, "Mom's note: Eyes up on the leap");
  assert.equal(PL.fixWho("me"), "The note"); assert.equal(PL.fixWho("notes"), "The note"); assert.equal(PL.fixWho(""), "The note"); assert.equal(PL.fixWho("AI coach"), "The note"); assert.equal(PL.fixWho("Hannah"), "Hannah");
  for (const tag of Object.keys(PL.FIX_DRILLS)) { assert.ok(C.TAGS.includes(tag), tag); assert.ok(PL.FIX_DRILLS[tag].length > 60 && PL.FIX_DRILLS[tag].length < 240, tag); } assert.equal("other" in PL.FIX_DRILLS, false, "a tag with no drill keeps the note's words as the item");
  const thu = PL.buildPlan({ ...base, date: "2026-10-01" }).filter(i => i.kind === "aerial"); assert.ok(thu.length && thu.every(i => { const a = aerial.find(x => x.id === i.aerialId); return i.how.startsWith(a.how) && i.how.includes("⚠ Watch for: " + a.wrong); }), "the step's how-to and its watch-for text as one `how`");
  assert.match(src("js/pmode.js"), /it\.how \? `<div class="pm-how small">/, "practice mode shows `how` under the text");
});
