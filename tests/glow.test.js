// Glow-Up Flipbook: month keys and labels, newest photo per month, oldest-first pages, the Today nudge (days 1–7 and only
// when this month's photo is missing), the schema-37 migration, and the Me card / nudge / flipbook rendering in the fake DOM.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installEnv, resetDom, el } from "./_env.mjs";
installEnv();
const read = (f) => JSON.parse(readFileSync(new URL("../" + f, import.meta.url), "utf8"));
const src = (f) => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const { applyData, DATA_FILES } = await import("../js/data.js");
const got = {}; for (const f of DATA_FILES) got[f] = read("data/" + f + ".json"); applyData(got);
const G = await import("../js/glow.js");
const { S, migrateDoc, SCHEMA_VERSION, GLOW_POSE_IDS, MIGRATIONS } = await import("../js/store.js");
const { todayStr } = await import("../js/util.js");

const ph = (glow, at, extra = {}) => ({ url: "https://x/" + glow + "-" + at, path: "p/" + at, glow, at: new Date(at).toISOString(), ...extra });

test("poses: a small fixed list, ids match the migration's frozen list, every pose has words and a safe description", () => {
  assert.deepEqual(G.GLOW_POSES.map(p => p.id), GLOW_POSE_IDS);
  for (const p of G.GLOW_POSES) { assert.match(p.id, /^[a-z0-9-]+$/); assert.ok(p.n && p.d && p.ic, p.id); assert.ok(!/flip|aerial|handstand|eyes closed|spotter|mat\b|stairs/i.test(p.d), p.id + " is safe"); }
  const MOVES = got.moves.moves; for (const p of G.GLOW_POSES.filter(p => p.move)) { const m = MOVES.find(x => x.id === p.move); assert.ok(m && m.k[p.k], p.id + " avatar keyframe exists"); }
  assert.equal(G.poseFor("arabesque").n, "Arabesque"); assert.equal(G.poseFor("cartwheel"), null);
  assert.equal(G.glowPose({ glowPose: "passe" }).id, "passe"); assert.equal(G.glowPose({}), null);
});

test("month keys: YYYY-MM from a date, labels, month names, whole months between", () => {
  assert.equal(G.monthKey("2026-10-17"), "2026-10"); assert.equal(G.monthKey("2027-01-01"), "2027-01"); assert.equal(G.monthKey(), todayStr().slice(0, 7));
  assert.equal(G.monthLabel("2026-10"), "Oct 2026"); assert.equal(G.monthLabel("2027-01"), "Jan 2027"); assert.equal(G.monthLabel("2026-13"), ""); assert.equal(G.monthLabel("junk"), "");
  assert.equal(G.monthName("2026-12"), "December");
  assert.equal(G.monthsBetween("2026-01", "2026-10"), 9); assert.equal(G.monthsBetween("2026-11", "2027-02"), 3); assert.equal(G.monthsBetween("2026-10", "2026-10"), 0);
  assert.ok(G.MONTH_RE.test("2026-10") && !G.MONTH_RE.test("2026-1") && !G.MONTH_RE.test("2026-10-01"));
});

test("pages: newest photo per month wins, oldest month first; videos, deleted, url-less and non-glow photos are skipped", () => {
  const photos = {
    a: ph("2026-10", "2026-10-02T10:00:00Z"), b: ph("2026-10", "2026-10-05T10:00:00Z"), c: ph("2026-08", "2026-08-01T10:00:00Z"), d: ph("2026-09", "2026-09-03T10:00:00Z"),
    v: ph("2026-07", "2026-07-01T10:00:00Z", { kind: "video" }), x: ph("2026-06", "2026-06-01T10:00:00Z", { deleted: true }), n: ph("2026-05", "2026-05-01T10:00:00Z", { url: "" }),
    plain: { url: "https://x/plain", at: "2026-10-01T00:00:00Z" }, bad: ph("2026-1", "2026-01-01T00:00:00Z"),
  };
  const pages = G.glowPages(photos);
  assert.deepEqual(pages.map(p => p.month), ["2026-08", "2026-09", "2026-10"]); assert.equal(pages[2].id, "b", "the newer October photo");
  assert.deepEqual(G.olderOfMonth(photos, "2026-10", "b"), ["a"], "a retake removes the older one of the month");
  // a stored _at (write time) beats the at string, so a later write always wins
  const tie = { p: { ...ph("2026-10", "2026-10-09T00:00:00Z"), _at: 1 }, q: { ...ph("2026-10", "2026-10-01T00:00:00Z"), _at: 5 } }; assert.equal(G.glowPages(tie)[0].id, "q");
  assert.equal(G.firstVsNow(pages).first.month, "2026-08"); assert.equal(G.firstVsNow(pages).now.month, "2026-10"); assert.equal(G.firstVsNow(pages).months, 2);
  assert.equal(G.firstVsNow(pages.slice(0, 1)), null); assert.deepEqual(G.glowPages({}), []);
  assert.ok(G.hasMonth("2026-09", photos)); assert.ok(!G.hasMonth("2026-07", photos), "a video doesn't count");
});

test("nudge: only on days 1–7, only when this month's photo is missing, only once a pose is picked", () => {
  const set = { glowPose: "arabesque" }; const has = { a: ph("2026-11", "2026-11-02T10:00:00Z") };
  for (const d of ["01", "04", "07"]) assert.equal(G.showNudge("2026-11-" + d, {}, set), true, "day " + d);
  for (const d of ["08", "15", "30"]) assert.equal(G.showNudge("2026-11-" + d, {}, set), false, "day " + d);
  assert.equal(G.showNudge("2026-11-03", has, set), false, "already taken");
  assert.equal(G.showNudge("2026-12-03", has, set), true, "last month's photo doesn't count for this month");
  assert.equal(G.showNudge("2026-11-03", {}, {}), false, "no pose, no nudge");
  assert.equal(G.showNudge("2026-11-03", {}, { glowPose: "nope" }), false);
});

test("schema 37: photos.glow kept only as YYYY-MM; settings.glowPose kept only when known; nothing invented", () => {
  assert.ok(SCHEMA_VERSION >= 37); assert.equal(typeof MIGRATIONS[37], "function");
  assert.equal(migrateDoc("photos", "a", { _v: 33, url: "u", glow: "2026-10" }).glow, "2026-10");
  for (const bad of ["2026-1", "Oct 2026", "2026-10-01", 202610, null, true, ["2026-10"]]) assert.equal("glow" in migrateDoc("photos", "a", { _v: 33, url: "u", glow: bad }), false, JSON.stringify(bad));
  assert.equal("glow" in migrateDoc("photos", "a", { _v: 33, url: "u" }), false);
  const d = migrateDoc("photos", "a", { _v: 33, url: "u", cap: "c", glow: "x" }); assert.equal(d._v, SCHEMA_VERSION); assert.equal(d.cap, "c");
  assert.equal(migrateDoc("settings", "main", { _v: 33, glowPose: "passe" }).glowPose, "passe");
  assert.equal("glowPose" in migrateDoc("settings", "main", { _v: 33, glowPose: "backflip" }), false); assert.equal("glowPose" in migrateDoc("settings", "main", { _v: 33, glowPose: 3 }), false);
  assert.equal("glowPose" in migrateDoc("settings", "main", { _v: 33, pin: "2027" }), false);
  assert.equal(migrateDoc("dances", "solo", { _v: 33, glow: "junk" }).glow, "junk", "only photos are touched");
});

test("renders: the Me card picks a pose, then shows the pose, months and the two buttons; the nudge and the flipbook render", () => {
  resetDom(); for (const k of Object.keys(S)) S[k] = {};
  G.renderGlowCard(); let h = el("#meGlow").innerHTML;
  assert.ok(h.includes("Glow-Up Flipbook")); for (const p of G.GLOW_POSES) assert.ok(h.includes(`glowPick('${p.id}')`), p.id);
  G.renderGlowNudge(); assert.equal(el("#glowNudge").hidden, true, "no pose yet");
  const month = todayStr().slice(0, 7);
  S.settings = { glowPose: "arabesque" }; G.renderGlowCard(); h = el("#meGlow").innerHTML;
  assert.ok(h.includes("Arabesque") && h.includes("📷 This month's photo") && h.includes("glowFile(this)")); assert.ok(h.includes("0 months")); assert.ok(!h.includes("openGlow()"), "nothing to flip yet"); assert.ok(h.includes("<svg"), "avatar in her pose");
  G.renderGlowNudge("2026-11-03"); assert.equal(el("#glowNudge").hidden, false, "day 3, no photo yet"); assert.match(el("#glowNudge").innerHTML, /Arabesque photo for the flipbook/); assert.ok(!/!|forgot|missed|don't|streak/i.test(el("#glowNudge").innerHTML.replace(/<[^>]+>/g, "")), "calm words");
  G.renderGlowNudge("2026-11-12"); assert.equal(el("#glowNudge").hidden, true, "day 12: no nudge"); assert.equal(el("#glowNudge").innerHTML, "");
  S.photos = { a: ph("2026-08", "2026-08-02T10:00:00Z"), b: ph(month, new Date().toISOString()) }; G.renderGlowCard(); h = el("#meGlow").innerHTML;
  assert.ok(h.includes("2 months") && h.includes("openGlow()") && h.includes("✓")); G.renderGlowNudge(month + "-02"); assert.equal(el("#glowNudge").hidden, true, "taken this month");
  G.renderFlip(); const f = el("#glowArea").innerHTML;
  assert.equal((f.match(/class="glow-page/g) || []).length, 2); assert.ok(f.includes("Aug 2026") && f.includes('type="range"') && f.includes("glowCompare(true)") && f.includes("glowPlay()"));
  window.glowCompare(true); const v = el("#glowArea").innerHTML; assert.ok(v.includes("First · Aug 2026") && v.includes("Now · ") && v.includes("months of growing"));
  window.glowCompare(false); window.glowScrub("1"); assert.ok(el("#glowArea").innerHTML.includes("glow-page"));
  S.photos = {}; S.settings = {};
});

test("wiring: the ids sit where they should in index.html, Today and Me render them, the upload reuses the Moments path, nothing public", () => {
  const html = src("index.html");
  assert.ok(html.indexOf('id="glowNudge"') < html.indexOf('id="todayCard"') && html.indexOf('id="glowNudge"') > html.indexOf('id="p-home"'));
  assert.match(html, /id="glowNudge"[^>]*hidden/);
  const me = html.indexOf('id="p-me"'), card = html.indexOf('id="meGlow"'), area = html.indexOf('id="glowArea"'), friends = html.indexOf('id="meFriends"');
  assert.ok(me < card && card < area && area < friends, "meGlow and glowArea right before meFriends inside p-me");
  assert.ok(html.indexOf("</section>", me) > friends);
  assert.match(src("js/views/home.js"), /renderGlowNudge\(\)/); assert.match(src("js/views/me.js"), /renderGlowCard\(\)/); assert.match(src("js/app.js"), /initGlow\(\)/);
  const g = src("js/glow.js"); assert.match(g, /media\.upload\("photos"/); assert.match(g, /storeSet\("photos"/); assert.match(g, /resizeImage/);
  assert.ok(!/firestore\.rules|public|publish/i.test(g.replace(/^\/\/.*$/gm, "")), "no public sharing code");
  assert.ok(src("sw.js").includes("./js/glow.js"));
});
