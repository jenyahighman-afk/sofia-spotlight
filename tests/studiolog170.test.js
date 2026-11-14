// 1.70.0 (Jenya, Nov 13): 🏫 the studio log (the last two weeks, a few taps, emojis over words), its nudge on Today, what
// it counts for, and 🧠 Memorize for each dance. Reads files and pure functions only: every date is passed in.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installEnv } from "./_env.mjs";
installEnv();
const json = (f) => JSON.parse(readFileSync(new URL("../data/" + f + ".json", import.meta.url), "utf8"));
const src = (f) => readFileSync(new URL("../" + f, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const { applyData, DATA_FILES } = await import("../js/data.js");
const got = {}; for (const f of DATA_FILES) got[f] = json(f); applyData(got);
const L = await import("../js/studiolog.js");
const W = await import("../js/working.js");
const D = "2026-11-13"; // a Friday

test("a day's studio log: always the same fields, saved inside that day's practice record", () => {
  assert.deepEqual(L.studioRec({}, D), { classes: [], dances: [], skills: [], feel: "", note: "", skip: false });
  assert.deepEqual(L.studioRec({ [D]: { studio: { dances: ["solo", "solo", 3], skills: "x", feel: "nope", note: 7 } } }, D), { classes: [], dances: ["solo"], skills: [], feel: "", note: "7", skip: false }, "whatever is stored reads safely");
  const home = { done: ["a"], note: "home note", runs: [{ danceId: "solo" }], skills: ["split-r"] };
  const one = L.withStudio(home, { dances: ["trio"] }); assert.deepEqual(one.studio, { classes: [], dances: ["trio"], skills: [], feel: "", note: "" });
  assert.deepEqual([one.done, one.note, one.runs, one.skills], [home.done, home.note, home.runs, home.skills], "the day's home practice is untouched");
  const two = L.withStudio(one, { feel: "great", note: "  x".repeat(100) }); assert.deepEqual(two.studio.dances, ["trio"], "a patch keeps the rest"); assert.equal(two.studio.feel, "great"); assert.equal(two.studio.note.length, L.NOTE_MAX);
  assert.deepEqual(L.withStudio(undefined, { skills: ["a-aerial"] }), { done: [], note: "", runs: [], studio: { classes: [], dances: [], skills: ["a-aerial"], feel: "", note: "" } }, "a day with no record yet gets one");
  assert.equal(L.withStudio(undefined, { skip: true }).studio.skip, true); assert.equal(L.withStudio(L.withStudio(undefined, { skip: true }), { dances: ["solo"] }).studio.skip, undefined, "logging something lifts the skip");
  assert.deepEqual(L.toggleIn(["a"], "b"), ["a", "b"]); assert.deepEqual(L.toggleIn(["a", "b"], "a"), ["b"]);
  assert.equal(L.hasLog(L.studioRec({ [D]: { studio: { skip: true } } }, D)), false); assert.equal(L.hasLog(L.studioRec({ [D]: { studio: { feel: "ok" } } }, D)), true);
});

test("the last two weeks can be changed at any time; the nudge asks about the last three days only", () => {
  const days = L.logDays(D); assert.equal(L.LOG_DAYS, 14); assert.equal(days.length, 14); assert.equal(days[0], "2026-10-31"); assert.equal(days[13], D);
  const cls = (d) => [1, 2, 3, 6].includes(new Date(d + "T00:00:00").getDay()); // Mon Tue Wed Sat
  assert.deepEqual(L.nudgeDays({}, D, cls), ["2026-11-11"], "Fri: Wednesday's class is the only one in the last three days");
  assert.deepEqual(L.nudgeDays({}, "2026-11-10", cls), ["2026-11-10", "2026-11-09"], "newest first, today included");
  assert.deepEqual(L.nudgeDays({ "2026-11-11": { studio: { dances: ["solo"] } } }, D, cls), [], "logged: not asked");
  assert.deepEqual(L.nudgeDays({ "2026-11-11": { studio: { skip: true } } }, D, cls), [], "🚫 nothing to log: not asked again");
  assert.equal(L.nudgeHtml([], D), ""); const n = L.nudgeHtml(["2026-11-12", "2026-11-11"], D);
  assert.match(n, /🏫 Yesterday/); assert.match(n, /openStudioLog\('2026-11-12'\)">✏️ Log/); assert.match(n, /slSkip\('2026-11-12'\)" aria-label="Nothing to log">🚫/); assert.match(n, /＋1/);
  assert.equal(L.dayWords(D, D), "Today");
});

test("the sheet: a strip of 14 days, chips for dances and goals, four faces, a note; a tap saves", () => {
  const practice = { "2026-11-11": { studio: { dances: ["trio"], skills: ["a-aerial"], feel: "good", note: "new lift" } } };
  const h = L.sheetHtml({ date: "2026-11-11", today: D, practice, list: [{ id: "solo", n: "Solo" }, { id: "trio", n: "Trio" }], goals: [{ id: "a-aerial", n: "Aerial", ic: "🦋" }, { id: "split-r", n: "Right split", ic: "🦵" }], isClassDay: (d) => d === "2026-11-11" });
  assert.equal((h.match(/class="sl-day/g) || []).length, 14); assert.equal((h.match(/sl-day on has/g) || []).length, 1, "the chosen day, marked as logged"); assert.equal((h.match(/🏫<\/span>/g) || []).length, 1, "class days carry 🏫");
  assert.match(h, /onclick="slDance\('trio'\)" aria-pressed="true">✅ Trio/); assert.match(h, /onclick="slDance\('solo'\)" aria-pressed="false">Solo/);
  assert.match(h, /onclick="slSkill\('a-aerial'\)" aria-pressed="true">✅ 🦋 Aerial/); assert.match(h, /slSkill\('split-r'\)" aria-pressed="false">🦵 Right split/);
  assert.equal((h.match(/<button class="sl-feel/g) || []).length, 4); assert.match(h, /sl-feel on" onclick="slFeel\('good'\)"/); assert.match(h, /value="new lift" onchange="slNote\(this\.value\)"/);
  assert.doesNotMatch(h, />Save</, "no Save button: every tap saves"); assert.ok(h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().split(" ").filter(w => /^[A-Za-z]{2,}/.test(w)).length < 40, "few words");
  const s = src("js/studiolog.js"); assert.match(s, /await storeSet\("practice", date, withStudio\(S\.practice\[date\], patch\)\)/); assert.match(s, /cur = DATE\.test\(String\(date\)\) && logDays\(today\)\.includes\(date\) \? date : today/, "only the last two weeks open");
});

test("studio work counts: stepping stones, a skill's days, a dance's row", () => {
  const practice = { "2026-11-09": { runs: [{ danceId: "solo" }], skills: ["split-r"], studio: { dances: ["solo", "pitch-jazz"], skills: ["split-r", "a-aerial"] } }, "2026-11-02": { studio: { dances: ["pitch-jazz"], skills: [] } } };
  const st = W.stones({ practice, photos: {}, corrections: {} }, D);
  assert.deepEqual(st.week, { dances: 3, skills: 2, notes: 0, photos: 0, fixes: 0, n: 5 }, "a skill worked on at home and at the studio the same day is one stone"); assert.equal(st.all.dances, 4);
  assert.deepEqual(W.workedDates(practice, "a-aerial"), ["2026-11-09"]); assert.deepEqual(W.workedDates(practice, "split-r"), ["2026-11-09"]);
  const rows = W.danceProgress([{ id: "solo", name: "Solo · X" }, { id: "pitch-jazz", name: "PITCH · Jazz group · Groove" }], { practice, corrections: {}, settings: {} }, D);
  assert.deepEqual([rows[0].runs, rows[0].studio, rows[0].week], [1, 1, 2]); assert.deepEqual([rows[1].runs, rows[1].studio, rows[1].week, rows[1].last], [0, 2, 1, "2026-11-09"]);
  const h = W.danceProgressHtml(rows, D); assert.match(h, /🎵 Danced 1 time · 🏫 1 time at the studio · 2 this week/); assert.match(h, /PITCH · Jazz group<\/b><small>🏫 2 times at the studio · 1 this week · last 4 days ago/);
});

test("the ways in, the wiring, and 🧠 Memorize for each dance", () => {
  const home = src("js/views/home.js"), html = src("index.html");
  assert.match(home, /onclick="openStudioLog\(\)">🏫 ✏️ Log studio work<\/button>/); assert.ok(html.includes('id="studioNudge"')); assert.ok(html.indexOf('id="studioNudge"') < html.indexOf('id="goalReminder"'));
  assert.match(src("sw.js"), /"\.\/js\/studiolog\.js"/); assert.match(src("js/app.js"), /guard\("home", renderStudioNudge, "studiolog"\)/);
  assert.match(home, /memoDances\(dances\(\)\)\.filter\(d=>d\.id==="solo"\|\|d\.id==="trio"\)\.map\(memoBtn\)/, "one Memorize for the solo and one for the trio, not the day's turn only");
  assert.match(src("js/version.js"), /APP_VERSION = "1\.(7\d|[89]\d)/); assert.match(src("README.md"), /\*\*1\.70\.0: 🏫 Studio log/);
});

// ---- 1.71.0 (Jenya, Nov 13: the log is for writing down what the teacher said, working on it at home, and showing it) ----
test("📝 Teacher said: a note from class is a correction with its class day, what it is about and one emoji", () => {
  const n = L.noteRec({ about: "trio", text: "  Point   your foot on the lift ", tag: "", date: "2026-11-11", id: "c1" });
  assert.deepEqual(n, { id: "c1", danceId: "trio", text: "Point your foot on the lift", tag: "feet", source: "class", date: "2026-11-11", status: "working", studio: true }, "no emoji picked: worked out from the words");
  assert.equal(L.noteRec({ about: "skill:a-aerial", text: "Kick harder", tag: "energy", date: D, id: "c2" }).tag, "energy"); assert.equal(L.aboutSkill("skill:a-aerial"), "a-aerial"); assert.equal(L.aboutSkill("trio"), "");
  for (const bad of [{ about: "trio", text: "  ", date: D, id: "x" }, { about: "", text: "hi", date: D, id: "x" }, { about: "trio", text: "hi", date: "soon", id: "x" }]) assert.equal(L.noteRec(bad), null);
  assert.equal(L.noteRec({ about: "solo", text: "x".repeat(400), date: D, id: "c3" }).text.length, L.SAID_MAX);
  const all = { a: { id: "a", studio: true, date: "2026-11-09", status: "working" }, b: { id: "b", studio: true, date: "2026-11-11", status: "done" }, c: { id: "c", studio: true, date: "2026-11-11", status: "working", deleted: true }, d: { id: "d", date: "2026-11-12", status: "working" }, e: { id: "e", studio: true, date: "2026-11-11", status: "working" } };
  assert.deepEqual(L.classNotes(all).map(c => c.id), ["e", "b", "a"], "class notes only, newest first"); assert.deepEqual(L.classNotes(all, { open: true }).map(c => c.id), ["e", "a"]); assert.deepEqual(L.classNotes(all, { date: "2026-11-09" }).map(c => c.id), ["a"]);
});

test("the sheet takes a teacher's note in a few taps and offers any other skill", () => {
  const practice = { "2026-11-11": { studio: { dances: ["trio"], skills: ["a-aerial"] } } }, list = [{ id: "solo", n: "Solo" }, { id: "trio", n: "Trio" }], goals = [{ id: "a-aerial", n: "Aerial", ic: "🦋" }];
  const said = [{ id: "c1", danceId: "trio", text: "Point your foot", tag: "feet" }];
  const h = L.sheetHtml({ date: "2026-11-11", today: D, practice, list, goals, said, about: "skill:a-aerial", tag: "eyes", label: (a) => a === "trio" ? "Trio" : "", more: [{ label: "🤸 Acro", items: [{ id: "a-cartwheel", n: "Cartwheel" }] }] });
  assert.match(h, /📝 <span class="sl-labw">Teacher said<\/span>/); assert.match(h, /🦶 Point your foot<small>Trio<\/small>/); assert.match(h, /slSaidDel\('c1'\)/);
  assert.equal((h.match(/onclick="slAbout\('/g) || []).length, 2, "about: what she logged for that day"); assert.match(h, /sl-chip sm on" onclick="slAbout\('skill:a-aerial'\)"/); assert.match(h, /onclick="slAbout\('trio'\)" aria-pressed="false">Trio/);
  assert.equal((h.match(/class="sl-tag/g) || []).length - 1, 9, "nine emoji, one tap"); assert.match(h, /sl-tag on" onclick="slTag\('eyes'\)" aria-label="Eyes"/); assert.match(h, /onclick="slSaidAdd\(\)" aria-label="Add">＋/);
  assert.match(h, /<details class="sl-more"><summary>＋ ⭐<\/summary><div class="sl-mlab">🤸 Acro<\/div>.*slSkill\('a-cartwheel'\)/s, "＋ any other skill");
  const empty = L.sheetHtml({ date: D, today: D, practice: {}, list, goals }); assert.equal((empty.match(/onclick="slAbout\('/g) || []).length, 2, "nothing logged yet: every dance"); assert.match(empty, /sl-chip sm on" onclick="slAbout\('solo'\)"/);
});

test("📝 From my teachers on Today: 💪 worked on it today, ✅ got it, and a class-day reminder to show it", () => {
  const notes = [{ id: "c1", danceId: "trio", text: "Point your foot", tag: "feet", date: "2026-11-11" }, { id: "c2", danceId: "skill:a-aerial", text: "Kick harder", tag: "energy", date: "2026-11-09" }];
  const practice = { "2026-11-12": { notes: ["c1"] }, [D]: { notes: ["c1", "c1"] }, junk: { notes: ["c1"] } };
  assert.deepEqual(L.noteDays(practice, "c1"), ["2026-11-12", D]); assert.deepEqual(L.noteDays(practice, "c2"), []);
  const h = L.notesCardHtml(notes, { today: D, practice, label: (a) => a === "trio" ? "Trio" : "🦋 Aerial" });
  assert.match(h, /📝 From my teachers/); assert.match(h, /🦶 Point your foot<\/b><small>Trio · 🏫 Wed, Nov 11 · 💪 ×2/); assert.match(h, /tn-btn on" onclick="tnWorked\('c1'\)" aria-pressed="true"/); assert.match(h, /onclick="tnWorked\('c2'\)" aria-pressed="false"/); assert.match(h, /onclick="tnGot\('c2'\)" aria-label="Got it">✅/);
  assert.match(h, /💪 = I worked on it today · ✅ = got it/); assert.match(L.notesCardHtml(notes, { today: D, practice, classToday: true }), /🏫 Class today: show them you worked on these!/);
  assert.equal(L.notesCardHtml([], { today: D }), ""); assert.match(L.notesCardHtml(Array.from({ length: 6 }, (_, i) => ({ id: "n" + i, text: "t", date: D })), { today: D }), /＋ 2 more on your dances/);
  const st = W.stones({ practice, photos: {}, corrections: {} }, D); assert.equal(st.week.notes, 2, "a note worked on is one stone a day"); assert.match(W.stoneWords(st.week), /💪 2 teacher notes worked on/);
  const cart = W.goalRow("s-cartwheel", { goals: {}, photos: {}, skills: {}, reviews: {}, settings: { working: ["s-cartwheel"] } });
  assert.match(W.workHtml(cart, { dates: [], today: D, notes: [{ text: "Head up" }] }), /📝 My teacher said<\/b><p>Head up<\/p>/);
  const html = src("index.html"); assert.ok(html.indexOf('id="studioNudge"') < html.indexOf('id="teacherNotes"') && html.indexOf('id="teacherNotes"') < html.indexOf('id="goalReminder"'));
  assert.match(src("js/studiolog.js"), /storeSet\("practice", today, \{ \.\.\.rec, notes: on \? \[\.\.\.have, id\] : have\.filter\(x => x !== id\) \}\)/);
});

// ---- 1.72.0 (Jenya, Nov 13: she liked the aerial drill videos; they were hidden in the Drill box) ----
test("🎬 a goal's drill videos sit on its page, the aerial's next step first", async () => {
  const DR = await import("../js/drills.js");
  const drills = { d1: { url: "https://www.youtube.com/watch?v=aaaaaaaaaaa", host: "youtube", vid: "aaaaaaaaaaa", skill: "a-aerial", note: "Kick the back leg", at: "2026-10-01" }, d2: { url: "https://www.youtube.com/watch?v=bbbbbbbbbbb", host: "youtube", vid: "bbbbbbbbbbb", skill: "one-hand-far", note: "", at: "2026-10-05" }, d3: { url: "https://x.test/p", host: "other", skill: "s-cartwheel", at: "2026-10-02" }, d4: { url: "", skill: "a-aerial" }, d5: { url: "https://y.test", host: "other", skill: "a-aerial", deleted: true } };
  const aerial = W.goalRow("a-aerial", { goals: {}, photos: {}, skills: {}, reviews: {}, settings: { working: ["a-aerial"], aerial: ["cartwheel-clean"] } });
  const ids = W.drillIds(aerial); assert.equal(ids[0], aerial.aerial.next.id, "the next step's videos first"); assert.equal(ids[1], "a-aerial"); assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(DR.drillsForGoal(ids, drills).map(p => p.id), aerial.aerial.next.id === "one-hand-far" ? ["d2", "d1"] : ["d1", "d2"]);
  assert.deepEqual(DR.drillsForGoal(W.drillIds(W.goalRow("s-cartwheel", { goals: {}, photos: {}, skills: {}, reviews: {}, settings: { working: ["s-cartwheel"] } })), drills).map(p => p.id), ["d3"]); assert.deepEqual(W.drillIds(null), []);
  const h = DR.goalVideosHtml(DR.drillsForGoal(ids, drills)); assert.match(h, /🎬 Watch a drill first/); assert.match(h, /2 saved/); assert.match(h, /drillOpen\('d1'\)/); assert.match(h, /<small>Kick the back leg<\/small>/); assert.equal(DR.goalVideosHtml([]), "");
  assert.match(W.workHtml(aerial, { dates: [], today: D, videos: h }), /gw-vids/); assert.match(W.todaySkillHtml(aerial, { dates: [], today: D, videos: 2 }), /🎬 2 videos/); assert.doesNotMatch(W.todaySkillHtml(aerial, { dates: [], today: D }), /🎬/);
  assert.match(src("js/goalpage.js"), /videos: goalVideosHtml\(drillsForGoal\(drillIds\(r\), S\.drills\)\)/);
});

// ---- 1.74.0 (Jenya, Nov 13: a note is tied to the class, its teacher, and optionally the dance or skill) ----
test("a note starts from the class: one tap gives the class and its teacher; the dance or skill is optional", () => {
  const classes = json("classes"); for (const c of classes) assert.ok(c.teacher && c.teacher.length > 3, c.name + " has its teacher (from the portal's feed)");
  assert.ok(!classes.some(c => /hip hop/i.test(c.name)), "hip hop is off the weekly schedule");
  const weekly = [{ day: 1, t: "4:30–5:30", name: "Mini Ballet III", teacher: "Thyra Demetrick" }, { day: 1, t: "5:30–6:30", name: "Mini/Jr Acro II/III", teacher: "Ava Wine" }, { day: 3, t: "6:30–7:30", name: "Mini Contemporary III", teacher: "Brittany Mains" }];
  const oneOffs = [{ id: "x", kind: "class", name: "Solo rehearsal with Angie", start: "2026-11-21", time: "9:30–10:00", teacher: "Angie" }];
  assert.deepEqual(L.classesOn("2026-11-16", { weekly, oneOffs }), [{ name: "Mini Ballet III", label: "Ballet III", t: "4:30–5:30", teacher: "Thyra Demetrick" }, { name: "Mini/Jr Acro II/III", label: "Acro II/III", t: "5:30–6:30", teacher: "Ava Wine" }], "Monday's classes, with times and teachers");
  assert.deepEqual(L.classesOn("2026-11-21", { weekly, oneOffs }).map(c => [c.name, c.teacher]), [["Solo rehearsal with Angie", "Angie"]], "a booked private carries its own teacher");
  assert.deepEqual(L.classesOn("2026-11-19", { weekly, oneOffs }).map(c => c.t), ["", "", ""], "a day with nothing booked (a make-up): every weekly class, no time");
  const n = L.noteRec({ cls: "Mini/Jr Acro II/III", teacher: "Ava Wine", text: "Push through the shoulders", date: D, id: "c1" });
  assert.deepEqual(n, { id: "c1", danceId: "class:Mini/Jr Acro II/III", text: "Push through the shoulders", tag: n.tag, source: "Ava Wine", date: D, status: "working", studio: true, cls: "Mini/Jr Acro II/III" }, "class, teacher and day with no extra tap");
  const withSkill = L.noteRec({ about: "skill:a-aerial", cls: "Mini/Jr Acro II/III", teacher: "Ava Wine", text: "Kick harder", date: D, id: "c2" }); assert.equal(withSkill.danceId, "skill:a-aerial"); assert.equal(withSkill.cls, "Mini/Jr Acro II/III"); assert.equal(withSkill.source, "Ava Wine");
  assert.equal(L.noteRec({ text: "hi", date: D, id: "c3" }), null, "no class and nothing it is about: no note"); assert.equal(L.aboutClass("class:Mini Ballet III"), "Mini Ballet III"); assert.equal(L.shortClass("Mini/Jr Acro II/III"), "Acro II/III");
  const cs = L.classesOn("2026-11-16", { weekly, oneOffs }), practice = { "2026-11-16": { studio: { classes: ["Mini Ballet III"] } } };
  const h = L.sheetHtml({ date: "2026-11-16", today: D, practice, list: [{ id: "solo", n: "Solo" }], goals: [], classes: cs, cls: "Mini/Jr Acro II/III" });
  assert.match(h, /onclick="slCls\(0\)" aria-pressed="false">✅ 🏫 Ballet III<small>4:30–5:30<\/small>/, "✅ = she was there"); assert.match(h, /sl-chip on" onclick="slCls\(1\)" aria-pressed="true">🏫 Acro II\/III/); assert.match(h, /👩‍🏫 Ava Wine/);
  assert.match(h, /data-about="" data-cls="Mini\/Jr Acro II\/III" onclick="slSaidAdd\(\)"/, "the dance or skill is not pre-picked"); assert.match(h, /aria-pressed="false">Solo/);
  const card = L.notesCardHtml([n], { today: D, practice: {}, label: () => "🏫 Acro II/III" }); assert.match(card, /🏫 Acro II\/III · 👩‍🏫 Ava Wine · 🏫 Today/);
  assert.equal(L.hasLog(L.studioRec(practice, "2026-11-16")), true, "being at a class is a log");
  const plan = json("plan15"); assert.ok(plan.checkpoints.some(c => /DRESS REHEARSAL at the studio, in full costume/.test(c.t))); assert.ok(plan.checkpoints.some(c => c.show && /PITCH groups on stage/.test(c.t)));
  assert.doesNotMatch(src("data/classes.json") + src("data/events.json") + src("README.md") + src("js/studiolog.js"), /beclassmanager\.com\/api\/public\/calendars/, "the portal's private feed link is not in the repository");
});

// ---- 1.75.0 (Jenya, Nov 13: every card starts folded, with its name and maybe one line under it) ----
test("Today's and Skills' cards start folded, each with a count and one line", () => {
  const html = src("index.html");
  for (const [fold, inner] of [["teacherFold", "teacherNotes"], ["photoFold", "goalReminder"], ["danceFold", "danceProgress"], ["stonesFold", "stonesCard"], ["photoFoldSk", "photoPrompt"]]) {
    const m = new RegExp(`<details class="card acc [a-z]+ tfold" id="${fold}"( hidden)?><summary>.*?</summary><div class="[a-z-]+" id="${inner}"></div></details>`).exec(html); assert.ok(m, fold + " wraps " + inner); assert.doesNotMatch(m[0], / open/, fold + " is closed to start");
  }
  assert.doesNotMatch(html, /id="(workingFold|albumFold)" open/, "My goals and My album start closed too"); for (const id of ["teacherSub", "photoSub", "danceSub", "stonesSub", "workingSub", "albumSub", "photoSubSk"]) assert.ok(html.includes(`id="${id}"`), id);
  assert.ok(html.indexOf('id="todayCard"') < html.indexOf('id="teacherFold"') && !/<details[^>]*id="todayCard"/.test(html), "the one card on top stays open");
  assert.equal(W.photoSub([{ why: "first", n: "Aerial" }, { why: "again", n: "Right split" }]), "Starting picture: Aerial ＋1"); assert.equal(W.photoSub([{ why: "again", n: "Right split" }]), "New picture: Right split"); assert.equal(W.photoSub([]), "");
  assert.equal(W.stonesSub({ week: { n: 8 }, all: { n: 13 } }), "This week: 8 stones"); assert.equal(W.stonesSub({ week: { n: 1 }, all: { n: 1 } }), "This week: 1 stone"); assert.equal(W.stonesSub({ week: { n: 0 }, all: { n: 5 } }), "Your next one is waiting"); assert.equal(W.stonesSub({ week: { n: 0 }, all: { n: 0 } }), "Your first one is one tap away");
  assert.equal(W.danceSub([{ n: "Solo", runs: 4, studio: 0 }, { n: "Trio", runs: 0, studio: 2 }, { n: "PITCH · Jazz group", runs: 0, studio: 0 }, { n: "PITCH · Contemporary group", runs: 1, studio: 0 }]), "Solo 4× · Trio 2× · Jazz 0×");
  assert.equal(W.goalsSub([{ n: "Cartwheel" }, { n: "Aerial" }, { n: "Right split" }]), "Cartwheel · Aerial · Right split"); assert.ok(W.goalsSub(Array.from({ length: 8 }, () => ({ n: "Handstand hold" }))).length <= 46);
  assert.equal(W.albumSub([{ count: 2 }, { count: 0 }, { count: 1 }]), "2 of 3 with a picture"); assert.equal(W.albumSub([]), "");
  assert.equal(L.notesSub([{ text: "Push through the shoulders in the handstand, every single time" }]), "Push through the shoulders in the handstand…"); assert.equal(L.notesSub([{ text: "x" }], true), "🏫 Class today: show them!"); assert.equal(L.notesSub([]), "");
  assert.match(src("js/goalpage.js"), /TODAY_FOLDS = \["teacherFold", "photoFold", "danceFold", "stonesFold"\]/); assert.match(src("js/goalpage.js"), /initFolds\("spotlight:todayFolds", TODAY_FOLDS\)/);
});

// ---- 1.76.0 (Jenya, Nov 14: fold the goal page's cards too; the large group dances on Today, and what to do at home) ----
test("a goal's page folds, and her group dances are one tap away on Today", async () => {
  const html = src("index.html"), GP = await import("../js/goalpage.js");
  for (const k of ["gpNext", "gpWork", "gpPhotos", "gpCoach"]) { const m = new RegExp(`<details class="card acc [a-z]+ gfold" id="${k}Fold"><summary>.*?id="${k}T".*?id="${k}Sub"></small></span></summary><div id="${k}"></div></details>`).exec(html); assert.ok(m, k + " is a fold"); assert.doesNotMatch(m[0], / open/); }
  assert.deepEqual(GP.GOAL_FOLDS, ["gpNextFold", "gpWorkFold", "gpPhotosFold", "gpCoachFold"]); assert.match(src("js/goalpage.js"), /initFolds\("spotlight:goalFolds", GOAL_FOLDS\)/);
  const ctx = { goals: {}, photos: { k1: { url: "k1.jpg", card: "s-cartwheel", taken: "2026-10-01", at: "2026-10-01T10:00:00Z" } }, skills: {}, reviews: {} };
  const cart = W.goalRow("s-cartwheel", { ...ctx, settings: { working: ["s-cartwheel"] } }), aerial = W.goalRow("a-aerial", { ...ctx, settings: { working: ["a-aerial"] } });
  const f = GP.goalFoldLines(cart, { dates: ["2026-11-11", D], today: D, tips: [{ text: "Head up until the hands go down" }], videos: 2 });
  assert.deepEqual(f, { nextT: "How it's going", next: cart.how, workT: "🪜 How to work on it today", work: "2 stepping stones · one today ⭐ · 🎬 2 videos", photos: "1 picture", coach: "Head up until the hands go down" });
  const a = GP.goalFoldLines(aerial, { dates: [], today: D }); assert.equal(a.nextT, "What's next"); assert.match(a.next, /^Step 1 of \d+ · Next: /); assert.equal(a.workT, "🪜 My stepping stones"); assert.equal(a.work, "No stepping stones yet"); assert.match(a.photos, /take your starting picture/); assert.match(a.coach, /One thing you did well/);
  const dances = json("dances"), groups = W.groupDances(dances); assert.deepEqual(groups, [{ id: "pitch-jazz", n: "Jazz" }, { id: "pitch-contemp", n: "Contemporary" }], "the competition dances that are not her solo or trio; no class dances");
  const h = W.groupButtonsHtml(groups, ["pitch-jazz"]); assert.match(h, /👯 My group dances/); assert.match(h, /btn sm ghost" onclick="openPlayer\('pitch-jazz',\{once:true\}\)">✅ Jazz/); assert.match(h, /btn sm violet" onclick="openPlayer\('pitch-contemp',\{once:true\}\)">▶ Contemporary/); assert.ok(h.includes(W.GROUP_HOME)); assert.equal(W.groupButtonsHtml([]), "");
  assert.match(W.GROUP_HOME, /your own part with the music/); assert.match(src("js/views/dances.js"), /group-home">🏠 \$\{GROUP_HOME\}/, "the same line on a group dance's page");
  assert.match(src("js/views/home.js"), /kind==="show"\?"":groupButtonsHtml\(groupDances\(dances\(\)\)/);
  const pc = dances.find(d => d.id === "pitch-contemp"); assert.equal(pc.song, "Listening Chair"); assert.equal(pc.choreo, "Brittany Mains"); assert.doesNotMatch(pc.notes, /TBD/);
});

// ---- 1.77.0 (Jenya, Nov 14: add Ms. Angie's two notes; no day says "no home practice") ----
test("Ms. Angie's two notes ship as class notes; a class day welcomes one thing at home", async () => {
  const C = await import("../js/corrections.js"), H = await import("../js/views/home.js");
  const solo = json("dances").find(d => d.id === "solo"), notes = C.classNotesFromDance(solo);
  assert.equal(notes.length, 2); assert.deepEqual(notes.map(n => n.tag), ["timing", "other"]);
  for (const n of notes) { assert.equal(n.studio, true); assert.equal(n.source, "Ms. Angie"); assert.equal(n.date, "2026-11-08"); assert.equal(n.danceId, "solo"); assert.equal(n.status, "working"); assert.equal(n.pinned, undefined, "she can close it herself"); assert.match(n.id, /^c-solo-/); }
  assert.match(notes[0].text, /^Timing: finish every shape on the beat/); assert.match(notes[1].text, /^Add texture/);
  assert.deepEqual(L.classNotes(Object.fromEntries(notes.map(n => [n.id, n])), { open: true }).length, 2, "they show under From my teachers");
  assert.deepEqual(C.classNotesFromDance({ id: "x" }), []); assert.match(src("js/corrections.js"), /for \(const c of classNotesFromDance\(d\)\) \{ if \(!S\.corrections\[c\.id\]\)/, "copied once: one she took off stays off");
  assert.equal(H.DAY_ASK.studio, "Class comes first today. Got a chance at home? Dance one thing."); for (const v of Object.values(H.DAY_ASK)) assert.doesNotMatch(v, /no home practice/i);
  const pass = json("pass"); assert.doesNotMatch(JSON.stringify(pass.tips), /No home practice/); assert.ok(pass.parts.find(p => p.id === "week").lines.filter(l => /No home practice/i.test(l)).every(l => /Show day/.test(l)), "only show day keeps it");
});
