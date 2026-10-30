// What's new: the three 1.52.0 kid things (Today fits one screen; the Build 3 edition, its Mom line on her hub card in
// Build 2 things, the five Build 1 things and the six poll features before them), steps that quote real button labels, a Today
// row until opened (seen per phone), Show me how one step at a time, Try it going to the right place.
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
const FILES = { me: ["js/pass.js", "js/pet.js", "index.html"], extras: ["js/views/home.js", "index.html"], sunday: ["js/sunday.js", "js/pmode.js"], mom: ["js/momweek.js", "js/views/skillcheck.js", "index.html"], remind: ["js/remind.js"], along: ["js/games/along.js", "index.html"], play: ["js/views/play.js"], today: ["js/views/home.js", "index.html"], checkpoints: ["js/season15.js"], ready: ["js/views/home.js", "js/ready.js"], pass: ["js/pass.js"], plan: ["js/views/home.js", "index.html"], monday: "js/views/home.js", tools: ["js/views/home.js", "js/pmode.js"], timer: "js/pmode.js", games: "js/views/play.js" };

test("the three 1.52.0 kid things (Today fits one screen), each with steps and a place to try it; Mom's line beside them", () => {
  const items = newsItems(got.news); assert.deepEqual(items.map(i => i.id), ["today", "me", "extras"]);
  assert.ok(got.news.mom && got.news.mom.length < 300 && /on Me/.test(got.news.mom), "Mom's items are one line for the Grown-ups hub");
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
  for (const id of ["playDare", "meGlow", "newsCard", "newsArea"]) assert.ok(src("index.html").includes(`id="${id}"`), id);
});

test("the What's new row (on Me since 1.52.0, with a dot on Me's tab) until opened; opening marks it seen on this phone; Show me how steps through and back", () => {
  resetDom(); localStorage.removeItem("spotlight:news");
  assert.equal(isNew(got.news), true); renderNews(); assert.equal(el("#newsCard").hidden, false); assert.match(el("#newsCard").innerHTML, /3 new things in your app/); assert.match(el("#newsCard").innerHTML, /openNews\(\)/);
  window.openNews(); assert.equal(localStorage.getItem("spotlight:news"), got.news.id); assert.equal(isNew(got.news), false);
  assert.equal(el("#newsCard").hidden, true, "the row goes once she has opened it");
  const html = el("#newsArea").innerHTML; for (const i of newsItems(got.news)) { assert.ok(html.includes(`newsHow('${i.id}')`), i.id); assert.ok(html.includes(`newsTry('${i.id}')`), i.id); }
  window.newsHow("today"); assert.match(el("#newsArea").innerHTML, /Step 1 of 4/); assert.match(el("#newsArea").innerHTML, /Next ›/);
  window.newsStep(1); window.newsStep(1); window.newsStep(1); assert.match(el("#newsArea").innerHTML, /Step 4 of 4/); assert.match(el("#newsArea").innerHTML, /Try it now/);
  window.newsStep(1); assert.match(el("#newsArea").innerHTML, /Step 4 of 4/, "no step past the last");
  for (let k = 0; k < 4; k++) window.newsStep(-1); assert.match(el("#newsArea").innerHTML, /Show me how/, "back to the list");
  markSeen({ id: "" }); assert.equal(localStorage.getItem("spotlight:news"), got.news.id, "an empty id never overwrites");
  assert.equal(isNew({ id: "x", items: [] }), false, "nothing to show, no row");
  window.closeStage && window.closeStage();
});
