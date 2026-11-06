// ⭐ I'm working on (1.65.0, Jenya Nov 5: "make it so she can pick skills she is working on and keeping track of"). The top of
// the Skills page is her own list: the skills she picked, from any list in data/skills.json and the three splits, each with
// how it's going, her Before and Now photos, and a way to take it off. Everything else on the page is folded under it.
// settings.working = [id, …]: skill ids and split keys in the order she picked them, up to WORK_MAX. Until she picks, the
// list starts with this month's ⭐ skill (settings.monthSkills, 1.64.0), so what she chose there is not lost. Picking a
// skill she hasn't started marks it "learning", the same record a tap in a list writes. Nothing is counted or due.
// Pure parts up top (tested in Node).
import { $, esc, todayStr, expose, toast } from "./util.js";
import { S, setSettings } from "./store.js";
import { SKILLS } from "./data.js";
import { findSkill, skillState, kidCycle, levelGroups, STATE_EMOJI } from "./skills.js";
import { SPLIT_KEYS, PRESETS, splitGoal, splitNote } from "./goals.js";
import { monthSkill } from "./monthskill.js";
import { lineup, firstVsNow } from "./lineup.js";
import { openStage } from "./stage.js";
import { CLASS_STYLES } from "./views/me.js";

export const WORK_MAX = 6;
const isSplitKey = (id) => SPLIT_KEYS.includes(id);
// Her list, in her order: only ids that still exist, each once. Not picked yet = this month's ⭐ skill, if she chose one. Pure.
export function workingIds(settings, date = todayStr(), ladder = SKILLS){
  const ok = (id) => isSplitKey(id) || !!findSkill(id, ladder); const w = (settings || {}).working;
  if (Array.isArray(w)) return [...new Set(w.map(String))].filter(ok).slice(0, WORK_MAX);
  const m = monthSkill(settings, date, ladder); return m ? [m.id] : [];
}
// One row's facts: a split says her change since her first check-in, a skill says how it's going. On her list a skill she
// hasn't marked yet reads "Working on it", never "Not yet". Pure.
export function workRow(id, { skills = {}, goals = {}, shots = [] } = {}, ladder = SKILLS){
  if (isSplitKey(id)) { const p = PRESETS.find(x => x.key === id); const g = splitGoal(goals, id); return { id, split: true, n: p.name, ic: p.emoji, note: g && (g.checkins || []).length ? splitNote(g) : "No photo yet" }; }
  const s = findSkill(id, ladder); if (!s) return null; const state = skillState(skills, id);
  return { id, split: false, n: s.n, tip: s.tip || "", state, ic: STATE_EMOJI[state === "notyet" ? "learning" : state], label: state === "checked" ? "Teacher-checked" : state === "clean" ? "Clean" : "Working on it", shots };
}
export function workRowHtml(r){
  const top = (sub) => `<div class="wk-top"><span class="wk-st">${r.ic}</span><span class="grow"><b>${esc(r.n)}</b><small>${esc(sub)}</small></span><button class="wk-x" onclick="wkRemove('${r.id}')" aria-label="Take ${esc(r.n)} off my list">✕</button></div>`;
  if (r.split) return `<div class="wk-row">${top(r.note)}<div class="row wk-acts"><button class="btn sm" onclick="splitOpen('${r.id}')">📷 Add a photo</button></div></div>`;
  const vs = firstVsNow(r.shots); const pic = (p, lab) => `<figure class="wk-shot"><img src="${esc(p.url)}" alt="" loading="lazy"><figcaption>${lab}</figcaption></figure>`;
  const photos = vs ? `<div class="wk-vs">${pic(vs.first, "Before")}${pic(vs.now, "Now")}</div>` : r.shots.length ? `<div class="wk-vs">${pic(r.shots[0], "Before")}</div>` : "";
  const got = r.state === "checked" ? `<span class="chip mint">★ Teacher-checked</span>` : r.state === "clean" ? `<button class="btn sm ghost" onclick="wkGot('${r.id}')">↩ Still working on it</button>` : `<button class="btn sm coral" onclick="wkGot('${r.id}')">✓ I've got it clean</button>`;
  return `<div class="wk-row ${r.state}">${top(r.label)}${r.tip ? `<div class="small muted wk-tip">${esc(r.tip)}</div>` : ""}${photos}<div class="row wk-acts">${got}<button class="btn sm" onclick="openCards('${r.id}')">📷 ${r.shots.length ? "My photos · " + r.shots.length : "Add a photo"}</button></div></div>`;
}
export function workingCardHtml(rows, max = WORK_MAX){
  const head = `<h3>⭐ I'm working on</h3>`;
  if (!rows.length) return `${head}<p class="small muted">Pick the skills you want to get better at. You choose, and you can change them any time.</p><div class="row"><button class="btn coral" onclick="wkPick()">＋ Pick a skill</button></div>`;
  return `${head}${rows.map(workRowHtml).join("")}<div class="row wk-more">${rows.length >= max ? `<span class="small muted">That's a full list. Take one off to pick another.</span>` : `<button class="btn sm coral" onclick="wkPick()">＋ Pick a skill</button>`}</div>`;
}
// What she can pick from, list by list: the solo's tricks and the splits open, the studio's acro chart by level (her
// group's levels first) and the four class lists folded. Pure.
export function pickGroups(skills = {}, working = [], ladder = SKILLS){
  const on = new Set(working); const styles = ladder.styles || {};
  const item = (s) => ({ id: s.id, n: s.n, on: on.has(s.id), state: skillState(skills, s.id) });
  const out = [];
  if (styles.solo) out.push({ key: "solo", label: `${styles.solo.ic} ${styles.solo.n}`, open: true, parts: [{ label: "", items: styles.solo.skills.map(item) }] });
  out.push({ key: "bendy", label: "🦵 Bendy", open: true, parts: [{ label: "", items: SPLIT_KEYS.map(k => ({ id: k, n: PRESETS.find(x => x.key === k).name, on: on.has(k), state: "" })) }] });
  for (const [k, st] of Object.entries(styles)) {
    if (k === "solo" || CLASS_STYLES.includes(k)) continue; const groups = levelGroups(st);
    out.push({ key: k, label: `${st.ic} ${st.n}`, open: false, parts: groups ? [...groups.filter(g => g.focus), ...groups.filter(g => !g.focus)].map(g => ({ label: g.label + (g.focus && !g.bonus ? " · your group" : ""), fold: true, items: g.skills.map(item) })) : [{ label: "", items: st.skills.map(item) }] });
  }
  const cls = CLASS_STYLES.filter(k => styles[k]);
  if (cls.length) out.push({ key: "classes", label: "🩰 My classes", open: false, parts: cls.map(k => ({ label: `${styles[k].ic} ${styles[k].n}`, items: styles[k].skills.map(item) })) });
  return out;
}
export const chipText = (i) => (i.on ? "⭐ " : i.state === "clean" || i.state === "checked" ? STATE_EMOJI[i.state] + " " : "") + i.n;
export const pickHint = (count, max = WORK_MAX) => "Tap the ones you want. ⭐ means it's on your list. " + (count >= max ? "Your list is full: take one off to pick another." : "Two or three at a time is plenty.");
export function pickerHtml(groups, { count = 0, max = WORK_MAX } = {}){
  const chip = (i) => `<button class="chip${i.on ? " sun" : ""}" onclick="wkToggle('${i.id}', this)">${esc(chipText(i))}</button>`;
  const part = (p) => { const chips = `<div class="ms-pick">${p.items.map(chip).join("")}</div>`; return p.fold ? `<details class="more"><summary>${esc(p.label)}</summary>${chips}</details>` : (p.label ? `<div class="lvl-sec">${esc(p.label)}</div>` : "") + chips; };
  return `<p class="small muted" id="wkHint">${pickHint(count, max)}</p>` + groups.map(g => `<details class="card acc"${g.open ? " open" : ""}><summary>${esc(g.label)}</summary>${g.parts.map(part).join("")}</details>`).join("");
}

// ---- DOM ----
export function renderWorking(){
  const el = $("#workingCard"); if (!el) return;
  el.innerHTML = workingCardHtml(workingIds(S.settings).map(id => workRow(id, { skills: S.skills, goals: S.goals, shots: isSplitKey(id) ? [] : lineup(id) })).filter(Boolean));
}
async function save(ids){ await setSettings({ working: ids }); renderWorking(); }
// A chip in the picker: on the list, or off it. A skill she hasn't started becomes "learning" when she picks it.
async function wkToggle(id, btn){
  const ids = workingIds(S.settings); const on = ids.includes(id);
  if (!on && !isSplitKey(id) && !findSkill(id)) return;
  if (!on && ids.length >= WORK_MAX) return toast("Your list is full. Take one off to pick another.");
  const next = on ? ids.filter(x => x !== id) : [...ids, id]; await save(next);
  if (!on && !isSplitKey(id) && skillState(S.skills, id) === "notyet") { await kidCycle(id); renderWorking(); }
  if (btn && btn.classList) { btn.classList.toggle("sun", !on); const s = isSplitKey(id) ? { n: PRESETS.find(x => x.key === id).name } : findSkill(id); btn.textContent = chipText({ n: s.n, on: !on, state: isSplitKey(id) ? "" : skillState(S.skills, id) }); }
  const h = $("#wkHint"); if (h) h.textContent = pickHint(next.length);
  toast(on ? "Off your list" : "On your list ⭐");
}
async function wkRemove(id){ const ids = workingIds(S.settings); if (!ids.includes(id)) return; await save(ids.filter(x => x !== id)); toast("Off your list. It's still under 📚 All skills."); }
// "I've got it clean" and back. Teacher-checked stays.
async function wkGot(id){
  const cur = skillState(S.skills, id); if (cur === "checked" || !findSkill(id)) return;
  if (cur === "notyet") await kidCycle(id); await kidCycle(id); renderWorking();
}
function wkPick(){
  const el = document.createElement("div"); el.className = "stage-list"; const ids = workingIds(S.settings);
  el.innerHTML = pickerHtml(pickGroups(S.skills, ids), { count: ids.length });
  openStage("＋ Pick a skill", [el], `<button class="btn coral" onclick="closeStage()">Done</button>`);
}
expose({ wkToggle, wkRemove, wkGot, wkPick });
