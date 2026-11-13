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
  const home = src("js/views/home.js"); assert.match(home, /const tg=kind==="show"\?null:todayGoal\(S\.settings,today\); const skillPick=kind==="show"\?"":todaySkillHtml\(/, "not on a show day");
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

// ---- 1.68.0 (Jenya, Nov 13, after trying it: the purple row was confusing, "A trick" opened a hidden game, and nothing
// said how to work on a thing or showed that every little effort counts) ----
test("Today's row no longer sends her into Trick Quest; the two helpers belong to the dance, with one thing to think about", () => {
  const home = src("js/views/home.js"); const card = home.slice(home.indexOf('$("#todayCard").innerHTML='), home.indexOf("renderSeasonCard(today);"));
  assert.doesNotMatch(card, /tc\.go|qsStart|playOpen/, "no button on Today opens a game"); assert.match(card, /Not sure of the steps\?/); assert.match(card, /📹 Videos<\/button>/); assert.match(card, /🧠 Memorize<small>/);
  const f = H.focusLine({ id: "c1", tag: "feet", text: "Point your foot" }, "Solo"); assert.match(f, /One thing to think about in your solo/); assert.match(f, /🦶 Point your foot/); assert.match(f, /showMe\('c1'\)">Show me ›/); assert.equal(H.focusLine(null), "");
});

test("stepping stones: every dance, skill practice, picture and closed fix adds up, this week and ever", () => {
  const practice = { "2026-11-02": { runs: [{}], skills: ["split-r"] }, "2026-11-09": { runs: [{}], skills: ["split-r"] }, "2026-11-11": { runs: [{}, {}], skills: ["a-aerial", "split-r", "split-r"] }, junk: { runs: [{}] } };
  const corrections = { a: { status: "done", doneAt: "2026-11-11" }, b: { status: "working" }, c: { status: "done", doneAt: "2026-10-01" }, d: { status: "done", deleted: true, doneAt: "2026-11-11" } };
  const st = W.stones({ practice, photos, corrections }, D); // Nov 13 2026 is a Friday: the week began Mon Nov 9
  assert.deepEqual(st.week, { dances: 3, skills: 3, photos: 0, fixes: 1, n: 7 }); assert.deepEqual(st.all, { dances: 4, skills: 4, photos: 4, fixes: 2, n: 14 }, "a clip is not a picture; a removed fix is not a stone");
  assert.equal(W.stoneWords(st.week), "💃 3 dances · ⭐ 3 skill practices · ✅ 1 fix done"); assert.equal(W.stoneWords({ dances: 1, skills: 1, photos: 1, fixes: 0 }), "💃 1 dance · ⭐ 1 skill practice · 📸 1 picture");
  const h = W.stonesHtml(st); assert.match(h, /14 so far/); assert.match(h, /This week: 7 stones/); assert.equal((h.match(/<i><\/i>/g) || []).length, 7, "one stone on the path for each"); assert.match(h, /This is how a dance gets to look easy/);
  assert.match(W.stonesHtml(W.stones({ practice: {}, photos: {}, corrections: {} }, D)), /Your first one is one tap away/); assert.match(W.stonesHtml({ week: { n: 0 }, all: { n: 3 } }), /your next one is waiting/);
  assert.deepEqual(W.workedDates(practice, "split-r"), ["2026-11-02", "2026-11-09", "2026-11-11"]); assert.deepEqual(W.workedDates(practice, "nope"), []);
});

test("a goal says how to work on it today, takes ✓ I worked on it, and shows its stones", () => {
  const solo = json("dances").find ? json("dances").find(d => d.id === "solo") : null;
  const cart = W.goalRow("s-cartwheel", ctx({ settings: { working: ["s-cartwheel"] } })), how = W.goalHow(cart, { soloDance: solo });
  assert.equal(how.length, 3); assert.equal(how[0], cart.tip, "its tip first"); assert.match(how[2], /once with the music/);
  assert.match(W.goalHow(W.goalRow("split-l", ctx({ settings: { working: ["split-l"] } })))[0], /Warm up first/); assert.match(W.goalHow(W.goalRow("hollow", ctx({ settings: { working: ["hollow"] } })))[1], /Count your seconds/);
  assert.deepEqual(W.goalHow(W.goalRow("a-aerial", ctx({ settings: { working: ["a-aerial"] } }))), [], "the aerial's next step is its how");
  const w = W.workHtml(cart, { dates: ["2026-11-02", "2026-11-11"], today: D, steps: how }); assert.match(w, /🪜 How to work on it today/); assert.match(w, /gpWorked\('s-cartwheel'\)">✓ I worked on it today/); assert.match(w, /2 stepping stones<\/b> · last one 2 days ago/); assert.match(w, /📸 2 pictures/);
  assert.equal((w.match(/<i class="/g) || []).length, 14); assert.equal((w.match(/<i class="on/g) || []).length, 2, "two filled days in the last two weeks");
  const done = W.workHtml(cart, { dates: [D], today: D, steps: how }); assert.match(done, /✅ Worked on it today/); assert.match(done, /one today ⭐/); assert.match(W.workHtml(cart, { dates: [], today: D }), /No stepping stones yet/);
  const t = W.todaySkillHtml(cart, { dates: [D], today: D, how: how[0] }); assert.match(t, /today-skill done/); assert.match(t, /🪜 1 time so far · 📸 2 pictures · tap to see how ›/); assert.match(W.todaySkillHtml(cart, { dates: [], today: D }), /your first time/);
  assert.match(src("js/working.js"), /storeSet\("practice", today, \{ \.\.\.rec, skills: on \? \[\.\.\.have, id\] : have\.filter\(x => x !== id\) \}\)/);
  const html = src("index.html"); for (const id of ["gpWork", "stonesCard"]) assert.ok(html.includes(`id="${id}"`), id); assert.ok(html.indexOf('id="gpNext"') < html.indexOf('id="gpWork"') && html.indexOf('id="gpWork"') < html.indexOf('id="gpPhotos"'));
});

// ---- 1.69.0 (Jenya, Nov 13: "add per-dance progress to Today") ----
test("per-dance progress: dances to the end, fixes done and parts by heart, for the competition dances only", () => {
  const list = [{ id: "solo", name: "Solo · Stay a Little Longer", loops: [{ n: "Soft half", a: 0, b: 48 }, { n: "Tricks half", a: 48, b: 120 }], cues: [{ t: 1 }] }, { id: "trio", name: "Trio · Enjoy the Silence" }, { id: "wf-ballet", name: "Winter Formal · Ballet III class dance" }];
  const practice = { "2026-11-02": { runs: [{ danceId: "solo" }] }, "2026-11-11": { runs: [{ danceId: "solo" }, {}, { danceId: "trio" }] }, "2026-11-13": { runs: [{ danceId: "trio" }] }, junk: { runs: [{ danceId: "solo" }] } };
  const corrections = { a: { danceId: "solo", status: "done" }, b: { danceId: "solo", status: "working" }, c: { danceId: "solo", status: "new" }, d: { danceId: "solo", status: "done", deleted: true }, e: { danceId: "trio", status: "working" } };
  const rows = W.danceProgress(list, { practice, corrections, settings: { memo: { solo: { known: ["Soft half", "Gone part"] } } } }, D);
  assert.deepEqual(rows.map(r => r.id), ["solo", "trio"], "class dances are left out");
  assert.deepEqual(rows[0], { id: "solo", n: "Solo", runs: 3, week: 2, last: "2026-11-11", fixesDone: 1, fixesAll: 3, known: 1, parts: 2 }, "a run with no dance named is the solo's");
  assert.deepEqual(rows[1], { id: "trio", n: "Trio", runs: 2, week: 2, last: "2026-11-13", fixesDone: 0, fixesAll: 1, known: 0, parts: 0 });
  const h = W.danceProgressHtml(rows, D); assert.match(h, /💃 My dances are growing/); assert.match(h, /showPage\('dances'\);danceOpen\('solo'\)/);
  assert.match(h, /🎵 Danced 3 times · 2 this week · last 2 days ago/); assert.match(h, /✅ 1 of 3 fixes done · 🧠 1 of 2 parts by heart/); assert.match(h, /width:33%/); assert.match(h, /last today ⭐/); assert.match(h, /✅ 0 of 1 fix done</);
  assert.match(W.danceProgressHtml(W.danceProgress([{ id: "pitch-jazz", name: "PITCH · Jazz group · Groove Is in the Heart" }], { practice: {}, corrections: {}, settings: {} }, D), D), /PITCH · Jazz group<\/b><small>🎵 Not danced here yet · tap to open it/, "two group dances share the team's name, so the group is named"); assert.equal(W.danceProgressHtml([], D), ""); assert.equal(W.danceLabel({ name: "Solo · Stay a Little Longer" }), "Solo");
  const html = src("index.html"); assert.ok(html.indexOf('id="goalReminder"') < html.indexOf('id="danceProgress"') && html.indexOf('id="danceProgress"') < html.indexOf('id="stonesCard"'));
});
