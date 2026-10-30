// The Oct 28 review's leftovers that no build picked up (1.54.0): 🎬 Film it on the film-one-chunk item, the pet awake
// after a studio day, the aerial step never borrowed from another section, the "mat + grown-up here" check before an acro
// boss in Trick Quest, and the Bunny's last "one bite". Every date here is fixed; nothing reads the clock's weekday.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installEnv, resetDom, el } from "./_env.mjs";
installEnv();
const json = (f) => JSON.parse(readFileSync(new URL("../data/" + f + ".json", import.meta.url), "utf8"));
const src = (f) => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const { applyData, DATA_FILES } = await import("../js/data.js");
const got = {}; for (const f of DATA_FILES) got[f] = json(f); applyData(got);
const { toolsFor } = await import("../js/pmode.js");
const { clipFileName, isVideoFile } = await import("../js/film.js");
const { yesterdayOk, petMood, petState } = await import("../js/pet.js");
const { dayKindNow } = await import("../js/daykind.js");
const { buildPlan } = await import("../js/plan.js");
const { needsGrownUp } = await import("../js/games/quest.js");
const { S } = await import("../js/store.js");
const html = src("index.html");

test("🎬 Film it: the film-one-chunk item opens the film sheet first; the sheet films, plays back, films again, keeps the clip on the phone", () => {
  assert.deepEqual(toolsFor({ id: "film-chunk" }).map(t => t.label), ["🎬 Film it", "🎵 Solo music", "🧩 Chunks"]); assert.equal(toolsFor({ id: "film-chunk" })[0].go, "openFilm()");
  assert.deepEqual(toolsFor({ id: "solo-run", dance: "solo" }).map(t => t.label), ["🎵 Solo music"], "other items unchanged");
  assert.equal(clipFileName({ type: "video/quicktime" }, "2026-11-05", 2), "solo-chunk-2026-11-05-2.mov"); assert.equal(clipFileName({ type: "video/mp4" }, "2026-11-05"), "solo-chunk-2026-11-05-1.mp4");
  assert.equal(clipFileName({ type: "", name: "IMG_0001.MOV" }, "2026-11-05", 3), "solo-chunk-2026-11-05-3.mov"); assert.equal(clipFileName(null, "2026-11-05", 0), "solo-chunk-2026-11-05-1.mp4");
  assert.ok(isVideoFile({ type: "video/mp4" }) && isVideoFile({ type: "", name: "a.mov" })); assert.ok(!isVideoFile({ type: "image/jpeg", name: "a.jpg" }) && !isVideoFile(null));
  assert.match(html, /<div class="modal film" id="film" hidden>/); assert.match(html, /<input type="file" id="filmIn" accept="video\/\*" capture="environment" hidden>/);
  const f = src("js/film.js"); assert.match(f, /<label class="btn coral big-btn film-cam" for="filmIn">/, "the camera opens from a label, so iPhone allows it"); assert.doesNotMatch(f, /media\.upload|storeSet|setSettings/, "nothing is uploaded or stored");
  assert.match(src("sw.js"), /"\.\/js\/film\.js"/); assert.match(src("js/app.js"), /initFilm\(\)/);
});

test("the film sheet in the fake DOM: empty → a clip → film again; closing lets it go", async () => {
  resetDom(); const F = await import("../js/film.js"); F.initFilm();
  window.openFilm(); assert.equal(el("#film").hidden, false); assert.match(el("#filmBody").innerHTML, /🎥 Film a chunk/); assert.match(el("#filmBody").innerHTML, /stays on this phone/);
  const input = el("#filmIn"); input.files = [{ type: "video/quicktime", name: "IMG_1.MOV" }]; input.onchange();
  assert.match(el("#filmBody").innerHTML, /<video id="filmVideo" src="blob:test"/); assert.match(el("#filmBody").innerHTML, /🎥 Film again/); assert.match(el("#filmBody").innerHTML, /filmKeep\(\)/); assert.match(el("#filmBody").innerHTML, /Clip 1/);
  input.files = [{ type: "image/jpeg", name: "x.jpg" }]; input.onchange(); assert.match(el("#filmBody").innerHTML, /Clip 1/, "a photo is refused, the clip stays");
  window.closeFilm(); assert.equal(el("#film").hidden, true);
});

test("the pet: only a missed home day makes it nap; a studio day, Monday's watch day, a rest day or a break leaves it awake", () => {
  assert.equal(yesterdayOk({ done: ["solo-run"] }, "home"), true); assert.equal(yesterdayOk(undefined, "home"), false, "a missed home day");
  for (const k of ["watch", "memory", "rest"]) assert.equal(yesterdayOk(undefined, k), true, k); assert.equal(yesterdayOk(undefined, "home", true), true, "a school break");
  assert.equal(dayKindNow("2026-11-02"), "watch"); assert.equal(dayKindNow("2026-11-03"), "memory"); assert.equal(dayKindNow("2026-11-05"), "home"); assert.equal(dayKindNow("2026-10-29"), "memory", "the Thu Oct 29 Acro make-up");
  const keep = S.practice; try {
    S.practice = { "2026-10-20": { done: ["solo-run"] } }; // one plan-done day, so it isn't a brand-new pet
    assert.equal(petState("2026-11-03").mood, "ready", "Tuesday after Monday's three classes: awake (it used to nap)");
    assert.equal(petState("2026-11-06").mood, "nap", "Friday after a missed Thursday: it naps");
    assert.equal(petState("2026-10-30").mood, "ready", "Friday after the Thursday make-up class: awake");
    S.practice = { "2026-10-20": { done: ["solo-run"] }, "2026-11-05": { done: ["mem-top"] } }; assert.equal(petState("2026-11-06").mood, "ready");
  } finally { S.practice = keep; }
  assert.equal(petMood({ todayDone: false, yesterdayDone: false, days: 3 }), "nap", "petMood itself is unchanged");
});

test("aerial steps come from the day's own section only: Thursday strength, Friday drills, never a borrowed step", () => {
  const pool = json("practice-pool"), aerial = json("aerial"); const base = { pool, aerial, dances: [{ id: "solo" }, { id: "trio" }], tricks: [], focus: null };
  const strength = aerial.filter(a => a.section === "Strength").map(a => a.id), drills = aerial.filter(a => a.section.startsWith("Drills")).map(a => a.id);
  const ids = (date, aerialDone) => buildPlan({ ...base, date, aerialDone }).filter(i => i.kind === "aerial").map(i => i.aerialId);
  assert.deepEqual(ids("2026-11-12", []), strength.slice(0, 2), "Thursday: the first two strength steps");
  assert.deepEqual(ids("2026-11-12", strength.slice(0, 3)), strength.slice(3), "one strength step left: one step, not a drill to fill the gap");
  assert.deepEqual(ids("2026-11-12", strength), [], "all strength ticked: no aerial step on Thursday");
  assert.deepEqual(ids("2026-11-13", drills), [], "all drills ticked: no aerial step on Friday, never a prerequisite like the dive cartwheel");
  assert.ok(!ids("2026-11-13", drills.slice(0, 3)).some(id => !drills.includes(id)));
});

test("Trick Quest: an acro boss asks for the mat and a grown-up first; the other bosses start straight away", async () => {
  const solo = got.skills.styles.solo.skills; const acro = solo.filter(needsGrownUp).map(s => s.id);
  assert.deepEqual(acro.sort(), ["s-cartwheel", "s-donut", "s-handstand", "s-walkover-knee"]);
  for (const id of ["s-side-sit", "s-leap", "s-passe-turns", "s-floor-kick", "s-calypso", "s-scorpion-needle"]) assert.equal(needsGrownUp(solo.find(s => s.id === id)), false, id);
  resetDom(); const stage = await import("../js/stage.js"); stage.initStage(); for (const k of Object.keys(S)) S[k] = {};
  window.qsStart(); window.qsPick("s-cartwheel"); assert.match(el("#qsArea").innerHTML, /Cartwheel is acro\./); assert.match(el("#qsArea").innerHTML, /Mat down, and a grown-up watching/);
  assert.match(el("#stageActions").innerHTML, /qsSpotted\('s-cartwheel'\)/); assert.match(el("#stageActions").innerHTML, /✓ Mat \+ grown-up here/); assert.match(el("#stageActions").innerHTML, /‹ Another boss/);
  window.qsSpotted("s-cartwheel"); assert.match(el("#qsArea").innerHTML, /Station 1\/3/, "confirmed: the stations start");
  window.qsPick("s-cartwheel"); assert.match(el("#qsArea").innerHTML, /Station 1\/3/, "asked once per boss while Quest is open");
  window.qsStart(); window.qsPick("s-cartwheel"); assert.match(el("#qsArea").innerHTML, /is acro/, "asked again the next time Quest opens");
  window.qsStart(); window.qsPick("s-side-sit"); assert.match(el("#qsArea").innerHTML, /Station 1\/3/, "not acro: no question");
  window.qsStart(); window.closeStage(); resetDom();
});

test("the Bunny's last app word: no 'one bite' in what she reads", () => {
  assert.doesNotMatch(JSON.stringify(json("buddy")), /one bite/i); assert.match(JSON.stringify(json("buddy")), /Just one little thing today/);
  assert.match(src("js/version.js"), /APP_VERSION = "1\.(5[4-9]|[6-9]\d)/);
});
