// 1.59.0: the phone reminders follow the exact dates (the app's own answer for the day), the studio's later closures, and the
// optional morning line. Every date here is fixed; the morning line takes its clock as an argument.
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
const RM = await import("../js/remind.js");
const { studioOn } = await import("../js/studio.js");
const { dayKind, dayOpts } = await import("../js/daykind.js");
const { morningLine } = await import("../js/views/home.js");
const W = await import("../worker/src/remind-core.js");

const WEEK = { days: [0, 1, 2, 3, 4, 5, 6], kinds: { 0: "home", 1: "watch", 2: "memory", 3: "memory", 4: "home", 5: "home", 6: "memory" } };
const dates = () => RM.planDates(WEEK, "2026-11-01", 150);

test("the dates that differ from the weekday: closures, the light week, the night before, show day; an ordinary week has none", () => {
  S.events = {}; S.practice = {}; const d = dates();
  for (const x of ["2026-11-26", "2026-11-27", "2026-11-29"]) assert.equal(d[x], "memory", x + ": Thanksgiving's home days are the light week's memory run");
  for (const x of ["2026-12-21", "2026-12-22", "2026-12-23", "2026-12-26", "2026-12-28", "2026-12-30"]) assert.equal(d[x], "home", x + ": Winter Break's class days are full home days");
  assert.equal(d["2027-01-07"], "memory", "the night before the show"); assert.equal(d["2027-01-08"], "off", "show day: no practice nudge");
  for (const x of ["2026-11-02", "2026-11-03", "2026-11-05", "2026-11-07", "2026-12-15"]) assert.equal(x in d, false, x + " is its weekday's usual kind");
  assert.equal(d["2027-02-15"], "home", "the Mid-Winter closure's Monday");
});

test("a booked studio date on a home day is the memory run; un-picking it takes the date off the list", () => {
  S.events = { "sdt-showing-1206": { chosen: true }, "sdt-showing-1212": { chosen: false } };
  assert.equal(dates()["2026-12-06"], "memory", "the picked showing, a Sunday");
  S.events = {}; assert.equal("2026-12-06" in dates(), false);
});

test("the phone tells the worker the dates, and a change re-sends them", () => {
  S.events = {}; const base = { familyId: "F", endpoint: "e", keys: {}, tz: "America/Los_Angeles", plan: WEEK };
  const r = { h: 16, m: 30, second: true, h2: 18, m2: 30 };
  assert.deepEqual(RM.subscribeBody(r, { ...base, dates: { "2027-01-08": "off" } }).dates, { "2027-01-08": "off" });
  assert.equal("dates" in RM.subscribeBody(r, { ...base, dates: {} }), false, "nothing to say: no field");
  assert.notEqual(RM.sentSig(r, WEEK, { "2027-01-08": "off" }), RM.sentSig(r, WEEK, {}));
  assert.equal(RM.reminderKind("2027-01-08", () => "show", () => ""), "off"); assert.equal(RM.reminderKind("2026-11-05", () => "home", () => "memory"), "memory");
  assert.equal(RM.reminderKind("2026-11-05", () => "rest", () => ""), "off"); assert.equal(RM.reminderKind("2026-11-02", () => "watch", () => "watch"), "watch");
});

test("the worker: a date wins over the weekday, for the line, the last call and whether to send at all", () => {
  const sub = { familyId: "F", endpoint: "e", h: 16, m: 30, h2: 18, m2: 30, tz: "America/Los_Angeles", days: [1, 2, 3, 6], kinds: WEEK.kinds, dates: { "2026-12-21": "home", "2027-01-08": "off", "2026-11-26": "memory", "2026-12-24": "home" } };
  const at = (iso) => new Date(iso);
  // Mon Dec 21, closed: the usual watch day gets the home line and the 6:30 last call.
  assert.equal(W.kindOn(sub, "2026-12-21"), "home"); assert.equal(W.dueSlot(sub, at("2026-12-22T00:35:00Z")).slot, 1); assert.equal(W.dueSlot(sub, at("2026-12-22T02:35:00Z")).slot, 2);
  assert.match(JSON.parse(W.payloadFor(sub, "2026-12-21")).title, /Home practice/);
  // An ordinary Monday stays the watch day, with no last call.
  assert.equal(W.kindOn(sub, "2026-12-14"), "watch"); assert.equal(W.dueSlot(sub, at("2026-12-15T02:35:00Z")), null);
  // Show day (Fri Jan 8): nothing at either time.
  assert.equal(W.dueSlot(sub, at("2027-01-09T00:35:00Z")), null); assert.equal(W.dueSlot(sub, at("2027-01-09T02:35:00Z")), null);
  // A date on a weekday outside `days` still fires (Thu Dec 24: a home date; Thu isn't in this subscription's days).
  assert.equal(W.dueSlot(sub, at("2026-12-25T00:35:00Z")).slot, 1); assert.equal(W.dueSlot(sub, at("2026-12-18T00:35:00Z")), null, "an ordinary Thursday outside `days`");
  // A light-week home day: the memory line, no last call.
  assert.match(JSON.parse(W.payloadFor(sub, "2026-11-26")).title, /Memory run/); assert.equal(W.dueSlot({ ...sub, days: undefined }, at("2026-11-27T02:35:00Z")), null);
  assert.doesNotMatch(JSON.stringify(W.KIND_LINES), /15 min/);
});

test("the worker keeps good dates and drops bad ones; an older subscription works as before", () => {
  const keys = { p256dh: "a".repeat(87), auth: "b".repeat(22) };
  const body = { familyId: "A".repeat(24), endpoint: "https://push.example/abcdefghij", keys, h: 16, m: 30, dates: { "2027-01-08": "off", "2026-12-21": "home", "nope": "home", "2026-12-22": "party", "constructor": "off" } };
  assert.deepEqual(W.validateSubscribe(body).sub.dates, { "2027-01-08": "off", "2026-12-21": "home" });
  assert.equal("dates" in W.validateSubscribe({ ...body, dates: ["2027-01-08"] }).sub, false);
  assert.equal(W.kindOn({ kinds: { 1: "watch" } }, "2026-12-21"), "watch"); assert.equal(W.kindOn({}, "2026-12-21"), undefined);
});

test("the studio's later closures: calendar-only, no classes, her class days are home days", () => {
  S.events = {}; const ids = ST.calendarOnly().map(e => e.id);
  for (const id of ["closed-midwinter", "closed-spring", "closed-july", "closed-labor"]) assert.ok(ids.includes(id), id); assert.ok(!ST.events().some(e => e.kind === "closed"), "never a show or a countdown");
  for (const d of ["2027-02-16", "2027-04-13", "2027-06-29", "2027-08-31"]) assert.equal(studioOn(d, got.classes, [], ST.closures()).length, 0, d + ": a Tuesday with no classes");
  assert.equal(dayKind("2027-02-16", dayOpts()), "home"); assert.equal(dayKind("2027-04-13", dayOpts()), "home"); assert.notEqual(dayKind("2027-02-23", dayOpts()), "home", "back the next Tuesday");
  assert.ok(json("events").some(e => e.id === "ryze"), "the comp inside the closure stays on the calendar");
});

test("the morning line: school mornings only, gone at noon, on show day and once the plan is done; it ticks nothing", () => {
  const m = { hour: 7, wd: 2, kind: "memory", pd: false };
  assert.match(morningLine(m), /After breakfast: listen once, picture your solo\. 5 min, no stretching/); assert.match(morningLine(m), /openPlayer\('solo'\)/);
  assert.equal(morningLine({ ...m, hour: 12 }), ""); assert.equal(morningLine({ ...m, hour: 4 }), ""); assert.equal(morningLine({ ...m, wd: 6 }), ""); assert.equal(morningLine({ ...m, wd: 0 }), "");
  assert.equal(morningLine({ ...m, kind: "show" }), ""); assert.equal(morningLine({ ...m, pd: true }), "");
  assert.match(src("js/views/home.js"), /\$\{gapLine\}\$\{morningLine\(\{hour:new Date\(\)\.getHours\(\),wd:dow,kind,pd\}\)\}/);
  assert.doesNotMatch(morningLine(m), /practiceTick|markDone/, "nothing on the plan");
});

test("the studio's Nov 1 schedule: PITCH's extra Sunday is a studio date and the memory run; the showings carry their times", () => {
  S.events = {}; const ev = json("events"); const by = (id) => ev.find(e => e.id === id);
  assert.equal(by("pitch-jazz-1108").time, "10:00–12:00"); assert.equal(by("sdt-showing-1206").time, "10:15–12:15"); assert.equal(by("sdt-showing-1212").time, "3:30–6:30"); assert.equal(by("grp-showing-1205").time, "3:30–7:00");
  assert.equal(dayKind("2026-11-08", dayOpts()), "memory", "Sunday Nov 8 is a studio day"); assert.equal(dates()["2026-11-08"], "memory", "the reminder says so");
  assert.ok(!ST.events().some(e => e.id === "pitch-jazz-1108"), "never a show or a countdown");
});

test("a picked showing never touches the countdown: neither date is a show, whichever way the pair is settled", () => {
  for (const pick of [{ "sdt-showing-1206": { chosen: true }, "sdt-showing-1212": { chosen: false } }, { "sdt-showing-1206": { chosen: false }, "sdt-showing-1212": { chosen: true } }, { "sdt-showing-1206": { chosen: false }, "sdt-showing-1212": { chosen: false } }]) {
    S.events = pick; assert.ok(!ST.events().some(e => /showing/.test(e.id)), JSON.stringify(pick)); assert.ok(!ST.nextEvent() || !/showing/i.test(ST.nextEvent().name));
    assert.equal(ST.events().find(e => e.id === "wf").start, "2027-01-08", "the Winter Showcase stays a show");
  }
  S.events = {};
});
