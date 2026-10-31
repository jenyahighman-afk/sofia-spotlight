// 1.57.0 (Jenya, Oct 30): the studio's December dates on the calendar — the Dec 5 group showings, the Dec 6 / Dec 12 solo-trio
// showings as "sign up for one" (a studio day only once picked), the Dec 12–13 hold weekend, the Showcase's Nov 7 deadline —
// the showing finish lines, the Winter Showcase details from the studio's FAQ, "the memory run" without "15-minute", and the
// Oct 30 re-audit's fix-soon items. Every date here is fixed; nothing reads the clock's weekday.
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
const { allCheckpoints, checkpoints } = await import("../js/season15.js");
const { routineOf, privatesStatus, calendarHtml, upcomingHtml } = await import("../js/studio.js");
const { dayKind, dayOpts } = await import("../js/daykind.js");
const { momWeekLines } = await import("../js/momweek.js");
const { sheetFix } = await import("../js/sunday.js");
const { startButton } = await import("../js/views/home.js");
const plan15 = json("plan15");
const ev = json("events");

test("the December dates: the group showing is a studio day; the solo-trio pair, the hold weekend and the deadline stay on the calendar only until picked", () => {
  const by = Object.fromEntries(ev.map(e => [e.id, e]));
  assert.equal(by["grp-showing-1205"].start, "2026-12-05"); assert.equal(by["grp-showing-1205"].kind, "class"); assert.ok(by["grp-showing-1205"].showing);
  for (const id of ["sdt-showing-1206", "sdt-showing-1212"]) { assert.equal(by[id].pick, "sdt-showing"); assert.equal(by[id].kind, "class"); assert.match(by[id].notes, /Sun Dec 6 OR Sat Dec 12/); }
  assert.deepEqual([by["hold-1212"].start, by["hold-1212"].end, by["hold-1212"].kind], ["2026-12-12", "2026-12-13", "hold"]);
  assert.deepEqual([by["deadline-1107"].start, by["deadline-1107"].kind], ["2026-11-07", "deadline"]);
  S.events = {};
  assert.deepEqual(ST.studioDates().map(e => e.id).filter(id => /showing/.test(id)), ["grp-showing-1205"], "only the group showing until a date is picked");
  assert.deepEqual(ST.calendarOnly().map(e => e.id), ["deadline-1107", "sdt-showing-1206", "sdt-showing-1212", "hold-1212"]);
  assert.ok(!ST.events().some(e => /showing|hold|deadline/.test(e.id)), "none is a show: no countdown, no comp mode");
  assert.equal(dayKind("2026-12-06", { ...dayOpts(), oneOffs: ST.studioDates() }), "home", "Sun Dec 6 stays a home day until it is picked");
  S.events = { "sdt-showing-1206": { chosen: true }, "sdt-showing-1212": { chosen: false } };
  assert.ok(ST.studioDates().some(e => e.id === "sdt-showing-1206")); assert.ok(!ST.calendarOnly().some(e => e.id === "sdt-showing-1206")); assert.ok(ST.calendarOnly().some(e => e.id === "sdt-showing-1212"));
  assert.notEqual(dayKind("2026-12-06", { ...dayOpts(), oneOffs: ST.studioDates() }), "home", "picked: Dec 6 is a studio day (the memory run at home)");
  assert.equal(routineOf(ST.studioDates().find(e => e.id === "sdt-showing-1206")), "other", "a showing is not a trio private");
  assert.deepEqual(privatesStatus(ST.studioDates(), "2026-12").map(s => s.have), [0, 0]);
  S.events = {};
  const cal = calendarHtml("2026-11-01"); assert.match(cal, /studioPick\('sdt-showing-1206'\)">✓ This one/); assert.match(cal, /sign up for one/); assert.match(cal, /Hold weekend/); assert.doesNotMatch(cal, /deadline-1107'\)/, "a deadline has no button");
  assert.match(src("js/studio.js"), /expose\(\{ openRehearsal, studioDel, studioPick, studioUnpick \}\)/); assert.match(src("js/views/schedule.js"), /upcomingHtml\(\)\+calendarHtml\(\)/);
  S.events = { "sdt-showing-1212": { chosen: true } }; assert.match(upcomingHtml("2026-11-01"), /studioUnpick\('sdt-showing-1212'\)/, "a picked one can be un-picked, not cancelled"); S.events = {};
});

test("Mom's card names the studio's dates in the next 7 days; the week strip and the calendar show them; the .ics carries them", () => {
  const dates = ev.filter(e => /showing|hold|deadline/.test(e.id));
  const lines = momWeekLines("2026-12-01", { plan: plan15, dates }); const l = lines.find(x => x.k === "dates");
  assert.match(l.text, /Group showing/); assert.match(l.text, /Solo\/trio showing \(sign up for one\)/); assert.equal(l.warn, true); assert.equal(l.go, "showPage('schedule')");
  assert.ok(!momWeekLines("2026-11-20", { plan: plan15, dates }).some(x => x.k === "dates"), "nothing in the next 7 days: no line");
  assert.match(momWeekLines("2026-11-02", { plan: plan15, dates }).find(x => x.k === "dates").text, /Showcase: opt-out \+ tee size due/);
  assert.match(src("js/views/home.js"), /calendarOnly\(\)\.filter\(e=>ds>=e\.start&&ds<=\(e\.end\|\|e\.start\)\)/);
  const sch = src("js/views/schedule.js"); assert.match(sch, /onDay\(ds\)\.forEach/); assert.match(sch, /\.\.\.cal\],season:SEASON/);
});

test("the showing finish lines: Dec 5 group; the solo + trio one dated by the family's pick, Dec 6 with 'sign up' until then", () => {
  const cps = allCheckpoints(plan15, [], "2026-11-01"); const g = cps.find(c => /Group showing/.test(c.t)); const s = cps.find(c => /Solo \+ trio showing/.test(c.t));
  assert.equal(g.d, "2026-12-05"); assert.equal(s.d, "2026-12-06"); assert.match(s.t, /\(sign up: Dec 6 or Dec 12\)$/);
  const picked = allCheckpoints(plan15, [{ id: "sdt-showing-1212", pick: "sdt-showing", chosen: true, start: "2026-12-12" }], "2026-11-01").find(c => c.id === s.id);
  assert.equal(picked.d, "2026-12-12"); assert.doesNotMatch(picked.t, /sign up/); assert.equal(picked.id, s.id, "the same id, so a tick stays");
  assert.deepEqual(checkpoints("2026-12-01", plan15, []).slice(0, 3).map(c => c.d), ["2026-12-05", "2026-12-06", "2026-12-06"]);
});

test("the Winter Showcase from the studio's FAQ: the theater, the fee and its date, tickets, what to wear; no password in the public repo", () => {
  const wf = ev.find(e => e.id === "wf"); assert.match(wf.venue, /^Meydenbauer Theater, 11100 NE 6th St, Bellevue, WA 98004$/);
  assert.match(wf.cost, /\$60/); assert.match(wf.cost, /tickets \$10 each/); assert.match(wf.charge, /^Auto-charge Nov 8, 2026/);
  assert.match(wf.notes, /opt-out only/); assert.match(wf.notes, /Nov 7/); assert.match(wf.notes, /solid black bottoms/); assert.match(wf.notes, /pink tights, pink ballet shoes and a solid black leotard/); assert.match(wf.notes, /Sat Jan 2/);
  assert.doesNotMatch(JSON.stringify(ev), /password|GHD\b/i);
});

test("the memory run has no '15-minute' anywhere (it is about 18 with the trio, Jenya chose the name); the button shows its minutes", () => {
  for (const f of ["js/daykind.js", "js/views/home.js", "js/studio.js", "js/season15.js", "data/pass.json", "data/plan10.json", "tools/print/Sofia-Backstage-Pass.html", "tools/print/Sofia-Practice-Toolkit.html", "index.html", "README.md"])
    assert.doesNotMatch(src(f), /15[- ]min(ute)? memory run/i, f);
  assert.equal(startButton({ kind: "memory", mins: 18, total: 6 }).label, "▶ Memory run · 18 min");
  assert.doesNotMatch(src("tools/print/Sofia-Practice-Toolkit.html"), /(the|a|·) <b[^>]*>Memory run/, "no capital mid-sentence");
});

test("the re-audit's fix-soon items: the dated line on home days only, the 2-day gap on the card, the week strip on Me, the Sunday sheet's fix, safe renders, the words", () => {
  const home = src("js/views/home.js");
  assert.match(home, /if\(home\) renderDayPlan\(today\); else \{ const dp=\$\("#dayPlan"\);/);
  assert.match(home, /gap>=maxGap\?`<div class="today-line small today-gap">🧠 \$\{gap\} days without your solo: dance it today, even the memory run counts<\/div>`/); assert.match(home, /\$\{metaLine\(\{streak,pd,safe:doneToday,skips\}\)\}\$\{gapLine\}/);
  assert.match(home, /document\.addEventListener\("page",e=>\{ if\(e&&e\.detail==="me"\) setTimeout\(weekToToday,0\); \}\)/);
  assert.match(home, /for\(const f of \[renderNews,renderPet,renderGlowNudge,/);
  // the Sunday sheet on a weekday: the fix of the week it closes, never this week's
  const corr = { a: { id: "a", text: "Point the feet", tag: "feet" }, b: { id: "b", text: "Eyes up", tag: "eyes" }, p: { id: "p", text: "Knees", tag: "knees", pinned: true, source: "Ms. Brittany" } };
  assert.equal(sheetFix("2026-11-04", { weekFix: { id: "a", week: "2026-10-26" } }, corr).id, "a", "Wed Nov 4 reviews Sun Nov 1, the week of Oct 26");
  assert.equal(sheetFix("2026-11-04", { weekFix: { id: "b", week: "2026-11-02" } }, { a: corr.a, b: corr.b }), null, "this week's fix is not last week's: the step is skipped");
  assert.equal(sheetFix("2026-11-04", { weekFix: { id: "b", week: "2026-11-02" }, sunday: { "2026-10-26": { fixId: "a", fix: "yes" } } }, corr).id, "a", "the one already answered on the sheet");
  assert.equal(sheetFix("2026-11-04", {}, corr).id, "p", "a teacher's pinned fix carries over");
  assert.match(src("js/sunday.js"), /Last week's fix<\/div><p class="small muted">The app has moved on/);
  assert.doesNotMatch(src("js/momweek.js"), /week card/); assert.doesNotMatch(src("data/pet.json"), /One bite/);
  assert.match(src("index.html"), /teacher-availability spreadsheet, then email the office/);
});
