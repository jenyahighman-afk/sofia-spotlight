// Cue sheet helpers (pure; tested in Node). A cue = { t: seconds, lyric: "words sung here", move: "what she does" }.
// Text form, one cue per line:  m:ss | words | move   (either words or move may be empty).
// A cue TABLE (the solo since 1.22.0, imported from the verified cue pack by tools/import-cues.cjs) also carries
// n (its number), end (seconds: the cue is on for [t, end) and never holds past it), trick (a key trick: bold card),
// photo (the cue-pack file name of Sofia in that shape), pt (the photo's moment) and hannahWord (Hannah's 1–4 cue words).
// The spec's names are accepted on the way in: start → t, label → move.
export const parseTime = (s) => { const m = /^(\d+):(\d{1,2}(?:\.\d+)?)$/.exec(String(s).trim()); if (m) return +m[1] * 60 + +m[2]; const n = parseFloat(s); return Number.isFinite(n) && n >= 0 ? n : null; };
export const fmtTime = (t) => { t = Math.max(0, +t || 0); const s = Math.floor(t % 60), m = Math.floor(t / 60); return m + ":" + String(s).padStart(2, "0"); };
// Exact form for cue tables: 1:07.75, 0:10.5, 0:48 (two decimals at most, trailing zeros dropped).
export const fmtCueTime = (t) => { t = Math.max(0, Math.round((+t || 0) * 100) / 100); const m = Math.floor(t / 60); const s = +(t - m * 60).toFixed(2); const whole = Math.floor(s); const frac = String(+(s - whole).toFixed(2)).replace(/^0/, ""); return m + ":" + String(whole).padStart(2, "0") + (frac && frac !== "0" ? frac : ""); };

const num = (v) => typeof v === "number" && Number.isFinite(v) ? v : parseTime(v);
export function normalizeCues(cues){
  return (Array.isArray(cues) ? cues : []).map(c => {
    if (!c || typeof c !== "object") return null;
    const out = { t: num(c.t !== undefined ? c.t : c.start), lyric: String(c.lyric || "").trim(), move: String(c.move || c.label || "").trim() };
    if (out.t === null) return null;
    const end = c.end === undefined || c.end === null || c.end === "" ? null : num(c.end); if (end !== null && end > out.t) out.end = end;
    if (Number.isInteger(c.n) && c.n > 0) out.n = c.n; if (c.trick) out.trick = true;
    if (typeof c.photo === "string" && c.photo) out.photo = c.photo; if (Number.isFinite(+c.pt) && c.pt !== null && c.pt !== "") out.pt = +c.pt;
    const word = String(c.hannahWord || "").trim(); if (word) out.hannahWord = word.slice(0, 40);
    return out;
  }).filter(c => c && (c.lyric || c.move)).sort((a, b) => a.t - b.t);
}
// A table (numbered cues with ends) is edited in the cue check tool, never as text: the text form would drop its fields.
export const isCueTable = (cues) => Array.isArray(cues) && cues.length > 0 && cues.every(c => c && Number.isInteger(c.n) && c.end !== undefined);
export function parseCueText(text){
  const out = [];
  for (const raw of String(text || "").split("\n")) { const line = raw.trim(); if (!line) continue; const parts = line.split("|").map(x => x.trim()); const t = parseTime(parts[0]); if (t === null) continue; out.push({ t, lyric: parts[1] || "", move: parts.slice(2).join(" | ") || "" }); }
  return normalizeCues(out);
}
export const formatCueText = (cues) => normalizeCues(cues).map(c => `${fmtTime(c.t)} | ${c.lyric} | ${c.move}`).join("\n");

// What to show at time t: the cue that's on now, the next one, and whether it's about to land (within `lead` seconds).
// A cue with an `end` is on for [t, end) only; past its end (a gap before the next cue) nothing is on.
export function cueAt(cues, t, lead = 4){
  const list = normalizeCues(cues); let cur = null, next = null;
  for (const c of list) { if (c.t <= t) cur = c; else { next = c; break; } }
  if (cur && cur.end !== undefined && t >= cur.end) cur = null;
  return { cur, next, soon: !!(next && next.t - t <= lead), untilNext: next ? Math.max(0, next.t - t) : null, index: cur ? list.indexOf(cur) : -1, total: list.length };
}
// The key trick coming up within `lead` seconds (the player's "next" preview), or null. Short cues in between (the run
// to the mat before the donut roll) don't hide it.
export function trickAhead(cues, t, lead = 2){ const next = normalizeCues(cues).find(c => c.trick && c.t > t); return next && next.t - t <= lead ? next : null; }
// Move one cue's start by `delta` seconds (the cue check tool's ±0.25 s). The cue before it ends where this one starts,
// so the table stays gapless; nothing moves past its neighbours (at least 0.25 s each). Returns a new list.
export function nudgeCue(cues, n, delta){
  const list = normalizeCues(cues).map(c => ({ ...c })); const i = list.findIndex(c => c.n === n); if (i < 0) return list;
  const c = list[i], prev = list[i - 1]; const lo = prev ? prev.t + 0.25 : 0; const hi = (c.end !== undefined ? c.end : Infinity) - 0.25;
  const t = Math.round(Math.max(lo, Math.min(hi, c.t + delta)) * 100) / 100; c.t = t; if (prev && prev.end !== undefined) prev.end = t;
  return list;
}
// The cue check tool's saved nudges ({ [n]: start }) over a table: each moved cue gets its new start and the cue before
// it ends there, so the table stays gapless. Pure; store.dances() applies it to the merged dance.
export function applyCueTimes(cues, times){
  const list = normalizeCues(cues).map(c => ({ ...c })); if (!times || typeof times !== "object") return list;
  for (let i = 0; i < list.length; i++) { const c = list[i]; const t = c.n !== undefined ? +times[c.n] : NaN; if (!Number.isFinite(t)) continue; const prev = list[i - 1]; if (prev && prev.end !== undefined && Math.abs(prev.end - c.t) < 1e-6) prev.end = t; c.t = t; }
  return list.filter(c => c.end === undefined || c.end > c.t).sort((a, b) => a.t - b.t);
}
// The nudges to save: start times that differ from the built-in table's.
export function cueTimesDiff(base, edited){ const b = new Map(normalizeCues(base).map(c => [c.n, c.t])); const out = {}; for (const c of normalizeCues(edited)) if (c.n !== undefined && b.has(c.n) && Math.abs(b.get(c.n) - c.t) > 1e-6) out[c.n] = c.t; return out; }
// Seed cues from a "Where the big moments land" map: every "m:ss words" becomes a move cue with no lyric.
export function cuesFromMap(map){
  return normalizeCues([...String(map || "").matchAll(/(\d+:\d{2}(?:\.\d+)?)\s*([^·,;\n]*)/g)].map(m => ({ t: parseTime(m[1]), lyric: "", move: m[2].trim().replace(/^[—–-]\s*/, "").replace(/\(.*?\)/g, "").trim() })));
}

// ---- Song words (karaoke, 1.44.0) ----
// dance.lyrics: the song's words as the family typed them on the phone (one sung line per line; family space only — the
// repo is public and never ships lyrics). dance.lyricTimes[i]: when line i starts, seconds into the track (null = not
// timed yet; the player's ⏱ Time the words fills it in). dance.lyricSnaps (data-owned, times only): sung-line onsets heard
// in the run-through, which a tap snaps to. The player shows the line now with a colour wipe, the 8-count in the corner.
export const MAX_LYRIC_LINES = 120;
export function lyricLines(text){ const raw = Array.isArray(text) ? text : String(text || "").split("\n"); return raw.map(s => String(s == null ? "" : s).trim()).filter(Boolean).slice(0, MAX_LYRIC_LINES); }
export function normalizeLyricTimes(times, n = MAX_LYRIC_LINES){
  const out = (Array.isArray(times) ? times : []).slice(0, n).map(v => { const x = typeof v === "number" ? v : (v === null || v === undefined || v === "" ? NaN : parseFloat(v)); return Number.isFinite(x) && x >= 0 && x < 3600 ? Math.round(x * 100) / 100 : null; });
  while (out.length && out[out.length - 1] === null) out.pop();
  return out;
}
// What's sung at t: the last timed line that has started, how far through it (to the next timed line, or `hold` seconds),
// the line before and the one coming. Untimed lines are skipped; with no timed line at all nothing is "now".
export function lyricAt(lines, times, t, hold = 5){
  const list = lyricLines(lines); const tm = normalizeLyricTimes(times, list.length);
  const timed = list.map((text, i) => ({ i, text, t: tm[i] === undefined ? null : tm[i] })).filter(l => l.t !== null).sort((a, b) => a.t - b.t || a.i - b.i);
  let k = -1; for (let j = 0; j < timed.length; j++) if (timed[j].t <= t) k = j;
  const cur = k >= 0 ? timed[k] : null, next = timed[k + 1] || null, prev = k > 0 ? timed[k - 1] : null;
  const end = cur ? (next ? next.t : cur.t + hold) : null;
  const progress = cur ? Math.max(0, Math.min(1, (t - cur.t) / Math.max(0.3, end - cur.t))) : 0;
  return { cur, next, prev, progress, untilNext: next ? Math.max(0, next.t - t) : null, timed: timed.length, total: list.length };
}
// A tap lands a little late: snap it to the nearest known onset within `within` seconds, else keep it (2 decimals).
export function snapTime(t, snaps, within = 0.6){
  let best = null; for (const s of normalizeLyricTimes(snaps)) if (s !== null && Math.abs(s - t) <= within && (best === null || Math.abs(s - t) < Math.abs(best - t))) best = s;
  return Math.round((best === null ? Math.max(0, +t || 0) : best) * 100) / 100;
}
// The 8-count at t from the dance's BPM and tapped count-1 offset: { beat, count 1–8 }, count 0 before the offset, null without a BPM.
export function countAt(t, bpm, offset = 0){ bpm = +bpm || 0; if (!(bpm > 0)) return null; const beat = Math.floor((t - (+offset || 0)) * bpm / 60); return { beat, count: beat < 0 ? 0 : (beat % 8) + 1 }; }
