// Dance pet: it grows with practice days (levels, moves, outfits), wears its show costume in show week, naps after a day
// off and never gets sad, the schema-32 migration, and the Today card / sheet rendering in the fake DOM.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installEnv, resetDom, el } from "./_env.mjs";
installEnv();
const read = (f) => JSON.parse(readFileSync(new URL("../" + f, import.meta.url), "utf8"));
const { applyData, DATA_FILES } = await import("../js/data.js");
const got = {}; for (const f of DATA_FILES) got[f] = read("data/" + f + ".json"); applyData(got);
const pet = got.pet;
const { petLevel, learnedMoves, nextMove, earnedOutfits, outfitFor, petMood, justLearned, petLine, furFor, petSettings, petSVG, petState, renderPet, NAME_MAX } = await import("../js/pet.js");
const { S, migrateDoc, SCHEMA_VERSION, PET_FURS } = await import("../js/store.js");
const src = (f) => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const iso = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };

test("pet content: levels, moves and outfits start at day 0 and climb; every fur the migration keeps is in the file", () => {
  for (const k of ["levels", "moves"]) { const ats = pet[k].map(x => x.at); assert.equal(ats[0], 0, k + " start at 0"); assert.deepEqual(ats, [...ats].sort((a, b) => a - b), k + " in order"); assert.equal(new Set(pet[k].map(x => x.n)).size, pet[k].length, k + " names unique"); }
  assert.ok(pet.outfits.some(o => o.show), "there is a show costume"); assert.equal(pet.outfits.find(o => !o.show).at, 0, "leg warmers from day 0");
  assert.deepEqual(pet.furs.map(f => f.id), PET_FURS, "the migration's fur list matches data/pet.json");
  for (const k of ["hello", "ready", "danced", "nap", "show"]) assert.ok(pet.lines[k].length >= 3, k + " lines"); assert.ok(pet.lines.nap.every(l => !/sad|miss|lonely|cry|disappoint/i.test(l)), "napping is never guilt");
  for (const m of pet.moves) assert.match(src("css/app.css"), new RegExp("\\.move-" + m.id + "\\b"), "a CSS dance for " + m.id);
});

test("growth: level by practice days, a new move every few days, newest outfit worn, show costume in show week", () => {
  assert.equal(petLevel(0).n, "Tiny"); assert.equal(petLevel(2).n, "Tiny"); assert.equal(petLevel(3).n, "Little"); assert.equal(petLevel(100).n, "Legend"); assert.ok(petLevel(100).scale > petLevel(0).scale, "it gets bigger");
  assert.deepEqual(learnedMoves(0).map(m => m.id), ["wiggle"]); assert.deepEqual(learnedMoves(6).map(m => m.id), ["wiggle", "hop", "sway", "spin"]);
  assert.equal(nextMove(6).id, "jump"); assert.equal(nextMove(1000), null);
  assert.equal(outfitFor(0, false).id, "warmers"); assert.equal(outfitFor(11, false).id, "tutu"); assert.equal(outfitFor(11, true).id, "show", "show week wins"); assert.deepEqual(earnedOutfits(5).map(o => o.id), ["warmers", "bow"]);
  assert.equal(justLearned(6, true).id, "spin", "the day it reaches a move"); assert.equal(justLearned(6, false), null); assert.equal(justLearned(7, true), null); assert.equal(justLearned(0, true), null, "the first wiggle isn't news");
});

test("mood: danced once today counts, ready after a practice yesterday, a cosy nap after a day off; lines fill in the move and her name", () => {
  assert.equal(petMood({ todayDone: true, yesterdayDone: false }), "danced"); assert.equal(petMood({ todayDone: false, yesterdayDone: false, days: 0 }), "hello", "a brand-new pet never meets her asleep"); assert.equal(petMood({ todayDone: false, yesterdayDone: true }), "ready"); assert.equal(petMood({ todayDone: false, yesterdayDone: false }), "nap");
  const l = petLine("danced", { date: "2026-10-18", move: "Spin", who: "Sofia" }); assert.ok(pet.lines.danced.map(x => x.replace("{move}", "Spin").replace("{who}", "Sofia")).includes(l), l); assert.ok(!/\{/.test(l));
  assert.equal(petLine("ready", { date: "2026-10-18" }), petLine("ready", { date: "2026-10-18" }), "same line all day"); assert.notEqual(petLine("ready", { date: "2026-10-18" }), petLine("ready", { date: "2026-10-19" }), "a new line tomorrow");
  assert.ok(pet.lines.show.includes(petLine("ready", { date: "2026-10-18", showWeek: true })), "show week lines"); assert.ok(pet.lines.danced.map(x => x.replace("{move}", "wiggle").replace("{who}", "Sofia")).includes(petLine("danced", { date: "2026-10-18", showWeek: true })), "after dancing in show week it still celebrates"); assert.match(petLine("hello", { date: "2026-10-18", name: "Coco" }), /^(?!.*\{)/, "no placeholders left"); assert.ok(pet.lines.nap.includes(petLine("nap", { date: "2026-10-18", showWeek: true })), "napping stays a nap in show week");
});

test("settings and schema 32: name and fur normalized when present, defaults otherwise, nothing invented", () => {
  assert.deepEqual(petSettings({}), { name: "Bun-Bun", fur: "cream" }); assert.deepEqual(petSettings({ pet: { name: "  Coco ", fur: "lilac" } }), { name: "Coco", fur: "lilac" }); assert.equal(petSettings({ pet: { fur: "plaid" } }).fur, "cream");
  assert.equal(furFor("nope").id, "cream"); assert.equal(NAME_MAX, 16);
  const d = migrateDoc("settings", "main", { _v: 31, pet: { name: "x".repeat(30), fur: "plaid", extra: 1 } }); assert.equal(d._v, SCHEMA_VERSION); assert.deepEqual(d.pet, { name: "x".repeat(16) });
  assert.deepEqual(migrateDoc("settings", "main", { _v: 31, pet: { name: "Coco", fur: "pink" } }).pet, { name: "Coco", fur: "pink" }); assert.deepEqual(migrateDoc("settings", "main", { _v: 31, pet: "junk" }).pet, {});
  assert.equal("pet" in migrateDoc("settings", "main", { _v: 31, pin: "2027" }), false);
});

test("the bunny SVG: closed eyes and z's when napping, the outfit drawn, sized by level, no CSS transform on the inner group", () => {
  const awake = petSVG({ fur: furFor("pink"), outfit: { id: "tutu" }, scale: 1.06 }), nap = petSVG({ nap: true });
  assert.ok(awake.includes("#FFD1E1") && awake.includes("#FFB3CF") && awake.includes("scale(1.06)") && !awake.includes("pet-z")); assert.ok(nap.includes("pet-z") && !nap.includes('r="3.6"'));
  assert.ok(!/style="transform/.test(awake), "Safari: scaling is an SVG transform attribute");
  assert.ok(petSVG({ outfit: { id: "show" } }).includes("#7FB3E6"), "show costume");
});

test("Today card: the pet naps after a day off, wakes up and dances when today counts, and says when it learns a move", () => {
  resetDom(); for (const k of Object.keys(S)) S[k] = {};
  S.settings = { pet: { name: "Coco", fur: "lilac" }, avatar: { name: "Sofia" } };
  renderPet(); let h = el("#petCard").innerHTML; assert.ok(h.includes("Coco") && h.includes("pet-stage hello") && !h.includes("pet-z") && h.includes("petDance()") && h.includes("openPet()"), "a brand-new pet says hello, awake"); S.practice = { [daysAgo(3)]: { bites: ["plan"] } }; renderPet(); assert.ok(el("#petCard").innerHTML.includes("pet-stage nap"), "after a day off it naps"); S.practice = {}; assert.ok(h.includes("2 more practice days to learn the Bunny hop"));
  S.practice = { [daysAgo(1)]: { bites: ["plan"] } }; renderPet(); h = el("#petCard").innerHTML; assert.ok(h.includes("pet-stage ready"), "practised yesterday: ready");
  S.practice = { [daysAgo(1)]: { bites: ["plan"] }, [daysAgo(0)]: { bites: ["memo"] } }; renderPet(); h = el("#petCard").innerHTML; assert.ok(h.includes("pet-stage danced"), "today counts: dancing"); assert.ok(h.includes("I just learned the Bunny hop! 🎉"), "day 2 is the hop");
  const st = petState(); assert.equal(st.days, 2); assert.equal(st.move.id, "hop"); assert.equal(st.level.n, "Tiny");
  assert.match(src("js/views/home.js"), /renderPet\(\)/, "Today renders the pet"); assert.match(src("sw.js"), /"\.\/js\/pet\.js"/); assert.match(src("sw.js"), /"\.\/data\/pet\.json"/);
  resetDom(); for (const k of Object.keys(S)) S[k] = {};
});
