// The Oct 30 re-audit's small leftovers: Halloween hangs clear like Fall and Christmas (1.55.1), its dark webs stay in
// dark mode, Me's What's new dot reads as a badge under Christmas's lights, Reload is never under the Bunny, a peek
// showers once, the April Fools title stays fixed for the day once she fixes it, and closing the Film sheet lets the
// clip go. Every date here is fixed; nothing reads the clock's weekday.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installEnv, resetDom, el, El } from "./_env.mjs";
installEnv();
const src = (f) => readFileSync(new URL("../" + f, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const css = src("css/app.css");
const { applySeason } = await import("../js/seasons.js");
const { S, received } = await import("../js/store.js");

// The fake DOM has no <html>: one that keeps its attributes, enough for applySeason.
const root = new El("html"); root.removeAttribute = function (k){ delete this[k]; }; root.style = { setProperty(){}, removeProperty(){} };
document.documentElement = root;
const mk = document.createElement; document.createElement = (t) => { const e = mk(t); e.style.setProperty = (k, v) => { e.style[k] = v; }; return e; }; // the shower's emoji set --r
// The shower and the toast clear themselves on a timer: keep those timers from holding the test open.
function quietTimers(fn){ const st = globalThis.setTimeout; globalThis.setTimeout = () => 0; try { return fn(); } finally { globalThis.setTimeout = st; } }
const showers = () => document.body.children.filter(c => c.className === "season-shower").length;

test("Halloween hangs clear (like Fall and Christmas, 1.55.1): no spider over a card's title, a sheet's title, its chips, Skip or the ✕", () => {
  const S_ = 'html[data-season="halloween"]', re = S_.replace(/[[\]"]/g, "\\$&");
  assert.match(css, new RegExp(`${re} \\.card:nth-child\\(4n\\+1\\):after,${re} \\.modal-card:after\\{content:"";position:absolute;top:-14px;right:42px`), "the thread starts above the card, so the spider hangs in the top padding, not over the title");
  assert.match(css, new RegExp(`${re} \\.card:nth-child\\(4n\\+3\\):after\\{content:"";position:absolute;top:-14px;left:36px`), "the left-hand one too");
  assert.ok(css.includes(`${S_} .modal-card:after{right:72px}`), "a bottom sheet's hangs clear of its ✕");
  assert.ok(css.includes(`${S_} .stage:after{top:calc(env(safe-area-inset-top,0px) - 10px);left:calc(50% - 8px);right:auto;width:16px;height:28px}`), "a full-screen sheet's hangs in the middle, small enough to end above a long title");
  assert.ok(css.includes(`${S_} .stage:before{bottom:calc(env(safe-area-inset-bottom,0px) + 72px)}`), "the sheet's web sits above Skip · Done");
  assert.ok(css.includes(`${S_} .stage:after,${S_} .gate:after{z-index:-1}`) && new RegExp(`${re} \\.stage:before,[^{]*\\.gate:before\\{[^}]*z-index:-1\\}`).test(css), "both behind the sheet's own buttons and chips");
  assert.match(css, new RegExp(`${re} \\.stage-top:before\\{[^}]*pointer-events:none;z-index:-1\\}`), "the corner web sits behind the ✕");
  // The hanging spiders only climb: their bob never takes them lower than where they hang (hw-bob went 5px lower, onto the title).
  for (const sel of [".card:nth-child(4n+1):after", ".card:nth-child(4n+3):after", ".stage:after"]) {
    const rule = css.slice(css.indexOf(`${S_} ${sel}`)); const anim = /animation:([a-z-]+) /.exec(rule.slice(0, rule.indexOf("}")))[1];
    assert.equal(anim, "hw-dangle", sel);
  }
  const kf = /@keyframes hw-dangle\{from\{transform:translateY\((-?\d+)px\)\}to\{transform:translateY\((-?\d+)(?:px)?\)\}\}/.exec(css);
  assert.ok(kf && +kf[1] < 0 && +kf[2] === 0, "hw-dangle climbs (negative) and drops back to 0, never below");
  assert.match(css, /prefers-reduced-motion:reduce\)\{\.season-deco\{display:none\}html\[data-season="halloween"\] \.card:after,[^{]*\.stage:after,[^{]*\.gate:after\{animation:none!important\}/, "still calm with reduced motion");
  const block = css.slice(css.indexOf("/* Halloween everywhere"), css.indexOf("/* The fliers")); const rules = block.match(/:(before|after)\{content:""[^}]*\}/g) || [];
  assert.ok(rules.length >= 10 && rules.every(r => r.includes("pointer-events:none") || r.includes("display:inline-block")), "every decoration lets taps through");
});

test("Halloween's dark webs and spiders stay in dark mode: every selector in those rules carries the dark condition", () => {
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const lists = [...bare.matchAll(/([^{}]+)\{background-image:url\(\.\.\/icons\/season\/halloween\/(?:web|spider|bat)-light\.svg\)\}/g)].map(m => m[1]);
  assert.ok(lists.length >= 6, "the light-on-dark rules are there");
  for (const list of lists) for (const sel of list.split(",").map(s => s.trim()))
    assert.ok(sel.startsWith(':root:not([data-theme="light"])[data-season="halloween"] ') || sel.startsWith(':root[data-theme="dark"][data-season="halloween"] '), "scoped to dark: " + sel);
  assert.ok(bare.includes(':root:not([data-theme="light"])[data-season="halloween"] .modal-card:before') && bare.includes(':root[data-theme="dark"][data-season="halloween"] .modal-card:before'), "the sheet's light web only in dark mode (it showed, near-invisible, in light mode)");
  assert.match(css, /html\[data-season="halloween"\] \.card:before,html\[data-season="halloween"\] \.modal-card:before\{content:"";[^}]*web\.svg/, "light mode keeps the dark web on cards and sheets");
});

test("Christmas: Me's What's new dot reads as a badge, not one more bulb on the string of lights; Christmas only", () => {
  const base = /nav\.tabs button\.has-news:after\{content:"";position:absolute;top:(\d+)px;/.exec(css);
  const xmas = /html\[data-season="christmas"\] nav\.tabs button\.has-news:after\{top:(\d+)px;border-color:#fff;box-shadow:0 0 0 [\d.]+px #[0-9A-F]{6}\}/.exec(css);
  assert.ok(base && xmas, "the dot, and its Christmas dress");
  assert.ok(+xmas[1] > +base[1] + 6, "below the string's bulbs, in a white ring with a pink edge");
  assert.equal((css.match(/button\.has-news:after\{/g) || []).length, 2, "no other season moves it");
  assert.ok(css.indexOf(xmas[0]) > css.indexOf(base[0]), "after the base rule");
});

test("Reload is never under the Bunny: the update bar keeps the Bunny's corner free", () => {
  assert.match(src("index.html"), /<div class="update-bar" id="updateBar" hidden><span>✨ New version ready<\/span><button class="btn sm coral" id="updateReload">Reload<\/button><\/div>/);
  const pad = /\.update-bar\{[^}]*padding:(\d+)px (\d+)px (\d+)px (\d+)px;/.exec(css); assert.ok(pad, "the bar's padding");
  const right = +/\.buddy\{position:fixed;right:(\d+)px;/.exec(css)[1], w = +/\.buddy-pet\{[^}]*width:(\d+)px;/.exec(css)[1];
  assert.ok(+pad[2] >= right + w + 8, `right padding ${pad[2]}px clears the Bunny (${right}px in + ${w}px wide) with room to spare`);
});

test("a peek showers exactly once, and a re-render after it doesn't shower again", () => {
  const keep = S.settings; S.settings = {}; localStorage.clear(); received.any.add("settings");
  try {
    quietTimers(() => {
      const n0 = showers(); window.seasonPeek("winter", "2026-10-30"); assert.equal(showers() - n0, 1, "one shower per peek (it played two)");
      assert.equal(root["data-season"], "winter", "the peek dresses the page");
      applySeason("2026-10-30"); assert.equal(showers() - n0, 1, "a re-render the same day stays quiet");
      window.seasonPeek("christmas", "2026-10-30"); assert.equal(showers() - n0, 2, "the next peek: one more");
      window.seasonPeek("", "2026-10-30"); assert.equal(root["data-season"], "halloween", "back to the schedule");
    });
  } finally { S.settings = keep; localStorage.clear(); }
  assert.match(src("js/seasons.js"), /if \(t && received\.any\.has\("settings"\)\) showerOnce\(id, date\);/, "the first-open shower still waits for the family's settings");
});

test("April Fools: once she taps the title right it stays fixed for the rest of that day; the next April 1 it's upside down again", () => {
  const keep = S.settings; S.settings = {}; localStorage.clear(); resetDom();
  try {
    quietTimers(() => {
      const hero = el("header.hero"); const tap = (inButton = false) => hero.listeners.click.forEach(fn => fn({ target: { closest: () => inButton ? {} : null } }));
      applySeason("2027-04-01"); assert.equal(root["data-season"], "aprilfools"); assert.equal(hero.classList.contains("fixed"), false, "upside down");
      tap(true); assert.equal(hero.classList.contains("fixed"), false, "a tap on the gear (a button) doesn't fix it");
      tap(); assert.equal(hero.classList.contains("fixed"), true, "her tap fixes it");
      applySeason("2027-04-01"); applySeason("2027-04-01"); assert.equal(hero.classList.contains("fixed"), true, "a re-render keeps it fixed (it flipped back)");
      applySeason("2027-04-02"); assert.equal(hero.classList.contains("fixed"), false, "an everyday morning: nothing to fix");
      applySeason("2028-04-01"); assert.equal(hero.classList.contains("fixed"), false, "the next April Fools it's upside down again");
      assert.equal(hero.listeners.click.length, 1, "one listener, however often it re-renders");
    });
  } finally { S.settings = keep; localStorage.clear(); }
});

test("closing the Film sheet lets the clip go: paused, unloaded from the <video>, its URL revoked, the sheet emptied", async () => {
  resetDom(); const F = await import("../js/film.js"); F.initFilm();
  const revoked = [], realRevoke = URL.revokeObjectURL; URL.revokeObjectURL = (u) => revoked.push(u);
  try {
    window.openFilm(); const input = el("#filmIn"); input.files = [{ type: "video/quicktime", name: "IMG_1.MOV" }]; input.onchange();
    assert.match(el("#filmBody").innerHTML, /<video id="filmVideo" src="blob:test"/);
    const v = el("#filmVideo"), calls = []; v.pause = () => calls.push("pause"); v.removeAttribute = (k) => calls.push("remove " + k); v.load = () => calls.push("load");
    window.closeFilm();
    assert.deepEqual(calls, ["pause", "remove src", "load"], "paused, its src cleared and reloaded empty");
    assert.deepEqual(revoked, ["blob:test"], "the object URL is revoked");
    assert.equal(el("#film").hidden, true); assert.doesNotMatch(el("#filmBody").innerHTML, /<video/, "no video left in the closed sheet");
    window.openFilm(); assert.match(el("#filmBody").innerHTML, /🎥 Film a chunk/, "it opens fresh");
  } finally { URL.revokeObjectURL = realRevoke; }
});
