// Corrections tracker: tag inference, stable migration ids, pattern spotting, the weekly fix.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { inferTag, parseLine, migratedId, hashText, recordsFromDance, patterns, chooseWeekFix, weekKey, shiftDate, topFixes, openFor } from "../js/corrections.js";

const dances = JSON.parse(readFileSync(new URL("../data/dances.json", import.meta.url), "utf8"));

test("tags are inferred from the words dancers hear, feet before knees before eyes before arms", () => {
  assert.equal(inferTag("Point the foot and straighten the knee on every extension"), "feet");
  assert.equal(inferTag("Straighten the knee"), "knees");
  assert.equal(inferTag("Eyes up: plan a focal point"), "eyes");
  assert.equal(inferTag("Long arms overhead, shoulders down"), "arms");
  assert.equal(inferTag("Count the rolls out loud (a beat behind)"), "timing");
  assert.equal(inferTag("Match the leg height the three agree on"), "spacing");
  assert.equal(inferTag("Hit and stop, no melting between shapes"), "energy");
  assert.equal(inferTag("Smile"), "other");
  assert.equal(inferTag(""), "other");
});

test("migrated ids are stable per dance + text and change when the text changes", () => {
  assert.equal(migratedId("solo", "Point the foot"), migratedId("solo", "  Point the foot "));
  assert.notEqual(migratedId("solo", "Point the foot"), migratedId("trio", "Point the foot"));
  assert.notEqual(migratedId("solo", "Point the foot"), migratedId("solo", "Point the feet"));
  assert.match(hashText("abc"), /^[0-9a-z]+$/);
});

test("every built-in dance's corrections become one record each, source notes, status working", () => {
  let total = 0;
  for (const d of dances) {
    const recs = recordsFromDance(d, "2026-09-30"); total += recs.length;
    assert.equal(recs.length, d.corrections.filter(x => x.trim()).length, d.id);
    for (const r of recs) { assert.equal(r.danceId, d.id); assert.equal(r.source, "notes"); assert.equal(r.status, "working"); assert.equal(r.date, "2026-09-30"); assert.ok(r.tag); assert.ok(r.id.startsWith("c-" + d.id + "-")); }
    assert.equal(new Set(recs.map(r => r.id)).size, recs.length, "ids unique within " + d.id);
  }
  assert.ok(total >= 16, "the solo, trio and jazz cards carry notes: " + total);
});

test("pattern spotting: a tag repeated 3+ times in the last 60 days, across dances, newest first", () => {
  const today = "2026-09-30"; const c = {};
  const add = (id, tag, date, danceId = "solo", status = "working") => { c[id] = { id, tag, date, danceId, status, text: id }; };
  add("a", "feet", "2026-09-29"); add("b", "feet", "2026-09-20", "trio"); add("c", "feet", "2026-08-10", "pitch-jazz", "done");
  add("d", "eyes", "2026-09-01"); add("e", "eyes", "2026-09-02");
  add("old", "arms", "2026-07-01"); add("old2", "arms", "2026-07-02"); add("old3", "arms", "2026-07-03");
  assert.deepEqual(patterns(c, { today }), [{ tag: "feet", n: 3 }]);
  assert.deepEqual(patterns(c, { today, danceId: "solo" }), []);
  assert.deepEqual(patterns(c, { today, min: 2 }).map(p => p.tag), ["feet", "eyes"]);
  assert.deepEqual(topFixes(c, "solo").map(x => x.id), ["a", "d", "e"].slice(0, 3).sort((x, y) => c[y].date.localeCompare(c[x].date)));
  assert.equal(openFor(c, "pitch-jazz").length, 0);
});

test("weekly fix: the most-repeated tag wins, then the oldest; nothing open → null", () => {
  const c = {
    f1: { id: "f1", tag: "feet", date: "2026-09-10", status: "working", danceId: "solo", text: "a" },
    f2: { id: "f2", tag: "feet", date: "2026-09-12", status: "working", danceId: "trio", text: "b" },
    e1: { id: "e1", tag: "eyes", date: "2026-09-01", status: "working", danceId: "solo", text: "c" },
    f0: { id: "f0", tag: "feet", date: "2026-09-05", status: "done", danceId: "solo", text: "d" },
  };
  assert.equal(chooseWeekFix(c, "2026-09-30").id, "f1"); // feet ×3 in window (incl. the closed one) beats eyes ×1; f1 older than f2
  assert.equal(chooseWeekFix({ x: { id: "x", tag: "eyes", date: "2026-09-01", status: "done" } }, "2026-09-30"), null);
  assert.equal(chooseWeekFix({}, "2026-09-30"), null);
});

test("weeks run Sunday to Saturday", () => {
  assert.equal(weekKey("2026-09-30"), "2026-09-27"); // Wednesday → the Sunday before
  assert.equal(weekKey("2026-09-27"), "2026-09-27");
  assert.equal(weekKey("2026-10-03"), "2026-09-27"); // Saturday
  assert.equal(weekKey("2026-10-04"), "2026-10-04");
  assert.equal(shiftDate("2026-03-01", -1), "2026-02-28");
});

test("an explicit #tag prefix on a card line wins and is stripped from the text; the id stays tied to the bare text", () => {
  assert.deepEqual(parseLine("#feet Donut roll: chin tucked, roll over the shoulder"), { text: "Donut roll: chin tucked, roll over the shoulder", tag: "feet", explicit: true });
  assert.equal(parseLine("Donut roll: chin tucked").tag, "eyes");
  assert.equal(parseLine("#bogus Point").text, "#bogus Point");
  assert.equal(migratedId("solo", "Donut roll"), recordsFromDance({ id: "solo", corrections: ["#feet Donut roll"] }, "2026-09-30")[0].id);
  const donut = recordsFromDance(dances.find(d => d.id === "solo"), "2026-09-30").find(r => r.text.startsWith("Donut roll"));
  assert.equal(donut.tag, "feet"); assert.ok(!donut.text.startsWith("#"));
});
