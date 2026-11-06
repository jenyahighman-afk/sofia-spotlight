// 1.63.0 (Jenya, Nov 5; step 4 of the reorganization): Me is hers first, the set-once things are folded under ⚙️ My app,
// three cards left it (Personal bests; My dance friends and Pick one extra are one line each on Play), and her dancer and her
// pet can each be put away and brought back.
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
const B = await import("../js/buddy.js");
const html = src("index.html");
const section = (id) => html.slice(html.indexOf(`id="p-${id}"`), html.indexOf("</section>", html.indexOf(`id="p-${id}"`)));
const clearS = () => { for (const k of Object.keys(S)) S[k] = {}; };

test("Me's order: hers first, the set-once things under ⚙️ My app; three cards left", () => {
  const me = section("me"); const at = (id) => me.indexOf(`id="${id}"`);
  const order = ["avWrap", "meStreak", "newsCard", "mePlay", "meMoments", "homeWeek", "petCard", "passCard", "meStars", "meCostumes", "badgeCase", "mePatterns", "meSetup", "meReminder", "paletteRow", "ritualCard", "meHide", "meGrownups"];
  for (let i = 1; i < order.length; i++) assert.ok(at(order[i - 1]) >= 0 && at(order[i - 1]) < at(order[i]), `${order[i - 1]} before ${order[i]}`);
  assert.match(me, /<details class="more me-setup" id="meSetup"><summary>⚙️ My app<\/summary>/); assert.doesNotMatch(me, /id="meSetup" open/);
  assert.doesNotMatch(html, /id="meBests"|Personal bests<\/h3>/, "bests are on the game tiles"); assert.doesNotMatch(src("js/views/me.js"), /meBests/);
  assert.doesNotMatch(me, /id="meFriends"/); const play = section("play");
  assert.match(play, /id="whoRow"><\/div>\s*<details class="more friends-fold" id="friendsFold"><summary>👯 My dance friends<\/summary>\s*<div class="card aqua" id="meFriends"><\/div>/, "My dance friends sits with Who's dancing");
  assert.match(play, /<details class="more habit-fold" id="habitFold"><summary>✨ One more thing to pick<\/summary>\s*<div class="card violet habit-card" id="habitCard"><\/div>/, "Pick one extra is one line until she opens it");
  for (const id of ["meFriends", "habitCard", "meReminder", "paletteRow", "ritualCard"]) assert.equal((html.match(new RegExp(`id="${id}"`, "g")) || []).length, 1, id + " exists once");
});

test("her dancer and her pet can each be put away and brought back; nothing is deleted", async () => {
  assert.deepEqual(ME.hidden({}), { avatar: false, pet: false }); assert.deepEqual(ME.hidden({ hide: { pet: true, other: 1 } }), { avatar: false, pet: true }); assert.deepEqual(ME.hidden({ hide: "x" }), { avatar: false, pet: false });
  assert.equal(B.petHidden({}), false); assert.equal(B.petHidden({ hide: { pet: true } }), true);
  resetDom(); clearS(); ME.renderMe(); assert.equal(el("#avWrap").hidden, false); assert.equal(el("#petFold").hidden, false, "1.66.3: the pet's fold");
  assert.match(el("#meHide").innerHTML, /👀 What's showing/); assert.match(el("#meHide").innerHTML, /meHide\('avatar'\)">Showing · hide/); assert.match(el("#meHide").innerHTML, /meHide\('pet'\)">Showing · hide/);
  S.settings = { avatar: { name: "Sofia" }, hide: { avatar: true, pet: true } }; ME.renderMe();
  assert.equal(el("#avWrap").hidden, true); assert.equal(el("#petFold").hidden, true, "putting the pet away hides its fold"); assert.match(el("#meHide").innerHTML, /meHide\('pet'\)">Hidden · show/);
  assert.deepEqual(S.settings.avatar, { name: "Sofia" }, "her dancer's look is kept");
  B.renderBuddy(); assert.equal(el("#buddy").hidden, true, "the corner helper goes with the pet"); assert.equal(B.showBuddy(), null, "and nothing pops up");
  S.settings = {}; B.renderBuddy(); assert.notEqual(B.showBuddy(), null); B.hideBuddy();
  assert.match(src("js/buddy.js"), /el\.hidden = petHidden\(\) \|\| !KID_PAGES\.includes\(e\.detail\)/);
  resetDom(); clearS();
});

test("the release: the version and the README", () => {
  assert.match(src("js/version.js"), /APP_VERSION = "1\.(6[3-9]|[7-9]\d)\./); assert.match(src("README.md"), /### Me, tidied \(1\.63\.0\)/);
});
