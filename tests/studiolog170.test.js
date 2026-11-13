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
  assert.deepEqual(L.studioRec({}, D), { dances: [], skills: [], feel: "", note: "", skip: false });
  assert.deepEqual(L.studioRec({ [D]: { studio: { dances: ["solo", "solo", 3], skills: "x", feel: "nope", note: 7 } } }, D), { dances: ["solo"], skills: [], feel: "", note: "7", skip: false }, "whatever is stored reads safely");
  const home = { done: ["a"], note: "home note", runs: [{ danceId: "solo" }], skills: ["split-r"] };
  const one = L.withStudio(home, { dances: ["trio"] }); assert.deepEqual(one.studio, { dances: ["trio"], skills: [], feel: "", note: "" });
  assert.deepEqual([one.done, one.note, one.runs, one.skills], [home.done, home.note, home.runs, home.skills], "the day's home practice is untouched");
  const two = L.withStudio(one, { feel: "great", note: "  x".repeat(100) }); assert.deepEqual(two.studio.dances, ["trio"], "a patch keeps the rest"); assert.equal(two.studio.feel, "great"); assert.equal(two.studio.note.length, L.NOTE_MAX);
  assert.deepEqual(L.withStudio(undefined, { skills: ["a-aerial"] }), { done: [], note: "", runs: [], studio: { dances: [], skills: ["a-aerial"], feel: "", note: "" } }, "a day with no record yet gets one");
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
  assert.deepEqual(st.week, { dances: 3, skills: 2, photos: 0, fixes: 0, n: 5 }, "a skill worked on at home and at the studio the same day is one stone"); assert.equal(st.all.dances, 4);
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
