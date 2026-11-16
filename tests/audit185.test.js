// 1.85.0 (Jenya, Nov 16: a critical review of design and function; what to do next should be easy to follow, "either
// practice one of the competitive dances or to work on a specific dance skill", with "regular reminders to take beginning
// pictures for skills and regular progress pictures"). 👉 next up on one thing, the picture prompt inside Today's card,
// 📸 Picture day in the phone reminder, one tap to the camera for every goal, Back inside Dances and Play.
// Reads files and pure functions only: every date is passed in.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installEnv } from "./_env.mjs";
installEnv();
const json = (f) => JSON.parse(readFileSync(new URL("../data/" + f + ".json", import.meta.url), "utf8"));
const src = (f) => readFileSync(new URL("../" + f, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const { applyData, DATA_FILES } = await import("../js/data.js");
const got = {}; for (const f of DATA_FILES) got[f] = json(f); applyData(got);
const H = await import("../js/views/home.js");
const W = await import("../js/working.js");
const WI = await import("../js/wisdom.js");

test("👉 next up: one thing wears the tag: a dance first, then the skill, then nothing", () => {
  assert.equal(H.nextUp({}), "solo", "nothing danced ever: the solo");
  assert.equal(H.nextUp({ lastSolo: "2026-11-15", lastTrio: "2026-11-10" }), "trio", "the one she danced longest ago");
  assert.equal(H.nextUp({ lastSolo: "2026-11-15" }), "trio", "never danced comes before danced");
  assert.equal(H.nextUp({ solo: true, skill: true }), "skill", "one dance done: the skill");
  assert.equal(H.nextUp({ solo: true, skill: true, skillDone: true }), "trio"); assert.equal(H.nextUp({ trio: true }), "solo");
  assert.equal(H.nextUp({ solo: true, trio: true, skill: true }), "skill"); assert.equal(H.nextUp({ solo: true, trio: true, skill: true, skillDone: true }), "", "all done: no tag");
  assert.equal(H.nextUp({ kind: "show" }), "", "never on a show day");
  assert.equal(H.lastRun({ "2026-11-10": { runs: [{ danceId: "trio" }] }, "2026-11-12": { runs: [{}] }, "2026-11-14": { runs: [{ danceId: "solo" }] } }, "solo"), "2026-11-14", "a run with no dance is the solo's");
  assert.equal(H.lastRun({}, "trio"), "");
  const b = H.danceButtons({ kind: "home", next: "trio" }); assert.match(b, /▶ My trio<small class="nx-tag">👉 next up<\/small>/); assert.doesNotMatch(b, /My solo<small/);
  assert.doesNotMatch(H.danceButtons({ kind: "home", trio: true, next: "trio" }), /nx-tag/, "a danced one never wears it");
  assert.equal(H.danceButtons({ kind: "home" }), H.danceButtons({ kind: "home", next: "" }));
  const r = { id: "split-r", n: "Right split", ic: "🦵", shots: [], sub: "", how: "" };
  assert.match(W.todaySkillHtml(r, { next: true }), /Right split <small class="nx-tag">👉 next up/); assert.doesNotMatch(W.todaySkillHtml(r, {}), /nx-tag/);
});

test("Today's card: the two choices first, the picture prompt right under the skill, the rest below", () => {
  const home = src("js/views/home.js"); const card = home.slice(home.indexOf('$("#todayCard").innerHTML='), home.indexOf("// The dated line from plan10"));
  const at = (s) => { const i = card.indexOf(s); assert.ok(i >= 0, s); return i; };
  const order = ["${danceButtons(", "groupButtonsHtml(", "${skillPick}", 'id="goalReminder"', "${focus}", "Not sure of the steps?", "${metaLine(", "today-tip", "${sessionLink(", "Log studio work"];
  for (let i = 1; i < order.length; i++) assert.ok(at(order[i - 1]) < at(order[i]), `${order[i - 1]} before ${order[i]}`);
  assert.doesNotMatch(card, /· \$\{dayKind\}/, "the kind of day is said once");
  assert.match(home, /const didOne=pd\|\|td\|\|\(\(rec&&rec\.runs\)\|\|\[\]\)\.length>0\|\|\(\(rec&&rec\.skills\)\|\|\[\]\)\.length>0;/, "a group dance or a skill is her one thing too");
  assert.match(H.metaLine({ days: 0, dances: 2 }), /🎵 2 dances/, "a group dance counts before her first solo or trio day");
  assert.match(H.sessionLink({ kind: "home", mins: 40, total: 15 }), /onclick="openPracticeMode\(\)"/, "the session opens over Today, so ✕ comes back to Today");
  assert.doesNotMatch(W.groupButtonsHtml([{ id: "pitch-jazz", n: "Jazz" }], [], { how: false }), /tg-how/); assert.match(W.groupButtonsHtml([{ id: "pitch-jazz", n: "Jazz" }]), /tg-how/);
  assert.doesNotMatch(src("index.html"), /id="photoFold"/, "no second, folded Picture time under the card");
  assert.match(src("js/working.js"), /classList\.toggle\("has-news", prompts\.length > 0\)/, "a dot on Skills while a picture is due");
});

test("📸 Picture day: the phone reminder leads with the picture on a home day it is due", () => {
  const base = ["Dance time 🎵", "Solo once, trio once: about 5 minutes. 💬 Slow is how clean happens."];
  const first = WI.pictureMsg(base, { n: "Aerial", why: "first" }, 3); assert.equal(first[0], "Picture day 📸"); assert.match(first[1], /^Take your starting picture of your Aerial \(＋3 more\)\. Then dance one thing\. 💬 Slow is how clean happens\.$/);
  assert.match(WI.pictureMsg(base, { n: "Left split", why: "again" })[1], /^Time for a new picture of your Left split: see how far you've come\./);
  const long = WI.pictureMsg(["x", "y 💬 " + "z".repeat(160)], { n: "Aerial", why: "first" }); assert.ok(long[1].length <= 170 && !long[1].includes("💬"), "the tip goes when the line would not fit the worker's 170");
  assert.deepEqual(WI.pictureMsg(base, null), base);
  const msgs = { "2026-11-19": base, "2026-11-20": base, "2026-11-21": ["Class day 🏫", "After class…"] };
  const out = WI.withPictures(msgs, (d) => d === "2026-11-21" ? "studio" : "home", (d) => d === "2026-11-20" ? [] : [{ n: "Aerial", why: "first" }]);
  assert.equal(out["2026-11-19"][0], "Picture day 📸"); assert.deepEqual(out["2026-11-20"], base, "nothing due: the day's own words"); assert.deepEqual(out["2026-11-21"], msgs["2026-11-21"], "a class day keeps its words");
  assert.deepEqual(msgs["2026-11-19"], base, "pure");
  const rm = src("js/remind.js"); assert.match(rm, /msgs = picturedMsgs\(\) \}\)\{/); assert.match(rm, /todayStr\(\), pics\]\)/, "the pictures due are part of what was last sent");
  assert.doesNotMatch(rm, /from "\.\/working\.js"/, "no module loop: app.js hands the prompts over"); assert.match(src("js/app.js"), /setPicturePrompts\(\(d\) => photoPrompts\(STORE\.settings, d\)\)/);
  const sw = src("sw.js"); assert.match(sw, /"\.\/#pictures"/); assert.match(sw, /postMessage\(\{ type: "OPEN_PICTURES" \}\)/);
});

test("pictures: one tap for every goal, saved when the sheet closes, Start on the first one", () => {
  const g = src("js/goals.js"); assert.match(g, /if \(pendingFile && open && !saving\) doCheckIn\(open, false\);/, "a picked picture is not dropped on Close"); assert.match(g, /goalQuickPhoto: quickPhoto/);
  assert.doesNotMatch(g, /Checked in ✓|No check-ins yet|Next check-in/, "her words: saved, pictures");
  for (const f of ["js/goals.js", "js/lineup.js"]) assert.doesNotMatch(src(f), /from "\.\/remind\.js"/, f + ": no module loop");
  const p = W.photoPromptHtml({ id: "goal:abc", n: "Scorpion", ic: "⭐", kind: "measure", why: "first" }); assert.match(p, /onchange="goalQuickPhoto\('abc', this\)"/, "her own goal goes by its document id");
  const l = src("js/lineup.js"); assert.match(l, /if \(fresh && fn\) L\.vs = true;/); assert.match(l, /\$\{i === 0 \? " start" : ""\}/);
  const GP = src("js/goalpage.js"); assert.match(GP, /home \? "‹ Today" : other \? "‹ Back" : "‹ My goals"/); assert.match(GP, /confirm\("Take it off your goals\?/);
});

test("Back inside a page closes what is open there; the repeat-note row shows the note first", () => {
  const nav = src("js/nav.js"); assert.match(nav, /export function onBack\(fn\)/); assert.match(nav, /#gameWrap\.on/);
  assert.match(src("js/views/dances.js"), /onBack\(\(\)=>\{ if\(navPage\(\)==="dances"&&openDance&&!editDance\)\{ danceOpen\(null\); return true; \}/);
  assert.match(src("js/views/play.js"), /onBack\(\(\) => \{ if \(navPage\(\) === "play" && openGame\) \{ playOpen\(""\); return true; \}/);
  for (const f of ["js/views/dances.js", "js/views/me.js"]) { const s = src(f); assert.match(s, /!c\.pinned/, f); assert.match(s, /showMe\('\$\{open\.id\}'\)">Show me</, f); }
  assert.match(src("js/showme.js"), /const clash = !!c && tag === "knees"/, "a note that asks for a bend shows no straight-knee picture");
  const sl = src("js/studiolog.js"); for (const w of ["Dances I did", "Skills I did", "How did it feel?", ">No class<"]) assert.ok(sl.includes(w), w);
  assert.match(sl, /if \(!date && !classDay\(today\) && !hasLog\(studioRec\(S\.practice, today\)\)\) date = nudgeDays\(S\.practice, today, classDay\)\[0\];/);
  assert.doesNotMatch(src("css/app.css"), /font-family:Fredoka[;}]/, "every heading has a fallback font");
});

test("skills in her solo, trio, jazz and contemporary: her own skills belong to a dance, grouped by it, with a way in from the dance", async () => {
  const SK = await import("../js/skills.js");
  assert.deepEqual(SK.OWN_DANCES, { solo: "Solo", trio: "Trio", "pitch-jazz": "Jazz", "pitch-contemp": "Contemporary" });
  const settings = { ownSkills: [{ id: "own-jazz0001", n: "Double pirouette", dance: "pitch-jazz" }, { id: "own-cont0001", n: "Floor roll", dance: "pitch-contemp" }, { id: "own-trio0001", n: "Lift", dance: "trio" }, { id: "own-none0001", n: "Toe touch", dance: "nope" }] };
  assert.deepEqual(SK.ownSkills(settings).map(o => o.dance), ["pitch-jazz", "pitch-contemp", "trio", ""]);
  assert.equal(W.ownSkillDoc("Turn", "pitch-jazz", "own-abcd1234").dance, "pitch-jazz"); assert.equal(W.ownSkillDoc("Turn", "ballet", "own-abcd1234").dance, "");
  const row = (dance, n) => ({ id: "x" + n, n, ic: "💃", group: "dances", dance, how: "Working on it", shots: [] });
  const card = W.goalsCardHtml([row("pitch-contemp", "Floor roll"), row("solo", "Cartwheel"), row("pitch-jazz", "Turn"), row("trio", "Lift"), row("", "Toe touch")]);
  const at = (s) => card.indexOf(s); for (const [a, b] of [['g-dance">Solo', 'g-dance">Trio'], ['g-dance">Trio', 'g-dance">Jazz'], ['g-dance">Jazz', 'g-dance">Contemporary'], ['g-dance">Contemporary', 'g-dance">Other']]) assert.ok(at(a) >= 0 && at(a) < at(b), a + " before " + b);
  const g = W.pickGroups({ working: [], settings: {}, goals: {}, skills: {} })[0]; assert.deepEqual(g.parts.map(p => p.label), ["🌸 Solo tricks", "💃 Trio", "💃 Jazz", "💃 Contemporary"]); assert.match(g.parts[3].empty, /No Contemporary skills yet/); assert.match(g.parts[1].empty, /No Trio skills yet/);
  // The jazz group's skills ship with the app (data/skills.json dances["pitch-jazz"], from the Nov 16 review of one run).
  const jz = json("skills").dances["pitch-jazz"]; assert.equal(jz.skills.length, 13); assert.equal(jz.skills.filter(x => x.top).length, 5); assert.match(jz.from, /Your teacher's notes come first/);
  for (const x of jz.skills) { assert.match(x.id, /^pj-[a-z-]+$/); assert.ok(x.n && x.t && x.tip && x.drill, x.id); assert.ok(x.tip.length <= 90, x.id + ": one short cue"); }
  assert.equal(new Set([...jz.skills.map(x => x.id), ...Object.values(json("skills").styles).flatMap(st => st.skills.map(x => x.id))]).size, 13 + Object.values(json("skills").styles).reduce((a, st) => a + st.skills.length, 0), "ids are unique across every list");
  assert.equal(g.parts[2].items.length, 13); assert.equal(g.parts[2].items[0].n, "⭐ Seated scissor kicks");
  const f = SK.findSkill("pj-left-turn"); assert.deepEqual([f.style, f.dance, f.t], ["own", "pitch-jazz", "1:13"]);
  const r = W.goalRow("pj-scissor-kicks", { goals: {}, skills: {}, photos: {}, reviews: {}, settings: { working: ["pj-scissor-kicks"] } }); assert.deepEqual([r.group, r.dance, r.where], ["dances", "pitch-jazz", "Jazz · 1:48"]);
  const how = W.goalHow(r); assert.match(how[0], /Straight knees first/); assert.match(how[1], /2 counts each leg/); assert.match(how[2], /once with the music/);
  assert.equal(SK.allSkills().some(x => x.id.startsWith("pj-")), false, "not in a ring or the trick-card binder");
  const d = src("js/views/dances.js"); assert.match(d, /wkPick\('\$\{d\.id\}'\)">＋ Add a skill</); assert.match(d, /ownSkills\(\)\.filter\(o=>o\.dance===d\.id\)/);
});
