// 1.67.0 (Jenya, Nov 13): 📸 Picture time (a starting picture for every goal on her list, a progress picture every two
// weeks), Today's second choice (⭐ Or work on a skill, from her own goals), and the audit's fixes. Reads files and the fake
// DOM only: no clock, no weekday, no timezone (every date is passed in).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installEnv } from "./_env.mjs";
installEnv();
const json = (f) => JSON.parse(readFileSync(new URL("../data/" + f + ".json", import.meta.url), "utf8"));
const src = (f) => readFileSync(new URL("../" + f, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const { applyData, DATA_FILES } = await import("../js/data.js");
const got = {}; for (const f of DATA_FILES) got[f] = json(f); applyData(got);
const W = await import("../js/working.js");
const H = await import("../js/views/home.js");
const D = "2026-11-13";
const goals = { g1: { id: "g1", name: "Right split", preset: "split-r", unit: "deg", measure: "split", emoji: "🦵", createdAt: "2026-09-01", checkins: [{ id: "c1", date: "2026-10-01", photoId: "p1", value: 150 }, { id: "c2", date: "2026-10-30", photoId: "p2", value: 162 }] },
  gv: { id: "gv", name: "Hollow hold", preset: "hollow", unit: "sec", emoji: "💪", createdAt: "2026-09-01", checkins: [{ id: "c9", date: "2026-11-10", photoId: "pv", value: 20 }] },
  old: { id: "old", name: "Bridge", preset: "bridge", unit: "sec", emoji: "🌉", createdAt: "2026-09-01", checkins: [{ id: "c8", date: "2026-09-01", value: 8 }] } };
const photos = { p1: { url: "s1.jpg", goal: "g1" }, p2: { url: "s2.jpg", goal: "g1" }, pv: { url: "clip.mp4", kind: "video", goal: "gv" },
  k1: { url: "k1.jpg", card: "s-cartwheel", taken: "2026-10-01", at: "2026-10-01T10:00:00Z" }, k2: { url: "k2.jpg", card: "s-cartwheel", taken: "2026-10-20", at: "2026-10-20T10:00:00Z" } };
const ctx = (extra = {}) => ({ goals, photos, skills: {}, reviews: {}, ...extra });
const ids = (list) => list.map(p => `${p.id}:${p.why}`);

test("picture time: a starting picture until a goal has one, then a new one every two weeks", () => {
  assert.equal(W.PHOTO_EVERY_DAYS, 14); assert.equal(W.PHOTO_LATER_DAYS, 3);
  const s = { working: ["s-cartwheel", "split-r", "split-l", "a-aerial", "hollow"] };
  // cartwheel: last photo Oct 20 (24 days) · right split: Oct 30 (14 days) · left split and the aerial: none · hollow: a clip only
  assert.deepEqual(ids(W.photoPrompts(s, D, ctx())), ["split-l:first", "a-aerial:first", "hollow:first", "s-cartwheel:again", "split-r:again"], "starting pictures first, in her order; then the longest wait first");
  assert.deepEqual(ids(W.photoPrompts(s, "2026-11-12", ctx())), ["split-l:first", "a-aerial:first", "hollow:first", "s-cartwheel:again"], "13 days is not yet two weeks");
  const p = W.photoPrompts(s, D, ctx()).find(x => x.id === "s-cartwheel"); assert.equal(p.days, 24); assert.equal(p.last, "2026-10-20"); assert.equal(p.n, "Cartwheel");
  assert.deepEqual(ids(W.photoPrompts({ working: ["split-r"] }, D, ctx())), ["split-r:again"], "a goal that is off her list never asks (the old reminder asked for Bridge for ever)");
  assert.deepEqual(W.photoPrompts({ working: [] }, D, ctx()), []);
  assert.deepEqual(ids(W.photoPrompts({ working: ["s-cartwheel"] }, D, ctx({ skills: { "s-cartwheel": { id: "s-cartwheel", state: "checked" } } }))), [], "a teacher-checked skill is finished");
});

test("Later puts one goal off for three days, and only that one", () => {
  const s = { working: ["split-l", "s-cartwheel"], photoSnooze: { "split-l": "2026-11-16" } };
  assert.deepEqual(ids(W.photoPrompts(s, D, ctx())), ["s-cartwheel:again"]); assert.deepEqual(ids(W.photoPrompts(s, "2026-11-16", ctx())), ["split-l:first", "s-cartwheel:again"], "it asks again on the day");
  assert.deepEqual(ids(W.photoPrompts({ working: ["split-l"], photoSnooze: "junk" }, D, ctx())), ["split-l:first"], "a broken stored value is no snooze");
  assert.match(src("js/working.js"), /setSettings\(\{ photoSnooze: \{ \.\.\.cur, \[id\]: shiftDate\(todayStr\(\), PHOTO_LATER_DAYS\) \} \}\)/);
});

test("the prompt's words and its one tap to the camera", () => {
  const list = W.photoPrompts({ working: ["split-l", "s-cartwheel"] }, D, ctx()); const [first, again] = list.map(W.photoPromptHtml);
  assert.match(first, /Take your starting picture/); assert.match(first, /Left split/); assert.match(first, /onclick="gpCheckIn\('split-l'\)">📷 Take it/, "a measured goal opens its check-in sheet");
  assert.match(again, /Time for a progress picture/); assert.match(again, /your last one was 24 days ago/); assert.match(again, /<input type="file" accept="image\/\*" hidden onchange="lineupAdd\('s-cartwheel', this\)">/, "a skill goes straight to the camera or her photos");
  for (const h of [first, again]) { assert.match(h, /onclick="photoLater\('/); assert.match(h, /onclick="goalOpen\('/); }
  assert.equal(W.agoWords(14), "2 weeks ago"); assert.equal(W.agoWords(20), "20 days ago"); assert.equal(W.agoWords(35), "5 weeks ago");
  assert.equal(W.photoPromptsHtml([]), "", "nothing due: no card");
  const today = W.photoPromptsHtml(list, { cap: 1, more: true }); assert.match(today, /📸 Picture time/); assert.equal((today.match(/pp-row/g) || []).length, 1, "Today shows one"); assert.match(today, /showPage\('skills'\)">＋ 1 more on Skills ›/);
  assert.equal((W.photoPromptsHtml(list, { cap: 3 }).match(/pp-row/g) || []).length, 2);
  const row = W.goalRowHtml(W.goalRow("split-l", ctx({ settings: { working: ["split-l"] } })), "first"); assert.match(row, /📸 Starting picture needed/); assert.doesNotMatch(W.goalRowHtml(W.goalRow("split-l", ctx({ settings: { working: ["split-l"] } }))), /📸 Starting/);
});

test("Today's second choice: one of her own goals a day, taking turns", () => {
  const s = { working: ["s-cartwheel", "split-r", "a-aerial"] };
  const three = ["2026-11-13", "2026-11-14", "2026-11-15"].map(d => W.todayGoal(s, d, ctx()).id);
  assert.deepEqual([...three].sort(), ["a-aerial", "s-cartwheel", "split-r"], "three days, three goals"); assert.equal(W.todayGoal(s, "2026-11-16", ctx()).id, three[0], "then round again");
  assert.equal(W.todayGoal({ working: [] }, D, ctx()), null);
  assert.equal(W.todayGoal({ working: ["s-cartwheel"] }, D, ctx({ skills: { "s-cartwheel": { id: "s-cartwheel", state: "checked" } } })), null, "a finished one sits out");
  const h = W.todaySkillHtml(W.todayGoal({ working: ["a-aerial"] }, D, ctx({ settings: { working: ["a-aerial"] } }))); assert.match(h, /⭐ Or work on a skill/); assert.match(h, /onclick="goalOpen\('a-aerial'\)"/); assert.match(h, /Aerial/); assert.match(h, /all my goals ›/);
  assert.match(W.todaySkillHtml(null), /showPage\('skills'\);wkPick\(\)/, "an empty list offers to pick one");
  const home = src("js/views/home.js"); assert.match(home, /const skillPick=kind==="show"\?"":todaySkillHtml\(todayGoal\(S\.settings,today\)\)/, "not on a show day");
  assert.match(H.danceButtons({ kind: "home" }), /💃 Practice a dance/); assert.equal(H.DAY_ASK.studio, "No home practice on class days.", "the printed Pass quotes these words");
});

test("the audit's fixes stay fixed", () => {
  const home = src("js/views/home.js"), nav = src("js/nav.js"), css = src("css/app.css"), goals = src("js/goals.js"), html = src("index.html");
  assert.ok(home.indexOf('if(kind==="show"){') < home.indexOf('else if(cls.length){ what="🏫 Studio day"'), "a show day on a class weekday is a show day");
  assert.match(home, /\$\{ran\?PLAN_DONE:PLAN_DONE_QUIET\}/, "'you danced your solo' only when she ran it"); assert.doesNotMatch(home, /renderGoalReminder/);
  assert.match(src("js/pmode.js"), /if \(!ITEMS\.length\) return toast\("Nothing to practise today ⭐"\)/, "an empty plan (show day) no longer crashes practice mode");
  assert.match(src("js/app.js"), /todayStr\(\) !== day\) \{ day = todayStr\(\); renderAll\(\); \}/, "left open overnight, the app wakes on the new day");
  assert.match(src("js/player.js"), /plOnceLog\(\)">✓ I danced it without the music/); assert.match(src("js/bites.js"), /openPlayer\('solo',\{once:true\}\)/);
  assert.match(nav, /history\.pushState\(\{ p \}, ""\)/); assert.match(nav, /addEventListener\("popstate"/, "the phone's back button goes back a page");
  assert.match(css, /\.toast\{[^}]*z-index:80/, "a toast shows above sheets and stages"); assert.match(css, /--link:#7E4FD1/); assert.match(css, /\.btn\.sm\{[^}]*min-height:40px/); assert.match(css, /details\.acc>summary\{[^}]*min-height:46px/);
  assert.doesNotMatch(goals, /capture="environment"/, "a check-in can come from her photos, not only the camera"); assert.match(goals, /const pics = cs\.filter/, "the slider compares the first and newest picture");
  assert.doesNotMatch(html + src("js/views/dances.js") + src("js/stage.js"), /<button(?:(?!aria-label)[^>])*>✕<\/button>/, "every ✕ has a name");
  for (const id of ["photoPrompt", "goalReminder"]) assert.ok(html.includes(`id="${id}"`), id);
  assert.ok(html.indexOf('id="photoPrompt"') < html.indexOf('id="workingFold"'), "Picture time sits above My goals");
});
