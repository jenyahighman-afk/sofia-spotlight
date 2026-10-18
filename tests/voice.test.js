// The bunny's voice: the nicest English voice first (Premium/Enhanced, then pleasant ones; robotic novelty voices last),
// text a voice can read (no emoji, ranges said out loud), one sentence at a time, and a friendly rate/pitch.
import { test } from "node:test";
import assert from "node:assert/strict";
import { installEnv } from "./_env.mjs";
installEnv();
const V = await import("../js/voice.js");
const voice = (name, lang = "en-US", localService = true) => ({ name, lang, localService, voiceURI: name });

test("picks the nicest voice: Premium/Enhanced, then pleasant voices, never the robotic ones while others exist", () => {
  const all = [voice("Fred"), voice("Zarvox"), voice("Bubbles"), voice("Samantha"), voice("Ava (Premium)"), voice("Thomas", "fr-FR"), voice("Daniel", "en-GB"), voice("Karen", "en-AU")];
  const best = V.bestVoices(all).map(v => v.name);
  assert.equal(best[0], "Ava (Premium)"); assert.ok(best.includes("Samantha") && best.includes("Karen"));
  assert.ok(!best.some(n => /Fred|Zarvox|Bubbles/.test(n)), "no robot voices"); assert.ok(!best.includes("Thomas"), "English only");
  assert.ok(V.bestVoices(all).length <= 4);
  assert.deepEqual(V.bestVoices([voice("Fred")]).map(v => v.name), ["Fred"], "a robotic voice only when it's the only one");
  assert.deepEqual(V.bestVoices([voice("Amélie", "fr-CA")]), [], "no English voice → the phone's default");
});

test("text a voice can read, one sentence at a time, friendly rate and pitch", () => {
  assert.equal(V.speechText("Psst, Sofia! 🐰"), "Psst, Sofia!");
  assert.equal(V.speechText("*wiggles ears dramatically*"), "wiggles ears dramatically");
  assert.equal(V.speechText("A game gives 1–3. ⭐"), "A game gives 1 to 3.");
  assert.equal(V.speechText("Tap “I did it! 🎉” & go ▶"), "Tap I did it! and go");
  assert.ok(!/[\u{1F000}-\u{1FFFF}]/u.test(V.speechText("🔥 4 days in a row! 🐰💕")));
  assert.deepEqual(V.sentences("Hi Sofia! Today's trick is Leap. Five tries."), ["Hi Sofia!", "Today's trick is Leap.", "Five tries."]);
  assert.deepEqual(V.sentences("🎉 . !"), [], "nothing to say → nothing spoken");
  assert.ok(V.RATE < 1 && V.RATE >= 0.85, "a bit slower than the default"); assert.ok(V.PITCH > 1 && V.PITCH <= 1.3, "a bit higher, not a chipmunk");
});
