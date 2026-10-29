// What's new: the five Build 3 things (the four Build 2 things, the five Build 1 things and the six poll features before them),
// steps that quote real button labels, a Today row until opened (seen per phone), Show me how one step at a time, Try it going to the right place.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installEnv, resetDom, el } from "./_env.mjs";
installEnv();
const read = (f) => JSON.parse(readFileSync(new URL("../" + f, import.meta.url), "utf8"));
const src = (f) => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const { applyData, DATA_FILES } = await import("../js/data.js");
const got = {}; for (const f of DATA_FILES) got[f] = read("data/" + f + ".json"); applyData(got);
const { newsItems, isNew, markSeen, TRY, renderNews, renderSheet } = await import("../js/news.js");
// A feature's code; the trick cards' photo button lives in the progress lineup (js/lineup.js) since 1.42.
const FILES = { sunday: ["js/sunday.js", "js/pmode.js"], mom: ["js/momweek.js", "js/views/skillcheck.js", "index.html"], remind: ["js/remind.js"], along: ["js/games/along.js", "index.html"], play: ["js/views/play.js"], today: ["js/views/home.js", "index.html"], checkpoints: ["js/season15.js"], ready: ["js/views/home.js", "js/ready.js"], pass: ["js/pass.js"], plan: ["js/views/home.js", "index.html"], monday: "js/views/home.js", tools: ["js/views/home.js", "js/pmode.js"], timer: "js/pmode.js", games: "js/views/play.js" };

test("the five Build 3 things (1.48.0), each with steps and a place to try it", () => {
  const items = newsItems(got.news); assert.deepEqual(items.map(i => i.id), ["sunday", "mom", "remind", "along", "play"]);
  for (const i of items) { assert.ok(i.e && i.n && i.where && i.pitch, i.id); assert.ok(i.steps.length >= 3 && i.steps.length <= 5, i.id); assert.ok(TRY[i.id], "Try it for " + i.id); assert.ok(i.steps.every(s => s.length < 110), i.id); }
});

test("steps are factual: every quoted button label is a real label in that feature's code", () => {
  for (const i of newsItems(got.news)) {
    const code = [].concat(FILES[i.id]).map(src).join("\n");
    for (const s of i.steps) for (const [, label] of s.matchAll(/“([^”]+)”/g)) assert.ok(code.includes(label), `${i.id}: “${label}” is not in ${FILES[i.id]}`);
  }
  // Try it uses the features' own openers / game ids
  assert.match(src("js/cards.js"), /expose\(\{ openCards/); assert.match(src("js/costume.js"), /expose\(\{ openCostumes/);
  for (const g of ["teach", "count"]) assert.ok(src("js/views/play.js").includes(`id: "${g}"`) || src("js/views/play.js").includes(`id:"${g}"`), "Play has " + g);
  for (const id of ["dareCard", "meGlow", "newsCard", "newsArea"]) assert.ok(src("index.html").includes(`id="${id}"`), id);
});

test("Today row until opened; opening marks it seen on this phone; Show me how steps through and back", () => {
  resetDom(); localStorage.removeItem("spotlight:news");
  assert.equal(isNew(got.news), true); renderNews(); assert.equal(el("#newsCard").hidden, false); assert.match(el("#newsCard").innerHTML, /5 new things in your app/); assert.match(el("#newsCard").innerHTML, /openNews\(\)/);
  window.openNews(); assert.equal(localStorage.getItem("spotlight:news"), got.news.id); assert.equal(isNew(got.news), false);
  assert.equal(el("#newsCard").hidden, true, "the Today row goes once she has opened it");
  const html = el("#newsArea").innerHTML; for (const i of newsItems(got.news)) { assert.ok(html.includes(`newsHow('${i.id}')`), i.id); assert.ok(html.includes(`newsTry('${i.id}')`), i.id); }
  window.newsHow("sunday"); assert.match(el("#newsArea").innerHTML, /Step 1 of 4/); assert.match(el("#newsArea").innerHTML, /Next ›/);
  window.newsStep(1); window.newsStep(1); window.newsStep(1); assert.match(el("#newsArea").innerHTML, /Step 4 of 4/); assert.match(el("#newsArea").innerHTML, /Try it now/);
  window.newsStep(1); assert.match(el("#newsArea").innerHTML, /Step 4 of 4/, "no step past the last");
  for (let k = 0; k < 4; k++) window.newsStep(-1); assert.match(el("#newsArea").innerHTML, /Show me how/, "back to the list");
  markSeen({ id: "" }); assert.equal(localStorage.getItem("spotlight:news"), got.news.id, "an empty id never overwrites");
  assert.equal(isNew({ id: "x", items: [] }), false, "nothing to show, no row");
  window.closeStage && window.closeStage();
});
