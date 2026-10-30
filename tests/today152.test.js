// Today fits one screen (1.52.0): the one card (the streak and the day off in one line, How ready?, the dated line, the
// plan-done link to Play), the next finish line folded under it with the season card inside; the pet, the Pass, What's new
// (a dot on Me's tab) and the week strip on Me; ✨ Pick one extra and More for today on Play; this week's fix on Practice;
// the Bunny waits for the plan. What the printed Pass says about Today stays true.
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
const HM = await import("../js/views/home.js");
const PL = await import("../js/views/play.js");
const DP = await import("../js/dayplan.js");
const B = await import("../js/buddy.js");
const NW = await import("../js/news.js");
const { todayStr } = await import("../js/util.js");
const clearS = () => { for (const k of Object.keys(S)) S[k] = {}; };
const html = src("index.html");
const page = (id) => { const a = html.indexOf(`<section class="page${id === "home" ? " on" : ""}" id="p-${id}">`); return html.slice(a, html.indexOf("</section>", a)); };

test("Today holds the one card, the folded finish lines and the cards that only come on their day; everything else moved one tap away", () => {
  const home = page("home"), me = page("me"), play = page("play"), practice = page("practice");
  for (const id of ["todayCard", "seasonFold", "seasonSum", "seasonCard", "sundayCard", "compCard", "goalReminder", "glowNudge"]) assert.ok(home.includes(`id="${id}"`), "Today: " + id);
  for (const id of ["petCard", "passCard", "newsCard", "homeWeek", "habitCard", "moreToday", "bitesCard", "mindCard", "weekFix", "adventCard", "dareCard", "extrasGate", "dayPlan"]) assert.ok(!home.includes(`id="${id}"`), "not on Today: " + id);
  const at = (id) => me.indexOf(`id="${id}"`); assert.ok(at("avWrap") < at("newsCard") && at("newsCard") < at("petCard") && at("petCard") < at("passCard") && at("passCard") < at("homeWeek") && at("homeWeek") < at("meStars"), "Me: the dancer, What's new, the pet, the Pass, the week, then the stars");
  assert.ok(play.indexOf('id="playToday"') > play.indexOf('id="playExtras"') && play.indexOf('id="habitCard"') > play.indexOf('id="playToday"') && play.indexOf('id="bitesCard"') > play.indexOf('id="moreToday"') && play.indexOf('id="mindCard"') > play.indexOf('id="moreToday"'), "Play: the extras card and More for today under the games");
  assert.ok(practice.indexOf('id="weekFix"') > practice.indexOf('id="startPractice"'), "Practice: this week's fix under the start card");
  assert.match(src("js/views/play.js"), /const pt = \$\("#playToday"\); if \(pt\) pt\.hidden = !!openGame;/, "an open game hides them like the other extras");
});

test("the one card's lines: the streak and the day off, the finish line, the link to Play, a memory-run day adds no dated line", () => {
  assert.match(HM.metaLine({ streak: 3, skips: 2 }), /🔥 3-day streak<\/span> · 2 days off left this week · <button class="lnk" onclick="openReady\(\)">How ready\?<\/button>/);
  assert.match(HM.metaLine({ streak: 0, skips: 1 }), /1 day off left this week/); assert.match(HM.metaLine({ safe: true }), /✓ Streak safe · solo next/); assert.match(HM.metaLine({ pd: true, safe: true }), /⭐ Plan done/);
  const d = "2026-11-08"; assert.equal(HM.finishLine(null), "🏁 My finish lines");
  assert.match(HM.finishLine({ state: "book", t: "Private with Hannah" }), /^🎯 <b>Book it:<\/b> Private with Hannah$/);
  assert.match(HM.finishLine({ state: "passed", d, t: "Clean run" }), /did you make it\?/); assert.match(HM.finishLine({ state: "today", d, t: "Clean run" }), /^🎯 <b>Today!<\/b> Clean run$/);
  assert.match(HM.finishLine({ state: "next", d: "2099-01-01", t: "Clean run" }), /\(\d+ days\)<\/span> · Clean run$/);
  assert.match(HM.finishLine({ state: "next", d, t: "<b>" }), /&lt;b&gt;/, "escaped");
  assert.equal(DP.dayNoteHtml({ label: "15-minute memory run", note: "short version" }), "", "the button says it"); assert.equal(DP.dayNoteHtml({ label: "", note: "Hold Sunday" }), "📋 Hold Sunday");
  const home = src("js/views/home.js"); assert.doesNotMatch(home, /todayCount|moves known|At home: /, "no second countdown, no solo count, no memory-run repeat");
  assert.match(home, /<div class="today-line small dp-line" id="dayPlan" hidden><\/div>/); assert.match(home, /\$\{funLink\(\{pd,kind\}\)\}/);
  assert.doesNotMatch(home, /All games/, "the extras card is on Play: no button to Play on it");
});

test("the screens render: the one card on Today, the fold's line, the moved cards still drawn wherever they live", () => {
  resetDom(); clearS(); HM.renderHome();
  const tc = el("#todayCard").innerHTML; assert.match(tc, /today-start/); assert.match(tc, /How ready\?/); assert.match(tc, /🧠 Memorize/); assert.doesNotMatch(tc, /chip coral|todayCount/);
  assert.match(el("#seasonSum").innerHTML, /^<span class="fl-text">(🎯|🏁)/); assert.equal(typeof el("#seasonFold").hidden, "boolean");
  assert.match(el("#habitCard").innerHTML, /✨ Pick one extra/); assert.ok(el("#petCard").innerHTML.length > 0, "the pet on Me"); assert.ok(el("#homeWeek").innerHTML.includes('class="day'), "the week on Me");
  PL.renderPlay(); assert.equal(el("#playToday").hidden, false);
  resetDom(); clearS();
});

test("What's new is a row on Me and a dot on Me's tab until she opens it; Try it goes where things live now", () => {
  resetDom(); localStorage.removeItem("spotlight:news");
  NW.renderNews(); const tab = el('nav.tabs button[data-p="me"]'); assert.equal(tab.classList.contains("has-news"), true); assert.equal(el("#newsCard").hidden, false);
  window.openNews(); NW.renderNews(); assert.equal(tab.classList.contains("has-news"), false, "opened: the dot goes"); window.closeStage && window.closeStage();
  assert.deepEqual(NW.TRY.checkpoints, { page: "home", scroll: "#seasonFold", open: true }, "the finish lines open their fold");
  assert.equal(NW.TRY.pass.page, "me"); assert.deepEqual(NW.TRY.dares, { page: "play", scroll: "#playDare" }); assert.equal(NW.TRY.me.page, "me"); assert.equal(NW.TRY.extras.page, "play");
  const css = src("css/app.css"); assert.match(css, /nav\.tabs button\.has-news:after\{content:"";[^}]*pointer-events:none\}/); assert.match(css, /\.season-fold\[open\]>summary:after\{transform:rotate\(90deg\)\}/);
  resetDom(); localStorage.removeItem("spotlight:news");
});

test("the Bunny waits in its corner until the plan is done (a rest day has none); the dare tip points at Play", () => {
  assert.equal(B.autoOk({ pd: false, kind: "home" }), false); assert.equal(B.autoOk({ pd: false, kind: "memory" }), false); assert.equal(B.autoOk({ pd: true, kind: "home" }), true); assert.equal(B.autoOk({ kind: "rest" }), true);
  const bj = src("js/buddy.js"); assert.match(bj, /autoOk\(\{ pd: planDone\(S\.practice\[d\]\), kind: dayKindNow\(d\) \}\)/); assert.match(bj, /showPage\('play'\);buddyScroll\('#playDare'\)/); assert.doesNotMatch(bj, /#dareCard/);
});

test("what the printed Pass says about Today stays true", () => {
  const pass = JSON.stringify(json("pass")); const home = page("home");
  assert.match(pass, /Sunday sheet on Today/); assert.ok(home.includes('id="sundayCard"'), "the Sunday sheet's card is on Today");
  assert.match(pass, /finish lines are on Today's season card/); assert.ok(home.includes('id="seasonCard"'), "the season card is on Today, inside the fold");
  assert.match(pass, /How ready\? on Today/); assert.match(src("js/views/home.js"), /onclick="openReady\(\)">How ready\?/);
  assert.match(pass, /They live on Play/); assert.ok(page("play").includes('id="playDare"'));
});
