// The spring plan (data/plan-spring.json, 1.46.0): 23 weeks from Jan 11 to the Glass House Ball, read by season15.js once
// the 15-week plan is over; every comp gets a taper week before it and a judges' week after it; the judges' feedback items
// on the daily plan, their tool buttons, the judges' audio clips (schema 48).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installEnv } from "./_env.mjs";
installEnv();
const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8"); const json = (n) => JSON.parse(read("data/" + n + ".json"));
const data = await import("../js/data.js"); const { applyData, DATA_FILES } = data;
const got = {}; for (const f of DATA_FILES) got[f] = json(f); applyData(got);
const PLAN15 = data.PLAN15, PLAN_SPRING = data.PLAN_SPRING; // read after applyData: the live bindings, not the empty defaults
const { activePlan, weekOf, sessionRules, checkpoints, trickFocus, memoryKnees } = await import("../js/season15.js");
const { buildPlan } = await import("../js/plan.js");
const { judgesFor } = await import("../js/planToday.js");
const { toolsFor } = await import("../js/pmode.js");
const { migrateDoc, SCHEMA_VERSION } = await import("../js/store.js");
const plan = json("plan-spring"); const events = json("events");
const iso = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const addDays = (s, n) => { const d = new Date(s + "T00:00:00"); d.setDate(d.getDate() + n); return iso(d); };
const weekday = (s) => new Date(s + "T00:00:00").getDay();

test("23 Monday-to-Sunday weeks from Jan 11, 2027 to Jun 20; seven phases covering every week; dated checkpoints in order; the rules the loop needs", () => {
  assert.equal(plan.start, "2027-01-11"); assert.equal(weekday(plan.start), 1); assert.equal(plan.weeks.length, 23);
  plan.weeks.forEach((w, i) => { assert.equal(w.w, i + 1); assert.equal(w.of, addDays(plan.start, 7 * i), "week " + w.w); for (const k of ["solo", "trio", "fri"]) assert.ok(typeof w[k] === "string" && w[k].length, `week ${w.w} ${k}`); if (w.judges) assert.ok(typeof w.judges === "string" && w.judges.length); });
  assert.equal(addDays(plan.weeks[22].of, 6), "2027-06-20", "the last week ends on the Ball's Sunday");
  let next = 1; for (const p of plan.phases) { assert.equal(p.from, next, p.n); assert.ok(p.to >= p.from); assert.ok(p.d && p.g, p.n); next = p.to + 1; } assert.equal(next, 24, "the phases cover weeks 1–23 with no gap");
  const ds = plan.checkpoints.map(c => c.d); for (let i = 0; i < ds.length; i++) { assert.match(ds[i], /^2027-\d\d-\d\d$/); assert.ok(ds[i] >= plan.start && ds[i] <= "2027-06-20", ds[i]); if (i) assert.ok(ds[i] >= ds[i - 1], "checkpoints in date order at " + ds[i]); }
  assert.ok(plan.rules.judges && /listen with a grown-up/.test(plan.rules.judges.solo) && /write/i.test(plan.rules.judges.trio) && plan.rules.judges.how);
  assert.equal(plan.rules.studioDays["1"], "watch", "Monday stays a watching day"); assert.equal(plan.rules.maxGap, 2); assert.equal(plan.rules.fullOut.from, plan.start, "one full-out a session from day one");
  assert.ok(!("memoryKneesUntil" in plan) && !("showDay" in plan), "the solo is long memorized; comps are dated checkpoints, not one show day");
});

test("every comp has a taper week before it and a judges' week after it; the nights before each comp, the auditions and the Ball are on the list", () => {
  const comps = events.filter(e => /compet|showcase/i.test(e.type || "") && !/convention only/i.test(e.type || "") && e.start >= plan.start);
  assert.ok(comps.length >= 6, "the spring comps are in events.json: " + comps.map(e => e.name).join(", "));
  for (const e of comps) {
    const wk = weekOf(e.start, plan); assert.ok(wk, e.name); assert.equal(wk.taper, true, `${e.name}: the week it starts (week ${wk.w}) tapers`); assert.match(wk.fri, /nothing new/i, e.name);
    const after = plan.weeks[wk.w]; if (after) { assert.ok(after.judges, `${e.name}: week ${after.w} starts with the judges' feedback`); assert.ok(new RegExp(e.name.split(" ")[0]).test(after.judges), `${e.name} → ${after.judges}`); }
    assert.ok(plan.rules.nightBefore.includes(addDays(e.start, -1)), `${e.name}: the night before is on the list`);
    assert.ok(plan.checkpoints.some(c => c.d === e.start && /★/.test(c.t)), `${e.name}: a ★ checkpoint on its first day`);
  }
  const aud = events.find(e => /audition/i.test(e.name)); assert.ok(plan.rules.nightBefore.includes(addDays(aud.start, -1)) && weekOf(aud.start, plan).taper, "auditions: an easy week and no full-out the night before");
  for (const d of plan.rules.nightBefore) assert.ok(events.some(e => addDays(e.start, -1) === d), d + " is the night before something in events.json");
  for (const w of plan.weeks.filter(w => w.light)) { assert.match(w.fri, /rest/i, "light week " + w.w); } assert.ok(plan.weeks.some(w => w.light && /spring break/i.test(w.extra || "")), "spring break is a light week");
});

test("the engine switches plans by date: the Showcase plan through Jan 10, the spring plan from Jan 11, nothing after the Ball", () => {
  assert.equal(activePlan("2026-10-29"), PLAN15); assert.equal(weekOf("2027-01-10").w, 15); assert.equal(activePlan("2027-01-10"), PLAN15);
  assert.equal(activePlan("2027-01-11"), PLAN_SPRING); const w1 = weekOf("2027-01-11"); assert.equal(w1.w, 1); assert.equal(w1.total, 23); assert.equal(w1.phase.n, "After the Showcase"); assert.equal(w1.to, "2027-01-17");
  assert.equal(weekOf("2027-06-20").w, 23); assert.equal(weekOf("2027-06-21"), null, "the card goes quiet after the Ball"); assert.equal(weekOf("2027-03-17").phase.n, "The long stretch");
  assert.equal(memoryKnees("2027-02-01"), false); assert.equal(memoryKnees("2026-11-01"), true, "the old gate still works on its own dates");
  assert.deepEqual(trickFocus("2027-02-03"), { kind: "weakest" }); assert.deepEqual(trickFocus("2027-01-20"), { kind: "none" }, "a taper week: nothing new"); assert.deepEqual(trickFocus("2027-04-14"), { kind: "rest" }, "spring break");
  const cps = checkpoints("2027-01-11"); assert.equal(cps[0].d, "2027-01-22"); assert.match(cps[0].t, /Hollywood Connection ★/); assert.equal(checkpoints("2027-06-18")[0].t, "Glass House Ball ★"); assert.equal(checkpoints("2027-06-21").length, 0);
  assert.equal(checkpoints("2026-12-01")[0].t, "Mandatory rehearsal (back from break)", "before Jan 11 the Showcase plan's checkpoints");
});

test("session rules on the spring plan: taper weeks, the night before a comp, the Sunday pair outside tapers, imagery from day one, the judges' week", () => {
  const s20 = sessionRules("2027-01-20"); assert.equal(s20.taper, true); assert.ok(s20.imagery && s20.imagery.title.includes("Show in your head")); assert.ok(!s20.imagery.how.includes("grown-up reads"), "she does it herself now");
  assert.equal(sessionRules("2027-01-21").nightBefore, true); assert.equal(sessionRules("2027-01-21").short, true, "the night before Hollywood Connection: the memory run");
  assert.match(sessionRules("2027-01-24").run.text, /ONE full-out/, "Sunday of a taper week: one full-out, not the pair"); assert.match(sessionRules("2027-02-07").run.text, /Back-to-back/, "a normal Sunday: the pair");
  assert.ok(sessionRules("2027-02-07").review && /Sunday film review/.test(sessionRules("2027-02-07").review.text)); assert.equal(sessionRules("2027-02-09").review, null);
  assert.equal(sessionRules("2027-03-16").short, true, "the light week after Gravit8"); assert.equal(sessionRules("2027-04-13").short, true, "spring break");
  const j = sessionRules("2027-01-25").judges; assert.equal(j.comp, "Hollywood Connection"); assert.match(j.solo, /Judges' feedback: solo/); assert.match(j.trio, /trio/); assert.equal(j.secs, 300); assert.ok(j.how.includes("twice"));
  assert.equal(sessionRules("2027-02-01").judges, null); assert.equal(sessionRules("2027-02-22").judges.comp, "Ryze Seattle"); assert.equal(sessionRules("2026-12-01").judges, null, "the Showcase plan has no judges' weeks");
  assert.equal(sessionRules("2026-12-30").taper, true, "the old taper rule (from Dec 28) still applies");
});

test("the daily plan in a judges' week opens with the two 🎧 items, each until it is ticked once that week; the tools are the audio and the note box", () => {
  const base = { pool: json("practice-pool"), tricks: [], aerial: [], aerialDone: [], dances: [{ id: "solo" }, { id: "trio" }], mode: "learn", short: "", focus: null, newNotes: [] };
  const rules = sessionRules("2027-01-26");
  let items = buildPlan({ ...base, date: "2027-01-26", session: { ...rules, judges: judgesFor("2027-01-26", rules, {}) } });
  assert.deepEqual(items.slice(0, 2).map(i => i.id), ["judges-solo", "judges-trio"]); assert.equal(items[0].kind, "listen"); assert.equal(items[0].dance, "solo"); assert.equal(items[1].dance, "trio"); assert.ok(items[0].how.includes("twice")); assert.equal(items[0].secs, 300);
  items = buildPlan({ ...base, date: "2027-01-26", session: { ...rules, judges: judgesFor("2027-01-26", rules, { "2027-01-25": { done: ["judges-solo"] } }) } });
  assert.deepEqual(items.filter(i => i.kind === "listen").map(i => i.id), ["judges-trio"], "the solo one was ticked on Monday");
  items = buildPlan({ ...base, date: "2027-01-26", session: { ...rules, judges: judgesFor("2027-01-26", rules, { "2027-01-25": { done: ["judges-solo", "judges-trio"] } }) } });
  assert.equal(items.filter(i => i.kind === "listen").length, 0, "both done: back to the usual plan");
  assert.equal(judgesFor("2027-01-26", rules, { "2027-01-18": { done: ["judges-solo"] } }).soloDone, false, "a tick from an earlier week doesn't count");
  assert.equal(judgesFor("2027-02-02", sessionRules("2027-02-02"), {}), null, "not a judges' week");
  const t = toolsFor({ id: "judges-solo", dance: "solo" }); assert.deepEqual(t.map(x => x.label), ["🎧 Judges' audio", "📝 Write the fixes"]); assert.ok(t[0].go.includes("judgesOpen('solo')") && t[1].go.includes("noteOpen('solo')"));
  assert.ok(toolsFor({ id: "judges-trio", dance: "trio" })[1].go.includes("noteOpen('trio')"));
  const studio = buildPlan({ ...base, date: "2027-01-26", short: "memory", session: { ...rules, judges: judgesFor("2027-01-26", rules, {}) } }); assert.deepEqual(studio.slice(0, 3).map(i => i.id), ["judges-solo", "judges-trio", "mem-warm"], "a studio day: the judges first, then the short plan");
  const monday = buildPlan({ ...base, date: "2027-01-25", short: "watch", session: { ...sessionRules("2027-01-25"), judges: judgesFor("2027-01-25", sessionRules("2027-01-25"), {}) } }); assert.deepEqual(monday.slice(0, 3).map(i => i.id), ["judges-solo", "judges-trio", "watch-walk"], "the Monday after a comp starts with the judges");
  assert.equal(buildPlan({ ...base, date: "2027-02-02", short: "memory", session: sessionRules("2027-02-02") })[0].id, "mem-warm", "other weeks: the short plan as before");
});

test("the audition weeks: the panel teaches on the day, so full days add the pick-up drill and improv, the night before stays the memory run, and nothing is filmed for the panel", () => {
  const w20 = weekOf("2027-05-25", plan), w21 = weekOf("2027-06-02", plan); assert.ok(w20.audition && w21.audition && w21.taper && !weekOf("2027-05-18", plan).audition, "weeks 20–21 are the audition weeks, 21 the easy one");
  assert.ok(!/clean on film/i.test(w20.solo + w20.trio + w21.solo + plan.phases[5].g), "the dances aren't asked clean on film for the panel"); assert.match(plan.phases[5].g, /combos taught on the day/); assert.match(json("phases")[9].g, /combos taught on the day/);
  assert.ok(!plan.checkpoints.some(c => /clean on film for Ms\. Brittany/i.test(c.t))); assert.ok(plan.checkpoints.some(c => c.d === "2027-05-26" && /audition panel/.test(c.t)));
  const s = sessionRules("2027-05-25"); assert.ok(s.audition && /8 counts/.test(s.audition.pickup.text) && s.audition.pickup.how.includes("phone down") && s.audition.pickup.secs === 180 && /2 minutes/.test(s.audition.improv.text) && s.audition.improv.secs === 120);
  assert.equal(sessionRules("2027-05-18").audition, null, "the judges' week after Showstopper is not an audition week"); assert.equal(sessionRules("2027-06-08").audition, null, "the Ball weeks aren't either");
  const base = { pool: json("practice-pool"), tricks: ["Calypso"], aerial: [], aerialDone: [], dances: [{ id: "solo" }, { id: "trio" }], mode: "learn", short: "", focus: null, newNotes: [] };
  const items = buildPlan({ ...base, date: "2027-05-25", session: sessionRules("2027-05-25") }); const ids = items.map(i => i.id);
  assert.ok(ids.includes("aud-pickup") && ids.includes("aud-improv"), "a full day in week 20 has both drills"); assert.ok(ids.indexOf("aud-pickup") < ids.indexOf("aud-improv") && ids.indexOf("aud-improv") < ids.indexOf("solo-run") && ids.indexOf("aud-pickup") > 0, "after the warm-up, before the solo run");
  assert.equal(items.find(i => i.id === "aud-improv").kind, "improv"); assert.equal(items.find(i => i.id === "aud-pickup").kind, "mind");
  const nb = buildPlan({ ...base, date: "2027-06-03", short: "memory", nightBefore: true, session: sessionRules("2027-06-03") }); assert.ok(!nb.some(i => i.id.startsWith("aud-")) && nb[0].id === "mem-warm", "the night before the auditions: the memory run only");
  assert.ok(!buildPlan({ ...base, date: "2027-05-18", session: sessionRules("2027-05-18") }).some(i => i.id.startsWith("aud-")), "not in the judges' week");
  assert.ok(read("js/pmode.js").includes('improv:"💃"')); assert.match(read("README.md"), /Audition weeks/); assert.match(read("js/version.js"), /APP_VERSION = "1\.(46\.[1-9]|4[7-9]|[5-9]\d)/);
});

test("schema 48: judgesClips on a dance — https media refs only, short names, a comp and a day, at most 10; the card's audio section and the phases list", () => {
  assert.ok(SCHEMA_VERSION >= 48);
  const d = migrateDoc("dances", "solo", { _v: 47, judgesClips: [{ url: "https://x/a.mp3", path: "families/f/music/j1", name: "n".repeat(100), at: "2027-01-25", comp: "Hollywood Connection" }, { url: "nope" }, null, { url: "https://x/b.mp3", path: "p2" }] });
  assert.equal(d.judgesClips.length, 2); assert.equal(d.judgesClips[0].name.length, 60); assert.equal(d.judgesClips[0].at, "2027-01-25"); assert.equal(d.judgesClips[0].comp, "Hollywood Connection"); assert.deepEqual(Object.keys(d.judgesClips[1]).sort(), ["path", "url"]);
  assert.equal(migrateDoc("dances", "solo", { _v: 47, judgesClips: Array.from({ length: 14 }, (_, i) => ({ url: "https://x/" + i, path: "p" + i })) }).judgesClips.length, 10);
  assert.equal("judgesClips" in migrateDoc("dances", "trio", { _v: 47 }), false);
  const src = read("js/views/dances.js"); for (const s of ["judgesHtml(", "async function addJudgesClip(", "function judgesOpen(", "judgesClips", "media.upload(\"music\""]) assert.ok(src.includes(s), s);
  assert.ok(read("js/views/dances.js").includes("expose({ lyricsFromNotes, addJudgesClip, delJudgesClip, judgesOpen })"));
  const ph = json("phases"); assert.deepEqual(ph.slice(4).map(p => p.n), plan.phases.map(p => p.n), "the spring phases follow the four Showcase phases"); assert.ok(!ph.some(p => p.n === "January comps"));
  assert.ok(read("sw.js").includes("./data/plan-spring.json")); assert.ok(DATA_FILES.includes("plan-spring")); assert.ok(read("README.md").includes("judges' week")); assert.ok(/APP_VERSION = "1\.(4[6-9]|[5-9]\d)/.test(read("js/version.js")));
});
