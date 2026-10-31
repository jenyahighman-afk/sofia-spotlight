// Build 2 from the Oct 28 review (1.47.0): Today = one card, one button (the extras below it, the Bunny waiting); the
// plan's checkpoints as tickable goals (schema 49) with a by-when sheet; the four solo readiness bars from existing data;
// the in-app Backstage Pass (data/pass.json: parts with a check, a tip a day, the Bunny's nudge); one memorize path.
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
const { migrateDoc, SCHEMA_VERSION, normalizeCheckpoints, normalizePass, S } = await import("../js/store.js");
const { cpId, allCheckpoints, checkpoints, checkpointsToShow, nextCheckpoint, plansFrom, planLabel, cpRow } = await import("../js/season15.js");
const { knownCues, soloReadiness, readinessHtml, readinessLines, KNOW_GOT, PERFORM_TARGET } = await import("../js/ready.js");
const P = await import("../js/pass.js");
const B = await import("../js/buddy.js");
const { teacherSummary } = await import("../js/teacher.js");
const { startButton } = await import("../js/views/home.js");
const { cardsFor } = await import("../js/habit.js");
const { quizSteps, quizDances } = await import("../js/games/nextmove.js");
const plan15 = json("plan15"), spring = json("plan-spring"), dances = json("dances"), pass = json("pass"), buddy = json("buddy");
const solo = dances.find(d => d.id === "solo");
const html = src("index.html");

test("schema 49: settings.checkpoints and settings.pass are normalized when present (dates only, junk dropped), never invented", () => {
  assert.ok(SCHEMA_VERSION >= 49);
  assert.deepEqual(normalizeCheckpoints({ a: { done: "2026-11-01" }, b: { done: "2026-11-02", note: "  clean! " }, c: { done: "soon" }, d: "2026-11-03", e: 5, "": { done: "2026-11-04" } }), { a: { done: "2026-11-01" }, b: { done: "2026-11-02", note: "clean!" }, d: { done: "2026-11-03" } });
  assert.deepEqual(normalizeCheckpoints([1, 2]), {}); assert.deepEqual(normalizeCheckpoints(null), {});
  assert.deepEqual(normalizePass({ read: { crew: "2026-10-30", "Bad Id": "2026-10-30", binder: "nope" }, extra: 1 }), { read: { crew: "2026-10-30" } }); assert.deepEqual(normalizePass("x"), { read: {} });
  const d = migrateDoc("settings", "main", { _v: 48, checkpoints: { x: { done: "2026-11-01" }, y: "junk" }, pass: { read: { crew: "2026-10-30" } } });
  assert.equal(d._v, SCHEMA_VERSION); assert.deepEqual(d.checkpoints, { x: { done: "2026-11-01" } }); assert.deepEqual(d.pass, { read: { crew: "2026-10-30" } });
  const u = migrateDoc("settings", "main", { _v: 48, stars: 3 }); assert.equal("checkpoints" in u, false); assert.equal("pass" in u, false);
  assert.equal(migrateDoc("practice", "2026-11-01", { _v: 48, checkpoints: "x" }).checkpoints, "x", "only settings carry them");
});

test("checkpoint ids are stable per plan and text; the same text in both plans gets two ids; every checkpoint carries one", () => {
  const a = cpId(plan15, { t: "Family mini show" }), b = cpId(spring, { t: "Family mini show" }); assert.notEqual(a, b); assert.ok(a.startsWith("2026-09-28:") && b.startsWith("2027-01-11:"));
  assert.equal(cpId(plan15, { t: " Family mini show " }), a, "whitespace doesn't change it"); assert.equal(cpId({ ...plan15, weeks: [] }, { t: "Family mini show" }), a, "editing the weeks doesn't change it");
  const all = allCheckpoints(plan15, [], "2026-10-26"); assert.equal(all.length, plan15.checkpoints.length); assert.ok(all.every(c => c.id && c.t)); assert.equal(new Set(all.map(c => c.id)).size, all.length, "unique within a plan");
  assert.deepEqual(checkpoints("2026-10-26", plan15, []).map(c => c.d), ["2026-10-31", "2026-11-01", "2026-11-29", "2026-12-06", "2026-12-20", "2026-12-20", "2026-12-27", "2027-01-02", "2027-01-06", "2027-01-08", ""], "the dated list, with the finish lines (1.47.1)");
  assert.ok(checkpoints("2026-10-26", plan15, []).every(c => c.id), "with ids"); assert.equal(allCheckpoints(spring, [], "2027-01-11").length, spring.checkpoints.length);
});

test("what Today lists: the next two to come, a passed one unticked for a week ('did you make it?'), a ticked one kept two days, Book it once the rehearsal date is here", async () => {
  const show = (date, ticks = {}, opts) => checkpointsToShow(date, plan15, [], ticks, opts);
  assert.deepEqual(show("2026-10-26").map(c => [c.d, c.state]), [["2026-10-31", "next"], ["2026-11-01", "next"]], "two to come, nothing passed, the rehearsal not yet due");
  assert.deepEqual(show("2026-10-31").map(c => [c.d, c.state]), [["2026-10-31", "today"], ["2026-11-01", "next"]]);
  const trio = cpId(plan15, { t: "Whole trio, no video" }), soloCp = cpId(plan15, { t: "Whole solo from memory, on the music" });
  assert.deepEqual(show("2026-11-03").map(c => [c.t.slice(0, 10), c.state]), [["Whole trio", "passed"], ["Whole solo", "passed"], ["Next solo ", "book"], ["Every solo", "next"], ["🎤 Mini au", "next"]], "Nov 3: both passed and unticked, the rehearsal to book (after Nov 1), then the next two (the Nov 29 and Dec 6 finish lines, 1.47.1)");
  assert.deepEqual(show("2026-11-08").filter(c => c.state === "passed").map(c => c.d), ["2026-11-01"], "Nov 8: Oct 31 is 8 days ago (gone), Nov 1 is 7 (still asked)");
  assert.deepEqual(show("2026-11-09").filter(c => c.state === "passed"), [], "Nov 9: both gone from Today (the by-when sheet keeps them)");
  const t1 = { [trio]: { done: "2026-10-31" } };
  assert.deepEqual(show("2026-11-01", t1).map(c => [c.t.slice(0, 10), c.state]), [["Whole trio", "done"], ["Next solo ", "book"], ["Whole solo", "today"], ["Every solo", "next"]], "ticked yesterday: ✅ for two days; Book it from Nov 1 (the checkpoint's `after`); then the next two");
  assert.deepEqual(show("2026-11-02", t1).filter(c => c.state === "done"), [], "two days on, the ✅ leaves Today");
  assert.equal(show("2026-11-05", { [trio]: { done: "2026-11-05" }, [soloCp]: { done: "2026-11-01" } }).filter(c => c.state === "passed").length, 0, "ticked late still counts as made");
  const { bookingRecord } = await import("../js/studio.js"); const booked = [bookingRecord("2026-11-04", "3:30–4:00 PM", "Solo rehearsal with Ms. Brittany", "GHD", "r1")];
  assert.ok(checkpointsToShow("2026-11-02", plan15, booked, {}).some(c => c.rehearsal && c.state === "next" && c.d === "2026-11-04"), "booked: dated, no Book it");
  assert.equal(nextCheckpoint("2026-10-26", plan15, [], {}).d, "2026-10-31"); assert.equal(nextCheckpoint("2026-11-03", plan15, [], {}).state, "passed", "a passed one is asked first"); assert.equal(nextCheckpoint("2026-11-03", plan15, [], { [trio]: { done: "2026-11-03" }, [soloCp]: { done: "2026-11-02" } }).state, "book");
  assert.equal(nextCheckpoint("2027-06-21", spring, [], {}).t, "Family mini show", "the week after the Ball still asks about the mini show and the Ball"); assert.equal(nextCheckpoint("2027-06-28", spring, [], {}), null, "a week later nothing is next");
  assert.deepEqual(plansFrom("2026-10-29").map(planLabel), ["To the Winter Showcase", "Spring: to the Glass House Ball"]); assert.deepEqual(plansFrom("2027-02-01").map(planLabel), ["Spring: to the Glass House Ball"]);
  const row = cpRow({ id: "x:1", d: "2026-11-01", t: "Whole solo", state: "passed" }, "2026-11-03"); assert.match(row, /Did you make it\?/); assert.match(row, /cpTick\('x:1',true\)/);
  assert.match(cpRow({ id: "x:1", d: "2026-11-01", t: "Whole solo", state: "done", done: "2026-11-01" }), /✅[\s\S]*cpTick\('x:1',false\)/); assert.match(cpRow({ id: "x:2", d: "", t: "Next solo rehearsal", state: "book" }), /Book a private/);
  const s15 = src("js/season15.js"); assert.match(s15, /export async function tickCheckpoint/); assert.match(s15, /setSettings\(\{ checkpoints: ticks \}\)/); assert.match(s15, /openByWhen/); assert.ok(html.includes('id="byWhenArea"'));
});

test("solo readiness: four bars from the records the app keeps — Pause & Predict, the solo's notes, the numbered tricks, runs and film in 14 days", () => {
  const cues = solo.cues; const n = (i) => cues[i].n;
  const predict = { [n(0)]: { got: 2, missed: 0, last: "got" }, [n(1)]: { got: 3, missed: 1, last: "got" }, [n(2)]: { got: 1, missed: 0, last: "got" }, [n(3)]: { got: 2, missed: 1, last: "missed" }, [n(4)]: { got: 0, missed: 2, last: "missed" } };
  const k = knownCues(cues, predict); assert.equal(k.of, 28); assert.equal(k.known, 2, `known = got ${KNOW_GOT}+ and the last try a hit`); assert.equal(k.tricky, 2); assert.equal(k.tried, 5); assert.deepEqual(k.ids, [n(0), n(1)]);
  assert.deepEqual(knownCues(cues, undefined), { of: 28, known: 0, tricky: 0, tried: 0, ids: [] }); assert.equal(knownCues([{ t: 1, move: "x" }], {}).of, 0, "no cue table: no Know bar");
  const corrections = { a: { id: "a", danceId: "solo", text: "A", tag: "feet", status: "done" }, b: { id: "b", danceId: "solo", text: "B", tag: "knees", status: "working", pinned: true }, c: { id: "c", danceId: "solo", text: "C", tag: "eyes", status: "working" }, d: { id: "d", danceId: "trio", text: "D", tag: "feet", status: "working" }, e: { id: "e", danceId: "solo", text: "E", tag: "arms", status: "done", deleted: true } };
  const skills = { "s-side-sit": { state: "checked", teacher: "Hannah" }, "s-side-ext": { state: "clean" }, "s-leap": { state: "learning" }, "s-calypso": { state: "clean" } };
  const practice = { "2026-11-10": { runs: [{ danceId: "solo", full: true }, { danceId: "trio" }], done: ["solo-run"] }, "2026-11-12": { runs: [{ at: "x" }], bites: ["game"] }, "2026-11-20": { done: ["mem-top"] }, "2026-10-20": { runs: [{ danceId: "solo" }], done: ["solo-run"] }, note: { runs: [{}] } };
  const reviews = { r1: { id: "r1", danceId: "solo", date: "2026-11-15", review: {} }, r2: { id: "r2", danceId: "trio", date: "2026-11-15" }, r3: { id: "r3", danceId: "solo", date: "2026-10-01" }, r4: { id: "r4", danceId: "solo", date: "2026-11-16", deleted: true } };
  const r = soloReadiness({ dance: solo, settings: { predict }, corrections, skills, practice, reviews, today: "2026-11-23" });
  assert.deepEqual(r.know, { n: 2, of: 28, tricky: 2, tried: 5, pct: 7 });
  assert.deepEqual(r.clean, { closed: 1, open: 2, of: 3, pct: 33 }, "the solo's notes only, deleted ones never, the pinned one counts as open");
  assert.deepEqual(r.tricks, { n: 2, of: 8, checked: 1, pct: 25 }, "the eight numbered tricks (two numbers cover two skills each); calypso has no number");
  assert.equal(soloReadiness({ dance: solo, skills: { ...skills, "s-leap": { state: "clean" } }, today: "2026-11-23" }).tricks.n, 2, "trick 3 needs the leap AND the cartwheel"); assert.equal(soloReadiness({ dance: solo, skills: { ...skills, "s-leap": { state: "clean" }, "s-cartwheel": { state: "checked" } }, today: "2026-11-23" }).tricks.n, 3);
  assert.deepEqual(r.perform, { runs: 2, film: 1, days: 3, of: 6, window: 14, pct: 50 }, `runs in the window (a trio run and an old run don't count) + film, against the plan's home days in it (6 = ${PERFORM_TARGET}, Build 4); solo days = plan-done days`);
  assert.equal(r.overall, Math.round((7 + 33 + 25 + 50) / 4));
  const e = soloReadiness({ dance: solo, today: "2026-11-23" }); assert.equal(e.overall, 0); assert.equal(e.know.of, 28); assert.equal(e.tricks.of, 8);
  const h = readinessHtml(r); for (const s of ["🧠", "Know", "2 / 28 moves known · 2 tricky", "1 fix closed · 2 open", "2 / 8 tricks clean · 1 ★", "2 runs · 1 on film · the solo on 3 of 6 home days", 'style="width:7%"', 'style="width:50%"']) assert.ok(h.includes(s), s);
  const lines = readinessLines(r); assert.equal(lines.length, 5); assert.match(lines[0], /Solo readiness/); assert.match(lines[1], /2 of 28 cues right twice/); assert.match(lines[4], /2 full runs, 1 on film/);
  const t = teacherSummary({ dances, corrections, skills, ready: r }); assert.ok(t.includes("Solo readiness") && t.includes("🎭 Perform, last 14 days"), "the teacher summary carries the bars"); assert.ok(!teacherSummary({ dances }).includes("Solo readiness"), "none without them");
  assert.match(src("js/views/dances.js"), /readyFold\(\)/); assert.match(src("js/views/home.js"), /openReady\(\)/); assert.ok(html.includes('id="readyArea"'));
});

test("the Backstage Pass: ten parts with a check, the words from the printed Pass; read = the check right; the next part, the nag after two quiet days, the tip of the day by the kind of day", () => {
  const ps = P.parts(pass); assert.equal(ps.length, 10); assert.deepEqual(ps.map(p => p.id), ["crew", "binder", "grab", "goal", "week", "balance", "time", "food", "sleep", "body"]);
  for (const p of ps) { assert.ok(p.lines.length >= 5 && p.check.a.length === 3 && p.check.ok >= 0 && p.check.ok < 3 && p.check.yay && p.check.hint, p.id); assert.ok(P.checkAnswer(p, p.check.ok) && !P.checkAnswer(p, (p.check.ok + 1) % 3), p.id + " check"); }
  assert.ok(pass.tips.length >= 30 && pass.tips.every(t => t.t && Array.isArray(t.when) && t.when.length && ps.some(p => p.id === t.part)), "every tip names its part and its moments");
  assert.ok(ps.find(p => p.id === "food").lines.every(l => !/chicken|beef|bacon|turkey|ham\b/i.test(l)), "meat-free"); assert.ok(ps.find(p => p.id === "week").lines[0].includes("watch Hannah's two videos"), "Monday = the videos, as Build 1 decided");
  assert.equal(P.nextPart({}, pass).id, "crew"); assert.equal(P.nextPart({ pass: { read: { crew: "2026-10-30" } } }, pass).id, "binder"); assert.equal(P.readCount({ pass: { read: { crew: "2026-10-30", body: "2026-10-30" } } }, pass), 2);
  assert.equal(P.nextPart({ pass: { read: Object.fromEntries(ps.map(p => [p.id, "2026-10-30"])) } }, pass), null, "all read");
  assert.equal(P.nudgeFor({}, "2026-10-30", pass).id, "crew", "never read: ask"); assert.equal(P.nudgeFor({ pass: { read: { crew: "2026-10-30" } } }, "2026-10-31", pass), null, "read yesterday: quiet");
  assert.equal(P.nudgeFor({ pass: { read: { crew: "2026-10-29" } } }, "2026-10-31", pass).id, "binder", `${P.NAG_DAYS} days quiet: the next part`); assert.equal(P.nudgeFor({ pass: { read: Object.fromEntries(ps.map(p => [p.id, "2026-10-01"])) } }, "2026-10-31", pass), null, "all read: nothing to ask");
  assert.deepEqual(P.momentsFor("2026-11-02", { studio: true, hour: 18 }), ["any", "studio", "after"], "a Monday evening"); assert.deepEqual(P.momentsFor("2026-11-05", { home: true, hour: 9 }), ["any", "home", "morning"]); assert.deepEqual(P.momentsFor("2026-11-01", { home: true, hour: 20 }), ["any", "home", "sun", "evening"]); assert.deepEqual(P.momentsFor("2026-11-07", { studio: true, hour: 8 }), ["any", "studio", "sat", "morning"]);
  const studioTip = P.tipFor("2026-11-02", ["any", "studio"], pass); assert.ok(studioTip.when.includes("studio"), "a studio day gets a studio tip before an 'any' one"); assert.equal(P.tipFor("2026-11-02", ["any", "studio"], pass), studioTip, "the same all day");
  assert.notEqual(P.tipFor("2026-11-03", ["any", "studio"], pass), studioTip, "another one tomorrow"); assert.ok(P.tipFor("2026-11-05", ["any"], pass).when.includes("any")); assert.equal(P.tipFor("2026-11-05", ["any"], { tips: [] }), null);
  assert.ok(data.DATA_FILES.includes("pass") && src("sw.js").includes("./data/pass.json") && src("sw.js").includes("./js/pass.js") && src("sw.js").includes("./js/ready.js"));
  assert.ok(html.includes('id="passCard"') && html.includes('id="passArea"')); assert.match(src("js/pass.js"), /awardStars\("pass"/);
});

test("the Bunny: the Pass part is a step once the day counts; the tip of the day rides along as its fact once a day; the bubble waits for her first scroll or ten seconds", () => {
  assert.ok(buddy.steps.pass && buddy.steps.pass.length >= 2 && buddy.steps.pass.every(t => t.includes("{part}"))); assert.ok(buddy.facts.tip && buddy.facts.tip.every(t => t.includes("{tip}")));
  const ctx = { name: "Sofia", pet: "Bun-Bun", dayDone: true, safe: true, fullDone: true, streak: 2, skips: 2, petDays: 3, comp: null, compMode: false, plan: null, ticks: [], classes: [], restDay: false, cards: [], dare: null, door: null, glow: false, cardsEarned: 0, starsLeft: 0, unlock: "", event: null, passPart: "🎭 Meet your crew", tip: "" };
  const s = B.pickStep(ctx, () => 0); assert.equal(s.key, "pass"); assert.equal(s.vars.part, "🎭 Meet your crew"); assert.equal(s.go, "openPass()");
  assert.notEqual(B.pickStep({ ...ctx, dayDone: false, safe: false, cards: [{ id: "move", sub: "x", go: "y", done: false }] }).key, "pass", "before the day counts the solo and the plan come first");
  const m = B.compose({ ...ctx, passPart: "", tip: "Sharp pain is a STOP sign 🛑 Tell Mom right away." }, { rng: () => 0.99, lines: buddy }); assert.ok(m.fact.includes("Sharp pain is a STOP sign"), "the tip is the fact even when the dice say no fact"); assert.equal(m.tipUsed, true);
  const m2 = B.compose({ ...ctx, passPart: "" }, { rng: () => 0.99, lines: buddy }); assert.equal(m2.tipUsed, false);
  const bj = src("js/buddy.js"); assert.match(bj, /AUTO_MS = 10000/); assert.match(bj, /addEventListener\("scroll", go/); assert.doesNotMatch(bj, /\}, 1500\)/, "no 1.5-second pop over the plan"); assert.match(bj, /markTipSaid\(\)/);
});

test("Today = one card, one button: the day's action from the plan, the plan-done state, the solo count and the next checkpoint; the extras below; the page order", () => {
  assert.deepEqual(startButton({ kind: "home", mins: 36, nDone: 0, total: 15 }), { label: "▶ Start practice · 36 min", go: "showPage('practice');openPracticeMode()", ghost: false });
  assert.deepEqual(startButton({ kind: "memory", mins: 16, nDone: 0, total: 5 }).label, "▶ 15-min memory run", "the memory run says its own length"); assert.equal(startButton({ kind: "watch", mins: 9, total: 3 }).label, "▶ Watch + picture · 9 min");
  assert.match(startButton({ kind: "home", mins: 36, nDone: 7, total: 15 }).label, /^▶ Keep going · 36 min <span class="today-prog">7 of 15<\/span>$/);
  assert.deepEqual(startButton({ kind: "home", mins: 36, nDone: 15, total: 15 }), { label: "✅ Practice done · 36 min", go: "showPage('practice')", ghost: true });
  assert.deepEqual(startButton({ kind: "rest" }), { label: "🧘 2-min stretch", go: "habitTired('stretch')", ghost: false });
  const at = (id) => html.indexOf(`id="${id}"`); const order = ["p-home", "todayCard", "seasonFold", "seasonCard", "sundayCard", "compCard", "goalReminder", "glowNudge", "p-dances"]; // 1.52.0: Today fits one screen; the rest moved (tests/today152.test.js)
  for (let i = 1; i < order.length; i++) assert.ok(at(order[i - 1]) < at(order[i]), `${order[i - 1]} before ${order[i]}`);
  const home = src("js/views/home.js"); assert.match(home, /class="today-date small"/); assert.match(home, /today-start/); assert.match(home, /onclick="\$\{memoGo\}">🧠 Memorize</); assert.match(home, /openMemorize\('solo','chunks'\)/); assert.match(home, /renderPassCard\(\)/); assert.match(home, /function renderHabit/); assert.ok(home.indexOf("choice-card") > home.indexOf("function renderHabit"), "the choice cards are drawn by the extras card, not the one card");
  const memo = cardsFor("2026-11-05", { memo: { danceId: "solo", table: true, label: "Solo · Soft half" } }).find(c => c.id === "memo"); assert.equal(memo.go, "openMemorize('solo','chunks')", "the solo's Memorize card opens the one memorize sheet");
  assert.equal(cardsFor("2026-11-05", { memo: { danceId: "trio", table: false, label: "Trio" } }).find(c => c.id === "memo").go, "showPage('dances');memoFocus('trio')", "the trio (no cue table) keeps the five steps");
});

test("one memorize path: 🧠 Memorize is the door on the solo card and Today; the cue cards, the words, the five steps, What's Next? and the videos are one tap inside; What's Next? asks the cue names", () => {
  const d = src("js/views/dances.js"); assert.match(d, /onclick="openMemorize\('\$\{d\.id\}','chunks'\)">🧠 Memorize</); assert.doesNotMatch(d, /table-tools[^\n]*openCueCards\(/, "no second door on the card");
  const mz = src("js/memorize.js"); for (const s of ["export function moreWays", "openCueCards('${d.id}')", "openPlayer('${d.id}')", "memoFocus('${d.id}')", "playOpen('nextmove')", "openVideos()", "export function knownLine", "knownCues(d && d.cues"]) assert.ok(mz.includes(s), s);
  assert.ok(mz.includes("${knownLine(d)}${moreWays(d)}"), "both tabs end with the count and the other ways");
  assert.deepEqual(quizSteps(solo).length, 28); assert.equal(quizSteps(solo)[0], solo.cues[0].move); assert.deepEqual(quizSteps({ steps: ["a", "b", "c"] }), ["a", "b", "c"]); assert.deepEqual(quizSteps(null), []);
  assert.ok(quizDances(dances).some(x => x.id === "solo")); assert.deepEqual(quizDances([{ id: "x", cues: solo.cues.slice(0, 3), steps: ["a"] }]), [], "three cues aren't enough to quiz");
  assert.match(src("js/games/nextmove.js"), /NM\.steps = quizSteps\(NM\.dance\)/);
  assert.ok(src("js/pmode.js").includes(`openMemorize('solo','chunks')`), "the practice item's 🧩 Chunks button opens the same sheet");
});

test("the screens render with Build 2 in place: the one card, the extras, the Pass card, the season card's ticks and the by-when sheet, the readiness sheet", async () => {
  resetDom(); for (const k of Object.keys(S)) S[k] = {};
  const home = await import("../js/views/home.js"); const stage = await import("../js/stage.js"); const season = await import("../js/season15.js"); const ready = await import("../js/ready.js"); const nav = await import("../js/nav.js");
  nav.initNav(); stage.initStage(); season.initSeason(); ready.initReady(); P.initPass();
  assert.doesNotThrow(() => home.renderHome(), "Today renders");
  const tc = el("#todayCard").innerHTML; assert.match(tc, /today-start/); assert.match(tc, /How ready\?/); assert.match(tc, /openReady\(\)/); assert.match(el("#seasonSum").innerHTML, /🎯 |🏁 My finish lines/); assert.match(tc, /🧠 Memorize/);
  assert.match(el("#habitCard").innerHTML, /Pick one extra/); assert.equal((el("#habitCard").innerHTML.match(/choice-card/g) || []).length, 4);
  assert.match(el("#passCard").innerHTML, /Part 1 of 10 · 🎭 Meet your crew · 2 min/); assert.match(el("#passCard").innerHTML, /openPass\('crew'\)/); assert.match(el("#passCard").innerHTML, /Tip of the day/);
  const sc = el("#seasonCard").innerHTML; assert.match(sc, /cpTick\('2026-09-28:[a-z0-9]+',true\)|cpTick\('2027-01-11:[a-z0-9]+',true\)|Book a private|openByWhen\(\)/, "a checkpoint row or the by-when link");
  window.openByWhen(); assert.equal(el("#stage").hidden, false); assert.match(el("#byWhenArea").innerHTML, /To the Winter Showcase|Spring: to the Glass House Ball/); assert.ok((el("#byWhenArea").innerHTML.match(/class="bw-row/g) || []).length >= 6); window.closeStage();
  window.openReady(); assert.match(el("#readyArea").innerHTML, /is the bar, /, "Build 4: the phase's bar is the headline, not a percent"); assert.equal((el("#readyArea").innerHTML.match(/class="rbar"/g) || []).length, 4); window.closeStage();
  window.openPass("crew"); const pa = el("#passArea").innerHTML; assert.match(pa, /Meet your crew/); assert.match(pa, /passAnswer\(0\)/); assert.match(pa, /Where do you look to see what to do TODAY\?/); assert.equal((pa.match(/class="pass-a"|pass-a"/g) || []).length, 3);
  const { setBackend } = await import("../js/store.js"); const writes = []; setBackend({ set: async (c, id, doc) => { writes.push([c, id, doc]); }, del: async () => {} });
  try { await window.passAnswer(1); assert.equal(S.settings.pass, undefined, "a wrong answer saves nothing"); assert.match(el("#passArea").innerHTML, /🤔/);
    await window.passAnswer(0); assert.equal(typeof (S.settings.pass || {}).read.crew, "string", "the right answer marks the part read"); assert.ok(!S.settings.stars, "but no star after a miss (Build 4)"); assert.match(el("#passArea").innerHTML, /Next part tomorrow earns the star/); assert.match(el("#passArea").innerHTML, /Next part ›/); assert.match(el("#passCard").innerHTML, /Part 2 of 10/);
    const n = writes.length; await window.passAnswer(0); assert.ok(!S.settings.stars, "a second right answer pays nothing more"); assert.equal(writes.length, n, "and writes nothing");
    window.passGo("binder"); const ok = pass.parts.find(p => p.id === "binder").check.ok; await window.passAnswer(ok); assert.equal(typeof S.settings.pass.read.binder, "string"); assert.ok(S.settings.stars >= 1, "right on the first try: the star"); } finally { setBackend(null); }
  window.closeStage(); resetDom(); for (const k of Object.keys(S)) S[k] = {};
  assert.match(src("README.md"), /Build 2/); assert.match(src("js/version.js"), /APP_VERSION = "1\.(4[7-9]|[5-9]\d)/);
});
