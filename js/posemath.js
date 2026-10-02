// Pose math (pure; tested in Node). Landmarks are MediaPipe Pose indices with normalized {x, y} (y grows downward).
export const LM = { nose: 0, lShoulder: 11, rShoulder: 12, lElbow: 13, rElbow: 14, lWrist: 15, rWrist: 16, lHip: 23, rHip: 24, lKnee: 25, rKnee: 26, lAnkle: 27, rAnkle: 28, lHeel: 29, rHeel: 30, lToe: 31, rToe: 32 };
const deg = (r) => r * 180 / Math.PI;
export function angleAt(a, b, c){ // angle at b, degrees 0–180
  if (!a || !b || !c) return null; const v1 = [a.x - b.x, a.y - b.y], v2 = [c.x - b.x, c.y - b.y]; const l1 = Math.hypot(...v1), l2 = Math.hypot(...v2); if (!l1 || !l2) return null;
  return Math.round(deg(Math.acos(Math.max(-1, Math.min(1, (v1[0] * v2[0] + v1[1] * v2[1]) / (l1 * l2))))));
}
export const tiltDeg = (a, b) => (!a || !b) ? null : Math.round(Math.abs(deg(Math.atan2(b.y - a.y, b.x - a.x))) > 90 ? 180 - Math.abs(deg(Math.atan2(b.y - a.y, b.x - a.x))) : Math.abs(deg(Math.atan2(b.y - a.y, b.x - a.x))));
const vis = (p) => p && (p.visibility === undefined || p.visibility > 0.4);

// Friendly readouts from one frame's landmarks. Returns { numbers: {…}, lines: ["Knee: 176° — straight!", …] }.
export function readouts(lm){
  if (!Array.isArray(lm) || lm.length < 33) return { numbers: {}, lines: [] };
  const g = (i) => vis(lm[i]) ? lm[i] : null;
  const numbers = {}, lines = [];
  // Working leg = the leg whose ankle is higher (in the air); if both on the floor, the straighter one.
  const lKnee = angleAt(g(LM.lHip), g(LM.lKnee), g(LM.lAnkle)), rKnee = angleAt(g(LM.rHip), g(LM.rKnee), g(LM.rAnkle));
  const lUp = g(LM.lAnkle) && g(LM.rAnkle) ? g(LM.lAnkle).y < g(LM.rAnkle).y - 0.05 : false, rUp = g(LM.lAnkle) && g(LM.rAnkle) ? g(LM.rAnkle).y < g(LM.lAnkle).y - 0.05 : false;
  const working = lUp ? ["left", lKnee] : rUp ? ["right", rKnee] : (lKnee !== null && rKnee !== null ? (lKnee >= rKnee ? ["left", lKnee] : ["right", rKnee]) : (lKnee !== null ? ["left", lKnee] : ["right", rKnee]));
  if (working[1] !== null && working[1] !== undefined) { numbers.knee = working[1]; numbers.kneeSide = working[0]; lines.push(`Knee (${working[0]}): ${working[1]}° — ${working[1] >= 170 ? "straight!" : working[1] >= 150 ? "almost straight" : "bent"}`); }
  // Arm height vs the shoulder line: wrist above shoulder = "up".
  const sh = g(LM.lShoulder), sr = g(LM.rShoulder); const shoulderY = sh && sr ? (sh.y + sr.y) / 2 : null;
  const armLevel = (w) => (!w || shoulderY === null) ? null : w.y < shoulderY - 0.18 ? "up" : w.y < shoulderY + 0.05 ? "shoulder height" : "low";
  const la = armLevel(g(LM.lWrist)), ra = armLevel(g(LM.rWrist));
  if (la || ra) { numbers.arms = `${la || "?"} / ${ra || "?"}`; lines.push(`Arms: left ${la || "?"}, right ${ra || "?"}${la === "low" && ra === "low" ? " — lift them" : ""}`); }
  const st = tiltDeg(sh, sr); if (st !== null) { numbers.shoulderTilt = st; lines.push(`Shoulders: ${st <= 4 ? "level ✓" : "tilted " + st + "°"}`); }
  const ht = tiltDeg(g(LM.lHip), g(LM.rHip)); if (ht !== null) { numbers.hipTilt = ht; lines.push(`Hips: ${ht <= 4 ? "level ✓" : "tilted " + ht + "°"}`); }
  // Hip flexion / split angle: the angle between the two thighs at the hips (180 = flat split).
  const lh = g(LM.lHip), rh = g(LM.rHip), lk = g(LM.lKnee), rk = g(LM.rKnee);
  if (lh && rh && lk && rk) { const hip = { x: (lh.x + rh.x) / 2, y: (lh.y + rh.y) / 2 }; const split = angleAt(lk, hip, rk); if (split !== null) { numbers.split = split; lines.push(`Split: ${split}°${split >= 170 ? " — flat!" : split >= 140 ? " — nearly there" : ""}`); } }
  return { numbers, lines };
}
// Relevé: both heels clearly higher than the toes.
export function onReleve(lm){ if (!Array.isArray(lm) || lm.length < 33) return false; const up = (h, t) => lm[h] && lm[t] && lm[h].y < lm[t].y - 0.02; return up(LM.lHeel, LM.lToe) && up(LM.rHeel, LM.rToe); }
// Arm pose classification for the mirror game: "up" (both wrists above the nose), "second" (wrists at shoulder height, wide), "low", or "mixed".
export function armPose(lm){
  if (!Array.isArray(lm) || lm.length < 33) return null; const n = lm[LM.nose], lw = lm[LM.lWrist], rw = lm[LM.rWrist], ls = lm[LM.lShoulder], rs = lm[LM.rShoulder]; if (!n || !lw || !rw || !ls || !rs) return null;
  const width = Math.abs(ls.x - rs.x) || 0.2;
  // Forgiving on purpose: a phone propped low sees the arms foreshortened, so "up" is wrists above the shoulder line by
  // half a shoulder-width, "second" is roughly shoulder height and clearly wider than the shoulders, "low" is below the hips-ish.
  const shY = (ls.y + rs.y) / 2;
  const up = lw.y < shY - width * 0.5 && rw.y < shY - width * 0.5 && lw.y < n.y + width * 0.6 && rw.y < n.y + width * 0.6;
  const second = Math.abs(lw.y - shY) < width * 0.9 && Math.abs(rw.y - shY) < width * 0.9 && Math.abs(lw.x - rw.x) > width * 1.7 && !up;
  const low = lw.y > shY + width * 0.9 && rw.y > shY + width * 0.9;
  return up ? "up" : second ? "second" : low ? "low" : "mixed";
}
// Skeleton segments to draw.
export const BONES = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28], [27, 29], [29, 31], [27, 31], [28, 30], [30, 32], [28, 32]];

// Compact pose features for Dance Along: wrists and elbows relative to the shoulder centre (in shoulder widths), knee angles
// scaled to 0–1. Mirrored copies compare equal, so it doesn't matter which way the dancer in the clip faces.
export function poseFeatures(lm){
  if (!Array.isArray(lm) || lm.length < 33) return null; const g = (i) => lm[i]; const ls = g(LM.lShoulder), rs = g(LM.rShoulder); if (!ls || !rs) return null;
  const cx = (ls.x + rs.x) / 2, cy = (ls.y + rs.y) / 2, w = Math.max(0.05, Math.hypot(ls.x - rs.x, ls.y - rs.y));
  const rel = (p) => p ? [+( (p.x - cx) / w ).toFixed(2), +( (p.y - cy) / w ).toFixed(2)] : [0, 0];
  const lk = angleAt(g(LM.lHip), g(LM.lKnee), g(LM.lAnkle)) ?? 180, rk = angleAt(g(LM.rHip), g(LM.rKnee), g(LM.rAnkle)) ?? 180;
  return [...rel(g(LM.lWrist)), ...rel(g(LM.rWrist)), ...rel(g(LM.lElbow)), ...rel(g(LM.rElbow)), +(lk / 180).toFixed(2), +(rk / 180).toFixed(2)];
}
const flipF = (f) => [-f[2], f[3], -f[0], f[1], -f[6], f[7], -f[4], f[5], f[9], f[8]]; // swap left/right and mirror x
export function featureDistance(a, b){
  if (!a || !b) return Infinity; const dist = (p, q) => { let s = 0; for (let i = 0; i < 10; i++) { const wgt = i < 4 ? 1 : i < 8 ? 0.6 : 1.5; s += wgt * (p[i] - q[i]) * (p[i] - q[i]); } return Math.sqrt(s / 10); };
  return Math.min(dist(a, b), dist(a, flipF(b)));
}
