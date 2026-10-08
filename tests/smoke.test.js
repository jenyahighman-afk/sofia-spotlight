// Smoke tests: every screen's init + render runs in Node against a fake DOM (tests/_env.mjs), with empty state and with
// sample records — and every element id the code looks up by name exists in index.html.
// Run through `npm test` (the loader in tests/_register.mjs stands in for the Firebase CDN imports).
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { installEnv, resetDom, el } from "./_env.mjs";

installEnv();
const read = (rel) => readFileSync(new URL("../" + rel, import.meta.url), "utf8");
const html = read("index.html");
const dataFiles = ["dances","events","classes","home-days","practice-items","phases","packs","aerial","season","styles","moves","avatar-options","oops","trio","compday","sparkle","skills","practice-pool","exercises"];

let M = {};
before(async () => {
  const data = await import("../js/data.js"); const got = {}; for (const f of dataFiles) got[f] = JSON.parse(read("data/" + f + ".json")); data.applyData(got);
  M.store = await import("../js/store.js");
  M.home = await import("../js/views/home.js"); M.dances = await import("../js/views/dances.js"); M.practice = await import("../js/views/practice.js"); M.play = await import("../js/views/play.js"); M.me = await import("../js/views/me.js");
  M.events = await import("../js/views/events.js"); M.schedule = await import("../js/views/schedule.js"); M.notes = await import("../js/views/notes.js"); M.lists = await import("../js/views/lists.js"); M.settings = await import("../js/views/settings.js"); M.skillcheck = await import("../js/views/skillcheck.js");
  M.grownups = await import("../js/grownups.js"); M.showme = await import("../js/showme.js"); M.player = await import("../js/player.js"); M.reports = await import("../js/reports.js"); M.badges = await import("../js/badges.js"); M.corrections = await import("../js/corrections.js"); M.nav = await import("../js/nav.js"); M.stage = await import("../js/stage.js"); M.pmode = await import("../js/pmode.js"); M.coach = await import("../js/coach.js"); M.goals = await import("../js/goals.js"); M.mirror = await import("../js/games/mirror.js"); M.demos = await import("../js/demos.js"); M.stars = await import("../js/stars.js"); M.along = await import("../js/games/along.js"); M.hub = await import("../js/coachhub.js");
});

const SCREENS = () => ({
  home: M.home.renderHome, dances: M.dances.renderDances, practice: M.practice.renderPractice, play: M.play.renderPlay, me: M.me.renderMe,
  events: M.events.renderEvents, schedule: () => { M.schedule.renderClasses(); M.schedule.renderCalendar(); }, notes: () => { M.notes.renderNotes(); M.notes.renderPhotos(); M.notes.renderFiles(); },
  lists: () => { M.lists.renderTodos(); M.lists.renderPack(); }, skillcheck: M.skillcheck.renderSkillCheck, reviews: M.coach.renderReviews, coach: M.hub.renderCoachHub, reports: M.reports.renderReports, grownups: M.grownups.renderGrownups, settings: M.settings.renderSettings,
});
const inits = () => [M.nav.initNav, M.dances.initDances, M.events.initEvents, M.schedule.initSchedule, M.practice.initPractice, M.notes.initNotes, M.lists.initLists, M.play.initPlay, M.me.initMe, M.skillcheck.initSkillCheck, M.settings.initSettings, M.grownups.initGrownups, M.showme.initShowMe, M.player.initPlayer, M.reports.installReportLinks, M.stage.initStage, M.pmode.initPracticeMode, M.coach.initCoach, M.goals.initGoals, M.mirror.initMirror, M.demos.initDemos, M.along.initAlong];

test("every element id looked up in the code exists in index.html", () => {
  const ids = new Set(); const walk = (dir) => { for (const f of readdirSync(new URL("../" + dir, import.meta.url))) { if (f.endsWith(".js")) { const src = read(dir + "/" + f); for (const m of src.matchAll(/\$\("#([A-Za-z0-9_-]+)"\)/g)) ids.add(m[1]); for (const m of src.matchAll(/getElementById\(["']([A-Za-z0-9_-]+)["']\)/g)) ids.add(m[1]); } } };
  walk("js"); walk("js/views"); walk("js/games");
  const DYNAMIC = new Set(["rcStart", "qsClock", "qsNote", "qsCamBox", "qsCam", "qsShot", "qsBig", "plYes", "plNo", "todayCount", "cdNote", "plRunCue", "coachVideo", "coachPickClip", "coachPhotos", "coachSkill", "coachBusyText", "goalPhoto", "goalValue", "goalCustomName", "goalCustomUnit", "goalCompareTop", "mgCount", "goalSlider", "swapTitle", "swapList", "demoFile", "demoUrl", "mgCount"]); // created inside a render, not in the markup
  const missing = [...ids].filter(id => !DYNAMIC.has(id) && !html.includes(`id="${id}"`));
  assert.deepEqual(missing, [], "ids referenced in js/ but absent from index.html");
  assert.ok(ids.size > 60, "expected a healthy number of ids, got " + ids.size);
});

test("the five kid tabs and every Grown-ups page exist; nothing text-heavy was deleted, only moved", () => {
  for (const p of ["home","dances","practice","play","me","pin","grownups","events","schedule","notes","lists","skillcheck","reviews","reports","settings"]) assert.ok(html.includes(`id="p-${p}"`), "section p-" + p);
  for (const id of ["coach","goal","mirror","goalRings","goalReminder","reviewList"]) assert.ok(html.includes(`id="${id}"`), id);
  for (const p of []) assert.ok(html.includes(`id="p-${p}"`), "section p-" + p);
  const tabs = [...html.matchAll(/<button data-p="([a-z]+)"/g)].map(m => m[1]);
  assert.deepEqual(tabs, ["home","dances","practice","play","me"]);
  for (const id of ["eventList","calGrid","packList","todoList","noteList","fileList","photoGrid","setExport","setImportFile","setLeave","aerialList","phases"]) assert.ok(html.includes(`id="${id}"`), id + " still present");
  assert.ok(html.includes('id="showme"') && html.includes('id="player"'));
});

test("every screen initialises and renders with an empty family space (no throw, content produced)", () => {
  resetDom(); for (const k of Object.keys(M.store.S)) M.store.S[k] = {};
  for (const init of inits()) init();
  for (const [name, render] of Object.entries(SCREENS())) assert.doesNotThrow(render, name + " render");
  assert.ok(el("#todayCard").innerHTML.includes("Play"), "Today card has the Play button");
  assert.ok(el("#danceList").innerHTML.includes("openPlayer('solo')"), "solo cover has ▶ Practice");
  assert.ok(el("#danceList").innerHTML.includes("More ▸"), "More ▸ is collapsed by default");
  assert.ok(!el("#danceList").innerHTML.includes("<details class=\"more\" open"), "no More opened by default");
  assert.ok(el("#practiceChecklist").innerHTML.split("pchk").length > 10, "checklist rows rendered");
  assert.ok(el("#badgeCase").innerHTML.includes("3-day streak"), "badge case lists locked badges");
  assert.equal((el("#gameGrid").innerHTML.match(/game-tile/g) || []).length, 9, "nine game tiles on Play");
  assert.ok(el("#alongList").innerHTML.includes("No routines yet"), "Dance Along empty state");
  assert.ok(el("#meStars").innerHTML.includes("⭐ 0") && el("#meStars").innerHTML.includes("Gold leotard"), "stars card shows the next unlock");
  assert.ok(el("#skillRings").innerHTML.includes("Acro"), "skill rings per style");
  assert.ok(el("#skillCheckList").innerHTML.includes("Teacher checked"), "grown-ups can teacher-check");
  assert.ok(el("#reportList").innerHTML.includes("No reports"), "reports empty state");
  assert.ok(el("#weekFix").innerHTML.includes("No open notes"), "week fix empty state");
});

test("with records: fixes become chips, patterns show up, this week's fix appears on Today, badges light up, runs count", () => {
  resetDom(); for (const k of Object.keys(M.store.S)) M.store.S[k] = {};
  const S = M.store.S; const today = new Date(); const iso = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); const t = iso(today);
  S.corrections = { a: { id: "a", danceId: "solo", text: "Point your foot", tag: "feet", status: "working", date: t, source: "Hannah" }, b: { id: "b", danceId: "solo", text: "Eyes up", tag: "eyes", status: "working", date: t, source: "Mom" }, c: { id: "c", danceId: "trio", text: "Point the foot", tag: "feet", status: "working", date: t, source: "Larisa" }, d: { id: "d", danceId: "pitch-jazz", text: "Feet!", tag: "feet", status: "done", date: t, source: "me" } };
  S.settings = { pin: "2027", pinOn: true, weekFix: { id: "a", week: M.corrections.weekKey(t) }, gameBest: 1350 };
  S.practice = { [t]: { done: ["warmup"], runs: [{ at: t, danceId: "solo", speed: 100, full: true, ending: true, eyes: true }] } };
  S.badges = { fix1: { key: "fix1", label: "First fix closed", emoji: "✅", at: t } };
  S.skills = { "a-cartwheel": { state: "checked", teacher: "Hannah" }, "a-onehand": { state: "learning" } };
  S.corrections.e = { id: "e", danceId: "pitch-jazz", text: "Feet again", tag: "feet", status: "working", date: t, source: "Isadora" }; S.corrections.f = { id: "f", danceId: "pitch-jazz", text: "And again", tag: "feet", status: "working", date: t, source: "Isadora" };
  S.reviews = { v1: { id: "v1", danceId: "solo", kind: "video", date: t, at: t + "T09:00:00Z", thumbs: [], pose: { knee: 176 }, review: { loved: "Great reach", fix: "Point your foot", tag: "feet", feet: "flexed", knees: "✓", eyes: "✓", arms: "✓", try: "" } } };
  S.goals = { g1: { id: "g1", name: "Right split", preset: "split-r", unit: "deg", target: 180, emoji: "🦵", createdAt: "2026-09-01", checkins: [{ id: "c1", date: "2026-09-01", value: 150 }, { id: "c2", date: "2026-09-15", value: 160 }] } };
  S.reports = { r1: { page: "home", note: "it froze", error: "TypeError: x", at: t + "T10:00:00Z", version: "1.1.0" } };
  for (const [name, render] of Object.entries(SCREENS())) assert.doesNotThrow(render, name + " render");
  const dl = el("#danceList").innerHTML;
  assert.ok(dl.includes("fixchip") && dl.includes("showMe('a')"), "chip opens Show me");
  assert.ok(el("#mePatterns").innerHTML.includes("You've had this note 5 times"), "Me shows the repeated tag across dances");
  assert.ok(dl.includes("You've had this note 3 times") && dl.includes("gotIt('d')") === false && dl.includes("Got it!"), "jazz card shows its own 3-times line with a Got it! on an open note");
  assert.ok(el("#weekFix").innerHTML.includes("Point your foot") && el("#weekFix").innerHTML.includes("This week's fix"), "Today shows this week's fix");
  assert.ok(el("#badgeCase").innerHTML.includes("badge on"), "earned badge lit");
  assert.ok(el("#practiceHead").innerHTML.includes("1 run"), "run shown on Practice");
  assert.ok(el("#todayCard").innerHTML.includes("1-day streak"), "a run makes today count");
  assert.ok(el("#reportList").innerHTML.includes("it froze"), "report listed for Mom");
  assert.ok(el("#reviewList").innerHTML.includes("Great reach") && !el("#reviewList").innerHTML.includes("Mom can see"), "review card renders for Grown-ups");
  assert.ok(el("#coachHub").innerHTML.includes("Solo") && el("#coachHub").innerHTML.includes("Fixes the coach gave") && el("#coachHub").innerHTML.includes("Point your foot"), "Coach corner groups the review under its dance with the fix");
  assert.ok(el("#coachNew").innerHTML.includes("openCoach('solo')"), "Coach corner starts a review for any dance");
  assert.ok(el("#gameGrid").innerHTML.includes("playOpen('nextmove')"), "What's Next? has a tile on Play");
  assert.ok(el("#gameGrid").innerHTML.includes("playOpen('quest')") && el("#coachTricks").innerHTML.includes("qsStart()"), "Trick Quest on Play and in the Coach corner");
  assert.ok(el("#coachNew").innerHTML.includes("Run check"), "Coach corner offers a run check");
  assert.ok(el("#modeRow").innerHTML.includes("setMode('comp')"), "Settings has the mode row"); assert.ok(el("#teacherText").value.startsWith("Sofia — practice summary"), "teacher summary renders on Coach reviews"); assert.ok(html.includes('id="compCard"'), "Today has a comp card");
  S.dances = { solo: { id: "solo", links: ["Original choreo | https://photos.app.goo.gl/abc", "https://example.com/x"] } }; M.dances.danceEdit("solo"); M.dances.danceEdit(null); const dh = el("#danceList").innerHTML; assert.ok(dh.includes(">🔗 Original choreo<") && dh.includes(">🔗 Link 2<") && dh.includes("href=\"https://photos.app.goo.gl/abc\""), "dance links take a name before a |"); S.dances = {};
  assert.ok(el("#quickRow").innerHTML.includes("openQuick('strength')") && el("#quickRow").innerHTML.includes("openQuick('flex')"), "Practice offers the two quick sessions");
  assert.ok(el("#coachTricks").innerHTML.includes("Donut roll") && el("#coachTricks").innerHTML.includes("Scorpion → needle") && el("#coachTricks").innerHTML.includes("openCoach('solo','Calypso')"), "solo tricks are tracked and coachable in the Coach corner");
  assert.ok(el("#goalRings").innerHTML.includes("Right split") && el("#goalRings").innerHTML.includes("New goal"), "goal tiles on Me");
  assert.ok(el("#goalReminder").innerHTML.includes("Check-in time"), "goal due after 14 days shows on Today");
  M.goals.openGoal("g1"); assert.ok(el("#goalBody").innerHTML.includes("openCoach('','Right split')"), "a goal's sheet has a coach button for that goal");
  assert.ok(el("#danceList").innerHTML.includes("openCoach('solo')"), "Coach me on the dance cover");
  assert.ok(el("#practiceChecklist").innerHTML.includes("openCoach('',"), "Coach me on tricks in Practice");
  assert.ok(el("#skillCheckList").innerHTML.includes("Hannah"), "teacher name shown");
  M.showme.showMe("a"); assert.ok(el("#showmeStage").innerHTML.includes("Flexed foot") && el("#showmeStage").innerHTML.includes("Point your foot"), "Show me renders both sides");
  for (const tag of ["feet","knees","eyes","arms","spacing","energy","timing","other"]) { M.showme.showMe(null, tag); assert.equal((el("#showmeStage").innerHTML.match(/<svg/g) || []).length, 2, tag + " has two stages"); }
});

test("practice player presets come from the dance's loops and its music-map timestamps", () => {
  const solo = JSON.parse(read("data/dances.json")).find(d => d.id === "solo");
  const ps = M.player.presetsFor(solo, 124);
  assert.ok(ps.some(p => p.n === "Soft half" && p.a === 0 && p.b === 48));
  assert.ok(ps.some(p => p.fromMap && p.a === 50 && p.b === 68 && p.n === "cartwheel"), "0:50 cartwheel → next stamp 1:08, label trimmed");
  assert.ok(ps.every(p => p.b > p.a));
  assert.equal(M.player.parseTime("1:52"), 112); assert.equal(M.player.parseTime("x"), null);
  assert.equal(M.player.shortLabel("floor ending — hold until the music is gone"), "floor ending — hold");
  assert.deepEqual(M.player.presetsFor({ id: "x" }, 0), []);
});

test("Grown-ups gate: locked by default, wrong PIN stays, right PIN opens, PIN off skips the pad", () => {
  resetDom(); M.store.S.settings = { pin: "2027", pinOn: true }; globalThis.sessionStorage.clear();
  assert.equal(M.grownups.isUnlocked(), false);
  assert.equal(M.store.pin(), "2027");
  globalThis.sessionStorage.setItem("spotlight:grownups", String(Date.now())); assert.equal(M.grownups.isUnlocked(), true);
  M.grownups.lockGrownups(); assert.equal(M.grownups.isUnlocked(), false);
  M.store.S.settings = { pinOn: false }; assert.equal(M.grownups.isUnlocked(), true); assert.equal(M.store.pin(), "2027");
  assert.ok(M.grownups.GROWNUP_PAGES.includes("settings") && M.grownups.GROWNUP_PAGES.includes("events"));
});

test("demo pictures: kind from the link, html per kind, none → dancer", async () => {
  const D = M.demos;
  assert.equal(D.demoKindForUrl("https://x/a.MP4?x=1"), "video"); assert.equal(D.demoKindForUrl("https://x/a.jpeg"), "photo"); assert.equal(D.demoKindForUrl("https://youtube.com/watch?v=1"), "link");
  assert.ok(D.demoHtml({ kind: "video", url: "https://x/a.mp4" }).includes("<video") && D.demoHtml({ kind: "video", url: "https://x/a.mp4" }).includes("muted"));
  assert.ok(D.demoHtml({ kind: "photo", url: "https://x/a.jpg" }).startsWith("<img")); assert.ok(D.demoHtml({ kind: "link", url: "https://y" }).includes("Open the clip")); assert.equal(D.demoHtml(null), "");
  M.store.S.settings = { demos: { planks: { kind: "photo", url: "https://x/p.jpg" } } }; assert.equal(D.demoFor("planks").url, "https://x/p.jpg"); assert.equal(D.demoFor("nope"), null);
});

test("stars: 1–3 per play by result, unlock ladder, next unlock", () => {
  const St = M.stars;
  assert.equal(St.starsFor("sparkle", 1350), 3); assert.equal(St.starsFor("sparkle", 600), 2); assert.equal(St.starsFor("sparkle", 10), 1);
  assert.equal(St.starsFor("oops", 9), 3); assert.equal(St.starsFor("oops", 7), 2); assert.equal(St.starsFor("oops", 2), 1);
  assert.equal(St.starsFor("compday", 84), 3); assert.equal(St.starsFor("choreo", 74), 2); assert.equal(St.starsFor("trio", 50), 1); assert.equal(St.starsFor("mirror", 250), 3); assert.equal(St.starsFor("practice", 100), 2); assert.equal(St.starsFor("unknown", 0), 1);
  assert.equal(St.isUnlocked("leo", "#FF6FA3", 0), true, "default pink is free"); assert.equal(St.isUnlocked("leo", "#FFD23F", 9), false); assert.equal(St.isUnlocked("leo", "#FFD23F", 10), true);
  assert.equal(St.nextUnlock(0)[3], "Gold leotard"); assert.equal(St.nextUnlock(10)[3], "Flower"); assert.equal(St.nextUnlock(999), null);
  assert.equal(St.unlockedList(35).length, 3);
  const ladder = St.UNLOCKS.map(u => u[2]); assert.deepEqual(ladder, [...ladder].sort((a, b) => a - b), "ladder climbs");
});

test("Coach corner: grouping by dance or skill, check trends, fix status", () => {
  const H = M.hub; const rv = (id, danceId, trick, date, checks, extra = {}) => ({ id, danceId, trick, date, at: date + "T10:00:00Z", review: { loved: "x", fix: "fix " + id, tag: "feet", feet: "✓", knees: "✓", eyes: "✓", arms: "✓", ...checks }, ...extra });
  const reviews = { a: rv("a", "solo", "", "2026-10-01", { feet: "flexed" }), b: rv("b", "solo", "", "2026-10-03", { feet: "✓" }), c: rv("c", "", "Calypso", "2026-10-02", { knees: "bent" }), gone: { ...rv("z", "solo", "", "2026-10-04", {}), deleted: true } };
  const g = H.groupReviews(reviews); assert.deepEqual(g.map(x => x.key), ["dance:solo", "trick:Calypso"]); assert.deepEqual(g[0].list.map(r => r.id), ["b", "a"], "newest first, deleted skipped");
  const t = H.checkTrend(g[0].list); assert.deepEqual(t.feet.hist, [true, false]); assert.equal(t.feet.good, 1); assert.equal(t.feet.of, 2); assert.equal(t.knees.good, 2);
  const many = [true, true, true, false, false, true].map((v, i) => rv("m" + i, "solo", "", "2026-09-" + (20 - i), { eyes: v ? "✓" : "down" })); assert.equal(H.checkTrend(many).eyes.trend, "up");
  assert.equal(H.fixStatus(reviews.a, {}), "open");
  assert.equal(H.fixStatus({ ...reviews.a, fixAdded: true, fixId: "c1" }, { c1: { id: "c1", status: "working" } }), "working");
  assert.equal(H.fixStatus({ ...reviews.a, fixAdded: true, fixId: "c1" }, { c1: { id: "c1", status: "done" } }), "done");
  assert.equal(H.fixStatus({ ...reviews.a, fixAdded: true }, { x: { source: "AI coach", danceId: "solo", text: "fix a", status: "done" } }), "done", "older reviews match by text");
  assert.equal(H.fixStatus({ ...reviews.a, fixAdded: true, fixId: "gone" }, {}), "noted");
  assert.equal(H.lastTrickReview(reviews, "Calypso").id, "c"); assert.equal(H.lastTrickReview(reviews, "Donut roll"), null);
});
