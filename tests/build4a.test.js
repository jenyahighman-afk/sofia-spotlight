// Build 4, Part A (the Oct 29 audit of Today, Play, the dated box, Practice, the solo card, Dance Along, localStorage).
// Every expectation here is computed from fixed dates or from the same gates the views use — never from today's weekday.
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
const { S } = await import("../js/store.js");
const DK = await import("../js/daykind.js");
const { bookingRecord } = await import("../js/studio.js");
const { studioKind } = await import("../js/season15.js");
const PL = await import("../js/views/play.js");
const HM = await import("../js/views/home.js");
const DP = await import("../js/dayplan.js");
const PR = await import("../js/views/practice.js");
const AL = await import("../js/games/along.js");
const { todayStr } = await import("../js/util.js");
const clearS = () => { for (const k of Object.keys(S)) S[k] = {}; };
const html = src("index.html");
const classes = json("classes"), homeDays = json("home-days");
const ACRO = { id: "e-acro", kind: "class", name: "Acro make-up class", start: "2026-10-29", end: "2026-10-29", time: "5:30 PM" };
const opts = (oneOffs = []) => ({ classes, oneOffs, homeDays, studioKind });

test("one answer to what kind of day it is (daykind.js): a home weekday with nothing booked is a home day; a class or a booked date makes it a studio day with the memory run (Monday: the watch day); the rest rest", () => {
  assert.equal(DK.weekdayOf("2026-10-29"), 4, "Thu"); assert.equal(DK.weekdayOf("2026-11-01"), 0, "Sun");
  assert.equal(DK.dayKind("2026-10-29", opts([ACRO])), "memory", "Thu Oct 29 with the Acro make-up: a studio day, the 15-minute memory run");
  assert.equal(DK.dayKind("2026-10-29", opts()), "home", "the same Thursday with nothing booked: a home day");
  assert.equal(DK.dayKind("2026-11-05", opts()), "home"); assert.equal(DK.dayKind("2026-11-06", opts()), "home", "Fri"); assert.equal(DK.dayKind("2026-11-01", opts()), "home", "Sun");
  assert.equal(DK.dayKind("2026-11-02", opts()), "watch", "Monday's three classes: Hannah's videos and the solo in her head");
  assert.equal(DK.dayKind("2026-11-03", opts()), "memory", "Tuesday's classes: the memory run"); assert.equal(DK.dayKind("2026-11-07", opts()), "memory", "Saturday's classes");
  assert.equal(DK.dayKind("2026-11-04", { classes: [], oneOffs: [], homeDays, studioKind }), "rest", "a Wednesday with no class and no home plan");
  assert.equal(DK.dayKind("2026-11-04", { classes: [], oneOffs: [{ id: "x", kind: "class", name: "Solo rehearsal with Ms. Brittany", start: "2026-11-04", end: "2026-11-04" }], homeDays }), "memory", "a booking with no studioKind given still says the memory run");
  assert.equal(DK.isHomeDay("2026-11-05", opts()), true); assert.equal(DK.isHomeDay("2026-10-29", opts([ACRO])), false);
  // the "Home: …" line for a day's cell (the week strip, the Schedule)
  assert.equal(DK.homeLine("2026-11-05", opts()), "Strength + flex + solo run"); assert.equal(DK.homeLine("2026-11-06", opts()), "Technique + run"); assert.equal(DK.homeLine("2026-11-01", opts()), "Full-out run (film it)");
  assert.equal(DK.homeLine("2026-10-29", opts([ACRO])), "15-min memory run", "a class on a home weekday: the memory run, not the full practice");
  assert.equal(DK.homeLine("2026-11-02", opts()), "", "Monday has no home line"); assert.equal(DK.homeLine("2026-11-04", opts()), "", "Wednesday neither");
  // from the app's own state: data/events.json carries the Oct 29 make-up; a booking saved later counts the same day it's saved
  clearS();
  assert.equal(DK.dayKindNow("2026-10-29"), "memory"); assert.equal(DK.dayKindNow("2026-11-05"), "home"); assert.equal(DK.dayKindNow("2026-11-02"), "watch"); assert.equal(DK.homeLineNow("2026-10-29"), "15-min memory run");
  const b = bookingRecord("2026-11-06", "4:00–4:30 PM", "", "GHD", "r-test", "other"); S.events = { [b.id]: b };
  assert.equal(DK.dayKindNow("2026-11-06"), "memory"); assert.equal(DK.homeLineNow("2026-11-06"), "15-min memory run");
  S.events = { [b.id]: { ...b, deleted: true } }; assert.equal(DK.dayKindNow("2026-11-06"), "home", "a cancelled booking gives the day back"); assert.equal(DK.homeLineNow("2026-11-06"), "Technique + run");
  clearS();
});

test("Play decides the kind of day the way Today does: a Thursday with a make-up class is not gated, a real home day is; Today's link to Play shows once the plan is done (1.52.0); no clock reads in the render paths", () => {
  const home = (d, one) => DK.dayKind(d, opts(one)) === "home";
  assert.equal(PL.gamesFor("2026-10-29", { home: home("2026-10-29", [ACRO]), knees: true, done: false }).gate, false, "the studio day opens every game");
  assert.equal(PL.gamesFor("2026-10-29", { home: home("2026-10-29"), knees: true, done: false }).gate, true, "the same Thursday with nothing booked gates the fillers until the plan is done");
  assert.deepEqual(PL.playSections("2026-10-29", { home: home("2026-10-29", [ACRO]), knees: true, done: false, doors: true }).sections.map(s => s.id), ["solo", "weekend", "extras"]);
  assert.match(HM.funLink({ pd: true }), /Pick something fun on Play/); assert.match(HM.funLink({ kind: "rest" }), /on Play/, "a rest day has no plan to finish"); assert.equal(HM.funLink({ pd: false, kind: "home" }), ""); assert.equal(HM.funLink({ pd: false, kind: "memory" }), "");
  const h = src("js/views/home.js"), p = src("js/views/play.js"), sch = src("js/views/schedule.js");
  assert.doesNotMatch(h, /gateExtras|extrasGate/, "1.52.0: Today has no extras to gate");
  assert.match(p, /home: dayKindNow\(today\) === "home"/); assert.match(h, /const kind=dayKindNow\(today\)/);
  for (const [f, s] of [["home.js", h], ["play.js", p], ["schedule.js", sch]]) assert.doesNotMatch(s, /new Date\(\)\.getDay\(\)/, f + " reads no weekday off the clock");
  for (const [f, s] of [["play.js", p], ["schedule.js", sch]]) assert.doesNotMatch(s, /HOME_DAYS/, f + " asks daykind, not the table"); assert.doesNotMatch(h, /HOME_DAYS\[wd\]/, "the week strip asks daykind (the one card still names the home plan)");
  assert.match(h, /const dow=weekdayOf\(today\)/); assert.match(h, /new Date\(today\+"T00:00:00"\)/, "the week strip starts from today's date string");
  assert.ok(src("sw.js").includes('"./js/daykind.js"'), "cached offline");
  // the pages in the fake DOM: a booking today makes Today a studio day and Play ungated, whatever weekday it is
  resetDom(); clearS(); const today = todayStr(); const b = bookingRecord(today, "5:30 PM", "", "GHD", "r-today", "other"); S.events = { [b.id]: b };
  HM.renderHome(); const tc = el("#todayCard").innerHTML; assert.ok(/📹 Watch day|🏫 Studio day/.test(tc), "the one card says studio"); assert.doesNotMatch(tc, /🏠 Home day/);
  assert.doesNotMatch(tc, /today-fun/, "nothing done yet: no link to Play");
  assert.doesNotMatch(el("#habitCard").innerHTML, /Your solo first/, "the extras card doesn't call a studio day a home day either");
  PL.renderPlay(); const grid = el("#gameGrid").innerHTML; assert.doesNotMatch(grid, /game-gate/, "no 'Home day: the solo first' on a studio day"); assert.match(grid, /✨ Extras/); assert.match(grid, /🎉 Weekend games/);
  // the week strip: today's cell carries the memory run when today is a home weekday with the booking, never the full practice
  const cell = (el("#homeWeek").innerHTML.match(/<div class="day today">[\s\S]*?(?=<div class="day |$)/) || [""])[0]; assert.ok(cell, "today's cell");
  if (data.HOME_DAYS[DK.weekdayOf(today)]) { assert.match(cell, /Home: 15-min memory run/); assert.doesNotMatch(cell, /Strength \+ flex|Technique \+ run|Full-out run/); } else assert.doesNotMatch(cell, /Home:/);
  resetDom(); clearS();
});

test("the dated plan10 line inside the one card is its headline and note only (1.52.0: one line, none on a memory-run day) — no second item list; a day with neither shows nothing, the one card is the plan", () => {
  const h29 = DP.dayNoteHtml(DP.dayPlan("2026-10-29")); assert.equal(h29, "", "a memory-run day adds nothing: the big button says the same words");
  const h31 = DP.dayNoteHtml(DP.dayPlan("2026-10-31")); assert.match(h31, /📋 <b>★ trio checkpoint<\/b> · Halloween/); assert.doesNotMatch(h31, /class day/, "the card already says the kind of day");
  for (const bad of ["dpTick(", "dp-list", "dp-foot", "if there's time", "tick a solid box", "trio-run", "solo-top"]) assert.ok(!h31.includes(bad), "no " + bad);
  assert.equal(DP.dayNoteHtml(DP.dayPlan("2026-11-02")), "", "no label, no note: nothing to add"); assert.equal(DP.dayNoteHtml(null), ""); assert.equal(DP.dayNoteHtml(DP.dayPlan("2027-05-01")), "");
  resetDom(); DP.renderDayPlan("2026-11-02"); assert.equal(el("#dayPlan").hidden, true); assert.equal(el("#dayPlan").innerHTML, "");
  DP.renderDayPlan("2026-11-01"); assert.equal(el("#dayPlan").hidden, false); assert.match(el("#dayPlan").innerHTML, /📋 <b>★ solo checkpoint<\/b>/); assert.doesNotMatch(el("#dayPlan").innerHTML, /home day/);
  // the data model is untouched: a must box ticked is still the "plan" bite, the ▶ targets still resolve (the Bunny reads them)
  const p = DP.dayPlan("2026-10-29"); assert.deepEqual(p.must.map(m => m.id), ["trio-run", "solo-top"]); assert.equal(DP.tickPlan({ done: [] }, p, "trio-run").mustDone, true); assert.equal(DP.goFor("player:solo"), "openPlayer('solo')");
  assert.match(src("js/views/home.js"), /renderDayPlan\(today\)/, "Today passes its date"); assert.ok(src("js/views/home.js").includes('<div class="today-line small dp-line" id="dayPlan" hidden></div>'), "the dated line sits inside the one card (1.52.0)");
  resetDom(); clearS(); HM.renderHome(); assert.ok(el("#todayCard").innerHTML.includes("today-start"), "the one card is always there, so nothing is blank when the box hides"); resetDom(); clearS();
});

test("the Practice hero speaks the one card's two tiers, never the old 60% line", () => {
  assert.equal(PR.practiceState({}), "⭐ Plan done when the solo items are ticked · ✓ streak safe at 60%");
  assert.equal(PR.practiceState({ safe: true }), "✓ Streak safe · solo next ⭐"); assert.equal(PR.practiceState({ pd: true, safe: true, pct: 40 }), "⭐ Plan done · the rest is extra"); assert.equal(PR.practiceState({ pd: true, pct: 100 }), "All done. Go you! 🎉");
  const s = src("js/views/practice.js"); assert.doesNotMatch(s, /today counts/); assert.doesNotMatch(s, /counts as a practice day/); assert.match(s, /practiceState\(\{pd:planDone\(rec\),safe:dayCounts\(rec,PRACTICE_ITEMS\.length\),pct\}\)/);
  resetDom(); clearS(); const today = todayStr(); PR.initPractice();
  PR.renderPractice(); assert.match(el("#practiceHead").innerHTML, /Plan done when the solo items are ticked/);
  S.practice = { [today]: { done: [], bites: ["tired"] } }; PR.renderPractice(); assert.match(el("#practiceHead").innerHTML, /✓ Streak safe · solo next ⭐/);
  S.practice = { [today]: { done: ["mem-top"] } }; PR.renderPractice(); assert.match(el("#practiceHead").innerHTML, /⭐ Plan done/);
  resetDom(); clearS();
});

test("the solo card has one memorize door: its 🧠 Memorize it fold is out of view until the sheet's Five steps opens it; the trio keeps its fold", async () => {
  const { renderDances, initDances } = await import("../js/views/dances.js"); resetDom(); clearS(); initDances(); renderDances(); const dl = el("#danceList").innerHTML;
  assert.ok(/<div class="memo-via-sheet"><details class="more memo" data-memo="solo" >/.test(dl), "the solo's fold is wrapped, closed");
  assert.ok(/<details class="more memo" data-memo="trio" >/.test(dl) && !/memo-via-sheet"><details class="more memo" data-memo="trio"/.test(dl), "the trio's fold stays in view");
  const solo = dl.slice(dl.indexOf('data-id="solo"'), dl.indexOf('data-id="trio"')); assert.equal((solo.match(/🧠 Memorize</g) || []).length, 1, "one 🧠 Memorize button on the solo card");
  assert.match(src("css/app.css"), /\.memo-via-sheet>details\.memo:not\(\[open\]\)\{display:none\}/);
  assert.match(src("js/memorize.js"), /📋 Five steps/, "the sheet's door to the five steps is still there (memoFocus opens the fold)");
  assert.match(src("js/views/dances.js"), /const memoFold=\(d\)=>!memoDances\(\[d\]\)\.length\?"":isCueTable\(d\.cues\)\?`<div class="memo-via-sheet">\$\{memoCard\(d\)\}<\/div>`:memoCard\(d\)/);
  resetDom(); clearS();
});

test("Dance Along points at Hannah's videos only when there is one; with none it asks Mom; localStorage is never read or written bare", () => {
  assert.match(AL.hannahHint([]), /^Ask Mom to add Hannah's videos on the solo card/); assert.match(AL.hannahHint([{ name: "Run-through" }]), /＋ Learn it/); assert.doesNotMatch(AL.hannahHint([{}]), /Ask Mom/);
  assert.ok(!html.includes("offered above"), "the card no longer points above at an empty box"); assert.ok(html.includes("Up to 130 seconds"));
  resetDom(); clearS(); AL.renderAlong(); let he = el("#alongHannah").innerHTML; assert.match(he, /Ask Mom to add Hannah's videos on the solo card/); assert.doesNotMatch(he, /alongLearn\(|field-lab/, "no button, no empty list");
  S.dances = { solo: { hannahVideos: [{ name: "Run-through", url: "https://x/r.mp4", path: "videos/r", offset: 4.98 }] } }; AL.renderAlong(); he = el("#alongHannah").innerHTML;
  assert.match(he, /alongLearn\('solo','videos%2Fr'\)">＋ Learn it/); assert.match(he, /Hannah's videos from the solo and trio cards: ＋ Learn it/); assert.doesNotMatch(he, /Ask Mom/);
  resetDom(); clearS();
  // every localStorage call in these files sits inside a try (Safari private mode, a full phone)
  for (const f of ["js/games/along.js", "js/games/mirror.js", "js/sync.js", "js/app.js"]) for (const line of src(f).split("\n")) if (/localStorage\.(getItem|setItem|removeItem)\(/.test(line)) assert.match(line, /try \{/, f + ": " + line.trim().slice(0, 80));
});

test("the family code survives a storage that throws: no code (the join screen), never a crash", async () => {
  const { getFamilyId } = await import("../js/sync.js"); const real = globalThis.localStorage;
  globalThis.localStorage = { getItem(){ throw new Error("SecurityError"); }, setItem(){ throw new Error("QuotaExceededError"); }, removeItem(){ throw new Error("SecurityError"); } };
  try { assert.equal(getFamilyId(), null); } finally { globalThis.localStorage = real; }
  real.setItem("spotlight:family", "ABCDEFGHJKLMNPQRSTUVWXYZ"); assert.equal(getFamilyId(), "ABCDEFGHJKLMNPQRSTUVWXYZ"); real.removeItem("spotlight:family"); assert.equal(getFamilyId(), null);
});
