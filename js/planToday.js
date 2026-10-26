// The plan for a given date, built from app state (pure logic lives in plan.js).
// On a studio class or rehearsal day, a light week or the night before the show it is the short version (15-minute memory
// run); until Nov 9 the trick drill is the Memory + knees block, after that the 15-week plan's trick(s) of the week; the
// session rules add the clips, the Sunday review, the show in her head and the full-out line; a teacher's new note is in.
import { PRACTICE_POOL, AERIAL, CLASSES, SKILLS } from "./data.js";
import { S, dances, events, studioDates } from "./store.js";
import { buildPlan, applyCustom } from "./plan.js";
import { patterns, isOpen, currentWeekFix, newTeacherNotes } from "./corrections.js";
import { todayStr } from "./util.js";
import { modeFor } from "./mode.js";
import { isShortDay } from "./studio.js";
import { trickFocus, weakestTrick, sessionRules } from "./season15.js";
import { drillFor } from "./trickdrill.js";

// "knees", "none" (a light or taper week: no trick drill), this week's trick lines (from the solo card), or null (the usual rotation).
export function focusFor(date, ds = dances()){
  const f = trickFocus(date); if (!f) return null; if (f.kind === "knees") return "knees"; if (f.kind === "rest" || f.kind === "none") return "none";
  const solo = ds.find(d => d.id === "solo"); if (!solo) return null; const list = ((SKILLS.styles || {}).solo || {}).skills || [];
  const skills = f.kind === "trick" ? list.filter(s => f.ids.includes(s.id)) : f.kind === "weakest" ? [weakestTrick(S.skills)].filter(Boolean) : [];
  const lines = [...new Set(skills.map(s => drillFor(s, solo)).filter(Boolean))]; return lines.length ? lines : null;
}
export function planFor(date = todayStr()){
  const ds = dances();
  const tricks = ds.flatMap(d => Array.isArray(d.tricks) ? d.tricks : []);
  const prefer = patterns(S.corrections, { today: date, min: 1 }).map(p => p.tag).filter(t => Object.values(S.corrections).some(c => isOpen(c) && c.tag === t)).slice(0, 3);
  const fix = date === todayStr() ? currentWeekFix(date) : null; const session = sessionRules(date);
  const base = buildPlan({ pool: PRACTICE_POOL, date, preferTags: prefer, weekFix: fix ? { id: fix.id, text: fix.text, tag: fix.tag } : null, tricks, aerial: AERIAL, aerialDone: S.settings.aerial || [], dances: ds, mode: modeFor(date, events(), S.settings).mode,
    short: isShortDay(date, CLASSES, studioDates()) || session.short, nightBefore: session.nightBefore, focus: focusFor(date, ds), session, newNotes: newTeacherNotes(S.corrections, date) });
  return applyCustom(base, PRACTICE_POOL, (S.practice[date] || {}).custom);
}
export const planTotal = (date) => planFor(date).length;
