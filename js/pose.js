// MediaPipe Pose Landmarker (Tasks Vision, pinned CDN). Runs on the phone; nothing leaves the device.
// detectImage(img|canvas) → landmarks[] | null. drawSkeleton(ctx, lm, w, h). Also the live VIDEO-mode detector for the Mirror game.
import { BONES } from "./posemath.js";

const VISION_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/vision_bundle.mjs";
const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm";
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

let vision = null, imageLM = null, videoLM = null, loading = null;
export const poseAvailable = () => typeof WebAssembly !== "undefined";
async function load(){
  if (vision) return vision;
  loading ||= (async () => { const mod = await import(/* webpackIgnore: true */ VISION_URL); const fs = await mod.FilesetResolver.forVisionTasks(WASM_URL); vision = { mod, fs }; return vision; })();
  return loading;
}
export async function imageDetector(){ if (imageLM) return imageLM; const { mod, fs } = await load(); imageLM = await mod.PoseLandmarker.createFromOptions(fs, { baseOptions: { modelAssetPath: MODEL_URL }, runningMode: "IMAGE", numPoses: 1 }); return imageLM; }
export async function videoDetector(){ if (videoLM) return videoLM; const { mod, fs } = await load(); videoLM = await mod.PoseLandmarker.createFromOptions(fs, { baseOptions: { modelAssetPath: MODEL_URL }, runningMode: "VIDEO", numPoses: 1 }); return videoLM; }

export async function detectImage(source){ const d = await imageDetector(); const r = d.detect(source); return r && r.landmarks && r.landmarks[0] ? r.landmarks[0] : null; }
export async function detectVideoFrame(video, ts){ const d = await videoDetector(); const r = d.detectForVideo(video, ts); return r && r.landmarks && r.landmarks[0] ? r.landmarks[0] : null; }

export function drawSkeleton(ctx, lm, w, h, color = "#FF5C93"){
  if (!lm) return; ctx.save(); ctx.lineWidth = Math.max(2, w / 160); ctx.strokeStyle = color; ctx.fillStyle = "#fff"; ctx.lineCap = "round";
  for (const [a, b] of BONES) { const p = lm[a], q = lm[b]; if (!p || !q) continue; ctx.beginPath(); ctx.moveTo(p.x * w, p.y * h); ctx.lineTo(q.x * w, q.y * h); ctx.stroke(); }
  for (const i of [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]) { const p = lm[i]; if (!p) continue; ctx.beginPath(); ctx.arc(p.x * w, p.y * h, Math.max(2.5, w / 110), 0, 7); ctx.fill(); ctx.stroke(); }
  ctx.restore();
}
