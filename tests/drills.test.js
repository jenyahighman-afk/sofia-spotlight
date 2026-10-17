// Drill box: link parsing (YouTube incl. Shorts, Instagram, Pinterest), the schema-25 migration, the "Try this" bite,
// the teacher summary's flagged posts, and the shelf / strips rendering in the fake DOM.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installEnv, resetDom, el } from "./_env.mjs";
installEnv();
const read = (f) => JSON.parse(readFileSync(new URL("../" + f, import.meta.url), "utf8"));
const { applyData } = await import("../js/data.js");
const got = {}; for (const f of ["dances","events","classes","home-days","practice-items","phases","packs","aerial","season","styles","moves","avatar-options","oops","trio","compday","sparkle","skills","practice-pool","exercises","daily","mind"]) got[f] = read("data/" + f + ".json");
applyData(got);
const { parseLink, thumbFor, embedFor, hostInfo, skillOptions, skillName, allDrills, drillsFor, techniqueCards, askedPosts, triedDays, tryItem, drillStrip, renderDrillBox, TRY_SECS, HOSTS } = await import("../js/drills.js");
const { S, setBackend, migrateDoc, SCHEMA_VERSION, receive, DRILL_HOSTS, normalizeDrill, saveDrillsMove, COLLECTIONS } = await import("../js/store.js");
const { markDrillTried, BITES } = await import("../js/habit.js");
const { teacherSummary } = await import("../js/teacher.js");
const { stickersFor } = await import("../js/moments.js");
const src = (f) => readFileSync(new URL("../" + f, import.meta.url), "utf8");

test("YouTube links → the 11-character video id: watch, youtu.be, Shorts, embed, live, mobile, with extra params", () => {
  const id = "dQw4w9WgXcQ";
  for (const u of [`https://www.youtube.com/watch?v=${id}`, `https://youtube.com/watch?feature=share&v=${id}&t=40s`, `https://youtu.be/${id}?si=abc123`, `https://www.youtube.com/shorts/${id}`, `https://youtube.com/shorts/${id}?feature=share`, `https://m.youtube.com/watch?v=${id}`, `https://www.youtube.com/embed/${id}`, `https://www.youtube.com/live/${id}?feature=share`, `youtu.be/${id}`, `www.youtube.com/watch?v=${id}`]) {
    const p = parseLink(u); assert.ok(p, u); assert.equal(p.host, "youtube", u); assert.equal(p.vid, id, u); assert.equal(p.url, `https://www.youtube.com/watch?v=${id}`, "cleaned of tracking params: " + u);
  }
  assert.equal(thumbFor(parseLink(`https://youtu.be/${id}`)), `https://i.ytimg.com/vi/${id}/hqdefault.jpg`);
  assert.match(embedFor(parseLink(`https://www.youtube.com/shorts/${id}`)), new RegExp(`^https://www\\.youtube-nocookie\\.com/embed/${id}\\?`));
  assert.equal(parseLink("https://www.youtube.com/@somechannel"), null, "a channel is not a post"); assert.equal(parseLink("https://www.youtube.com/playlist?list=PL123"), null); assert.equal(parseLink("https://www.youtube.com/watch?v=short"), null, "not an id");
});

test("Instagram and Pinterest links are kept as cleaned post links with no thumbnail; junk is refused", () => {
  for (const u of ["https://www.instagram.com/reel/C8abcDEf1-_/?igsh=xyz&utm_source=ig", "https://instagram.com/reels/C8abcDEf1-_/", "https://www.instagram.com/some.dancer/reel/C8abcDEf1-_/"]) { const p = parseLink(u); assert.ok(p, u); assert.equal(p.host, "instagram"); assert.equal(p.url, "https://www.instagram.com/reel/C8abcDEf1-_/"); assert.equal(p.vid, ""); assert.equal(thumbFor(p), ""); assert.equal(embedFor(p), ""); }
  assert.equal(parseLink("https://www.instagram.com/p/C8abcDEf1-_/").url, "https://www.instagram.com/p/C8abcDEf1-_/");
  assert.deepEqual(parseLink("https://www.instagram.com/share/reel/BAH9CoNJZz?igsh=x"), { host: "instagram", vid: "", url: "https://www.instagram.com/share/reel/BAH9CoNJZz" }, "the app's Copy link (a share code) is kept as pasted, not rewritten into a post link"); assert.equal(parseLink("https://www.instagram.com/share/"), null); assert.equal(parseLink("https://www.instagram.com/somebody/"), null, "a profile is not a post");
  const pin = parseLink("https://www.pinterest.com/pin/1234567890/?nic_v3=abc"); assert.equal(pin.host, "pinterest"); assert.equal(pin.url, "https://www.pinterest.com/pin/1234567890/");
  assert.deepEqual(parseLink("https://pin.it/4aBcDeF?invite_code=x"), { host: "pinterest", vid: "", url: "https://pin.it/4aBcDeF" }, "a short link is kept as is, minus the query"); assert.equal(parseLink("https://pin.it/"), null); assert.equal(parseLink("https://www.pinterest.co.uk/pin/99/").host, "pinterest"); assert.equal(parseLink("https://www.pinterest.com/someone/board/"), null, "a board is not a pin");
  assert.equal(parseLink("https://example.com/how-to-calypso").host, "other"); assert.equal(parseLink("the part at 0:40"), null); assert.equal(parseLink(""), null); assert.equal(parseLink("javascript:alert(1)"), null); assert.equal(parseLink("ftp://x.y/z"), null);
  assert.ok(/Instagram app or Safari/.test(hostInfo({ host: "instagram" }).hint) && /Pinterest app or Safari/.test(hostInfo({ host: "pinterest" }).hint) && /Plays here/.test(hostInfo({ host: "youtube" }).hint), "the UI says where a post opens");
  assert.deepEqual(Object.keys(HOSTS), DRILL_HOSTS, "the hosts the migration keeps are the ones the parser produces");
});

test("skills to file a post under: every ladder skill plus every aerial item, no id collisions, names short", () => {
  const opts = skillOptions(); const ids = opts.map(o => o.id); assert.equal(new Set(ids).size, ids.length, "unique ids");
  assert.ok(ids.includes("s-calypso") && ids.includes("cartwheel-clean") && ids.includes("a-aerial"), "solo trick, aerial drill, acro skill");
  assert.equal(skillName("s-calypso"), "Calypso"); assert.equal(skillName("cartwheel-clean"), "Cartwheel"); assert.equal(skillName("nope"), "");
  assert.ok(opts.every(o => o.n.length <= 40 && o.group), "names stay short: " + opts.filter(o => o.n.length > 40).map(o => o.n).join(" | "));
});

test("schema 25: settings.drills is normalized (bad hosts → other, no link → dropped, lines trimmed); practice.drills keeps ids only", () => {
  const d = migrateDoc("settings", "main", { _v: 24, drills: { a: { url: "https://youtu.be/dQw4w9WgXcQ", host: "youtube", vid: "dQw4w9WgXcQ", skill: "s-calypso", note: "  the part at 0:40 ", ask: 1 }, b: { url: "https://www.instagram.com/reel/X/", host: "tiktok", do: "x".repeat(200) }, c: { url: "not a link" }, d: null, e: "str" } });
  assert.equal(d._v, SCHEMA_VERSION); assert.deepEqual(Object.keys(d.drills), ["a", "b"]);
  assert.deepEqual(d.drills.a, { url: "https://youtu.be/dQw4w9WgXcQ", host: "youtube", vid: "dQw4w9WgXcQ", skill: "s-calypso", note: "the part at 0:40", do: "", dont: "", ask: true, at: "" });
  assert.equal(d.drills.b.host, "other"); assert.equal(d.drills.b.do.length, 140); assert.equal(d.drills.b.ask, false);
  assert.equal("drills" in migrateDoc("settings", "main", { _v: 24, pin: "2027" }), false, "not invented"); assert.deepEqual(migrateDoc("settings", "main", { _v: 24, drills: "junk" }).drills, {});
  assert.deepEqual(migrateDoc("practice", "2026-10-13", { _v: 24, drills: ["a", 3, "", null, "b"] }).drills, ["a", "b"]); assert.equal("drills" in migrateDoc("practice", "d", { _v: 24, done: [] }), false);
  const v1 = migrateDoc("settings", "main", { pin: "2027" }); assert.equal(v1._v, SCHEMA_VERSION, "a schema-1 settings doc still climbs all the way");
});

test("the box: newest first, per skill, technique cards and flagged posts; Try this is a 2-minute trick item with the post's picture", () => {
  const drills = { a: { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", host: "youtube", vid: "dQw4w9WgXcQ", skill: "s-calypso", note: "0:40 is the thing", do: "Land soft", dont: "", ask: true, at: "2026-10-10" }, b: { url: "https://www.instagram.com/reel/C8abc/", host: "instagram", vid: "", skill: "s-calypso", note: "", do: "", dont: "Don't sickle", ask: false, at: "2026-10-12" }, c: { url: "https://pin.it/x", host: "pinterest", vid: "", skill: "cartwheel-clean", note: "", do: "", dont: "", ask: false, at: "2026-10-11" } };
  assert.deepEqual(allDrills(drills).map(p => p.id), ["b", "c", "a"]); assert.deepEqual(drillsFor("s-calypso", drills).map(p => p.id), ["b", "a"]); assert.deepEqual(drillsFor("s-donut", drills), []);
  assert.deepEqual(techniqueCards(drills).map(p => p.id), ["b", "a"]); assert.deepEqual(askedPosts(drills).map(p => p.id), ["a"]); assert.deepEqual(allDrills(undefined), []);
  assert.equal(triedDays("a", { "2026-10-11": { drills: ["a"] }, "2026-10-12": { drills: ["a", "b"] }, "2026-10-13": {} }), 2);
  const it = tryItem({ ...drills.a, id: "a" }); assert.equal(it.id, "drill:a"); assert.equal(it.secs, TRY_SECS); assert.equal(TRY_SECS, 120); assert.equal(it.kind, "trick"); assert.equal(it.text, "0:40 is the thing"); assert.deepEqual(it.demo, { kind: "photo", url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg" });
  const ig = tryItem({ ...drills.b, id: "b" }); assert.deepEqual(ig.demo, { kind: "link", url: drills.b.url }); assert.ok(ig.text.length > 10, "a default line when there is no note");
  const pm = src("js/pmode.js"); assert.match(pm, /cur\.demo \|\| demoFor\(cur\.id\)/, "practice mode shows an item's own picture"); assert.match(pm, /markDrillTried\(MODE\.drill\)/, "finishing a Try this marks the drill"); assert.match(pm, /openMoments\('drill'\)/, "and offers a Moment");
  // The summary for the teacher lists the flagged post with its skill, note and link.
  const t = teacherSummary({ drills }); assert.match(t, /is this right for her\?/); assert.match(t, /📎 Calypso: 0:40 is the thing — https:\/\/www\.youtube\.com\/watch\?v=dQw4w9WgXcQ/); assert.ok(!t.includes("instagram.com"), "only flagged posts"); assert.ok(!teacherSummary({}).includes("📎"));
  assert.equal(stickersFor({ bites: ["trick"], drillTried: true }).map(s => s.key).join(","), "drill,dance", "a drill day gets its own sticker instead of Trick Quest's");
  assert.equal(stickersFor({ bites: ["trick"] }).map(s => s.key).join(","), "trick,dance");
});

test("markDrillTried: the post goes on the day once, and the day gets the trick bite (one bite keeps the streak)", async () => {
  const writes = []; setBackend({ set: async (col, id, rec) => { writes.push({ col, id, rec }); }, del: async () => {} });
  try {
    receive("practice", { "2026-10-13": { _v: 24, done: ["warmup"], note: "", runs: [] } }, { fromCache: false });
    assert.equal(await markDrillTried("a", "2026-10-13"), true); assert.deepEqual(S.practice["2026-10-13"].drills, ["a"]); assert.deepEqual(S.practice["2026-10-13"].bites, ["trick"]); assert.deepEqual(S.practice["2026-10-13"].done, ["warmup"], "the rest of the day is kept");
    assert.equal(await markDrillTried("a", "2026-10-13"), false, "the bite is once a day"); assert.deepEqual(S.practice["2026-10-13"].drills, ["a"]); assert.equal(writes.length, 2);
    assert.equal(await markDrillTried("b", "2026-10-13"), false); assert.deepEqual(S.practice["2026-10-13"].drills, ["a", "b"], "a second post is remembered");
    assert.equal(await markDrillTried("", "2026-10-13"), false); assert.equal(await markDrillTried("z", "2026-10-14"), true, "a day with no record yet"); assert.equal(S.practice["2026-10-14"]._v, SCHEMA_VERSION);
    assert.ok(BITES.includes("trick"), "the existing bite kind, streak logic untouched");
  } finally { setBackend(null); S.practice = {}; }
});

test("the shelf renders the add form, the cards and the strips; skill pages get a strip only when something is saved", () => {
  resetDom(); for (const k of Object.keys(S)) S[k] = {};
  renderDrillBox(); assert.equal(el("#drillCount").hidden, true, "no empty pill"); let h = el("#drillForm").innerHTML + el("#drillList").innerHTML; assert.ok(h.includes('id="drillUrl"') && h.includes('id="drillSkill"') && h.includes('id="drillNote"') && h.includes("drillAdd()"), "add form"); assert.ok(h.includes("Nothing saved yet") && h.includes("openTechniqueBook()")); assert.ok(h.includes('<optgroup label="Solo tricks">') && h.includes('value="cartwheel-clean"'), "skills and aerial items to pick from");
  assert.equal(drillStrip("s-calypso"), "");
  S.drills = { a: { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", host: "youtube", vid: "dQw4w9WgXcQ", skill: "s-calypso", note: "0:40 is the thing <script>x</script>\"onmouseover=\"1", do: "Land soft", dont: "No sickle", ask: true, at: "2026-10-10" }, b: { url: "https://www.instagram.com/reel/C8abc/", host: "instagram", vid: "", skill: "cartwheel-clean", note: "", do: "", dont: "", ask: false, at: "2026-10-12" }, z: { deleted: true } };
  S.practice = { "2026-10-12": { drills: ["a"] } };
  el("#drillUrl").value = "https://youtu.be/pasted"; renderDrillBox(); h = el("#drillList").innerHTML; assert.equal(el("#drillCount").textContent, "2 saved"); assert.equal(el("#drillCount").hidden, false); assert.equal(el("#drillUrl").value, "https://youtu.be/pasted", "a re-render while a link is being pasted keeps the form"); el("#drillUrl").value = "";
  el("#drillSkill").value = "s-calypso"; renderDrillBox(); assert.equal(el("#drillSkill").value, "s-calypso", "a skill picked before the link is pasted survives a re-render too"); el("#drillSkill").value = "";
  assert.ok(h.includes("i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg") && h.includes("drill-generic") && h.includes("Instagram"), "a YouTube thumbnail and a generic card for Instagram");
  assert.ok(h.includes("drillTry('a')") && h.includes("drillOpen('b')") && h.includes("✅ Land soft") && h.includes("❌ No sickle") && h.includes("Ask Ms. Brittany") && h.includes("tried 1×"), "try, open, do/don't, teacher flag, tried count");
  assert.ok(!h.includes("<script") && h.includes("&lt;script&gt;x&lt;/script&gt;&quot;onmouseover=&quot;1"), "a note is text, never markup, in the card"); assert.ok(h.includes('aria-label="Open: 0:40 is the thing'), "thumbnail buttons have a name for VoiceOver"); assert.ok(h.indexOf("drillOpen('b')") < h.indexOf("drillOpen('a')"), "newest first");
  assert.ok(src("js/drills.js").includes("skillSelectOptions(p.skill)") && !src("js/drills.js").includes("Type a number"), "the sheet re-files a post with a real select, not a numbered prompt");
  const strip = drillStrip("s-calypso"); assert.match(strip, /📎 From the drill box:<\/b> 1 saved/); assert.ok(strip.includes("drillOpen('a')") && strip.includes("hqdefault.jpg")); assert.equal(drillStrip("s-donut"), "");
  assert.match(src("js/games/quest.js"), /drillStrip\(Q\.skill\.id\)/, "Trick Quest's prep station shows the strip"); assert.match(src("js/views/practice.js"), /aerialHow\(it\)\}\$\{drillStrip\(it\.id\)\}/, "aerial drill cards show the strip");
  assert.match(src("sw.js"), /"\.\/js\/drills\.js"/, "cached by the service worker");
  const css = src("css/app.css"); const z = (sel) => +(new RegExp(sel.replace(".", "\\.") + "\\{[^}]*z-index:(\\d+)").exec(css) || [])[1]; assert.ok(z(".modal") > z(".stage") && z(".modal") < z(".gate"), "the post sheet opens above Trick Quest's stage: modal " + z(".modal") + " vs stage " + z(".stage"));
  assert.match(src("js/moments.js"), /mmSticker\(\$\{esc\(JSON\.stringify/, "sticker buttons: the quotes are escaped inside the onclick attribute");
  resetDom(); for (const k of Object.keys(S)) S[k] = {};
});

test("schema 27: a post is its own document; one without a link is emptied; settings-held posts move once, then leave settings", async () => {
  assert.ok(COLLECTIONS.includes("drills")); assert.match(readFileSync(new URL("../firestore.rules", import.meta.url), "utf8"), /'goals', 'drills'(, '\w+')*\]/, "the rules know the collection (republish them)");
  const d = migrateDoc("drills", "a", { _v: 26, url: "https://youtu.be/dQw4w9WgXcQ", host: "youtube", vid: "dQw4w9WgXcQ", skill: "s-calypso", note: "  0:40 ", ask: 1 }); assert.equal(d._v, SCHEMA_VERSION); assert.equal(d.note, "0:40"); assert.equal(d.ask, true); assert.equal(d.host, "youtube");
  const bad = migrateDoc("drills", "b", { _v: 26, url: "nope", note: "x" }); assert.equal(bad.deleted, true); assert.equal("url" in bad, false); assert.deepEqual(allDrills({ a: d, b: bad }).map(p => p.id), ["a"], "an emptied document never shows");
  assert.equal(normalizeDrill(null), null); assert.equal(normalizeDrill({ url: "https://x.y/z", host: "tiktok" }).host, "other");
  assert.equal(migrateDoc("settings", "main", { _v: 26, drills: { a: { url: "https://x.y/" } } }).drills.a.url, "https://x.y/", "an old settings-held post still normalizes so the move can read it");
  const writes = []; setBackend({ set: async (col, id, rec) => { writes.push({ col, id, rec }); }, del: async () => {} });
  try {
    for (const k of Object.keys(S)) S[k] = {};
    receive("settings", { main: { _v: 26, pin: "2027", drills: { a: { url: "https://youtu.be/dQw4w9WgXcQ", host: "youtube", vid: "dQw4w9WgXcQ", skill: "s-calypso", note: "0:40", ask: true }, junk: { url: "nope" } } } }, { fromCache: true });
    assert.equal(await saveDrillsMove(), 0, "nothing moves until the server has confirmed both collections"); assert.equal(writes.length, 0);
    receive("settings", { main: { _v: 26, pin: "2027", drills: { a: { url: "https://youtu.be/dQw4w9WgXcQ", host: "youtube", vid: "dQw4w9WgXcQ", skill: "s-calypso", note: "0:40", ask: true }, junk: { url: "nope" } } } }, { fromCache: false });
    receive("drills", {}, { fromCache: false });
    assert.equal(await saveDrillsMove(), 1); assert.equal(S.drills.a.note, "0:40"); assert.equal(S.drills.a._v, SCHEMA_VERSION); assert.equal("drills" in S.settings, false, "the field leaves settings"); assert.equal(S.settings.pin, "2027", "the rest of settings is kept");
    assert.deepEqual(writes.map(w => w.col + "/" + w.id), ["drills/a", "settings/main"]); assert.equal(writes[1].rec.drills, undefined);
    assert.equal(await saveDrillsMove(), 0, "only once"); assert.equal(writes.length, 2);
    receive("settings", { main: { _v: 26, drills: { a: { url: "https://youtu.be/dQw4w9WgXcQ", host: "youtube" } } } }, { fromCache: false }); receive("drills", { a: { _v: 27, url: "https://youtu.be/dQw4w9WgXcQ", host: "youtube", note: "already here" } }, { fromCache: false });
    assert.equal(await saveDrillsMove(), 0, "a post the other phone already moved is not written again"); assert.equal(S.drills.a.note, "already here"); assert.equal(writes.length, 3, "but the field still leaves settings"); assert.equal(writes[2].col, "settings");
  } finally { setBackend(null); for (const k of Object.keys(S)) S[k] = {}; }
});
