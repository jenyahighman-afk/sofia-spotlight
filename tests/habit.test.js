// The daily habit: three rotating choice cards, tired-day options that count, one bite keeps the streak, two free skips a week.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installEnv } from "./_env.mjs";
installEnv();
const { cardsFor, trickOfDay, moveOfDay, gameOfDay, TIRED, BITES, markBite, GAME_ROTATION } = await import("../js/habit.js");
const { S, setBackend, migrateDoc, SCHEMA_VERSION, receive } = await import("../js/store.js");
const { applyData } = await import("../js/data.js");
const read = (f) => JSON.parse(readFileSync(new URL("../" + f, import.meta.url), "utf8"));
const got = {}; for (const f of ["dances","events","classes","home-days","practice-items","phases","packs","aerial","season","styles","moves","avatar-options","oops","trio","compday","sparkle","skills","practice-pool","exercises","daily","mind"]) got[f] = read("data/" + f + ".json");
applyData(got);
const exercises = got.exercises, skills = got.skills;
const src = (f) => readFileSync(new URL("../" + f, import.meta.url), "utf8");

test("three cards a day, rotating by date, with onclicks that name functions the app really exposes", () => {
  const a = cardsFor("2026-10-13"), b = cardsFor("2026-10-14");
  assert.deepEqual(a.map(c => c.id), ["trick", "game", "move"]); assert.ok(a.every(c => c.title && c.sub && c.go && !c.done));
  assert.notEqual(a[1].sub, b[1].sub, "the game changes day to day"); assert.notEqual(a[2].sub, b[2].sub, "the move changes day to day");
  assert.ok(a.every(c => c.sub.length <= 40), "card lines stay short: " + a.map(c => c.sub).join(" | "));
  const quest = src("js/games/quest.js"), play = src("js/views/play.js"), home = src("js/views/home.js");
  assert.match(quest, /expose\(\{[^}]*qsStart[^}]*qsPick/); assert.match(play, /expose\(\{ playOpen \}\)/); assert.match(home, /expose\(\{[^}]*habitMove[^}]*habitTired/);
  assert.match(a[0].go, /qsStart\(\);qsPick\('s-[a-z-]+'\)/); assert.match(a[1].go, /playOpen\('(sparkle|nextmove|oops|compday|trio|mirror)'\)/); assert.equal(a[2].go, "habitMove()");
  for (const [id] of GAME_ROTATION) assert.ok(play.includes(`id: "${id}"`), id + " is a real game");
});

test("the trick of the day skips tricks already clean, and falls back to all of them once every trick is clean", () => {
  const solo = skills.styles.solo.skills; const ids = new Set(solo.map(s => s.id));
  const t = trickOfDay("2026-10-13", {}); assert.ok(ids.has(t.id));
  const allButOne = Object.fromEntries(solo.slice(1).map(s => [s.id, { state: "clean" }]));
  for (const d of ["2026-10-13", "2026-10-14", "2026-10-20"]) assert.equal(trickOfDay(d, allButOne).id, solo[0].id, "only the open one is offered");
  const allClean = Object.fromEntries(solo.map(s => [s.id, { state: "checked" }])); assert.ok(ids.has(trickOfDay("2026-10-13", allClean).id));
  assert.equal(trickOfDay("2026-10-13", {}, { styles: {} }), null);
  const m = moveOfDay("2026-10-13"); assert.ok(m && m.id && m.secs > 0 && exercises[m.pose], "the move has an animated pose");
  assert.ok(GAME_ROTATION.some(g => g[0] === gameOfDay("2026-10-13")[0]));
});

test("tired-day options are short, lying down, with real poses; done cards show as done", () => {
  for (const k of ["stretch", "picture"]) { const t = TIRED[k]; assert.ok(t.title); const secs = t.items.reduce((a, i) => a + i.secs, 0); assert.ok(secs >= 60 && secs <= 150, k + " lasts " + secs + "s"); for (const it of t.items) assert.ok(exercises[it.pose], it.id + " pose " + it.pose); }
  const c = cardsFor("2026-10-13", { bites: ["game", "tired"] }); assert.deepEqual(c.map(x => x.done), [false, true, false]);
  assert.deepEqual(BITES, ["trick", "game", "move", "tired", "memo", "plan", "dare"]);
});

test("markBite adds a bite to today's record once; schema 22 keeps only known bites and tired kinds", async () => {
  const writes = []; setBackend({ set: async (col, id, rec) => { writes.push({ col, id, rec }); }, del: async () => {} });
  try {
    receive("practice", { "2026-10-13": { _v: 22, done: ["warmup"], note: "", runs: [] } }, { fromCache: false });
    assert.equal(await markBite("game", "2026-10-13"), true); assert.deepEqual(S.practice["2026-10-13"].bites, ["game"]); assert.deepEqual(S.practice["2026-10-13"].done, ["warmup"], "the rest of the day is kept");
    assert.equal(await markBite("game", "2026-10-13"), false, "once"); assert.equal(await markBite("junk", "2026-10-13"), false); assert.equal(writes.length, 1);
    assert.equal(await markBite("tired", "2026-10-14"), true, "a day with no record yet"); assert.deepEqual(S.practice["2026-10-14"].bites, ["tired"]);
  } finally { setBackend(null); }
  const p = migrateDoc("practice", "d", { _v: 21, bites: ["game", "nope", 3, "trick"], tired: "nap" }); assert.deepEqual(p.bites, ["game", "trick"]); assert.equal("tired" in p, false); assert.equal(p._v, SCHEMA_VERSION);
  assert.equal(migrateDoc("practice", "d", { _v: 21, tired: "stretch" }).tired, "stretch"); assert.equal("bites" in migrateDoc("practice", "d", { _v: 21, done: [] }), false);
});
