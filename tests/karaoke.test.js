// Song words, karaoke-style (1.44.0): lyric lines and times, the line at a moment, snapping taps, the 8-count, the
// karaoke HTML, schema 46, the solo's onset list (times only — never words), and the player/editor wiring.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installEnv } from "./_env.mjs";
installEnv();
const { lyricLines, normalizeLyricTimes, lyricAt, snapTime, countAt, MAX_LYRIC_LINES, lineKey, lyricTimesFor, normalizeLyricKeys } = await import("../js/cues.js");
const { karaokeHtml, wordWipes } = await import("../js/prompter.js");
const { migrateDoc, SCHEMA_VERSION } = await import("../js/store.js");
const src = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");

test("lyric lines: trimmed, blanks dropped, capped; times: numbers ≥ 0 with 2 decimals, null for untimed, trailing nulls dropped", () => {
  assert.deepEqual(lyricLines("  first line \n\n second\r\n\nthird  "), ["first line", "second", "third"]);
  assert.deepEqual(lyricLines(null), []); assert.equal(lyricLines(Array.from({ length: 200 }, (_, i) => "l" + i).join("\n")).length, MAX_LYRIC_LINES);
  assert.deepEqual(normalizeLyricTimes([0, "1.234", null, 5, -1, "x", 9999, 7, null, null]), [0, 1.23, null, 5, null, null, null, 7]);
  assert.deepEqual(normalizeLyricTimes("nope"), []); assert.deepEqual(normalizeLyricTimes([1, 2, 3], 2), [1, 2]);
});

test("lyricAt: the last started line is 'now', the wipe runs to the next timed line (or 5 s), untimed lines are skipped", () => {
  const lines = "one\ntwo\nthree\nfour"; const times = [10, 14, null, 20];
  let k = lyricAt(lines, times, 5); assert.equal(k.cur, null); assert.equal(k.next.text, "one"); assert.equal(k.progress, 0); assert.equal(k.timed, 3); assert.equal(k.total, 4);
  k = lyricAt(lines, times, 12); assert.equal(k.cur.text, "one"); assert.equal(k.cur.i, 0); assert.equal(k.next.text, "two"); assert.equal(k.prev, null); assert.equal(k.progress, 0.5); assert.equal(k.untilNext, 2);
  k = lyricAt(lines, times, 17); assert.equal(k.cur.text, "two"); assert.equal(k.next.text, "four", "three has no time yet, so four is next"); assert.equal(k.prev.text, "one"); assert.equal(k.progress, 0.5);
  k = lyricAt(lines, times, 22.5); assert.equal(k.cur.text, "four"); assert.equal(k.next, null); assert.equal(k.progress, 0.5, "the last line wipes over 5 s"); assert.equal(k.untilNext, null);
  assert.equal(lyricAt(lines, times, 60).progress, 1);
  k = lyricAt(lines, [], 12); assert.equal(k.timed, 0); assert.equal(k.cur, null); assert.equal(k.next, null);
  assert.equal(lyricAt("", [1], 2).total, 0);
});

test("a tap snaps to the nearest known onset within 0.6 s, else stays; the 8-count matches the player's old maths", () => {
  const snaps = [5.94, 7.72, 10.34];
  assert.equal(snapTime(6.3, snaps), 5.94); assert.equal(snapTime(7.3, snaps), 7.72); assert.equal(snapTime(9.0, snaps), 9); assert.equal(snapTime(9.123, []), 9.12); assert.equal(snapTime(-1, null), 0);
  assert.equal(countAt(10, 0), null); assert.equal(countAt(10, "", 0), null);
  const old = (t, bpm, off) => { const beat = Math.floor((t - off) * bpm / 60); return beat < 0 ? 0 : (beat % 8) + 1; };
  for (const t of [0, 0.5, 1.2, 7.9, 8.1, 33.3, 120]) assert.equal(countAt(t, 76, 1.2).count, old(t, 76, 1.2), "t=" + t);
  assert.deepEqual(countAt(0, 76, 1.2), { beat: -2, count: 0 }); assert.equal(countAt(1.2, 76, 1.2).count, 1); assert.equal(countAt(1.21 + 8 * 60 / 76, 76, 1.2).count, 1, "count 1 again after 8 beats");
});

test("karaokeHtml: nothing without words, a hint without times, otherwise past/now/next with the wipe and escaped text", () => {
  assert.equal(karaokeHtml("", [], 3), ""); assert.equal(karaokeHtml(null, null, 3), "");
  const h0 = karaokeHtml("a <b>\nc", [], 3); assert.ok(h0.includes('class="kara untimed"')); assert.ok(h0.includes("a &lt;b&gt;")); assert.ok(h0.includes("Time the words"));
  const h = karaokeHtml("one\ntwo\nthree", [10, 14, 18], 12); assert.ok(h.includes('<div class="kl now"><span class="kw" style="--p:50%">one</span></div>')); assert.ok(h.includes('<div class="kl next">two</div>')); assert.ok(!h.includes("kl past"));
  const h2 = karaokeHtml("one\ntwo\nthree", [10, 14, 18], 15); assert.ok(h2.includes('class="kl past">one')); assert.ok(h2.includes('<div class="kl now"><span class="kw" style="--p:25%">two</span></div>')); assert.ok(h2.includes('class="kl next">three'));
  assert.ok(karaokeHtml("one\ntwo", [10, 14], 2).includes('<div class="kl now">…</div>'), "before the first line: … now, the first line next");
});

test("the wipe runs word by word in reading order: each word lights from where it sits in the line, so a wrapped line fills its top row first", () => {
  assert.deepEqual(wordWipes("one two three", 0.5).map(x => x.p), [100, 83, 0]); assert.deepEqual(wordWipes("one two three", 0).map(x => x.p), [0, 0, 0]); assert.deepEqual(wordWipes("one two three", 1).map(x => x.p), [100, 100, 100]);
  assert.deepEqual(wordWipes("one two three", 0.5).map(x => x.w), ["one", "two", "three"]); assert.deepEqual(wordWipes("", 0.5), []); assert.deepEqual(wordWipes("  a  <b>  ", 1).map(x => x.w), ["a", "<b>"]);
  const h = karaokeHtml("say it <now> here", [10], 12.5); assert.ok(h.includes('<span class="kw" style="--p:100%">say</span> <span class="kw" style="--p:100%">it</span> <span class="kw" style="--p:'), h); assert.ok(h.includes("&lt;now&gt;"), "escaped");
});

test("schema 46 normalizes lyrics, lyricTimes and lyricSnaps on dances only, never invents them", () => {
  assert.ok(SCHEMA_VERSION >= 46);
  const d = migrateDoc("dances", "solo", { _v: 45, lyrics: 42, lyricTimes: [1, "2.5", "x", null], lyricSnaps: [3, null, "4.25", -2] });
  assert.equal(d.lyrics, ""); assert.deepEqual(d.lyricTimes, [1, 2.5]); assert.deepEqual(d.lyricSnaps, [3, 4.25]); assert.equal(d._v, SCHEMA_VERSION);
  const long = migrateDoc("dances", "trio", { _v: 45, lyrics: "x".repeat(9000) }); assert.equal(long.lyrics.length, 8000);
  const none = migrateDoc("dances", "trio", { _v: 45 }); assert.equal("lyrics" in none, false); assert.equal("lyricTimes" in none, false);
  const other = migrateDoc("notes", "n1", { _v: 45, lyrics: 42 }); assert.equal(other.lyrics, 42);
});

test("the solo ships sung-line onsets (times only, ascending, inside the 2:04 track) and never the words", () => {
  const seed = JSON.parse(src("data/dances.json")); const list = Array.isArray(seed) ? seed : seed.dances || Object.values(seed);
  const solo = list.find(d => d.id === "solo"); assert.ok(Array.isArray(solo.lyricSnaps) && solo.lyricSnaps.length >= 15);
  for (let i = 0; i < solo.lyricSnaps.length; i++) { const t = solo.lyricSnaps[i]; assert.ok(typeof t === "number" && t > 0 && t < 124, "snap " + i); if (i) assert.ok(t > solo.lyricSnaps[i - 1], "ascending at " + i); }
  for (const d of list) { assert.ok(!d.lyrics, d.id + " ships no words"); assert.equal(d.lyricTimes, undefined, d.id + " ships no line times (they are the family's)"); }
});

test("line keys: FNV-1a over the lowercased letters only, so spelling of punctuation and case don't matter; shipped times land by key, identical lines in turn, taps win", () => {
  assert.equal(lineKey(""), "811c9dc5"); assert.equal(lineKey("a"), "e40c292c"); assert.equal(lineKey("Don't stop, now!"), lineKey("dont  stop now")); assert.equal(lineKey("it’s"), lineKey("its"));
  assert.notEqual(lineKey("one"), lineKey("two")); assert.match(lineKey("anything"), /^[0-9a-f]{8}$/);
  const lines = "one\ntwo\none\nthree\none"; const keys = { [lineKey("one")]: [5, 30], [lineKey("two")]: [12] };
  assert.deepEqual(lyricTimesFor(lines, [], keys), [5, 12, 30], "three has no key and the third 'one' has no time left: untimed, trailing nulls dropped");
  assert.deepEqual(lyricTimesFor(lines, [null, 11.5], keys), [5, 11.5, 30], "a tap on line 2 wins over its shipped time");
  assert.deepEqual(lyricTimesFor(lines, [], null), []); assert.deepEqual(lyricTimesFor("", [], keys), []);
  assert.deepEqual(normalizeLyricKeys({ [lineKey("one")]: [9, "3", null, -1], zzz: [1], "0123456789": [1], [lineKey("two")]: [] }), { [lineKey("one")]: [3, 9] });
});

test("schema 47 normalizes lyricKeys on dances; the solo ships keys for its sung lines (hashes and seconds, never words)", () => {
  assert.ok(SCHEMA_VERSION >= 47);
  const d = migrateDoc("dances", "solo", { _v: 46, lyricKeys: { [lineKey("x")]: ["4.5", 2], bad: [1] } }); assert.deepEqual(d.lyricKeys, { [lineKey("x")]: [2, 4.5] }); assert.equal(d._v, SCHEMA_VERSION);
  assert.equal("lyricKeys" in migrateDoc("dances", "trio", { _v: 46 }), false);
  const seed = JSON.parse(src("data/dances.json")); const list = Array.isArray(seed) ? seed : seed.dances || Object.values(seed); const solo = list.find(x => x.id === "solo");
  const entries = Object.entries(solo.lyricKeys); assert.ok(entries.length >= 10, "a dozen distinct lines");
  let total = 0; for (const [k, v] of entries) { assert.match(k, /^[0-9a-f]{8}$/, k); assert.ok(Array.isArray(v) && v.length >= 1, k); for (let i = 0; i < v.length; i++) { assert.ok(typeof v[i] === "number" && v[i] > 5 && v[i] < 120, k); if (i) assert.ok(v[i] > v[i - 1], k + " in order"); } total += v.length; }
  assert.ok(total >= 15 && total <= 25, "the 2:04 cut sings about 17 lines: " + total);
  assert.deepEqual(solo.lyricSnaps, [].concat(...entries.map(([, v]) => v)).sort((a, b) => a - b), "the tap snaps are those same starts");
  assert.ok(src("js/views/dances.js").includes("delete d.lyricKeys"), "data-owned keys stay out of the family's copy");
  assert.ok(src("js/player.js").includes("lyricTimesFor(lyricsOf(), PL.dance && PL.dance.lyricTimes, PL.dance && PL.dance.lyricKeys)"), "the player reads taps, then shipped times");
});

test("the wiring: the player renders the karaoke line and corner count in both views, the timer buttons exist, the editor has the words box, the README says how", () => {
  const html = src("index.html"); for (const id of ["plKaraBox", "plKara", "plKCount", "plTimeWords", "plTiming"]) assert.ok(html.includes(`id="${id}"`), id);
  assert.ok(html.indexOf('id="plKaraBox"') < html.indexOf('id="plCue"'), "the words sit above the move");
  const pl = src("js/player.js"); for (const s of ["renderKCount(k); renderKara(t); renderCue(t);", 'id="plRunKara"', 'id="plRunKCount"', "countAt(t, PL.dance.bpm, PL.dance.countOffset)", "snapTime(PL.audio.currentTime, PL.dance.lyricSnaps)", "plTimeTap: timeTap", '$("#plTimeWords").onclick = timeWords']) assert.ok(pl.includes(s), s);
  assert.ok(!/Math\.floor\(\(t - \(\+PL\.dance\.countOffset/.test(pl), "the count maths lives in cues.js now");
  const ed = src("js/views/dances.js"); assert.ok(ed.includes('edText("lyrics"')); assert.ok(ed.includes("lyricsFromNotes(")); assert.ok(ed.includes("delete d.lyricSnaps"), "data-owned onsets stay out of the family's copy");
  const css = src("css/app.css"); for (const s of [".kara-box{", ".kara .kl.now{", ".kara .kl.now .kw{", ".kcount{", ".run-overlay .kara-box{", ".timing .tl-btn{"]) assert.ok(css.includes(s), s);
  assert.ok(src("js/player.js").includes('el.querySelectorAll(".kl.now .kw")'), "the player moves each word's wipe every frame");
  const readme = src("README.md"); assert.ok(readme.includes("Time the words")); assert.ok(readme.includes("lyricSnaps")); assert.ok(!/Lyrics go into the cue sheets/.test(readme));
  assert.ok(/APP_VERSION = "1\.(4[4-9]|[5-9]\d)/.test(src("js/version.js")));
});
