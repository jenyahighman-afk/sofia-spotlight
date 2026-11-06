// 1.65.0 (Jenya, Nov 5: "make it so she can pick skills she is working on and keeping track of"): ⭐ I'm working on, her own
// list on top of the Skills page, and everything else on the page folded under it. Reads files and the fake DOM only: no
// clock, no weekday, no timezone.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installEnv, resetDom, el } from "./_env.mjs";
installEnv();
const json = (f) => JSON.parse(readFileSync(new URL("../data/" + f + ".json", import.meta.url), "utf8"));
const src = (f) => readFileSync(new URL("../" + f, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const { applyData, DATA_FILES } = await import("../js/data.js");
const got = {}; for (const f of DATA_FILES) got[f] = json(f); applyData(got);
const { S, setBackend } = await import("../js/store.js");
const W = await import("../js/working.js");
const clearS = () => { for (const k of Object.keys(S)) S[k] = {}; };

test("her list: what she picked, in her order; this month's ⭐ skill starts it until she picks", () => {
  assert.equal(W.WORK_MAX, 6);
  assert.deepEqual(W.workingIds({}, "2026-11-05"), []);
  assert.deepEqual(W.workingIds({ monthSkills: { "2026-11": "s-cartwheel" } }, "2026-11-05"), ["s-cartwheel"], "the month's pick is not lost");
  assert.deepEqual(W.workingIds({ monthSkills: { "2026-11": "s-cartwheel" } }, "2026-12-01"), []);
  assert.deepEqual(W.workingIds({ working: [], monthSkills: { "2026-11": "s-cartwheel" } }, "2026-11-05"), [], "once she has a list, an empty one stays empty");
  assert.deepEqual(W.workingIds({ working: ["s-leap", "split-m", "nope", "s-leap", "b-plie"] }), ["s-leap", "split-m", "b-plie"], "her order; a skill no longer on a list drops out; each once");
  assert.equal(W.workingIds({ working: ["s-side-sit", "s-leap", "s-cartwheel", "s-donut", "s-calypso", "split-r", "split-l", "split-m"] }).length, 6);
  assert.deepEqual(W.workingIds({ working: "s-leap" }), [], "a broken value is no list");
});

test("a row says how it's going: Working on it, Clean, Teacher-checked; a split says her change; nothing is counted or due", () => {
  const sk = (state) => W.workRow("s-cartwheel", { skills: state ? { "s-cartwheel": { state } } : {} });
  assert.deepEqual([sk().label, sk("learning").label, sk("clean").label, sk("checked").label], ["Working on it", "Working on it", "Clean", "Teacher-checked"], "on her list it is never \"Not yet\"");
  assert.equal(sk().ic, "◔"); assert.equal(sk("clean").ic, "◉"); assert.match(sk().tip, /Reach, look, place/); assert.equal(W.workRow("nope"), null);
  const row = W.workRowHtml(sk("learning")); assert.match(row, /<b>Cartwheel<\/b><small>Working on it<\/small>/); assert.match(row, /wkGot\('s-cartwheel'\)">✓ I've got it clean/); assert.match(row, /openCards\('s-cartwheel'\)">📷 Add a photo/); assert.match(row, /wkRemove\('s-cartwheel'\)" aria-label="Take Cartwheel off my list">✕/);
  assert.match(W.workRowHtml(sk("clean")), /wkGot\('s-cartwheel'\)">↩ Still working on it/);
  const checked = W.workRowHtml(sk("checked")); assert.match(checked, /★ Teacher-checked/); assert.doesNotMatch(checked, /wkGot/, "a teacher's check stays");
  const one = W.workRowHtml({ ...sk("learning"), shots: [{ url: "a.jpg", date: "2026-11-01" }] }); assert.match(one, /a\.jpg[\s\S]*Before/); assert.doesNotMatch(one, />Now</); assert.match(one, /📷 My photos · 1/);
  const two = W.workRowHtml({ ...sk("learning"), shots: [{ url: "a.jpg", date: "2026-11-01" }, { url: "b.jpg", date: "2026-11-20" }] }); assert.match(two, /a\.jpg[\s\S]*Before[\s\S]*b\.jpg[\s\S]*Now/);
  const none = W.workRow("split-r", {}); assert.equal(none.note, "No photo yet"); assert.equal(none.n, "Right split");
  const grown = W.workRow("split-r", { goals: { g1: { id: "g1", preset: "split-r", createdAt: "2026-09-01", checkins: [{ date: "2026-09-01", value: 150 }, { date: "2026-09-15", value: 162 }] } } });
  assert.equal(grown.note, "▲ 12° since your first one"); const sp = W.workRowHtml(grown); assert.match(sp, /splitOpen\('split-r'\)">📷 Add a photo/); assert.doesNotMatch(sp, /wkGot|180|%/);
  const empty = W.workingCardHtml([]); assert.match(empty, /⭐ I'm working on/); assert.match(empty, /You choose, and you can change them any time\./); assert.match(empty, /wkPick\(\)">＋ Pick a skill/);
  const some = W.workingCardHtml([sk("learning"), none]); assert.equal((some.match(/class="wk-row/g) || []).length, 2); assert.match(some, /wkPick\(\)">＋ Pick a skill/);
  const full = W.workingCardHtml(Array(6).fill(sk("learning"))); assert.match(full, /That's a full list\. Take one off to pick another\./); assert.doesNotMatch(full, /wkPick/);
  assert.doesNotMatch(empty + some + full + sp, /due|days left|streak|missed|Not yet/i);
});

test("the picker: the solo's tricks and the splits open, acro by level with her group first, the class lists folded", () => {
  const g = W.pickGroups({ "s-leap": { state: "clean" } }, ["s-cartwheel", "split-l"]);
  assert.deepEqual(g.map(x => x.key), ["solo", "bendy", "acro", "classes"]); assert.deepEqual(g.map(x => x.open), [true, true, false, false]);
  const solo = g[0].parts[0].items; assert.equal(solo.length, json("skills").styles.solo.skills.length); assert.equal(solo.find(i => i.id === "s-cartwheel").on, true); assert.equal(solo.find(i => i.id === "s-leap").state, "clean");
  assert.deepEqual(g[1].parts[0].items.map(i => [i.n, i.on]), [["Right split", false], ["Left split", true], ["Middle split", false]]);
  assert.deepEqual(g[2].parts.map(p => p.label), ["Level 2 · your group", "Level 3 · your group", "✨ Bonus moves", "Level 1", "Level 4"]); assert.ok(g[2].parts.every(p => p.fold));
  assert.equal(g[2].parts.reduce((a, p) => a + p.items.length, 0), json("skills").styles.acro.skills.length, "every acro skill, once");
  assert.deepEqual(g[3].parts.map(p => p.label), ["🩰 Ballet", "⚡ Jazz", "🌊 Contemporary", "🎧 Hip hop"]);
  assert.equal(W.chipText({ n: "Cartwheel", on: true, state: "learning" }), "⭐ Cartwheel"); assert.equal(W.chipText({ n: "Leap", on: false, state: "clean" }), "◉ Leap"); assert.equal(W.chipText({ n: "Calypso", on: false, state: "notyet" }), "Calypso");
  const html = W.pickerHtml(g, { count: 2 }); assert.match(html, /id="wkHint">Tap the ones you want\. ⭐ means it's on your list\. Two or three at a time is plenty\./);
  assert.match(html, /<button class="chip sun" onclick="wkToggle\('s-cartwheel', this\)">⭐ Cartwheel<\/button>/); assert.match(html, /<button class="chip" onclick="wkToggle\('s-leap', this\)">◉ Leap on the swell<\/button>/);
  assert.match(html, /<details class="card acc" open><summary>🌸 Solo tricks<\/summary>/); assert.match(html, /<details class="card acc"><summary>🤸 Acro<\/summary><details class="more"><summary>Level 2 · your group<\/summary>/);
  assert.match(W.pickHint(6), /Your list is full: take one off to pick another\./);
});

test("picking, marking and taking off: one setting, and the skill's own record", async () => {
  resetDom(); clearS(); const writes = []; setBackend({ set: async (col, id, rec) => { writes.push({ col, id }); }, del: async () => {} });
  try {
    W.renderWorking(); assert.match(el("#workingCard").innerHTML, /＋ Pick a skill/);
    const chip = el("#wkChip"); await window.wkToggle("s-cartwheel", chip);
    assert.deepEqual(S.settings.working, ["s-cartwheel"]); assert.equal(S.skills["s-cartwheel"].state, "learning", "a skill she hadn't started is learning now");
    assert.equal(chip.textContent, "⭐ Cartwheel"); assert.match(el("#toast").textContent, /On your list/); assert.match(el("#workingCard").innerHTML, /<b>Cartwheel<\/b><small>Working on it<\/small>/);
    await window.wkToggle("split-m", null); assert.deepEqual(S.settings.working, ["s-cartwheel", "split-m"]); assert.ok(!Object.keys(S.goals || {}).length, "a split on her list writes no goal: that waits for her first check-in");
    await window.wkToggle("nope", null); assert.deepEqual(S.settings.working, ["s-cartwheel", "split-m"]);
    await window.wkGot("s-cartwheel"); assert.equal(S.skills["s-cartwheel"].state, "clean"); assert.match(el("#workingCard").innerHTML, /↩ Still working on it/);
    await window.wkGot("s-cartwheel"); assert.equal(S.skills["s-cartwheel"].state, "learning");
    S.skills["s-donut"] = { id: "s-donut", state: "checked", teacher: "Miss A" }; await window.wkToggle("s-donut", null); await window.wkGot("s-donut"); assert.equal(S.skills["s-donut"].state, "checked", "a teacher's check stays");
    await window.wkToggle("s-cartwheel", chip); assert.deepEqual(S.settings.working, ["split-m", "s-donut"]); assert.equal(chip.textContent, "Cartwheel"); assert.equal(S.skills["s-cartwheel"].state, "learning", "off the list, its record stays");
    await window.wkRemove("split-m"); assert.deepEqual(S.settings.working, ["s-donut"]); assert.match(el("#toast").textContent, /Off your list\. It's still under 📚 All skills\./);
    for (const id of ["s-side-sit", "s-leap", "s-calypso", "split-r", "split-l"]) await window.wkToggle(id, null);
    assert.equal(S.settings.working.length, 6); await window.wkToggle("s-floor-kick", null); assert.equal(S.settings.working.length, 6, "six is the most"); assert.match(el("#toast").textContent, /Your list is full/);
    assert.ok(writes.every(w => w.col === "settings" || w.col === "skills"), "nothing else is written");
  } finally { setBackend(null); resetDom(); clearS(); }
});

test("the page: her list on top, everything else a fold, ids unchanged; the words and the release", () => {
  const html = src("index.html"), sk = html.slice(html.indexOf('id="p-skills"'), html.indexOf('id="p-practice"'));
  assert.match(sk, /<div class="card sun work-card" id="workingCard"><\/div>\s*<details class="card acc violet" id="allSkills"><summary>📚 All skills<\/summary>/);
  const order = ["workingCard", "allSkills", "skillRings", "classFold", "skillList", "cardsFold", "meCards", "cardsArea", "goalsFold", "goalRings", "aerialFold", "drillBox"]; for (let i = 1; i < order.length; i++) assert.ok(sk.indexOf(`id="${order[i - 1]}"`) < sk.indexOf(`id="${order[i]}"`), order[i - 1] + " before " + order[i]);
  assert.equal((sk.match(/<div class="card /g) || []).length, 1, "one open card, her list; the rest are folds"); assert.doesNotMatch(html, /id="monthSkill"|<h3>📈 Skills<\/h3>|<h3>🎯 Goals<\/h3>/);
  assert.match(src("js/app.js"), /renders\.push\(guard\("working", renderWorking\)\)/); assert.match(src("js/news.js"), /skills: \{ page: "skills", scroll: "#workingCard" \}/); assert.match(src("sw.js"), /"\.\/js\/working\.js"/);
  const pass = json("pass"), grab = pass.parts.find(p => p.id === "grab").lines.join(" "); assert.match(grab, /In ⭐ I'm working on, tap ＋ Pick a skill and choose it\./); assert.match(grab, /Each skill on your list has 📷 Add a photo\./); assert.ok(pass.tips.some(t => t.t === "⭐ I'm working on is on the Skills tab. You pick the skills."));
  assert.doesNotMatch(JSON.stringify(pass) + JSON.stringify(json("news")), /My skill this month/);
  assert.match(src("js/version.js"), /APP_VERSION = "1\.(6[5-9]|[7-9]\d)\./); assert.match(src("README.md"), /\*\*1\.65\.0: her own list on top of Skills, ⭐ I'm working on\*\*/);
});
