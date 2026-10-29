// Build 4, Part B of the Oct 29 audit, the words half: the printed Toolkit (the sticker rule follows the app's ⭐ Plan done,
// Saturday's memory run, trick 4, pause-and-predict in Sofia's voice, every footer dated Oct 29), the Bunny's and the pet's
// words, the event's short name on Today, the solo's Nov 4 checkpoint (schema 52), the plan week and the next checkpoint in
// the teacher summary, and Trick Quest behind Play's gate in the Coach corner too.
// Every expectation is computed from fixed dates or from the same gates the views use — never from today's weekday or the zone.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installEnv, resetDom, el } from "./_env.mjs";
installEnv();
const json = (f) => JSON.parse(readFileSync(new URL("../data/" + f + ".json", import.meta.url), "utf8"));
const src = (f) => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const { applyData, DATA_FILES } = await import("../js/data.js");
const got = {}; for (const f of DATA_FILES) got[f] = json(f); applyData(got);
const ST = await import("../js/store.js");
const MO = await import("../js/moments.js");
const T = await import("../js/teacher.js");
const SE = await import("../js/season15.js");
const RD = await import("../js/ready.js");
const HUB = await import("../js/coachhub.js");
const PL = await import("../js/views/play.js");
const { todayStr, fmt } = await import("../js/util.js");
const { planDone } = await import("../js/streak.js");
const { dayKindNow } = await import("../js/daykind.js");
const clearS = () => { for (const k of Object.keys(ST.S)) ST.S[k] = {}; };

// The Toolkit's visible text: SVGs out, block tags → a space, inline tags out, entities and whitespace folded.
const TK = src("tools/print/Sofia-Practice-Toolkit.html");
const visible = (h) => h.replace(/<svg[\s\S]*?<\/svg>/g, "").replace(/<\/?(div|td|th|tr|li|h1|h2|p|table|section|br|ul|ol)\b[^>]*>/g, " ").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const pages = TK.split(/<section class="page/).slice(1);

test("Toolkit p.2: a sticker when the app says ⭐ Plan done, and the rule strip stays short enough for three lines above the footer", () => {
  const strip = TK.match(/<div class="sbox">([\s\S]*?)<\/div>\s*<div class="foot">/); assert.ok(strip, "the strip sits right above page 2's footer");
  const text = visible(strip[1]).replace(/^THIS WEEK\s*/, "");
  assert.ok(text.includes("A sticker when the app says ⭐ Plan done."), text);
  assert.ok(text.length <= 280, `the strip is ${text.length} characters (≤ 280 keeps it three lines at 10 pt)`);
  assert.ok(text.includes("practise it right away") && text.includes("3 in a week = full week ★"), "the rest of the rule stays");
  assert.ok(!/A sticker for every home practice/.test(visible(TK)), "the old rule is gone everywhere, the page's heading too");
  assert.ok(visible(pages[1]).includes("My 15-week tracker A sticker when the app says ⭐ Plan done."), "the heading says the same");
  assert.match(TK, /\.tx \{ font-family: "Segoe UI Symbol"/, "the ⭐ prints as a one-colour glyph (black-ink printer)");
});

test("Toolkit: Saturday has the memory run, trick 4 keeps kick-overs and aerials in class, pause-and-predict speaks to Sofia, every footer says updated Oct 29", () => {
  assert.equal(pages.length, 8, "pages 1, 2, 2b, 2c, 3–6");
  const p1 = visible(pages[0]); assert.ok(p1.includes("Sat Co Tech · PITCH rehearsal + the 15-minute memory run"), "page 1's My week");
  assert.ok(!/PITCH rehearsal(?! \+ the 15-minute memory run)/.test(visible(TK).replace("Team PITCH", "")), "no Saturday line without the memory run");
  const trick4 = visible(pages[5]).match(/4 · Walkover to knees[^]*?(?=5 · Floor kick)/); assert.ok(trick4, "trick 4's row on page 4");
  assert.ok(trick4[0].includes("Kick-overs and aerials only in class."), trick4[0]); assert.ok(!/Kick-overs only with a spotter/.test(TK));
  assert.ok(visible(pages[4]).includes("Kick-overs and aerials only in class."), "the same rule as page 3's safety box");
  assert.ok(!/Mom pauses/.test(TK), "no grown-up's voice on Sofia's steps");
  assert.ok(visible(pages[4]).includes("Pause-and-predict. Ask a grown-up to pause the video anywhere: you say and show what comes next. When you never have to guess, the step is learned."));
  const feet = [...TK.matchAll(/<div class="foot">([^<]*)<\/div>/g)].map(m => m[1]); assert.equal(feet.length, 8, "one footer a page");
  for (const f of feet) assert.ok(f.includes("updated Oct 29"), f); assert.ok(!/updated Oct 26/.test(TK.replace(/<!--[\s\S]*?-->/g, "")));
  for (const s of ["practise it right away", "Never more than 2 days without the solo", "tape out the stage size", "mini audience #3", "Heel stretch", "0:48–2:04 from memory", "head ALL the way back. Don't tuck the chin"]) assert.ok(TK.includes(s), "research rule kept: " + s);
});

test("the Bunny and the pet in words a 9-year-old owns: no babyish openers, a day off (not a free skip), a bite of practice, the Growing-up photo", () => {
  const b = json("buddy"), pet = json("pet");
  assert.ok(b.openers.length >= 12, "still plenty of openers"); assert.ok(!b.openers.some(o => /Guess what|Hop hop|awesome\. Also/i.test(o)), b.openers.join(" | "));
  const all = JSON.stringify(b); assert.ok(!/free skip/i.test(all)); assert.ok(!/Glow-up/i.test(all));
  assert.match(b.facts.skips[0], /days off left this week: \{skips\}/); assert.ok(b.steps.glow.some(t => t.startsWith("Growing-up photo 🌱")));
  assert.ok(pet.lines.nap.includes("Zzz… a bite of practice wakes me up 😴")); assert.ok(!JSON.stringify(pet).includes("one bite wakes me up"));
});

test("8. Today's countdown sticker and chip show the event's short name, the same helper the Moment sticker uses", () => {
  assert.equal(MO.shortEventName("Winter Showcase (Winter Formal)"), "Winter Showcase"); assert.equal(MO.shortEventName("Gravit8 Seattle"), "Gravit8 Seattle");
  assert.equal(MO.shortEventName(""), ""); assert.equal(MO.shortEventName(null), ""); assert.equal(MO.shortEventName("A (x) B (y)"), "A B");
  assert.equal(MO.stickersFor({ eventName: "Winter Showcase (Winter Formal)", eventDays: 71 }).find(s => s.key === "event").text, "71 days to Winter Showcase");
  const home = src("js/views/home.js");
  assert.match(home, /\$\("#stickerWhat"\)\.textContent=shortEventName\(ne\.name\)/); assert.match(home, /\$\{esc\(shortEventName\(ne\.name\)\)\}<\/span>/);
  assert.doesNotMatch(home, /textContent=ne\.name/); assert.match(home, /import \{ todayNudge, shortEventName \} from "\.\.\/moments\.js"/);
  assert.ok(json("events").some(e => e.name === "Winter Showcase (Winter Formal)"), "the event that needed it");
});

test("9. the solo's Nov 4 checkpoint agrees with the plan's row: a clean run on film, Ms. Brittany at the next booked rehearsal; schema 52 swaps only step 45's exact words", () => {
  const solo = json("dances").find(d => d.id === "solo"); const nov4 = solo.checkpoints.filter(c => c.d === "2026-11-04");
  assert.equal(nov4.length, 1, "the date kept"); assert.equal(nov4[0].text, "A clean run on film; show Ms. Brittany at the next booked rehearsal"); assert.equal(nov4[0].text, ST.SOLO_V52.checkpoint[1]);
  assert.equal(json("plan10").days["2026-11-04"].label, "★ clean run on film", "the plan's row it now matches");
  assert.ok(ST.SCHEMA_VERSION >= 52); assert.equal(typeof ST.MIGRATIONS[52], "function"); assert.equal(ST.SOLO_V52.checkpoint[0], ST.SOLO_V45.checkpoint[1], "52 starts where 45 ended");
  const stored = { _v: 51, name: "Solo", notes: "ours", checkpoints: [{ d: "2026-11-01", text: "Whole solo from memory, on the music" }, { d: "2026-11-04", text: ST.SOLO_V45.checkpoint[1] }, { d: "2026-11-09", text: "my own goal" }] };
  const m = ST.migrateDoc("dances", "solo", stored);
  assert.deepEqual(m.checkpoints, [{ d: "2026-11-01", text: "Whole solo from memory, on the music" }, { d: "2026-11-04", text: ST.SOLO_V52.checkpoint[1] }, { d: "2026-11-09", text: "my own goal" }]);
  assert.equal(m.notes, "ours"); assert.equal(m.name, "Solo"); assert.equal(m._v, ST.SCHEMA_VERSION); assert.equal(stored.checkpoints[1].text, ST.SOLO_V45.checkpoint[1], "the stored object is not mutated");
  assert.equal(ST.migrateDoc("dances", "solo", { _v: 51, checkpoints: [{ d: "2026-11-04", text: "A run for Ms. Brittany, our words" }] }).checkpoints[0].text, "A run for Ms. Brittany, our words", "the family's own words stay");
  assert.equal(ST.migrateDoc("dances", "trio", { _v: 51, checkpoints: [{ d: "2026-11-04", text: ST.SOLO_V45.checkpoint[1] }] }).checkpoints[0].text, ST.SOLO_V45.checkpoint[1], "only the solo");
  assert.deepEqual(ST.migrateDoc("dances", "solo", { _v: 51, musicUrl: "x" }), { _v: ST.SCHEMA_VERSION, musicUrl: "x" }, "a partial override without checkpoints is left alone");
  assert.equal(ST.fixSolo52({ checkpoints: [{ d: "2026-11-04", text: ST.SOLO_V52.checkpoint[1] }] }).checkpoints[0].text, ST.SOLO_V52.checkpoint[1], "run twice: nothing changes");
});

test("10. the teacher summary carries the plan week and the next checkpoint with its date, one line each, just above the readiness bars", () => {
  assert.deepEqual(T.planLines("2026-10-29"), ["📅 Week 5 of 15 · Own it", `🎯 Next checkpoint: ${fmt("2026-10-31")} · Whole trio, no video`]);
  assert.equal(T.planLines("2026-11-12")[0], "📅 Week 7 of 15 · Clean it");
  assert.equal(T.planLines("2026-11-29")[1], `🎯 Next checkpoint: ${fmt("2026-11-29")} (today) · Every solo fix checked: each one clean on two videos in a row`);
  assert.equal(T.planLines("2026-11-02")[1], `🎯 Checkpoint ${fmt("2026-10-31")}: Whole trio, no video (not ticked in the app yet)`, "a passed one not ticked comes first, like Today");
  const plan = SE.activePlan("2026-11-02"); const id = (d) => SE.cpId(plan, plan.checkpoints.find(c => c.d === d));
  const ticks = { [id("2026-10-31")]: { done: "2026-10-31" }, [id("2026-11-01")]: { done: "2026-11-01" } };
  assert.match(T.planLines("2026-11-02", { ticks })[1], /^🎯 Next checkpoint: Next solo rehearsal: show Ms\. Brittany with no missed steps \(a solo private still to book\)$/, "the rehearsal to book");
  assert.equal(T.planLines("2027-01-20")[0], "📅 Week 2 of 23 · After the Showcase", "the spring plan after the Showcase");
  assert.equal(T.planLines("2026-09-01").length, 1, "before the plan: no week, only the first checkpoint");
  const r = RD.soloReadiness({ dance: null, settings: {}, corrections: {}, skills: {}, practice: {}, reviews: {}, today: "2026-10-29" });
  const t = T.teacherSummary({ today: "2026-10-29", ready: r, plan: T.planLines("2026-10-29") }).split("\n");
  const w = t.indexOf("📅 Week 5 of 15 · Own it"); assert.ok(w > 0, "the week line"); assert.match(t[w + 1], /^🎯 Next checkpoint: /); assert.match(t[w + 2], /^Solo readiness/, "right above the bars");
  assert.ok(!T.teacherSummary({ today: "2026-10-29" }).includes("📅 Week"), "none without them");
  assert.match(T.teacherSummary({ today: "2026-10-29", plan: T.planLines("2026-10-29") }), /📅 Week 5 of 15 · Own it\n🎯 Next checkpoint: [^\n]+\n\nQuestions for you/, "the lines stand on their own without the bars");
  assert.match(src("js/teacher.js"), /plan = planLines\(todayStr\(\), \{ oneOffs: studioDates\(\), ticks: checkpointTicks\(\) \}\)/, "the Grown-ups page passes the booked dates and the ticks");
});

test("11. the Coach corner's Trick Quest button follows Play's gate: hidden while Memory + knees (until Nov 9), there after", () => {
  assert.equal(HUB.questOpen("2026-11-05"), false, "Own it, knees focus"); assert.equal(HUB.questOpen("2026-11-08"), false); assert.equal(HUB.questOpen("2026-11-09"), true, "Nov 9: the solo is memorized");
  assert.equal(HUB.questOpen("2026-11-12"), true); assert.equal(HUB.questOpen("2027-02-03"), true, "spring");
  for (let d = new Date(2026, 9, 26); d <= new Date(2026, 10, 16); d.setDate(d.getDate() + 1)) {
    const ds = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    for (const home of [false, true]) for (const done of [false, true]) { const knees = SE.memoryKnees(ds);
      assert.equal(HUB.questOpen(ds, { home, done }), PL.gamesFor(ds, { home, knees, done }).games.some(g => g.id === "quest"), `${ds} home=${home} done=${done}`);
      assert.equal(HUB.questOpen(ds, { home, done }), PL.playSections(ds, { home, knees, done }).sections.some(s => s.games.some(g => g.id === "quest")), "the same as Play's sections"); }
  }
  // The card in the fake DOM, today (whatever the date): the button exactly when Play would show the tile; the "opens" line otherwise.
  resetDom(); clearS(); HUB.renderCoachHub(); const today = todayStr(); const h = el("#coachTricks").innerHTML;
  const playHasIt = PL.playSections(today, { home: dayKindNow(today) === "home", knees: SE.memoryKnees(today), done: planDone(ST.S.practice[today]) }).sections.some(s => s.games.some(g => g.id === "quest"));
  assert.equal(h.includes("qsStart()"), playHasIt, "no back door to Trick Quest");
  assert.equal(h.includes("Trick Quest opens"), SE.memoryKnees(today), "says when it opens while it waits");
  if (SE.memoryKnees(today)) assert.ok(h.includes(fmt(SE.activePlan(today).memoryKneesUntil)), "with the plan's date");
  assert.ok(h.includes("openCoach('solo',"), "the tricks stay coachable either way");
});
