// 1.62.0 (Jenya, Nov 5; step 3 of the reorganization): the Dances tab opens on small tiles — the competition dances with
// 🎵 on each, the class dances folded into one row — and a tile opens that dance's page: music, Hannah's videos, Memorize and
// the tricks in the dance on top, then ＋ Note, the fixes and More ▸.
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
const D = await import("../js/views/dances.js");
await import("../js/memo.js");
const clearS = () => { for (const k of Object.keys(S)) S[k] = {}; };

test("which dances are class dances; the tiles' two groups keep the list's order", () => {
  assert.equal(D.isClassDance({ id: "wf-ballet", name: "Winter Formal · Ballet III class dance" }), true); assert.equal(D.isClassDance({ id: "d123", name: "Tap class dance" }), true, "a family-added class dance too");
  for (const id of ["solo", "trio", "pitch-jazz", "pitch-contemp"]) assert.equal(D.isClassDance(got.dances.find(d => d.id === id)), false, id);
  const g = D.danceGroups(got.dances); assert.deepEqual(g.comp.map(d => d.id), ["solo", "trio", "pitch-jazz", "pitch-contemp"]); assert.equal(g.cls.length, 6); assert.ok(g.cls.every(d => /^wf-/.test(d.id)));
  assert.deepEqual(D.danceGroups(null), { comp: [], cls: [] });
  assert.equal(D.danceTricks({ id: "solo" }).length, got.skills.styles.solo.skills.length, "the solo's tricks, as the Skills page lists them"); assert.ok(D.danceTricks({ id: "solo" }).length >= 12); assert.deepEqual(D.danceTricks({ id: "trio" }), []);
});

test("the tab opens on tiles: four competition dances with 🎵, the class dances in one folded row, no full card", () => {
  resetDom(); clearS(); D.initDances(); D.danceOpen(null); const h = el("#danceList").innerHTML;
  assert.equal((h.match(/class="dance-tile/g) || []).length, 10); assert.equal((h.match(/dt-music/g) || []).length, 4, "🎵 on the competition dances only");
  assert.match(h, /onclick="danceOpen\('solo'\)"/); assert.match(h, /event\.stopPropagation\(\);openPlayer\('solo'\)/);
  assert.match(h, /<details class="card acc class-fold"><summary>🎓 Class dances <span class="chip">6<\/span><\/summary>/); assert.doesNotMatch(h, /class-fold" open/);
  assert.ok(h.indexOf("danceOpen('pitch-contemp')") < h.indexOf("class-fold"), "the competition dances come first");
  assert.doesNotMatch(h, /More ▸|＋ Note|data-memo=/, "nothing text-heavy on the first screen");
  S.corrections = { a: { id: "a", danceId: "solo", text: "Point", tag: "feet", status: "working" }, b: { id: "b", danceId: "solo", text: "Eyes", tag: "eyes", status: "done" } }; D.renderDances();
  assert.match(el("#danceList").innerHTML, /· 1 fix</, "a tile counts its open fixes"); resetDom(); clearS();
});

test("a tile opens that dance's page: music, videos, Memorize and the tricks on top; ＋ Note, More ▸ and the way back", () => {
  resetDom(); clearS(); D.initDances(); D.danceOpen("solo"); const h = el("#danceList").innerHTML;
  assert.equal(D.openDanceId(), "solo"); assert.match(h, /danceOpen\(null\)">‹ All dances<\/button>/); assert.equal((h.match(/class="card cover/g) || []).length, 1, "one dance, not the list");
  const at = (s) => h.indexOf(s); assert.ok(at("🎵 Play music") > 0 && at("🎵 Play music") < at("🧠 Memorize") && at("🧠 Memorize") < at("⭐ Tricks in this dance") && at("⭐ Tricks in this dance") < at("More ▸"), "what she uses most is on top");
  assert.match(h, /openPlayer\('solo'\)">🎵 Play music/); assert.match(h, /noteOpen\('solo'\)">＋ Note/);
  assert.equal((h.match(/onclick="goalOpen\('s-/g) || []).length, got.skills.styles.solo.skills.length, "each trick opens its own page (1.66.0)"); assert.match(h, /goalOpen\('s-cartwheel'\)">[^<]* Cartwheel</);
  assert.equal(el("#addDanceRow").hidden, true);
  // the trio has no trick list; the Dances tab comes back to the tiles
  D.danceOpen("trio"); assert.doesNotMatch(el("#danceList").innerHTML, /Tricks in this dance/); assert.match(el("#danceList").innerHTML, /data-memo="trio"/);
  assert.ok(src("js/views/dances.js").includes('document.addEventListener("page",(e)=>{ if(e&&e.detail==="dances"&&openDance&&!editDance){ openDance=null;'), "tapping the Dances tab comes back to the tiles");
  D.danceOpen(null); assert.equal(D.openDanceId(), null); assert.match(el("#danceList").innerHTML, /class="dance-tile/); assert.equal(el("#addDanceRow").hidden, false);
  // the old ways in still land on the right page: the Memorize fold (Today, the plan), a note from class, the judges' clips
  window.memoFocus("trio"); assert.equal(D.openDanceId(), "trio"); window.noteOpen("solo"); assert.equal(D.openDanceId(), "solo"); assert.match(el("#danceList").innerHTML, /id="noteText-solo"/);
  window.judgesOpen("trio"); assert.equal(D.openDanceId(), "trio"); D.danceOpen("nope"); assert.equal(D.openDanceId(), null, "an unknown id falls back to the tiles");
  resetDom(); clearS();
});

test("the release: the page's markup, the version and the README", () => {
  const html = src("index.html"); assert.match(html, /<h2 id="dancesTitle">My dances<\/h2>/); assert.match(html, /<details class="card acc" id="addDanceRow"><summary>＋ Add a dance<\/summary>/);
  assert.match(src("js/version.js"), /APP_VERSION = "1\.(6[2-9]|[7-9]\d)\./); assert.match(src("README.md"), /### Dances as tiles \(1\.62\.0\)/);
});
