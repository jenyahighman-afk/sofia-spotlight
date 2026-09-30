// Cue sheet helpers (pure; tested in Node). A cue = { t: seconds, lyric: "words sung here", move: "what she does" }.
// Text form, one cue per line:  m:ss | words | move   (either words or move may be empty).
export const parseTime = (s) => { const m = /^(\d+):(\d{2})(?:\.(\d))?$/.exec(String(s).trim()); if (m) return +m[1] * 60 + +m[2] + (m[3] ? +m[3] / 10 : 0); const n = parseFloat(s); return Number.isFinite(n) && n >= 0 ? n : null; };
export const fmtTime = (t) => { t = Math.max(0, +t || 0); const s = Math.floor(t % 60), m = Math.floor(t / 60); return m + ":" + String(s).padStart(2, "0"); };

export function normalizeCues(cues){
  return (Array.isArray(cues) ? cues : []).map(c => ({ t: typeof c.t === "number" ? c.t : parseTime(c.t), lyric: String(c.lyric || "").trim(), move: String(c.move || "").trim() })).filter(c => c.t !== null && (c.lyric || c.move)).sort((a, b) => a.t - b.t);
}
export function parseCueText(text){
  const out = [];
  for (const raw of String(text || "").split("\n")) { const line = raw.trim(); if (!line) continue; const parts = line.split("|").map(x => x.trim()); const t = parseTime(parts[0]); if (t === null) continue; out.push({ t, lyric: parts[1] || "", move: parts.slice(2).join(" | ") || "" }); }
  return normalizeCues(out);
}
export const formatCueText = (cues) => normalizeCues(cues).map(c => `${fmtTime(c.t)} | ${c.lyric} | ${c.move}`).join("\n");

// What to show at time t: the cue that's on now, the next one, and whether it's about to land (within `lead` seconds).
export function cueAt(cues, t, lead = 4){
  const list = normalizeCues(cues); let cur = null, next = null;
  for (const c of list) { if (c.t <= t) cur = c; else { next = c; break; } }
  return { cur, next, soon: !!(next && next.t - t <= lead), untilNext: next ? Math.max(0, next.t - t) : null, index: cur ? list.indexOf(cur) : -1, total: list.length };
}
// Seed cues from a "Where the big moments land" map: every "m:ss words" becomes a move cue with no lyric.
export function cuesFromMap(map){
  return normalizeCues([...String(map || "").matchAll(/(\d+:\d{2})\s*([^·,;\n]*)/g)].map(m => ({ t: parseTime(m[1]), lyric: "", move: m[2].trim().replace(/^[—–-]\s*/, "").replace(/\(.*?\)/g, "").trim() })));
}
