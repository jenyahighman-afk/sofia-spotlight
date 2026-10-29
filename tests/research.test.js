// The practice rules from the research Jenya approved on Oct 26 (data/plan15.json `rules`): the show in her head from Nov 9,
// short self-chosen clips in weeks 1–9, the Sunday review, one full-out a session from Nov 9 and back-to-back on Sundays
// from Nov 30, the taper from Dec 28, the night before the show, light weeks, a teacher's new note right away, one fix
// at a time until it shows on two videos in a row, mini audiences and the stage tape, and never 2 days without dancing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installEnv } from "./_env.mjs";
installEnv();
const json = (f) => JSON.parse(readFileSync(new URL("../data/" + f + ".json", import.meta.url), "utf8"));
const { applyData } = await import("../js/data.js");
applyData({ dances: json("dances"), events: json("events"), classes: json("classes"), "home-days": json("home-days"), "practice-items": json("practice-items"), phases: json("phases"), packs: json("packs"), aerial: json("aerial"), season: json("season"), styles: json("styles"), moves: json("moves"), "avatar-options": json("avatar-options"), oops: json("oops"), trio: json("trio"), compday: json("compday"), sparkle: json("sparkle"), skills: json("skills"), "practice-pool": json("practice-pool"), exercises: json("exercises"), plan15: json("plan15") });
const { sessionRules, daysSinceDance, weekOf } = await import("../js/season15.js");
const { buildPlan } = await import("../js/plan.js");
const { newTeacherNotes, markSeen, seenCount, fixOnVideo, FIX_SEEN_TO_MOVE } = await import("../js/corrections.js");
const { S, migrateDoc, SCHEMA_VERSION } = await import("../js/store.js");
const pool = json("practice-pool"), plan = json("plan15");
const base = { pool, tricks: ["Floor kick (1:40.75): 8 slow kicks."], dances: [{ id: "solo" }, { id: "trio" }] };

test("the show in her head: from Nov 9, inside the home session, a 7-step script; a grown-up reads it the first two weeks; bedtime stays optional", () => {
  assert.equal(sessionRules("2026-11-08").imagery, null, "not before the solo is memorized");
  const im = sessionRules("2026-11-13").imagery; assert.equal(im.title, "Show in your head (6 min)", "the 🧠 is the group icon"); assert.equal(im.secs, 360);
  assert.match(im.how, /1\. Stand in your opening pose/); assert.match(im.how, /7\. Do it 2–3 times/); assert.match(im.how, /grown-up reads/); assert.match(im.how, /bedtime is extra and optional/);
  assert.ok(!sessionRules("2026-12-04").imagery.how.includes("grown-up reads"), "after two weeks she does it herself");
  const items = buildPlan({ ...base, date: "2026-11-13", session: sessionRules("2026-11-13") }); const it = items.find(i => i.id === "imagery"); assert.equal(it.kind, "mind"); assert.ok(it.how.length > 100);
});
test("video: weeks 1–9 a short self-chosen clip each home session, a Sunday review with a grown-up (what went well first), one happy review in the taper", () => {
  assert.match(sessionRules("2026-10-30").clips.text, /Film one chunk, watch it when you want/); assert.ok(sessionRules("2026-11-29").clips); assert.equal(sessionRules("2026-11-30").clips, null);
  assert.equal(sessionRules("2026-10-30").review, null, "Friday: no review"); assert.match(sessionRules("2026-11-01").review.text, /what went well first, then ONE fix/);
  assert.match(sessionRules("2027-01-03").review.text, /at most one happy review/);
  const sun = buildPlan({ ...base, date: "2026-11-01", session: sessionRules("2026-11-01") }); assert.ok(sun.some(i => i.id === "film-review") && sun.some(i => i.id === "film-chunk"));
});
test("full-outs: from the top as far as she knows until Nov 9, then one full-out a session, back-to-back on Sundays from Nov 30 (not in the taper)", () => {
  assert.match(sessionRules("2026-10-30").run.text, /as far as you know/); assert.match(sessionRules("2026-11-13").run.text, /ONE full-out/);
  assert.match(sessionRules("2026-12-06").run.text, /Back-to-back/); assert.equal(sessionRules("2026-12-06").run.secs, 480); assert.match(sessionRules("2026-12-04").run.text, /ONE full-out/, "Fridays stay one");
  assert.match(sessionRules("2027-01-03").run.text, /ONE full-out/, "taper Sunday: one, not two");
  const run = buildPlan({ ...base, date: "2026-12-06", session: sessionRules("2026-12-06") }).find(i => i.id === "solo-run"); assert.match(run.text, /Back-to-back/); assert.equal(run.secs, 480);
});
test("taper from Dec 28: fewer exercises (one core, one legs, one technique) and still one full-out; the night before the show is the memory run, no full-out", () => {
  const count = (items, k) => items.filter(i => i.kind === k).length;
  const before = buildPlan({ ...base, date: "2026-12-25", session: sessionRules("2026-12-25") }), taper = buildPlan({ ...base, date: "2027-01-01", session: sessionRules("2027-01-01") });
  assert.equal(sessionRules("2026-12-27").taper, false); assert.equal(sessionRules("2026-12-28").taper, true);
  for (const k of ["core", "legs", "tech"]) { assert.ok(count(before, k) >= 2, k); assert.equal(count(taper, k), 1, k); }
  assert.match(taper.find(i => i.id === "solo-run").text, /ONE full-out/);
  const night = sessionRules("2027-01-07"); assert.equal(night.short, true); assert.equal(night.nightBefore, true);
  const mr = buildPlan({ ...base, date: "2027-01-07", short: true, nightBefore: true, session: night }); assert.match(mr.find(i => i.id === "mem-top").text, /no full-out tonight/); assert.ok(!mr.some(i => /full out/i.test(i.text) && !/no full-out/.test(i.text)));
});
test("a light week (Thanksgiving, Nov 23) is the memory run, not strength and stretching", () => {
  for (const d of ["2026-11-23", "2026-11-26", "2026-11-29"]) assert.equal(sessionRules(d).short, true, d); assert.equal(sessionRules("2026-11-30").short, false);
});
test("a teacher's new note goes into the plan right away (last 7 days, open, not Mom / Sofia / the AI coach / a pinned note)", () => {
  const c = { a: { id: "a", danceId: "solo", text: "Spot the corner on the turns", source: "Ms. Brittany", date: "2026-10-24", status: "working", tag: "eyes" },
    b: { id: "b", danceId: "trio", text: "Match the arms", source: "Larisa", date: "2026-10-12", status: "working", tag: "arms" },
    m: { id: "m", danceId: "solo", text: "Smile", source: "Mom", date: "2026-10-25", status: "working" }, ai: { id: "ai", text: "Point", source: "AI coach (ask Ms. Brittany)", date: "2026-10-25", status: "working" },
    p: { id: "p", text: "Knees over toes", source: "Ms. Brittany", date: "2026-10-24", status: "working", pinned: true }, d: { id: "d", text: "Old", source: "Hannah", date: "2026-10-23", status: "done" } };
  const n = newTeacherNotes(c, "2026-10-26"); assert.deepEqual(n.map(x => x.id), ["a"]);
  const items = buildPlan({ ...base, date: "2026-10-30", newNotes: n }); assert.equal(items.find(i => i.id === "new-a").text, "New from Ms. Brittany: Spot the corner on the turns");
  assert.ok(!buildPlan({ ...base, date: "2026-10-30", newNotes: n, weekFix: { id: "a", text: "Spot", tag: "eyes" } }).some(i => i.id === "new-a"), "not twice when it is already the week's fix");
});
test("one fix at a time: it moves on once it shows on two videos in a row; 'Not yet' starts again; a pinned teacher note waits for her", async () => {
  let s = markSeen({}, "x", "2026-11-01", true); s = markSeen(s, "x", "2026-11-01", true); assert.equal(seenCount(s, "x"), 1, "once a day");
  s = markSeen(s, "x", "2026-11-02", false); assert.equal(seenCount(s, "x"), 0); s = markSeen(s, "x", "2026-11-03", true); s = markSeen(s, "x", "2026-11-05", true); assert.equal(seenCount(s, "x"), FIX_SEEN_TO_MOVE);
  S.settings = {}; S.corrections = { f1: { id: "f1", danceId: "solo", text: "Long arms", tag: "arms", date: "2026-10-01", status: "working" }, f2: { id: "f2", danceId: "solo", text: "Eyes up", tag: "eyes", date: "2026-10-02", status: "working" },
    pin: { id: "pin", danceId: "solo", text: "Knees over toes", tag: "knees", date: "2026-10-13", status: "working", pinned: true, source: "Ms. Brittany" } };
  assert.deepEqual(await fixOnVideo("pin", true, "2026-11-01"), { count: 1 }); assert.deepEqual(await fixOnVideo("pin", true, "2026-11-08"), { count: 2, ask: true }); assert.equal(S.corrections.pin.status, "working", "she checks it off");
  S.corrections.pin = { ...S.corrections.pin, status: "done" };
  await fixOnVideo("f1", true, "2026-11-15"); const r = await fixOnVideo("f1", true, "2026-11-22"); assert.equal(S.corrections.f1.status, "done"); assert.equal(r.moved.id, "f2", "straight on to the next fix"); assert.equal(S.settings.weekFix.id, "f2"); assert.equal("f1" in S.settings.fixSeen, false);
  S.settings = {}; S.corrections = {};
});
test("never more than 2 days without the solo: days since the plan was last done (a game or a dare doesn't reset the clock)", () => {
  const p = { "2026-10-20": { bites: ["memo"] }, "2026-10-22": { done: [], runs: [] }, "2026-10-23": { bites: ["plan"] }, "2026-10-24": { bites: ["game", "dare"] } };
  assert.equal(daysSinceDance(p, "2026-10-23"), 0); assert.equal(daysSinceDance(p, "2026-10-24"), 1); assert.equal(daysSinceDance(p, "2026-10-25"), 2); assert.equal(daysSinceDance({}, "2026-10-25"), Infinity);
  assert.equal(plan.rules.maxGap, 2);
});
test("mini audiences in weeks 10–14, the stage tape once, sleep in the last two weeks; the phase texts say the new rules", () => {
  const ex = (d) => weekOf(d).extra || ""; assert.match(ex("2026-12-01"), /Mini audience #1/); assert.match(ex("2026-12-15"), /Tape out the stage size/); assert.match(ex("2026-12-15"), /Mini audience #2/); assert.match(ex("2026-12-22"), /Mini audience #3/);
  assert.match(ex("2026-12-29"), /Sleep 9–12 hours/); assert.match(ex("2027-01-05"), /the night before/); assert.equal(ex("2026-11-02"), "");
  const g = Object.fromEntries(plan.phases.map(p => [p.n, p.g])); assert.match(g["Own it"], /teacher's new correction right away/); assert.match(g["Clean it"], /two videos in a row/); assert.match(g["Perform it"], /one full-out every session/); assert.match(g["Taper"], /Night before the show/);
  assert.match(json("phases").find(p => p.n === "Clean it").g, /two videos in a row/);
});
test("schema 42: settings.fixSeen keeps real dates only, the last two, sorted", () => {
  const d = migrateDoc("settings", "main", { _v: 41, fixSeen: { a: ["2026-11-05", "x", "2026-11-01", "2026-11-03", "2026-11-03"], "bad key!": ["2026-11-01"], b: "nope" } });
  assert.deepEqual(d.fixSeen, { a: ["2026-11-03", "2026-11-05"], b: [] }); assert.equal(d._v, SCHEMA_VERSION); assert.equal("fixSeen" in migrateDoc("settings", "main", { _v: 41 }), false);
});
test("the printed Practice Toolkit (tools/print source → files/) carries the same rules", () => {
  const html = readFileSync(new URL("../tools/print/Sofia-Practice-Toolkit.html", import.meta.url), "utf8");
  for (const s of ["two videos in a row", "Show in your head", "Stand in your opening pose", "never let it push bedtime later", "one full-out", "two back to back on Sundays", "Night before: memory run only", "tape out the stage size", "mini audience #3", "Sleep 9–12 hours", "practise it right away", "Never more than 2 days without the solo", "Heel stretch", "0:48–2:04 from memory", "head ALL the way back. Don't tuck the chin"]) assert.ok(html.includes(s), s);
  assert.ok(!/ONE SHOULDER|chin tucked/i.test(html), "Hannah's donut roll, not over the shoulder");
  assert.ok(!/<img|https?:\/\/fonts\./.test(html), "no pictures, no web font: prints the same every time");
  const man = JSON.parse(readFileSync(new URL("../seed-data/manifest.json", import.meta.url), "utf8")).files.find(f => f.name === "Sofia-Practice-Toolkit.pdf");
  assert.equal(man.size, readFileSync(new URL("../files/Sofia-Practice-Toolkit.pdf", import.meta.url)).length, "the manifest knows the new copy");
});
test("Sofia's Backstage Pass (tools/print source → files/) is a printable added to My files, with meat-free food and the plan's rules", () => {
  const html = readFileSync(new URL("../tools/print/Sofia-Backstage-Pass.html", import.meta.url), "utf8");
  for (const s of ["App = TODAY", "Toolkit = HOW", "Workbook = EVERYTHING ELSE", "Start here", "My plan", "My dances", "Show time", "two videos in a row", "Never more than 2 days without your solo", "9–12", "Screens off 1 hour before bed", "Acro on the mat or with a spotter", "Never skip a meal"]) assert.ok(html.includes(s), s);
  assert.ok(!/\b(chicken|turkey|beef|pork|ham|bacon|sausage|jerky)\b/i.test(html), "Sofia is pescatarian: no meat in the food ideas");
  assert.ok(!/Wed(nesday)?s? 3:30/.test(html), "no Wednesday rehearsal");
  const man = JSON.parse(readFileSync(new URL("../seed-data/manifest.json", import.meta.url), "utf8")).files.find(f => f.name === "Sofia-Backstage-Pass.pdf");
  assert.ok(man && man.since, "added once to families that don't have it");
  assert.equal(man.size, readFileSync(new URL("../files/Sofia-Backstage-Pass.pdf", import.meta.url)).length, "the manifest knows this copy");
});
