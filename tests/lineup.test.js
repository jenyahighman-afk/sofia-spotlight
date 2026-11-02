// Trick progress lineup: the frames, the day a photo is from, one trick's photos oldest → newest (and the newest as the
// card's art), first vs now, the saved sheet's grid, the schema-44 migration, and the lineup under a big card in the fake
// DOM (add from learning on, pick a frame, change the day, take a photo off) plus the 📷 on started skill rows; the saved
// picture: the title stays on it, every frame draws, and the save path reads photos through media.download.
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

// A canvas that records its text. Wider than Fredoka really is (about 0.47 of the size per character on the longest names).
const CHAR = 0.52;
function fakeCanvas(){
  const calls = [];
  const ctx = new Proxy({}, {
    get(t, k){
      if (k === "measureText") return (s) => ({ width: String(s).length * parseFloat(((t.font || "").match(/([\d.]+)px/) || [])[1] || 10) * CHAR });
      if (k === "fillText") return (s, x, y) => calls.push({ s, x, y, font: t.font, w: ctx.measureText(s).width });
      return k in t ? t[k] : () => ({ addColorStop(){} });
    },
    set(t, k, v){ t[k] = v; return true; },
  });
  return { calls, cv: { getContext: () => ctx, width: 0, height: 0 } };
}

test("the saved picture's title stays on the picture: every real trick name fits, a long one splits at its · or shrinks", () => {
  const measure = (t, px) => t.length * px * CHAR, W = Lp.SHEET_W - 80;
  assert.deepEqual(Lp.titleFit("Calypso · my progress", W, measure), { px: 54, lines: ["Calypso · my progress"] }, "a short title is as before");
  const long = "Elbow cartwheel: one elbow from standing"; const T = Lp.titleFit(long + " · my progress", W, measure);
  assert.deepEqual(T.lines, [long, "my progress"], "breaks at the dot, and the dot goes"); assert.ok(T.px >= 30 && T.px < 54);
  const names = Object.values(got.skills.styles).flatMap(s => s.skills.map(k => k.n)); assert.ok(names.length > 100);
  for (const n of names) for (const title of [n, n + " · my progress"]) { const f = Lp.titleFit(title, W, measure); assert.ok(f.lines.length <= 2 && f.lines.every(l => measure(l, f.px) <= W), title); }
  const words = "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen"; const w = Lp.titleFit(words, W, measure);
  assert.equal(w.lines.length, 2, "no dot: wraps"); assert.equal(w.lines.join(" "), words, "nothing lost"); assert.ok(w.lines.every(l => measure(l, w.px) <= W));
});

test("drawSheet draws every frame; a two-line title stays inside the sheet and moves the photos down", () => {
  const name = "Elbow cartwheel: one elbow from standing";
  const items = Lp.FRAMES.map(f => ({ img: { width: 600, height: 800 }, frame: f.id, stamp: { name, date: "Wed, Oct 28", stage: "Clean" }, color: "#FF5C93" }));
  const { cv, calls } = fakeCanvas(); Lp.drawSheet(cv, items, { title: name + " · my progress", sub: "Sun, Sep 20 → Wed, Oct 28" });
  const T = Lp.titleFit(name + " · my progress", Lp.SHEET_W - 80, (t, px) => t.length * px * CHAR); const lines = calls.slice(0, 2);
  assert.deepEqual(lines.map(c => c.s), T.lines); for (const c of lines) { assert.ok(c.x - c.w / 2 >= 0 && c.x + c.w / 2 <= Lp.SHEET_W, c.s + " is on the picture"); assert.ok(c.font.includes(T.px + "px")); }
  assert.equal(cv.width, Lp.SHEET_W); assert.equal(cv.height, Lp.gridLayout(6, { top: 140 + Math.round(T.px * 1.15), bottom: 150 }).H);
  assert.ok(calls.slice(2).every(c => c.y > lines[1].y + T.px / 2), "everything else is below the title");
  const short = fakeCanvas(); Lp.drawSheet(short.cv, items.slice(0, 2), { title: "Calypso" }); assert.equal(short.cv.height, Lp.gridLayout(2, { top: 140, bottom: 90 }).H, "one line: the same room as before");
  const none = fakeCanvas(); Lp.drawSheet(none.cv, items.slice(0, 1), {}); assert.equal(none.cv.height, Lp.gridLayout(1, { top: 50, bottom: 90 }).H, "one photo: no title");
});

test("saving reads each photo through media.download (no-store, like the backup), never a crossOrigin <img>, and hands the picture to the share sheet; failures say what to do", async () => {
  const { media } = await import("../js/sync.js"); resetDom(); for (const k of Object.keys(S)) S[k] = {};
  const real = { download: media.download, create: document.createElement, Image: globalThis.Image, revoke: URL.revokeObjectURL }; const got1 = [], images = [], shared = [], revoked = [];
  media.download = async (path, url) => { got1.push([path, url]); return new Blob(["jpeg"], { type: "image/jpeg" }); };
  globalThis.Image = class { width = 600; height = 800; set src(v){ this._s = v; images.push(this); queueMicrotask(() => this.onload && this.onload()); } get src(){ return this._s; } };
  document.createElement = (t) => { if (t !== "canvas") return real.create(t); const { cv } = fakeCanvas(); cv.toBlob = (cb) => cb(new Blob(["pic"], { type: "image/jpeg" })); return cv; };
  URL.revokeObjectURL = (u) => revoked.push(u); navigator.canShare = () => true; navigator.share = async ({ title }) => { shared.push(title); };
  try {
    S.photos = { a: ph("s-calypso", "2026-09-01"), b: ph("s-calypso", "2026-10-20", { frame: "film" }) };
    const c = { id: "s-calypso", n: "Calypso", color: "#FF5C93", state: "clean" }; Lp.renderLineup(c);
    await window.lineupSave("all");
    assert.deepEqual(got1, [["p/2026-09-01", "https://x/s-calypso-2026-09-01"], ["p/2026-10-20", "https://x/s-calypso-2026-10-20"]], "each photo's own path and url");
    assert.equal(images.length, 2); assert.ok(images.every(i => i.crossOrigin === undefined && i.src === "blob:test"), "a blob: image, no crossOrigin");
    assert.equal(revoked.length, 2, "the blob: urls are let go after drawing"); assert.match(shared[0], /^sofia-s-calypso-lineup-\d{4}-\d{2}-\d{2}\.jpg$/); assert.match(el("#lfStatus").textContent, /Saved/);
    await window.lineupVs(); await window.lineupSave("vs"); assert.match(shared[1], /first-vs-now/);
    window.lineupVs(); window.lineupPick("b"); await window.lineupSave("one"); assert.match(shared[2], /-photo-/); assert.equal(images.length, 5, "2 + 2 + 1");
    media.download = async () => { throw new Error("download failed: 403"); }; const before = shared.length;
    await window.lineupSave("all"); assert.match(el("#toast").textContent, /can't read the cloud photos/); assert.equal(shared.length, before, "nothing is shared when a photo can't be read");
    navigator.onLine = false; await window.lineupSave("all"); assert.match(el("#toast").textContent, /Connect to the internet/);
  } finally {
    media.download = real.download; document.createElement = real.create; globalThis.Image = real.Image; URL.revokeObjectURL = real.revoke; navigator.onLine = true; delete navigator.canShare; delete navigator.share;
    Lp.resetLineup(); resetDom(); for (const k of Object.keys(S)) S[k] = {};
  }
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
