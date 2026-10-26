// Finding the dancer in coach frames: a second person, a chair or mat (a ghost pose, or none) and mirror reflections
// must never be what the coach looks at. The poses here are shaped like MediaPipe's output (33 landmarks, x/y 0–1).
import { test } from "node:test";
import assert from "node:assert/strict";
import { avgVisibility, bboxOf, padBox, cropRect, people, needsTap, pickDancer, poseAtTap, poseMetrics, visibleParts, frameReport, area, MIN_VIS } from "../js/dancer.js";

// A standing person centred at (cx, cy) and h tall (share of the frame), every point seen with `vis`.
// opts.plie bends both knees outward-over-toes; opts.kneesIn bends them falling in; opts.hide = indices seen poorly.
function person(cx, cy, h, vis = 0.95, opts = {}){
  const P = (dx, dy, v = vis) => ({ x: cx + dx * h, y: cy + dy * h, z: 0, visibility: v });
  const lm = Array.from({ length: 33 }, () => P(0, -0.45, vis * 0.5)); // face mesh points (not used for the body)
  const bent = opts.plie || opts.kneesIn; const kx = opts.kneesIn ? -0.02 : opts.plie ? 0.12 : 0.06, ky = bent ? 0.25 : 0.22, hy = bent ? 0.08 : 0;
  Object.assign(lm, { 0: P(0, -0.45), 11: P(0.1, -0.3), 12: P(-0.1, -0.3), 13: P(0.14, -0.12), 14: P(-0.14, -0.12), 15: P(0.15, 0.03), 16: P(-0.15, 0.03),
    23: P(0.06, hy), 24: P(-0.06, hy), 25: P(kx, ky), 26: P(-kx, ky), 27: P(0.08, 0.45), 28: P(-0.08, 0.45), 29: P(0.07, 0.47), 30: P(-0.07, 0.47), 31: P(0.12, 0.48), 32: P(-0.12, 0.48) });
  for (const i of opts.hide || []) lm[i] = { ...lm[i], visibility: 0.2 };
  return lm;
}
const SOFIA = () => person(0.5, 0.52, 0.8);           // big, in the middle
const MOM = () => person(0.9, 0.6, 0.42, 0.9);        // smaller, at the edge of the frame
const CHAIR = () => person(0.15, 0.8, 0.22, 0.3);     // a ghost "pose" on a chair or rolled mat: barely seen
const overlap = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));

test("a frame with Sofia, a second person and a chair/mat: only Sofia is picked, and the crop leaves the others out", () => {
  const frame = [MOM(), CHAIR(), SOFIA()]; // MediaPipe's order means nothing
  assert.ok(avgVisibility(CHAIR()) < MIN_VIS, "the chair's ghost pose is not a person"); assert.equal(people(frame).length, 2);
  assert.equal(needsTap([frame]), -1, "a much smaller second person needs no tap");
  const [pick] = pickDancer([frame]); assert.deepEqual(bboxOf(pick), bboxOf(SOFIA()));
  const crop = padBox(bboxOf(pick)); assert.ok(overlap(crop, bboxOf(MOM())) < 0.002, "the other person is outside the crop"); assert.equal(overlap(crop, bboxOf(CHAIR())), 0, "the chair is outside the crop");
  const r = cropRect(crop, 768, 432); assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= 768 && r.y + r.h <= 432 && r.w < 768 * 0.6);
  // The crop is the dancer's box plus 15% a side (clamped to the frame).
  const b = bboxOf(pick), w = b.x1 - b.x0; assert.ok(Math.abs((b.x0 - crop.x0) - 0.15 * w) < 1e-9);
});
test("frames with nobody clearly seen are dropped, not sent: only a chair/mat, an empty frame, a blurred dancer (avg visibility < 0.6)", () => {
  const blurred = person(0.5, 0.52, 0.8, 0.5); assert.ok(avgVisibility(blurred) < MIN_VIS);
  const picks = pickDancer([[SOFIA()], [CHAIR()], [], [blurred, CHAIR()], [SOFIA(), MOM()]]);
  assert.deepEqual(picks.map(p => !!p), [true, false, false, false, true]);
});
test("the same dancer all the way through: when the other person walks to the middle, the coach stays on Sofia", () => {
  const f1 = [SOFIA(), MOM()];
  const f2 = [person(0.44, 0.52, 0.8), person(0.62, 0.55, 0.85, 0.95)]; // Mom steps in, bigger and nearer the middle
  const f3 = [person(0.62, 0.55, 0.85, 0.95), person(0.4, 0.5, 0.78)];
  const picks = pickDancer([f1, f2, f3]); const cx = (lm) => { const b = bboxOf(lm); return (b.x0 + b.x1) / 2; };
  assert.ok(Math.abs(cx(picks[1]) - 0.44) < 0.01 && Math.abs(cx(picks[2]) - 0.4) < 0.01, "tracked by position, not by size");
});
test("she's on the floor and not detected, a small figure at the edge is: that frame is dropped, not given to the coach (real photo 22)", () => {
  const edge = person(0.05, 0.6, 0.25, 0.75); // what MediaPipe found in cue photo 22: one small pose at the left edge
  const picks = pickDancer([[SOFIA()], [person(0.52, 0.5, 0.78)], [edge], [person(0.5, 0.55, 0.8)]]);
  assert.deepEqual(picks.map(p => !!p), [true, true, false, true]);
  // A big, clear dancer who really travelled to the side is still followed.
  assert.ok(pickDancer([[SOFIA()], [person(0.92, 0.5, 0.75)]])[1], "a long way, but her size");
});
test("a mirror reflection the same size: the grown-up taps Sofia once, and she is followed in every frame", () => {
  const real = (x) => person(x, 0.52, 0.7), mirror = (x) => person(1 - x, 0.52, 0.68, 0.9);
  const frames = [[mirror(0.3), real(0.3)], [real(0.33), mirror(0.33)], [mirror(0.36), real(0.36)]];
  const tf = needsTap(frames); assert.equal(tf, 0, "two people of similar size: ask");
  const tap = { x: 0.3, y: 0.5 }; assert.ok(Math.abs((bboxOf(poseAtTap(frames[0], tap)).x0 + bboxOf(poseAtTap(frames[0], tap)).x1) / 2 - 0.3) < 0.01);
  const picks = pickDancer(frames, { tap, tapFrame: tf }); picks.forEach((lm, i) => { const b = bboxOf(lm); assert.ok(Math.abs((b.x0 + b.x1) / 2 - (0.3 + i * 0.03)) < 0.01, "frame " + (i + 1)); });
  assert.equal(needsTap([[], [SOFIA()]]), -1); assert.equal(needsTap([[CHAIR()], [SOFIA(), MOM()]]), -1);
});
test("pose numbers only for joints seen at ≥ 0.6: knees over toes, knees falling in, knee straightness, foot point", () => {
  const plie = poseMetrics(person(0.5, 0.5, 0.8, 0.95, { plie: true })); assert.equal(plie.kneeOverToeLeft, "over toes"); assert.equal(plie.kneeOverToeRight, "over toes"); assert.ok(plie.kneeLeft < 160);
  const inward = poseMetrics(person(0.5, 0.5, 0.8, 0.95, { kneesIn: true })); assert.equal(inward.kneeOverToeLeft, "falls in"); assert.equal(inward.kneeOverToeRight, "falls in");
  const stand = poseMetrics(SOFIA()); assert.ok(stand.kneeLeft >= 165, "straight standing knee"); assert.equal(stand.kneeOverToeLeft, undefined, "a straight knee has no alignment call"); assert.ok(typeof stand.footLeft === "number");
  // The left ankle hidden (behind a chair, off the mat): nothing is said about the left knee or foot.
  const hidden = person(0.5, 0.5, 0.8, 0.95, { hide: [27, 29, 31] }); const m = poseMetrics(hidden);
  assert.equal(m.kneeLeft, undefined); assert.equal(m.footLeft, undefined); assert.ok(typeof m.kneeRight === "number");
  assert.ok(!visibleParts(hidden).includes("left ankle") && visibleParts(hidden).includes("right ankle"));
  const rep = frameReport(hidden, 78.26); assert.equal(rep.t, 78.3); assert.ok(rep.vis >= MIN_VIS); assert.ok(!rep.parts.includes("left foot"));
  assert.ok(area(bboxOf(SOFIA())) > area(bboxOf(MOM())));
});
