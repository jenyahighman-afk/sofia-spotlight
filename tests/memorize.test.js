// Memorize mode (chunk player, Pause & Predict), the cue-pack import matching, Hannah's videos and the how-to content.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installEnv } from "./_env.mjs";
installEnv();
const json = (f) => JSON.parse(readFileSync(new URL("../data/" + f + ".json", import.meta.url), "utf8"));
const { eightCounts, chunksFor, recordPredict, stillMissed, pickPredict, statsOf } = await import("../js/memorize.js");
const { matchPackFile, frameTime, RUNTHROUGH_OFFSET } = await import("../js/cuecheck.js");
const { deckFor, syncedVideos, cueRange, cuePhoto, cueClip } = await import("../js/cuecards.js");
const { howtoHtml } = await import("../js/howto.js");
const solo = json("dances").find(d => d.id === "solo");

test("chunk player: one cue = one segment of the verified table; one 8-count at the solo's 76 BPM from count 1", () => {
  const cues = chunksFor("cue", solo); assert.equal(cues.length, 28); assert.deepEqual(cues[18], { a: 78.25, b: 81, label: "Donut roll on the mat", n: 19, trick: true });
  const e = eightCounts(76, 2, 124); assert.equal(e[0].label, "Before count 1"); assert.deepEqual([e[1].a, e[1].b], [2, 8.32]); assert.equal(e.at(-1).b, 124); assert.ok(e.every((s, i) => i === 0 || s.a === e[i - 1].b));
  assert.deepEqual(eightCounts(0, 0, 124), []); assert.equal(eightCounts(76, 0, 124)[0].label, "8-count 1");
  assert.ok(chunksFor("eight", solo).length >= 19, "the whole 2:04 in 8-counts even before the music has loaded");
});
test("Pause & Predict: Got it / Missed it per cue; the last try decides what's still missed; missed cues come up more", () => {
  let s = recordPredict({}, 19, false); s = recordPredict(s, 19, false); s = recordPredict(s, 12, false); s = recordPredict(s, 12, true); s = recordPredict(s, 5, true);
  assert.deepEqual(s[19], { got: 0, missed: 2, last: "missed" }); assert.deepEqual(s[12], { got: 1, missed: 1, last: "got" });
  assert.deepEqual(stillMissed(s, solo.cues).map(c => c.n), [19], "12 was got on the last try");
  const p = pickPredict(solo.cues, s, () => 0.5); assert.ok(p.cue.n >= 2, "never the first cue (nothing comes before it)"); assert.ok(p.from < p.at && p.at - p.from <= 8); assert.equal(p.at, p.cue.t);
  // Weighting: with every other cue known well, a missed one is picked far more often than its share.
  const known = {}; for (const c of solo.cues) known[c.n] = { got: 4, missed: 0, last: "got" }; known[19] = { got: 0, missed: 3, last: "missed" };
  let r = 0, hits = 0; const rand = () => { r = (r * 9301 + 49297) % 233280; return r / 233280; }; for (let i = 0; i < 400; i++) if (pickPredict(solo.cues, known, rand).cue.n === 19) hits++;
  assert.ok(hits > 400 / 27 * 3, "the missed donut roll comes up often: " + hits);
  assert.equal(pickPredict([{ n: 1, t: 0, end: 5, move: "x" }], {}), null); assert.deepEqual(statsOf({}), {});
});
test("cue pack import: photos by their exact cue-pack name, Hannah's clips as cNN.m4a, the PDF; old hannah-cues files never match", () => {
  assert.deepEqual(matchPackFile("19-donut-roll-on-the-mat.jpg", solo.cues), { kind: "photo", n: 19 });
  assert.deepEqual(matchPackFile("01-opening-walk-tendus-arm-reach.JPG", solo.cues), { kind: "photo", n: 1 });
  assert.deepEqual(matchPackFile("c12.m4a", solo.cues), { kind: "clip", n: 12 }); assert.equal(matchPackFile("c99.m4a", solo.cues), null);
  assert.deepEqual(matchPackFile("Sofia-Solo-Cue-Cards.pdf", solo.cues), { kind: "pdf" });
  for (const old of ["01-side-sit-leg-reach.m4a", "06-donut-roll-walkthrough.jpg", "cues.json", "walkthrough-map.json"]) assert.equal(matchPackFile(old, solo.cues), null, old);
  assert.equal(RUNTHROUGH_OFFSET, 4.98); assert.equal(frameTime({ t: 78.25, pt: 79.75 }, 4.98), 84.73); assert.equal(frameTime({ t: 10 }, 0), 10);
});
test("cue cards: the deck, key tricks only, exact ranges; photos and clips come only from the family's cueMedia", () => {
  assert.equal(deckFor(solo).length, 28); assert.equal(deckFor(solo, true).length, 11); assert.equal(cueRange(deckFor(solo)[15]), "1:07.75–1:10.5");
  assert.equal(cuePhoto(solo, 19), "", "no photo in the public data"); assert.ok(!JSON.stringify(solo).includes("firebasestorage"), "no storage links in the repo");
  const fam = { ...solo, cueMedia: { 19: { photo: { url: "https://firebasestorage.googleapis.com/p" }, clip: { url: "https://firebasestorage.googleapis.com/c" } } }, hannahVideos: [{ url: "https://f/v", path: "p", offset: 4.98, name: "Run-through" }, { url: "https://photos.app.goo.gl/x", path: "", offset: 0 }] };
  assert.equal(cuePhoto(fam, 19), "https://firebasestorage.googleapis.com/p"); assert.equal(cueClip(fam, 19), "https://firebasestorage.googleapis.com/c");
  assert.deepEqual(syncedVideos(fam).map(v => v.name), ["Run-through"], "only a video synced to the music can play chunks");
});
test("How to practice my solo: kid steps in short words; every grown-up point says research or expert and links real sources", () => {
  const h = json("howto"); assert.ok(h.kid.length >= 8 && h.kid.every(k => k.t.length <= 90 && k.ic));
  const ids = new Set(h.sources.map(s => s.id)); assert.equal(ids.size, h.sources.length);
  for (const g of h.grown) { assert.ok(["research", "expert", "both"].includes(g.ev), g.n); assert.ok(g.src.length && g.src.every(id => ids.has(id)), "sources for " + g.n); }
  assert.ok(h.sources.every(s => /^https:\/\//.test(s.u))); assert.ok([...ids].every(id => h.grown.some(g => g.src.includes(id))), "no unused source");
  const kidOnly = howtoHtml(h, false); assert.ok(!kidOnly.includes("http"), "Sofia's view has no links"); assert.ok(howtoHtml(h, true).includes("pubmed.ncbi.nlm.nih.gov"));
});
