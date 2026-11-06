// The flip-book (1.66.2, Jenya Nov 6: the Growing-up Flipbook was one more place collecting photos; "everything should be in
// the album"). Until 1.66.1 this was the Growing-up Flipbook: one pose picked once (settings.glowPose), one photo of it a
// month (a photos document with `glow: "YYYY-MM"`, schema 37), a card on Me and a nudge on Today. Now every goal's photos
// are the flip-book: ▶ Play on a goal's page (js/goalpage.js) flips through them oldest to newest, with pause, a scrubber
// and first vs now. The old photos move onto the goal their pose is: arabesque, passé, relevé and first position onto the
// ballet list's skill of that name (the trick's lineup, `card`), the split onto her split (a check-in of the split's goal
// document). Nothing is deleted: the `glow` month stays on the document, and settings.glowPose is left as it was.
// Pure parts up top (tested in Node); the migration and the stage player below.
import { $, esc, todayStr, expose, toast } from "./util.js";
import { S, storeSet, docTime } from "./store.js";
import { openStage } from "./stage.js";
import { addGoal, checkins, splitGoal } from "./goals.js";

// The poses she could pick, and the goal each one's photos belong to now. The ids are frozen in store.js (GLOW_POSE_IDS)
// for schema 37; tests check the two lists match.
export const GLOW_POSES = [
  { id: "arabesque", n: "Arabesque", ic: "🕊️", card: "b-arab" },
  { id: "passe", n: "Passé", ic: "🦩", card: "b-passe" },
  { id: "first-position", n: "First position", ic: "🌸", card: "b-plie" },
  { id: "releve", n: "Relevé", ic: "🩰", card: "b-releve" },
  { id: "split", n: "Split", ic: "🌙", split: true },
];
export const MONTH_RE = /^\d{4}-\d{2}$/;
export const FLIP_MS = 700;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// "2026-10-17" → "2026-10" (a calendar month in local time, from todayStr()).
export const monthKey = (date = todayStr()) => String(date).slice(0, 7);
export const monthLabel = (key) => { if (!MONTH_RE.test(String(key))) return ""; const [y, m] = key.split("-").map(Number); return m >= 1 && m <= 12 ? `${MONTHS[m - 1]} ${y}` : ""; };
export const monthName = (key) => { const m = +String(key).slice(5, 7); return MONTHS_LONG[m - 1] || ""; };
// Whole months from a to b ("2026-01" → "2026-10" = 9).
export const monthsBetween = (a, b) => { const [ya, ma] = a.split("-").map(Number), [yb, mb] = b.split("-").map(Number); return (yb - ya) * 12 + (mb - ma); };
export const poseFor = (id) => GLOW_POSES.find(p => p.id === id) || null;
export const glowPose = (settings = S.settings) => poseFor((settings || {}).glowPose);

// The old flipbook's pages: one per month (the newest photo of that month wins), oldest month first.
// photos: { id: doc }. Returns [{ id, month, url, at, ...doc }]. Videos, deleted docs and docs without a url are skipped.
export function glowPages(photos = S.photos){
  const best = {};
  for (const [id, p] of Object.entries(photos || {})) {
    if (!p || p.deleted || p.kind === "video" || !p.url || typeof p.glow !== "string" || !MONTH_RE.test(p.glow)) continue;
    const cur = best[p.glow]; if (!cur || docTime(p) >= docTime(cur)) best[p.glow] = { ...p, id, month: p.glow };
  }
  return Object.values(best).sort((a, b) => a.month.localeCompare(b.month));
}
// Which split the pose "split" is: the one she has checked in already, if only one has check-ins; else the right one. Pure.
export function splitTarget(goals = S.goals){
  const has = (k) => checkins(splitGoal(goals, k)).length > 0;
  return has("split-l") && !has("split-r") ? "split-l" : "split-r";
}
// Where each old flipbook photo goes: every page not linked yet, by the pose she picked. [{ pid, card }] for a skill's
// lineup, [{ pid, split }] for her split; nothing when no pose was picked or every photo is already linked. Pure.
export function flipbookMoves(photos = S.photos, settings = S.settings, goals = S.goals){
  const pose = glowPose(settings); if (!pose) return [];
  return glowPages(photos).filter(p => !p.card && !p.goal).map(p => pose.split ? { pid: p.id, split: splitTarget(goals) } : { pid: p.id, card: pose.card });
}
// First vs now: the first and the last page (null until there are two).
export const firstVsNow = (pages) => pages.length >= 2 ? { first: pages[0], now: pages[pages.length - 1] } : null;

// ---------- the move (once, when the app finds old pages) ----------
let moving = false;
export async function migrateFlipbook(){
  if (moving) return 0; const moves = flipbookMoves(); if (!moves.length) return 0; moving = true; let n = 0;
  try {
    for (const m of moves) {
      const p = S.photos[m.pid]; if (!p) continue;
      if (m.card) { await storeSet("photos", m.pid, { ...p, card: m.card }); n++; continue; }
      const g = splitGoal(S.goals, m.split) || await addGoal(m.split);
      const date = String(p.at || "").slice(0, 10) || (p.glow + "-01");
      await storeSet("goals", g.id, { ...g, checkins: [...checkins(g), { id: "flip-" + m.pid, date, at: p.at || "", photoId: m.pid, value: null }] });
      await storeSet("photos", m.pid, { ...p, goal: g.id }); n++;
    }
    if (n) toast(`📸 ${n} flipbook photo${n === 1 ? "" : "s"} moved into your album`, 3000);
  } catch (e) { console.warn("flipbook move", e); }
  finally { moving = false; }
  return n;
}

// ---------- the stage player: any goal's photos ----------
const F = { pages: [], i: 0, playing: false, timer: 0, compare: false, title: "" };
function stop(){ clearInterval(F.timer); F.timer = 0; F.playing = false; }
// pages: [{ url, label }], oldest first.
export function openFlip(pages, title = "📸 Flip-book"){
  const list = (pages || []).filter(p => p && p.url); if (!list.length) return toast("Add a photo first 📷");
  F.pages = list; F.i = 0; F.compare = false; F.title = title; renderFlip();
  openStage(title, [$("#glowArea")], `<button class="btn ghost" onclick="closeStage()">Done</button>`); if (list.length > 1) play();
}
export function renderFlip(){
  const el = $("#glowArea"); if (!el) return; const pages = F.pages; const fn = firstVsNow(pages);
  if (F.compare && fn) {
    el.innerHTML = `<div class="glow-vs"><figure><img src="${esc(fn.first.url)}" alt="First: ${esc(fn.first.label || "")}"><figcaption>First · ${esc(fn.first.label || "")}</figcaption></figure><figure><img src="${esc(fn.now.url)}" alt="Now: ${esc(fn.now.label || "")}"><figcaption>Now · ${esc(fn.now.label || "")}</figcaption></figure></div>
      <div class="row"><button class="btn sm ghost" onclick="glowCompare(false)">◀ Back to the flip-book</button></div>`;
    return;
  }
  F.i = Math.max(0, Math.min(F.i, pages.length - 1));
  el.innerHTML = `<div class="glow-book">${pages.map((p, i) => `<figure class="glow-page ${i === F.i ? "on" : ""}" data-i="${i}"><img src="${esc(p.url)}" alt="${esc(p.label || "")}"></figure>`).join("")}<span class="glow-month">${esc((pages[F.i] || {}).label || "")}</span></div>
    <div class="row glow-ctl"><button class="btn sm coral" onclick="glowPlay()">${F.playing ? "⏸ Pause" : "▶ Play"}</button><input type="range" class="grow" min="0" max="${Math.max(0, pages.length - 1)}" value="${F.i}" oninput="glowScrub(this.value)" aria-label="Pick a photo"><span class="small muted">${F.i + 1}/${pages.length}</span></div>
    ${fn ? `<div class="row"><button class="btn sm aqua" onclick="glowCompare(true)">🪞 First vs now</button></div>` : `<p class="small muted">One more photo and there's a second page to flip to.</p>`}`;
}
// Move to a page without rebuilding the images (so nothing flickers while it plays).
function show(i){
  const pages = F.pages; if (!pages.length) return; F.i = ((i % pages.length) + pages.length) % pages.length; const el = $("#glowArea");
  const figs = el && el.querySelectorAll ? [...el.querySelectorAll(".glow-page")] : [];
  if (figs.length !== pages.length) return renderFlip();
  figs.forEach((f, k) => f.classList.toggle("on", k === F.i));
  const lab = el.querySelector(".glow-month"); if (lab) lab.textContent = pages[F.i].label || "";
  const r = el.querySelector(".glow-ctl input"); if (r) r.value = F.i; const n = el.querySelector(".glow-ctl .small"); if (n) n.textContent = `${F.i + 1}/${pages.length}`;
}
function play(){ stop(); if (F.pages.length < 2) return renderFlip(); F.playing = true; F.timer = setInterval(() => show(F.i + 1), FLIP_MS); renderFlip(); }
function toggle(){ if (F.playing) { stop(); renderFlip(); } else play(); }
function scrub(v){ if (F.playing) { stop(); renderFlip(); } show(+v || 0); }
function compare(on){ stop(); F.compare = !!on; renderFlip(); }

export function initGlow(){ document.addEventListener("stageclosed", () => { stop(); const a = $("#glowArea"); if (a) a.style.display = "none"; }); }
expose({ glowPlay: toggle, glowScrub: scrub, glowCompare: compare });
