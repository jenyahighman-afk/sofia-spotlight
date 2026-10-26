// Finding the dancer in coach frames (pure; tested in Node). MediaPipe can return up to 3 poses per frame: Sofia, a
// mirror reflection, a parent or sibling in the background. A chair, a mat or a mirror frame has no pose at all, or a
// ghost pose with low visibility. The coach sends only crops of the dancer, plus pose numbers for the joints that were
// really seen, so the model can't mistake furniture or another person for her body.
// Landmarks: MediaPipe Pose, 33 points, normalized {x, y, visibility} (y grows downward).
import { LM, angleAt } from "./posemath.js";

export const MIN_VIS = 0.6;      // a joint (and a frame's average) must be seen this clearly to count
export const PAD = 0.15;         // crop padding around the dancer's box, per side, as a share of the box
// The body points that decide whether a pose is a real, clearly seen person (the face mesh points are left out).
export const BODY = [LM.nose, LM.lShoulder, LM.rShoulder, LM.lElbow, LM.rElbow, LM.lWrist, LM.rWrist, LM.lHip, LM.rHip, LM.lKnee, LM.rKnee, LM.lAnkle, LM.rAnkle];
const visOf = (p) => !p ? 0 : (typeof p.visibility === "number" ? p.visibility : 1);
const ok = (lm) => Array.isArray(lm) && lm.length >= 33;

// Average visibility of the body points (0–1). A frame whose chosen pose is below MIN_VIS is dropped, not sent.
export function avgVisibility(lm){ if (!ok(lm)) return 0; return BODY.reduce((s, i) => s + visOf(lm[i]), 0) / BODY.length; }
// The box around the points seen at least `minVis` (normalized). Null if fewer than 4 such points.
export function bboxOf(lm, minVis = 0.3){
  if (!ok(lm)) return null; const pts = lm.filter(p => p && visOf(p) >= minVis && Number.isFinite(p.x) && Number.isFinite(p.y)); if (pts.length < 4) return null;
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y); return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}
export const area = (b) => b ? Math.max(0, b.x1 - b.x0) * Math.max(0, b.y1 - b.y0) : 0;
export const center = (b) => b ? { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 } : null;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
// Box + `pad` per side (share of its width/height), clamped to the frame.
export function padBox(b, pad = PAD){ if (!b) return null; const w = b.x1 - b.x0, h = b.y1 - b.y0; return { x0: Math.max(0, b.x0 - w * pad), y0: Math.max(0, b.y0 - h * pad), x1: Math.min(1, b.x1 + w * pad), y1: Math.min(1, b.y1 + h * pad) }; }
// Pixel rectangle for drawing the crop out of a w×h frame.
export function cropRect(b, w, h){ const x = Math.floor(b.x0 * w), y = Math.floor(b.y0 * h); return { x, y, w: Math.max(1, Math.ceil(b.x1 * w) - x), h: Math.max(1, Math.ceil(b.y1 * h) - y) }; }
// How likely a pose is the dancer when nothing else is known: big, clearly seen and near the middle of the frame.
export function dancerScore(lm){ const b = bboxOf(lm); if (!b) return 0; const c = center(b); return area(b) * avgVisibility(lm) * (1 - Math.min(1, dist(c, { x: 0.5, y: 0.5 }) / 0.71) * 0.6); }
// Clearly seen people in one frame (avg visibility ≥ MIN_VIS): the candidates for "who is the dancer".
export const people = (poses) => (poses || []).filter(lm => ok(lm) && avgVisibility(lm) >= MIN_VIS && bboxOf(lm));
// Ask the grown-up to tap the dancer when the first frame with anyone in it has two or more clearly seen people of
// comparable size (a mirror reflection, a sibling). Returns that frame's index, or -1 when no tap is needed.
export function needsTap(posesPerFrame){
  for (let i = 0; i < (posesPerFrame || []).length; i++) { const ps = people(posesPerFrame[i]); if (!ps.length) continue; if (ps.length < 2) return -1; const a = ps.map(lm => area(bboxOf(lm))).sort((x, y) => y - x); return a[1] / a[0] > 0.35 ? i : -1; }
  return -1;
}
// The pose the tap landed on (inside its padded box, else the nearest centre).
export function poseAtTap(poses, tap){ const ps = people(poses); if (!ps.length || !tap) return null; const inside = ps.filter(lm => { const b = padBox(bboxOf(lm), 0.1); return tap.x >= b.x0 && tap.x <= b.x1 && tap.y >= b.y0 && tap.y <= b.y1; }); const pool = inside.length ? inside : ps; return pool.reduce((best, lm) => !best || dist(center(bboxOf(lm)), tap) < dist(center(bboxOf(best)), tap) ? lm : best, null); }
// The dancer in every frame, the same person throughout: the first frame's pick (the tap, else the best score), then in
// each next frame the clearly seen pose nearest to where she was, as long as it's within reach (`jump` of the frame);
// otherwise the best-scoring one — unless that one is both far away and much smaller than she has been (a person or a
// reflection at the edge while she is on the floor, unseen): then nobody. A frame with nobody gives null (it is dropped).
export function pickDancer(posesPerFrame, { tap = null, tapFrame = -1, jump = 0.35 } = {}){
  const out = []; let last = null; const sizes = [];
  (posesPerFrame || []).forEach((poses, i) => {
    const ps = people(poses); let pick = null;
    if (!ps.length) { out.push(null); return; }
    if (tap && (i === tapFrame || (tapFrame < 0 && !last))) pick = poseAtTap(poses, tap);
    if (!pick && last) { const near = ps.map(lm => ({ lm, d: dist(center(bboxOf(lm)), last) })).sort((a, b) => a.d - b.d)[0]; if (near && near.d <= jump) pick = near.lm; }
    if (!pick) {
      pick = ps.reduce((best, lm) => !best || dancerScore(lm) > dancerScore(best) ? lm : best, null);
      const typical = sizes.length ? [...sizes].sort((a, b) => a - b)[Math.floor(sizes.length / 2)] : 0;
      if (last && area(bboxOf(pick)) < typical * 0.3) { out.push(null); return; }
    }
    last = center(bboxOf(pick)); sizes.push(area(bboxOf(pick))); out.push(pick);
  });
  return out;
}

// Knee, foot and alignment numbers from one pose, only for joints seen at MIN_VIS or better (else left out, so the coach
// says nothing about them). Sides are the dancer's own left and right.
//   knee: angle at the knee (180 = straight) · foot: angle at the ankle between shin and foot (bigger = more pointed)
//   kneeOverToe: on a bent knee, "over toes" / "falls in" / "out" from where the knee sits vs the foot, sideways.
export function poseMetrics(lm){
  if (!ok(lm)) return {}; const out = {}; const seen = (i) => visOf(lm[i]) >= MIN_VIS ? lm[i] : null;
  const hipMid = seen(LM.lHip) && seen(LM.rHip) ? (lm[LM.lHip].x + lm[LM.rHip].x) / 2 : null;
  for (const [side, H, K, A, T] of [["Left", LM.lHip, LM.lKnee, LM.lAnkle, LM.lToe], ["Right", LM.rHip, LM.rKnee, LM.rAnkle, LM.rToe]]) {
    const h = seen(H), k = seen(K), a = seen(A), t = seen(T);
    if (h && k && a) { const ang = angleAt(h, k, a); if (ang !== null) out["knee" + side] = ang; }
    if (k && a && t) { const f = angleAt(k, a, t); if (f !== null) out["foot" + side] = f; }
    if (h && k && a && t && hipMid !== null) {
      const ang = angleAt(h, k, a), shin = Math.hypot(k.x - a.x, k.y - a.y) || 1, footX = (a.x + t.x) / 2;
      if (ang !== null && ang < 160) { const off = (k.x - footX) / shin; const inward = Math.abs(k.x - hipMid) < Math.abs(footX - hipMid); out["kneeOverToe" + side] = Math.abs(off) <= 0.2 ? "over toes" : inward ? "falls in" : "out"; }
    }
  }
  return out;
}
// The joints seen at MIN_VIS or better, by name (what the coach may talk about).
const NAMES = { [LM.nose]: "head", [LM.lShoulder]: "left shoulder", [LM.rShoulder]: "right shoulder", [LM.lElbow]: "left elbow", [LM.rElbow]: "right elbow", [LM.lWrist]: "left wrist", [LM.rWrist]: "right wrist", [LM.lHip]: "left hip", [LM.rHip]: "right hip", [LM.lKnee]: "left knee", [LM.rKnee]: "right knee", [LM.lAnkle]: "left ankle", [LM.rAnkle]: "right ankle", [LM.lToe]: "left foot", [LM.rToe]: "right foot" };
export function visibleParts(lm){ if (!ok(lm)) return []; return Object.entries(NAMES).filter(([i]) => visOf(lm[+i]) >= MIN_VIS).map(([, n]) => n); }
// One frame's line for the coach: its time, the parts seen, the numbers.
export function frameReport(lm, t = null){ return { t: t === null ? null : Math.round(t * 10) / 10, vis: +avgVisibility(lm).toFixed(2), parts: visibleParts(lm), ...poseMetrics(lm) }; }
