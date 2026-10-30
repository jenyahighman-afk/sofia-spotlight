// Date sweep: the app's date-triggered switches (Halloween → Fall on Nov 1, the Nov 9 gate on Trick Quest and the aerial
// items, Fall → Christmas, the show week) rendered end to end with the clock faked on each day, with an empty family space
// and with a plan-done day. Nothing may throw, Today always has its one card and one button, and the theme and the Nov 9
// gate flip on the right day. The pure rules have their own tests; this one catches a render that breaks only on a date.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installEnv, resetDom, el } from "./_env.mjs";
installEnv();
const read = (rel) => readFileSync(new URL("../" + rel, import.meta.url), "utf8");
const RealDate = Date;
const setNow = (iso) => { const t = new RealDate(iso + "T12:00:00").getTime(); globalThis.Date = class extends RealDate { constructor(...a) { if (a.length === 0) super(t); else super(...a); } static now() { return t; } }; };
const addDays = (iso, n) => { const d = new RealDate(iso + "T12:00:00"); d.setDate(d.getDate() + n); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const range = (a, n) => Array.from({ length: n }, (_, i) => addDays(a, i));
const DAYS = [...range("2026-10-29", 15), ...range("2026-11-25", 9), ...range("2027-01-04", 7)];

let M = {};
before(async () => {
  const data = await import("../js/data.js"); const got = {}; for (const f of data.DATA_FILES) got[f] = JSON.parse(read("data/" + f + ".json")); data.applyData(got);
  M.store = await import("../js/store.js"); M.util = await import("../js/util.js"); M.season15 = await import("../js/season15.js"); M.seasons = await import("../js/seasons.js"); M.planToday = await import("../js/planToday.js");
  M.home = await import("../js/views/home.js"); M.practice = await import("../js/views/practice.js"); M.play = await import("../js/views/play.js"); M.me = await import("../js/views/me.js");
  M.schedule = await import("../js/views/schedule.js"); M.dances = await import("../js/views/dances.js"); M.coachhub = await import("../js/coachhub.js"); M.daykind = await import("../js/daykind.js");
});

test("every day of the switch windows renders Today, Practice, Play, Me, the dances and the week with nothing thrown", () => {
  try {
    for (const day of DAYS) {
      setNow(day);
      for (const state of ["empty", "planDone"]) {
        resetDom(); for (const k of Object.keys(M.store.S)) M.store.S[k] = {};
        if (state === "planDone") { const plan = M.planToday.planFor(day); M.store.S.practice = { [day]: { done: plan.map(i => i.id), total: plan.length, runs: [{ at: day, speed: 100, full: true }] } }; }
        const screens = { home: M.home.renderHome, practice: M.practice.renderPractice, play: M.play.renderPlay, me: M.me.renderMe, dances: M.dances.renderDances, schedule: () => { M.schedule.renderClasses(); M.schedule.renderCalendar(); }, coach: M.coachhub.renderCoachHub };
        for (const [name, render] of Object.entries(screens)) assert.doesNotThrow(render, `${day} ${state}: ${name}`);
        const tc = el("#todayCard").innerHTML; assert.ok(tc.includes("today-start") || tc.includes("Practice done") || tc.includes("✅"), `${day} ${state}: Today's card has its button`);
      }
    }
  } finally { globalThis.Date = RealDate; }
});

test("the theme flips Halloween → Fall on Nov 1 and Fall → Christmas on Dec 1; Trick Quest opens on Nov 9, never before", () => {
  try {
    const theme = (d) => { setNow(d); return M.seasons.seasonNow(d); };
    assert.equal(theme("2026-10-31"), "halloween"); assert.equal(theme("2026-11-01"), "fall"); assert.equal(theme("2026-11-29"), "fall"); assert.equal(theme("2026-11-30"), "", "the Monday after the fall week is a plain day, by design"); assert.equal(theme("2026-12-01"), "christmas");
    for (const d of range("2026-11-02", 7)) { setNow(d); assert.equal(M.season15.memoryKnees(d), true, d + " still Memory + knees"); assert.equal(M.coachhub.questOpen(d, { home: false, done: true }), false, d + " Trick Quest waits"); }
    setNow("2026-11-09"); assert.equal(M.season15.memoryKnees("2026-11-09"), false); assert.equal(M.coachhub.questOpen("2026-11-09", { home: false, done: true }), true, "Nov 9 opens it");
  } finally { globalThis.Date = RealDate; }
});
