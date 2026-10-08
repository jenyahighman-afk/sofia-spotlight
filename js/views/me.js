// Me tab: avatar (tap = customize, long-press = Grown-ups), streak, badge case, personal bests, skill rings, repeated notes.
import { $, esc, todayStr, toast, expose } from "../util.js";
import { CLASSES, PRACTICE_ITEMS, SKILLS } from "../data.js";
import { S, events } from "../store.js";
import { avRender, avToggle } from "../avatar.js";
import { renderPaletteRow, applyPalette } from "../palette.js";
import { computeStreak, bestStreak, practicedDays } from "../streak.js";
import { earned, AUTO_BADGES, checkBadges } from "../badges.js";
import { styleProgress, skillState, kidCycle, STATE_EMOJI, STATE_LABEL } from "../skills.js";
import { patterns, TAG_LABEL, TAG_EMOJI, closeCorrection, closedCount, isOpen } from "../corrections.js";
import { openGrownups } from "../grownups.js";
import { renderGoalsCard } from "../goals.js";
import { totalStars, nextUnlock, unlockedList } from "../stars.js";

let styleOpen = null;
const ring = (pct, ic) => { const r = 26, c = 2 * Math.PI * r; return `<svg viewBox="0 0 64 64" class="mini-ring"><circle cx="32" cy="32" r="${r}" class="ring-bg"/><circle cx="32" cy="32" r="${r}" class="ring-fg" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct / 100)}"/><text x="32" y="32" class="ring-ic">${ic}</text></svg>`; };

function renderMe(){
  avRender(); renderGoalsCard(); renderPaletteRow(); applyPalette();
  const today = todayStr(); const streak = computeStreak({ practice: S.practice, classes: CLASSES, events: events(), totalItems: PRACTICE_ITEMS.length, today });
  const best = bestStreak({ practice: S.practice, classes: CLASSES, events: events(), totalItems: PRACTICE_ITEMS.length, today });
  const nu = nextUnlock(); $("#meStars").innerHTML = `<div class="stars-big">⭐ ${totalStars()}</div><div class="small">${nu ? `${nu[2] - totalStars()} more to unlock <b>${esc(nu[3])}</b>` : "Everything unlocked!"}${unlockedList().length ? ` · ${unlockedList().length} look${unlockedList().length === 1 ? "" : "s"} unlocked` : ""}</div><div class="small muted">Every game pays 1–3 stars. First play of the day: +1.</div>`;
  $("#meStreak").innerHTML = `<div class="stat"><b>${streak}</b><span>day streak 🔥</span></div><div class="stat"><b>${best}</b><span>best streak</span></div><div class="stat"><b>${practicedDays(S.practice, PRACTICE_ITEMS.length)}</b><span>practice days</span></div><div class="stat"><b>${closedCount(S.corrections)}</b><span>fixes closed ✅</span></div>`;
  // badge case
  const got = earned(); const gotKeys = new Set(got.map(b => b.key));
  const locked = AUTO_BADGES.filter(b => !gotKeys.has(b.key));
  $("#badgeCase").innerHTML = (got.length ? got.map(b => `<div class="badge on" title="${esc(b.at || "")}"><span>${b.emoji}</span><small>${esc(b.label)}</small></div>`).join("") : "") + locked.map(b => `<div class="badge"><span>${b.emoji}</span><small>${esc(b.label)}</small></div>`).join("");
  $("#badgeCount").textContent = got.length + " earned";
  // personal bests
  const s = S.settings; $("#meBests").innerHTML = [["🎀 Step & Sparkle", s.gameBest || 0], ["👀 Spot the Oops", (s.jeBest || 0) + "/10"], ["🎒 Comp Day", s.cdBest || 0], ["👯 Trio", s.tfBest || 0]].map(([n, v]) => `<div class="stat"><b>${v}</b><span>${n}</span></div>`).join("");
  // skills
  const prog = styleProgress(S.skills);
  $("#skillRings").innerHTML = Object.entries(prog).map(([k, p]) => `<button class="skill-ring ${styleOpen === k ? "on" : ""}" onclick="meStyle('${k}')">${ring(p.pct, p.ic)}<small>${esc(p.n)}</small><small class="muted">${p.checked}★ ${p.clean}◉</small></button>`).join("");
  const st = styleOpen && SKILLS.styles[styleOpen];
  $("#skillList").innerHTML = st ? `<div class="small muted" style="margin:6px 0">Tap a skill: learning → clean. A grown-up marks ★ teacher-checked.</div>` + st.skills.map(sk => { const state = skillState(S.skills, sk.id); return `<button class="skill ${state}" onclick="meSkill('${sk.id}')"><span class="st">${STATE_EMOJI[state]}</span><span class="grow">${esc(sk.n)}</span><small>${STATE_LABEL[state]}${state === "checked" && S.skills[sk.id] && S.skills[sk.id].teacher ? " · " + esc(S.skills[sk.id].teacher) : ""}</small></button>`; }).join("") : "";
  // patterns
  const ps = patterns(S.corrections);
  $("#mePatterns").innerHTML = ps.length ? ps.map(p => { const open = Object.values(S.corrections).filter(c => isOpen(c) && c.tag === p.tag).sort((a, b) => (a.date || "").localeCompare(b.date || ""))[0]; return `<div class="row pattern"><span class="grow">${TAG_EMOJI[p.tag]} You've had this note ${p.n} times: <b>${TAG_LABEL[p.tag]}</b></span>${open ? `<button class="btn sm sun" onclick="meGotIt('${open.id}')">Got it!</button>` : `<span class="chip mint">all closed</span>`}</div>`; }).join("") : `<span class="small muted">No repeats. Nice.</span>`;
}
function meStyle(k){ styleOpen = styleOpen === k ? null : k; renderMe(); }
async function meSkill(id){ const next = await kidCycle(id); if (next === "checked") toast("Teacher-checked ★ stays"); }
async function meGotIt(id){ const c = await closeCorrection(id); if (c) toast("Got it! ✅"); checkBadges(); }

// Long-press on the avatar opens Grown-ups; a short tap opens the customizer.
export function initMe(){
  const av = $("#avWrap"); let t = null, long = false;
  const down = () => { long = false; t = setTimeout(() => { long = true; openGrownups(); }, 650); };
  const up = () => { clearTimeout(t); if (!long) avToggle(); };
  av.addEventListener("pointerdown", down); av.addEventListener("pointerup", up); av.addEventListener("pointerleave", () => clearTimeout(t)); av.addEventListener("pointercancel", () => clearTimeout(t));
  av.addEventListener("contextmenu", e => e.preventDefault());
  $("#meGrownups").onclick = () => openGrownups();
}
export { renderMe };
expose({ meStyle, meSkill, meGotIt });
