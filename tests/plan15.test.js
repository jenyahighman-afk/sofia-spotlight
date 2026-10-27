// The 15-week plan (data/plan15.json + js/season15.js), one-off studio dates (js/studio.js), the short memory-run day
// and the Memory + knees trick card.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installEnv } from "./_env.mjs";
installEnv();
const json = (f) => JSON.parse(readFileSync(new URL("../data/" + f + ".json", import.meta.url), "utf8"));
const { applyData } = await import("../js/data.js");
applyData({ dances: json("dances"), events: json("events"), classes: json("classes"), "home-days": json("home-days"), "practice-items": json("practice-items"), phases: json("phases"), packs: json("packs"), aerial: json("aerial"), season: json("season"), styles: json("styles"), moves: json("moves"), "avatar-options": json("avatar-options"), oops: json("oops"), trio: json("trio"), compday: json("compday"), sparkle: json("sparkle"), skills: json("skills"), "practice-pool": json("practice-pool"), exercises: json("exercises"), plan15: json("plan15") });
const { weekOf, memoryKnees, trickFocus, checkpoints, weakestTrick } = await import("../js/season15.js");
const { studioOn, isShortDay, nextRehearsal, bookingRecord, isRehearsal } = await import("../js/studio.js");
const { buildPlan, MEMORY_RUN, KNEE_DRILL } = await import("../js/plan.js");
const { trickCard, cardsFor, KNEES } = await import("../js/habit.js");
const { events, studioDates, isStudioDate } = await import("../js/store.js");
const plan = json("plan15"), classes = json("classes"), pool = json("practice-pool");

test("15 weeks, Monday to Sunday from Sep 28; the four phases; the weeks and goals as Jenya set them", () => {
  assert.equal(plan.weeks.length, 15); plan.weeks.forEach((w, i) => { assert.equal(w.w, i + 1); const d = new Date(w.of + "T00:00:00"); assert.equal(d.getDay(), 1, w.of + " is a Monday"); assert.equal(Math.round((d - new Date("2026-09-28T00:00:00")) / 86400000), i * 7); });
  assert.deepEqual(plan.phases.map(p => [p.n, p.from, p.to]), [["Own it", 1, 6], ["Clean it", 7, 9], ["Perform it", 10, 14], ["Taper", 15, 15]]);
  assert.equal(weekOf("2026-10-25").w, 4); assert.equal(weekOf("2026-10-26").w, 5); assert.equal(weekOf("2026-10-26").phase.n, "Own it");
  assert.equal(weekOf("2026-10-26").solo, "Whole solo from memory, on the counts"); assert.match(weekOf("2026-10-28").trio, /no video, by Sat Oct 31/);
  assert.equal(weekOf("2026-11-09").phase.n, "Clean it"); assert.ok(weekOf("2026-11-25").light); assert.equal(weekOf("2026-12-01").phase.n, "Perform it"); assert.equal(weekOf("2027-01-09").w, 15); assert.equal(weekOf("2027-01-09").phase.n, "Taper");
  assert.equal(weekOf("2026-09-27"), null); assert.equal(weekOf("2027-01-11"), null);
  assert.deepEqual(plan.weeks.map(w => w.tricks || []), [[1], [2], [], [], [], [], [1], [6], [], [8], [3, 4], [5], [7], [], []]);
  assert.equal(plan.weeks[13].weakest, true); assert.match(plan.weeks[14].fri, /Nothing new/);
});
test("Memory + knees until Nov 9, then the week's numbered trick(s), rest on the light week, nothing new in the taper", () => {
  assert.equal(memoryKnees("2026-11-08"), true); assert.equal(memoryKnees("2026-11-09"), false);
  assert.deepEqual(trickFocus("2026-10-30"), { kind: "knees" }); assert.deepEqual(trickFocus("2026-10-02"), { kind: "knees" }, "the rule wins over weeks 1–2");
  assert.deepEqual(trickFocus("2026-11-13").ids, ["s-side-sit"]); assert.deepEqual(trickFocus("2026-11-20").ids, ["s-passe-turns"]);
  assert.deepEqual(trickFocus("2026-11-27"), { kind: "rest" }); assert.deepEqual(trickFocus("2026-12-04").ids, ["s-donut"]);
  assert.deepEqual(trickFocus("2026-12-11").ids.sort(), ["s-cartwheel", "s-handstand", "s-leap", "s-walkover-knee"], "tricks 3 + 4");
  assert.deepEqual(trickFocus("2027-01-01"), { kind: "weakest" }); assert.deepEqual(trickFocus("2027-01-07"), { kind: "none" }); assert.equal(trickFocus("2027-02-01"), null);
  assert.equal(weakestTrick({ "s-side-sit": { state: "clean" } }).id, "s-side-ext", "the first numbered trick that isn't clean");
});
test("checkpoints: Oct 31 trio, Nov 1 solo, the next booked solo rehearsal after that, Jan 2, Jan 7, Jan 9", () => {
  const cps = checkpoints("2026-10-26", plan, []); assert.deepEqual(cps.map(c => c.d), ["2026-10-31", "2026-11-01", "2027-01-02", "2027-01-07", "2027-01-09", ""], "no rehearsal booked: undated, last");
  const booked = [bookingRecord("2026-11-04", "3:30–4:00 PM", "Solo rehearsal with Ms. Brittany", "GHD", "r1"), bookingRecord("2026-10-28", "3:30", "Solo rehearsal with Ms. Brittany", "", "r0")];
  const c2 = checkpoints("2026-10-26", plan, booked); assert.deepEqual(c2.find(c => c.rehearsal).d, "2026-11-04", "the first rehearsal after Nov 1, not the Oct 28 one");
  assert.deepEqual(checkpoints("2027-01-08", plan, []).map(c => c.t), ["Winter Showcase ★", "Next solo rehearsal: show Ms. Brittany with no missed steps"]);
});
test("no weekly Wednesday solo rehearsal; the Thu Oct 29 Acro make-up is a one-off studio date, never a show", () => {
  assert.ok(!classes.some(c => /solo rehearsal/i.test(c.name)), "the recurring Wed 3:30 rehearsal is gone");
  const mk = json("events").find(e => e.id === "acro-makeup-1029"); assert.equal(mk.kind, "class"); assert.equal(mk.start, "2026-10-29"); assert.equal(new Date("2026-10-29T00:00:00").getDay(), 4); assert.equal(mk.time, "5:30 PM");
  assert.ok(isStudioDate(mk)); assert.ok(!events().some(e => e.id === "acro-makeup-1029"), "no countdown, no comp mode"); assert.ok(studioDates().some(e => e.id === "acro-makeup-1029"));
  assert.deepEqual(studioOn("2026-10-29", classes, studioDates()).map(c => c.name), ["Acro make-up class"]);
  assert.equal(isShortDay("2026-10-29", classes, studioDates()), true, "Thursday is a home day, but the make-up makes it short");
  assert.equal(isShortDay("2026-10-30", classes, studioDates()), false); assert.equal(isShortDay("2026-10-26", classes, []), true, "a Monday class day");
  const r = bookingRecord("2026-11-04", "3:30–4:00 PM"); assert.equal(r.kind, "class"); assert.ok(isRehearsal(r)); assert.ok(r.id.startsWith("r-")); assert.equal(isShortDay("2026-11-04", [], [r]), true);
  assert.equal(nextRehearsal([r, { ...r, id: "x", start: "2026-11-02", deleted: true }], "2026-11-01").id, r.id, "a cancelled one doesn't count");
});
test("the daily plan: a 15-minute memory run on studio days, the knee block instead of a trick until Nov 9, this week's trick after", () => {
  const base = { pool, date: "2026-10-29", tricks: ["Floor kick (1:40.75): 8 slow kicks.", "Side-sit leg reach (0:10.5): sit."], dances: [{ id: "solo" }, { id: "trio" }] };
  const short = buildPlan({ ...base, short: true }); assert.deepEqual(short.map(i => i.id), MEMORY_RUN.map(i => i.id)); assert.equal(short.reduce((s, i) => s + i.secs, 0), 960, "about 15 minutes (16 with the warm-up)");
  const knees = buildPlan({ ...base, date: "2026-10-30", focus: "knees" }); assert.ok(knees.some(i => i.id === KNEE_DRILL.id)); assert.ok(!knees.some(i => /^trick-/.test(i.id)), "no trick drill");
  const week = buildPlan({ ...base, date: "2026-11-13", focus: ["Side-sit leg reach (0:10.5): sit."] }); assert.ok(week.find(i => i.kind === "trick").text.includes("Side-sit leg reach"));
  assert.ok(!buildPlan({ ...base, date: "2026-11-27", focus: "none" }).some(i => i.kind === "trick"), "light week: no trick");
  assert.ok(buildPlan(base).some(i => /^trick-/.test(i.id)), "without a focus the old rotation stays");
});
test("Today's trick card: Memory + knees (no new tricks yet) until Nov 9, then the week's trick, a picture-it card on light weeks", () => {
  const k = trickCard("2026-10-30", { focus: { kind: "knees" } }); assert.equal(k.title, "Memory + knees"); assert.equal(k.sub, "No new tricks yet"); assert.equal(k.go, "habitKnees()");
  assert.ok(KNEES.items.length >= 4 && KNEES.items.every(i => i.secs > 0 && i.pose)); assert.ok(KNEES.items.some(i => /knees? (go out )?over the toes/.test(i.text)));
  assert.match(trickCard("2026-11-13", { focus: { kind: "trick", ids: ["s-side-sit"] } }).go, /qsPick\('s-side-sit'\)/);
  assert.equal(trickCard("2026-11-27", { focus: { kind: "rest" } }).go, "habitPicture()");
  assert.match(trickCard("2027-01-01", { skills: { "s-side-sit": { state: "checked" } }, focus: { kind: "weakest" } }).go, /s-kneel-arch|s-side-ext/);
  assert.equal(cardsFor("2026-10-30", { focus: { kind: "knees" } })[0].title, "Memory + knees");
});
test("the phases list on Practice matches the plan", () => {
  const ph = json("phases"); assert.deepEqual(ph.slice(0, 4).map(p => [p.n, p.d]), plan.phases.map(p => [p.n, p.d]));
  assert.ok(!JSON.stringify(ph).includes("Oct 18"), "no leftover dates from the old phases");
});
test("Today's dated plan: Thu Oct 29 (Acro make-up 5:30) is the 15-minute memory run, not the full home session", () => {
  const d = json("plan10").days["2026-10-29"]; assert.equal(d.tag, "class"); assert.deepEqual(d.mins, [15, 5]); assert.match(d.classes, /Acro make-up class 5:30 PM/); assert.match(d.label, /15-minute memory run/);
  assert.ok(d.must.some(m => m.go === "player:trio"), "the trio's no-video run before Saturday stays"); assert.ok(!d.must.some(m => /Warm-up 5 min/.test(m.t)));
});

test("required privates: two per routine per month through May 2027, one in June; bookings counted per routine and month", async () => {
  const { privatesRequired, privatesBooked, privatesStatus, routineOf, nextMonth, ROUTINES, privatesHtml } = await import("../js/studio.js");
  assert.equal(privatesRequired("2026-09"), 0); assert.equal(privatesRequired("2026-10"), 2); assert.equal(privatesRequired("2027-05"), 2); assert.equal(privatesRequired("2027-06"), 1); assert.equal(privatesRequired("2027-07"), 0);
  assert.equal(nextMonth("2026-12"), "2027-01"); assert.equal(nextMonth("2026-10"), "2026-11");
  const solo1 = bookingRecord("2026-11-04", "3:30–4:00 PM", "", "GHD", "s1"), solo2 = bookingRecord("2026-11-18", "3:30–4:00 PM", "", "GHD", "s2");
  const trio1 = bookingRecord("2026-11-12", "4:00–4:30 PM", "", "GHD", "t1", "trio"), mk = bookingRecord("2026-11-05", "5:30 PM", "Acro make-up class", "", "m1", "other");
  assert.equal(solo1.dances, "Solo"); assert.equal(solo1.name, "Solo rehearsal with Ms. Brittany", "the solo default keeps the original record"); assert.equal(trio1.dances, "Trio"); assert.equal(trio1.name, "Trio private"); assert.equal(mk.dances, "");
  assert.deepEqual([solo1, trio1, mk].map(routineOf), ["solo", "trio", "other"]);
  assert.equal(routineOf(json("events").find(e => e.id === "acro-makeup-1029")), "other", "the built-in Acro make-up never counts as a private");
  assert.equal(routineOf({ name: "Solo rehearsal with Ms. Brittany", dances: "Solo" }), "solo", "bookings saved before this release count as solo privates");
  const list = [solo1, solo2, trio1, mk, { ...solo2, id: "s3", deleted: true }, { ...solo1, id: "s0", start: "2026-10-28" }];
  assert.equal(privatesBooked(list, "2026-11", "solo"), 2, "a cancelled one doesn't count"); assert.equal(privatesBooked(list, "2026-11", "trio"), 1); assert.equal(privatesBooked(list, "2026-10", "solo"), 1);
  assert.deepEqual(privatesStatus(list, "2026-11").map(s => [s.label, s.have, s.need, s.short]), [["Solo", 2, 2, false], ["Trio", 1, 2, true]]);
  assert.equal(nextRehearsal([trio1], "2026-11-01"), null, "a trio private is not the solo rehearsal a checkpoint waits for");
  const h = privatesHtml("2026-11", list); assert.ok(h.includes("November") && h.includes("December") && h.includes("✓ Solo 2/2") && h.includes("Trio 1/2"), h);
  assert.equal(privatesHtml("2027-08", list), "", "nothing after June 2027"); assert.ok(privatesHtml("2027-06", []).includes("Solo 0/1"));
  assert.deepEqual(Object.keys(ROUTINES), ["solo", "trio", "other"]);
});
