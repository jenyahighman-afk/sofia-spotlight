// Build 3 from the Oct 28 review (1.48.0): the Sunday sheet in the app (schema 50), "This week, for Mom" on the hub, the
// reminder on the plan's days with a second evening nudge, Dance Along at 130 s with Hannah's videos, the extras on Play.
// Every expectation here is computed from fixed dates or the same gates the views use — never from today's weekday.
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
const { migrateDoc, SCHEMA_VERSION, normalizeSunday, S, setBackend } = await import("../js/store.js");
const SU = await import("../js/sunday.js");
const { momWeekLines } = await import("../js/momweek.js");
const { toolsFor } = await import("../js/pmode.js");
const { cpId } = await import("../js/season15.js");
const { bookingRecord } = await import("../js/studio.js");
const RM = await import("../js/remind.js");
const W = await import("../worker/src/remind-core.js");
const AL = await import("../js/games/along.js");
const PL = await import("../js/views/play.js");
const { extrasOpen } = await import("../js/views/home.js");
const B = await import("../js/buddy.js");
const { todayStr } = await import("../js/util.js");
const plan15 = json("plan15"), spring = json("plan-spring"), news = json("news");
const html = src("index.html");
const PIN = { id: "p1", danceId: "solo", text: "Knee alignment: knees over toes in every plié, lunge, landing and floor entry.", tag: "knees", status: "working", pinned: true, source: "Ms. Brittany", date: "2026-10-13" };
const MEM = { id: "p2", danceId: "solo", text: "Timing + memorize every step.", tag: "memory", status: "working", pinned: true, source: "Ms. Brittany", date: "2026-10-13" };
const clearS = () => { for (const k of Object.keys(S)) S[k] = {}; };

test("schema 50: settings.sunday, the reminder's second nudge and a routine's `from` are normalized when present, never invented", () => {
  assert.ok(SCHEMA_VERSION >= 50);
  assert.deepEqual(normalizeSunday({ "2026-11-01": { went: "  arms  ", fix: "yes", fixId: "c-solo-1", note: " n ", done: "2026-11-01" }, "2026-11-08": { fix: "maybe", fixId: "bad id!" }, "2026-11-15": { went: "ok" }, nope: { went: "x" }, "2026-11-22": "x" }),
    { "2026-11-01": { went: "arms", fix: "yes", fixId: "c-solo-1", note: "n", done: "2026-11-01" }, "2026-11-15": { went: "ok", fix: "", fixId: "", note: "", done: "" } }, "a record with nothing in it is dropped; junk fields go");
  assert.deepEqual(normalizeSunday(null), {}); assert.deepEqual(normalizeSunday([1]), {});
  const many = {}; for (let i = 0; i < 70; i++) many[`2027-${String(1 + (i % 12)).padStart(2, "0")}-${String(1 + Math.floor(i / 12)).padStart(2, "0")}`] = { went: "x" }; assert.equal(Object.keys(normalizeSunday(many)).length, 60, "the last 60 weeks");
  const d = migrateDoc("settings", "main", { _v: 49, sunday: { "2026-11-01": { went: "arms", done: "2026-11-01" }, bad: 1 }, reminder: { on: true, h: 16, m: 30, second: 0, h2: "19", m2: 99 } });
  assert.equal(d._v, SCHEMA_VERSION); assert.deepEqual(d.sunday, { "2026-10-26": { went: "arms", fix: "", fixId: "", note: "", done: "2026-11-01" } }, "normalized by 50, then re-keyed to the plan week's Monday by 51 (tests/build4b.test.js)"); assert.deepEqual(d.reminder, { on: true, h: 16, m: 30, second: false, h2: 19 });
  const u = migrateDoc("settings", "main", { _v: 49, stars: 3 }); assert.equal("sunday" in u, false); assert.equal("reminder" in u, false);
  assert.equal(migrateDoc("choreo", "a", { _v: 49, kind: "along", from: " videos/x " }).from, "videos/x"); assert.equal("from" in migrateDoc("choreo", "b", { _v: 49, kind: "along", from: 5 }), false); assert.equal(migrateDoc("choreo", "c", { _v: 49, kind: "studio", from: 5 }).from, 5, "other choreo docs are left alone");
});

test("the Sunday sheet, pure: the week's key, its state, the practice item's 🎬 button, and what a pinned note has earned", () => {
  // Build 4: the key is the plan week's Monday (the week Sunday Nov 1 closes starts Oct 26); a weekday is still last Sunday's sheet
  assert.equal(SU.sundayOf("2026-11-04"), "2026-10-26"); assert.equal(SU.sundayOf("2026-11-01"), "2026-10-26"); assert.equal(SU.sundayOf("2026-11-07"), "2026-10-26"); assert.equal(SU.sundayOf("2026-11-08"), "2026-11-02");
  assert.equal(SU.isSunday("2026-11-01"), true); assert.equal(SU.isSunday("2026-11-02"), false);
  const st = SU.sundayState({ sunday: { "2026-10-26": { went: "arms", fix: "yes", fixId: "p1", note: "", done: "2026-11-01" } } }, "2026-11-04");
  assert.equal(st.key, "2026-10-26"); assert.equal(st.sunday, "2026-11-01"); assert.equal(st.done, true); assert.match(st.label, /^done /); assert.deepEqual(st.bits, ["went well: “arms”", "the fix showed ✓"]);
  assert.deepEqual(SU.sundayState({}, "2026-11-04"), { key: "2026-10-26", sunday: "2026-11-01", rec: null, done: false, started: false, label: "not yet", bits: [] });
  assert.equal(SU.sundayState({ sunday: { "2026-10-26": { went: "arms" } } }, "2026-11-02").label, "started");
  assert.deepEqual(toolsFor({ id: "film-review" }, { solo: ["Walkthrough", "Run-through"] }).map(t => [t.label, t.go]), [["🎬 Sunday sheet", "openSunday()"], ["🎵 Solo music", "openPlayer('solo')"]], "the review item opens the sheet, the music a tap away");
  assert.deepEqual(toolsFor({ id: "solo-run", dance: "solo" }, {}).map(t => t.label), ["🎵 Solo music"], "the other solo items unchanged");
  const o = SU.pinOffers([PIN, MEM, { ...PIN, id: "p3", status: "done" }], { seen: { p1: ["2026-11-01", "2026-11-08"] }, known: { of: 28, known: 28 } });
  assert.deepEqual(o.map(x => [x.id, x.ready, x.why]), [["p1", true, "on 2 videos in a row"], ["p2", true, "all 28 moves known in Pause & Predict"]], "a closed note is not offered");
  const o2 = SU.pinOffers([PIN, MEM], { seen: { p1: ["2026-11-08"] }, known: { of: 28, known: 27 } }); assert.deepEqual(o2.map(x => [x.ready, x.seen, x.memoryDone]), [[false, 1, false], [false, 0, false]]);
  assert.equal(SU.pinOffers([MEM], { known: null })[0].ready, false, "no cue table: the memory note waits");
  assert.match(SU.PIN_MSG, /Grown-ups → Skills & awards/);
});

test("the Sunday sheet in the fake DOM: Today's card on a Sunday only, the four steps, each saved as it goes, Done ticks the plan item", async () => {
  resetDom(); clearS(); S.corrections = { p1: { ...PIN } }; S.settings = {};
  const stage = await import("../js/stage.js"); stage.initStage(); SU.initSunday();
  SU.renderSundayCard("2026-11-01"); const card = el("#sundayCard"); assert.equal(card.hidden, false);
  assert.match(card.innerHTML, /🎬 Sunday film review/); assert.match(card.innerHTML, /not yet/); assert.match(card.innerHTML, /This week's fix:/); assert.match(card.innerHTML, /📌 Ms\. Brittany/); assert.match(card.innerHTML, /0 of 2 in a row/); assert.match(card.innerHTML, /fixVideo\('p1',true\)/); assert.match(card.innerHTML, /fixVideo\('p1',false\)/); assert.match(card.innerHTML, /openSunday\(\)/);
  SU.renderSundayCard("2026-11-02"); assert.equal(card.hidden, true, "Monday: no card"); SU.renderSundayCard("2026-11-07"); assert.equal(card.hidden, true);
  S.settings = { sunday: { "2026-10-26": { went: "arms", fix: "yes", fixId: "p1", note: "", done: "2026-11-01" } } }; SU.renderSundayCard("2026-11-01"); assert.match(card.innerHTML, /✅ done/); assert.match(card.innerHTML, /went well: “arms”/); assert.match(card.innerHTML, /Open the Sunday sheet/);
  S.settings = {}; const today = todayStr(); const key = SU.sundayOf(today);
  window.openSunday(); assert.equal(el("#stage").hidden, false); assert.match(el("#stageTitle").textContent, SU.isSunday(today) ? /Sunday sheet/ : /Last Sunday \(/, "Build 4: on a weekday the sheet is last Sunday's"); const area = el("#sundayArea");
  assert.match(area.innerHTML, /Step 1 of 4/); assert.match(area.innerHTML, /Watch the last run together/); assert.match(area.innerHTML, /openPlayer\('solo'\)/); assert.match(area.innerHTML, /Watched it ›/);
  window.sdStep(2); assert.match(area.innerHTML, /What went well\?/); assert.match(area.innerHTML, /Mom types one word/); el("#sdWent").value = "  arms  ";
  await window.sdWent(); assert.equal(S.settings.sunday[key].went, "arms", "saved as it goes"); assert.match(area.innerHTML, /Step 3 of 4/); assert.match(area.innerHTML, /Did the fix show on the video\?/); assert.match(area.innerHTML, /Knee alignment/); assert.match(area.innerHTML, /sdFix\(true\)/);
  await window.sdFix(true); assert.deepEqual(S.settings.fixSeen.p1, [today], "✓ It showed counts toward two in a row, like Today's row"); assert.equal(S.settings.sunday[key].fix, "yes"); assert.equal(S.settings.sunday[key].fixId, "p1"); assert.match(area.innerHTML, /1 of 2: one more video to go/); assert.match(area.innerHTML, /Today: <b>it showed ✓/);
  await window.sdFix(false); assert.deepEqual(S.settings.fixSeen.p1, []); assert.equal(S.settings.sunday[key].fix, "no"); assert.match(area.innerHTML, /the count starts again/);
  window.sdStep(4); assert.match(area.innerHTML, /A note\?/); el("#sdNote").value = "film the second half";
  await window.sdDone(); const rec = S.settings.sunday[key]; assert.equal(rec.note, "film the second half"); assert.equal(rec.done, today); assert.match(area.innerHTML, /✅ Sunday sheet done/); assert.match(area.innerHTML, /sdStep\(2\)/, "each line can be changed");
  if (SU.isSunday(today)) assert.ok(S.practice[today].done.includes("film-review"), "a Sunday: the plan's review item is ticked"); else assert.equal(S.practice[today], undefined, "not a Sunday: nothing on the practice record");
  window.openSunday(); assert.match(area.innerHTML, /✅ Sunday sheet done/, "a finished sheet opens on its summary");
  // the pinned fix shown twice: the sheet points at Grown-ups instead of a ✓
  S.settings = { ...S.settings, fixSeen: { p1: ["2026-10-25", "2026-10-26"] } }; window.openSunday(3); assert.match(area.innerHTML, /ready for Ms\. Brittany's check/); assert.match(area.innerHTML, /openGrownups\('skillcheck'\)/); assert.doesNotMatch(area.innerHTML, /sdFix\(true\)/);
  window.closeStage(); resetDom(); clearS();
});

test("pinned notes close through Grown-ups: the kid's Got it buttons bounce to Skills & awards; the homework card there lists each pin with what it earned", async () => {
  for (const f of ["js/views/dances.js", "js/views/me.js", "js/showme.js"]) { const s = src(f); assert.match(s, /PIN_MSG/, f); assert.match(s, /openGrownups\("skillcheck"\)/, f); }
  assert.ok(html.includes('id="pinnedHomework"') && html.includes("Ms. Brittany's homework"));
  resetDom(); clearS(); S.corrections = { p1: { ...PIN }, p2: { ...MEM } }; S.settings = { fixSeen: { p1: ["2026-11-01", "2026-11-08"] } };
  const SC = await import("../js/views/skillcheck.js"); SC.renderSkillCheck(); const h = el("#pinnedHomework").innerHTML;
  assert.match(h, /pinClose\('p1'\)/); assert.match(h, /pinClose\('p2'\)/); assert.match(h, /★ ready/); assert.match(h, /on 2 videos in a row/); assert.match(h, /on video 0 of 2 in a row/, "the memory note is not ready: no cue known yet");
  const n = (h.match(/pin-row ready/g) || []).length; assert.equal(n, 1);
  S.corrections = {}; SC.renderSkillCheck(); assert.match(el("#pinnedHomework").innerHTML, /No open homework/); resetDom(); clearS();
});

test("This week, for Mom: the week, the Sunday sheet, the fix's video count, privates, the next checkpoint, the script read-aloud until Nov 23, the next mini audience", () => {
  const by = (lines, k) => lines.find(l => l.k === k);
  const a = momWeekLines("2026-11-04", {}); assert.deepEqual(a.map(l => l.k), ["week", "sunday", "fix", "privates", "checkpoint", "script", "mini"]);
  assert.match(by(a, "week").text, /^Week 6 of 15 · Own it$/); assert.match(by(a, "week").sub, /^Solo: Whole solo ×2/);
  assert.match(by(a, "sunday").text, /^Last Sunday's sheet \(.*Nov 1\): not filled$/, "Build 4: a weekday is about last Sunday's sheet"); assert.equal(by(a, "sunday").warn, true); assert.equal(by(a, "sunday").go, "openSunday()");
  assert.equal(by(a, "fix").text, "No fix picked this week"); assert.equal(by(a, "fix").warn, true);
  assert.match(by(a, "privates").text, /^Privates in November: Solo 0\/2 · Trio 0\/2$/); assert.equal(by(a, "privates").warn, true); assert.match(by(a, "privates").sub, /No solo private booked/); assert.equal(by(a, "privates").go, "openRehearsal('solo')");
  assert.match(by(a, "checkpoint").text, /Whole trio, no video/); assert.equal(by(a, "checkpoint").warn, true, "Oct 31 passed and unticked: asked first");
  assert.match(by(a, "script").text, /^From .*Nov 9.*: read the Show-in-your-head script aloud$/); assert.match(by(a, "mini").text, /^Next mini audience: .*Dec 6.* \(32 days\)$/); assert.match(by(a, "mini").sub, /Mini audience #1/); assert.equal(by(a, "mini").warn, false);
  const sunday = { "2026-10-26": { went: "arms", fix: "yes", fixId: "p1", note: "film the second half", done: "2026-11-01" } };
  const booked = [bookingRecord("2026-11-10", "3:30–4:00 PM", "Solo rehearsal with Ms. Brittany", "GHD", "r1"), bookingRecord("2026-11-17", "3:30–4:00 PM", "Solo rehearsal with Ms. Brittany", "GHD", "r2"), bookingRecord("2026-11-12", "4:00–4:30 PM", "Trio private", "GHD", "r3", "trio"), bookingRecord("2026-11-19", "4:00–4:30 PM", "Trio private", "GHD", "r4", "trio")];
  const ticks = { [cpId(plan15, { t: "Whole trio, no video" })]: { done: "2026-10-31" }, [cpId(plan15, { t: "Whole solo from memory, on the music" })]: { done: "2026-11-01" } };
  const b = momWeekLines("2026-11-04", { sunday, fix: PIN, seen: { p1: ["2026-11-01", "2026-11-03"] }, oneOffs: booked, ticks });
  assert.match(by(b, "sunday").text, /^Last Sunday's sheet \(.*Nov 1\): done$/); assert.equal(by(b, "sunday").warn, undefined); assert.match(by(b, "sunday").sub, /went well: “arms” · the fix showed ✓ · note: film the second half/);
  assert.match(by(b, "fix").text, /^This week's fix: Knee alignment/); assert.match(by(b, "fix").sub, /on video 2 of 2 in a row · 📌 Ms\. Brittany · ready to check off/); assert.equal(by(b, "fix").warn, true); assert.equal(by(b, "fix").go, "showPage('skillcheck')");
  assert.match(by(b, "privates").text, /Solo 2\/2 ✓ · Trio 2\/2 ✓/); assert.equal(by(b, "privates").warn, false); assert.match(by(b, "privates").sub, /Next solo private: .*Nov 10.* 3:30–4:00 PM/);
  assert.match(by(b, "checkpoint").text, /^Next checkpoint: .*Nov 10.* \(6 days\) · Next solo rehearsal/, "both passed ones ticked, the rehearsal booked: the next dated one");
  const c = momWeekLines("2026-11-04", { ticks }); assert.match(by(c, "checkpoint").text, /^Book it: Next solo rehearsal/); assert.equal(by(c, "checkpoint").go, "openRehearsal('solo')");
  assert.match(by(momWeekLines("2026-11-01", {}), "sunday").text, /^Sunday sheet: today$/); assert.match(by(momWeekLines("2026-11-01", { sunday: { "2026-10-26": { went: "arms" } } }), "sunday").sub, /started, not finished/);
  assert.match(by(momWeekLines("2026-11-04", { fix: { id: "x", text: "Eyes up", tag: "eyes" }, seen: { x: ["2026-11-03"] } }), "fix").sub, /^📹 on video 1 of 2 in a row$/);
  // the script: a grown-up reads it aloud from Nov 9 for 14 days, so until Nov 23; after that she does it herself
  assert.match(by(momWeekLines("2026-11-13", {}), "script").text, /^Read the Show-in-your-head script aloud, until .*Nov 23$/); assert.equal(by(momWeekLines("2026-11-13", {}), "script").warn, true);
  assert.match(by(momWeekLines("2026-11-22", {}), "script").text, /until .*Nov 23/); assert.match(by(momWeekLines("2026-11-23", {}), "script").text, /she does the script herself now/);
  // mini audiences: due and not ticked → asked; ticked → the next; all three → done
  const m1 = cpId(plan15, { t: "🎤 Mini audience #1: the solo for grandparents on a video call" }), m2 = cpId(plan15, { t: "🎤 Mini audience #2" }), m3 = cpId(plan15, { t: "🎤 Mini audience #3: one run for a friend or two" });
  assert.match(by(momWeekLines("2026-12-08", {}), "mini").text, /Mini audience #1.* was due .*Dec 6/); assert.equal(by(momWeekLines("2026-12-08", {}), "mini").warn, true);
  const d = by(momWeekLines("2026-12-15", { ticks: { [m1]: { done: "2026-12-06" } } }), "mini"); assert.match(d.text, /^Next mini audience: .*Dec 20.* \(5 days\)$/); assert.equal(d.warn, true, "inside a week: pink");
  assert.equal(by(momWeekLines("2026-12-28", { ticks: { [m1]: { done: "2026-12-06" }, [m2]: { done: "2026-12-20" }, [m3]: { done: "2026-12-27" } } }), "mini").text, "Mini audiences: all 3 done ✓");
  // the spring plan: no mini-audience checkpoints, the script is hers from day one
  const s = momWeekLines("2027-02-03", { plan: spring }); assert.equal(by(s, "mini"), undefined); assert.match(by(s, "week").text, /^Week 4 of 23/); assert.match(by(s, "script").text, /herself/);
  assert.match(by(momWeekLines("2026-09-01", {}), "week").text, /No plan week/);
  assert.ok(html.includes('id="momWeek"') && html.indexOf('id="momWeek"') > html.indexOf('id="p-grownups"')); assert.match(src("js/grownups.js"), /renderMomWeek\(\)/);
});

test("the reminder follows the plan's days — Monday the watch day, the other studio days the memory run, the home days — with a second evening nudge the family can turn off", () => {
  const pw = RM.planWeekdays(); assert.deepEqual(pw.kinds, { 0: "home", 1: "watch", 2: "memory", 3: "memory", 4: "home", 5: "home", 6: "memory" }); assert.deepEqual(pw.days, [0, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual(RM.planWeekdays([{ day: 1 }], { 4: "Strength" }, { rules: { studioDays: { 1: "watch" } } }), { days: [1, 4], kinds: { 1: "watch", 4: "home" } }); assert.deepEqual(RM.planWeekdays([{ day: 1 }], { 1: "x" }, { rules: {} }).kinds, { 1: "memory" }, "a class day is a studio day even if it's also a home day");
  assert.equal(RM.daysLabel(pw), "📹 Mon · 🧠 Tue, Wed, Sat · 🏠 Sun, Thu, Fri"); assert.equal(RM.daysLabel({ kinds: {} }), "");
  assert.deepEqual(RM.reminderOf({ reminder: { on: true, h: 16, m: 30, second: false, h2: 20, m2: 0 } }), { on: true, h: 16, m: 30, second: false, h2: 20, m2: 0 }); assert.equal(RM.reminderOf({ reminder: { on: true, h: 16, m: 30 } }).second, true, "on unless turned off");
  const r = RM.reminderOf({ reminder: { on: true, h: 16, m: 30 } }); const base = { familyId: "F", endpoint: "https://e", keys: { p256dh: "p", auth: "a" }, tz: "America/Los_Angeles" };
  const body = RM.subscribeBody(r, base); assert.deepEqual(body, { ...base, h: 16, m: 30, days: pw.days, kinds: pw.kinds, h2: 20, m2: 0 }, "the second nudge defaults to 8:00 pm since Build 4");
  assert.equal("h2" in RM.subscribeBody({ ...r, second: false }, base), false, "second off: the worker is told nothing about it");
  // the worker: the request, the two slots, the plan days, the lines
  const good = { familyId: "ABCDEFGHJKLMNPQRSTUVWXYZ", endpoint: "https://web.push.apple.com/QAbcdefghijklmnop", keys: { p256dh: "B".repeat(87), auth: "a".repeat(22) }, h: 16, m: 30, tz: "America/Los_Angeles" };
  const v = W.validateSubscribe({ ...good, days: [1, "4", 9, 1], kinds: { 1: "watch", 2: "memory", 9: "home", 3: "junk" }, h2: 19, m2: 30 }).sub; assert.deepEqual(v.days, [1, 4]); assert.deepEqual(v.kinds, { 1: "watch", 2: "memory" }); assert.equal(v.h2, 19); assert.equal(v.m2, 30);
  const v2 = W.validateSubscribe({ ...good, days: [], h2: 25, m2: 0 }).sub; assert.equal("days" in v2, false); assert.equal("h2" in v2, false); assert.equal("kinds" in v2, false);
  const sub = { h: 16, m: 30, h2: 19, m2: 30, tz: "America/Los_Angeles" }; const t1 = new Date("2026-10-13T23:32:00Z"), t2 = new Date("2026-10-14T02:35:00Z"); // Tue Oct 13 2026, 16:32 and 19:35 PDT
  assert.deepEqual(W.dueSlot(sub, t1), { slot: 1, date: "2026-10-13" }); assert.equal(W.dueSlot({ ...sub, lastSent: "2026-10-13" }, t1), null);
  assert.deepEqual(W.dueSlot({ ...sub, lastSent: "2026-10-13" }, t2), { slot: 2, date: "2026-10-13" }, "the evening nudge"); assert.equal(W.dueSlot({ ...sub, lastSent: "2026-10-13", lastSent2: "2026-10-13" }, t2), null, "never more than two a day");
  assert.equal(W.dueSlot({ h: 16, m: 30, tz: sub.tz, lastSent: "2026-10-13" }, t2), null, "no second time: no second nudge"); assert.deepEqual(W.dueSlot({ ...sub, lastSent: "2026-10-12" }, t2), { slot: 2, date: "2026-10-13" }, "slot 1 missed its window: the evening one still goes");
  assert.equal(W.dueSlot({ ...sub, days: [0, 4, 5] }, t1), null, "a Tuesday is not one of these days"); assert.deepEqual(W.dueSlot({ ...sub, days: [2] }, t1), { slot: 1, date: "2026-10-13" }); assert.equal(W.isDue({ ...sub, days: [0] }, t1), null);
  const p = JSON.parse(W.payloadFor({ ...sub, kinds: { 2: "memory" } }, "2026-10-13")); assert.equal(p.title, "Memory run 🧠"); assert.equal(p.tag, "dance-bite");
  assert.equal(JSON.parse(W.payloadFor({ ...sub, kinds: { 1: "watch" } }, "2026-10-12")).title, "Watch day 📹"); assert.equal(JSON.parse(W.payloadFor({ ...sub, kinds: { 1: "watch" } }, "2026-10-13")).title, W.lineFor("2026-10-13")[0], "a day without a kind: the rotating line");
  const p2 = JSON.parse(W.payloadFor(sub, "2026-10-13", 2)); assert.equal(p2.tag, "dance-bite-2"); assert.ok(W.SECOND_LINES.some(([t]) => t === p2.title)); assert.notEqual(JSON.parse(W.payloadFor(sub, "2026-10-14", 2)).title, p2.title);
  for (const [t, b] of [...Object.values(W.KIND_LINES), ...W.SECOND_LINES]) assert.ok(t.length <= 30 && b.length <= 60, t);
  const wr = src("worker/src/remind.js"); assert.match(wr, /dueSlot\(sub, now\)/); assert.match(wr, /lastSent2/); assert.match(wr, /payloadFor\(sub, date, slot\)/);
  // the Me card: the plan days, the second nudge and its switch; the permission flow is the same
  resetDom(); clearS(); S.settings = {}; RM.renderReminder(); const h = el("#meReminder").innerHTML; assert.match(h, /Plan days: 📹 Mon · 🧠 Tue, Wed, Sat · 🏠 Sun, Thu, Fri/); assert.match(h, /A second nudge at <b>8:00 pm<\/b> on home days/); assert.match(h, /rmSecond\(\)">On</); assert.match(h, /id="rmTime2"/);
  S.settings = { reminder: { on: true, h: 16, m: 30, second: false } }; RM.renderReminder(); const h2 = el("#meReminder").innerHTML; assert.match(h2, /rmSecond\(\)">Off</); assert.doesNotMatch(h2, /id="rmTime2"/); resetDom(); clearS();
  const rj = src("js/remind.js"); assert.match(rj, /Notification\.requestPermission\(\)/); assert.match(rj, /pushBlocker\(env\(\)\)/); assert.match(rj, /subscribeBody\(r, \{ familyId: sync\.familyId/);
});

test("Dance Along: the cap is 130 s (the solo plus its lead-in), Hannah's uploaded videos are offered as routines, a routine learned from one never deletes the dance's file", () => {
  assert.equal(AL.MAX_SEC, 130);
  const ds = [{ id: "solo", name: "Solo · Stay a Little Longer", hannahVideos: [{ name: "Run-through", url: "https://x/r", path: "videos/r", offset: 4.98 }, { name: "Walkthrough", url: "https://x/w", path: "videos/w", offset: 0 }, { name: "Link", url: "https://y", path: "", offset: 0 }] }, { id: "trio", name: "Trio", hannahVideos: [{ name: "Trio run", url: "https://x/t", path: "videos/t" }] }, { id: "other" }];
  const hv = AL.hannahRoutines(ds, { a: { kind: "along", from: "videos/t" }, b: { kind: "along", from: "videos/r", deleted: true }, c: { kind: "studio", from: "videos/w" } });
  assert.deepEqual(hv.map(v => [v.dance, v.danceName, v.name, v.learned]), [["solo", "Solo", "Run-through", false], ["solo", "Solo", "Walkthrough", false], ["trio", "Trio", "Trio run", true]], "a pasted link has no file to read; a deleted routine doesn't count");
  assert.equal(hv[0].offset, 4.98); assert.deepEqual(AL.hannahRoutines([], {}), []); assert.deepEqual(AL.hannahRoutines(undefined, undefined), []);
  const a = src("js/games/along.js"); assert.match(a, /r\.path && !r\.from/, "the dance owns the file"); assert.match(a, /alongLearn: learnVideo/); assert.match(a, /keep: \{ url: v\.url, path: v\.path \}, from: v\.path/); assert.match(a, /\.\.\.\(opts\.from \? \{ from: String\(opts\.from\) \} : \{\}\)/);
  assert.ok(html.includes('id="alongHannah"') && html.includes("Up to 130 seconds") && !html.includes("Up to 2 minutes"));
});

test("the extras on Play: three sections (solo work, weekend games, extras), the gate hides the last two; Today shows the doors and the dare only once the plan is done; the Bunny's game card is solo work on a home day", async () => {
  const gated = PL.playSections("2026-11-05", { home: true, knees: true, done: false, doors: true }); assert.equal(gated.gate, true); assert.deepEqual(gated.sections.map(s => s.id), ["solo"]); assert.deepEqual(gated.sections[0].games.map(g => g.id), ["nextmove", "along", "count"]);
  const open = PL.playSections("2026-11-05", { home: true, knees: true, done: true, doors: true }); assert.deepEqual(open.sections.map(s => s.id), ["solo", "weekend", "extras"]);
  assert.deepEqual(open.sections[1].games.map(g => g.id), PL.GAMES.filter(g => !PL.SOLO_WORK.includes(g.id)).map(g => g.id)); assert.deepEqual(open.sections[2].games.map(g => g.id), ["doors", "costume"]); assert.equal(open.sections[2].dare, true);
  assert.deepEqual(PL.playSections("2026-11-05", { home: true, knees: true, done: true, doors: false }).sections[2].games.map(g => g.id), ["costume"], "no countdown running: no doors tile");
  const later = PL.playSections("2026-11-12", { home: true, knees: false, done: false, doors: true }); assert.equal(later.gate, false); assert.ok(later.sections[0].games.some(g => g.id === "quest"), "after Own it Trick Quest is solo work"); assert.equal(later.sections.length, 3);
  assert.deepEqual(PL.EXTRAS.map(e => e.go), ["openAdvent()", "openCostumes()"]); assert.deepEqual(PL.gamesFor("2026-11-05", { home: true, knees: true, done: false }).games.map(g => g.id), PL.SOLO_GAMES, "the Build 1 gate is unchanged");
  assert.equal(extrasOpen({ pd: false, kind: "home" }), false); assert.equal(extrasOpen({ pd: true, kind: "home" }), true); assert.equal(extrasOpen({ pd: false, kind: "rest" }), true, "a rest day has no plan to finish"); assert.equal(extrasOpen({ pd: false, kind: "memory" }), false);
  const home = src("js/views/home.js"); assert.match(home, /gateExtras\(extrasOpen\(\{pd,kind\}\),!playGate\)/); assert.match(home, /They're on Play too/); assert.ok(html.includes('id="extrasGate"') && html.includes('id="playExtras"') && html.includes('id="playDare"'));
  assert.match(src("js/dares.js"), /\["#dareCard", "#playDare"\]/); assert.match(src("js/buddy.js"), /soloOnly: dayKindNow\(date\) === "home" && !planDone\(rec\)/);
  const ctx = { name: "Sofia", pet: "Bun-Bun", dayDone: false, safe: false, fullDone: false, streak: 2, skips: 2, petDays: 3, comp: null, compMode: false, plan: null, ticks: [], classes: [], restDay: false, cards: [{ id: "trick", sub: "Leap", go: "a", done: false }, { id: "game", sub: "What's Next?", go: "b", done: false }], dare: false, door: false, glow: true, cardsEarned: 3, starsLeft: 2, unlock: "Gold", event: null };
  const keys = new Set(); for (let i = 0; i < 40; i++) keys.add(B.pickStep(ctx, () => i / 40).key); for (const k of keys) assert.ok(["trick", "game"].includes(k), "before the plan is done, never the fun tier: " + k);
  // the pages in the fake DOM: Play's sections (the extras only when today's gate is open), the dare on Play
  resetDom(); clearS(); const { memoryKnees } = await import("../js/season15.js"); const { planDone } = await import("../js/streak.js"); const today = todayStr();
  const { dayKindNow } = await import("../js/daykind.js"); // Build 4: Play's "home" is the kind of day (a class booked on a home weekday is a studio day)
  const gate = PL.gamesFor(today, { home: dayKindNow(today) === "home", knees: memoryKnees(today), done: planDone(S.practice[today]) }).gate;
  PL.renderPlay(); const grid = el("#gameGrid").innerHTML; assert.match(grid, /🌸 Solo work/); assert.equal(/✨ Extras/.test(grid), !gate, "the extras follow the same gate as the weekend games"); assert.equal(/🎉 Weekend games/.test(grid), !gate); assert.equal(el("#playExtras").hidden, gate);
  const DR = await import("../js/dares.js"); DR.renderDares(); assert.equal(el("#playDare").hidden, false); assert.equal(el("#playDare").innerHTML, el("#dareCard").innerHTML, "the same dare card on Play and Today");
  resetDom(); clearS();
});

test("the release's housekeeping: the news edition, the service worker, the README", async () => {
  const { TRY } = await import("../js/news.js"); for (const id of ["sunday", "mom", "remind", "along", "play"]) assert.ok(TRY[id], "Try it for " + id); assert.equal(news.id, "build3-1.48");
  for (const f of ["./js/sunday.js", "./js/momweek.js"]) assert.ok(src("sw.js").includes(`"${f}"`), f);
  assert.match(src("README.md"), /### Build 3 of the Oct 28 review \(1\.48\.0\)/); assert.match(src("js/app.js"), /initSunday\(\)/);
});
