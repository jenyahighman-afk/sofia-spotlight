// The plan for a given date, built from app state (pure logic lives in plan.js).
// On a studio class or rehearsal day, a light week or the night before the show it is the short version (memory
// run); until Nov 9 the trick drill is the Memory + knees block, after that the 15-week plan's trick(s) of the week; the
// session rules add the clips, the Sunday review, the show in her head and the full-out line; a teacher's new note is in.
import { PRACTICE_POOL, AERIAL, CLASSES, SKILLS } from "./data.js";
import { S, dances, events, studioDates } from "./store.js";
import { buildPlan, applyCustom } from "./plan.js";
import { patterns, isOpen, weekFixOrPick, newTeacherNotes, shiftDate } from "./corrections.js";
import { todayStr } from "./util.js";
import { modeFor } from "./mode.js";
import { isShortDay } from "./studio.js";
import { trickFocus, weakestTrick, sessionRules, studioKind, weekOf } from "./season15.js";
import { drillFor } from "./trickdrill.js";

// "knees", "none" (a light or taper week: no trick drill), this week's trick lines (from the solo card), or null (the usual rotation).
export function focusFor(date, ds = dances()){
  const f = trickFocus(date); if (!f) return null; if (f.kind === "knees") return "knees"; if (f.kind === "rest" || f.kind === "none") return "none";
  const solo = ds.find(d => d.id === "solo"); if (!solo) return null; const list = ((SKILLS.styles || {}).solo || {}).skills || [];
  const skills = f.kind === "trick" ? list.filter(s => f.ids.includes(s.id)) : f.kind === "weakest" ? [weakestTrick(S.skills)].filter(Boolean) : [];
  const lines = [...new Set(skills.map(s => drillFor(s, solo)).filter(Boolean))]; return lines.length ? lines : null;
}
// The short plan for `date`, or "": "watch" (a Monday: Hannah's videos, no dancing), "memory" (every other studio day, a
// light week, the night before the show).
export function shortKind(date = todayStr()){ if (isShortDay(date, CLASSES, studioDates())) return studioKind(date); return sessionRules(date).short ? "memory" : ""; }
// The judges' feedback items (the week after a comp) stay on the plan until each has been ticked once that week.
export function judgesFor(date, session, practice = S.practice){
  const j = session && session.judges; if (!j) return null; const wk = weekOf(date); const from = wk ? wk.of : date;
  const done = (id) => { for (let d = from; d <= date; d = shiftDate(d, 1)) { const rec = practice[d]; if (rec && Array.isArray(rec.done) && rec.done.includes(id)) return true; } return false; };
  return { ...j, soloDone: done("judges-solo"), trioDone: done("judges-trio") };
}
export function planFor(date = todayStr()){
  const ds = dances();
  const tricks = ds.flatMap(d => Array.isArray(d.tricks) ? d.tricks : []);
  const prefer = patterns(S.corrections, { today: date, min: 1 }).map(p => p.tag).filter(t => Object.values(S.corrections).some(c => isOpen(c) && c.tag === t)).slice(0, 3);
  // This week's fix (picked on the first open of a new week: corrections.weekFixOrPick), its source for the drill's "whose words".
  const fix = date === todayStr() ? weekFixOrPick(date) : null; const rules = sessionRules(date); const session = { ...rules, judges: judgesFor(date, rules) };
  const base = buildPlan({ pool: PRACTICE_POOL, date, preferTags: prefer, weekFix: fix ? { id: fix.id, text: fix.text, tag: fix.tag, source: fix.source || "", pinned: !!fix.pinned } : null, tricks, aerial: AERIAL, aerialDone: S.settings.aerial || [], dances: ds, mode: modeFor(date, events(), S.settings).mode,
    short: shortKind(date), nightBefore: session.nightBefore, focus: focusFor(date, ds), session, newNotes: newTeacherNotes(S.corrections, date) });
  return applyCustom(base, PRACTICE_POOL, (S.practice[date] || {}).custom);
}
export const planTotal = (date) => planFor(date).length;
