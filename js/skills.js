// Skill ladders (data/skills.json) + the per-skill state records in the `skills` collection.
// States: notyet (no record) → learning → clean → checked. The child sets learning/clean; only Grown-ups sets checked.
import { SKILLS } from "./data.js";
import { S, storeSet } from "./store.js";
import { todayStr } from "./util.js";

export const STATE_LABEL = { notyet: "Not yet", learning: "Learning", clean: "Clean", checked: "Teacher-checked" };
export const STATE_EMOJI = { notyet: "○", learning: "◔", clean: "◉", checked: "★" };
const POINTS = { notyet: 0, learning: 1, clean: 2, checked: 3 };

export function skillState(skills, id){ const r = (skills || {})[id]; return r && STATE_LABEL[r.state] ? r.state : "notyet"; }
// Progress per style as a fraction 0–1 (learning counts a third, clean two thirds, teacher-checked full). Pure.
// A ladder with levels (acro: the studio's chart, Level 1–4) names her group's levels in `focus`; progress counts those.
// Bonus moves (her own extras that aren't on the chart) always count.
export const inFocus = (st, sk) => !Array.isArray(st && st.focus) || !st.focus.length || !!(sk && sk.bonus) || st.focus.includes(sk.lvl);
export const focusSkills = (st) => ((st && st.skills) || []).filter(sk => inFocus(st, sk));
export const focusLabel = (st) => Array.isArray(st && st.focus) && st.focus.length ? "Level " + st.focus.join("–") : "";
// Level groups for a leveled ladder: [{ lvl, label, focus, skills, req }]; null for a plain ladder. req = the "to level up" skills.
export function levelGroups(st){
  const sk = (st && st.skills) || []; if (!sk.some(x => Number.isInteger(x.lvl))) return null;
  const lvls = [...new Set(sk.map(x => x.lvl).filter(Number.isInteger))].sort((a, b) => a - b);
  const out = lvls.map(l => ({ lvl: l, label: "Level " + l, focus: inFocus(st, { lvl: l }), skills: sk.filter(x => x.lvl === l), req: levelUp(st, l) }));
  const bonus = sk.filter(x => x.bonus); if (bonus.length) out.push({ lvl: 0, label: "✨ Bonus moves", focus: true, bonus: true, skills: bonus, req: [] });
  return out;
}
// What the chart lists "to level up" under a level: [{ id, n }] (id is "" for a line with no matching skill).
export function levelUp(st, l){ const row = ((st && st.levelup) || []).find(r => r.lvl === l); if (!row) return []; const by = Object.fromEntries(((st && st.skills) || []).map(x => [x.id, x])); return row.need.map(x => by[x] ? { id: x, n: by[x].n } : { id: "", n: String(x) }); }
export function styleProgress(skills, ladder = SKILLS){
  const out = {};
  for (const [key, st0] of Object.entries(ladder.styles || {})) {
    const st = { ...st0, skills: focusSkills(st0) };
    const total = st.skills.length * 3; const got = st.skills.reduce((a, s) => a + POINTS[skillState(skills, s.id)], 0);
    out[key] = { n: st.n, ic: st.ic, pct: total ? Math.round(100 * got / total) : 0, checked: st.skills.filter(s => skillState(skills, s.id) === "checked").length, clean: st.skills.filter(s => skillState(skills, s.id) === "clean").length, total: st.skills.length };
  }
  return out;
}
export function allSkills(ladder = SKILLS){ return Object.entries(ladder.styles || {}).flatMap(([style, st]) => st.skills.map(s => ({ ...s, style }))); }
export function findSkill(id, ladder = SKILLS){ return allSkills(ladder).find(s => s.id === id); }

// Listeners for a skill's state changing (js/cards.js pops "New card!"). Called with (id, prev, next) after the save.
const stateListeners = new Set();
export function onSkillState(fn){ stateListeners.add(fn); return () => stateListeners.delete(fn); }
function stateChanged(id, prev, next){ if (prev === next) return; for (const fn of stateListeners) { try { fn(id, prev, next); } catch (e) { console.warn(e); } } }

// Kid tap: notyet → learning → clean → learning … (never past clean; teacher-checked stays teacher-checked).
export async function kidCycle(id){
  const cur = skillState(S.skills, id); if (cur === "checked") return cur;
  const next = cur === "notyet" ? "learning" : cur === "learning" ? "clean" : "learning";
  const s = findSkill(id); await storeSet("skills", id, { ...(S.skills[id] || {}), id, style: s ? s.style : "", state: next, at: todayStr() }); stateChanged(id, cur, next); return next;
}
export async function teacherCheck(id, teacher, date){
  const prev = skillState(S.skills, id);
  const s = findSkill(id); await storeSet("skills", id, { ...(S.skills[id] || {}), id, style: s ? s.style : "", state: "checked", teacher: String(teacher || "").trim(), checkedAt: date || todayStr(), at: todayStr() }); stateChanged(id, prev, "checked");
}
export async function uncheck(id){ const r = S.skills[id]; if (!r) return; await storeSet("skills", id, { ...r, state: "clean", teacher: "", checkedAt: "" }); }
