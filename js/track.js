// A dance's music track as a local object URL: downloaded once per session (through the service worker's media cache,
// so it plays offline next time) and shared by the practice player, cue cards, memorize mode and the cue check tool.
const AUDIO_RE = /\.(mp3|m4a|aac|wav|ogg|oga|flac|webm)(\?.*)?$/i;
const cache = {}; // danceId|url → object URL

export function srcFor(d){ if (d && d.musicFile && d.musicFile.url) return { url: d.musicFile.url, kind: "file" }; if (d && d.musicUrl && AUDIO_RE.test(d.musicUrl)) return { url: d.musicUrl, kind: "link" }; return null; }
// Resolves to { url, streamed } — the local copy, or the remote URL when the download failed (it then streams, online only).
export async function trackUrl(d){
  const src = srcFor(d); if (!src) return null; const key = d.id + "|" + src.url;
  if (cache[key]) return { url: cache[key], streamed: false };
  try { const res = await fetch(src.url); if (!res.ok) throw new Error("HTTP " + res.status); cache[key] = URL.createObjectURL(await res.blob()); return { url: cache[key], streamed: false }; }
  catch (e) { console.warn("track: download failed, streaming instead", e); return { url: src.url, streamed: true, link: src.kind === "link" }; }
}
