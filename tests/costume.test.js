// Costume Designer: the options file matches the ids frozen for the migration, schema 36 normalizes saved designs
// (known ids only, max 6, names trimmed, flat), "Wear it" sets costumeOn, avatarSVG draws the worn costume and is
// byte-for-byte unchanged when none is worn, and the designer sheet and the Me card render in the fake DOM.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { installEnv, resetDom, el } from "./_env.mjs";
installEnv();
const read = (f) => JSON.parse(readFileSync(new URL("../" + f, import.meta.url), "utf8"));
const src = (f) => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const { applyData, DATA_FILES, P } = await import("../js/data.js");
const got = {}; for (const f of DATA_FILES) got[f] = read("data/" + f + ".json"); applyData(got);
const cos = got.costumes;
const { S, migrateDoc, SCHEMA_VERSION, setBackend, COSTUME_OPTS, normalizeCostumes } = await import("../js/store.js");
const { avatarSVG, wornCostume } = await import("../js/avatar.js");
const { newDesign, savePatch, deletePatch, wearPatch, colorLocked, costumeSVG, renderCostumeCard, costumeList } = await import("../js/costume.js");
const sha = (s) => createHash("sha256").update(s).digest("hex");
const ARMS_UP = P({ el: [-36, -40], er: [36, -40], hl: [-58, -52], hr: [58, -52], kr: [26, 26], fr: [8, 36] });
const reset = () => { resetDom(); for (const k of Object.keys(S)) S[k] = {}; };

test("data/costumes.json: every option id is the one frozen in store.js, colours are hex, ids are onclick-safe", () => {
  assert.deepEqual(cos.colors.map(c => c.id), COSTUME_OPTS.leo); assert.deepEqual(["match", ...cos.colors.map(c => c.id)], COSTUME_OPTS.skirtC);
  assert.deepEqual(cos.skirts.map(c => c.id), COSTUME_OPTS.skirt); assert.deepEqual(cos.sleeves.map(c => c.id), COSTUME_OPTS.sleeves);
  assert.deepEqual(cos.accents.map(c => c.id), COSTUME_OPTS.accent); assert.deepEqual(cos.trims.map(c => c.id), COSTUME_OPTS.trim); assert.deepEqual(cos.heads.map(c => c.id), COSTUME_OPTS.head);
  assert.deepEqual(cos.sparkles.map(s => s.v), [0, 1, 2, 3]); assert.ok(cos.colors.length > got["avatar-options"].options.leo.length, "a wider palette than the avatar's");
  for (const c of [...cos.colors, ...cos.trims]) { assert.match(c.c, /^#[0-9A-F]{6}$/i, c.id); assert.match(c.id, /^[a-z0-9-]+$/); }
  const st = normalizeCostumes([{ id: "s", name: "x", ...cos.starter }])[0]; for (const k of Object.keys(cos.starter)) assert.equal(st[k], cos.starter[k], "starter " + k + " is a known option");
});

test("schema 36: known option ids only, sparkle 0–3, names trimmed to 20, ids unique, at most 6, flat; costumeOn must name a saved design", () => {
  const long = "  My   super sparkly  dream costume!!  ";
  const m = migrateDoc("settings", "main", { _v: 33, costumeOn: "b", costumes: [
    { id: "a", name: long, leo: "royal", skirt: "tutu", sleeves: "long", sparkle: 9, accent: "sash", trim: "gold", head: "tiara", skirtC: "match", extra: [1, 2] },
    { id: "b", name: "", leo: "plaid", skirt: "ballgown", sleeves: 3, sparkle: -2, accent: "cape", trim: "neon", head: "hat", skirtC: "rainbow" },
    "junk", null, [1], { id: "a", name: "dupe" }, { id: "BAD ID!", name: "x" }, {}, {}, {}, {},
  ] });
  assert.equal(m._v, SCHEMA_VERSION); assert.equal(m.costumes.length, 6, "max 6");
  assert.deepEqual(m.costumes[0], { id: "a", name: "My super sparkly dre", leo: "royal", skirtC: "match", skirt: "tutu", sleeves: "long", accent: "sash", trim: "gold", head: "tiara", sparkle: 3 });
  assert.deepEqual(m.costumes[1], { id: "b", name: "Costume 2", leo: "pink", skirtC: "match", skirt: "chiffon", sleeves: "none", accent: "none", trim: "gold", head: "own", sparkle: 0 });
  assert.equal(new Set(m.costumes.map(c => c.id)).size, 6, "ids unique"); assert.ok(m.costumes.every(c => /^[a-z0-9-]+$/.test(c.id)));
  assert.ok(m.costumes.every(c => Object.values(c).every(v => typeof v === "string" || typeof v === "number")), "flat objects only (Firestore: no nested arrays)");
  assert.equal(m.costumeOn, "b");
  assert.equal(migrateDoc("settings", "main", { _v: 33, costumeOn: "gone", costumes: [] }).costumeOn, "");
  assert.equal(migrateDoc("settings", "main", { _v: 33, costumeOn: 5 }).costumeOn, ""); assert.deepEqual(migrateDoc("settings", "main", { _v: 33, costumes: "x" }).costumes, []);
  const plain = migrateDoc("settings", "main", { _v: 33, pin: "2027" }); assert.equal("costumes" in plain, false); assert.equal("costumeOn" in plain, false, "nothing invented");
  assert.deepEqual(migrateDoc("practice", "2026-10-17", { _v: 33, costumes: "x" }).costumes, "x", "only settings");
});

test("designs: new from the starter, save adds or replaces up to 6, delete takes off a worn design, wear sets costumeOn", () => {
  const d1 = newDesign([], "d1"); assert.equal(d1.name, "Costume 1"); assert.equal(d1.skirt, cos.starter.skirt);
  let st = {}; st = { ...st, ...savePatch(st, d1) }; assert.equal(st.costumes.length, 1);
  st = { ...st, ...savePatch(st, { ...d1, leo: "red", name: "Red one" }) }; assert.equal(st.costumes.length, 1, "same id replaces"); assert.equal(st.costumes[0].leo, "red");
  for (let i = 2; i <= 6; i++) st = { ...st, ...savePatch(st, newDesign(costumeList(st), "d" + i)) };
  assert.equal(st.costumes.length, 6); assert.deepEqual(st.costumes.map(c => c.name), ["Red one", "Costume 2", "Costume 3", "Costume 4", "Costume 5", "Costume 6"]);
  assert.equal(savePatch(st, newDesign(costumeList(st), "d7")), null, "no 7th design"); assert.ok(savePatch(st, { ...st.costumes[5], sparkle: 2 }), "editing still works when full");
  st = { ...st, ...wearPatch(st, "d3") }; assert.equal(st.costumeOn, "d3"); assert.equal(wornCostume(st).id, "d3");
  assert.deepEqual(wearPatch(st, "nope"), { costumeOn: "" }); assert.deepEqual(wearPatch(st, ""), { costumeOn: "" });
  assert.deepEqual(deletePatch(st, "d4").costumeOn, "d3", "deleting another keeps it on"); const del = deletePatch(st, "d3"); assert.equal(del.costumeOn, ""); assert.equal(del.costumes.length, 5);
  assert.equal(colorLocked("gold", 0), true, "the star-unlocked leotards stay locked"); assert.equal(colorLocked("gold", 10), false); assert.equal(colorLocked("royal", 0), false);
});

test("avatarSVG: unchanged with no costume worn; draws the worn costume's parts; hip-hop and other dancers ignore it", () => {
  reset(); S.settings = { avatar: { hairStyle: "bun", leo: "#2ED3C8", acc: "flower" } };
  // hashes of the renderer's output before the costume code existed (v1.24.0)
  assert.equal(sha(avatarSVG(P({}))), "1eeaf5ec92128db8608edbd0c64a3020d1d842fa6c571079ba5fe29305b4d988");
  assert.equal(sha(avatarSVG(ARMS_UP)), "ace154a914a76c18fc9fd4f5c551f519c4e6ff1c92c91cc2b72ca0019270a3a1");
  const design = { id: "x", name: "Dream", leo: "royal", skirtC: "match", skirt: "tutu", sleeves: "long", sparkle: 3, accent: "belt", trim: "gold", head: "tiara" };
  S.settings = { ...S.settings, costumes: [design], costumeOn: "" };
  assert.equal(sha(avatarSVG(P({}))), "1eeaf5ec92128db8608edbd0c64a3020d1d842fa6c571079ba5fe29305b4d988", "saved but not worn: unchanged");
  S.settings = { ...S.settings, costumeOn: "x" }; const on = avatarSVG(ARMS_UP);
  assert.ok(on.includes("#3E5FD8"), "royal blue leotard"); assert.ok(!on.includes('fill="#2ED3C8"'), "her own leotard colour is replaced");
  assert.ok(/<ellipse cx="150" cy="\d+(\.\d+)?" rx="35"/.test(on), "tutu"); assert.ok(on.includes("#F4C24A"), "gold trim (belt/tiara)"); assert.ok((on.match(/L[\d.]+ [\d.]+L[\d.]+ [\d.]+L[\d.]+ [\d.]+L[\d.]+ [\d.]+L[\d.]+ [\d.]+L[\d.]+ [\d.]+L[\d.]+ [\d.]+Z" fill="#fff"/g) || []).length >= 9, "rhinestones");
  assert.ok(!on.includes('fill="#FF8FB8"/><circle cx="0" cy="5"'), "the tiara replaces her flower clip");
  const own = avatarSVG(ARMS_UP, {}); assert.equal(own, on, "every caller that draws her avatar gets it");
  for (const [k, v, mark] of [["skirt", "lyrical", 'opacity=".78"'], ["skirt", "fringe", 'stroke-width="2.4" stroke-linecap="round"'], ["sleeves", "one", 'stroke-width="1.5" opacity=".6"'], ["accent", "sash", 'stroke-width="5"'], ["head", "feather", 'stroke-width="1.3"'], ["head", "flowers", '<circle r="2" fill="#F4C24A"/>']]) {
    S.settings = { ...S.settings, costumes: [{ ...design, [k]: v }] }; assert.ok(avatarSVG(ARMS_UP).includes(mark), k + "=" + v);
  }
  S.settings = { ...S.settings, costumes: [{ ...design, head: "own" }] }; assert.ok(avatarSVG(ARMS_UP).includes('<circle r="3" fill="#FFD23F"/>'), "'My usual' keeps her own accessory");
  assert.ok(!avatarSVG(ARMS_UP, { style: "hiphop" }).includes("#3E5FD8"), "hip-hop outfit wins");
  assert.ok(!avatarSVG(ARMS_UP, { hair: "#1F1A1A", leo: "#FF6FA3" }).includes("#3E5FD8"), "other dancers don't wear her costume");
  assert.ok(costumeSVG({ ...design, leo: "emerald" }).includes("#1FA37A"), "thumbnails draw a given design"); reset();
});

test("Me card and designer sheet render; Keep saves, Wear it sets costumeOn; ids exist in index.html", async () => {
  reset(); S.settings = { avatar: { name: "Sofia" } };
  renderCostumeCard(); let card = el("#meCostumes").innerHTML; assert.ok(card.includes("✨ Design a costume") && card.includes("openCostumes()")); assert.ok(!card.includes("cos-thumb"));
  const writes = []; setBackend({ set: async (col, id, rec) => { writes.push({ col, id, rec }); }, del: async () => {} });
  try {
    window.openCostumes(); const area = el("#costumeArea").innerHTML;
    assert.ok(area.includes("cos-preview") && area.includes("<svg") && area.includes("Costume 1")); for (const lab of ["Leotard", "Skirt", "Sleeves", "Sparkle", "Extra", "Trim colour", "Headpiece"]) assert.ok(area.includes(lab), lab);
    assert.ok(el("#stageActions").innerHTML.includes("💾 Save picture") && el("#stageActions").innerHTML.includes("👗 Wear it"));
    window.cosPick("skirt", "fringe"); window.cosPick("sparkle", "2"); window.cosName("  Gala night  ");
    await window.cosKeep(); assert.equal(S.settings.costumes.length, 1); assert.equal(S.settings.costumes[0].skirt, "fringe"); assert.equal(S.settings.costumes[0].sparkle, 2); assert.equal(S.settings.costumes[0].name, "Gala night");
    assert.equal(S.settings.costumeOn, undefined, "keeping doesn't wear it");
    await window.cosWear(); assert.equal(S.settings.costumeOn, S.settings.costumes[0].id); assert.ok(el("#stageActions").innerHTML.includes("Take it off"));
    card = el("#meCostumes").innerHTML; assert.ok(card.includes("cos-thumb on") && card.includes("Gala night 👗") && card.includes("Usual leotard"));
    await window.cosWear(); assert.equal(S.settings.costumeOn, "", "tap again takes it off");
    window.cosPick("leo", "gold"); await window.cosKeep(); assert.notEqual(S.settings.costumes[0].leo, "gold", "locked colour can't be picked with 0 stars");
    assert.ok(writes.every(w => w.col === "settings" && Array.isArray(w.rec.costumes)));
  } finally { setBackend(null); reset(); }
  const html = src("index.html"); assert.ok(html.indexOf('id="meStars"') < html.indexOf('id="meCostumes"') && html.indexOf('id="meCostumes"') < html.indexOf('id="meMoments"'), "right after the stars card");
  assert.match(html, /<div id="costumeArea" style="display:none"><\/div>/); assert.ok(html.indexOf('id="costumeArea"') > html.indexOf('id="p-me"'));
  assert.match(src("sw.js"), /"\.\/js\/costume\.js"/); assert.match(src("sw.js"), /"\.\/data\/costumes\.json"/); assert.match(src("js/app.js"), /initCostume\(\)/); assert.match(src("js/views/me.js"), /renderCostumeCard\(\)/);
});
