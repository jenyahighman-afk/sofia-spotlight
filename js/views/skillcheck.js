// Grown-ups → Skills & awards: teacher-checked skills (name + date) and the parent-awarded badges ("No cues", "Clean 5 in a row").
import { $, esc, todayStr, toast, expose } from "../util.js";
import { SKILLS } from "../data.js";
import { S, dances } from "../store.js";
import { skillState, teacherCheck, uncheck, STATE_LABEL, allSkills, levelGroups } from "../skills.js";
import { awardParentBadge, earned, checkBadges } from "../badges.js";
import { closeCorrection, TAG_EMOJI, FIX_SEEN_TO_MOVE } from "../corrections.js";
import { offersNow } from "../sunday.js";

// 📌 Ms. Brittany's homework (Build 3): the pinned notes close here, not on the kid's screens — once a fix showed on two
// videos in a row, or the memory note once every solo cue is known in Pause & Predict (sunday.js pinOffers).
function renderPinned(){
  const el = $("#pinnedHomework"); if (!el) return; const offers = offersNow();
  el.innerHTML = offers.length ? offers.map(o => `<div class="check pin-row ${o.ready ? "ready" : ""}"><span class="chip ${o.ready ? "coral" : "violet"}">${o.ready ? "★ ready" : (TAG_EMOJI[o.tag] || "📌")}</span><span class="grow">${esc(o.text)}<br><span class="small muted">📌 ${esc(o.source)} · ${o.ready ? esc(o.why) : `on video ${o.seen} of ${FIX_SEEN_TO_MOVE} in a row`}</span></span><button class="btn sm ${o.ready ? "coral" : "ghost"}" onclick="pinClose('${o.id}')">✓ Checked off</button></div>`).join("") : `<p class="small muted">No open homework from Ms. Brittany.</p>`;
}
async function pinClose(id){ const c = S.corrections[id]; if (!c || !confirm(`Ms. Brittany checked it off?\n\n${c.text}`)) return; await closeCorrection(id); toast("Checked off ✅"); checkBadges(); }

function renderSkillCheck(){
  renderPinned();
  const item = (sk) => { const r = S.skills[sk.id] || {}; const state = skillState(S.skills, sk.id);
    return `<div class="check"><span class="chip ${state === "checked" ? "coral" : state === "clean" ? "sun" : state === "learning" ? "violet" : ""}">${STATE_LABEL[state]}</span><span class="grow">${esc(sk.n)}${state === "checked" ? `<br><span class="small muted">${esc(r.teacher || "")} · ${esc(r.checkedAt || "")}</span>` : ""}</span>${state === "checked" ? `<button class="btn sm ghost" onclick="skillUncheck('${sk.id}')">Undo</button>` : `<button class="btn sm coral" onclick="skillCheck('${sk.id}')">Teacher checked</button>`}</div>`; };
  $("#skillCheckList").innerHTML = Object.entries(SKILLS.styles).map(([k, st]) => { const groups = levelGroups(st); return `<div class="field-lab">${st.ic} ${esc(st.n)}${st.src ? ` <span class="small muted">· ${esc(st.src)}</span>` : ""}</div>` + (groups ? groups.map(g => `<details class="lvl" ${g.focus ? "open" : ""}><summary>${esc(g.label)}${g.focus && !g.bonus ? ` <span class="chip coral">her group</span>` : ""} <span class="chip">${g.skills.length}</span></summary>${g.skills.map(item).join("")}</details>`).join("") : st.skills.map(item).join("")); }).join("");
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
expose({ skillCheck, skillUncheck, pinClose });
