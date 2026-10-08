// The plan for a given date, built from app state (pure logic lives in plan.js).
import { PRACTICE_POOL, AERIAL } from "./data.js";
import { S, dances, events } from "./store.js";
import { buildPlan, applyCustom } from "./plan.js";
import { patterns, isOpen, currentWeekFix } from "./corrections.js";
import { todayStr } from "./util.js";
import { modeFor } from "./mode.js";

export function planFor(date = todayStr()){
  const ds = dances(); const solo = ds.find(d => d.id === "solo");
  const tricks = ds.flatMap(d => Array.isArray(d.tricks) ? d.tricks : []);
  const prefer = patterns(S.corrections, { today: date, min: 1 }).map(p => p.tag).filter(t => Object.values(S.corrections).some(c => isOpen(c) && c.tag === t)).slice(0, 3);
  const fix = date === todayStr() ? currentWeekFix(date) : null;
  const base = buildPlan({ pool: PRACTICE_POOL, date, preferTags: prefer, weekFix: fix ? { id: fix.id, text: fix.text, tag: fix.tag } : null, tricks, aerial: AERIAL, aerialDone: S.settings.aerial || [], dances: ds, mode: modeFor(date, events(), S.settings).mode });
  return applyCustom(base, PRACTICE_POOL, (S.practice[date] || {}).custom);
}
export const planTotal = (date) => planFor(date).length;
