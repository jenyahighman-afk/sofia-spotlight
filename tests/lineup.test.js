// Trick progress lineup: the frames, the day a photo is from, one trick's photos oldest → newest (and the newest as the
// card's art), first vs now, the saved sheet's grid, the schema-44 migration, and the lineup under a big card in the fake
// DOM (add from learning on, pick a frame, change the day, take a photo off) plus the 📷 on started skill rows.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installEnv, resetDom, el } from "./_env.mjs";
installEnv();
const read = (f) => JSON.parse(readFileSync(new URL("../" + f, import.meta.url), "utf8"));
const src = (f) => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const { applyData, DATA_FILES } = await import("../js/data.js");
const got = {}; for (const f of DATA_FILES) got[f] = read("data/" + f + ".json"); applyData(got);
const Lp = await import("../js/lineup.js");
const { cardPhotos, initCards } = await import("../js/cards.js");
const { S, migrateDoc, SCHEMA_VERSION, FRAME_IDS, MIGRATIONS, setBackend } = await import("../js/store.js");
const { fmt } = await import("../js/util.js");

const ph = (card, taken, extra = {}) => ({ url: "https://x/" + card + "-" + taken, path: "p/" + taken, card, taken, at: taken + "T12:00:00.000Z", ...extra });

test("frames: six, ids match the migration's frozen list, each with a name and an emoji; the default is the polaroid", () => {
  assert.deepEqual(Lp.FRAMES.map(f => f.id), FRAME_IDS); assert.equal(Lp.FRAMES.length, 6);
  for (const f of Lp.FRAMES) { assert.match(f.id, /^[a-z]+$/); assert.ok(f.n && f.ic, f.id); }
  assert.equal(Lp.DEFAULT_FRAME, "polaroid"); assert.equal(Lp.frameOf("film").n, "Film strip"); assert.equal(Lp.frameOf("nope").id, "polaroid"); assert.ok(Lp.isFrame("star") && !Lp.isFrame("gold"));
  assert.equal(Lp.stageLabel("checked"), "Teacher-checked"); assert.equal(Lp.stageLabel("clean"), "Clean"); assert.equal(Lp.stageLabel("learning"), "Learning"); assert.equal(Lp.stageLabel("notyet"), "");
});

test("the day a photo is from: taken, else the day of its upload, else nothing", () => {
  assert.equal(Lp.photoDate({ taken: "2026-10-03", at: "2026-10-05T01:00:00Z" }), "2026-10-03");
  assert.equal(Lp.photoDate({ at: "2026-10-05T01:00:00Z" }), "2026-10-05"); assert.equal(Lp.photoDate({ taken: "Oct 3", at: "junk" }), ""); assert.equal(Lp.photoDate(null), "");
});

test("lineup: one trick's photos oldest → newest; other cards, videos, deleted and url-less photos are out; frame and stage are normalized; the newest is the card's art", () => {
  const photos = {
    c: ph("s-calypso", "2026-10-20", { frame: "star", stage: "clean" }), a: ph("s-calypso", "2026-09-01", { frame: "nope", stage: "learning" }), b: ph("s-calypso", "2026-10-05", { stage: "weird" }),
    o: ph("b-plie", "2026-10-01"), v: ph("s-calypso", "2026-10-25", { kind: "video" }), d: ph("s-calypso", "2026-10-26", { deleted: true }), n: ph("s-calypso", "2026-10-27", { url: "" }), bad: ph("Bad Id", "2026-10-01"),
    old: { url: "https://x/old", card: "s-calypso", at: "2026-08-15T22:00:00.000Z" },
  };
  const list = Lp.lineup("s-calypso", photos);
  assert.deepEqual(list.map(p => p.id), ["old", "a", "b", "c"]); assert.deepEqual(list.map(p => p.date), ["2026-08-15", "2026-09-01", "2026-10-05", "2026-10-20"], "an older card photo falls back to its upload day");
  assert.deepEqual(list.map(p => p.frame), ["polaroid", "polaroid", "polaroid", "star"]); assert.deepEqual(list.map(p => p.stage), ["", "learning", "", "clean"]);
  assert.deepEqual(Lp.lineup("b-plie", photos).map(p => p.id), ["o"]); assert.deepEqual(Lp.lineup("j-iso", photos), []); assert.deepEqual(Lp.lineup("s-calypso", {}), []);
  const art = cardPhotos(photos); assert.deepEqual(Object.keys(art).sort(), ["b-plie", "s-calypso"]); assert.equal(art["s-calypso"].id, "c", "the newest by day is the card's art");
  // the same day: the earlier upload stays first, whatever was written back later (a frame change re-stamps _at)
  const same = { p: { ...ph("s-calypso", "2026-10-20"), at: "2026-10-20T10:00:00.000Z", _at: 9 }, q: { ...ph("s-calypso", "2026-10-20"), at: "2026-10-20T11:00:00.000Z", _at: 1 } };
  assert.deepEqual(Lp.lineup("s-calypso", same).map(p => p.id), ["p", "q"]); assert.equal(cardPhotos(same)["s-calypso"].id, "q");
  assert.deepEqual(Lp.lineupCounts(photos), { "s-calypso": 4, "b-plie": 1 });
  const fn = Lp.firstVsNow(list); assert.equal(fn.first.id, "old"); assert.equal(fn.now.id, "c"); assert.equal(fn.days, 66); assert.equal(Lp.firstVsNow(list.slice(0, 1)), null);
  const s = Lp.stampFor(list[3], "Calypso"); assert.equal(s.name, "Calypso"); assert.equal(s.date, fmt("2026-10-20")); assert.equal(s.stage, "Clean");
  assert.deepEqual(Lp.stampFor(list[0], ""), { name: "", date: fmt("2026-08-15"), stage: "" });
});

test("the saved sheet's grid: one across for one photo, two up to four, three after; every cell inside the sheet", () => {
  for (const [n, cols, rows] of [[1, 1, 1], [2, 2, 1], [3, 2, 2], [4, 2, 2], [5, 3, 2], [6, 3, 2], [7, 3, 3]]) {
    const L = Lp.gridLayout(n); assert.equal(L.cols, cols, n + " cols"); assert.equal(L.rows, rows, n + " rows"); assert.equal(L.cells.length, n); assert.equal(L.W, Lp.SHEET_W);
    for (const c of L.cells) { assert.ok(c.x >= 0 && c.x + c.w <= L.W && c.y >= 0 && c.y + c.h <= L.H, n + ": cell inside the sheet"); assert.ok(c.h > c.w, "a cell is taller than wide (photo + stamp)"); }
  }
  const one = Lp.gridLayout(1), titled = Lp.gridLayout(1, { top: 140 }); assert.equal(titled.H - one.H, 90, "a title adds room at the top");
  assert.equal(typeof Lp.drawFramed, "function"); assert.equal(typeof Lp.drawSheet, "function");
});

test("schema 44: photos.frame kept only as a known frame, photos.taken only as a day, photos.stage only as learning / clean / checked; nothing invented", () => {
  assert.ok(SCHEMA_VERSION >= 44); assert.equal(typeof MIGRATIONS[44], "function");
  const ok = migrateDoc("photos", "p", { _v: 43, url: "u", card: "s-calypso", frame: "film", taken: "2026-10-20", stage: "clean" });
  assert.equal(ok._v, SCHEMA_VERSION); assert.equal(ok.frame, "film"); assert.equal(ok.taken, "2026-10-20"); assert.equal(ok.stage, "clean"); assert.equal(ok.card, "s-calypso");
  for (const bad of ["gold", "", 3, null, ["film"], { id: "film" }]) assert.equal("frame" in migrateDoc("photos", "p", { _v: 43, url: "u", frame: bad }), false, "frame " + JSON.stringify(bad));
  for (const bad of ["2026-10", "Oct 20", 20261020, "", null, "2026-10-20T10:00:00Z"]) assert.equal("taken" in migrateDoc("photos", "p", { _v: 43, url: "u", taken: bad }), false, "taken " + JSON.stringify(bad));
  for (const bad of ["notyet", "Clean", "", 1, null, ["clean"]]) assert.equal("stage" in migrateDoc("photos", "p", { _v: 43, url: "u", stage: bad }), false, "stage " + JSON.stringify(bad));
  const plain = migrateDoc("photos", "p", { _v: 43, url: "u", card: "s-calypso" }); assert.ok(!("frame" in plain) && !("taken" in plain) && !("stage" in plain), "an older card photo gets nothing invented");
  assert.equal(migrateDoc("settings", "main", { _v: 43, frame: "gold" }).frame, "gold", "other collections untouched");
  assert.ok(Lp.FRAMES.every(f => migrateDoc("photos", "p", { _v: 43, url: "u", frame: f.id }).frame === f.id), "every frame survives");
});

test("the lineup under a big card: add from learning on, every photo framed and stamped, first vs now, the editor picks a frame and a day, take off keeps the photo; the Me rows get a 📷", async () => {
  resetDom(); for (const k of Object.keys(S)) S[k] = {};
  const writes = []; setBackend({ set: async (col, id, rec) => { writes.push({ col, id, rec }); }, del: async () => {} });
  try {
    S.skills = { "s-calypso": { id: "s-calypso", state: "clean", at: "2026-10-20" }, "j-iso": { id: "j-iso", state: "learning", at: "2026-10-01" } };
    S.photos = { a: ph("s-calypso", "2026-09-01", { stage: "learning" }), b: ph("s-calypso", "2026-10-20", { frame: "film", stage: "clean" }) };
    initCards(); await window.openCards("s-calypso"); let h = el("#tcLineup").innerHTML;
    assert.ok(h.includes("lineupAdd('s-calypso', this)") && h.includes("Add a photo"), "the add button");
    assert.equal((h.match(/class="lf lf-/g) || []).length, 2, "both photos framed"); assert.ok(h.indexOf("lf-polaroid") < h.indexOf("lf-film"), "oldest first, each in its own frame");
    assert.ok(h.includes("Calypso") && h.includes(fmt("2026-09-01")) && h.includes("Learning") && h.includes(fmt("2026-10-20")) && h.includes("Clean"), "stamps: name, day, what it was then");
    assert.ok(h.includes("lineupVs()") && h.includes("lineupSave('all')"), "first vs now and save the lineup");
    assert.ok(el("#cardsArea").innerHTML.includes("https://x/s-calypso-2026-10-20"), "the newest photo is the card's art");
    window.lineupVs(); h = el("#tcLineup").innerHTML; assert.ok(h.includes("lf-vs") && h.includes("49 days of practice") && h.includes("lineupSave('vs')") && h.includes(">First<") && h.includes(">Now<"), "first vs now"); window.lineupVs();
    window.lineupPick("a"); h = el("#tcLineup").innerHTML; assert.ok(h.includes("lf-edit") && h.includes("lineupFrame(&quot;a&quot;, 'star')") && h.includes('type="date"') && h.includes('value="2026-09-01"') && h.includes("lineupOff(&quot;a&quot;)") && h.includes("lineupSave('one')"), "the editor");
    for (const f of Lp.FRAMES) assert.ok(h.includes(`'${f.id}')`), "a chip for " + f.id);
    await window.lineupFrame("a", "sparkle"); assert.equal(S.photos.a.frame, "sparkle"); assert.equal(writes.at(-1).rec.frame, "sparkle"); assert.ok(el("#tcLineup").innerHTML.includes("lf-sparkle"));
    await window.lineupFrame("a", "nope"); assert.equal(S.photos.a.frame, "sparkle", "an unknown frame is ignored");
    await window.lineupDate("a", "2026-08-20"); assert.equal(S.photos.a.taken, "2026-08-20"); await window.lineupDate("a", "Aug 20"); assert.equal(S.photos.a.taken, "2026-08-20", "a bad day is ignored");
    window.confirm = () => false; await window.lineupOff("a"); assert.equal(S.photos.a.card, "s-calypso", "not without a yes");
    window.confirm = () => true; await window.lineupOff("a"); assert.ok(S.photos.a && S.photos.a.url && !("card" in S.photos.a) && !("frame" in S.photos.a) && !("taken" in S.photos.a) && !("stage" in S.photos.a), "off the lineup, still in Photos");
    assert.equal((el("#tcLineup").innerHTML.match(/class="lf lf-/g) || []).length, 1); assert.ok(!el("#tcLineup").innerHTML.includes("lineupVs()"), "one photo: no first vs now");
    window.cardOpen("j-iso"); h = el("#tcLineup").innerHTML; assert.ok(h.includes("lineupAdd('j-iso', this)") && h.includes("Snap one now"), "a learning trick can start its lineup");
    window.cardOpen("b-plie"); assert.ok(!el("#tcLineup").innerHTML.includes("lineupAdd("), "a trick she hasn't started has no add button");
    assert.ok(writes.every(w => w.col === "photos"), "only photo writes");
  } finally { setBackend(null); resetDom(); for (const k of Object.keys(S)) S[k] = {}; }
  const me = src("js/views/me.js"); assert.match(me, /skill-cam/); assert.match(me, /openCards\('\$\{sk\.id\}'\)/); assert.match(me, /lineupCounts/);
  assert.match(src("sw.js"), /"\.\/js\/lineup\.js"/); assert.match(src("css/app.css"), /\.lf-strip\{/); for (const f of Lp.FRAMES) assert.match(src("css/app.css"), new RegExp("\\.lf-" + f.id + "\\b"), "css for " + f.id);
  assert.match(src("README.md"), /Schema 44/); assert.match(src("README.md"), /Progress lineup/);
});
