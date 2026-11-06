// 1.66.0 (Jenya, Nov 6): ⭐ My goals on the Skills page (a trick, the aerial, a split: one list), one page for every goal,
// and 📸 My album where the trick cards fold was. Reads files and the fake DOM only: no clock, no weekday, no timezone
// (every date is passed in).
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
const SK = await import("../js/skills.js");
const W = await import("../js/working.js");
const GP = await import("../js/goalpage.js");
const clearS = () => { for (const k of Object.keys(S)) S[k] = {}; };
const D = "2026-11-06";
const split = { g1: { id: "g1", name: "Right split", preset: "split-r", unit: "deg", measure: "split", emoji: "🦵", createdAt: "2026-09-01", checkins: [{ id: "c1", date: "2026-09-01", photoId: "p1", value: 150 }, { id: "c2", date: "2026-09-15", photoId: "p2", value: 162 }] } };
const photos = { p1: { url: "s1.jpg", goal: "g1" }, p2: { url: "s2.jpg", goal: "g1" }, p3: { url: "clip.mp4", kind: "video" }, c1: { url: "c1.jpg", card: "s-cartwheel", taken: "2026-10-01", at: "2026-10-01T10:00:00Z" }, c2: { url: "c2.jpg", card: "s-cartwheel", taken: "2026-11-01", at: "2026-11-01T10:00:00Z" }, a1: { url: "a1.jpg", card: "a-aerial", taken: "2026-10-20", at: "2026-10-20T10:00:00Z" } };

test("what a goal is: a skill, the aerial, a measure, or nothing", () => {
  assert.equal(W.AERIAL_ID, "a-aerial"); assert.ok(json("skills").styles.acro.skills.some(s => s.id === "a-aerial"), "the chart has the aerial");
  assert.deepEqual(W.MEASURE_KEYS, ["split-r", "split-l", "split-m", "bridge", "arabesque", "side-ext", "handstand", "hollow", "passe"], "every preset but Aerial progression");
  const kind = (id, goals = {}) => W.goalKind(id, { goals });
  assert.deepEqual(["s-cartwheel", "b-plie", "a-aerial", "split-m", "bridge", "aerial", "nope", "goal:gx"].map(id => kind(id)), ["skill", "skill", "aerial", "measure", "measure", "", "", ""]);
  const mine = { gx: { id: "gx", name: "Needle hold", preset: "custom", unit: "sec", checkins: [] }, gd: { id: "gd", name: "Gone", preset: "custom", deleted: true } };
  assert.equal(kind("goal:gx", mine), "measure"); assert.equal(kind("goal:gd", mine), "", "a removed goal answers to nothing"); assert.equal(W.goalDocId("goal:gx"), "gx"); assert.equal(W.goalDocId("bridge"), "");
  assert.equal(W.goalDoc(split, "split-r"), split.g1); assert.equal(W.goalDoc(split, "split-l"), null, "nothing stored until her first check-in"); assert.equal(W.goalDoc(mine, "goal:gx"), mine.gx);
});

test("her own tricks: the trio has no list, so she names them; each is a skill like any other", () => {
  assert.equal(W.ownSkillDoc("  Lift  with   Hannah ", "trio", "own-abc12345").n, "Lift with Hannah"); assert.equal(W.ownSkillDoc("Roll", "pitch", "own-abc12345").dance, ""); assert.equal(W.ownSkillDoc("   ", "trio"), null); assert.equal(W.ownSkillDoc("Roll", "solo", "bad id"), null);
  assert.match(W.ownSkillDoc("Roll", "solo").id, SK.OWN_RE);
  const settings = { ownSkills: [{ id: "own-abc12345", n: "Lift", dance: "trio" }, { id: "nope", n: "Bad id" }, { id: "own-zzzz9999", n: "  " }, null] };
  assert.deepEqual(SK.ownSkills(settings), [{ id: "own-abc12345", n: "Lift", style: "own", dance: "trio" }]); assert.deepEqual(SK.ownSkills({}), []); assert.deepEqual(SK.ownSkills({ ownSkills: "x" }), []);
  clearS(); S.settings = settings;
  try { assert.equal(SK.findSkill("own-abc12345").n, "Lift"); assert.equal(SK.findSkill("s-cartwheel").n, "Cartwheel"); assert.equal(SK.findSkill("own-abc12345", json("skills")), undefined, "a ladder passed in is read as it is");
    const r = W.goalRow("own-abc12345", { working: ["own-abc12345"] }); assert.equal(r.group, "dances"); assert.equal(r.where, "Trio"); assert.equal(r.dance, "trio"); assert.equal(r.how, "◔ Working on it"); assert.equal(r.ic, "💃");
  } finally { clearS(); }
});

test("her list: what she picked, in her order; until she picks it starts with what she is working on already", () => {
  assert.equal(W.WORK_MAX, 8);
  assert.deepEqual(W.workingIds({}, D, { goals: {} }), ["a-aerial", "split-r", "split-l", "split-m"], "the aerial and the three splits");
  assert.deepEqual(W.workingIds({ monthSkills: { "2026-11": "s-cartwheel" } }, D, { goals: {} }), ["s-cartwheel", "a-aerial", "split-r", "split-l", "split-m"], "this month's ⭐ skill is not lost");
  const have = { ...split, gb: { id: "gb", name: "Bridge", preset: "bridge", createdAt: "2026-09-05", checkins: [] }, gx: { id: "gx", name: "Needle hold", preset: "custom", createdAt: "2026-09-09", checkins: [] }, ga: { id: "ga", name: "Aerial progression", preset: "aerial", createdAt: "2026-09-02", checkins: [] }, gd: { id: "gd", preset: "hollow", deleted: true } };
  assert.deepEqual(W.workingIds({}, D, { goals: have }), ["a-aerial", "split-r", "split-l", "split-m", "bridge", "goal:gx"], "and every goal she already has: a preset by its key, her own by its document");
  assert.deepEqual(W.workingIds({ working: [] }, D, { goals: have }), [], "once she has a list, an empty one stays empty");
  assert.deepEqual(W.workingIds({ working: ["s-leap", "split-m", "nope", "s-leap", "a-aerial", "goal:gx", "goal:gd"] }, D, { goals: have }), ["s-leap", "split-m", "a-aerial", "goal:gx"], "her order; what answers to nothing drops out; each once");
  assert.equal(W.workingIds({ working: ["s-side-sit", "s-leap", "s-cartwheel", "s-donut", "s-calypso", "split-r", "split-l", "split-m", "bridge", "a-aerial"] }, D, { goals: {} }).length, 8);
  assert.deepEqual(W.workingIds({ working: "s-leap" }, D, { goals: {} }), ["a-aerial", "split-r", "split-l", "split-m"], "a broken value is no list yet");
});

test("a row says how it's going in the goal's own terms, with her newest photo; nothing is counted against her or due", () => {
  const ctx = { goals: split, photos, skills: { "s-cartwheel": { state: "learning" }, "s-leap": { state: "clean" }, "s-donut": { state: "checked" } }, reviews: {}, settings: { aerial: ["cartwheel-clean", "nope"] }, working: ["s-cartwheel", "a-aerial", "split-r", "split-l", "b-plie"] };
  const cart = W.goalRow("s-cartwheel", ctx); assert.deepEqual([cart.kind, cart.group, cart.how, cart.where, cart.dance, cart.thumb, cart.shots.length, cart.on], ["skill", "dances", "◔ Working on it", "Solo", "solo", "c2.jpg", 2, true]);
  assert.equal(W.goalRow("s-leap", ctx).how, "◉ Clean"); assert.equal(W.goalRow("s-donut", ctx).how, "★ Teacher-checked"); assert.equal(W.goalRow("s-calypso", ctx).how, "○ Not started", "off her list and not begun");
  const plie = W.goalRow("b-plie", ctx); assert.deepEqual([plie.group, plie.where, plie.how], ["classes", "Ballet", "◔ Working on it"], "on her list it is never \"not started\"");
  const aer = W.goalRow("a-aerial", ctx); assert.deepEqual([aer.kind, aer.group, aer.how, aer.thumb, aer.ic], ["aerial", "acro", "Step 2 of 17", "a1.jpg", "🦋"]); assert.equal(aer.sub, "Next: One-hand cartwheel on the FAR hand"); assert.equal(aer.aerial.n, 1);
  assert.deepEqual(W.aerialStep({ aerial: json("aerial").map(s => s.id) }), { n: 17, total: 17, next: null }); assert.equal(W.aerialStep({}).next.id, json("aerial")[0].id); assert.equal(W.aerialStep({ aerial: "x" }).n, 0);
  const sp = W.goalRow("split-r", ctx); assert.deepEqual([sp.kind, sp.group, sp.how, sp.thumb, sp.shots.length, sp.measure], ["measure", "bendy", "▲ 12° since your first one", "s2.jpg", 2, "split"]);
  assert.equal(W.goalRow("split-l", ctx).how, "No photo yet"); assert.equal(W.goalRow("nope", ctx), null);
  assert.equal(W.measureNote({ unit: "deg", checkins: [{ date: "2026-11-01", value: 150 }, { date: "2026-11-15", value: 141 }] }), "📷 2 times so far", "a smaller number never shows as a minus");
  assert.equal(W.measureNote({ unit: "sec", checkins: [{ date: "2026-11-01", value: 8 }, { date: "2026-11-15", value: 12 }] }), "▲ 4 s since your first one"); assert.equal(W.measureNote({ unit: "", checkins: [{ date: "2026-11-01" }] }), "📷 1 time so far"); assert.equal(W.measureNote(null), "No photo yet");
  const fix = W.goalRow("s-cartwheel", { ...ctx, reviews: { r1: { trick: "Cartwheel", date: "2026-11-01", at: "2026-11-01T10:00:00Z", review: { fix: "Old" } }, r2: { trick: "Cartwheel", date: "2026-11-03", at: "2026-11-03T10:00:00Z", review: { fix: "Lock your knees <now>" } } } });
  assert.deepEqual(fix.fix, { date: "2026-11-03", text: "Lock your knees <now>" });
  const html = W.goalRowHtml(fix); assert.match(html, /^<button class="g-row" onclick="goalOpen\('s-cartwheel'\)"><span class="g-ph"><img src="c2\.jpg"/); assert.match(html, /<b>Cartwheel<\/b><small><span class="how">◔ Working on it<\/span> · Solo<\/small><small class="g-sub">🎬 Coach: Lock your knees &lt;now&gt;<\/small>/);
  assert.match(W.goalRowHtml(W.goalRow("split-l", ctx)), /<span class="g-ph none">🦵<\/span>/); assert.match(W.goalRowHtml(aer), /<small class="g-sub">Next: One-hand cartwheel on the FAR hand<\/small>/);
  const card = W.goalsCardHtml(ctx.working.map(id => W.goalRow(id, ctx)));
  assert.doesNotMatch(card, /<h3>/, "the title is on the fold (1.66.1)"); assert.ok(card.indexOf("💃 In my dances") < card.indexOf("🤸 Acro") && card.indexOf("🤸 Acro") < card.indexOf("🦵 Bendy and strong") && card.indexOf("🦵 Bendy and strong") < card.indexOf("🩰 My classes")); assert.equal((card.match(/class="g-row"/g) || []).length, 5); assert.match(card, /wkPick\(\)">＋ Pick a goal/);
  const empty = W.goalsCardHtml([]); assert.match(empty, /a trick, a split, your aerial\. You choose, and you can change it any time\./); assert.match(W.goalsCardHtml(Array(8).fill(cart)), /That's a full list\. Take one off to pick another\./);
  assert.doesNotMatch(card + empty, /due|days left|streak|missed|180|%/i);
});

test("a goal's photos: a skill's lineup, a measure's check-ins (not its clips), the aerial's both", () => {
  assert.deepEqual(W.goalShots("s-cartwheel", { goals: {}, photos }).map(p => p.url), ["c1.jpg", "c2.jpg"], "oldest first");
  assert.deepEqual(W.goalShots("split-r", { goals: split, photos }), [{ id: "p1", url: "s1.jpg", date: "2026-09-01" }, { id: "p2", url: "s2.jpg", date: "2026-09-15" }]);
  const clip = { g2: { id: "g2", preset: "bridge", createdAt: "2026-09-01", checkins: [{ date: "2026-09-01", photoId: "p3", value: 8 }, { date: "2026-09-02", photoId: "", value: 9 }] } }; assert.deepEqual(W.goalShots("bridge", { goals: clip, photos }), []);
  const old = { ga: { id: "ga", preset: "aerial", createdAt: "2026-09-01", checkins: [{ date: "2026-09-10", photoId: "p1" }] } }; assert.deepEqual(W.goalShots("a-aerial", { goals: old, photos }).map(p => p.url), ["s1.jpg", "a1.jpg"], "an old Aerial progression goal's photos are the aerial's");
  assert.deepEqual(W.goalShots("nope", { goals: {}, photos }), []);
});

test("the picker follows the list's groups: her dances with her own tricks, acro with the aerial on top, bendy and strong, classes", () => {
  const g = W.pickGroups({ skills: { "s-leap": { state: "clean" } }, working: ["s-cartwheel", "split-l", "a-aerial"], goals: { gx: { id: "gx", name: "Needle hold", preset: "custom" } }, settings: {} });
  assert.deepEqual(g.map(x => [x.key, x.open]), [["dances", true], ["acro", false], ["bendy", true], ["classes", false]]);
  assert.equal(g[0].parts[0].label, "🌸 Solo tricks"); assert.equal(g[0].own, true); assert.equal(g[0].parts[0].items.find(i => i.id === "s-cartwheel").on, true);
  assert.deepEqual(g[1].parts[0].items, [{ id: "a-aerial", n: "🦋 Aerial, step by step", on: true, state: "notyet" }]); assert.deepEqual(g[1].parts.slice(1).map(p => p.label), ["Level 2 · your group", "Level 3 · your group", "✨ Bonus moves", "Level 1", "Level 4"]);
  assert.equal(g[1].parts.reduce((a, p) => a + p.items.length, 0), json("skills").styles.acro.skills.length, "every acro skill once: the aerial is not in its level too");
  assert.deepEqual(g[2].parts[0].items.map(i => i.n), ["Right split", "Left split", "Middle split", "Bridge", "Arabesque height", "Side extension height", "Handstand hold", "Hollow hold", "Passé balance on relevé", "Needle hold"]); assert.equal(g[2].parts[0].items.at(-1).id, "goal:gx");
  assert.deepEqual(g[3].parts.map(p => p.label), ["🩰 Ballet", "⚡ Jazz", "🌊 Contemporary", "🎧 Hip hop"]);
  const html = W.pickerHtml(g, { count: 3 }); assert.match(html, /id="wkHint">Tap the ones you want\. ⭐ means it's one of your goals\. A few at a time is plenty\./); assert.match(html, /<button class="chip sun" onclick="wkToggle\('a-aerial', this\)">⭐ 🦋 Aerial, step by step<\/button>/);
  assert.match(html, /A trick that isn't here\? Add your own\.<\/p><div class="row wk-own"><input type="text" id="wkOwnName"[^>]*><select id="wkOwnDance"[^>]*><option value="trio">Trio<\/option><option value="solo">Solo<\/option><option value="">Other<\/option><\/select><button class="btn sm coral" onclick="wkOwnAdd\(\)">Add<\/button>/);
  assert.equal((html.match(/wkOwnAdd/g) || []).length, 1, "the form sits with her dances only"); assert.match(W.pickHint(8), /Your list is full/);
});

test("one page for every goal: what's next, her photos, the coach, done", () => {
  const ctx = { goals: split, photos, skills: { "s-cartwheel": { state: "learning" } }, reviews: {}, settings: { aerial: ["cartwheel-clean"] }, working: ["s-cartwheel", "a-aerial", "split-r"] };
  const sk = GP.nextHtml(W.goalRow("s-cartwheel", ctx)); assert.match(sk, /How it's going<\/h3><button class="btn sm coral" onclick="gpGot\('s-cartwheel'\)">✓ Got it<\/button>/); assert.match(sk, /◔ Working on it <span class="small muted">· Solo<\/span>/); assert.match(sk, /Reach, look, place/);
  assert.match(GP.nextHtml(W.goalRow("s-cartwheel", { ...ctx, skills: { "s-cartwheel": { state: "clean" } } })), /gpGot\('s-cartwheel'\)">↩ Undo/); assert.doesNotMatch(GP.nextHtml(W.goalRow("s-cartwheel", { ...ctx, skills: { "s-cartwheel": { state: "checked" } } })), /gpGot/, "a teacher's check stays");
  const ae = GP.nextHtml(W.goalRow("a-aerial", ctx)); assert.match(ae, /What's next<\/h3><span class="chip sun">Step 2 of 17<\/span>/); assert.match(ae, /<div class="gp-bar"><i style="width:6%"><\/i><\/div>/); assert.match(ae, /<b>One-hand cartwheel on the FAR hand, 10 clean in a row<\/b><div class="small muted">Prerequisites<\/div>/);
  assert.match(ae, /How to do it/); assert.match(ae, /toggleAerial\('[a-z0-9-]+'\)">✓ Did it/); assert.match(ae, /Learned in Monday Acro with a spotter\. Mat under you for every drill\./, "the mission's own safety line");
  assert.match(GP.nextHtml(W.goalRow("a-aerial", { ...ctx, settings: { aerial: json("aerial").map(s => s.id) } })), /All 17 steps done 🎉[\s\S]*Every step is ticked/);
  const me = GP.nextHtml(W.goalRow("split-r", ctx)); assert.match(me, /▲ 12° since your first one/); assert.match(me, /After a warm-up, only as far as feels okay\./); assert.doesNotMatch(me, /180|%|Target|Next check-in|gpGot/);
  const ph = GP.measurePhotosHtml(W.goalRow("split-r", ctx)); assert.match(ph, /s1\.jpg[\s\S]*Before[\s\S]*s2\.jpg[\s\S]*Now/); assert.match(ph, /gpCheckIn\('split-r'\)">📷 Add a photo or video/); assert.match(ph, /the pose tool fills in the angle/);
  const none = GP.measurePhotosHtml(W.goalRow("split-l", ctx)); assert.match(none, /Take one now\./); assert.match(none, /gpCheckIn\('split-l'\)/);
  const tips = GP.coachTips({ r1: { trick: "Cartwheel", date: "2026-11-01", at: "2026-11-01T10:00:00Z", review: { fix: "Old tip" } }, r2: { trick: "Cartwheel", date: "2026-11-03", at: "2026-11-03T10:00:00Z", review: { fix: "New <tip>" } }, r3: { trick: "Leap", date: "2026-11-04", review: { fix: "Other" } }, r4: { trick: "Cartwheel", date: "2026-11-05", deleted: true, review: { fix: "Gone" } }, r5: { trick: "Cartwheel", date: "2026-11-06", review: {} } }, "Cartwheel");
  assert.deepEqual(tips.map(t => t.text), ["New <tip>", "Old tip"]);
  const co = GP.coachHtml(W.goalRow("s-cartwheel", ctx), tips); assert.match(co, /<b>Last time, [^:]+:<\/b> New &lt;tip&gt;/); assert.match(co, /openCoach\('solo','Cartwheel'\)">🎬 Coach me/); assert.match(co, /<summary>Older tips<\/summary>[\s\S]*Old tip/);
  const co0 = GP.coachHtml(W.goalRow("split-r", ctx), []); assert.match(co0, /one thing you did well and one thing to fix/); assert.match(co0, /openCoach\('','Right split'\)/); assert.doesNotMatch(co0, /Older tips/);
  assert.match(GP.footHtml({ id: "split-r", on: true }), /gpOn\('split-r', false\)">Take it off my goals/); assert.match(GP.footHtml({ id: "s-leap", on: false }), /gpOn\('s-leap', true\)">＋ Put it on my goals/);
});

test("📸 My album: her newest photo of every goal and of every skill she is learning or has got clean; photos first", () => {
  const ctx = { goals: split, photos, skills: { "s-cartwheel": { state: "learning" }, "s-leap": { state: "clean" }, "s-donut": { state: "checked" }, "s-calypso": {} }, settings: {}, working: ["a-aerial", "split-l", "s-cartwheel"] };
  const items = GP.albumItems(ctx);
  assert.deepEqual(items.map(i => i.id), ["a-aerial", "s-cartwheel", "split-r", "split-l", "s-leap", "s-donut"], "with a photo: her goals in her order, then the rest; then the ones with none yet");
  assert.ok(!items.some(i => i.id === "s-calypso"), "a skill she hasn't started is not in it");
  const by = Object.fromEntries(items.map(i => [i.id, i])); assert.deepEqual([by["s-cartwheel"].thumb, by["s-cartwheel"].count, by["s-cartwheel"].mark], ["c2.jpg", 2, "◔"]); assert.deepEqual([by["s-donut"].shiny, by["s-donut"].mark, by["s-leap"].mark, by["split-r"].mark], [true, "★", "◉", ""]);
  const html = GP.albumHtml(items); assert.doesNotMatch(html, /<h3>/, "the title and the count are on the fold (1.66.1)"); assert.equal((html.match(/class="alb-tile/g) || []).length, 6);
  assert.match(html, /<button class="alb-tile" onclick="goalOpen\('s-cartwheel'\)"><span class="alb-ph"><img src="c2\.jpg"[^>]*><\/span><span class="alb-cap">Cartwheel<small>◔ 2 photos<\/small>/); assert.match(html, /<button class="alb-tile shiny" onclick="goalOpen\('s-donut'\)"><span class="alb-ph">🌸<\/span><span class="alb-cap">Donut roll<small>★ no photo yet<\/small>/);
  const many = Array.from({ length: 12 }, (_, i) => ({ ...by["s-cartwheel"], id: "x" + i })); assert.equal((GP.albumHtml(many).match(/class="alb-tile/g) || []).length, GP.ALBUM_CAP); assert.match(GP.albumHtml(many), /albumAll\(\)">Show all 12/); assert.match(GP.albumHtml(many, { all: true }), /Show fewer/);
  assert.match(GP.albumHtml([]), /Your photos line up here\. Open a goal and add your first one\./);
});

test("in the page: picking, the aerial's step, got it, her own trick, off her goals: settings and the skill's own record only", async () => {
  resetDom(); clearS(); const writes = []; setBackend({ set: async (col, id) => { writes.push({ col, id }); }, del: async () => {} });
  try {
    S.settings = { working: [] }; W.renderWorking(); assert.match(el("#workingCard").innerHTML, /＋ Pick a goal/);
    const chip = el("#wkChip"); await window.wkToggle("a-aerial", chip); assert.deepEqual(S.settings.working, ["a-aerial"]); assert.equal(S.skills["a-aerial"].state, "learning"); assert.equal(chip.textContent, "⭐ 🦋 Aerial, step by step"); assert.match(el("#toast").textContent, /one of your goals/);
    await window.wkToggle("split-m", null); assert.deepEqual(S.settings.working, ["a-aerial", "split-m"]); assert.ok(!Object.keys(S.goals || {}).length, "a split on her goals writes no goal: that waits for her first check-in");
    await window.wkToggle("nope", null); assert.deepEqual(S.settings.working, ["a-aerial", "split-m"]);
    window.goalOpen("a-aerial"); assert.equal(el("#gpTitle").textContent, "🦋 Aerial"); assert.match(el("#gpNext").innerHTML, /Step 1 of 17/); assert.equal(el("#aerialFold").hidden, false); assert.match(el("#gpPhotos").innerHTML, /id="tcLineup"/); assert.match(el("#gpFoot").innerHTML, /Take it off my goals/);
    window.goalOpen("split-m"); assert.equal(el("#gpTitle").textContent, "🧘 Middle split"); assert.equal(el("#aerialFold").hidden, true, "the steps are the aerial's only"); assert.match(el("#gpPhotos").innerHTML, /gpCheckIn\('split-m'\)/); assert.match(el("#gpCoach").innerHTML, /openCoach\('','Middle split'\)/);
    el("#wkOwnName").value = "Lift"; el("#wkOwnDance").value = "trio"; await window.wkOwnAdd(); const own = S.settings.ownSkills[0]; assert.match(own.id, SK.OWN_RE); assert.deepEqual([own.n, own.dance], ["Lift", "trio"]); assert.equal(S.settings.working.at(-1), own.id); assert.equal(S.skills[own.id].state, "learning");
    el("#wkOwnName").value = "lift"; await window.wkOwnAdd(); assert.equal(S.settings.ownSkills.length, 1, "the same name twice is one trick"); el("#wkOwnName").value = "  "; await window.wkOwnAdd(); assert.equal(S.settings.ownSkills.length, 1);
    window.goalOpen(own.id); assert.equal(el("#gpTitle").textContent, "💃 Lift"); assert.match(el("#gpCoach").innerHTML, /openCoach\('trio','Lift'\)/);
    await window.gpGot(own.id); assert.equal(S.skills[own.id].state, "clean"); assert.match(el("#gpNext").innerHTML, /↩ Undo/); await window.gpGot(own.id); assert.equal(S.skills[own.id].state, "learning");
    S.skills["s-donut"] = { id: "s-donut", state: "checked", teacher: "Miss A" }; await window.gpGot("s-donut"); assert.equal(S.skills["s-donut"].state, "checked", "a teacher's check stays");
    await window.gpOn("split-m", false); assert.deepEqual(S.settings.working, ["a-aerial", own.id]); assert.match(el("#toast").textContent, /Off your goals/);
    await window.gpOn("s-leap", true); assert.equal(S.settings.working.at(-1), "s-leap"); assert.equal(S.skills["s-leap"].state, "learning");
    for (const id of ["s-side-sit", "s-calypso", "split-r", "split-l", "bridge"]) await window.wkToggle(id, null);
    assert.equal(S.settings.working.length, 8); await window.wkToggle("s-floor-kick", null); assert.equal(S.settings.working.length, 8, "eight is the most"); assert.match(el("#toast").textContent, /Your list is full/);
    GP.renderAlbum(); assert.match(el("#albumCard").innerHTML, /goalOpen\('a-aerial'\)/); assert.equal(el("#albumCount").textContent, "9", "her eight goals and the teacher-checked donut roll"); assert.equal(el("#workingCount").textContent, "8");
    assert.ok(writes.every(w => w.col === "settings" || w.col === "skills"), "nothing else is written");
  } finally { setBackend(null); resetDom(); clearS(); }
});

test("the pages, the ways in, the words and the release", () => {
  const html = src("index.html"), sk = html.slice(html.indexOf('id="p-skills"'), html.indexOf('id="p-goal"')), gp = html.slice(html.indexOf('id="p-goal"'), html.indexOf('id="p-practice"'));
  assert.match(sk, /<details class="card acc sun work-card" id="workingFold" open><summary>⭐ My goals <span class="chip sun" id="workingCount"><\/span><\/summary><div id="workingCard"><\/div><\/details>\s*<details class="card acc violet album-card" id="albumFold" open><summary>📸 My album <span class="chip violet" id="albumCount"><\/span><\/summary><div id="albumCard"><\/div><\/details>\s*<details class="card acc violet" id="allSkills"><summary>📚 All skills<\/summary>/, "1.66.1: her goals and her album fold too, open to start");
  assert.deepEqual((sk.match(/<summary>[^<]+/g) || []).map(s => s.replace("<summary>", "").trim()), ["⭐ My goals", "📸 My album", "📚 All skills", "🩰 My classes", "📎 Drill box", "🛟 Safety rules"], "every card on Skills folds (the classes inside All skills)");
  assert.match(src("js/app.js"), /initNav\(\); initSkillsFolds\(\);/); assert.match(src("js/news.js"), /scroll: "#workingFold"/);
  assert.match(gp, /onclick="showPage\('skills'\)">‹ My goals<\/button><h2 class="grow" style="margin:0" id="gpTitle">/); const order = ["gpNext", "aerialFold", "gpPhotos", "gpCoach", "gpFoot"]; for (let i = 1; i < order.length; i++) assert.ok(gp.indexOf(`id="${order[i - 1]}"`) < gp.indexOf(`id="${order[i]}"`), order[i - 1] + " before " + order[i]);
  assert.match(src("js/nav.js"), /if \(p === "goal"\) return "skills";/); assert.match(src("js/app.js"), /renders\.push\(guard\("goalpage", \(\) => \{ renderAlbum\(\); renderGoalPage\(\); \}\)\)/); assert.match(src("sw.js"), /"\.\/js\/working\.js", "\.\/js\/goalpage\.js"/);
  for (const [f, re] of [["js/views/me.js", /class="skill-cam" onclick="goalOpen\('\$\{sk\.id\}'\)"/], ["js/views/dances.js", /class="fixchip" onclick="goalOpen\('\$\{t\.id\}'\)"/], ["js/goals.js", /class="skill" onclick="goalOpen\('\$\{k\}'\)"/], ["js/buddy.js", /showPage\('skills'\);buddyScroll\('#albumFold'\)/]]) assert.match(src(f), re, f + " lands on the goal's page or the album");
  assert.doesNotMatch(src("js/views/me.js") + src("js/views/dances.js") + src("js/buddy.js") + html, /openCards\(/, "nothing on a page opens the old binder");
  const pass = json("pass"), grab = pass.parts.find(p => p.id === "grab").lines.join(" ");
  assert.match(grab, /⭐ My goals is on top\. Tap ＋ Pick a goal to choose\./); assert.match(grab, /📷 Add a photo puts a picture in 📸 My album\./); assert.match(grab, /On a goal's page tap 🎬 Coach me/); assert.ok(pass.tips.some(t => t.t === "⭐ My goals is on the Skills tab. You pick them."));
  assert.doesNotMatch(JSON.stringify(pass) + JSON.stringify(json("news")) + JSON.stringify(json("buddy")), /My skill this month|I'm working on|trick cards|Pick a skill/);
  assert.match(src("js/version.js"), /APP_VERSION = "1\.(66\.[1-9]|6[7-9]|[7-9]\d)/); assert.match(src("README.md"), /\*\*1\.66\.0: ⭐ My goals, one page for every goal, 📸 My album\*\*/);
});
