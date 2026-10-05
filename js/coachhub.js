// Coach corner: one place (opened from Practice) to start a coach review for any dance or skill, and to look back —
// reviews grouped by dance or skill, how feet/knees/eyes/arms have checked out over time, and what happened to each fix.
import { $, esc, expose } from "./util.js";
import { S, dances } from "./store.js";
import { showPage } from "./nav.js";
import { reviewCard, coachReady, openCoach } from "./coach.js";
import { allSkills } from "./skills.js";
import { TAG_EMOJI, TAG_LABEL } from "./corrections.js";

export const CHECKS = ["feet", "knees", "eyes", "arms"];
const ok = (v) => !v || /^\s*✓/.test(String(v));

// ---- pure helpers (tested) ----
// A review belongs to a skill/trick when it names one, otherwise to its dance.
export const targetKey = (r) => r.trick ? "trick:" + r.trick : "dance:" + (r.danceId || "");
export function groupReviews(reviews){
  const groups = new Map();
  for (const r of Object.values(reviews || {})) { if (!r || r.deleted || !r.review) continue; const k = targetKey(r); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); }
  for (const list of groups.values()) list.sort((a, b) => (b.at || b.date || "").localeCompare(a.at || a.date || ""));
  return [...groups.entries()].map(([key, list]) => ({ key, list })).sort((a, b) => (b.list[0].at || b.list[0].date || "").localeCompare(a.list[0].at || a.list[0].date || ""));
}
// Per check: newest-first true/false history, how many of the last `n` were ✓, and whether it's getting better.
export function checkTrend(list, n = 3){
  const out = {};
  for (const c of CHECKS) { const hist = list.map(r => ok(r.review[c])); const recent = hist.slice(0, n); const older = hist.slice(n, n * 2);
    const rate = (a) => a.length ? a.filter(Boolean).length / a.length : null; const now = rate(recent), before = rate(older);
    out[c] = { hist, good: recent.filter(Boolean).length, of: recent.length, trend: before === null || now === null ? "new" : now > before ? "up" : now < before ? "down" : "same" }; }
  return out;
}
// What became of a review's fix: not made into a note, still being worked on, or closed.
export function fixStatus(r, corrections){
  if (!r.fixAdded) return "open";
  const c = r.fixId ? (corrections || {})[r.fixId] : Object.values(corrections || {}).find(x => x.source === "AI coach" && x.danceId === r.danceId && x.text === r.review.fix);
  if (!c || c.deleted) return "noted"; return c.status === "done" ? "done" : "working";
}

// ---- UI ----
let filter = "all";
function targetName(key){ if (key.startsWith("trick:")) return "✨ " + key.slice(6); const d = dances().find(x => x.id === key.slice(6)); return d ? d.name : "Other"; }
export function renderCoachHub(){
  const el = $("#coachHub"); if (!el) return;
  const ds = dances(); const groups = groupReviews(S.reviews);
  $("#coachNew").innerHTML = `<div class="field-lab">Get a review for…</div><div class="hub-targets">${ds.slice(0, 8).map(d => `<button class="chip" onclick="openCoach('${d.id}')">🎬 ${esc(d.name.split(" · ").slice(0, 2).join(" · "))}</button>`).join("")}</div>
    <div class="row" style="margin-top:8px"><select id="coachSkill" style="max-width:220px">${allSkills().map(s => `<option>${esc(s.n)}</option>`).join("")}<option>Calypso</option><option>Aerial drills</option></select><button class="btn sm coral" onclick="coachSkillGo()">🎬 A skill</button></div>
    ${coachReady() ? "" : `<p class="small bad">The coach isn't connected yet — the skeleton view still works.</p>`}`;
  const chips = [["all", "All"], ...groups.map(g => [g.key, targetName(g.key).replace(/^✨ /, "")])];
  $("#coachFilter").innerHTML = groups.length > 1 ? chips.map(([k, n]) => `<button class="chip ${filter === k ? "coral" : ""}" onclick="coachFilterSet('${esc(k).replace(/'/g, "&#39;")}')">${esc(n)}</button>`).join("") : "";
  const shown = groups.filter(g => filter === "all" || g.key === filter);
  el.innerHTML = shown.length ? shown.map(g => {
    const tr = checkTrend(g.list); const arrow = { up: "⬆️", down: "⬇️", same: "", new: "" };
    const fixes = g.list.slice(0, 6).map(r => { const st = fixStatus(r, S.corrections); return `<div class="check"><span class="chip ${st === "done" ? "mint" : st === "working" ? "violet" : ""}">${st === "done" ? "✅ got it" : st === "working" ? "working on it" : st === "noted" ? "noted" : "new"}</span><span class="grow">${TAG_EMOJI[r.review.tag] || "✨"} ${esc(r.review.fix)}<br><span class="small muted">${esc(r.date || "")}</span></span>${st === "open" ? `<button class="btn sm ghost" onclick="coachAddFix('${r.id}')">＋ note</button>` : ""}</div>`; }).join("");
    return `<div class="card violet"><div class="row"><h3 class="grow">${esc(targetName(g.key))}</h3><span class="chip sun">${g.list.length} review${g.list.length === 1 ? "" : "s"}</span></div>
      <div class="trend">${CHECKS.map(c => `<div class="trend-cell"><span>${TAG_EMOJI[c]}</span><b>${tr[c].good}/${tr[c].of} ✓ ${arrow[tr[c].trend]}</b><small>${TAG_LABEL[c]}</small><div class="dots">${tr[c].hist.slice(0, 6).reverse().map(v => `<i class="${v ? "on" : ""}"></i>`).join("")}</div></div>`).join("")}</div>
      <div class="field-lab">Fixes the coach gave</div>${fixes}
      <details class="more"><summary>Latest review ▸</summary>${reviewCard(g.list[0], { addFix: false })}</details>
      ${g.list.length > 1 ? `<details class="more"><summary>Older reviews (${g.list.length - 1}) ▸</summary>${g.list.slice(1).map(r => reviewCard(r, { addFix: false })).join("")}</details>` : ""}</div>`; }).join("")
    : `<div class="card"><p class="small muted">No reviews yet. Pick a dance or a skill above and film 20 seconds.</p></div>`;
}
function filterSet(k){ filter = k; renderCoachHub(); }
function skillGo(){ const v = ($("#coachSkill") || {}).value; if (v) openCoach("", v); }
export function openCoachHub(){ showPage("coach"); renderCoachHub(); }
expose({ openCoachHub, coachFilterSet: filterSet, coachSkillGo: skillGo });
