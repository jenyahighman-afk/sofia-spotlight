// 1.64.0 (the four ideas Jenya picked on Nov 5): a skill of the month she picks, with a before and an after; 🪞 Mirror and an
// A–B loop on Hannah's videos; a fix can point to a moment in the music; the Events card says what to wear.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installEnv, resetDom, el } from "./_env.mjs";
installEnv();
const json = (f) => JSON.parse(readFileSync(new URL("../data/" + f + ".json", import.meta.url), "utf8"));
const src = (f) => readFileSync(new URL("../" + f, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const { applyData, DATA_FILES } = await import("../js/data.js");
const got = {}; for (const f of DATA_FILES) got[f] = json(f); applyData(got);
const { S } = await import("../js/store.js");
const MS = await import("../js/monthskill.js");
const CC = await import("../js/cuecards.js");
const CO = await import("../js/corrections.js");
const KE = await import("../js/kidevents.js");
const D = await import("../js/views/dances.js");
const clearS = () => { for (const k of Object.keys(S)) S[k] = {}; };
const html = src("index.html");

test("⭐ My skill this month: the pick is kept, one per month; since 1.65.0 it starts her own list on Skills", () => {
  assert.equal(MS.monthKey("2026-11-05"), "2026-11"); assert.equal(MS.monthName("2026-12-01"), "December");
  assert.equal(MS.monthSkill({}, "2026-11-05"), null); assert.equal(MS.monthSkill({ monthSkills: { "2026-11": "s-cartwheel" } }, "2026-11-05").n, "Cartwheel");
  assert.equal(MS.monthSkill({ monthSkills: { "2026-11": "s-cartwheel" } }, "2026-12-01"), null, "a new month starts with nothing picked: last month's stays in the record");
  assert.equal(MS.monthSkill({ monthSkills: { "2026-11": "nope" } }, "2026-11-05"), null);
  const sk2 = html.slice(html.indexOf('id="p-skills"')); assert.ok(!html.includes('id="monthSkill"'), "its card is gone"); assert.ok(sk2.indexOf('id="workingCard"') < sk2.indexOf('id="skillRings"'), "her list is on top of the Skills page");
  assert.match(src("js/working.js"), /const m = monthSkill\(settings, date, ladder\); return m \? \[m\.id\] : \[\];/, "the month's pick starts the list");
  assert.match(src("sw.js"), /"\.\/js\/monthskill\.js", "\.\/js\/working\.js"/);
});

test("🪞 Mirror and an A–B loop on Hannah's videos", () => {
  assert.equal(CC.hvLoopLabel(null, null), "Tap A, then B, to loop a part"); assert.equal(CC.hvLoopLabel(12, null), "A at 0:12 · tap B"); assert.equal(CC.hvLoopLabel(12, 75), "Loop 0:12 – 1:15");
  assert.equal(CC.hvLoopTo(20, 12, 30), null, "inside the loop: play on"); assert.equal(CC.hvLoopTo(30, 12, 30), 12, "at B: back to A"); assert.equal(CC.hvLoopTo(5, 12, 30), 12); assert.equal(CC.hvLoopTo(99, null, null), null); assert.equal(CC.hvLoopTo(99, 12, null), null, "A alone doesn't loop");
  for (const id of ["hvMirror", "hvA", "hvB", "hvClear", "hvLoopLab", "hvOwn", "hvPlay", "hvBack", "hvFwd"]) assert.ok(html.includes(`id="${id}"`), id);
  const c = src("js/cuecards.js"); assert.match(c, /el\.classList\.toggle\("hv-mirror", HV\.mirror\); el\.controls = !HV\.mirror;/, "the video's own controls would be flipped too, so plain buttons stand in"); assert.match(c, /HV\.a = null; HV\.b = null; HV\.mirror = false; hvUI\(\);/, "each video starts plain");
  assert.match(src("css/app.css"), /#hvVideo\.hv-mirror\{transform:scaleX\(-1\)\}/);
});

test("a fix can point to a moment in the music: saved with the fix, ▶ on its chip plays that spot", () => {
  assert.equal(CO.fixMoment(52.34), 52.3); assert.equal(CO.fixMoment(0), 0); for (const bad of [null, undefined, "", "x", -1, NaN]) assert.equal(CO.fixMoment(bad), null, String(bad));
  assert.deepEqual(CO.fixLoop(52.3), { a: 48.3, b: 60.3 }); assert.deepEqual(CO.fixLoop(2), { a: 0, b: 10 });
  assert.match(src("js/corrections.js"), /const at = fixMoment\(t\); if \(at !== null\) rec\.t = at;/, "a fix without a moment is stored as before");
  assert.ok(html.includes('id="plFixHere">📝 Fix here</button>')); assert.match(src("js/player.js"), /await addCorrection\(\{ danceId: PL\.dance\.id, text: text\.trim\(\)\.slice\(0, 140\), source: "me", t \}\)/);
  resetDom(); clearS(); D.initDances();
  S.corrections = { a: { id: "a", danceId: "solo", text: "Point your foot", tag: "feet", status: "working", t: 52.3 }, b: { id: "b", danceId: "solo", text: "Eyes up", tag: "eyes", status: "working" } };
  D.danceOpen("solo"); const h = el("#danceList").innerHTML; assert.match(h, /onclick="fixPlay\('a'\)" aria-label="Play this spot">▶ 0:52<\/button>/); assert.doesNotMatch(h, /fixPlay\('b'\)/, "a fix without a moment has no ▶"); assert.match(h, /showMe\('a'\)/);
  let opened = null; const was = window.openPlayer; window.openPlayer = (id, o) => { opened = [id, o]; }; window.fixPlay("a"); window.openPlayer = was; assert.deepEqual(opened, ["solo", { loop: { a: 48.3, b: 60.3 } }]);
  D.danceOpen(null); resetDom(); clearS();
});

test("the Events card says what to wear: each dance's costume, shoes and hair, from the dance's own card", () => {
  const ds = [{ id: "solo", name: "Solo", costume: "Blue dress", shoes: "Half soles", hair: "Low bun" }, { id: "trio", name: "Trio", costume: "", shoes: "", hair: "" }, { id: "wf-ballet", name: "Ballet III class dance", costume: "Pink leo", shoes: "Ballet shoes" }, { id: "x", name: "Gone", costume: "c", deleted: true }];
  assert.deepEqual(KE.wearRows(ds, { dances: "Solo, trio" }), [{ name: "Solo", bits: [["👗", "Blue dress"], ["🩰", "Half soles"], ["💇", "Low bun"]] }], "a dance with nothing filled in is left out; class dances only when the event has them");
  assert.deepEqual(KE.wearRows(ds, { dances: "Solo, trio, class dances" }).map(r => r.name), ["Solo", "Ballet III class dance"]);
  const row = KE.kidEventRow({ name: "Showcase", start: "2027-01-08", end: "2027-01-10", dances: "Solo" }, "2026-11-05", {}, ds);
  assert.match(row, /<details class="kev-wear"><summary>👗 Costume, shoes and hair<\/summary>/); assert.match(row, /👗 Blue dress/); assert.match(row, /🩰 Half soles/); assert.match(row, /💇 Low bun/); assert.doesNotMatch(row, /Pink leo|Gone/);
  assert.equal(KE.wearHtml([]), ""); assert.doesNotMatch(KE.kidEventRow({ name: "X", start: "2027-01-08" }, "2026-11-05", {}, []), /kev-wear/);
});

test("the release: What's new tells her about the new map; the version and the README", () => {
  assert.equal(got.news.id, "map-1.64"); assert.deepEqual(got.news.items.map(i => i.id), ["today", "dances", "skills", "me"]);
  assert.doesNotMatch(JSON.stringify(got.news), /streak|Plan done|first, then/i);
  assert.match(src("js/version.js"), /APP_VERSION = "1\.(6[4-9]|[7-9]\d)\./); assert.match(src("README.md"), /### Four ideas \(1\.64\.0\)/);
});
