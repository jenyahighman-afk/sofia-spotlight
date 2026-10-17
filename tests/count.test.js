// Count Along: tempo and steadiness from taps, judging taps against a beat grid (perfect ≤ 60 ms, good ≤ 120 ms),
// "Set the beat", only real BPMs from the dance cards, the schema-39 migration, stars, and both modes in the fake DOM
// (a fake AudioContext and a fake Audio stand in for the browser's sound).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installEnv, resetDom, el } from "./_env.mjs";
installEnv();
const read = (f) => JSON.parse(readFileSync(new URL("../" + f, import.meta.url), "utf8"));
const { applyData, DATA_FILES } = await import("../js/data.js");
const got = {}; for (const f of DATA_FILES) got[f] = read("data/" + f + ".json"); applyData(got);
const C = await import("../js/games/count.js");
const { S, migrateDoc, SCHEMA_VERSION, setBackend, dances } = await import("../js/store.js");
const { starsFor } = await import("../js/stars.js");
const { FRIEND_GAMES } = await import("../js/who.js");
const play = await import("../js/views/play.js");

const steadyTaps = (n, gap, start = 0, jitter = () => 0) => Array.from({ length: n }, (_, i) => start + i * gap + jitter(i));
const wobble = (amp) => (i) => (i % 2 ? amp : -amp);

test("tempo: the median gap between taps → taps a minute; double taps and pauses are left out; too few taps → null", () => {
  assert.deepEqual(C.tempoFromTaps(steadyTaps(9, 0.5)), { bpm: 120, gap: 0.5 });
  assert.equal(C.tempoFromTaps(steadyTaps(9, 60 / 76, 3)).bpm, 76);
  const messy = [...steadyTaps(9, 0.6), 0.65, 10]; // a double tap at 0.6/0.65 and a stray tap after a long pause
  assert.equal(C.tempoFromTaps(messy).bpm, 100, "one bad tap does not move the median");
  assert.equal(C.tempoFromTaps([0, 0.5, 1]), null); assert.equal(C.tempoFromTaps([]), null); assert.equal(C.tempoFromTaps(null), null);
});

test("steadiness: 100% for even taps, lower as the gaps wobble, never below 0", () => {
  assert.equal(C.steadiness(steadyTaps(12, 0.5)), 100);
  const a = C.steadiness(steadyTaps(12, 0.5, 0, wobble(0.01))), b = C.steadiness(steadyTaps(12, 0.5, 0, wobble(0.05)));
  assert.ok(a > b && a >= 90 && a < 100, `small wobble ${a}`); assert.ok(b >= 0 && b < 80, `big wobble ${b}`);
  assert.equal(C.steadiness([0, 0.3, 1.5, 1.8, 3.6, 3.7]), 0, "all over the place");
  assert.equal(C.steadiness([1, 2]), null);
});

test("taps against a grid: perfect ≤ 60 ms, good ≤ 120 ms, a second tap on one beat is a miss, the streak counts perfect taps in a row", () => {
  assert.equal(C.grade(0), "perfect"); assert.equal(C.grade(-60), "perfect"); assert.equal(C.grade(61), "good"); assert.equal(C.grade(-120), "good"); assert.equal(C.grade(121), "miss");
  // 120 BPM, first beat at 1 s → beats at 1, 1.5, 2 …
  const taps = [1.0, 1.55, 2.04, 2.6, 3.2, 3.5, 3.52, 4.01];
  const r = C.scoreTaps(taps, 120, 1);
  assert.deepEqual(r.judged.map(j => j.grade), ["perfect", "perfect", "perfect", "good", "miss", "perfect", "miss", "perfect"]);
  assert.deepEqual(r.judged.map(j => j.count), [1, 2, 3, 4, 5, 6, 6, 7], "each tap knows its count"); assert.equal(r.judged[3].err, 100);
  assert.equal(r.perfect, 5); assert.equal(r.good, 1); assert.equal(r.miss, 2); assert.equal(r.pct, 75); assert.equal(r.streak, 3);
  const skipped = C.scoreTaps([0, 0.5, 1], 120, 0, 8); assert.equal(skipped.total, 8); assert.equal(skipped.pct, 38, "skipped beats count against her when the beats are known (metronome)");
  assert.equal(C.scoreTaps([], 100, 0).pct, 0);
  const b = C.beatErr(2.47, 120, 1); assert.equal(b.index, 3); assert.ok(Math.abs(b.err + 0.03) < 1e-9, "30 ms early");
});

test("half and double time still count; count numbers 1-8 from a grid; the grid lines up to her taps when count 1 isn't saved", () => {
  assert.equal(C.tempoFactor(172, 86), 2, "the trio's half-time feel: tapping the 172 pulse"); assert.equal(C.tempoFactor(41, 86), 0.5); assert.equal(C.tempoFactor(90, 86), 1); assert.equal(C.tempoFactor(null, 86), 1);
  assert.equal(C.countAt(0.5, 120, 1), 0, "before the first beat"); assert.equal(C.countAt(1, 120, 1), 1); assert.equal(C.countAt(1.49, 120, 1), 1); assert.equal(C.countAt(4.5, 120, 1), 8); assert.equal(C.countAt(5, 120, 1), 1);
  const taps = steadyTaps(16, 60 / 76, 2.3, wobble(0.02)); const off = C.fitOffset(taps, 76); const beat = 60 / 76;
  assert.ok(Math.abs(off - (2.3 % beat)) < 0.01, `fitted ${off}`); assert.equal(C.scoreTaps(taps, 76, off).pct, 100);
});

test("Set the beat: 16 taps from a 1 → the measured BPM and count 1 near the first tap; uneven or too few taps → null", () => {
  const m = C.measureBeat(steadyTaps(16, 60 / 104, 4.2, wobble(0.015)));
  assert.ok(Math.abs(m.bpm - 104) < 1, `bpm ${m.bpm}`); assert.ok(Math.abs(m.offset - 4.2) < 0.03, `offset ${m.offset}`);
  assert.equal(C.measureBeat(steadyTaps(8, 0.5)), null, "needs about 16 taps");
  assert.equal(C.measureBeat(steadyTaps(16, 2.5)), null, "gaps longer than 2 s are pauses, not a beat");
  const skip = steadyTaps(17, 0.5); skip.splice(8, 1); assert.equal(C.measureBeat(skip), null, "a skipped beat is not measured");
  const early = C.measureBeat(steadyTaps(16, 0.5, 0.01, (i) => i ? 0 : -0.02)); assert.ok(early.offset >= 0, "the offset is never negative");
});

test("only real beats: the BPMs come from the dance cards (solo 76, trio 86, PITCH jazz 123); a dance without one has no grid until it's set", () => {
  const byId = Object.fromEntries(dances().map(d => [d.id, d]));
  assert.deepEqual(C.gridFor(byId.solo, {}), { bpm: 76, offset: null, source: "dance" });
  assert.equal(C.gridFor(byId.trio, {}).bpm, 86); assert.equal(C.gridFor(byId["pitch-jazz"], {}).bpm, 123);
  for (const d of dances().filter(x => !x.bpm)) assert.equal(C.gridFor(d, {}), null, d.id + " has no BPM in data/dances.json");
  assert.deepEqual(C.gridFor(byId["pitch-contemp"], { beats: { "pitch-contemp": { bpm: 92.5, offset: 1.25 } } }), { bpm: 92.5, offset: 1.25, source: "set" });
  assert.equal(C.gridFor({ ...byId.solo, countOffset: 0.8 }, { beats: { solo: { bpm: 100, offset: 0 } } }).bpm, 76, "the dance card wins over a tapped beat");
  assert.equal(C.gridFor({ ...byId.solo, countOffset: 0.8 }, {}).offset, 0.8, "count 1 tapped in the player is used");
  assert.equal(C.gridFor({ id: "x", bpm: "" }, { beats: { x: { bpm: 500, offset: 0 } } }), null, "an impossible beat is ignored");
});

test("big moments: cues inside the tapped stretch, hit when a tap lands within 0.4 s", () => {
  const solo = dances().find(d => d.id === "solo"); // cues at 0, 11, 15, 17, 19, 34 …
  assert.deepEqual(C.cueHits([10.8, 12, 13, 14, 15.5, 16.9, 18, 19.3], solo.cues), { hit: 3, total: 4 }, "11, 15, 17, 19 are in range; 11, 17 and 19 were tapped");
  assert.deepEqual(C.cueHits([], solo.cues), { hit: 0, total: 0 }); assert.deepEqual(C.cueHits([1, 2], undefined), { hit: 0, total: 0 });
});

test("the words after a song round are kind and honest about what was measured", () => {
  const noGrid = C.songSummary({ tempo: { bpm: 103.6 }, steady: 88, grid: null, factor: 1, score: null, cues: { hit: 0, total: 0 } });
  assert.ok(noGrid.includes("104 taps a minute") && noGrid.includes("steadiness 88%") && noGrid.includes("Set the beat") && !noGrid.includes("on the beat</b>"));
  const fitted = C.songSummary({ tempo: { bpm: 172 }, steady: 90, grid: { bpm: 86, offset: null }, factor: 2, score: { pct: 81, streak: 5 }, cues: { hit: 2, total: 3 } });
  assert.ok(fitted.includes("81% on the beat") && fitted.includes("5 perfect in a row") && fitted.includes("double time") && fitted.includes("lined the beat up to your taps") && fitted.includes("2 of 3"));
});

test("schema 39: beats keep bpm 40-220 and offset ≥ 0; bests become whole numbers 0-100; nothing invented", () => {
  assert.equal(SCHEMA_VERSION, 39);
  const m = migrateDoc("settings", "main", { _v: 33, beats: { solo: { bpm: "76.04", offset: -2 }, a: { bpm: 30, offset: 1 }, b: { bpm: 221 }, c: "x", d: { bpm: 120, offset: "1.23456" } }, countBest: { "d-solo": 87.6, "m-100": 140, bad: "x", neg: -5, z: 0 } });
  assert.equal(m._v, SCHEMA_VERSION);
  assert.deepEqual(m.beats, { solo: { bpm: 76, offset: 0 }, d: { bpm: 120, offset: 1.235 } });
  assert.deepEqual(m.countBest, { "d-solo": 88, "m-100": 100, z: 0 });
  assert.deepEqual(migrateDoc("settings", "main", { _v: 33, beats: [1, 2], countBest: "x" }), { _v: SCHEMA_VERSION, beats: {}, countBest: {} });
  const none = migrateDoc("settings", "main", { _v: 33, pin: "2027" }); assert.equal("beats" in none, false); assert.equal("countBest" in none, false);
  assert.equal("beats" in migrateDoc("dances", "solo", { _v: 33, beats: 3 }) && migrateDoc("dances", "solo", { _v: 33, beats: 3 }).beats, 3, "only settings is touched");
});

test("stars: 1-3 for a round, the game bite, and friends' bests", () => {
  assert.equal(starsFor("count", 40), 1); assert.equal(starsFor("count", 60), 2); assert.equal(starsFor("count", 85), 3); assert.equal(starsFor("count", 100), 3);
  assert.deepEqual(FRIEND_GAMES.count, ["🥁", "Count Along"]);
});

// ---------- fake DOM ----------
let audioNow = 0;
class FakeCtx { constructor(){ this.state = "running"; this.destination = {}; this.outputLatency = 0; FakeCtx.made++; } get currentTime(){ return audioNow; } resume(){}
  createOscillator(){ FakeCtx.clicks++; return { frequency: {}, connect(){}, start(){}, stop(){} }; } createGain(){ return { gain: { setValueAtTime(){}, exponentialRampToValueAtTime(){} }, connect(){} }; } }
FakeCtx.made = 0; FakeCtx.clicks = 0;
class FakeAudio { constructor(src){ this.src = src; this.currentTime = 0; this.paused = true; this.l = {}; FakeAudio.last = this; } addEventListener(t, fn){ this.l[t] = fn; } play(){ this.paused = false; return Promise.resolve(); } pause(){ this.paused = true; } }

function fresh(){ resetDom(); for (const k of Object.keys(S)) S[k] = {}; const writes = []; setBackend({ set: async (col, id, rec) => { writes.push({ col, id, rec }); }, del: async () => {} }); return writes; }

test("Play: a Count Along tile; the card shows the dance's real BPM, asks for music when there is none, and offers Set the beat only without a BPM", () => {
  fresh(); play.initPlay(); play.renderPlay();
  const grid = el("#gameGrid").innerHTML; assert.ok(grid.includes("playOpen('count')") && grid.includes("Count Along"), "the tile"); assert.equal((grid.match(/game-tile/g) || []).length, 10);
  window.playOpen("count"); const setup = el("#countSetup").innerHTML;
  assert.ok(setup.includes("countMode('song')") && setup.includes("countMode('metro')"), "two modes");
  assert.ok(setup.includes('<option value="solo" selected>') && setup.includes("76 BPM from the dance card"), "the solo's own 76 BPM");
  assert.ok(setup.includes("No music file for this dance yet") && !setup.includes("countStart()"), "no music, no round");
  assert.equal(el("#countBest").textContent, "–");
  S.dances["pitch-contemp"] = { id: "pitch-contemp", musicFile: { url: "https://x/contemp.mp3" } }; window.countDance("pitch-contemp");
  const s2 = el("#countSetup").innerHTML; assert.ok(s2.includes("No beat saved for this dance yet") && s2.includes("countSet()") && s2.includes("countStart()"), "music but no BPM: Find the beat and Set the beat");
  S.dances.solo = { id: "solo", musicFile: { url: "https://x/solo.mp3" } }; window.countDance("solo"); assert.ok(!el("#countSetup").innerHTML.includes("countSet()"), "the solo has a BPM, so no Set the beat");
  window.countMode("metro"); const m = el("#countSetup").innerHTML; for (const t of [80, 100, 120]) assert.ok(m.includes(`countTempo(${t})`), "tempo " + t); assert.ok(m.includes("countStart()"));
  window.countMode("song"); window.playOpen("");
});

test("Metronome practice: clicks on the audio clock, taps judged on every beat, best saved, stars and the game bite paid", async () => {
  const writes = fresh(); window.AudioContext = FakeCtx; audioNow = 10; play.initPlay(); play.renderPlay(); window.playOpen("count"); window.countMode("metro"); window.countTempo(120);
  assert.equal(C.startCount(), true); assert.equal(FakeCtx.clicks, 36, "4 count-in clicks + 32 beats"); assert.equal(el("#countArea").hidden, false); assert.equal(el("#countSetup").hidden, true);
  const start = 10 + 0.4 + 4 * 0.5; // first scored beat
  audioNow = start - 1.5; C.tapCount(); // during the count-in: ignored
  for (let i = 0; i < 32; i++) { audioNow = start + i * 0.5 + (i < 24 ? 0.02 : i < 28 ? 0.1 : 0.2); C.tapCount(); }
  assert.ok(el("#ctSay").innerHTML.length > 0 && el("#ctLive").textContent.includes("%"));
  audioNow = start + 16.3; const r = await C.finishCount();
  assert.equal(r.score.perfect, 24); assert.equal(r.score.good, 4); assert.equal(r.value, 88); assert.equal(r.score.streak, 24);
  assert.deepEqual(S.settings.countBest, { "m-120": 88 }); assert.ok(S.settings.stars >= 3, "3 stars + first play bonus");
  assert.ok(el("#ctSay").innerHTML.includes("88% on the beat") && el("#ctSay").innerHTML.includes("New best") && el("#ctActions").innerHTML.includes("countAgain('metro')"));
  await new Promise(r => setTimeout(r, 20)); assert.ok(Object.values(S.practice).some(p => (p.bites || []).includes("game")), "the game bite");
  assert.ok(writes.some(w => w.col === "settings"));
  window.countStop(); assert.equal(el("#countArea").hidden, true); play.renderPlay(); assert.ok(el("#gameGrid").innerHTML.includes("Best 88%"));
  delete window.AudioContext;
});

test("Find the beat with the solo: taps read from the music's own time, judged on the 76 BPM grid lined up to her taps; Set the beat saves a beat for a dance without one", async () => {
  fresh(); window.Audio = FakeAudio; S.dances.solo = { id: "solo", musicFile: { url: "https://x/solo.mp3" } }; S.dances["pitch-contemp"] = { id: "pitch-contemp", musicFile: { url: "https://x/c.mp3" } };
  play.initPlay(); play.renderPlay(); window.playOpen("count"); window.countMode("song"); window.countDance("solo");
  assert.equal(C.startCount(), true); const a = FakeAudio.last; assert.equal(a.src, "https://x/solo.mp3"); assert.equal(a.paused, false);
  const beat = 60 / 76; for (let i = 0; i < 20; i++) { a.currentTime = 1.1 + i * beat + 0.015 * Math.sin(i * 2.4); C.tapCount(); }
  assert.equal(el("#ctLive").textContent, "20 taps", "no count 1 saved: the counts follow her taps");
  const r = await C.finishCount(); assert.equal(a.paused, true, "the music stops");
  assert.equal(r.score.pct, 100); assert.equal(Math.round(r.tempo.bpm), 76); assert.ok(r.steady >= 90);
  assert.ok(el("#ctSay").innerHTML.includes("100% on the beat") && el("#ctSay").innerHTML.includes("the song: 76 BPM") && el("#ctSay").innerHTML.includes("lined the beat up"));
  assert.equal(S.settings.countBest["d-solo"], 100); window.countStop();
  // too few taps: no score, no stars
  const before = S.settings.stars; C.startCount(); C.tapCount(); C.tapCount(); assert.equal(await C.finishCount(), null); assert.equal(S.settings.stars, before); window.countStop();
  // Set the beat on a dance with no BPM
  window.countDance("pitch-contemp"); assert.equal(C.startCount("set"), true); const b = FakeAudio.last;
  for (let i = 0; i < 16; i++) { b.currentTime = 2 + i * 0.6; C.tapCount(); }
  assert.ok(el("#ctSay").innerHTML.includes("100 BPM") && el("#ctActions").innerHTML.includes("countSaveBeat()"), "the round ends itself after 16 taps");
  await window.countSaveBeat(); assert.deepEqual(S.settings.beats, { "pitch-contemp": { bpm: 100, offset: 2 } });
  assert.ok(el("#countSetup").innerHTML.includes("Beat set by tapping: 100 BPM") && el("#countSetup").innerHTML.includes("Set the beat again"));
  // leaving the game stops a round
  C.startCount(); assert.equal(C.countRunning(), true); window.playOpen(""); assert.equal(C.countRunning(), false); assert.equal(FakeAudio.last.paused, true);
  delete window.Audio;
});
