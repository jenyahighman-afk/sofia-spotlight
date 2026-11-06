// 1.64.4: the printed Aerial Mission p.2 says "Practice → Aerial mission" and is not reprinted (Jenya). The checklist
// moved to Skills in 1.61.0, so Practice keeps one row that goes there and opens it. Reads files and the fake DOM only: no
// clock, no weekday, no timezone.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installEnv, resetDom, el } from "./_env.mjs";
installEnv();
const src = (f) => readFileSync(new URL("../" + f, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const html = src("index.html"), section = (a, b) => html.slice(html.indexOf(`id="p-${a}"`), html.indexOf(`id="p-${b}"`));
await import("../js/views/practice.js");

test("Practice has an Aerial mission row; the checklist itself is on the aerial's own page, once (1.66.0)", () => {
  const pr = section("practice", "play"), gp = section("goal", "practice");
  assert.match(pr, /<button class="card violet me-tile" id="practiceAerial" onclick="aerialGo\(\)">.*<b>Aerial mission<\/b><small>Your checklist is with your goals\. Tap to go there\.<\/small>/);
  assert.doesNotMatch(pr, /aerialList|aerialPct/, "no second checklist");
  assert.match(gp, /<details class="card acc violet" id="aerialFold" hidden><summary>🤸 All the steps/);
  for (const id of ["practiceAerial", "aerialFold", "aerialList"]) assert.equal((html.match(new RegExp(`id="${id}"`, "g")) || []).length, 1, id + " exists once");
});

test("the row opens the aerial's page with all the steps unfolded", () => {
  resetDom(); const calls = []; window.goalOpen = (id, o) => calls.push([id, o]);
  window.aerialGo(); assert.deepEqual(calls, [["a-aerial", { steps: true }]]);
  delete window.goalOpen; resetDom();
  assert.match(src("js/views/practice.js"), /function aerialGo\(\)\{ if \(typeof window\.goalOpen === "function"\) window\.goalOpen\("a-aerial", \{ steps: true \}\); else showPage\("skills"\); \}/);
});

test("the release", () => {
  assert.match(src("js/version.js"), /APP_VERSION = "1\.(64\.[4-9]|6[5-9]|[7-9]\d)/); assert.match(src("README.md"), /\*\*1\.64\.4:\*\* Practice has a 🤸 Aerial mission row again/);
});
