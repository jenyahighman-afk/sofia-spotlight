// Grown-ups → Skills & awards: teacher-checked skills (name + date) and the parent-awarded badges ("No cues", "Clean 5 in a row").
import { $, esc, todayStr, toast, expose } from "../util.js";
import { SKILLS } from "../data.js";
import { S, dances } from "../store.js";
import { skillState, teacherCheck, uncheck, STATE_LABEL, allSkills } from "../skills.js";
import { awardParentBadge, earned } from "../badges.js";

function renderSkillCheck(){
  $("#skillCheckList").innerHTML = Object.entries(SKILLS.styles).map(([k, st]) => `<div class="field-lab">${st.ic} ${esc(st.n)}</div>` + st.skills.map(sk => { const r = S.skills[sk.id] || {}; const state = skillState(S.skills, sk.id);
    return `<div class="check"><span class="chip ${state === "checked" ? "coral" : state === "clean" ? "sun" : state === "learning" ? "violet" : ""}">${STATE_LABEL[state]}</span><span class="grow">${esc(sk.n)}${state === "checked" ? `<br><span class="small muted">${esc(r.teacher || "")} · ${esc(r.checkedAt || "")}</span>` : ""}</span>${state === "checked" ? `<button class="btn sm ghost" onclick="skillUncheck('${sk.id}')">Undo</button>` : `<button class="btn sm coral" onclick="skillCheck('${sk.id}')">Teacher checked</button>`}</div>`; }).join("")).join("");
  const ds = dances(); $("#awardDance").innerHTML = ds.map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join("");
  $("#awardTrick").innerHTML = allSkills().map(s => `<option value="${s.id}">${esc(s.n)}</option>`).join("") + `<option value="__custom">Something else…</option>`;
  const parent = earned().filter(b => b.parent);
  $("#awardList").innerHTML = parent.length ? parent.map(b => `<div class="check"><span>${b.emoji}</span><span class="grow">${esc(b.label)}</span><span class="small muted">${esc(b.at || "")}</span></div>`).join("") : `<p class="small muted">No parent awards yet.</p>`;
}
async function skillCheck(id){
  const teacher = prompt("Which teacher checked it?"); if (teacher === null) return; if (!teacher.trim()) return toast("Teacher's name needed");
  const date = prompt("Date (YYYY-MM-DD)", todayStr()); if (date === null) return; if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) return toast("Use YYYY-MM-DD");
  await teacherCheck(id, teacher, date.trim()); toast("Teacher-checked ★");
}
async function skillUncheck(id){ if (confirm("Undo the teacher check?")) await uncheck(id); }
export function initSkillCheck(){
  $("#awardNoCues").onclick = async () => { const id = $("#awardDance").value; const d = dances().find(x => x.id === id); if (!d) return; if (!confirm(`Award "No cues" for ${d.name}?`)) return; await awardParentBadge("nocues", id, d.name); };
  $("#awardClean5").onclick = async () => { let id = $("#awardTrick").value, label; if (id === "__custom") { label = prompt("Which trick?"); if (!label || !label.trim()) return; id = label.trim().toLowerCase().replace(/\s+/g, "-"); label = label.trim(); } else { const s = allSkills().find(x => x.id === id); label = s ? s.n : id; } if (!confirm(`Award "Clean 5 in a row" for ${label}?`)) return; await awardParentBadge("clean5", id, label); };
}
export { renderSkillCheck };
expose({ skillCheck, skillUncheck });
