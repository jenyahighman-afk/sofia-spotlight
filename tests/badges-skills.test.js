// Badges (pure evaluation) and the skill ladders (data + progress rings).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { evalBadges, AUTO_BADGES, badgeMeta } from "../js/badges.js";
import { styleProgress, skillState, levelGroups, focusLabel } from "../js/skills.js";

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
  assert.deepEqual(evalBadges(ctx({ quickCount: 5 })), ["quick5"]); assert.deepEqual(evalBadges(ctx({ settings: { nmBest: 10 } })), ["nextmove"]); assert.deepEqual(evalBadges(ctx({ gems: 5 })), ["gem1", "gem5"]);
});

test("skills.json: the solo's tricks first, then five styles; 8–12 skills each, unique ids, states listed", () => {
  const styles = Object.keys(ladder.styles);
  assert.deepEqual(styles, ["solo", "ballet", "jazz", "contemporary", "acro", "hiphop"]);
  for (const n of ["Donut roll", "Calypso", "Front walkover to knee", "Scorpion → needle"]) assert.ok(ladder.styles.solo.skills.some(s => s.n === n), n);
  assert.ok(ladder.styles.solo.skills.every(s => s.tip), "every solo trick has a one-line cue");
  const ids = new Set();
  for (const [k, st] of Object.entries(ladder.styles)) {
    assert.ok(st.n && st.ic, k);
    if (k !== "acro") assert.ok(st.skills.length >= 8 && st.skills.length <= 12, `${k} has ${st.skills.length} skills`);
    for (const s of st.skills) { assert.ok(s.id && s.n, k); assert.ok(!ids.has(s.id), "duplicate skill id " + s.id); ids.add(s.id); }
  }
  assert.deepEqual(ladder.states, ["notyet", "learning", "clean", "checked"]);
  const acro = ladder.styles.acro.skills.map(s => s.id);
  assert.ok(acro.indexOf("a-cartwheel") < acro.indexOf("a-roundoff") && acro.indexOf("a-roundoff") < acro.indexOf("a-aerial"), "acro ladder runs cartwheel → round-off → aerial");
});

test("acro is the studio's chart: Levels 1–4 in four sections, her group in focus, level-up lines resolve, old ids kept", () => {
  const st = ladder.styles.acro; assert.match(st.src, /Glass House/); assert.deepEqual(st.focus, [2, 3]);
  assert.deepEqual(st.sections, ["Acro basics", "Power tumbling", "Variation movements", "Partner moves"]);
  for (const sk of st.skills) { if (sk.bonus) { assert.ok(!("lvl" in sk), sk.id); continue; } assert.ok([1, 2, 3, 4].includes(sk.lvl), sk.id); assert.ok(st.sections.includes(sk.sec), sk.id); assert.ok(sk.n.length <= 40, sk.n); assert.match(sk.id, /^a-[a-z0-9-]{1,38}$/); }
  assert.deepEqual(st.skills.filter(s => s.bonus).map(s => [s.id, s.n]), [["a-handstand", "Handstand, 3 seconds"], ["a-chin", "Chin stand"]], "the two moves not on the chart stay as bonus moves");
  assert.equal(new Set(st.skills.map(s => s.n)).size, st.skills.length, "names are unique (duplicates carry their level)");
  for (const l of [1, 2, 3, 4]) assert.ok(st.skills.filter(s => s.lvl === l).length >= 20, "level " + l);
  for (const id of ["a-cartwheel", "a-onehand", "a-roundoff", "a-bridge", "a-dive", "a-frontwalkover", "a-backwalkover", "a-aerial", "a-handstand", "a-chin"]) assert.ok(acroIds().includes(id), "kept so her marks stay: " + id);
  const by = Object.fromEntries(st.skills.map(s => [s.id, s]));
  assert.deepEqual(st.levelup.map(r => r.lvl), [2, 3, 4]);
  assert.deepEqual(st.levelup[0].need.map(id => by[id].n), ["Front limber", "Back bend, kickover"]);
  assert.deepEqual(st.levelup[1].need.map(id => by[id].n), ["Aerial", "R.O. back walkover"]);
  assert.equal(by[st.levelup[2].need[0]].n, "Aerial: 1 step"); assert.equal(st.levelup[2].need[1], "Front aerial timer", "a printed line with no matching cell stays text");
  assert.equal(by["a-aerial"].lvl, 2); assert.equal(by["a-cartwheel"].lvl, 1); assert.equal(by["a-onehand"].n, "Cartwheel: 1 handed");
  const groups = levelGroups(st); assert.deepEqual(groups.map(g => [g.lvl, g.focus]), [[1, false], [2, true], [3, true], [4, false], [0, true]]); assert.equal(groups[4].label, "✨ Bonus moves"); assert.deepEqual(groups[4].req, []);
  assert.deepEqual(groups[2].req.map(r => r.n), ["Aerial", "R.O. back walkover"]); assert.deepEqual(groups[3].req[1], { id: "", n: "Front aerial timer" });
  assert.equal(levelGroups(ladder.styles.ballet), null, "plain ladders have no levels"); assert.equal(focusLabel(st), "Level 2–3");
});
const acroIds = () => ladder.styles.acro.skills.map(s => s.id);

test("progress rings: learning counts a third, clean two thirds, teacher-checked full; acro counts her group's levels", () => {
  const skills = { "a-aerial": { state: "checked", teacher: "Hannah" }, "a-onehand": { state: "clean" }, "a-dive-walkover": { state: "learning" }, "a-cartwheel": { state: "checked" }, "a-bogus": { state: "weird" } };
  const p = styleProgress(skills, ladder);
  const n = ladder.styles.acro.skills.filter(s => s.bonus || [2, 3].includes(s.lvl)).length;
  assert.equal(p.acro.pct, Math.round(100 * 6 / (n * 3)), "Level 1 cartwheel doesn't count toward the Level 2–3 ring");
  assert.equal(p.acro.checked, 1); assert.equal(p.acro.clean, 1); assert.equal(p.acro.total, n);
  const j = { "j-iso": { state: "checked" }, "j-kick": { state: "clean" } }; assert.equal(styleProgress(j, ladder).jazz.pct, Math.round(100 * 5 / (ladder.styles.jazz.skills.length * 3)), "plain ladders count every skill");
  assert.equal(p.ballet.pct, 0);
  assert.equal(skillState(skills, "a-bogus"), "notyet");
  assert.equal(skillState(skills, "nope"), "notyet");
  assert.equal(skillState(skills, "a-cartwheel"), "checked");
});
