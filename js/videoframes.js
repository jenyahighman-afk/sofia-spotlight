// Reading still frames out of a clip, in a way iPhone Safari cooperates with: load explicitly, prime the decoder with a
// muted play/pause, time-box every step so nothing can hang, and skip a frame rather than stall on it.
export const withTimeout = (p, ms, msg) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(msg || "Timed out")), ms))]);

export async function openClip(file){
  const url = URL.createObjectURL(file); const video = document.createElement("video");
  video.muted = true; video.playsInline = true; video.setAttribute("playsinline", ""); video.setAttribute("webkit-playsinline", ""); video.preload = "auto"; video.crossOrigin = "anonymous"; video.src = url;
  try { video.load(); } catch (e) {}
  await withTimeout(new Promise((res, rej) => { if (video.readyState >= 1) return res(); video.onloadedmetadata = res; video.onerror = () => rej(new Error("This clip can't be read on this phone. Try picking it from Photos, or a different clip.")); }), 20000, "The clip took too long to open. Try a shorter one, or pick it from Photos.");
  // Prime: iOS won't paint frames for a video that has never played.
  try { await withTimeout(video.play(), 4000); video.pause(); } catch (e) { try { video.pause(); } catch (e2) {} }
  if (video.readyState < 2) { try { await withTimeout(new Promise(res => { video.onloadeddata = res; }), 8000); } catch (e) {} }
  return { video, url, close: () => { try { video.pause(); video.removeAttribute("src"); video.load(); } catch (e) {} URL.revokeObjectURL(url); } };
}
// Seek and wait for the frame. Resolves true when the frame is ready, false when the phone never answered (caller skips it).
export async function seekTo(video, t, ms = 4000){
  if (Math.abs(video.currentTime - t) < 0.01 && video.readyState >= 2) return true;
  try {
    await withTimeout(new Promise((res) => { const done = () => { video.removeEventListener("seeked", done); res(); }; video.addEventListener("seeked", done); try { if (video.fastSeek && false) video.fastSeek(t); else video.currentTime = t; } catch (e) { res(); } }), ms);
    if (video.readyState < 2) await withTimeout(new Promise(res => { const ok = () => { video.removeEventListener("canplay", ok); res(); }; video.addEventListener("canplay", ok); }), 1500).catch(() => {});
    return true;
  } catch (e) { return false; }
}
// True when a canvas is (nearly) one flat colour — a frame the phone failed to paint.
export function isBlank(cv){
  try { const ctx = cv.getContext("2d"); const w = cv.width, h = cv.height; const d = ctx.getImageData(Math.floor(w * 0.25), Math.floor(h * 0.25), Math.max(1, Math.floor(w * 0.5)), Math.max(1, Math.floor(h * 0.5))).data; let min = 255, max = 0; for (let i = 0; i < d.length; i += 40) { const v = (d[i] + d[i + 1] + d[i + 2]) / 3; if (v < min) min = v; if (v > max) max = v; } return max - min < 6; } catch (e) { return false; }
}
