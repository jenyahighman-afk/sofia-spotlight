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

test("Practice has an Aerial mission row; the checklist itself stays on Skills, once", () => {
  const pr = section("practice", "play"), sk = section("skills", "practice");
  assert.match(pr, /<button class="card violet me-tile" id="practiceAerial" onclick="aerialGo\(\)">.*<b>Aerial mission<\/b><small>Your checklist is on Skills\. Tap to go there\.<\/small>/);
  assert.doesNotMatch(pr, /aerialList|aerialPct/, "no second checklist");
  assert.match(sk, /<details class="card acc violet" id="aerialFold"><summary>🤸 Aerial mission/);
  for (const id of ["practiceAerial", "aerialFold", "aerialList"]) assert.equal((html.match(new RegExp(`id="${id}"`, "g")) || []).length, 1, id + " exists once");
});

test("the row goes to Skills and opens the checklist", () => {
  resetDom(); const fold = el("#aerialFold"); fold.open = false; let scrolled = 0; fold.scrollIntoView = () => { scrolled++; };
  const pages = []; const on = (e) => pages.push(e.detail); document.addEventListener("page", on);
  window.aerialGo();
  assert.equal(fold.open, true); assert.equal(scrolled, 1);
  if (pages.length) assert.equal(pages.at(-1), "skills");
  document.removeEventListener && document.removeEventListener("page", on); resetDom();
  assert.match(src("js/views/practice.js"), /function aerialGo\(\)\{ showPage\("skills"\); const a = \$\("#aerialFold"\);/);
});

test("the release", () => {
  assert.match(src("js/version.js"), /APP_VERSION = "1\.(64\.[4-9]|6[5-9]|[7-9]\d)/); assert.match(src("README.md"), /\*\*1\.64\.4:\*\* Practice has a 🤸 Aerial mission row again/);
});
