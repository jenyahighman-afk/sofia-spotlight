// Trick cards: one card per skill in data/skills.json, earned (clean) / shiny (teacher-checked) / locked, counts, the
// facts on a card (ladder number, gems, dates), the photo link and the schema-35 migration, the "New card!" pop, and the
// Me card / binder in the fake DOM.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installEnv, resetDom, el } from "./_env.mjs";
installEnv();
const read = (f) => JSON.parse(readFileSync(new URL("../" + f, import.meta.url), "utf8"));
const src = (f) => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const { applyData, DATA_FILES } = await import("../js/data.js");
const got = {}; for (const f of DATA_FILES) got[f] = read("data/" + f + ".json"); applyData(got);
const ladder = got.skills;
const { cardList, cardCounts, binderGroups, cardPhotos, cardMoment, normalizeCardLink, tierOf, cardHTML, renderCardsCard, renderBinder, initCards } = await import("../js/cards.js");
const { kidCycle, teacherCheck } = await import("../js/skills.js");
const { S, migrateDoc, SCHEMA_VERSION, setBackend } = await import("../js/store.js");
// A leveled ladder (acro) puts her group's levels in the binder (plus anything she has started); plain ladders put every skill.
const binderSkills = (st) => st.skills.filter(s => !Array.isArray(st.focus) || s.bonus || st.focus.includes(s.lvl));
const total = Object.values(ladder.styles).reduce((a, s) => a + binderSkills(s).length, 0);

test("one card per skill, every style, in ladder order with its number from the data", () => {
  const cards = cardList({}, ladder); assert.equal(cards.length, total); assert.equal(new Set(cards.map(c => c.id)).size, total, "ids unique");
  for (const [style, st] of Object.entries(ladder.styles)) {
    const mine = cards.filter(c => c.style === style); assert.deepEqual(mine.map(c => c.id), binderSkills(st).map(s => s.id), style + " in ladder order");
    mine.forEach((c, i) => { assert.equal(c.no, i + 1); assert.equal(c.of, binderSkills(st).length); assert.equal(c.ic, st.ic); assert.equal(c.styleName, st.n); assert.match(c.color, /^#[0-9A-F]{6}$/i); });
  }
  assert.ok(cards.every(c => c.tier === "locked" && c.date === "" && c.gems === 0), "nothing earned with no records");
  assert.ok(cards.every(c => /^[a-z0-9-]{1,40}$/.test(c.id)), "card ids are onclick-safe");
  assert.deepEqual(binderGroups(cards).map(g => g.style), Object.keys(ladder.styles));
  const started = cardList({ "a-cartwheel": { state: "clean", at: "2026-10-01" } }, ladder); assert.ok(started.some(c => c.id === "a-cartwheel" && c.tier === "card"), "a Level 1 acro skill she landed still earns its card");
  assert.ok(!cards.some(c => c.id === "a-cartwheel"), "an untouched Level 1 skill stays out of the binder");
});

test("clean earns a card, teacher-checked a shiny one, learning stays locked; counts and dates come from the records", () => {
  const skills = {
    "s-calypso": { id: "s-calypso", state: "clean", at: "2026-10-01", quest: { bars: {}, gems: ["2026-09-28", "2026-09-30", "2026-10-01"] } },
    "b-plie": { id: "b-plie", state: "checked", at: "2026-10-05", checkedAt: "2026-10-04", teacher: "Miss A" },
    "j-iso": { id: "j-iso", state: "learning", at: "2026-10-02" }, "h-bounce": { id: "h-bounce", state: "weird" },
  };
  const cards = cardList(skills, ladder); const by = (id) => cards.find(c => c.id === id);
  assert.equal(by("s-calypso").tier, "card"); assert.equal(by("s-calypso").date, "2026-10-01"); assert.equal(by("s-calypso").gems, 3);
  assert.equal(by("b-plie").tier, "shiny"); assert.equal(by("b-plie").date, "2026-10-04", "the teacher's check date"); assert.equal(by("b-plie").teacher, "Miss A");
  assert.equal(by("j-iso").tier, "locked"); assert.equal(by("j-iso").date, ""); assert.equal(by("h-bounce").tier, "locked", "an unknown state is not yet");
  assert.deepEqual(cardCounts(cards), { earned: 2, shiny: 1, total });
  const g = binderGroups(cards); assert.equal(g.find(x => x.style === "solo").earned, 1); assert.equal(g.find(x => x.style === "ballet").earned, 1);
  assert.equal(tierOf("clean"), "card"); assert.equal(tierOf("checked"), "shiny"); assert.equal(tierOf("learning"), "locked");
  assert.equal(cardMoment("learning", "clean"), "card"); assert.equal(cardMoment("clean", "checked"), "shiny"); assert.equal(cardMoment("notyet", "checked"), "shiny");
  assert.equal(cardMoment("clean", "learning"), null, "going back pops nothing"); assert.equal(cardMoment("notyet", "learning"), null); assert.equal(cardMoment("checked", "clean"), null);
  const shiny = cardHTML(by("b-plie")), lock = cardHTML(by("j-iso"));
  assert.ok(shiny.includes("tcard tc-shiny") && shiny.includes("cardOpen('b-plie')") && shiny.includes("No. 1/10"));
  assert.ok(lock.includes("tcard tc-locked") && lock.includes(">?<") && lock.includes("Isolations"), "a locked card shows a ? and the name, greyed");
});

test("photo link: newest linked photo per card; bad links, videos and deleted photos are ignored; schema 35 keeps only skill ids", () => {
  const photos = { a: { url: "u1", card: "s-calypso", at: "2026-10-01T10:00" }, b: { url: "u2", card: "s-calypso", at: "2026-10-03T10:00" }, c: { url: "u3", card: "Bad Id!" }, d: { url: "u4", card: "b-plie", kind: "video" }, e: { url: "u5", card: "b-plie", deleted: true }, f: { url: "u6" } };
  const m = cardPhotos(photos); assert.deepEqual(Object.keys(m), ["s-calypso"]); assert.equal(m["s-calypso"].url, "u2"); assert.equal(m["s-calypso"].id, "b");
  assert.equal(normalizeCardLink("b-plie"), "b-plie"); assert.equal(normalizeCardLink("B-Plie"), null); assert.equal(normalizeCardLink(3), null); assert.equal(normalizeCardLink("x".repeat(41)), null);
  assert.ok(SCHEMA_VERSION >= 35, "trick cards are schema 35");
  const ok = migrateDoc("photos", "p", { _v: 33, url: "u", card: "s-calypso" }); assert.equal(ok._v, SCHEMA_VERSION); assert.equal(ok.card, "s-calypso");
  for (const bad of [42, "Has Spaces", "", null, { id: "x" }, ["s-calypso"]]) assert.equal("card" in migrateDoc("photos", "p", { _v: 34, url: "u", card: bad }), false, JSON.stringify(bad));
  assert.equal("card" in migrateDoc("photos", "p", { _v: 34, url: "u" }), false, "nothing invented"); assert.equal(migrateDoc("settings", "main", { _v: 34, card: 5 }).card, 5, "other collections untouched");
});

test("Me card and binder render in the fake DOM; a newly landed skill pops New card!, a teacher check pops Shiny card!", async () => {
  resetDom(); for (const k of Object.keys(S)) S[k] = {};
  const writes = []; setBackend({ set: async (col, id, rec) => { writes.push({ col, id }); }, del: async () => {} });
  try {
    S.skills = { "s-donut": { id: "s-donut", state: "checked", at: "2026-10-05", checkedAt: "2026-10-05", teacher: "Miss A" } };
    S.photos = { p1: { url: "https://x/p.jpg", card: "s-donut", at: "2026-10-06" } };
    renderCardsCard(); const card = el("#meCards").innerHTML;
    assert.ok(card.includes("🃏 My trick cards") && card.includes(`1 / ${total}`) && card.includes("openCards()"), "Me card shows the count and opens the binder");
    await window.openCards(); const area = el("#cardsArea").innerHTML;
    assert.equal(el("#cardsArea").style.display, "block", "the binder moved into the stage");
    for (const st of Object.values(ladder.styles)) assert.ok(area.includes(st.n.replace(/&/g, "&amp;")), "group " + st.n);
    assert.equal((area.match(/class="tcard /g) || []).length, total, "every card in the binder"); assert.ok(area.includes("tcard tc-shiny") && area.includes("https://x/p.jpg"), "shiny card with its photo");
    window.cardOpen("s-donut"); const big = el("#cardsArea").innerHTML;
    assert.ok(big.includes("tcard tc-shiny big") && big.includes("Miss A") && big.includes('id="tcLineup"') && el("#tcLineup").innerHTML.includes("lineupAdd('s-donut', this)"), "big view with the lineup and its add button");
    window.cardOpen("b-plie"); assert.ok(!el("#tcLineup").innerHTML.includes("lineupAdd("), "a trick she hasn't started has no add button"); assert.ok(el("#cardsArea").innerHTML.includes("It's waiting for you"));
    window.cardOpen("");
    initCards(); el("#toast").textContent = "";
    await kidCycle("j-iso"); assert.equal(el("#toast").textContent, "", "learning is not a card yet");
    await kidCycle("j-iso"); assert.match(el("#toast").textContent, /New card! Isolations/);
    el("#toast").textContent = ""; await teacherCheck("j-iso", "Miss B", "2026-10-10"); assert.match(el("#toast").textContent, /Shiny card! Isolations/);
    renderCardsCard(); assert.ok(el("#meCards").innerHTML.includes(`2 / ${total}`) && el("#meCards").innerHTML.includes("2 shiny"));
    assert.ok(writes.every(w => w.col === "skills"), "only skill writes; the cards store nothing of their own");
  } finally { setBackend(null); resetDom(); for (const k of Object.keys(S)) S[k] = {}; }
  const html = src("index.html"); const me = html.slice(html.indexOf('id="p-me"'), html.indexOf("</section>", html.indexOf('id="p-me"')));
  assert.match(me, /id="meMoments"><\/div>\s*<div class="card coral" id="meCards"><\/div>/, "Me card right after Moments"); assert.ok(me.includes('id="cardsArea" style="display:none"'), "binder area inside p-me, hidden");
  assert.match(src("js/views/me.js"), /renderCardsCard\(\)/); assert.match(src("js/app.js"), /initCards\(\)/); assert.match(src("sw.js"), /"\.\/js\/cards\.js"/);
  assert.match(src("css/app.css"), /prefers-reduced-motion:reduce\)\{\.tcard\.tc-shiny::after\{animation:none/);
});
