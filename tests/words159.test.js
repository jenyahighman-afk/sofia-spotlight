// 1.59.5: Sofia's words on the Pass and the Toolkit (Jenya, Nov 2). The Pass's headings a 9-year-old would stop at are plain
// now, on paper and in the app; the last phase is "Rest up" everywhere she reads it (rules.taper and week.taper stay: code,
// not words); the Toolkit's "mini audience", "focal points" and "stamina" are gone from its pages.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installEnv } from "./_env.mjs";
installEnv();
const json = (f) => JSON.parse(readFileSync(new URL("../data/" + f + ".json", import.meta.url), "utf8"));
const src = (f) => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const { applyData, DATA_FILES } = await import("../js/data.js");
const got = {}; for (const f of DATA_FILES) got[f] = json(f); applyData(got);
const { momWeekLines } = await import("../js/momweek.js");
// What the page shows: no comments, no <style>, no tags.
const shown = (html) => html.replace(/<!--[\s\S]*?-->/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

test("the printed Pass: the plain headings, and none of the old words", () => {
  const t = shown(src("tools/print/Sofia-Backstage-Pass.html"));
  for (const s of ["Rest up", "How you get there", "Ways to fit it all in", "When to use screens", "Food for dancing", "Eat again", "Grow strong", "Your body does all your dancing", "rest-up days are rest on purpose", "your biggest, best dancing", "Show your family at home", "or extra class", "easier than making yourself do it", "updated Nov 2"]) assert.ok(t.includes(s), s);
  assert.doesNotMatch(t, /\b(taper|full out|little audiences?|mini audiences?|make-up|willpower|instrument|time-smart|screen-smart|refuel|build strong|fuel like|how big goals)\b/i);
});

test("the Rest up card says when the runs get fewer, so it agrees with Toolkit p.1 and Aerial p.8", () => {
  assert.match(shown(src("tools/print/Sofia-Backstage-Pass.html")), /Rest up Jan 4 – the show Fewer runs from Dec 28\./);
  assert.match(json("pass").parts.find(p => p.id === "goal").lines.join(" "), /4 · Rest up \(Jan 4 to the show\): fewer runs from Dec 28\./);
  assert.match(shown(src("tools/print/Sofia-Practice-Toolkit.html")), /Rest up Week 15 · Jan 4–8 Fewer runs from Dec 28/);
});

test("no school homework in either Pass (1.59.7, Jenya: Sofia has none); Ms. Brittany's homework is dance homework and stays", () => {
  assert.doesNotMatch(shown(src("tools/print/Sofia-Backstage-Pass.html")).replace(/Ms\. Brittany's homework/g, ""), /homework/i);
  assert.doesNotMatch(JSON.stringify(json("pass")), /homework/i);
});

test("the in-app Pass has the same words", () => {
  const pass = json("pass"), t = JSON.stringify(pass), name = (id) => pass.parts.find(p => p.id === id).n;
  assert.equal(name("time"), "Ways to fit it all in + when to use screens"); assert.equal(name("food"), "Food for dancing");
  assert.doesNotMatch(t, /\b(taper|full out|little audiences?|time-smart|screen-smart|refuel)\b/i);
  assert.match(t, /Eat again after class/); assert.match(t, /Your biggest, best dancing/);
  assert.match(pass.parts.find(p => p.id === "goal").lines[0], /^The big goal: [^:]+$/, "one colon");
});

test("the Toolkit's pages: Rest up, where you look, energy to the end, show someone", () => {
  const t = shown(src("tools/print/Sofia-Practice-Toolkit.html"));
  for (const s of ["Where you look, energy to the end, costume on", "Show someone 2–3 times", "Show someone #1: grandparents on a video call", "where you look · show someone #1", "Rest up: one run a day"]) assert.ok(t.includes(s), s);
  assert.doesNotMatch(t, /\b(taper|mini audiences?|focal points?|stamina)\b/i);
});

test("the app calls the last phase Rest up, and what she can read never says taper", () => {
  for (const f of ["plan15", "phases"]) { const list = f === "plan15" ? json(f).phases : json(f); assert.ok(list.some(p => p.n === "Rest up"), f); assert.ok(!list.some(p => p.n === "Taper"), f); }
  const plan = json("plan15"), spring = json("plan-spring");
  for (const w of [...plan.weeks, ...spring.weeks]) assert.doesNotMatch(`${w.solo} ${w.trio} ${w.fri || ""} ${w.extra || ""}`, /\btaper\b/i, `week ${w.w}`);
  for (const p of [...plan.phases, ...spring.phases, ...json("phases")]) assert.doesNotMatch(`${p.n} ${p.g || ""}`, /\btaper\b/i, p.n);
  const wk = (d) => momWeekLines(d, {}).find(l => l.k === "week").text;
  assert.equal(wk("2026-12-29"), "Week 14 of 15 · Perform it · rest-up days"); assert.equal(wk("2027-01-05"), "Week 15 of 15 · Rest up", "says it once");
  assert.ok(plan.rules.taper.from, "the rule keeps its name in the code");
});
