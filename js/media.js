// Client-side media prep: photos are shrunk to 1600px max before upload.
export const PHOTO_MAX = 1600;
export const VIDEO_MAX_BYTES = 50 * 1024 * 1024;

function loadImage(file){
  return new Promise((res, rej) => { const url = URL.createObjectURL(file); const img = new Image(); img.onload = () => { URL.revokeObjectURL(url); res(img); }; img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("Not an image we can read")); }; img.src = url; });
}

// Returns { blob, w, h, type }. Browsers apply EXIF orientation when drawing, so the result is upright.
export async function resizeImage(file, max = PHOTO_MAX){
  const img = await loadImage(file);
  const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale)), h = Math.max(1, Math.round(img.naturalHeight * scale));
  const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
  const ctx = cv.getContext("2d"); ctx.drawImage(img, 0, 0, w, h);
  const blob = await new Promise((res, rej) => cv.toBlob(b => b ? res(b) : rej(new Error("Could not encode the photo")), "image/jpeg", 0.86));
  return { blob, w, h, type: "image/jpeg" };
}

export function extOf(name, type){ const m = /\.([a-z0-9]{1,5})$/i.exec(name || ""); if (m) return m[1].toLowerCase(); const t = { "image/jpeg": "jpg", "image/png": "png", "audio/mpeg": "mp3", "audio/mp4": "m4a", "video/mp4": "mp4", "video/quicktime": "mov", "application/pdf": "pdf" }; return t[type] || "bin"; }
