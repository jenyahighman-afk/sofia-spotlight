// Frame sampling math (pure; tested in Node). The coach sends 16 frames spread evenly plus 4 around the loudest moment.
export function evenTimes(duration, n = 16){
  if (!(duration > 0) || n <= 0) return [];
  const pad = Math.min(0.25, duration / (n * 4)); const span = duration - 2 * pad;
  return Array.from({ length: n }, (_, i) => +(pad + (n === 1 ? span / 2 : span * i / (n - 1))).toFixed(2));
}
// RMS loudness per window from PCM samples.
export function loudness(samples, sampleRate, windowSec = 0.1){
  const win = Math.max(1, Math.floor(sampleRate * windowSec)); const out = [];
  for (let i = 0; i + win <= samples.length; i += win) { let s = 0; for (let j = i; j < i + win; j++) s += samples[j] * samples[j]; out.push(Math.sqrt(s / win)); }
  return out;
}
export function peakTime(rms, windowSec = 0.1){ if (!rms.length) return null; let best = 0; for (let i = 1; i < rms.length; i++) if (rms[i] > rms[best]) best = i; return +((best + 0.5) * windowSec).toFixed(2); }
export function aroundPeak(peak, duration, offsets = [-0.6, -0.2, 0.2, 0.6]){ if (peak === null || !(duration > 0)) return []; return offsets.map(o => +Math.max(0.05, Math.min(duration - 0.05, peak + o)).toFixed(2)); }
// All sample times, sorted, de-duplicated (two times within 0.15 s count as one).
export function sampleTimes(duration, peak){ const all = [...evenTimes(duration, 16), ...aroundPeak(peak, duration)].sort((a, b) => a - b); const out = []; for (const t of all) if (!out.length || t - out[out.length - 1] > 0.15) out.push(t); return out.slice(0, 20); }
// A full run (longer than RUN_SEC with a cue sheet): 8 frames spread evenly plus one just after each cue, up to 20.
// The clip is assumed to start with the music; the even frames cover the case where it doesn't.
export const RUN_SEC = 90;
export function runTimes(duration, cues, peak){
  const ts = (cues || []).map(c => +c.t).filter(t => Number.isFinite(t) && t >= 0 && t + 0.8 < duration).sort((a, b) => a - b);
  if (!(duration > 0) || ts.length < 6) return sampleTimes(duration, peak);
  const room = 20 - 8; const step = ts.length > room ? ts.length / room : 1; const picked = []; for (let i = 0; picked.length < Math.min(room, ts.length); i++) { const t = ts[Math.floor(i * step)]; if (t !== undefined && !picked.includes(t)) picked.push(t); }
  const all = [...evenTimes(duration, 8), ...picked.map(t => +(t + 0.8).toFixed(2))].sort((a, b) => a - b); const out = [];
  for (const t of all) if (!out.length || t - out[out.length - 1] > 0.15) out.push(t);
  return out.slice(0, 20);
}
export const MAX_CLIP_SEC = 180; // a full run: solo 2:04, trio 2:24, jazz 2:31. Still 20 frames, so the cost per review is the same.
