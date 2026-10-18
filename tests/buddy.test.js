// The talking helper: ONE next step from the day's real state (comp weekend → plan must-box → comp mode → rest day →
// a Today card; once the day counts → plan, dare, door, flipbook, full list, then fun), lines filled only from real values,
// no repeat of the last line, the bubble in the fake DOM, and the "bitedone" pop after a bite.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installEnv, resetDom, el } from "./_env.mjs";
installEnv();
const read = (f) => JSON.parse(readFileSync(new URL("../" + f, import.meta.url), "utf8"));
const src = (f) => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const { applyData, DATA_FILES } = await import("../js/data.js");
const got = {}; for (const f of DATA_FILES) got[f] = read("data/" + f + ".json"); applyData(got);
const B = await import("../js/buddy.js");
const lines = got.buddy;
const seq = (...xs) => { let i = 0; return () => xs[Math.min(i++, xs.length - 1)]; };
const card = (id, sub, done = false) => ({ id, sub, go: `go_${id}()`, done });
const base = { name: "Sofia", pet: "Bun-Bun", dayDone: false, fullDone: false, streak: 4, skips: 2, petDays: 10, comp: null, compMode: false, plan: null, ticks: [], classes: [], restDay: false, cards: [card("trick", "Leap"), card("game", "Mirror"), card("move", "Passé balance")], dare: false, door: null, glow: false, cardsEarned: 3, starsLeft: 9, unlock: "Gold leotard", event: { name: "Winter Showcase", days: 82 } };

test("before the day counts: comp weekend, then the plan's must-box, then comp mode, rest day, then a Today card", () => {
  assert.equal(B.pickStep({ ...base, comp: { id: "x" } }).key, "comp-weekend");
  const plan = { must: [{ id: "a", t: "🦵 Knee block 5 min", go: "" }, { id: "b", t: "🧠 Trio chunk", go: "memo:trio" }] };
  const s1 = B.pickStep({ ...base, plan }); assert.equal(s1.key, "plan"); assert.equal(s1.vars.item, "🦵 Knee block 5 min"); assert.equal(s1.go, "buddyScroll('#dayPlan')");
  const s2 = B.pickStep({ ...base, plan, ticks: ["a"] }); assert.equal(s2.vars.item, "🧠 Trio chunk"); assert.equal(s2.go, "showPage('dances');memoFocus('trio')", "the plan's own ▶");
  assert.equal(B.pickStep({ ...base, compMode: true }).key, "comp-mode");
  assert.equal(B.pickStep({ ...base, restDay: true }).key, "rest");
  const c = B.pickStep(base, seq(0.5)); assert.equal(c.key, "game"); assert.equal(c.vars.game, "Mirror"); assert.equal(c.go, "go_game()");
  const d = B.pickStep({ ...base, cards: [card("trick", "Leap", true), card("move", "Passé", false)] }, seq(0)); assert.equal(d.key, "move", "a card already done is skipped");
});

test("once the day counts: plan bonus, the small open things, then fun; all done when nothing is left", () => {
  const done = { ...base, dayDone: true };
  assert.equal(B.pickStep({ ...done, plan: { must: [{ id: "a", t: "Kicks" }] } }).key, "plan-more");
  const keys = new Set(); for (let i = 0; i < 40; i++) keys.add(B.pickStep({ ...done, door: false, glow: true }, () => i / 40).key);
  assert.deepEqual([...keys].sort(), ["dare", "door", "full", "glow"].sort(), "only the open 'for today' things");
  const fun = new Set(); for (let i = 0; i < 40; i++) fun.add(B.pickStep({ ...done, dare: true, fullDone: true }, () => i / 40).key);
  assert.ok(fun.has("all-done") && fun.has("teach") && fun.has("count") && fun.has("cards")); assert.ok(!fun.has("stars"), "stars only when the next unlock is close (≤ 5)");
  const near = new Set(); for (let i = 0; i < 60; i++) near.add(B.pickStep({ ...done, dare: true, fullDone: true, starsLeft: 2 }, () => i / 60).key); assert.ok(near.has("stars"));
  assert.ok(!new Set(Array.from({ length: 30 }, (_, i) => B.pickStep({ ...done, dare: true, restDay: true }, () => i / 30).key)).has("full"), "no full-list nudge on a rest day");
});

test("lines: every situation has lines, placeholders are filled from real values only, no 'undefined', no repeats in a row", () => {
  for (const k of ["plan", "plan-more", "trick", "move", "game", "memo", "comp-weekend", "comp-mode", "rest", "comeback", "just-done", "dare", "door", "glow", "full", "cards", "costume", "teach", "count", "stars", "all-done"]) assert.ok((lines.steps[k] || []).length >= 1, k);
  assert.ok(lines.openers.length >= 12, "plenty of openers so it feels unpredictable");
  assert.equal(B.fill("Hi {name}", { name: "Sofia" }), "Hi Sofia"); assert.equal(B.fill("{event} in {eventDays}", { event: "X" }), null, "a missing value drops the line");
  for (let i = 0; i < 200; i++) { const m = B.compose({ ...base, dayDone: i % 2 === 0, door: false, glow: i % 3 === 0 }, { rng: Math.random, lines }); const all = [m.opener, m.text, m.fact, m.button].join(" "); assert.ok(!/undefined|null|\{\w+\}/.test(all), all); assert.ok(m.text.length > 5, m.key); }
  const first = B.compose(base, { rng: () => 0, lines }); const second = B.compose(base, { rng: () => 0, lines, last: first.id }); assert.notEqual(second.id, first.id, "never the same step line twice in a row");
  const jd = B.compose({ ...base, dayDone: true }, { rng: () => 0, lines, justDone: true }); assert.ok(lines.steps["just-done"].includes(jd.opener), "right after a bite it cheers first");
  const back = B.compose({ ...base, streak: 0 }, { rng: () => 0, lines }); assert.ok(lines.steps.comeback.includes(back.opener), "a broken streak gets a fresh-start cheer, not a scolding");
  const f = B.factsFor({ ...base, skips: 1, classes: [{ name: "Mini Ballet III", t: "4:30–5:30" }] }).map(x => x[0]); assert.deepEqual(f.sort(), ["class", "event", "pet", "skips", "streak"].sort());
  assert.ok(!B.factsFor({ ...base, event: { name: "Far", days: 200 } }).some(x => x[0] === "event"), "far-off events stay quiet");
});

test("the bubble in the fake DOM: real-state message, a go button with the step's action, quiet today, and the pop after a bite", async () => {
  resetDom(); localStorage.removeItem("spotlight:buddy");
  B.initBuddy(); const m = B.showBuddy(); assert.ok(m && m.text, "a message from the empty family space"); assert.equal(el("#buddyBubble").hidden, false);
  const h = el("#buddyBubble").innerHTML; assert.ok(h.includes(m.text.replace(/&/g, "&amp;").replace(/'/g, "&#39;").slice(0, 10)) || h.includes("buddy-text")); assert.match(h, /buddyHide\(\)/); assert.match(h, /buddyQuiet\(\)/); assert.match(h, /buddySay\(\)/);
  assert.match(el("#buddyPet").innerHTML, /<svg/, "her own pet is the helper");
  assert.equal(JSON.parse(localStorage.getItem("spotlight:buddy")).last, m.id, "remembers the last line on this phone");
  window.buddyQuiet(); assert.equal(el("#buddyBubble").hidden, true); assert.equal(JSON.parse(localStorage.getItem("spotlight:buddy")).quiet.length, 10);
  for (const f of ["js/buddy.js", "data/buddy.json"]) assert.ok(src("sw.js").includes("./" + f), "cached offline: " + f);
  assert.match(src("js/habit.js"), /new CustomEvent\("bitedone"/, "a counted bite tells the helper");
  assert.ok(src("index.html").includes('id="buddy"') && src("index.html").includes('onclick="buddyTap()"'));
});
