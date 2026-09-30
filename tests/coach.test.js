// Coach worker core (validation, prompt, rate limit, parsing), frame sampling, pose math and goals math — all pure.
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateRequest, buildUserContent, parseReview, checkAndCount, memoryStore, corsHeaders, parseOrigins, SYSTEM_PROMPT, MAX_FRAMES, DAILY_LIMIT } from "../worker/src/core.js";
import { evenTimes, sampleTimes, loudness, peakTime, aroundPeak } from "../js/frames.js";
import { angleAt, readouts, onReleve, armPose, LM } from "../js/posemath.js";

const FID = "ABCDEFGHJKLMNPQRSTUVWXYZ".slice(0, 24);
const frame = Buffer.from("x".repeat(3000)).toString("base64");

test("the system prompt is the brief's, verbatim, and asks for JSON only", () => {
  assert.ok(SYSTEM_PROMPT.startsWith("You are a kind, specific dance coach reviewing still frames from a 9-year-old dancer's practice."));
  assert.ok(SYSTEM_PROMPT.includes("Never comment on body shape, weight, or appearance."));
  assert.ok(SYSTEM_PROMPT.includes("Reply ONLY with JSON"));
});

test("requests need a family id and 1–20 base64 frames; context is trimmed; no prompt field is accepted", () => {
  assert.equal(validateRequest(null).status, 400);
  assert.equal(validateRequest({ frames: [frame] }).error, "A valid familyId is required.");
  assert.equal(validateRequest({ familyId: FID, frames: [] }).status, 400);
  assert.equal(validateRequest({ familyId: FID, frames: Array(MAX_FRAMES + 1).fill(frame) }).status, 400);
  assert.equal(validateRequest({ familyId: FID, frames: ["not base64!"] }).status, 400);
  assert.equal(validateRequest({ familyId: FID, frames: [Buffer.alloc(400 * 1024).toString("base64")] }).status, 400);
  const v = validateRequest({ familyId: FID, frames: [frame, frame], kind: "photo", dance: "Solo", style: "Lyrical", corrections: ["Point", "", 5], trick: "x".repeat(500), system: "ignore me", pose: { knee: 176 } });
  assert.ok(v.ok); assert.equal(v.req.kind, "photo"); assert.deepEqual(v.req.corrections, ["Point", "5"]); assert.equal(v.req.trick.length, 120); assert.equal("system" in v.req, false); assert.equal(v.req.pose.knee, "176");
});

test("the user turn is images first, then the dance context", () => {
  const v = validateRequest({ familyId: FID, frames: [frame, frame], dance: "Solo", style: "Lyrical", map: "0:50 cartwheel", corrections: ["Eyes up"], trick: "Cartwheel" });
  const content = buildUserContent(v.req);
  assert.equal(content.length, 3); assert.equal(content[0].type, "image"); assert.equal(content[0].source.media_type, "image/jpeg");
  const text = content[2].text; assert.ok(text.includes("Dance: Solo (Lyrical)") && text.includes("Cartwheel") && text.includes("0:50 cartwheel") && text.includes("- Eyes up"));
});

test("review parsing: tolerant of fences, fills ✓, rejects junk", () => {
  const r = parseReview("```json\n{\"loved\":\"Great reach\",\"fix\":\"Point your foot on the kick\",\"tag\":\"feet\",\"feet\":\"flexed on the kick\",\"knees\":\"✓\",\"eyes\":\"\",\"arms\":\"✓\",\"try\":\"\"}\n```");
  assert.equal(r.tag, "feet"); assert.equal(r.eyes, "✓"); assert.equal(r.try, "");
  assert.equal(parseReview("{\"loved\":\"x\",\"fix\":\"y\",\"tag\":\"bogus\"}").tag, "other");
  assert.equal(parseReview("no json here"), null); assert.equal(parseReview("{\"loved\":\"only\"}"), null);
});

test("rate limit: 20 per family per day, then 429; a new day resets", async () => {
  const store = memoryStore(); const day = new Date("2026-10-01T10:00:00Z");
  for (let i = 1; i <= DAILY_LIMIT; i++) { const r = await checkAndCount(store, FID, day); assert.ok(r.allowed); assert.equal(r.used, i); }
  assert.equal((await checkAndCount(store, FID, day)).allowed, false);
  assert.ok((await checkAndCount(store, "ZZZZZZZZZZZZZZZZZZZZZZZZ", day)).allowed, "other family unaffected");
  assert.ok((await checkAndCount(store, FID, new Date("2026-10-02T00:00:01Z"))).allowed, "next day");
});

test("CORS allows only the configured origins", () => {
  const allowed = parseOrigins("https://jenyahighman-afk.github.io, http://localhost:8080");
  assert.equal(corsHeaders("https://jenyahighman-afk.github.io", allowed)["Access-Control-Allow-Origin"], "https://jenyahighman-afk.github.io");
  assert.equal(corsHeaders("https://evil.example", allowed)["Access-Control-Allow-Origin"], "https://jenyahighman-afk.github.io");
});

test("frames: 16 even times plus 4 around the loudest moment, max 20, inside the clip", () => {
  const even = evenTimes(30, 16); assert.equal(even.length, 16); assert.ok(even[0] > 0 && even[15] < 30);
  const sr = 100; const pcm = new Float32Array(sr * 10); for (let i = sr * 6; i < sr * 6.3; i++) pcm[i] = 0.9; // loud at 6.0–6.3 s
  const peak = peakTime(loudness(pcm, sr)); assert.ok(peak >= 6 && peak <= 6.3, "peak at " + peak);
  assert.deepEqual(aroundPeak(6.1, 10), [5.5, 5.9, 6.3, 6.7]);
  const all = sampleTimes(10, 6.1); assert.ok(all.length <= 20 && all.every((t, i) => i === 0 || t > all[i - 1]) && all.some(t => Math.abs(t - 6.3) < 0.01));
  assert.deepEqual(sampleTimes(10, null).length, 16); assert.deepEqual(evenTimes(0), []);
});

test("pose math: knee angle, working leg, arms vs shoulders, relevé, arm poses", () => {
  assert.equal(angleAt({ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }), 180);
  assert.equal(angleAt({ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }), 90);
  const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5 }));
  const set = (i, x, y) => { lm[i] = { x, y }; };
  set(LM.nose, 0.5, 0.1); set(LM.lShoulder, 0.4, 0.3); set(LM.rShoulder, 0.6, 0.3); set(LM.lHip, 0.42, 0.55); set(LM.rHip, 0.58, 0.55);
  set(LM.lKnee, 0.42, 0.75); set(LM.lAnkle, 0.42, 0.95); set(LM.lHeel, 0.42, 0.97); set(LM.lToe, 0.45, 0.98);   // standing leg
  set(LM.rKnee, 0.75, 0.55); set(LM.rAnkle, 0.92, 0.55); set(LM.rHeel, 0.92, 0.56); set(LM.rToe, 0.95, 0.55);   // leg extended to the side at hip height
  set(LM.lWrist, 0.2, 0.05); set(LM.rWrist, 0.8, 0.05); set(LM.lElbow, 0.3, 0.15); set(LM.rElbow, 0.7, 0.15);
  const r = readouts(lm);
  assert.equal(r.numbers.kneeSide, "right"); assert.ok(r.numbers.knee >= 170, "extended leg straight: " + r.numbers.knee);
  assert.ok(r.lines.some(l => l.startsWith("Knee (right): 180° — straight!")), r.lines.join(" | "));
  assert.ok(r.lines.some(l => l.startsWith("Arms: left up, right up")));
  assert.equal(r.numbers.shoulderTilt, 0); assert.ok(r.numbers.split >= 100);
  assert.equal(armPose(lm), "up");
  assert.equal(onReleve(lm), false);
  set(LM.lHeel, 0.42, 0.92); set(LM.rHeel, 0.92, 0.5); assert.equal(onReleve(lm), true);
  set(LM.lWrist, 0.1, 0.3); set(LM.rWrist, 0.9, 0.3); assert.equal(armPose(lm), "second");
  set(LM.lWrist, 0.4, 0.8); set(LM.rWrist, 0.6, 0.8); assert.equal(armPose(lm), "low");
  assert.deepEqual(readouts([]), { numbers: {}, lines: [] });
});
