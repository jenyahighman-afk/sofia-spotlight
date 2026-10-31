// 1.56.0 (Jenya, Oct 30): solo first on every home day all season, "but she also needs time to work on memorizing and
// practicing her trio" (the week's trio goal in the plan, two minutes of trio in the memory run, Memorize taking turns, Play's
// games waiting for the trio too), the best time to practise (a snack, then about 45 minutes later, dinner after) and the
// 6:30 pm last call; plus the re-audit's three before-Fall fixes. Every date here is fixed; nothing reads the clock's weekday.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installEnv } from "./_env.mjs";
installEnv();
const json = (f) => JSON.parse(readFileSync(new URL("../data/" + f + ".json", import.meta.url), "utf8"));
const src = (f) => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const { applyData, DATA_FILES } = await import("../js/data.js");
const got = {}; for (const f of DATA_FILES) got[f] = json(f); applyData(got);
const { TRIO_ITEMS, trioDone, gateOpen, planDone } = await import("../js/streak.js");
const { gamesFor } = await import("../js/views/play.js");
const { buildPlan, MEMORY_TRIO, planSummary } = await import("../js/plan.js");
const { sessionRules } = await import("../js/season15.js");
const { todayPick } = await import("../js/memo.js");
const { funLink, BEST_TIME } = await import("../js/views/home.js");
const RM = await import("../js/remind.js");
const ST = await import("../js/store.js");
const W = await import("../worker/src/remind-core.js");
const pool = json("practice-pool");
const dances = [{ id: "solo" }, { id: "trio" }];

test("the gate: every home day of the season, until the solo and today's trio item are done; Trick Quest stays with the solo work", () => {
  for (const d of ["2026-11-05", "2026-11-12", "2026-12-10", "2027-02-04"]) assert.equal(gamesFor(d, { home: true, knees: false, done: false }).gate, true, d);
  assert.equal(gamesFor("2026-11-12", { home: false, done: false }).gate, false, "a studio day is never gated");
  const items = [{ id: "solo-run" }, { id: "trio-mark" }];
  assert.equal(gateOpen({ done: ["solo-run"] }, items), false, "the solo alone isn't enough when the plan has a trio item"); assert.equal(planDone({ done: ["solo-run"] }), true, "…but ⭐ Plan done (the streak, the reminders) is still the solo");
  assert.equal(gateOpen({ done: ["solo-run", "trio-mark"] }, items), true); assert.equal(gateOpen({ done: ["solo-run"] }, [{ id: "solo-run" }]), true, "no trio item today: the solo opens it");
  assert.equal(gateOpen({ done: ["trio-mark"] }, items), false, "the trio alone doesn't either");
  assert.deepEqual(TRIO_ITEMS, ["trio-mark", "mem-trio"]);
  assert.ok(trioDone({ runs: [{ danceId: "trio" }] }), "a trio run from the player"); assert.ok(!trioDone({ runs: [{ danceId: "solo" }] }));
  assert.ok(trioDone({ memo: { trio: ["story", "mark", "count", "test", "picture"] } }), "all five Memorize steps"); assert.ok(!trioDone({ memo: { trio: ["story", "mark"] } })); assert.ok(!trioDone(null));
  const play = src("js/views/play.js"); assert.match(play, /done: gateOpen\(rec, planFor\(today\)\)/); assert.match(play, /Now your trio 👯/); assert.match(play, /the solo and the trio first/);
  assert.match(funLink({ pd: true, kind: "home", trio: true }), /Now your trio 👯/); assert.match(funLink({ pd: true, kind: "home" }), /Pick something fun on Play/);
  const pass = JSON.stringify(json("pass")); assert.match(pass, /the solo and the trio come first/); assert.doesNotMatch(pass, /the solo comes first/);
});

test("the trio's time: the week's trio goal on a full day, two minutes of trio in the memory run, its chunks one tap away", () => {
  const ses = sessionRules("2026-11-05"); assert.match(ses.trio.text, /^👯 Trio · this week: 0:22 stillness: one shared focus · then the whole trio once with the music$/); assert.equal(ses.trio.secs, 240);
  const full = buildPlan({ pool, date: "2026-11-05", dances, session: ses }); const t = full.find(i => i.id === "trio-mark"); assert.equal(t.text, ses.trio.text); assert.equal(t.secs, 240); assert.equal(t.kind, "run");
  assert.equal(buildPlan({ pool, date: "2026-11-05", dances }).find(i => i.id === "trio-mark").text, "Trio: mark it once", "outside the plan's weeks: the pool's own line");
  const run = buildPlan({ pool, date: "2026-11-03", dances, short: "memory" }); assert.deepEqual(run.map(i => i.id), ["mem-warm", "mem-top", "mem-chunk", "mem-trio", "mem-predict", "mem-picture"]);
  assert.deepEqual(run.find(i => i.id === "mem-trio"), MEMORY_TRIO); assert.equal(MEMORY_TRIO.secs, 120); assert.equal(MEMORY_TRIO.dance, "trio");
  assert.ok(!buildPlan({ pool, date: "2026-11-03", dances: [{ id: "solo" }], short: "memory" }).some(i => i.id === "mem-trio"), "no trio dance: no trio item");
  assert.ok(!buildPlan({ pool, date: "2026-11-02", dances, short: "watch" }).some(i => i.id === "mem-trio"), "Monday stays no dancing");
  assert.match(planSummary(run), /trio/);
});

test("Memorize takes turns: the solo one day, the trio the next, until every chunk of both is known", () => {
  const solo = { id: "solo", name: "Solo", cues: [{ t: 0, move: "a" }], loops: [{ n: "Soft half", a: 0, b: 10 }], checkpoints: [{ d: "2026-11-01", text: "x" }] };
  const trio = { id: "trio", name: "Trio", cues: [{ t: 0, move: "a" }], loops: [{ n: "Opening + floor", a: 0, b: 10 }], checkpoints: [{ d: "2026-10-31", text: "y" }] };
  const days = ["2026-10-31", "2026-11-01", "2026-11-02", "2026-11-03"].map(d => todayPick([solo, trio], {}, d).dance.id); assert.deepEqual(days, ["trio", "solo", "trio", "solo"]);
  assert.equal(todayPick([solo, trio], { memo: { solo: { known: ["Soft half"], tested: {} } } }, "2026-11-01").dance.id, "trio", "the solo all known: the trio every day");
  const home = src("js/views/home.js"); assert.match(home, /onclick="\$\{memoGo\}">🧠 Memorize</, "Today's 🧠 Memorize opens the dance whose turn it is");
  assert.match(home, /isCueTable\(mp\.dance\.cues\)\?`openMemorize\('\$\{mp\.dance\.id\}','chunks'\)`:`showPage\('dances'\);memoFocus\('\$\{mp\.dance\.id\}'\)`/, "the sheet for a cue table, the Five steps on Dances otherwise (the trio)");
});

test("the best time: a snack, then about 45 minutes later, dinner after; on Today on a home day until the plan is done, and in the Pass", () => {
  assert.equal(BEST_TIME, "🍌 Snack first, dance 45 min later, dinner after");
  assert.match(src("js/views/home.js"), /\$\{pd\?"":`<div class="today-sub today-when">\$\{BEST_TIME\}<\/div>`\}/);
  const pass = json("pass"); assert.ok(JSON.stringify(pass).includes("Best time on a home day: a small snack after school, dance about 45 minutes later, dinner after."));
  assert.ok(pass.tips.some(t => t.when.includes("home") && /45 min later/.test(t.t)), "a home-day tip");
  assert.match(src("tools/print/Sofia-Backstage-Pass.html"), /<b>Best time on a home day:<\/b>/, "the paper Pass says it too (next print)");
});

test("the 6:30 pm last call: the default, old default times moved by schema 53 (a family's own time stays), a phone re-sends changed times once", () => {
  assert.deepEqual(RM.DEFAULT_SECOND, { h: 18, m: 30 });
  assert.ok(ST.SCHEMA_VERSION >= 53); assert.equal(typeof ST.MIGRATIONS[53], "function");
  const mig = (reminder) => ST.migrateDoc("settings", "main", { _v: 52, reminder }).reminder;
  assert.deepEqual(mig({ on: true, h: 16, m: 30, second: true, h2: 20, m2: 0 }), { on: true, h: 16, m: 30, second: true, h2: 18, m2: 30 }, "8:00 pm → 6:30 pm");
  assert.deepEqual(mig({ on: true, h2: 19, m2: 30 }), { on: true, h2: 18, m2: 30 }, "7:30 pm → 6:30 pm");
  assert.deepEqual(mig({ on: true, h2: 21, m2: 15 }), { on: true, h2: 21, m2: 15 }, "a time the family picked stays"); assert.deepEqual(mig({ on: false }), { on: false });
  assert.deepEqual(ST.migrateDoc("practice", "main", { _v: 52, reminder: { h2: 20, m2: 0 } }).reminder, { h2: 20, m2: 0 }, "only the settings doc");
  const r = RM.reminderOf({ reminder: { on: true } }); const plan = { days: [4], kinds: { 4: "home" } };
  assert.notEqual(RM.sentSig(r, plan), RM.sentSig({ ...r, h2: 20, m2: 0 }, plan), "a changed time is a new signature"); assert.equal(RM.sentSig(r, plan), RM.sentSig({ ...r }, plan));
  assert.notEqual(RM.sentSig(r, plan), RM.sentSig(r, { days: [4, 5], kinds: { 4: "home", 5: "home" } }), "so are new plan days");
  assert.match(src("js/app.js"), /if \(settled\("settings"\)\) try \{ resyncReminder\(\); \}/);
  for (const [title, body] of W.SECOND_LINES) { assert.match(title, /^Last call/); assert.doesNotMatch(body, /15 minutes|memory run is enough/, "the full session stays on offer"); }
  assert.match(src("js/views/practice.js"), /planDone\(\{\.\.\.rec,done\}\)&&!planDone\(rec\)\) try\{ pingDone\(\); \}/, "ticking the solo in the list quiets tonight's nudge (the re-audit), once: on the tick that finishes the plan");
});

test("before Fall (the Oct 30 re-audit): sheets never scroll sideways, Reduce Motion stops every swing, no shower before the settings arrive", () => {
  const css = src("css/app.css");
  for (const s of ["fall", "christmas"]) assert.ok(css.includes(`html[data-season="${s}"] .modal-card{overflow-x:hidden}`), s + ": the corner decoration is clipped, never scrolled to");
  for (const s of ["halloween", "fall", "christmas"]) assert.match(css, new RegExp(`prefers-reduced-motion:reduce\\)\\{[^@]*html\\[data-season="${s}"\\] \\.gate:after\\{animation:none!important\\}`), s + ": beats .card:nth-child(…):after");
  const seasons = src("js/seasons.js"); assert.match(seasons, /if \(t && received\.any\.has\("settings"\)\) showerOnce\(id, date\);/); assert.match(seasons, /import \{ S, setSettings, received \} from "\.\/store\.js";/);
});
