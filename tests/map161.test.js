// 1.61.0 (Jenya, Nov 5; step 2 of the reorganization): the map. Four tabs — Today · Dances · Skills · Me; Practice opens
// from Today and Play from Me; one Skills page holds every skill; a folded 🎀 Events card on Today shows the season without
// the PIN (never a cost, a charge date, a hotel or a note).
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
const NAV = await import("../js/nav.js");
const KE = await import("../js/kidevents.js");
const ME = await import("../js/views/me.js");
const { GROWNUP_PAGES } = await import("../js/grownups.js");
const html = src("index.html");
const section = (id) => html.slice(html.indexOf(`id="p-${id}"`), html.indexOf("</section>", html.indexOf(`id="p-${id}"`)));
const clearS = () => { for (const k of Object.keys(S)) S[k] = {}; };

test("four tabs: Today · Dances · Skills · Me; Practice lights Today, Play and the Grown-ups pages light Me", () => {
  assert.deepEqual([...html.matchAll(/<button data-p="([a-z]+)"/g)].map(m => m[1]), ["home", "dances", "skills", "me"]); assert.deepEqual(NAV.TABS, ["home", "dances", "skills", "me"]);
  for (const t of NAV.TABS) assert.equal(NAV.tabFor(t), t);
  assert.equal(NAV.tabFor("practice"), "home"); assert.equal(NAV.tabFor("coach"), "home"); assert.equal(NAV.tabFor("play"), "me");
  for (const p of [...GROWNUP_PAGES, "pin"]) assert.equal(NAV.tabFor(p), "me", p);
  assert.match(section("practice"), /showPage\('home'\)">‹ Today<\/button>/, "Practice says the way back"); assert.match(section("play"), /showPage\('me'\)">‹ Me<\/button>/, "so does Play");
  assert.match(section("me"), /id="mePlay" onclick="showPage\('play'\)"/, "one Play tile on Me"); assert.match(section("me"), /<b>Play<\/b>/);
  assert.equal((html.match(/showPage\('play'\)/g) || []).length, 1, "and nowhere else in the page's markup");
  for (const p of ["practice", "play"]) assert.ok(!GROWNUP_PAGES.includes(p), p + " needs no PIN");
});

test("one Skills page: her goals, her album, the skill lists, the drill box, the safety rules; the aerial's checklist on its own page (1.66.0)", () => {
  const sk = section("skills");
  for (const id of ["skillsTitle", "workingCard", "albumCard", "skillRings", "skillList", "cardsArea", "drillBox", "drillForm", "drillList", "drillCount"]) { assert.ok(sk.includes(`id="${id}"`), id + " is on Skills"); assert.equal((html.match(new RegExp(`id="${id}"`, "g")) || []).length, 1, id + " exists once"); }
  for (const id of ["aerialList", "aerialPct", "aerialFold", "gpTitle", "gpNext", "gpPhotos", "gpCoach", "gpFoot"]) { assert.ok(section("goal").includes(`id="${id}"`), id + " is on a goal's page"); assert.equal((html.match(new RegExp(`id="${id}"`, "g")) || []).length, 1, id + " exists once"); }
  assert.doesNotMatch(html, /id="meCards"|id="goalRings"|id="cardsFold"|id="goalsFold"/, "the trick cards fold and the Goals tiles left the page"); assert.equal(NAV.tabFor("goal"), "skills");
  assert.match(sk, /🛟 Safety rules/); assert.doesNotMatch(section("me"), /id="skillRings"|id="goalRings"|id="meCards"/); assert.doesNotMatch(section("practice"), /aerialList|drillBox|Safety rules/);
  assert.match(section("practice"), /🗺️ The 15-week plan/, "the plan stays on Practice");
  // her own name for the page
  assert.equal(ME.skillsName({}), "Skills"); assert.equal(ME.skillsName({ skillsName: "  My   tricks " }), "My tricks"); assert.equal(ME.skillsName({ skillsName: "A very long name for a tab" }).length, 12); assert.equal(ME.skillsName({ skillsName: "   " }), "Skills");
  resetDom(); clearS(); S.settings = { skillsName: "Tricks" }; ME.renderMe(); assert.equal(el("#skillsTitle").textContent, "Tricks"); assert.equal(el("#tabSkills").textContent, "Tricks"); assert.ok(el("#skillRings").innerHTML.length > 0, "Me's module still draws the rings");
  resetDom(); clearS();
});

test("🎀 Events on Today: the season without the PIN; never a cost, a charge date, a hotel or a note", () => {
  const ev = [
    { id: "a", name: "Winter Showcase", start: "2027-01-08", end: "2027-01-10", type: "Showcase", dances: "Solo, trio, PITCH", venue: "The big theater", times: "Call 8:00", fun: "Pajama day", cost: "$123 SECRET", charge: "Dec 1 SECRET", hotel: "Hotel SECRET", notes: "note SECRET", link: "https://secret.example", pack: "comp" },
    { id: "b", name: "Spring break (school)", start: "2027-04-12", end: "2027-04-18", type: "School break" },
    { id: "c", name: "Old comp", start: "2026-10-01", end: "2026-10-02", type: "Competition" },
    { id: "d", name: "Gone", start: "2027-02-01", end: "2027-02-01", deleted: true },
  ];
  const { next, done } = KE.kidEvents(ev, "2026-11-05"); assert.deepEqual(next.map(e => e.id), ["a"]); assert.deepEqual(done.map(e => e.id), ["c"], "a school break is not an event for her");
  const h = KE.kidEventsHtml(ev, "2026-11-05", { comp: { name: "Comp", items: ["Shoes"] } });
  assert.match(h, /<b>Winter Showcase<\/b>/); assert.match(h, /64 days/); assert.match(h, /💃 Which dances/); assert.match(h, /📍 Where/); assert.match(h, /⏰ When to be there/); assert.match(h, /✨ Fun to know/); assert.match(h, /openKidPack\('comp'\)/); assert.match(h, /Done: ✓ Old comp/);
  assert.doesNotMatch(h, /SECRET|secret\.example|Spring break|Gone/, "costs, charge dates, hotels, notes and links stay behind the PIN");
  assert.deepEqual(KE.KID_FIELDS.map(f => f[0]), ["dances", "venue", "times", "fun"]);
  assert.match(KE.kidEventRow({ name: "X", start: "2026-11-05", end: "2026-11-05" }, "2026-11-05", {}), /chip sun">now</); assert.match(KE.kidEventRow({ name: "X", start: "2026-11-06" }, "2026-11-05", {}), />1 day</);
  assert.equal(KE.kidEventsHtml([], "2026-11-05"), `<p class="small muted">No events yet.</p>`);
  // on the page: folded, on Today, drawn from the app's events
  assert.match(section("home"), /<details class="card sun events-fold" id="eventsFold"><summary>/); assert.doesNotMatch(section("home"), /events-fold" id="eventsFold" open/);
  resetDom(); clearS(); KE.renderKidEvents(); const k = el("#kidEvents").innerHTML; assert.match(k, /Winter Showcase/); assert.doesNotMatch(k, /School break|Auto-charge|Hotel &amp; room block/);
  assert.ok(GROWNUP_PAGES.includes("events") && GROWNUP_PAGES.includes("lists"), "editing events and lists still needs the PIN");
  assert.match(src("sw.js"), /"\.\/js\/kidevents\.js"/); assert.match(src("js/app.js"), /guard\("home", renderKidEvents, "kidevents"\)/);
  resetDom(); clearS();
});

test("the release: the version and the README", () => {
  assert.match(src("js/version.js"), /APP_VERSION = "1\.(6[1-9]|[7-9]\d)\./);
  assert.match(src("README.md"), /### The map \(1\.61\.0\)/);
});
