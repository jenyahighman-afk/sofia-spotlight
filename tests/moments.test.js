// Moments: stickers suggest themselves from the day, then-vs-now pairs come from goal check-ins, the crop maths is right.
import { test } from "node:test";
import assert from "node:assert/strict";
import { installEnv } from "./_env.mjs";
installEnv();
const { stickersFor, nudgeFor, coverRect, thenNowPairs, daysBetween, wrapLines, SIZES, MILESTONES } = await import("../js/moments.js");
const { migrateDoc, SCHEMA_VERSION } = await import("../js/store.js");

test("stickers: big moments first (milestone, gem, badge), then the day's smaller ones, always ending with a plain one", () => {
  const big = stickersFor({ streak: 7, gemTrick: "Calypso", badges: ["Aerial mission ¼"], fullPractice: true, bites: ["trick", "tired"], eventName: "Winter Showcase (Winter Formal)", eventDays: 87 });
  assert.deepEqual(big.map(s => s.key), ["milestone", "gem", "badge", "practice", "rest", "trick", "event", "dance"]);
  assert.equal(big[0].text, "7-day streak!"); assert.equal(big[1].text, "Gem! Calypso"); assert.ok(big.slice(0, 3).every(s => s.big) && big.slice(3).every(s => !s.big));
  assert.equal(nudgeFor(big).key, "milestone"); assert.equal(big[6].text, "87 days to Winter Showcase", "the bracketed part of an event name is dropped");
  const quiet = stickersFor({ streak: 3 }); assert.deepEqual(quiet.map(s => s.key), ["streak", "dance"]); assert.equal(quiet[0].text, "Day 3"); assert.equal(nudgeFor(quiet), null);
  assert.deepEqual(stickersFor({}).map(s => s.key), ["dance"]); assert.equal(stickersFor({ eventName: "Show", eventDays: 0 })[0].text, "Show day!");
  assert.deepEqual(MILESTONES, [7, 14, 30, 50, 100]); assert.equal(SIZES.story.w, 1080); assert.equal(SIZES.story.h, 1920); assert.equal(SIZES.post.h, 1350);
});

test("cover crop fills the box edge to edge from the centre; lines wrap to at most three", () => {
  const r = coverRect(4000, 3000, 1080, 1920); assert.equal(Math.round(r.sh), 3000); assert.equal(Math.round(r.sw), 1688); assert.equal(Math.round(r.sx), 1156); assert.equal(Math.round(r.sy), 0);
  const t = coverRect(1000, 2000, 1080, 1350); assert.equal(Math.round(t.sx), 0); assert.equal(Math.round(t.sh), 1250); assert.equal(Math.round(t.sy), 375);
  const measure = (s) => s.length * 10; assert.deepEqual(wrapLines("Gem! Scorpion to needle", 120, measure), ["Gem!", "Scorpion to", "needle"]); assert.deepEqual(wrapLines("Day 3", 120, measure), ["Day 3"]);
  assert.equal(wrapLines("one two three four five six seven eight", 40, measure).length, 3);
  assert.equal(daysBetween("2026-09-25", "2026-10-13"), 18);
});

test("then-vs-now pairs: the first and latest photo check-ins of goals that have two; videos and missing photos don't count", () => {
  const photos = { p1: { url: "u1", at: "a" }, p2: { url: "u2" }, p3: { url: "u3" }, v1: { url: "v", kind: "video" } };
  const goals = {
    split: { id: "split", name: "Right split", checkins: [{ id: "c1", date: "2026-09-25", photoId: "p1" }, { id: "c2", date: "2026-10-01", photoId: "v1" }, { id: "c3", date: "2026-10-13", photoId: "p3" }, { id: "c4", date: "2026-10-05", photoId: "p2" }] },
    one: { id: "one", name: "Bridge", checkins: [{ id: "c5", date: "2026-10-01", photoId: "p1" }] },
    gone: { id: "gone", name: "Old", deleted: true, checkins: [{ id: "c6", date: "2026-10-01", photoId: "p1" }, { id: "c7", date: "2026-10-02", photoId: "p2" }] },
    none: { id: "none", name: "No photos", checkins: [{ id: "c8", date: "2026-10-01", photoId: "missing" }, { id: "c9", date: "2026-10-02", value: 3 }] },
  };
  const pairs = thenNowPairs(goals, photos); assert.equal(pairs.length, 1);
  assert.deepEqual(pairs[0], { goalId: "split", label: "Right split", then: { url: "u1", date: "2026-09-25" }, now: { url: "u3", date: "2026-10-13" }, days: 18 });
  assert.deepEqual(thenNowPairs({}, {}), []);
});

test("22 → 23: photos.moment is a boolean when present; settings.momentNudge must be a string", () => {
  assert.equal(migrateDoc("photos", "p", { _v: 22, url: "u", moment: 1 }).moment, true); assert.equal("moment" in migrateDoc("photos", "p", { _v: 22, url: "u" }), false);
  assert.equal(migrateDoc("settings", "main", { _v: 22, momentNudge: "2026-10-13|gem" }).momentNudge, "2026-10-13|gem"); assert.equal("momentNudge" in migrateDoc("settings", "main", { _v: 22, momentNudge: 5 }), false);
  assert.equal(migrateDoc("photos", "p", { _v: 22, moment: true })._v, SCHEMA_VERSION);
});
