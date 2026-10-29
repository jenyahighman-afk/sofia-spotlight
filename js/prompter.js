// Scrolling lines: the cue sheet as a moving list — what's past (dim), what's on now (big), what's coming (small).
// An option Sofia can turn on while she's still learning (settings.prompter). Pure (tested in Node).
import { esc } from "./util.js";
import { normalizeCues, fmtTime, lyricLines, lyricAt } from "./cues.js";

export function prompterLines(cues, t, before = 2, after = 3){
  const list = normalizeCues(cues); if (!list.length) return [];
  let i = -1; for (let k = 0; k < list.length; k++) if (list[k].t <= t) i = k;
  const out = [];
  for (let k = Math.max(0, i - before); k < Math.min(list.length, i + 1 + after); k++) out.push({ ...list[k], state: k < i ? "past" : k === i ? "now" : "next" });
  if (i < 0) out.unshift({ t: 0, move: "…", lyric: "", state: "now" });
  return out;
}
export function prompterHtml(cues, t){
  const lines = prompterLines(cues, t); if (!lines.length) return "";
  return `<div class="prompter">${lines.map(l => `<div class="pl ${l.state}"><span class="pl-t">${fmtTime(l.t)}</span><span class="pl-m">${esc(l.move || "…")}</span>${l.lyric ? `<span class="pl-l">“${esc(l.lyric)}”</span>` : ""}</div>`).join("")}</div>`;
}

// Karaoke (1.44.0): the sung line now with a colour wipe, the line before dim, the next one small. Words with no times yet
// show the first line and a hint; no words at all → nothing. Pure (tested in Node).
// The wipe runs word by word in reading order (1.45.2): each word gets its own --p from where it sits in the line's
// characters, so a long line that wraps on a phone lights up its top row first, then the second — one gradient across the
// whole box would fill both rows from the left at once. The player re-sets the words' --p every frame (wordWipes).
export function wordWipes(text, progress){
  const s = String(text || ""); const total = Math.max(1, s.length); const out = []; const re = /\S+/g; let m;
  while ((m = re.exec(s))) { const a = m.index / total, b = (m.index + m[0].length) / total; out.push({ w: m[0], p: Math.round(Math.max(0, Math.min(1, (progress - a) / Math.max(1e-6, b - a))) * 100) }); }
  return out;
}
export const nowHtml = (text, progress) => wordWipes(text, progress).map(x => `<span class="kw" style="--p:${x.p}%">${esc(x.w)}</span>`).join(" ");
export function karaokeHtml(lines, times, t){
  const list = lyricLines(lines); if (!list.length) return "";
  const k = lyricAt(list, times, t);
  if (!k.timed) return `<div class="kara untimed"><div class="kl now">${esc(list[0])}</div><div class="kl hint">⏱ Time the words (below) and they follow the song</div></div>`;
  return `<div class="kara">${k.prev ? `<div class="kl past">${esc(k.prev.text)}</div>` : ""}<div class="kl now">${k.cur ? nowHtml(k.cur.text, k.progress) : "…"}</div>${k.next ? `<div class="kl next">${esc(k.next.text)}</div>` : ""}</div>`;
}
