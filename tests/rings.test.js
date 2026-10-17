// Progress rings: the arc starts at 12 o'clock through an SVG rotate() on the arc itself, never a CSS rotation of the
// whole <svg> plus a counter-rotated label. iPhone Safari pivots a CSS-rotated SVG label around the corner, so the
// "100%" in the middle of the Practice ring disappeared on her phone.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const src = (f) => readFileSync(new URL("../" + f, import.meta.url), "utf8");

test("every progress ring rotates only its arc, in SVG, around its own centre; no CSS rotation is left on a ring", () => {
  for (const [f, c] of [["js/views/practice.js", 50], ["js/pmode.js", 50], ["js/views/me.js", 32], ["js/goals.js", 32]]) {
    assert.ok(src(f).includes(`class="ring-fg" transform="rotate(-90 ${c} ${c})"`), f + " rotates the arc around (" + c + "," + c + ")");
  }
  const css = src("css/app.css");
  for (const sel of [".ring", ".mini-ring", ".ring-txt", ".ring-ic", ".pm-ring"]) {
    const rules = [...css.matchAll(new RegExp("(?:^|[}\\s,])" + sel.replace(".", "\\.") + "\\{([^}]*)\\}", "g"))].map(m => m[1]);
    for (const r of rules) assert.ok(!/rotate\(/.test(r), sel + " must not be rotated in CSS: " + r);
  }
});
