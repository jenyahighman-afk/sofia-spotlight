// 1.64.3 (Jenya, Nov 5: "keep the four, folded under My classes"): on Skills the Solo tricks and Acro rings stay in view,
// and the four class lists (Ballet, Jazz, Contemporary, Hip hop) sit in one fold. Reads files and the fake DOM only: no
// clock, no weekday, no timezone.
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
const ME = await import("../js/views/me.js");
const clearS = () => { for (const k of Object.keys(S)) S[k] = {}; };

test("the four class lists are one fold; Solo tricks and Acro stay in view", () => {
  assert.deepEqual(ME.CLASS_STYLES, ["ballet", "jazz", "contemporary", "hiphop"]);
  for (const k of ME.CLASS_STYLES) assert.ok(json("skills").styles[k], k + " is a list in data/skills.json");
  const g = ME.ringGroups({ solo: 1, ballet: 2, jazz: 3, contemporary: 4, acro: 5, hiphop: 6, tap: 7 });
  assert.deepEqual(g.main.map(([k]) => k), ["solo", "acro", "tap"], "a list added later shows until it is named a class list"); assert.deepEqual(g.classes.map(([k]) => k), ME.CLASS_STYLES);
  assert.deepEqual(ME.ringGroups(null), { main: [], classes: [] });
  resetDom(); clearS(); ME.renderMe();
  const main = el("#skillRings").innerHTML, cls = el("#classRings").innerHTML;
  assert.ok(main.includes("Solo tricks") && main.includes("Acro")); for (const n of ["Ballet", "Jazz", "Contemporary", "Hip hop"]) { assert.ok(!main.includes(n), n + " is not in the top row"); assert.ok(cls.includes(n), n + " is in the fold"); }
  assert.equal(el("#classNames").textContent, "Ballet, Jazz, Contemporary, Hip hop"); assert.equal(el("#classFold").hidden, false); assert.ok(!el("#classFold").open, "folded until she opens it");
  resetDom(); clearS();
});

test("a ring in the fold opens its list as before, and the fold stays open while it does", () => {
  resetDom(); clearS(); ME.renderMe();
  window.meStyle("ballet"); assert.equal(el("#classFold").open, true); assert.match(el("#classRings").innerHTML, /class="skill-ring on" onclick="meStyle\('ballet'\)"/);
  const first = json("skills").styles.ballet.skills[1].n; assert.ok(el("#skillList").innerHTML.includes(first), "the Ballet list is drawn"); assert.ok(el("#skillList").innerHTML.includes("Right split"), "under the split rows");
  window.meStyle("ballet"); assert.ok(!el("#skillList").innerHTML.includes(first), "a second tap closes the list");
  window.meStyle("acro"); assert.match(el("#skillRings").innerHTML, /class="skill-ring on" onclick="meStyle\('acro'\)"/); window.meStyle("acro");
  resetDom(); clearS();
});

test("the page and the release", () => {
  const html = src("index.html"), sk = html.slice(html.indexOf('id="p-skills"'), html.indexOf('id="p-practice"'));
  assert.match(sk, /<details class="more class-fold" id="classFold"><summary>🩰 My classes <span class="small muted" id="classNames"><\/span><\/summary><div class="skill-rings" id="classRings"><\/div><\/details>/);
  assert.ok(sk.indexOf('id="skillRings"') < sk.indexOf('id="classFold"') && sk.indexOf('id="classFold"') < sk.indexOf('id="skillList"'), "rings, the fold, then the lists");
  for (const id of ["classFold", "classRings", "classNames"]) assert.equal((html.match(new RegExp(`id="${id}"`, "g")) || []).length, 1, id + " exists once");
  assert.match(src("js/version.js"), /APP_VERSION = "1\.(64\.[3-9]|6[5-9]|[7-9]\d)/); assert.match(src("README.md"), /\*\*1\.64\.3:\*\* on 📈 Skills the Solo tricks and Acro rings stay in view/);
});
