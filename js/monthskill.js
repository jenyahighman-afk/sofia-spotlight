// ⭐ My skill this month (1.64.0, one of the four ideas Jenya picked on Nov 5): one skill she picks herself for the month,
// on top of the Skills page, with a before and an after — her first progress photo and her latest one, from the trick's own
// lineup (js/lineup.js). settings.monthSkills = { "YYYY-MM": skillId }: one per month, hers to change, and earlier months
// stay so a later month can look back. Nothing is asked for: no count, no due date. Pure parts up top (tested in Node).
import { $, esc, todayStr, expose, toast } from "./util.js";
import { S, setSettings } from "./store.js";
import { SKILLS } from "./data.js";
import { allSkills, findSkill, skillState, STATE_EMOJI, STATE_LABEL } from "./skills.js";
import { lineup, firstVsNow } from "./lineup.js";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const monthKey = (date = todayStr()) => String(date).slice(0, 7);
export const monthName = (date = todayStr()) => MONTHS[+String(date).slice(5, 7) - 1] || "";
// The skill picked for the month of `date`, or null (nothing picked, or the skill is no longer on a list). Pure.
export function monthSkill(settings, date = todayStr(), ladder = SKILLS){
  const m = (settings || {}).monthSkills; const id = m && typeof m === "object" ? m[monthKey(date)] : ""; if (!id) return null;
  return findSkill(String(id), ladder) || null;
}
// What she can pick from: the skills she hasn't got clean yet first (learning, then not started), then the rest. Pure.
export function pickList(skills = {}, ladder = SKILLS){
  const rank = (s) => ({ learning: 0, notyet: 1, clean: 2, checked: 3 })[skillState(skills, s.id)] ?? 1;
  return allSkills(ladder).map((s, i) => ({ s, i })).sort((a, b) => rank(a.s) - rank(b.s) || a.i - b.i).map(x => x.s);
}
// The card. `shots` = the skill's lineup (oldest first). Pure.
export function monthCardHtml({ date = todayStr(), skill = null, state = "notyet", shots = [], picking = false, list = [] } = {}){
  const head = `<div class="row"><h3 class="grow">⭐ My skill this month</h3><span class="chip sun">${esc(monthName(date))}</span></div>`;
  if (picking || !skill) {
    const opts = list.map(s => `<button class="chip" onclick="msPick('${s.id}')">${esc(s.n)}</button>`).join("");
    return `${head}<p class="small muted">${skill ? "Pick a different one. You can change it any time." : "Pick one skill you'd like to get better at this month. You choose."}</p><div class="ms-pick">${opts}</div>${skill ? `<div class="row" style="margin-top:8px"><button class="btn sm ghost" onclick="msPicking(false)">Keep ${esc(skill.n)}</button></div>` : ""}`;
  }
  const vs = firstVsNow(shots); const pic = (p, lab) => `<figure class="ms-shot"><img src="${esc(p.url)}" alt="" loading="lazy"><figcaption>${lab}</figcaption></figure>`;
  const photos = vs ? `<div class="ms-vs">${pic(vs.first, "Before")}${pic(vs.now, "Now")}</div>` : shots.length ? `<div class="ms-vs">${pic(shots[0], "Before")}<div class="ms-shot ms-empty">Take another one in a few weeks and they'll sit side by side.</div></div>` : `<p class="small muted">Take a photo now. Take another one later, and you'll see the before and the after.</p>`;
  return `${head}<div class="ms-name">${STATE_EMOJI[state] || "○"} <b>${esc(skill.n)}</b> <span class="small muted">${esc(STATE_LABEL[state] || "")}</span></div>${skill.tip ? `<div class="small muted">${esc(skill.tip)}</div>` : ""}${photos}
    <div class="row" style="margin-top:8px"><button class="btn sm coral" onclick="openCards('${skill.id}')">📷 My photos</button><span class="grow"></span><button class="lnk small" onclick="msPicking(true)">Pick a different one</button></div>`;
}

// ---- DOM ----
let picking = false;
export function renderMonthSkill(){
  const el = $("#monthSkill"); if (!el) return; const date = todayStr(); const skill = monthSkill(S.settings, date);
  el.innerHTML = monthCardHtml({ date, skill, state: skill ? skillState(S.skills, skill.id) : "notyet", shots: skill ? lineup(skill.id) : [], picking, list: picking || !skill ? pickList(S.skills) : [] });
}
async function msPick(id){ if (!findSkill(id)) return; const cur = S.settings.monthSkills && typeof S.settings.monthSkills === "object" ? S.settings.monthSkills : {}; await setSettings({ monthSkills: { ...cur, [monthKey()]: id } }); picking = false; renderMonthSkill(); toast("That's your skill for " + monthName() + " ⭐"); }
function msPicking(on){ picking = !!on; renderMonthSkill(); }
expose({ msPick, msPicking });
