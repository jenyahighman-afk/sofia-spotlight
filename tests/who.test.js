// Dance with a friend (same phone): the picker's state, per-friend scores that leave Sofia's stats alone, the Moment label,
// the schema-26 migration, and the games really going through it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installEnv, resetDom, el } from "./_env.mjs";
installEnv();
const { applyData } = await import("../js/data.js");
const got = {}; for (const f of ["dances","events","classes","home-days","practice-items","phases","packs","aerial","season","styles","moves","avatar-options","oops","trio","compday","sparkle","skills","practice-pool","exercises","daily","mind"]) got[f] = JSON.parse(readFileSync(new URL("../data/" + f + ".json", import.meta.url), "utf8"));
applyData(got);
const { resetPickCache, friendBest, dancers, normalizePick, togglePick, includesSofia, friendSlots, namesLine, bestsAfter, momentSub, currentPick, setPick, pickedNames, sofiaDancing, withFriends, whoSuffix, recordFriendScore, renderWho, renderFriends, SLOTS, DEFAULT_FRIENDS, FRIEND_GAMES } = await import("../js/who.js");
const { S, setBackend, migrateDoc, SCHEMA_VERSION, FRIEND_SLOTS } = await import("../js/store.js");
const src = (f) => readFileSync(new URL("../" + f, import.meta.url), "utf8");

test("the picker: Sofia, Hannah, Lauren or all three; never nobody; names come from settings and the pick sticks on this phone", () => {
  assert.deepEqual(dancers({}).map(d => d.n), ["Sofia", "Hannah", "Lauren"]); assert.deepEqual(SLOTS, FRIEND_SLOTS); assert.deepEqual(DEFAULT_FRIENDS, { f1: "Hannah", f2: "Lauren" });
  assert.deepEqual(dancers({ avatar: { name: "Sofi" }, friends: { f1: "Hana", f2: "  " } }).map(d => d.n), ["Sofi", "Hana", "Lauren"], "a blank name falls back");
  assert.deepEqual(normalizePick([]), ["sofia"]); assert.deepEqual(normalizePick(["f2", "junk", "f2", "sofia"]), ["sofia", "f2"], "always Sofia, Hannah, Lauren order, whatever the tap order"); assert.deepEqual(normalizePick("x"), ["sofia"]);
  assert.deepEqual(togglePick(["sofia"], "f1"), ["sofia", "f1"]); assert.deepEqual(togglePick(["f1"], "sofia"), ["sofia", "f1"], "Sofia goes first even when tapped last"); assert.deepEqual(togglePick(["sofia", "f1"], "sofia"), ["f1"], "Hannah can dance alone"); assert.deepEqual(togglePick(["f1"], "f1"), ["sofia"], "untapping the last one leaves Sofia"); assert.deepEqual(togglePick(["f2"], "all"), ["sofia", "f1", "f2"]);
  assert.equal(includesSofia(["f1", "f2"]), false); assert.equal(includesSofia([]), true); assert.deepEqual(friendSlots(["sofia", "f2"]), ["f2"]); assert.deepEqual(friendSlots(["sofia"]), []);
  S.settings = {}; localStorage.clear(); assert.deepEqual(currentPick(), ["sofia"]); assert.equal(sofiaDancing(), true); assert.equal(withFriends(), false); assert.equal(whoSuffix(), "");
  setPick(["sofia", "f1"]); const saved = JSON.parse(localStorage.getItem("spotlight:who")); assert.deepEqual(saved.ids, ["sofia", "f1"]); assert.match(saved.d, /^\d{4}-\d{2}-\d{2}$/, "kept per phone with the day, not in the family space"); assert.deepEqual(pickedNames(), ["Sofia", "Hannah"]); assert.equal(whoSuffix(), " · Sofia & Hannah"); assert.equal(withFriends(), true);
  setPick(["f2"]); assert.equal(sofiaDancing(), false); assert.deepEqual(pickedNames(), ["Lauren"]); assert.equal(whoSuffix(), " · Lauren");
  setPick([]); assert.deepEqual(currentPick(), ["sofia"]);
  localStorage.setItem("spotlight:who", JSON.stringify({ ids: ["f1", "f2"], d: "2020-01-01" })); resetPickCache(); assert.deepEqual(currentPick(), ["sofia"], "yesterday's playdate pick does not carry over: the app is Sofia's again");
  localStorage.setItem("spotlight:who", JSON.stringify(["f1"])); resetPickCache(); assert.deepEqual(currentPick(), ["sofia"], "an old-shape value is ignored");
});

test("names line and the Moment label: 'Sofia, Hannah & Lauren'; the streak stays on the card and is Sofia's", () => {
  assert.equal(namesLine(["Sofia"]), "Sofia"); assert.equal(namesLine(["Sofia", "Hannah"]), "Sofia & Hannah"); assert.equal(namesLine(["Sofia", "Hannah", "Lauren"]), "Sofia, Hannah & Lauren"); assert.equal(namesLine([]), ""); assert.equal(namesLine(["", "Hannah"]), "Hannah");
  assert.equal(momentSub(["Sofia"], 5), "🔥 5-day streak", "alone: unchanged from before"); assert.equal(momentSub(["Sofia"], 0), ""); assert.equal(momentSub([], 5), "🔥 5-day streak");
  assert.equal(momentSub(["Sofia", "Hannah", "Lauren"], 5), "💃 Sofia, Hannah & Lauren  ·  🔥 5-day streak"); assert.equal(momentSub(["Hannah", "Lauren"], 0), "💃 Hannah & Lauren");
  assert.equal(momentSub(["Hannah"], 5), "💃 Hannah", "a friend alone is named, and Sofia's streak stays off her card"); assert.equal(momentSub(["Sofi"], 5, "Sofi"), "🔥 5-day streak", "Sofia's own avatar name counts as alone");
  const m = src("js/moments.js"); assert.match(m, /M\.names = pickedNames\(\)/, "the card starts with who's dancing"); assert.match(m, /mmWho\(/, "and the names can be toggled on the stage"); assert.match(m, /momentSub\(M\.names, M\.streak, dancers\(\)\[0\]\.n\)/, "with her own name, so a renamed avatar still reads as alone");
});

test("per-friend scores: only the friends in the pick, max wins, Sofia's own bests, stars and bite untouched", async () => {
  assert.deepEqual(bestsAfter({}, ["sofia", "f1"], "sparkle", 820), { f1: { sparkle: 820 } });
  assert.deepEqual(bestsAfter({ f1: { sparkle: 900, trio: 70 } }, ["f1", "f2"], "sparkle", 820.4), { f1: { sparkle: 900, trio: 70 }, f2: { sparkle: 820 } }, "a lower score keeps the best; rounded");
  assert.deepEqual(bestsAfter({ f1: { sparkle: 900 } }, ["sofia"], "sparkle", 2000), { f1: { sparkle: 900 } }, "Sofia alone changes nothing here");
  const writes = []; setBackend({ set: async (col, id, rec) => { writes.push({ col, id, rec }); }, del: async () => {} });
  try {
    S.settings = { gameBest: 500, stars: 7 }; localStorage.clear(); setPick(["sofia"]);
    assert.equal(await recordFriendScore("sparkle", 900), false); assert.equal(writes.length, 0, "nothing written when Sofia dances alone");
    setPick(["sofia", "f1", "f2"]); assert.equal(await recordFriendScore("trio", 88), true); assert.deepEqual(S.settings.friendBests, { f1: { trio: 88 }, f2: { trio: 88 } }); assert.equal(S.settings.gameBest, 500); assert.equal(S.settings.stars, 7, "Sofia's stats are not touched by the friends' save");
    setPick(["f1"]); await recordFriendScore("along", 64); assert.deepEqual(S.settings.friendBests, { f1: { trio: 88, along: 64 }, f2: { trio: 88 } }); assert.equal(S.settings._v, SCHEMA_VERSION);
    assert.equal(friendBest("trio"), 88); assert.equal(friendBest("sparkle"), 0); setPick(["sofia"]); assert.equal(friendBest("trio"), 0, "nobody's but Sofia's when she dances alone");
    assert.match(src("js/games/sparkle.js"), /G\.best=sofiaDancing\(\)\?\(S\.settings\.gameBest\|\|0\):friendBest\("sparkle"\)/, "NEW BEST! in Step & Sparkle means the friend's best when Sofia isn't dancing");
  } finally { setBackend(null); S.settings = {}; localStorage.clear(); }
  // The three games save Sofia's best and stars only when she danced, and always go through recordFriendScore.
  for (const [f, game] of [["js/games/sparkle.js", "sparkle"], ["js/games/trio.js", "trio"], ["js/games/along.js", "along"]]) { const s = src(f); assert.match(s, /sofiaDancing\(\)/, f + " gates Sofia's save"); assert.match(s, new RegExp(`recordFriendScore\\("${game}"`), f + " records the friends"); assert.ok(FRIEND_GAMES[game], game + " listed"); }
  for (const f of ["js/games/sparkle.js", "js/games/trio.js", "js/games/along.js"]) { const s = src(f); const i = s.search(/if\s*\(sofiaDancing\(\)\)\s*\{/); const j = s.indexOf("awardStars(", i); assert.ok(i >= 0 && j > i && j - i < 400, f + ": stars (and the game bite they carry) only when Sofia danced"); }
  assert.match(src("js/stars.js"), /markBite\(bite\)/, "the bite still comes from awardStars, so a friends-only game can't keep Sofia's streak");
  const pm = src("js/pmode.js"); assert.match(pm, /MODE\.guest = !sofiaDancing\(\)/, "practice mode without Sofia runs as a guest"); assert.match(pm, /if \(MODE\.guest\) toast/, "and ends with a cheer, not a save"); assert.match(pm, /\+ whoSuffix\(\)/, "the names are in the title");
});

test("schema 26: friends' names and bests are normalized when present, never invented", () => {
  const d = migrateDoc("settings", "main", { _v: 25, friends: { f1: "  Hana  ", f2: "", f3: "Nope", x: 1 }, friendBests: { f1: { sparkle: "820", trio: 0, along: "junk" }, f2: null, f9: { sparkle: 1 } } });
  assert.equal(d._v, SCHEMA_VERSION); assert.deepEqual(d.friends, { f1: "Hana" }); assert.deepEqual(d.friendBests, { f1: { sparkle: 820 } });
  assert.equal(migrateDoc("settings", "main", { _v: 25, friends: "x" }).friends && Object.keys(migrateDoc("settings", "main", { _v: 25, friends: "x" }).friends).length, 0);
  const plain = migrateDoc("settings", "main", { _v: 25, gameBest: 1200 }); assert.equal("friends" in plain, false); assert.equal("friendBests" in plain, false); assert.equal(plain.gameBest, 1200, "Sofia's existing best is left alone");
  assert.equal(migrateDoc("settings", "main", { _v: 25, friends: { f1: "x".repeat(40) } }).friends.f1.length, 20);
});

test("the picker and the friends card render; a renamed friend shows on both", () => {
  resetDom(); for (const k of Object.keys(S)) S[k] = {}; localStorage.clear(); setPick(["sofia"]);
  renderWho(); let h = el("#whoRow").innerHTML; assert.ok(h.includes("whoPick('sofia')") && h.includes("whoPick('f1')") && h.includes("whoPick('f2')") && h.includes("whoPick('all')"), "four choices"); assert.ok(h.includes("Just you today"));
  S.settings = { friends: { f1: "Hana" }, friendBests: { f1: { sparkle: 820, along: 64 } } }; setPick(["sofia", "f1"]); renderWho(); h = el("#whoRow").innerHTML; assert.ok(h.includes("Hana") && h.includes("Lauren") && h.includes("Scores save for each of you"));
  renderFriends(); const f = el("#meFriends").innerHTML; assert.ok(f.includes('value="Hana"') && f.includes('value="Lauren"') && f.includes("whoName('f1'") && f.includes("🎀 820 · 🕺 64%") && f.includes("no scores yet"), "names editable, bests listed");
  resetDom(); for (const k of Object.keys(S)) S[k] = {}; localStorage.clear(); setPick(["sofia"]);
});

test("practice mode for real: friends-only 'Try this' writes nothing to Sofia's day; Sofia's writes the drill, the bite and a star", async () => {
  resetDom(); for (const k of Object.keys(S)) S[k] = {}; localStorage.clear();
  const { openPracticeMode, closePracticeMode } = await import("../js/pmode.js"); const { tryItem } = await import("../js/drills.js");
  const post = { id: "a", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", host: "youtube", vid: "dQw4w9WgXcQ", skill: "s-calypso", note: "0:40", do: "", dont: "", ask: false, at: "2026-10-10" };
  const writes = []; setBackend({ set: async (col, id, rec) => { writes.push({ col, id, rec }); }, del: async () => {} });
  try {
    setPick(["f1"]); openPracticeMode([tryItem(post)], { title: "📎 Try this", bite: "trick", drill: "a" });
    assert.equal(el("#pmTitle").textContent, "📎 Try this · Hannah"); assert.ok(el("#pmDemo").innerHTML.includes("hqdefault.jpg"), "the post's picture is on screen");
    window.pmDone(); await new Promise(r => setTimeout(r, 50));
    assert.equal(writes.length, 0, "a guest run saves nothing"); assert.ok(el("#pmItem").innerHTML.includes("Nice dancing!") && !el("#pmActions").innerHTML.includes("openMoments"), "no 'today's trick', no Moment offer for a guest");
    closePracticeMode();
    setPick(["sofia"]); openPracticeMode([tryItem(post)], { title: "📎 Try this", bite: "trick", drill: "a" }); assert.equal(el("#pmTitle").textContent, "📎 Try this");
    window.pmDone(); await new Promise(r => setTimeout(r, 50)); closePracticeMode();
    const cols = writes.map(w => w.col); assert.ok(cols.includes("practice") && cols.includes("settings"), "Sofia's run writes her day and her stars: " + cols.join(","));
    const day = Object.values(S.practice)[0]; assert.deepEqual(day.drills, ["a"]); assert.deepEqual(day.bites, ["trick"]); assert.ok((S.settings.stars || 0) >= 1);
    assert.ok(el("#pmItem").innerHTML.includes("today's trick") && el("#pmActions").innerHTML.includes("openMoments('drill')"), "and offers the Moment");
  } finally { closePracticeMode(); setBackend(null); resetDom(); for (const k of Object.keys(S)) S[k] = {}; localStorage.clear(); }
});

test("the Who-danced chips on the Moments stage are real buttons: the name's quotes are escaped inside the onclick", async () => {
  const { whoChips } = await import("../js/moments.js");
  const h = whoChips(["Sofia", "Hannah"], ["Sofia"]);
  assert.ok(h.includes('onclick="mmWho(&quot;Hannah&quot;)"') && !h.includes('mmWho("'), "JSON's quotes would end the attribute: " + h);
  assert.ok(h.includes('class="btn sm coral" onclick="mmWho(&quot;Sofia&quot;)"') && h.includes('class="btn sm ghost" onclick="mmWho(&quot;Hannah&quot;)"'), "picked ones lit");
});
