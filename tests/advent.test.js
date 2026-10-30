// Show countdown: one door a day to the Winter Showcase, what's behind each, no peeking ahead, catching up on missed
// doors, star bonuses paid once, the schema-33 migration, and the Today row / calendar in the fake DOM.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installEnv, resetDom, el } from "./_env.mjs";
installEnv();
const read = (f) => JSON.parse(readFileSync(new URL("../" + f, import.meta.url), "utf8"));
const { applyData, DATA_FILES } = await import("../js/data.js");
const got = {}; for (const f of DATA_FILES) got[f] = read("data/" + f + ".json"); applyData(got);
const adv = got.advent, evs = got.events;
const { doorsFor, canOpen, openedDates, stickerBook, missedDoors, openPatch, doorText, showEvent } = await import("../js/advent.js");
const { S, migrateDoc, SCHEMA_VERSION, setBackend } = await import("../js/store.js");
const src = (f) => readFileSync(new URL("../" + f, import.meta.url), "utf8");

test("the doors: one a day from Oct 17 to the Winter Showcase on Jan 8, counting down to a show-day door", () => {
  const ev = showEvent(adv, evs); assert.equal(ev.id, "wf"); assert.equal(ev.start, "2027-01-08");
  const d = doorsFor(adv, evs); assert.equal(d.length, 84, "Oct 17 to Jan 8 inclusive"); assert.equal(d[0].date, "2026-10-17"); assert.equal(d[0].left, 83); assert.equal(d.at(-1).date, "2027-01-08"); assert.equal(d.at(-1).left, 0); assert.equal(d.at(-1).kind, "show");
  for (let i = 1; i < d.length; i++) assert.equal(Date.parse(d[i].date) - Date.parse(d[i - 1].date), 86400000, "consecutive days: " + d[i].date);
  assert.ok(d.filter(x => x.kind === "stars").every(x => x.n % 7 === 0), "every 7th door is a star bonus"); assert.equal(d.filter(x => x.kind === "stars").length, 11, "doors 7, 14 … 77; door 84 is show day");
  const kinds = new Set(d.map(x => x.kind)); for (const k of ["sticker", "fact", "challenge", "stars", "show"]) assert.ok(kinds.has(k), k);
  assert.ok(d.every(x => x.item), "every door has something behind it"); assert.ok(d.every(x => doorText(x).length > 10 && !/undefined/.test(doorText(x))), "and a line to say");
  assert.deepEqual(doorsFor(adv, []), [], "no show, no calendar"); assert.deepEqual(doorsFor({ ...adv, from: "2027-02-01" }, evs), [], "a start after the show makes no doors");
  const stickers = d.filter(x => x.kind === "sticker").map(x => x.item.n); assert.equal(new Set(stickers).size, stickers.length, "no repeated sticker before the book is full");
});

test("content is kind and checkable: facts end with a full stop, challenges are short and safe, emoji stickers have names", () => {
  for (const f of adv.facts) { assert.ok(/[.!]$/.test(f) && f.length < 140, f); }
  for (const c of adv.challenges) { assert.ok(c.length < 90, c); assert.ok(!/eyes closed|backflip|flip|handstand|aerial|without a mat|on the stairs/i.test(c), "no risky challenges: " + c); }
  for (const s of adv.stickers) assert.ok(s.e && s.n, JSON.stringify(s));
});

test("no peeking: today's and missed doors open, tomorrow's stays locked; opening saves the date once and pays stars once", () => {
  const d = doorsFor(adv, evs); const today = "2026-10-24"; // the 8th door
  assert.equal(canOpen(d[7], today), true); assert.equal(canOpen(d[0], today), true, "a missed door can still be opened"); assert.equal(canOpen(d[8], today), false, "tomorrow is locked");
  assert.deepEqual(missedDoors(d, ["2026-10-17"], today).map(x => x.date), ["2026-10-18", "2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23"]);
  const star = d[6]; assert.equal(star.kind, "stars");
  assert.deepEqual(openPatch(star, { stars: 10, advent: { open: ["2026-10-17"] } }, today), { advent: { open: ["2026-10-17", "2026-10-23"] }, stars: 13 });
  assert.equal(openPatch(star, { stars: 13, advent: { open: ["2026-10-17", "2026-10-23"] } }, today), null, "a second open pays nothing");
  assert.deepEqual(openPatch(d[0], {}, today), { advent: { open: ["2026-10-17"] } }, "a sticker door only saves the date"); assert.equal(openPatch(d[8], {}, today), null, "no peeking");
  assert.deepEqual(stickerBook(d, ["2026-10-17", "2026-10-18", "2026-10-23"]).map(s => s.n), [d[0].item.n], "only opened sticker doors go in the book");
  assert.deepEqual(openedDates({ advent: { open: ["2026-10-17", 3] } }), ["2026-10-17"]); assert.deepEqual(openedDates({}), []);
});

test("schema 33: opened doors are real dates, once each, sorted; nothing invented", () => {
  const m = migrateDoc("settings", "main", { _v: 32, advent: { open: ["2026-10-19", "2026-10-17", "2026-10-19", "junk", 4, null] } });
  assert.equal(m._v, SCHEMA_VERSION); assert.deepEqual(m.advent, { open: ["2026-10-17", "2026-10-19"] });
  assert.deepEqual(migrateDoc("settings", "main", { _v: 32, advent: "x" }).advent, { open: [] }); assert.equal("advent" in migrateDoc("settings", "main", { _v: 32, pin: "2027" }), false);
});

test("Play's countdown tile and the calendar: open today's door, see what's inside, the sticker book fills, locked doors say no peeking", async () => {
  resetDom(); for (const k of Object.keys(S)) S[k] = {};
  const doors = doorsFor(); const today = new Date(); const iso = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");
  assert.ok(!src("index.html").includes('id="adventCard"'), "1.52.0: no Today row; the header's sticker is the countdown"); assert.match(src("js/views/play.js"), /go: "openAdvent\(\)"/, "Play's ✨ Extras tile opens the calendar");
  if (iso < doors[0].date || iso > "2027-01-10") return; // the doors open only during the countdown
  const writes = []; setBackend({ set: async (col, id, rec) => { writes.push({ col, id, rec }); }, del: async () => {} });
  try {
    await window.openAdvent(); assert.deepEqual(S.settings.advent.open, [iso], "today's door is saved as opened"); assert.equal(writes.length, 1);
    const area = el("#adventArea").innerHTML; const door = doors.find(d => d.date === iso); assert.ok(area.includes("advent-reveal pop") && area.includes(doorText(door).replace(/&/g, "&amp;").replace(/"/g, "&quot;").slice(0, 20)), "the surprise shows with a pop");
    assert.ok(area.includes("adventDoor('" + doors.at(-1).date + "')") && area.includes("door locked"), "future doors are in the grid, locked");
    await window.adventDoor(doors.at(-1).date); assert.deepEqual(S.settings.advent.open, [iso], "no peeking at show day"); assert.equal(writes.length, 1);
  } finally { setBackend(null); resetDom(); for (const k of Object.keys(S)) S[k] = {}; }
  assert.match(src("sw.js"), /"\.\/js\/advent\.js"/); assert.match(src("sw.js"), /"\.\/data\/advent\.json"/);
});
