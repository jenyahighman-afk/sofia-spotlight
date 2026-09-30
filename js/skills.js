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
export function styleProgress(skills, ladder = SKILLS){
  const out = {};
  for (const [key, st] of Object.entries(ladder.styles || {})) {
    const total = st.skills.length * 3; const got = st.skills.reduce((a, s) => a + POINTS[skillState(skills, s.id)], 0);
    out[key] = { n: st.n, ic: st.ic, pct: total ? Math.round(100 * got / total) : 0, checked: st.skills.filter(s => skillState(skills, s.id) === "checked").length, clean: st.skills.filter(s => skillState(skills, s.id) === "clean").length, total: st.skills.length };
  }
  return out;
}
export function allSkills(ladder = SKILLS){ return Object.entries(ladder.styles || {}).flatMap(([style, st]) => st.skills.map(s => ({ ...s, style }))); }
export function findSkill(id, ladder = SKILLS){ return allSkills(ladder).find(s => s.id === id); }

// Kid tap: notyet → learning → clean → learning … (never past clean; teacher-checked stays teacher-checked).
export async function kidCycle(id){
  const cur = skillState(S.skills, id); if (cur === "checked") return cur;
  const next = cur === "notyet" ? "learning" : cur === "learning" ? "clean" : "learning";
  const s = findSkill(id); await storeSet("skills", id, { ...(S.skills[id] || {}), id, style: s ? s.style : "", state: next, at: todayStr() }); return next;
}
export async function teacherCheck(id, teacher, date){
  const s = findSkill(id); await storeSet("skills", id, { ...(S.skills[id] || {}), id, style: s ? s.style : "", state: "checked", teacher: String(teacher || "").trim(), checkedAt: date || todayStr(), at: todayStr() });
}
export async function uncheck(id){ const r = S.skills[id]; if (!r) return; await storeSet("skills", id, { ...r, state: "clean", teacher: "", checkedAt: "" }); }
