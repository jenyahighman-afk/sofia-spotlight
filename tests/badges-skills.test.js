// Badges (pure evaluation) and the skill ladders (data + progress rings).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { evalBadges, AUTO_BADGES, badgeMeta } from "../js/badges.js";
import { styleProgress, skillState } from "../js/skills.js";

const ladder = JSON.parse(readFileSync(new URL("../data/skills.json", import.meta.url), "utf8"));
const ctx = (o = {}) => ({ streak: 0, closed: 0, aerialPct: 0, settings: {}, practice: {}, weekFixPicked: false, fullRun: false, ...o });

test("badge keys are unique and every automatic badge has a label and emoji", () => {
  assert.equal(new Set(AUTO_BADGES.map(b => b.key)).size, AUTO_BADGES.length);
  for (const b of AUTO_BADGES) { assert.ok(b.label && b.emoji, b.key); assert.equal(typeof b.test, "function"); }
  assert.equal(badgeMeta("nocues-solo").label, "No cues");
  assert.equal(badgeMeta("clean5-a-aerial").label, "Clean 5 in a row");
  assert.equal(badgeMeta("mystery").emoji, "⭐");
});

test("nothing is earned from a blank slate; streaks, closed fixes, aerial, games, film review and full run each earn theirs", () => {
  assert.deepEqual(evalBadges(ctx()), []);
  assert.deepEqual(evalBadges(ctx({ streak: 3 })), ["streak3"]);
  assert.deepEqual(evalBadges(ctx({ streak: 9 })), ["streak3", "streak7"]);
  assert.deepEqual(evalBadges(ctx({ closed: 5 })), ["fix1", "fix5"]);
  assert.deepEqual(evalBadges(ctx({ closed: 10 })), ["fix1", "fix5", "fix10"]);
  assert.deepEqual(evalBadges(ctx({ aerialPct: 50 })), ["aerial25", "aerial50"]);
  assert.deepEqual(evalBadges(ctx({ aerialPct: 100 })), ["aerial25", "aerial50", "aerial75", "aerial100"]);
  assert.deepEqual(evalBadges(ctx({ settings: { gameBest: 1350, jeBest: 9, cdBest: 84, tfBest: 92 } })), ["sparkle", "oops", "compday", "trio"]);
  assert.deepEqual(evalBadges(ctx({ weekFixPicked: true })), ["review1"]);
  assert.deepEqual(evalBadges(ctx({ fullRun: true })), ["run100"]);
});

test("skills.json: the solo's tricks first, then five styles; 8–12 skills each, unique ids, states listed", () => {
  const styles = Object.keys(ladder.styles);
  assert.deepEqual(styles, ["solo", "ballet", "jazz", "contemporary", "acro", "hiphop"]);
  for (const n of ["Donut roll", "Calypso", "Front walkover to knee", "Scorpion → needle"]) assert.ok(ladder.styles.solo.skills.some(s => s.n === n), n);
  assert.ok(ladder.styles.solo.skills.every(s => s.tip), "every solo trick has a one-line cue");
  const ids = new Set();
  for (const [k, st] of Object.entries(ladder.styles)) {
    assert.ok(st.n && st.ic, k);
    assert.ok(st.skills.length >= 8 && st.skills.length <= 12, `${k} has ${st.skills.length} skills`);
    for (const s of st.skills) { assert.ok(s.id && s.n, k); assert.ok(!ids.has(s.id), "duplicate skill id " + s.id); ids.add(s.id); }
  }
  assert.deepEqual(ladder.states, ["notyet", "learning", "clean", "checked"]);
  const acro = ladder.styles.acro.skills.map(s => s.id);
  assert.ok(acro.indexOf("a-cartwheel") < acro.indexOf("a-roundoff") && acro.indexOf("a-roundoff") < acro.indexOf("a-aerial"), "acro ladder runs cartwheel → round-off → aerial");
});

test("progress rings: learning counts a third, clean two thirds, teacher-checked full", () => {
  const skills = { "a-cartwheel": { state: "checked", teacher: "Hannah" }, "a-onehand": { state: "clean" }, "a-roundoff": { state: "learning" }, "a-bogus": { state: "weird" } };
  const p = styleProgress(skills, ladder);
  const n = ladder.styles.acro.skills.length;
  assert.equal(p.acro.pct, Math.round(100 * 6 / (n * 3)));
  assert.equal(p.acro.checked, 1); assert.equal(p.acro.clean, 1); assert.equal(p.acro.total, n);
  assert.equal(p.ballet.pct, 0);
  assert.equal(skillState(skills, "a-bogus"), "notyet");
  assert.equal(skillState(skills, "nope"), "notyet");
  assert.equal(skillState(skills, "a-cartwheel"), "checked");
});
