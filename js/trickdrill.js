// A solo trick's drill line on the dance card (pure; shared by Trick Quest and the daily plan).
import { normalizeCues, fmtCueTime } from "./cues.js";

const firstWord = (name) => String(name).toLowerCase().split(/\s|→/)[0].replace(/[^a-zé-]/g, "");
// The trick's drill line on the dance card: the line that carries its cue time ("Floor kick (1:40.75): …"), else the
// line that starts with the trick's first word.
const hasTime = (line, at) => { for (let i = line.indexOf(at); i >= 0; i = line.indexOf(at, i + 1)) { const before = line[i - 1], after = line[i + at.length]; if ((before === "(" || before === " ") && !(after && /[\d.]/.test(after))) return true; } return false; };
export function drillFor(skill, dance){ const lines = (dance && dance.tricks) || []; const c = skill.cue && normalizeCues(dance.cues).find(x => x.n === skill.cue); const at = c ? fmtCueTime(c.t) : ""; return (at && lines.find(t => hasTime(t, at))) || lines.find(t => t.toLowerCase().startsWith(firstWord(skill.n))) || ""; }
