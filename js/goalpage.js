// One page for every goal, and 📸 My album (1.66.0, Jenya Nov 6). A trick, a split, the aerial: whatever she taps on the
// Skills page opens the same page (#p-goal, lit under the Skills tab) with the same four parts:
//   what's next   a skill: how it's going, its cue, ✓ Got it. The aerial: the first step not ticked yet, how to do it,
//                 ✓ Did it, and all the steps in a fold (the mission's own checklist, practice.js). A measure: her change.
//   my photos     a skill and the aerial: the trick's own lineup (js/lineup.js: add, frames, first vs now, save).
//                 A measure: Before and Now from her check-ins; 📷 Add opens the check-in sheet (js/goals.js: photo or
//                 clip, the pose tool's angle, the timeline). ▶ Play flips through any goal's photos (js/glow.js;
//                 1.66.2: the Growing-up Flipbook's photos moved onto their goals, and this is its player).
//   the coach     its last tip for this goal, older ones folded, 🎬 Coach me (js/coach.js).
//   done          take it off her goals, or put it on.
// 📸 My album on Skills is what the trick cards fold was: the newest photo of every goal she has, and of every skill she is
// learning or has got clean; a teacher-checked one has a gold frame. Nothing new is stored: the album reads the `photos`,
// `goals` and `skills` documents. Pure parts up top (tested in Node).
import { $, esc, fmt, toast, expose } from "./util.js";
import { S } from "./store.js";
import { showPage, currentPage } from "./nav.js";
import { goalRow, goalKind, goalDoc, workingIds, setOnGoals, gotIt, AERIAL_ID, goalHow, workHtml, workedDates, toggleWorked, soloDanceNow, drillIds } from "./working.js";
import { drillsForGoal, goalVideosHtml } from "./drills.js";
import { renderLineup, firstVsNow, lineupCounts } from "./lineup.js";
import { CARD_COLORS } from "./cards.js";
import { aerialHow } from "./views/practice.js";
import { skillState } from "./skills.js";
import { checkins, openGoal } from "./goals.js";
import { openFlip, migrateFlipbook } from "./glow.js";

const day = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || "")) ? fmt(d) : "";
const quote = (n) => esc(n).replace(/'/g, "&#39;");
// The coach's tips for a goal, newest first: [{ date, text }]. Reviews are kept by the skill's name. Pure.
export function coachTips(reviews, name){
  return Object.values(reviews || {}).filter(r => r && !r.deleted && r.review && r.review.fix && r.trick === name).sort((a, b) => String(b.at || b.date || "").localeCompare(String(a.at || a.date || ""))).map(r => ({ date: r.date || "", text: String(r.review.fix) }));
}
export function nextHtml(r){
  if (r.kind === "aerial") {
    const a = r.aerial, head = `<div class="row"><h3 class="grow">What's next</h3><span class="chip sun">${esc(r.how)}</span></div><div class="gp-bar"><i style="width:${Math.round(100 * a.n / (a.total || 1))}%"></i></div>`;
    if (!a.next) return `${head}<p class="gp-how">Every step is ticked. Show it in class!</p>`;
    return `${head}<div class="gp-next"><b>${esc(a.next.text)}</b><div class="small muted">${esc(a.next.section)}</div></div>${aerialHow(a.next)}<div class="row" style="margin-top:8px"><button class="btn sm coral" onclick="toggleAerial('${a.next.id}')">✓ Did it</button></div><p class="small muted">Learned in Monday Acro with a spotter. Mat under you for every drill.</p>`;
  }
  if (r.kind === "measure") return `<h3>How it's going</h3><p class="gp-how">${esc(r.how)}</p><p class="small muted">After a warm-up, only as far as feels okay. Take a photo whenever you like and watch it change.</p>`;
  const got = r.state === "checked" ? "" : r.state === "clean" ? `<button class="btn sm ghost" onclick="gpGot('${r.id}')">↩ Undo</button>` : `<button class="btn sm coral" onclick="gpGot('${r.id}')">✓ Got it</button>`;
  return `<div class="row"><h3 class="grow">How it's going</h3>${got}</div><p class="gp-how">${esc(r.how)}${r.where ? ` <span class="small muted">· ${esc(r.where)}</span>` : ""}</p>${r.tip ? `<p class="small muted">${esc(r.tip)}</p>` : ""}`;
}
// ▶ Play, once there are two photos to flip between. Pure.
export const playBtn = (r) => r.shots.length >= 2 ? `<button class="btn sm aqua" onclick="gpPlay('${r.id}')">▶ Play</button>` : "";
// A measure's photos: Before and Now, then every one in a row. Pure.
export function measurePhotosHtml(r){
  const vs = firstVsNow(r.shots), pic = (p, lab) => `<figure class="gp-shot"><img src="${esc(p.url)}" alt="" loading="lazy"><figcaption>${lab}${day(p.date) ? " · " + esc(day(p.date)) : ""}</figcaption></figure>`;
  const top = vs ? `<div class="gp-vs">${pic(vs.first, "Before")}${pic(vs.now, "Now")}</div>` : r.shots.length ? `<div class="gp-vs">${pic(r.shots[0], "Before")}</div>` : `<p class="small muted">Take one now. Take another in a few weeks, and you'll see the before and the after.</p>`;
  const strip = r.shots.length > 2 ? `<div class="gp-strip">${r.shots.map(p => `<img src="${esc(p.url)}" alt="${esc(day(p.date))}" loading="lazy">`).join("")}</div>` : "";
  return `<div class="row"><h3 class="grow">📷 My photos</h3>${playBtn(r)}${r.shots.length ? `<span class="chip violet">${r.shots.length}</span>` : ""}</div>${top}${strip}<div class="row" style="margin-top:10px"><button class="btn sm" onclick="gpCheckIn('${r.id}')">📷 Add a photo or video</button></div>${r.measure ? `<p class="small muted">Pick a photo and the pose tool fills in the angle for you.</p>` : ""}`;
}
export function coachHtml(r, tips){
  const last = tips[0];
  return `<h3>🎬 Coach</h3>${last ? `<p class="small"><b>Last time${day(last.date) ? ", " + esc(day(last.date)) : ""}:</b> ${esc(last.text)}</p>` : `<p class="small muted">Send a photo or a short video. The coach tells you one thing you did well and one thing to fix.</p>`}
    <div class="row"><button class="btn sm coral" onclick="openCoach('${r.dance || ""}','${quote(r.n)}')">🎬 Coach me</button></div>${tips.length > 1 ? `<details class="more"><summary>Older tips</summary>${tips.slice(1, 6).map(t => `<p class="small">${day(t.date) ? `<b>${esc(day(t.date))}:</b> ` : ""}${esc(t.text)}</p>`).join("")}</details>` : ""}`;
}
export const footHtml = (r) => r.on ? `Done with it for now? <button class="lnk" onclick="gpOn('${r.id}', false)">Take it off my goals</button>` : `<button class="btn sm coral" onclick="gpOn('${r.id}', true)">＋ Put it on my goals</button>`;

// The album: the ones with a photo first (her goals in her order, then the rest, newest photo first), then the ones with
// no photo yet (her goals, then what she is learning or has got clean). [{ id, n, ic, thumb, count, mark, shiny, on }]. Pure.
export function albumItems(ctx = {}){
  const goals = ctx.goals ?? S.goals, skills = ctx.skills ?? S.skills, photos = ctx.photos ?? S.photos, settings = ctx.settings ?? S.settings;
  const working = ctx.working ?? workingIds(settings, ctx.date, { goals, ladder: ctx.ladder }); const opt = { ...ctx, goals, skills, photos, settings, working };
  const ids = [...working];
  for (const id of Object.keys(lineupCounts(photos))) ids.push(id);
  for (const id of Object.keys(skills || {})) if (skillState(skills, id) !== "notyet") ids.push(id);
  for (const g of Object.values(goals || {})) if (g && !g.deleted && checkins(g).length) ids.push(g.preset === "aerial" ? AERIAL_ID : goalKind(g.preset, { goals, ladder: ctx.ladder }) === "measure" ? g.preset : "goal:" + g.id);
  const rows = [...new Set(ids)].map(id => goalRow(id, opt)).filter(Boolean);
  const item = (r) => ({ id: r.id, n: r.n, ic: r.ic, thumb: r.thumb, count: r.shots.length, last: r.shots.length ? String(r.shots[r.shots.length - 1].date || "") : "", on: r.on, shiny: r.state === "checked", mark: r.kind === "measure" ? "" : r.state === "checked" ? "★" : r.state === "clean" ? "◉" : "◔" });
  const mine = rows.filter(r => r.on).map(item), rest = rows.filter(r => !r.on).map(item);
  return [...mine.filter(i => i.count), ...rest.filter(i => i.count).sort((a, b) => b.last.localeCompare(a.last)), ...mine.filter(i => !i.count), ...rest.filter(i => !i.count)];
}
export const ALBUM_CAP = 9;
export function albumHtml(items, { all = false, cap = ALBUM_CAP } = {}){
  if (!items.length) return `<p class="small muted">Your photos line up here. Open a goal and add your first one.</p>`;
  const tile = (i) => `<button class="alb-tile${i.shiny ? " shiny" : ""}" onclick="goalOpen('${i.id}')"><span class="alb-ph">${i.thumb ? `<img src="${esc(i.thumb)}" alt="" loading="lazy">` : i.ic}</span><span class="alb-cap">${esc(i.n)}<small>${i.mark ? i.mark + " " : ""}${i.count ? `${i.count} photo${i.count === 1 ? "" : "s"}` : "no photo yet"}</small></span></button>`;
  const show = all ? items : items.slice(0, cap);
  return `<p class="small muted">Your newest photo of everything you're working on or have got clean. Tap one to open it.</p><div class="alb">${show.map(tile).join("")}</div>${items.length > cap ? `<div class="row" style="margin-top:8px"><button class="lnk small" onclick="albumAll()">${all ? "Show fewer" : `Show all ${items.length}`}</button></div>` : ""}`;
}

// ---- DOM ----
let cur = "", showAll = false;
export function renderAlbum(){ migrateFlipbook(); const el = $("#albumCard"); if (!el) return; const items = albumItems(); el.innerHTML = albumHtml(items, { all: showAll }); const n = $("#albumCount"); if (n) n.textContent = items.length ? String(items.length) : ""; }
// Cards that fold, and this phone remembers how she left each one (localStorage only; nothing in the family space).
// Skills (1.66.1, Jenya: "make the cards in skills collapsable"): her goals and her album open to start. Me (1.66.3, Jenya:
// "collapse all cards in me by default"): every card but her dancer, What's new and the Play tile, closed to start.
export const SKILLS_FOLDS = ["workingFold", "albumFold"];
export const ME_FOLDS = ["momentsFold", "weekFold", "petFold", "passFold", "starsFold", "costumesFold", "badgesFold", "patternsFold"];
export function initFolds(key, ids){
  let saved = {}; try { saved = JSON.parse(localStorage.getItem(key) || "{}") || {}; } catch (e) {}
  for (const id of ids) { const d = $("#" + id); if (!d) continue; if (typeof saved[id] === "boolean") d.open = saved[id]; d.addEventListener("toggle", () => { try { const s = JSON.parse(localStorage.getItem(key) || "{}") || {}; s[id] = d.open; localStorage.setItem(key, JSON.stringify(s)); } catch (e) {} }); }
}
export function initSkillsFolds(){ initFolds("spotlight:skillsFolds", SKILLS_FOLDS); initFolds("spotlight:meFolds", ME_FOLDS); }
export function renderGoalPage(){
  const title = $("#gpTitle"); if (!title || !cur) return; const r = goalRow(cur);
  if (!r) { cur = ""; if (currentPage() === "goal") showPage("skills"); return; }
  title.textContent = `${r.ic} ${r.n}`; $("#gpNext").innerHTML = nextHtml(r);
  const steps = $("#aerialFold"); if (steps) steps.hidden = r.kind !== "aerial";
  const work = $("#gpWork"); if (work) work.innerHTML = workHtml(r, { dates: workedDates(S.practice, r.id), steps: goalHow(r, { soloDance: soloDanceNow() }), videos: goalVideosHtml(drillsForGoal(drillIds(r), S.drills)), notes: Object.values(S.corrections || {}).filter(c => c && c.studio && !c.deleted && c.status !== "done" && c.danceId === "skill:" + r.id) });
  const ph = $("#gpPhotos");
  if (r.kind === "measure") ph.innerHTML = measurePhotosHtml(r);
  else {
    const old = $("#cardsArea"); if (old) old.innerHTML = ""; // the retired binder kept a #tcLineup of its own
    ph.innerHTML = `<div class="row"><h3 class="grow">📷 My photos</h3>${playBtn(r)}</div><div id="tcLineup"></div>`;
    renderLineup({ id: r.id, n: r.n, color: CARD_COLORS[r.style] || CARD_COLORS.solo, state: r.state === "notyet" && r.on ? "learning" : r.state });
  }
  $("#gpCoach").innerHTML = coachHtml(r, coachTips(S.reviews, r.n)); $("#gpFoot").innerHTML = footHtml(r);
}
// Open a goal's page. `steps: true` unfolds the aerial's whole checklist (the printed Aerial Mission's path lands there).
export function goalOpen(id, opts = {}){
  if (!goalKind(id)) return; cur = id; showPage("goal"); renderGoalPage();
  if (opts.steps) { const f = $("#aerialFold"); if (f && !f.hidden) { f.open = true; if (f.scrollIntoView) f.scrollIntoView({ block: "start" }); } }
}
async function gpWorked(id){ const on = await toggleWorked(id); renderGoalPage(); toast(on ? "That's a stepping stone 🪜" : "Taken back"); }
async function gpGot(id){ await gotIt(id); renderGoalPage(); }
async function gpOn(id, want){ const next = await setOnGoals(id, want); if (!next) return; toast(want ? "It's one of your goals ⭐" : "Off your goals. You can pick it again any time."); if (want) renderGoalPage(); else showPage("skills"); }
// A measure's check-in sheet: its document when it has one, else the draft (written at her first check-in).
function gpCheckIn(id){ const g = goalDoc(S.goals, id); openGoal(g ? g.id : "new:" + id); }
// Flip through a goal's photos, oldest first, each labelled with its day.
function gpPlay(id){ const r = goalRow(id); if (!r) return; openFlip(r.shots.map(p => ({ url: p.url, label: day(p.date) })), `${r.ic} ${r.n}`); }
function albumAll(){ showAll = !showAll; renderAlbum(); }
expose({ goalOpen, gpWorked, gpGot, gpOn, gpCheckIn, gpPlay, albumAll });
