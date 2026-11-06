// Me tab: avatar (tap = customize, long-press = Grown-ups), her counts, badge case, personal bests, repeated notes. Since 1.61.0
// the skill rings and lists it draws live on the Skills page (index.html #p-skills), with the page's own name.
import { $, esc, toast, expose } from "../util.js";
import { PRACTICE_ITEMS, SKILLS } from "../data.js";
import { S, setSettings } from "../store.js";
import { avRender, avToggle } from "../avatar.js";
import { renderPaletteRow, applyPalette } from "../palette.js";
import { renderRitualCard } from "../mind.js";
import { danceDays, danceCount, practicedDays } from "../streak.js";
import { earned, AUTO_BADGES, checkBadges } from "../badges.js";
import { styleProgress, skillState, kidCycle, STATE_EMOJI, STATE_LABEL, levelGroups, focusLabel } from "../skills.js";
import { patterns, TAG_LABEL, TAG_EMOJI, closeCorrection, closedCount, isOpen } from "../corrections.js";
import { openGrownups } from "../grownups.js";
import { renderGoalsCard, splitRowsHtml } from "../goals.js";
import { totalStars, nextUnlock, unlockedList } from "../stars.js";
import { momentCount } from "../moments.js";
import { renderReminder } from "../remind.js";
import { renderFriends } from "../who.js";
import { renderCardsCard } from "../cards.js";
import { lineupCounts } from "../lineup.js";
import { renderCostumeCard } from "../costume.js";
import { renderGlowCard } from "../glow.js";
import { PIN_MSG } from "../sunday.js";

let styleOpen = null;
// The four class lists (1.64.3, Jenya Nov 5: "keep the four, folded under My classes"). Ballet, Jazz, Contemporary and Hip hop
// are general lists written for the app, not a teacher's chart, so their rings sit in one fold under the Solo tricks and Acro
// rings. Pure.
export const CLASS_STYLES = ["ballet", "jazz", "contemporary", "hiphop"];
export const ringGroups = (prog) => { const all = Object.entries(prog || {}); return { main: all.filter(([k]) => !CLASS_STYLES.includes(k)), classes: all.filter(([k]) => CLASS_STYLES.includes(k)) }; };
const ring = (pct, ic) => { const r = 26, c = 2 * Math.PI * r; return `<svg viewBox="0 0 64 64" class="mini-ring"><circle cx="32" cy="32" r="${r}" class="ring-bg"/><circle cx="32" cy="32" r="${r}" class="ring-fg" transform="rotate(-90 32 32)" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct / 100)}"/><text x="32" y="32" class="ring-ic">${ic}</text></svg>`; };

function renderMe(){
  avRender(); renderGoalsCard(); renderPaletteRow(); applyPalette(); renderRitualCard(); renderSkillsName();
  renderReminder(); renderFriends(); renderCardsCard(); renderCostumeCard(); renderGlowCard();
  $("#meMoments").innerHTML = `<div class="row"><h3 class="grow">📸 Moments</h3><span class="chip violet">${momentCount()} kept</span></div><p class="small muted">Turn a photo into a card with a sticker, your dance days and your dancer. Save it to your phone for CapCut, or keep it here.</p><div class="row"><button class="btn sm coral" onclick="openMoments()">📸 Make a moment</button></div>`;
  const nu = nextUnlock(); $("#meStars").innerHTML = `<div class="stars-big">⭐ ${totalStars()}</div><div class="small">${nu ? `${nu[2] - totalStars()} more to unlock <b>${esc(nu[3])}</b>` : "Everything unlocked!"}${unlockedList().length ? ` · ${unlockedList().length} look${unlockedList().length === 1 ? "" : "s"} unlocked` : ""}</div><div class="small muted">Every game pays 1–3 stars. First play of the day: +1.</div>`;
  $("#meStreak").innerHTML = `<div class="stat"><b>${danceDays(S.practice)}</b><span>dance days ⭐</span></div><div class="stat"><b>${danceCount(S.practice)}</b><span>dances 🎵</span></div><div class="stat"><b>${practicedDays(S.practice, PRACTICE_ITEMS.length)}</b><span>practice days</span></div><div class="stat"><b>${closedCount(S.corrections)}</b><span>fixes closed ✅</span></div>`;
  // badge case
  const got = earned(); const gotKeys = new Set(got.map(b => b.key));
  const locked = AUTO_BADGES.filter(b => !gotKeys.has(b.key));
  $("#badgeCase").innerHTML = (got.length ? got.map(b => `<div class="badge on" title="${esc(b.at || "")}"><span>${b.emoji}</span><small>${esc(b.label)}</small></div>`).join("") : "") + locked.map(b => `<div class="badge"><span>${b.emoji}</span><small>${esc(b.label)}</small></div>`).join("");
  $("#badgeCount").textContent = got.length + " earned";
  renderHide();
  // skills
  const rg = ringGroups(styleProgress(S.skills));
  const ringBtn = ([k, p]) => `<button class="skill-ring ${styleOpen === k ? "on" : ""}" onclick="meStyle('${k}')">${ring(p.pct, p.ic)}<small>${esc(p.n)}</small><small class="muted">${p.checked}★ ${p.clean}◉</small></button>`;
  $("#skillRings").innerHTML = rg.main.map(ringBtn).join("");
  // 🩰 My classes: the four class lists, folded; open while one of them is the open list.
  const cf = $("#classFold"); if (cf) { cf.hidden = !rg.classes.length; if (CLASS_STYLES.includes(styleOpen)) cf.open = true; }
  const cr = $("#classRings"); if (cr) cr.innerHTML = rg.classes.map(ringBtn).join("");
  const cn = $("#classNames"); if (cn) cn.textContent = rg.classes.map(([, p]) => p.n).join(", ");
  const st = styleOpen && SKILLS.styles[styleOpen];
  // A started skill's row gets a small 📷 (with its count) that opens the trick's progress lineup (js/lineup.js, in the binder).
  const shots = lineupCounts();
  const row = (sk) => { const state = skillState(S.skills, sk.id); return `<div class="skill-row"><button class="skill ${state}" onclick="meSkill('${sk.id}')"><span class="st">${STATE_EMOJI[state]}</span><span class="grow">${esc(sk.n)}</span><small>${STATE_LABEL[state]}${state === "checked" && S.skills[sk.id] && S.skills[sk.id].teacher ? " · " + esc(S.skills[sk.id].teacher) : ""}</small></button>${state === "notyet" ? "" : `<button class="skill-cam" onclick="openCards('${sk.id}')" aria-label="Progress photos: ${esc(sk.n)}">📷${shots[sk.id] ? " " + shots[sk.id] : ""}</button>`}</div>`; };
  const groups = st ? levelGroups(st) : null;
  const leveled = () => { const up = groups.filter(g => !g.bonus && g.req.length && g.lvl > Math.min(...(st.focus || [1]))); const reqLine = (g) => `<div class="lvl-up"><b>⭐ To level up · ${esc(g.label)}</b>${g.req.map(r => r.id ? `<span class="chip ${["clean", "checked"].includes(skillState(S.skills, r.id)) ? "mint" : ""}">${STATE_EMOJI[skillState(S.skills, r.id)]} ${esc(r.n)}</span>` : `<span class="chip">○ ${esc(r.n)}</span>`).join("")}</div>`;
    return `<div class="small muted" style="margin:6px 0">${esc(st.src || "")}${focusLabel(st) ? ` · her group: <b>${esc(focusLabel(st))}</b>` : ""}. Tap a skill: learning → clean. A grown-up marks ★ teacher-checked.</div>${up.map(reqLine).join("")}`
      + groups.map(g => { const done = g.skills.filter(k => ["clean", "checked"].includes(skillState(S.skills, k.id))).length; return `<details class="lvl" ${g.focus ? "open" : ""}><summary>${esc(g.label)}${g.focus && !g.bonus ? ` <span class="chip coral">her group</span>` : ""} <span class="chip">${done}/${g.skills.length}</span></summary>${g.bonus ? `<div class="small muted">Not on the studio chart: her own extras.</div>` + g.skills.map(row).join("") : bySection(g.skills)}</details>`; }).join(""); };
  const bySection = (list) => (st.sections || [""]).map(sec => { const part = list.filter(k => (k.sec || "") === sec || (!sec && !k.sec)); return part.length ? (sec ? `<div class="lvl-sec">${esc(sec)}</div>` : "") + part.map(row).join("") : ""; }).join("");
  // The three splits are rows here from the start (1.64.2), above the open style's list.
  $("#skillList").innerHTML = splitRowsHtml(S.goals) + (!st ? "" : groups ? leveled() : `<div class="small muted" style="margin:6px 0">Tap a skill: learning → clean. A grown-up marks ★ teacher-checked.</div>` + st.skills.map(row).join(""));
  // patterns
  const ps = patterns(S.corrections);
  $("#mePatterns").innerHTML = ps.length ? ps.map(p => { const open = Object.values(S.corrections).filter(c => isOpen(c) && c.tag === p.tag).sort((a, b) => (a.date || "").localeCompare(b.date || ""))[0]; return `<div class="row pattern"><span class="grow">${TAG_EMOJI[p.tag]} You've had this note ${p.n} times: <b>${TAG_LABEL[p.tag]}</b></span>${open ? `<button class="btn sm sun" onclick="meGotIt('${open.id}')">Got it!</button>` : `<span class="chip mint">all closed</span>`}</div>`; }).join("") : `<span class="small muted">No repeats. Nice.</span>`;
}
// What's showing (1.63.0): her dancer on Me and her pet (the card on Me and the helper in the corner) can each be put away and
// brought back, by her. settings.hide = { avatar, pet }; nothing is deleted, and both show until she says otherwise. Pure.
export const hidden = (settings) => { const h = (settings || {}).hide; const o = h && typeof h === "object" ? h : {}; return { avatar: !!o.avatar, pet: !!o.pet }; };
function renderHide(){
  const h = hidden(S.settings); const av = $("#avWrap"); if (av) av.hidden = h.avatar; const tip = $("#avTip"); if (tip) tip.hidden = h.avatar; const pc = $("#petCard"); if (pc) pc.hidden = h.pet;
  const el = $("#meHide"); if (!el) return; const row = (k, name, on) => `<div class="row" style="margin-top:6px"><span class="grow">${name}</span><button class="btn sm ${on ? "ghost" : "coral"}" onclick="meHide('${k}')">${on ? "Hidden · show" : "Showing · hide"}</button></div>`;
  el.innerHTML = `<h3>👀 What's showing</h3><p class="small muted">Don't like something? Put it away. You can bring it back here any time.</p>${row("avatar", "💃 My dancer", h.avatar)}${row("pet", "🐰 My pet", h.pet)}`;
}
async function meHide(k){ const h = hidden(S.settings); if (!(k in h)) return; await setSettings({ hide: { ...h, [k]: !h[k] } }); renderHide(); try { document.dispatchEvent(new CustomEvent("hidechanged")); } catch (e) {} toast(hidden(S.settings)[k] ? "Put away. It's under ⚙️ My app if you want it back." : "It's back ✨"); }
// The Skills tab's name (1.61.0, Jenya: "let her name it, with Skills as the default"): settings.skillsName, up to 12 letters. Pure.
export const skillsName = (settings) => { const n = String((settings || {}).skillsName || "").replace(/\s+/g, " ").trim().slice(0, 12); return n || "Skills"; };
function renderSkillsName(){ const n = skillsName(S.settings); const t = $("#skillsTitle"); if (t) t.textContent = n; const b = $("#tabSkills"); if (b) b.textContent = n; }
async function skillsRename(){ const cur = skillsName(S.settings); const next = prompt("What do you want to call this page? (up to 12 letters)", cur); if (next === null) return; await setSettings({ skillsName: String(next).replace(/\s+/g, " ").trim().slice(0, 12) }); renderSkillsName(); toast(`It's called ${skillsName(S.settings)} now ✨`); }
function meStyle(k){ styleOpen = styleOpen === k ? null : k; renderMe(); }
async function meSkill(id){ const next = await kidCycle(id); if (next === "checked") toast("Teacher-checked ★ stays"); }
async function meGotIt(id){ const p = S.corrections[id]; if (p && p.pinned) { toast(PIN_MSG, 3200); openGrownups("skillcheck"); return; } const c = await closeCorrection(id); if (c) toast("Got it! ✅"); checkBadges(); }

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
expose({ meStyle, meSkill, meGotIt, skillsRename, meHide });
