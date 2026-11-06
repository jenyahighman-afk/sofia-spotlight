// ⭐ My goals (1.66.0, Jenya Nov 6: "It's all connected but can be confusing where to go and what to do … working on splits
// is an ongoing goal. Aerial is her current acro goal. Improving tricks she is using in solo and trio are also her current
// goals"). The top of the Skills page is one list of what she is working on, whatever kind it is:
//   a skill     any id in data/skills.json, or a trick of her own (settings.ownSkills, js/skills.js: the trio has no list).
//               Its record is the `skills` document, its photos the trick's lineup (photos with `card: id`, js/lineup.js).
//   the aerial  the acro chart's "Aerial" (a-aerial) with the mission's steps (data/aerial.json, ticks in settings.aerial).
//   a measure   a preset of js/goals.js (the three splits, bridge, handstand hold …) or a goal document of her own
//               ("goal:<id>"). Its check-ins and photos are the `goals` document, written at her first check-in.
// Every row opens the same page (js/goalpage.js): what's next, her photos, the coach, done. settings.working = [id, …] in
// her order, up to WORK_MAX (1.65.0 introduced it as "⭐ I'm working on"; the stored field is the same). Until she picks,
// the list starts with what she is working on already: this month's ⭐ skill, the aerial, the three splits and any goal she
// has. Picking a skill she hasn't started marks it "learning", the record a tap in a list writes. Nothing is counted or due.
// Pure parts up top (tested in Node).
import { $, esc, todayStr, expose, toast, uid } from "./util.js";
import { S, setSettings } from "./store.js";
import { SKILLS, AERIAL } from "./data.js";
import { findSkill, ownSkills, skillState, kidCycle, levelGroups, STATE_EMOJI, OWN_RE } from "./skills.js";
import { SPLIT_KEYS, PRESETS, splitGoal, checkins } from "./goals.js";
import { monthSkill } from "./monthskill.js";
import { lineup } from "./lineup.js";
import { openStage } from "./stage.js";
import { CLASS_STYLES } from "./views/me.js";
import { lastTrickReview } from "./coachhub.js";

export const WORK_MAX = 8;
export const AERIAL_ID = "a-aerial";
// The measured goals she can pick: every preset but "Aerial progression", which is the aerial's own page.
export const MEASURE_KEYS = PRESETS.map(p => p.key).filter(k => k !== "aerial");
export const GROUPS = [["dances", "💃 In my dances"], ["acro", "🤸 Acro"], ["bendy", "🦵 Bendy and strong"], ["classes", "🩰 My classes"]];
const GOAL_RE = /^goal:([A-Za-z0-9_-]{1,40})$/;
export const goalDocId = (id) => { const m = GOAL_RE.exec(String(id)); return m ? m[1] : ""; };
// The stored goal behind a measured row: her own goal's document, or the oldest kept one of that preset; null until its
// first check-in. Pure.
export function goalDoc(goals, id){ const d = goalDocId(id); if (d) { const g = (goals || {})[d]; return g && !g.deleted ? g : null; } return MEASURE_KEYS.includes(id) ? splitGoal(goals, id) : null; }
// What an id is: "measure", "aerial", "skill", or "" when nothing answers to it any more. Pure.
export function goalKind(id, { goals = S.goals, ladder = SKILLS } = {}){
  if (MEASURE_KEYS.includes(id)) return "measure"; if (goalDocId(id)) return goalDoc(goals, id) ? "measure" : "";
  const s = findSkill(String(id), ladder); return !s ? "" : id === AERIAL_ID ? "aerial" : "skill";
}
// Her list, in her order: only ids that still answer, each once. Not picked yet = what she is working on already. Pure.
export function workingIds(settings, date = todayStr(), { goals = S.goals, ladder = SKILLS } = {}){
  const ok = (id) => !!goalKind(id, { goals, ladder }); const w = (settings || {}).working;
  if (Array.isArray(w)) return [...new Set(w.map(String))].filter(ok).slice(0, WORK_MAX);
  const m = monthSkill(settings, date, ladder);
  const mine = Object.values(goals || {}).filter(g => g && !g.deleted).sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || "")).map(g => MEASURE_KEYS.includes(g.preset) ? g.preset : g.preset === "aerial" ? AERIAL_ID : "goal:" + g.id);
  return [...new Set([...(m ? [m.id] : []), AERIAL_ID, ...SPLIT_KEYS, ...mine])].filter(ok).slice(0, WORK_MAX);
}
// A measured goal in her words: nothing yet, then how many times, then her change since her first number. Never a minus,
// a target or a date (the splits' rule since 1.64.2, now every measure's). Pure.
export function measureNote(g){
  const cs = checkins(g); if (!cs.length) return "No photo yet"; const u = g.unit === "deg" ? "°" : g.unit === "sec" ? " s" : "";
  const nums = cs.filter(c => typeof c.value === "number"); const d = nums.length >= 2 ? Math.round(nums[nums.length - 1].value - nums[0].value) : 0;
  return d > 0 && u ? `▲ ${d}${u} since your first one` : `📷 ${cs.length} time${cs.length === 1 ? "" : "s"} so far`;
}
// Where the aerial mission stands: how many steps are ticked, and the first one that isn't. Pure.
export function aerialStep(settings, steps = AERIAL){
  const done = new Set(Array.isArray((settings || {}).aerial) ? settings.aerial : []); const n = steps.filter(s => done.has(s.id)).length;
  return { n, total: steps.length, next: steps.find(s => !done.has(s.id)) || null };
}
const shortStep = (s) => String((s && s.text) || "").split(/[:,(]/)[0].trim();
// A goal's photos, oldest → newest: [{ id, url, date }]. A skill's are its lineup; a measure's are its check-ins' photos
// (clips are kept with the check-in but are not pictures); the aerial's are both. Pure.
export function goalShots(id, { goals = S.goals, photos = S.photos, ladder = SKILLS } = {}){
  const kind = goalKind(id, { goals, ladder }); if (!kind) return [];
  const fromDoc = (g) => checkins(g).map(c => ({ id: c.photoId, p: (photos || {})[c.photoId], date: c.date })).filter(x => x.p && !x.p.deleted && x.p.url && x.p.kind !== "video").map(x => ({ id: x.id, url: x.p.url, date: x.date }));
  if (kind === "measure") return fromDoc(goalDoc(goals, id));
  const own = lineup(id, photos).map(p => ({ id: p.id, url: p.url, date: p.date }));
  if (kind !== "aerial") return own;
  return [...own, ...Object.values(goals || {}).filter(g => g && !g.deleted && g.preset === "aerial").flatMap(fromDoc)].sort((a, b) => String(a.date).localeCompare(String(b.date)));
}
// One goal's facts, for the list, the album and its page. `how` is the bold line (in the goal's own terms), `where` the
// dance or class it belongs to, `sub` the aerial's next step, `fix` the coach's latest fix for it. Pure.
export function goalRow(id, ctx = {}){
  const goals = ctx.goals ?? S.goals, skills = ctx.skills ?? S.skills, photos = ctx.photos ?? S.photos, reviews = ctx.reviews ?? S.reviews, settings = ctx.settings ?? S.settings, ladder = ctx.ladder ?? SKILLS;
  const kind = goalKind(id, { goals, ladder }); if (!kind) return null;
  const on = (ctx.working ?? workingIds(settings, ctx.date, { goals, ladder })).includes(id);
  const shots = goalShots(id, { goals, photos, ladder }); const thumb = shots.length ? shots[shots.length - 1].url : "";
  const fixOf = (n) => { const rv = lastTrickReview(reviews, n); return rv && rv.review.fix ? { date: rv.date || "", text: String(rv.review.fix) } : null; };
  if (kind === "measure") {
    const g = goalDoc(goals, id), p = PRESETS.find(x => x.key === id); const n = g ? g.name : p.name;
    return { id, kind, on, group: "bendy", n, ic: (g && g.emoji) || (p && p.emoji) || "⭐", how: measureNote(g), where: "", sub: "", tip: "", fix: fixOf(n), thumb, shots, state: "", dance: "", measure: (g && g.measure) || (p && p.measure) || "" };
  }
  const s = findSkill(id, ladder), state = skillState(skills, id), st = (ladder.styles || {})[s.style];
  const group = s.style === "solo" || s.style === "own" ? "dances" : CLASS_STYLES.includes(s.style) ? "classes" : "acro";
  const dance = s.style === "solo" || s.dance === "solo" ? "solo" : s.dance === "trio" ? "trio" : "";
  const base = { id, kind, on, group, n: s.n, ic: kind === "aerial" ? "🦋" : s.style === "own" ? "💃" : (st && st.ic) || "✨", where: dance === "solo" ? "Solo" : dance === "trio" ? "Trio" : group === "classes" ? st.n : "", tip: s.tip || "", fix: fixOf(s.n), thumb, shots, state, dance, style: s.style, sub: "" };
  if (kind === "aerial") { const a = aerialStep(settings); return { ...base, aerial: a, how: a.next ? `Step ${a.n + 1} of ${a.total}` : `All ${a.total} steps done 🎉`, sub: a.next ? "Next: " + shortStep(a.next) : "" }; }
  return { ...base, how: state === "checked" ? "★ Teacher-checked" : state === "clean" ? "◉ Clean" : state === "learning" || on ? `${STATE_EMOJI.learning} Working on it` : "○ Not started" };
}
export function goalRowHtml(r){
  const ph = r.thumb ? `<span class="g-ph"><img src="${esc(r.thumb)}" alt="" loading="lazy"></span>` : `<span class="g-ph none">${r.ic}</span>`;
  const sub = r.fix ? "🎬 Coach: " + esc(r.fix.text) : esc(r.sub || "");
  return `<button class="g-row" onclick="goalOpen('${r.id}')">${ph}<span class="grow"><b>${esc(r.n)}</b><small><span class="how">${esc(r.how)}</span>${r.where ? " · " + esc(r.where) : ""}</small>${sub ? `<small class="g-sub">${sub}</small>` : ""}</span><span class="g-go">›</span></button>`;
}
export function goalsCardHtml(rows, max = WORK_MAX){
  if (!rows.length) return `<p class="small muted">Pick what you want to get better at: a trick, a split, your aerial. You choose, and you can change it any time.</p><div class="row"><button class="btn coral" onclick="wkPick()">＋ Pick a goal</button></div>`;
  const groups = GROUPS.map(([k, label]) => { const part = rows.filter(r => r.group === k); return part.length ? `<div class="g-lab">${label}</div>${part.map(goalRowHtml).join("")}` : ""; }).join("");
  return `${groups}<div class="row wk-more">${rows.length >= max ? `<span class="small muted">That's a full list. Take one off to pick another.</span>` : `<button class="btn sm coral" onclick="wkPick()">＋ Pick a goal</button>`}</div>`;
}
// What she can pick from, in the list's own groups: the tricks in her dances (the solo's, and her own), the acro chart by
// level with the aerial on top and her group's levels first, the splits and the holds, the four class lists. Pure.
export function pickGroups({ skills = S.skills, working = [], goals = S.goals, settings = S.settings, ladder = SKILLS } = {}){
  const on = new Set(working), styles = ladder.styles || {};
  const item = (s) => ({ id: s.id, n: s.n, on: on.has(s.id), state: skillState(skills, s.id) });
  const out = [], own = ladder === SKILLS ? ownSkills(settings) : [];
  out.push({ key: "dances", label: GROUPS[0][1], open: true, own: true, parts: [...(styles.solo ? [{ label: `${styles.solo.ic} ${styles.solo.n}`, items: styles.solo.skills.map(item) }] : []), ...(own.length ? [{ label: "💃 My own", items: own.map(item) }] : [])] });
  for (const [k, st] of Object.entries(styles)) {
    if (k === "solo" || CLASS_STYLES.includes(k)) continue; const groups = levelGroups(st), rest = (list) => list.filter(x => x.id !== AERIAL_ID).map(item);
    const top = st.skills.some(x => x.id === AERIAL_ID) ? [{ label: "", items: [{ ...item({ id: AERIAL_ID, n: "Aerial" }), n: "🦋 Aerial, step by step" }] }] : [];
    out.push({ key: k, label: `${st.ic} ${st.n}`, open: false, parts: [...top, ...(groups ? [...groups.filter(g => g.focus), ...groups.filter(g => !g.focus)].map(g => ({ label: g.label + (g.focus && !g.bonus ? " · your group" : ""), fold: true, items: rest(g.skills) })) : [{ label: "", items: rest(st.skills) }])] });
  }
  const mine = Object.values(goals || {}).filter(g => g && !g.deleted && !PRESETS.some(p => p.key === g.preset)).map(g => ({ id: "goal:" + g.id, n: g.name, on: on.has("goal:" + g.id), state: "" }));
  out.push({ key: "bendy", label: GROUPS[2][1], open: true, parts: [{ label: "", items: [...MEASURE_KEYS.map(k => ({ id: k, n: PRESETS.find(x => x.key === k).name, on: on.has(k), state: "" })), ...mine] }] });
  const cls = CLASS_STYLES.filter(k => styles[k]);
  if (cls.length) out.push({ key: "classes", label: GROUPS[3][1], open: false, parts: cls.map(k => ({ label: `${styles[k].ic} ${styles[k].n}`, items: styles[k].skills.map(item) })) });
  return out;
}
export const chipText = (i) => (i.on ? "⭐ " : i.state === "clean" || i.state === "checked" ? STATE_EMOJI[i.state] + " " : "") + i.n;
export const pickHint = (count, max = WORK_MAX) => "Tap the ones you want. ⭐ means it's one of your goals. " + (count >= max ? "Your list is full: take one off to pick another." : "A few at a time is plenty.");
export function pickerHtml(groups, { count = 0, max = WORK_MAX } = {}){
  const chip = (i) => `<button class="chip${i.on ? " sun" : ""}" onclick="wkToggle('${i.id}', this)">${esc(chipText(i))}</button>`;
  const part = (p) => { const chips = `<div class="ms-pick">${p.items.map(chip).join("")}</div>`; return p.fold ? `<details class="more"><summary>${esc(p.label)}</summary>${chips}</details>` : (p.label ? `<div class="lvl-sec">${esc(p.label)}</div>` : "") + chips; };
  const ownForm = `<p class="small muted wk-own-lab">A trick that isn't here? Add your own.</p><div class="row wk-own"><input type="text" id="wkOwnName" placeholder="Its name" maxlength="40"><select id="wkOwnDance" aria-label="Which dance"><option value="trio">Trio</option><option value="solo">Solo</option><option value="">Other</option></select><button class="btn sm coral" onclick="wkOwnAdd()">Add</button></div>`;
  return `<p class="small muted" id="wkHint">${pickHint(count, max)}</p>` + groups.map(g => `<details class="card acc"${g.open ? " open" : ""}><summary>${esc(g.label)}</summary>${g.parts.map(part).join("")}${g.own ? ownForm : ""}</details>`).join("");
}
// A new trick of her own: its name, and the dance it is in. Pure.
export function ownSkillDoc(name, dance, id = "own-" + uid().replace(/[^a-z0-9]/g, "").slice(-8)){
  const n = String(name || "").replace(/\s+/g, " ").trim().slice(0, 40); return n && OWN_RE.test(id) ? { id, n, dance: ["solo", "trio"].includes(dance) ? dance : "" } : null;
}

// ---- DOM ----
export function renderWorking(){
  const el = $("#workingCard"); if (!el) return; const working = workingIds(S.settings);
  el.innerHTML = goalsCardHtml(working.map(id => goalRow(id, { working })).filter(Boolean));
  const n = $("#workingCount"); if (n) n.textContent = working.length ? String(working.length) : "";
}
async function save(ids){ await setSettings({ working: ids }); renderWorking(); }
// On her goals, or off them. A skill she hasn't started becomes "learning" when it goes on. Returns the list, or null when
// nothing changed (a full list, an id nothing answers to).
export async function setOnGoals(id, want){
  const ids = workingIds(S.settings), on = ids.includes(id); if (on === !!want) return ids; const kind = goalKind(id); if (want && !kind) return null;
  if (want && ids.length >= WORK_MAX) { toast("Your list is full. Take one off to pick another."); return null; }
  const next = want ? [...ids, id] : ids.filter(x => x !== id); await save(next);
  if (want && kind !== "measure" && skillState(S.skills, id) === "notyet") { await kidCycle(id); renderWorking(); }
  return next;
}
// A chip in the picker.
async function wkToggle(id, btn){
  const was = workingIds(S.settings).includes(id); const next = await setOnGoals(id, !was); if (!next) return;
  if (btn && btn.classList) { btn.classList.toggle("sun", !was); const r = goalRow(id, { working: next }); const label = id === AERIAL_ID ? "🦋 Aerial, step by step" : r.n; btn.textContent = chipText({ n: label, on: !was, state: r.state }); }
  const h = $("#wkHint"); if (h) h.textContent = pickHint(next.length);
  toast(was ? "Off your goals" : "It's one of your goals ⭐");
}
// "I've got it clean" and back. Teacher-checked stays.
export async function gotIt(id){ const cur = skillState(S.skills, id); if (cur === "checked" || goalKind(id) === "measure" || !goalKind(id)) return; if (cur === "notyet") await kidCycle(id); await kidCycle(id); renderWorking(); }
function wkPick(){
  const el = document.createElement("div"); el.className = "stage-list"; const working = workingIds(S.settings);
  el.innerHTML = pickerHtml(pickGroups({ working }), { count: working.length });
  openStage("＋ Pick a goal", [el], `<button class="btn coral" onclick="closeStage()">Done</button>`);
}
// Her own trick from the picker's small form: saved in settings.ownSkills and put on her goals.
async function wkOwnAdd(){
  const doc = ownSkillDoc(($("#wkOwnName") || {}).value, ($("#wkOwnDance") || {}).value); if (!doc) return toast("Give it a name first");
  const have = Array.isArray(S.settings.ownSkills) ? S.settings.ownSkills : [];
  if (have.some(o => o && String(o.n).toLowerCase() === doc.n.toLowerCase())) return toast("That one is already there");
  await setSettings({ ownSkills: [...have, doc] }); await setOnGoals(doc.id, true); wkPick(); toast(`${doc.n} is one of your goals ⭐`);
}
expose({ wkToggle, wkPick, wkOwnAdd });
