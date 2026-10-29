// Dance Dares: one dare a day picked from the date, one reroll a day, "I did it" saved once with its bite and one star,
// the schema-34 migration, the Today card in the fake DOM, and content safety.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installEnv, resetDom, el } from "./_env.mjs";
installEnv();
const read = (f) => JSON.parse(readFileSync(new URL("../" + f, import.meta.url), "utf8"));
const src = (f) => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const { applyData, DATA_FILES } = await import("../js/data.js");
const got = {}; for (const f of DATA_FILES) got[f] = read("data/" + f + ".json"); applyData(got);
const pool = got.dares;
const { dareFor, shownDare, dareState, donePatch, rerollPatch, doneCount, renderDares } = await import("../js/dares.js");
const { S, migrateDoc, SCHEMA_VERSION, BITE_IDS, setBackend } = await import("../js/store.js");
const todayIso = () => { const t = new Date(); return t.getFullYear() + "-" + String(t.getMonth() + 1).padStart(2, "0") + "-" + String(t.getDate()).padStart(2, "0"); };

test("content: at least 40 short dares with an id, emoji and kind, and nothing risky", () => {
  const ds = pool.dares; assert.ok(ds.length >= 40, "pool size " + ds.length);
  assert.equal(new Set(ds.map(d => d.id)).size, ds.length, "unique ids");
  for (const d of ds) {
    assert.match(d.id, /^[a-z0-9-]+$/, d.id); assert.ok(d.e && typeof d.e === "string", d.id); assert.ok(["silly", "tricky", "freeze", "style"].includes(d.kind), d.id);
    assert.ok(typeof d.text === "string" && d.text.length > 10 && d.text.length < 90, d.text);
    assert.ok(!/eyes closed|close your eyes|blindfold|flip|cartwheel|handstand|headstand|aerial|somersault|roll over|stairs|steps up|\bmat\b|spotter|bed|sofa|couch|chair|table|trampoline|on (the )?furniture/i.test(d.text), "no risky dares: " + d.text);
  }
  for (const k of ["silly", "tricky", "freeze", "style"]) assert.ok(ds.filter(d => d.kind === k).length >= 5, "enough " + k);
});

test("same dare all day, a new one tomorrow, no repeat for a whole pool's worth of days", () => {
  const a = dareFor("2026-10-17"), b = dareFor("2026-10-17"); assert.ok(a); assert.equal(a, b, "deterministic from the date");
  assert.notEqual(dareFor("2026-10-18").id, a.id, "tomorrow is different");
  const seen = new Set(); const n = pool.dares.length; const t0 = Date.UTC(2026, 9, 17);
  for (let i = 0; i < n; i++) { const d = new Date(t0 + i * 86400000).toISOString().slice(0, 10); seen.add(dareFor(d).id); }
  assert.equal(seen.size, n, "every dare once before any comes back");
  assert.equal(dareFor("junk"), null); assert.equal(dareFor("2026-10-17", false, { dares: [] }), null);
});

test("the reroll changes the dare once a day, and not after it's done", () => {
  const day = "2026-10-20"; const base = dareFor(day), alt = dareFor(day, true); assert.notEqual(alt.id, base.id, "a different dare");
  assert.equal(shownDare(day, {}).id, base.id);
  const p = rerollPatch(day, {}); assert.deepEqual(p, { dares: { done: [], reroll: day } });
  const s1 = { ...p }; assert.equal(shownDare(day, s1).id, alt.id, "the rerolled dare shows all day"); assert.equal(rerollPatch(day, s1), null, "only one reroll a day");
  assert.equal(shownDare("2026-10-21", s1).id, dareFor("2026-10-21").id, "tomorrow starts fresh"); assert.ok(rerollPatch("2026-10-21", s1), "and gets a new reroll");
  assert.equal(rerollPatch(day, { dares: { done: [day] } }), null, "no reroll after it's done");
});

test("I did it: the date is saved once and pays one star once", () => {
  const day = "2026-10-20";
  const p = donePatch(day, { stars: 9, dares: { done: ["2026-10-18"], reroll: day } });
  assert.deepEqual(p, { dares: { done: ["2026-10-18", day], reroll: day }, stars: 10 });
  assert.equal(donePatch(day, { stars: 10, ...p }), null, "a second tap saves and pays nothing");
  assert.equal(doneCount({ dares: { done: ["2026-10-18", day, day, 3] } }), 2);
  assert.deepEqual(dareState({}), { done: [], reroll: "" }); assert.deepEqual(dareState({ dares: { done: "x", reroll: 5 } }), { done: [], reroll: "" });
});

test("schema 34: done dates are real dates, once each, sorted; reroll is a date or empty; dare is a bite", () => {
  assert.ok(SCHEMA_VERSION >= 34); assert.ok(BITE_IDS.includes("dare"));
  const m = migrateDoc("settings", "main", { _v: 33, dares: { done: ["2026-10-19", "2026-10-17", "2026-10-19", "junk", 4, null], reroll: "2026-10-19", extra: [1] } });
  assert.equal(m._v, SCHEMA_VERSION); assert.deepEqual(m.dares, { done: ["2026-10-17", "2026-10-19"], reroll: "2026-10-19" });
  assert.deepEqual(migrateDoc("settings", "main", { _v: 33, dares: "x" }).dares, { done: [], reroll: "" });
  assert.deepEqual(migrateDoc("settings", "main", { _v: 33, dares: { done: [], reroll: "tuesday" } }).dares, { done: [], reroll: "" });
  assert.equal("dares" in migrateDoc("settings", "main", { _v: 33, pin: "2027" }), false, "nothing invented");
  assert.deepEqual(migrateDoc("practice", "2026-10-17", { _v: 21, bites: ["dare", "zzz"] }).bites, ["dare"], "dare survives the bite filter");
});

test("Today card: shows today's dare, one reroll, I did it saves the date, the bite and one star, then a calm done state", async () => {
  resetDom(); for (const k of Object.keys(S)) S[k] = {}; S.practice = {}; S.settings = { stars: 4 };
  const today = todayIso(); renderDares(); const card = el("#dareCard");
  assert.equal(card.hidden, false); const first = dareFor(today);
  assert.ok(card.innerHTML.includes(first.text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").slice(0, 12)), "today's dare shows");
  assert.ok(card.innerHTML.includes("dareDone()") && card.innerHTML.includes("I did it! 🎉") && card.innerHTML.includes("🎲 Try another"));
  const writes = []; setBackend({ set: async (col, id, rec) => { writes.push({ col, id, rec }); }, del: async () => {} });
  try {
    await window.dareReroll(); assert.equal(S.settings.dares.reroll, today); assert.ok(!el("#dareCard").innerHTML.includes("Try another"), "the reroll is used up");
    assert.ok(el("#dareCard").innerHTML.includes(dareFor(today, true).text.slice(0, 12)), "the new dare shows");
    await window.dareReroll(); assert.equal(writes.length, 1, "a second reroll writes nothing");
    await window.dareDone();
    assert.deepEqual(S.settings.dares.done, [today]); assert.equal(S.settings.stars, 5, "one star"); assert.deepEqual(S.practice[today].bites, ["dare"], "the dare bite is counted");
    const html = el("#dareCard").innerHTML; assert.ok(html.includes("🎯 1 dare done") && !html.includes("dareDone()"), "calm done state with a count");
    const n = writes.length; await window.dareDone(); assert.equal(writes.length, n, "a second tap writes nothing"); assert.equal(S.settings.stars, 5, "and pays nothing");
  } finally { setBackend(null); resetDom(); for (const k of Object.keys(S)) S[k] = {}; }
  assert.match(src("js/views/home.js"), /renderDares\(\)/); assert.match(src("sw.js"), /"\.\/js\/dares\.js"/); assert.match(src("sw.js"), /"\.\/data\/dares\.json"/);
  const html = src("index.html"); assert.ok(html.indexOf('id="todayCard"') < html.indexOf('id="moreToday"') && html.indexOf('id="moreToday"') < html.indexOf('id="adventArea"') && html.indexOf('id="adventArea"') < html.indexOf('id="dareCard"'), "the card sits under More for today, after the countdown, below the one card (Build 2)");
});
