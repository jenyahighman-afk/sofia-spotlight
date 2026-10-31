// Seasonal themes (1.50.0): the schedule for 2026–27 and the next year, the birthday week from the family's setting,
// the hello on the day itself, the peek and the off switch, the button files, and the wiring. Fixed dates only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { installEnv } from "./_env.mjs";
installEnv();
const src = (f) => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const { THEMES, PRIORITY, seasonFor, helloFor, nextSeason, pickSeason, thanksgiving, windows, validBirthday, iconFor } = await import("../js/seasons.js");

test("the schedule, 2026–27: Halloween all October, fall to the Sunday after Thanksgiving, Christmas, New Year's across January, winter, Valentine's, Women's Day, April Fools, summer around the 4th of July", () => {
  const cases = { "2026-09-30": "", "2026-10-01": "halloween", "2026-10-29": "halloween", "2026-10-31": "halloween", "2026-11-01": "fall", "2026-11-26": "fall", "2026-11-29": "fall", "2026-11-30": "",
    "2026-12-01": "christmas", "2026-12-25": "christmas", "2026-12-26": "christmas", "2026-12-27": "newyear", "2026-12-31": "newyear", "2027-01-01": "newyear", "2027-01-02": "newyear", "2027-01-03": "winter", "2027-01-08": "winter",
    "2027-02-06": "winter", "2027-02-07": "valentines", "2027-02-14": "valentines", "2027-02-15": "winter", "2027-03-06": "winter", "2027-03-07": "womensday", "2027-03-08": "womensday", "2027-03-09": "womensday", "2027-03-10": "",
    "2027-03-31": "", "2027-04-01": "aprilfools", "2027-04-02": "", "2027-06-14": "", "2027-06-15": "summer", "2027-06-30": "summer", "2027-07-01": "july4", "2027-07-04": "july4", "2027-07-05": "july4", "2027-07-06": "summer", "2027-08-31": "summer", "2027-09-01": "" };
  for (const [d, want] of Object.entries(cases)) assert.equal(seasonFor(d), want, d);
  assert.equal(thanksgiving(2026), "2026-11-26"); assert.equal(thanksgiving(2027), "2027-11-25"); assert.equal(seasonFor("2027-11-28"), "fall"); assert.equal(seasonFor("2027-11-29"), "", "the next year follows its own Thanksgiving");
  assert.deepEqual([...PRIORITY].sort(), Object.keys(THEMES).sort(), "every theme has a place in the order");
});

test("the birthday week is the day ±3 from the family's setting, wins over any season, and crosses the year", () => {
  assert.equal(validBirthday("05-14"), "05-14"); assert.equal(validBirthday("13-01"), ""); assert.equal(validBirthday("2017-05-14"), ""); assert.equal(validBirthday(undefined), "");
  const b = { birthday: "05-14" };
  for (const d of ["2027-05-11", "2027-05-14", "2027-05-17"]) assert.equal(seasonFor(d, b), "birthday", d);
  assert.equal(seasonFor("2027-05-10", b), ""); assert.equal(seasonFor("2027-05-18", b), "");
  assert.equal(seasonFor("2026-10-30", { birthday: "10-31" }), "birthday", "a Halloween birthday: the birthday week wins");
  assert.equal(seasonFor("2027-01-01", { birthday: "12-30" }), "birthday", "a week that crosses New Year's");
  assert.equal(seasonFor("2026-12-30", { birthday: "01-02" }), "birthday", "a January birthday starts its week in December"); assert.equal(seasonFor("2026-12-29", { birthday: "01-02" }), "newyear");
  assert.equal(windows(2027, "").birthday.length, 0, "no birthday set: no week");
  assert.equal(seasonFor("2027-05-14"), "", "and nothing without the setting");
});

test("hello on the day itself only; the header line otherwise", () => {
  assert.match(helloFor("2026-10-31", "halloween"), /Happy Halloween, Sofia/); assert.equal(helloFor("2026-10-29", "halloween"), "");
  assert.match(helloFor("2026-11-26", "fall"), /Thanksgiving/); assert.equal(helloFor("2026-11-25", "fall"), "");
  assert.ok(helloFor("2026-12-24", "christmas") && helloFor("2026-12-25", "christmas")); assert.ok(helloFor("2026-12-31", "newyear") && helloFor("2027-01-01", "newyear"));
  assert.ok(helloFor("2027-02-14", "valentines")); assert.ok(helloFor("2027-03-08", "womensday")); assert.ok(helloFor("2027-04-01", "aprilfools")); assert.ok(helloFor("2027-07-04", "july4"));
  assert.match(helloFor("2027-05-14", "birthday", { birthday: "05-14" }), /Happy birthday, Sofia/); assert.equal(helloFor("2027-05-13", "birthday", { birthday: "05-14" }), "");
  assert.equal(helloFor("2027-01-20", "winter"), ""); assert.equal(helloFor("2027-07-20", "summer"), "");
  for (const [id, t] of Object.entries(THEMES)) { assert.ok(t.n && t.e && t.motif && t.hero.startsWith("linear-gradient(") && t.ring && t.line && t.shower.length >= 4, id); }
});

test("what's next, the peek and the off switch", () => {
  assert.deepEqual(nextSeason("2026-10-29"), { id: "fall", from: "2026-11-01" });
  assert.deepEqual(nextSeason("2026-11-29"), { id: "christmas", from: "2026-12-01" });
  assert.deepEqual(nextSeason("2027-03-10"), { id: "aprilfools", from: "2027-04-01" });
  assert.equal(pickSeason("2026-10-29", { settings: {} }), "halloween");
  assert.equal(pickSeason("2026-10-29", { settings: { seasons: "off" } }), "", "off: the everyday look");
  assert.equal(pickSeason("2026-10-29", { settings: { seasons: "off" }, peek: { id: "winter", date: "2026-10-29" } }), "winter", "a peek works even when off");
  assert.equal(pickSeason("2026-10-30", { settings: {}, peek: { id: "winter", date: "2026-10-29" } }), "halloween", "a peek lasts one day");
  assert.equal(pickSeason("2026-10-29", { settings: {}, peek: { id: "", date: "2026-10-29" } }), "", "peek at the everyday look");
  assert.equal(pickSeason("2026-10-29", { settings: {}, peek: { id: "nope", date: "2026-10-29" } }), "halloween", "an unknown peek is ignored");
});

test("every theme has its button (SVG + an opaque 180 px PNG), the default too, and the page points at them", () => {
  for (const id of [...Object.keys(THEMES), "default"]) {
    assert.ok(existsSync(new URL(`../icons/season/${id}.svg`, import.meta.url)), id + ".svg");
    const png = readFileSync(new URL(`../icons/season/${id}-180.png`, import.meta.url));
    assert.equal(png.readUInt32BE(16), 180, id + " width"); assert.equal(png.readUInt32BE(20), 180, id + " height");
    assert.equal(png[25], 2, id + ": RGB with no alpha, so the iPhone shows no black corners");
  }
  assert.equal(iconFor("halloween"), "icons/season/halloween-180.png"); assert.equal(iconFor(""), "icons/season/default-180.png");
  const html = src("index.html"); assert.match(html, /rel="apple-touch-icon" href="icons\/season\/default-180\.png"/); assert.match(html, /id="seasonRow"/);
  assert.ok(src("sw.js").includes('"./js/seasons.js"')); assert.match(src("js/palette.js"), /applySeason\(\)/); assert.match(src("js/palette.js"), /renderSeasonRow\(\)/);
  assert.match(src("css/app.css"), /html\[data-season\] header\.hero\{background:var\(--season-hero\)\}/); assert.match(src("css/app.css"), /prefers-reduced-motion:reduce\)\{\.season-shower\{display:none\}/);
  assert.ok(!/\d{4}-\d{2}-\d{2}/.test(JSON.stringify(Object.values(THEMES))), "no family date in the repo's theme table");
});

test("Halloween everywhere (1.51.0): webs, spiders, bats and witch hats on every screen, decoration only, calm with reduced motion", async () => {
  const { decoHtml } = await import("../js/seasons.js");
  const h = decoHtml("halloween"); assert.equal((h.match(/class="hw-bat /g) || []).length, 3, "three bats"); assert.match(h, /class="hw-witch"/, "and a little witch on her broom");
  for (const id of Object.keys(THEMES)) if (!["halloween", "fall", "christmas"].includes(id)) assert.equal(decoHtml(id), "", id + ": no fliers");
  for (const f of ["web", "web-light", "web-hero", "spider", "spider-light", "bat", "bat-light", "hat", "witch", "strand", "night", "pattern"]) {
    assert.ok(existsSync(new URL(`../icons/season/halloween/${f}.svg`, import.meta.url)), f + ".svg"); assert.ok(src("sw.js").includes(`"./icons/season/halloween/${f}.svg"`), f + " is precached");
  }
  const css = src("css/app.css"); const H = 'html[data-season="halloween"]';
  for (const sel of [`${H} header.hero{background:url(`, `${H} .wrap{background-image:`, `${H} .card:before`, `${H} .card h3:after`, `${H} nav.tabs:before`, `${H} nav.tabs:after`, `${H} nav.tabs button:last-child:before`, `${H} .buddy-pet:before`, `${H} .pet-stage:before`, `${H} .stage,${H} .gate{background-image`, `${H} .stage-top:before`]) assert.ok(css.includes(sel), sel);
  const block = css.slice(css.indexOf("/* Halloween everywhere")); const rules = block.match(/:(before|after)\{content:""[^}]*\}/g) || [];
  assert.ok(rules.length >= 10 && rules.every(r => r.includes("pointer-events:none") || r.includes("display:inline-block")), "every decoration lets taps through");
  assert.match(css, /prefers-reduced-motion:reduce\)\{\.season-deco\{display:none\}/); assert.match(css, /body\.modal \.season-deco\{display:none\}/);
  const btn = src("icons/season/halloween.svg"); assert.ok(btn.includes("#FF5C93") && btn.includes("#4B2A6E") && btn.includes("#B79BE6"), "the button wears the witch hat with her pink band, and the lavender spider");
});

test("Fall everywhere (1.53.0): leaf sprigs, acorns, a leaf after each title, a pink beanie, the garland and its squirrel, falling leaves and a turkey; decoration only, calm with reduced motion", async () => {
  const { decoHtml } = await import("../js/seasons.js");
  const h = decoHtml("fall"); assert.equal((h.match(/class="fl-leaf /g) || []).length, 4, "four falling leaves"); assert.match(h, /class="fl-turkey"/, "and a turkey strolling by"); assert.doesNotMatch(h, /hw-/, "none of Halloween's");
  for (const f of ["sprig", "leaf", "leaf-red", "leaf-gold", "leaf-pink", "acorn", "squirrel", "turkey", "beanie", "garland", "harvest", "branch-hero", "pattern"]) {
    assert.ok(existsSync(new URL(`../icons/season/fall/${f}.svg`, import.meta.url)), f + ".svg"); assert.ok(src("sw.js").includes(`"./icons/season/fall/${f}.svg"`), f + " is precached");
    assert.doesNotMatch(src(`icons/season/fall/${f}.svg`), /rgba\(/, f + ": solid colors with opacity, no rgba (MuPDF and some renderers draw rgba strokes black)");
  }
  const css = src("css/app.css"); const F = 'html[data-season="fall"]';
  for (const sel of [`${F} header.hero{background:url(`, `${F} .wrap{background-image:`, `${F} .card:before`, `${F} .card h3:after`, `${F} nav.tabs:before`, `${F} nav.tabs:after`, `${F} nav.tabs button:last-child:before`, `${F} .buddy-pet:before`, `${F} .pet-stage:before`, `${F} .stage,${F} .gate{background-image`]) assert.ok(css.includes(sel), sel);
  assert.ok(!css.includes(`${F} .stage-top:before`), "nothing over the sheet's ✕");
  const block = css.slice(css.indexOf("/* Fall everywhere"), css.indexOf("/* Fall's fliers")); const rules = block.match(/:(before|after)\{content:""[^}]*\}/g) || [];
  assert.ok(rules.length >= 10 && rules.every(r => r.includes("pointer-events:none") || r.includes("display:inline-block")), "every decoration lets taps through");
  assert.match(css, /\.fl-turkey:before\{content:"";position:absolute;inset:0;pointer-events:none/); assert.match(css, /prefers-reduced-motion:reduce\)\{html\[data-season="fall"\] \.card:after/);
  const beanie = src("icons/season/fall/beanie.svg"); assert.ok(beanie.includes("#FF5C93"), "the beanie is her pink");
});

test("Christmas everywhere (1.55.0): holly, ornaments and bells, a candy cane after each title, a Santa hat, twinkling lights and a snowman, the tree, snowflakes and the sleigh; decoration only, calm with reduced motion", async () => {
  const { decoHtml } = await import("../js/seasons.js");
  const h = decoHtml("christmas"); assert.equal((h.match(/class="xm-snow /g) || []).length, 5, "five snowflakes"); assert.match(h, /class="xm-sleigh"/, "and Santa's sleigh"); assert.doesNotMatch(h, /hw-|fl-/, "none of Halloween's or Fall's");
  assert.equal(seasonFor("2026-12-01"), "christmas"); assert.equal(seasonFor("2026-12-26"), "christmas"); assert.equal(seasonFor("2026-12-27"), "newyear", "the dress ends with Christmas");
  for (const f of ["holly", "ornament", "ornament-red", "bell", "cane", "hat", "lights", "lights-still", "snowman", "tree", "bough-hero", "snowflake", "snowflake-pink", "snowflake-lilac", "sleigh", "pattern"]) {
    assert.ok(existsSync(new URL(`../icons/season/christmas/${f}.svg`, import.meta.url)), f + ".svg"); assert.ok(src("sw.js").includes(`"./icons/season/christmas/${f}.svg"`), f + " is precached");
    assert.doesNotMatch(src(`icons/season/christmas/${f}.svg`), /rgba\(/, f + ": solid colors with opacity, no rgba");
  }
  assert.match(src("icons/season/christmas/lights.svg"), /<animate /, "the lights twinkle"); assert.doesNotMatch(src("icons/season/christmas/lights-still.svg"), /<animate/, "the still string doesn't");
  const css = src("css/app.css"); const X = 'html[data-season="christmas"]';
  for (const sel of [`${X} header.hero{background:url(`, `${X} .wrap{background-image:`, `${X} .card:before`, `${X} .card h3:after`, `${X} nav.tabs:before`, `${X} nav.tabs:after`, `${X} nav.tabs button:last-child:before`, `${X} .buddy-pet:before`, `${X} .pet-stage:before`, `${X} .stage,${X} .gate{background-image`]) assert.ok(css.includes(sel), sel);
  assert.ok(!css.includes(`${X} .stage-top:before`), "nothing over the sheet's ✕");
  const block = css.slice(css.indexOf("/* Christmas everywhere"), css.indexOf("/* Christmas's fliers")); const rules = block.match(/:(before|after)\{content:""[^}]*\}/g) || [];
  assert.ok(rules.length >= 10 && rules.every(r => r.includes("pointer-events:none") || r.includes("display:inline-block")), "every decoration lets taps through");
  assert.match(css, /\.xm-sleigh:before\{content:"";position:absolute;inset:0;pointer-events:none/);
  assert.match(css, /prefers-reduced-motion:reduce\)\{html\[data-season="christmas"\] \.card:after[^}]*\{animation:none\} html\[data-season="christmas"\] nav\.tabs:before\{background-image:url\(\.\.\/icons\/season\/christmas\/lights-still\.svg\)\}/, "with reduced motion nothing swings and the lights stay still");
  assert.ok(src("icons/season/christmas/hat.svg").includes("#FF5C93") && src("icons/season/christmas/holly.svg").includes("#FF5C93"), "her pink: a berry on the Santa hat's brim and on the holly");
});

test("Fall and Christmas hang clear (1.55.1): no acorn or ornament over a card's title, a sheet's title, its chips, Skip or the ✕", () => {
  const css = src("css/app.css");
  for (const id of ["fall", "christmas"]) {
    const S = `html[data-season="${id}"]`, re = S.replace(/[[\]"]/g, "\\$&");
    assert.match(css, new RegExp(`${re} \\.card:nth-child\\(4n\\+1\\):after,${re} \\.modal-card:after\\{content:"";position:absolute;top:-14px`), id + ": the stem starts above the card, so it hangs in the top padding, not over the title");
    assert.match(css, new RegExp(`${re} \\.card:nth-child\\(4n\\+3\\):after\\{content:"";position:absolute;top:-14px`), id + ": the left-hand one too");
    assert.ok(css.includes(`${S} .modal-card:after{right:72px}`), id + ": a bottom sheet's hangs clear of its ✕");
    assert.ok(css.includes(`${S} .stage:after{top:calc(env(safe-area-inset-top,0px) - 10px);left:calc(50% - 8px);right:auto;width:16px;height:28px}`), id + ": a full-screen sheet's hangs in the middle, small enough to end above a long title");
    assert.ok(css.includes(`${S} .stage:before{bottom:calc(env(safe-area-inset-bottom,0px) + 72px)}`), id + ": the sheet's sprig sits above Skip · Done");
    assert.ok(css.includes(`${S} .stage:after,${S} .gate:after{z-index:-1}`) && new RegExp(`${re} \\.stage:before,[^{]*\\.gate:before\\{[^}]*z-index:-1\\}`).test(css), id + ": both behind the sheet's own buttons and chips");
  }
});
