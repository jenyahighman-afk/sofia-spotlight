// Scrolling lines: the cue sheet as a moving list — what's past (dim), what's on now (big), what's coming (small).
// An option Sofia can turn on while she's still learning (settings.prompter). Pure (tested in Node).
import { esc } from "./util.js";
import { normalizeCues, fmtTime } from "./cues.js";

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
