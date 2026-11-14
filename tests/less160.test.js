// 1.60.0 (Jenya, Nov 5; step 1 of the reorganization): the app asks less. Dance it once, counts that only go up, the games
// open every day, class days free, reminders off until she turns one on.
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
const ST = await import("../js/streak.js");
const HM = await import("../js/views/home.js");
const PL = await import("../js/player.js");
const RM = await import("../js/remind.js");
const W = await import("../worker/src/remind-core.js");
const { todayStr } = await import("../js/util.js");
const clearS = () => { for (const k of Object.keys(S)) S[k] = {}; };

test("a dance day is a day she danced her solo or her trio; the counts only go up", () => {
  assert.equal(ST.danced({ runs: [{ danceId: "solo" }] }), true); assert.equal(ST.danced({ runs: [{ danceId: "trio" }] }), true, "a trio dance counts too");
  assert.equal(ST.danced({ done: ["mem-top"] }), true, "the solo part of a session"); assert.equal(ST.danced({ bites: ["game"] }), false, "a game isn't a dance"); assert.equal(ST.danced(null), false);
  const practice = { "2026-11-01": { runs: [{ danceId: "solo" }, { danceId: "trio" }] }, "2026-11-02": { bites: ["tired"] }, "2026-11-05": { runs: [{ danceId: "trio", once: true }] }, main: { runs: [{}] } };
  assert.equal(ST.danceDays(practice), 2); assert.equal(ST.danceCount(practice), 3, "every run of either dance; the settings doc is not a day");
  assert.equal(ST.danceDays({}), 0); assert.equal(ST.danceCount(null), 0);
  // a gap changes nothing: the same records two weeks later give the same counts
  assert.equal(ST.danceDays({ ...practice }), 2);
});

test("Dance it once: the buttons open the player playing, the track's end is one dance with no questions", () => {
  const b = HM.danceButtons({ kind: "home" }); assert.match(b, /openPlayer\('solo',\{once:true\}\)/); assert.match(b, /openPlayer\('trio',\{once:true\}\)/);
  assert.equal(PL.onceLine(1), "⭐ You danced it! That's 1 dance so far."); assert.equal(PL.onceLine(7), "⭐ You danced it! That's 7 dances so far.");
  const p = src("js/player.js");
  assert.match(p, /if \(PL\.run\) runEnded\(\); else if \(PL\.once && PL\.a === null\) onceEnded\(\);/, "a looped part is not a whole dance");
  assert.match(p, /danceId: d\.id, speed: PL\.speed, full: true, once: true \}/); assert.match(p, /if \(PL\.once\) play\(\);/);
  const once = p.slice(p.indexOf("async function onceEnded"), p.indexOf("function onceAgain")); assert.doesNotMatch(once, /ask\(|Did you|Eyes up/, "no questions after a dance");
});

test("Today asks less: a class day nothing, a home day one thing, the whole session one link away", () => {
  assert.equal(HM.DAY_ASK.studio, "Class comes first today. Got a chance at home? Dance one thing."); // 1.77.0 assert.equal(HM.DAY_ASK.home, "Pick one thing, about 10 minutes. That's all.");
  resetDom(); clearS(); HM.renderHome(); const tc = el("#todayCard").innerHTML;
  assert.match(tc, /▶ My solo/); assert.match(tc, /▶ My trio/); assert.match(tc, /📹 Videos/); assert.match(tc, /🧠 Memorize/);
  assert.doesNotMatch(tc, /streak|off left|without your solo|did you make it|Start practice|Memory run|After breakfast/i);
  const today = todayStr(); S.practice = { [today]: { runs: [{ at: today, danceId: "solo", once: true, full: true }] } }; HM.renderHome(); const done = el("#todayCard").innerHTML;
  assert.match(done, /✅ My solo/); assert.match(done, /⭐ Plan done: you danced your solo today/); assert.match(done, /⭐ 1 dance day<\/span> · 🎵 1 dance/);
  resetDom(); clearS();
});

test("reminders: the home days only, never a second time, off until she turns one on", () => {
  assert.deepEqual(RM.planWeekdays().days, [0, 4, 5]);
  const body = RM.subscribeBody({ on: true, h: 17, m: 0, second: true, h2: 18, m2: 30 }, { familyId: "F", endpoint: "e", keys: {}, tz: "America/Los_Angeles", dates: {} });
  assert.equal("h2" in body, false); assert.equal("m2" in body, false); assert.deepEqual(body.kinds, { 0: "home", 4: "home", 5: "home" });
  const r = src("js/remind.js"); assert.match(r, /if \(!seen && subscribedHere\(\)\) \{ off\(true\)/, "a phone subscribed before 1.60.0 is switched off once"); assert.doesNotMatch(r, /rmSecond|rmTime2/);
  assert.deepEqual(W.KIND_LINES.home, ["Dance time 🎵", "Your music is ready. One dance, about 2 minutes ⭐"]);
  for (const [t, b] of [...W.LINES, ...Object.values(W.KIND_LINES)]) assert.doesNotMatch(t + b, /streak|first/i, t);
});

test("the release: the version, the README, nothing about a day without dancing in the Bunny's lines", () => {
  assert.match(src("js/version.js"), /APP_VERSION = "1\.(6\d|[7-9]\d)\./);
  assert.match(src("README.md"), /### Asking less \(1\.60\.0\)/);
  const bj = json("buddy"); const buddy = JSON.stringify([bj.openers, bj.steps, bj.facts]); assert.doesNotMatch(buddy, /misses you|days off left|-day streak|Streak safe/);
});
