// The flip-book (1.66.2): the old Growing-up Flipbook's photos move onto the goal their pose is, once; ▶ Play on a goal's
// page flips through that goal's photos; the Me card, the Today nudge and the pet's line are gone. Month keys and the
// schema-37 migration stay. Reads files and the fake DOM only; every date is passed in.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installEnv, resetDom, el } from "./_env.mjs";
installEnv();
const read = (f) => JSON.parse(readFileSync(new URL("../" + f, import.meta.url), "utf8"));
const src = (f) => readFileSync(new URL("../" + f, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const { applyData, DATA_FILES } = await import("../js/data.js");
const got = {}; for (const f of DATA_FILES) got[f] = read("data/" + f + ".json"); applyData(got);
const G = await import("../js/glow.js");
const GP = await import("../js/goalpage.js");
const W = await import("../js/working.js");
const { S, setBackend, migrateDoc, SCHEMA_VERSION, GLOW_POSE_IDS, MIGRATIONS } = await import("../js/store.js");
const { todayStr } = await import("../js/util.js");
const clearS = () => { for (const k of Object.keys(S)) S[k] = {}; };

const ph = (glow, at, extra = {}) => ({ url: "https://x/" + glow + "-" + at, path: "p/" + at, glow, at: new Date(at).toISOString(), ...extra });

test("poses: the frozen list, and the goal each one's photos belong to now", () => {
  assert.deepEqual(G.GLOW_POSES.map(p => p.id), GLOW_POSE_IDS);
  const ballet = got.skills.styles.ballet.skills.map(s => s.id);
  for (const p of G.GLOW_POSES) { assert.match(p.id, /^[a-z0-9-]+$/); assert.ok(p.n && p.ic, p.id); if (p.split) assert.ok(!p.card); else assert.ok(ballet.includes(p.card), p.id + " → a ballet skill"); }
  assert.deepEqual(G.GLOW_POSES.map(p => p.card || "split"), ["b-arab", "b-passe", "b-plie", "b-releve", "split"]);
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
  const tie = { p: { ...ph("2026-10", "2026-10-09T00:00:00Z"), _at: 1 }, q: { ...ph("2026-10", "2026-10-01T00:00:00Z"), _at: 5 } }; assert.equal(G.glowPages(tie)[0].id, "q");
  assert.equal(G.firstVsNow(pages).first.month, "2026-08"); assert.equal(G.firstVsNow(pages).now.month, "2026-10"); assert.equal(G.firstVsNow(pages.slice(0, 1)), null); assert.deepEqual(G.glowPages({}), []);
});

test("the move: every old page goes onto the goal its pose is, once; the split goes to the split she checks in", () => {
  const photos = { a: ph("2026-09", "2026-09-02T10:00:00Z"), b: ph("2026-10", "2026-10-05T10:00:00Z"), done: ph("2026-08", "2026-08-01T10:00:00Z", { card: "b-arab" }), done2: ph("2026-07", "2026-07-01T10:00:00Z", { goal: "g1" }) };
  assert.deepEqual(G.flipbookMoves(photos, { glowPose: "arabesque" }, {}), [{ pid: "a", card: "b-arab" }, { pid: "b", card: "b-arab" }], "the two not linked yet, oldest first");
  assert.deepEqual(G.flipbookMoves(photos, { glowPose: "releve" }, {}).map(m => m.card), ["b-releve", "b-releve"]); assert.deepEqual(G.flipbookMoves(photos, { glowPose: "first-position" }, {})[0].card, "b-plie");
  assert.deepEqual(G.flipbookMoves(photos, {}, {}), [], "no pose picked: nothing moves"); assert.deepEqual(G.flipbookMoves(photos, { glowPose: "nope" }, {}), []); assert.deepEqual(G.flipbookMoves({ done: photos.done }, { glowPose: "arabesque" }, {}), [], "already linked");
  const left = { g: { id: "g", preset: "split-l", createdAt: "2026-09-01", checkins: [{ date: "2026-09-01" }] } }, both = { ...left, h: { id: "h", preset: "split-r", createdAt: "2026-09-01", checkins: [{ date: "2026-09-01" }] } };
  assert.equal(G.splitTarget({}), "split-r", "nothing checked in yet: the right split"); assert.equal(G.splitTarget(left), "split-l", "only the left has check-ins"); assert.equal(G.splitTarget(both), "split-r");
  assert.deepEqual(G.flipbookMoves(photos, { glowPose: "split" }, left), [{ pid: "a", split: "split-l" }, { pid: "b", split: "split-l" }]);
});

test("the move writes: a skill's photo gets its card, a split's photo becomes a check-in of the split's document; nothing deleted", async () => {
  resetDom(); clearS(); const writes = []; setBackend({ set: async (col, id) => { writes.push(col + "/" + id); }, del: async () => {} });
  try {
    S.photos = { a: ph("2026-09", "2026-09-02T10:00:00Z"), b: ph("2026-10", "2026-10-05T10:00:00Z") }; S.settings = { glowPose: "passe" };
    assert.equal(await G.migrateFlipbook(), 2); assert.equal(S.photos.a.card, "b-passe"); assert.equal(S.photos.b.card, "b-passe"); assert.equal(S.photos.a.glow, "2026-09", "the month stays on the document"); assert.equal(S.settings.glowPose, "passe");
    assert.deepEqual(writes, ["photos/a", "photos/b"]); assert.equal(await G.migrateFlipbook(), 0, "nothing left to move");
    assert.deepEqual(W.goalShots("b-passe", { goals: {}, photos: S.photos }).map(p => p.url), [S.photos.a.url, S.photos.b.url], "in the trick's lineup now");
    clearS(); writes.length = 0; S.photos = { a: ph("2026-09", "2026-09-02T10:00:00Z") }; S.settings = { glowPose: "split" };
    assert.equal(await G.migrateFlipbook(), 1); const g = Object.values(S.goals)[0]; assert.equal(g.preset, "split-r"); assert.deepEqual(g.checkins.map(c => [c.date, c.photoId, c.value]), [["2026-09-02", "a", null]]); assert.equal(S.photos.a.goal, g.id);
    assert.deepEqual(W.goalShots("split-r", { goals: S.goals, photos: S.photos }).map(p => p.url), [S.photos.a.url], "in the split's photos now");
    assert.ok(writes.every(w => /^(photos|goals)\//.test(w)), "only photo and goal writes"); assert.equal(await G.migrateFlipbook(), 0);
  } finally { setBackend(null); resetDom(); clearS(); }
});

test("schema 37: photos.glow kept only as YYYY-MM; settings.glowPose kept only when known; nothing invented", () => {
  assert.ok(SCHEMA_VERSION >= 37); assert.equal(typeof MIGRATIONS[37], "function");
  assert.equal(migrateDoc("photos", "a", { _v: 33, url: "u", glow: "2026-10" }).glow, "2026-10");
  for (const bad of ["2026-1", "Oct 2026", "2026-10-01", 202610, null, true, ["2026-10"]]) assert.equal("glow" in migrateDoc("photos", "a", { _v: 33, url: "u", glow: bad }), false, JSON.stringify(bad));
  assert.equal(migrateDoc("settings", "main", { _v: 33, glowPose: "passe" }).glowPose, "passe");
  assert.equal("glowPose" in migrateDoc("settings", "main", { _v: 33, glowPose: "backflip" }), false);
  assert.equal(migrateDoc("dances", "solo", { _v: 33, glow: "junk" }).glow, "junk", "only photos are touched");
});

test("▶ Play: on a goal's page once there are two photos; the player flips, scrubs, pauses and compares first with now", () => {
  const two = { id: "s-cartwheel", shots: [{ url: "a.jpg", date: "2026-10-01" }, { url: "b.jpg", date: "2026-11-01" }] };
  assert.equal(GP.playBtn({ id: "x", shots: [] }), ""); assert.equal(GP.playBtn({ id: "x", shots: [{ url: "a.jpg" }] }), ""); assert.match(GP.playBtn(two), /onclick="gpPlay\('s-cartwheel'\)">▶ Play/);
  assert.match(GP.measurePhotosHtml({ ...two, measure: "split" }), /📷 My photos<\/h3><button class="btn sm aqua" onclick="gpPlay\('s-cartwheel'\)">▶ Play<\/button>/);
  resetDom();
  G.openFlip([{ url: "a.jpg", label: "Oct 1" }, { url: "b.jpg", label: "Nov 1" }, { url: "c.jpg", label: "Nov 5" }], "🌸 Cartwheel");
  let h = el("#glowArea").innerHTML; assert.equal((h.match(/class="glow-page/g) || []).length, 3); assert.match(h, /glow-page on" data-i="0"/); assert.match(h, /⏸ Pause/, "three photos: it plays"); assert.match(h, /glowCompare\(true\)">🪞 First vs now/); assert.equal(el("#stageTitle").textContent, "🌸 Cartwheel");
  window.glowScrub(2); h = el("#glowArea").innerHTML; assert.match(h, /▶ Play/, "scrubbing pauses"); assert.match(h, /class="glow-month">Nov 5</);
  window.glowCompare(true); h = el("#glowArea").innerHTML; assert.match(h, /First · Oct 1/); assert.match(h, /Now · Nov 5/); window.glowCompare(false); assert.match(el("#glowArea").innerHTML, /glow-book/);
  window.glowPlay(); assert.match(el("#glowArea").innerHTML, /⏸ Pause/); window.glowPlay(); assert.match(el("#glowArea").innerHTML, /▶ Play/);
  G.openFlip([{ url: "a.jpg", label: "Oct 1" }], "one"); assert.match(el("#glowArea").innerHTML, /One more photo and there's a second page/); assert.doesNotMatch(el("#glowArea").innerHTML, /First vs now/);
  el("#toast").textContent = ""; G.openFlip([], "none"); assert.match(el("#toast").textContent, /Add a photo first/);
  resetDom();
});

test("wiring: the card on Me, the nudge on Today and the pet's line are gone; the player's area stays; the move runs with the album", () => {
  const html = src("index.html");
  assert.ok(!html.includes('id="meGlow"') && !html.includes('id="glowNudge"'), "card and nudge gone"); assert.ok(html.includes('id="glowArea" style="display:none"'), "the player's area stays");
  assert.doesNotMatch(src("js/views/home.js"), /renderGlowNudge/); assert.doesNotMatch(src("js/views/me.js"), /renderGlowCard/); assert.doesNotMatch(src("js/buddy.js"), /glow/); assert.ok(!read("data/buddy.json").steps.glow, "no pet line about the flipbook");
  assert.match(src("js/app.js"), /initGlow\(\)/); assert.match(src("js/goalpage.js"), /export function renderAlbum\(\)\{ migrateFlipbook\(\);/); assert.match(src("js/goalpage.js"), /function gpPlay\(id\)/);
  assert.match(src("js/news.js"), /glow: \{ page: "skills", scroll: "#albumFold" \}/);
  assert.doesNotMatch(src("js/glow.js") + src("README.md") + src("data/news.json"), /Glow-Up/); assert.match(src("js/glow.js"), /Growing-up Flipbook/);
  assert.match(src("js/version.js"), /APP_VERSION = "1\.(66\.[2-9]|6[7-9]|[7-9]\d)/); assert.match(src("README.md"), /### Growing-up Flipbook \(every goal's photos, since 1\.66\.2\)/);
});
