// Glow-Up Flipbook: Sofia picks one pose once (settings.glowPose) and takes one photo of it a month. Each photo is an
// ordinary family-space photo doc (same upload path as Moments' keep(): resizeImage → media.upload("photos") →
// storeSet("photos")) with `glow: "YYYY-MM"` (schema 37). Retaking this month's photo replaces it: the newest per month
// is kept and older ones of that month are removed. The Me card shows the pose and how many months; the flipbook stage
// plays the months in order (about 0.7 s a page, pause and scrub) and has a "first vs now" side by side. In the first
// 7 days of a month, Today shows a calm one-line nudge if this month's photo is still missing.
// Pure parts up top (tested in Node); the Today row, the Me card and the flipbook stage below.
import { $, esc, toast, todayStr, uid, expose } from "./util.js";
import { S, storeSet, storeDel, setSettings, docTime, GLOW_POSE_IDS } from "./store.js";
import { MOVES, P } from "./data.js";
import { avatarSVG } from "./avatar.js";
import { openStage } from "./stage.js";
import { media } from "./sync.js";
import { resizeImage } from "./media.js";

// The poses she can pick. `move`/`k` borrow a keyframe from data/moves.json for the little avatar (none for the split).
// The ids are frozen in store.js (GLOW_POSE_IDS) for the migration; tests check the two lists match.
export const GLOW_POSES = [
  { id: "arabesque", n: "Arabesque", ic: "🕊️", move: "arab", k: 1, d: "Standing leg straight, back leg long behind you, arms reaching. Hold onto a chair or the counter if you like." },
  { id: "passe", n: "Passé", ic: "🦩", move: "passe", k: 1, d: "Toe to the side of your knee, standing tall, arms in a soft circle." },
  { id: "first-position", n: "First position", ic: "🌸", move: "plie", k: 0, d: "Heels together, toes turned out only as far as is comfy, arms in first." },
  { id: "releve", n: "Relevé", ic: "🩰", move: "releve", k: 1, d: "Up on the balls of your feet, legs together, arms up high." },
  { id: "split", n: "Split", ic: "🌙", move: "", k: 0, d: "Your split on the floor after a warm-up, only as far as feels okay. Never push into pain." },
];
export const MONTH_RE = /^\d{4}-\d{2}$/;
export const NUDGE_DAYS = 7;
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

// The flipbook pages: one per month (the newest photo of that month wins), oldest month first.
// photos: { id: doc }. Returns [{ id, month, url, at, ...doc }]. Videos, deleted docs and docs without a url are skipped.
export function glowPages(photos = S.photos){
  const best = {};
  for (const [id, p] of Object.entries(photos || {})) {
    if (!p || p.deleted || p.kind === "video" || !p.url || typeof p.glow !== "string" || !MONTH_RE.test(p.glow)) continue;
    const cur = best[p.glow]; if (!cur || docTime(p) >= docTime(cur)) best[p.glow] = { ...p, id, month: p.glow };
  }
  return Object.values(best).sort((a, b) => a.month.localeCompare(b.month));
}
// The older duplicates of a month (what a retake removes), given the id that stays.
export const olderOfMonth = (photos, month, keepId) => Object.entries(photos || {}).filter(([id, p]) => id !== keepId && p && p.glow === month).map(([id]) => id);
export const hasMonth = (month, photos = S.photos) => glowPages(photos).some(p => p.month === month);
// Today's nudge: days 1–7 of a month, this month's photo missing, and only once she has started (picked a pose).
export function showNudge(date = todayStr(), photos = S.photos, settings = S.settings){
  const day = +String(date).slice(8, 10); if (!(day >= 1 && day <= NUDGE_DAYS)) return false;
  if (!glowPose(settings)) return false;
  return !hasMonth(monthKey(date), photos);
}
// First vs now: the first and the newest page (null until there are two months).
export const firstVsNow = (pages) => pages.length >= 2 ? { first: pages[0], now: pages[pages.length - 1], months: monthsBetween(pages[0].month, pages[pages.length - 1].month) } : null;

// The little avatar in her pose (her own look from the avatar builder).
export function poseSVG(pose){
  if (!pose || !pose.move) return `<span class="glow-pose-ic">${pose ? pose.ic : "🌱"}</span>`;
  const m = MOVES.find(x => x.id === pose.move); const kf = m && m.k[pose.k]; if (!kf) return `<span class="glow-pose-ic">${pose.ic}</span>`;
  try { return `<svg class="glow-av" viewBox="60 40 180 220" aria-hidden="true">${avatarSVG(P(kf))}</svg>`; } catch (e) { return `<span class="glow-pose-ic">${pose.ic}</span>`; }
}

// ---------- Today nudge ----------
export function renderGlowNudge(date = todayStr()){
  const el = $("#glowNudge"); if (!el) return;
  if (!showNudge(date)) { el.hidden = true; el.innerHTML = ""; return; }
  const pose = glowPose(); el.hidden = false;
  el.innerHTML = `<span class="grow">🌱 A new month. Your ${esc(pose.n)} photo for the flipbook is ready when you are.</span><button class="btn sm ghost" onclick="glowGo()">📷 Take it</button>`;
}

// ---------- Me card ----------
let picking = false;
export function renderGlowCard(){
  const el = $("#meGlow"); if (!el) return; const pose = glowPose(); const pages = glowPages(); const month = monthKey(); const done = pages.some(p => p.month === month);
  const head = `<div class="row"><h3 class="grow">🌱 Glow-Up Flipbook</h3>${pose ? `<span class="chip violet">${pages.length} month${pages.length === 1 ? "" : "s"}</span>` : ""}</div>`;
  if (!pose || picking) {
    el.innerHTML = `${head}<p class="small muted">One photo a month in the same pose. Flip through later to see how much you've grown. ${pose ? "Same pose every month makes the best flipbook." : "Pick your pose:"}</p>
      <div class="glow-picks">${GLOW_POSES.map(p => `<button class="glow-pick ${pose && pose.id === p.id ? "on" : ""}" onclick="glowPick('${p.id}')"><b>${p.ic} ${esc(p.n)}</b><small>${esc(p.d)}</small></button>`).join("")}</div>
      ${pose ? `<button class="lnk" onclick="glowPickCancel()">Keep ${esc(pose.n)}</button>` : ""}`;
    return;
  }
  el.innerHTML = `${head}<div class="row glow-me"><div class="glow-pose">${poseSVG(pose)}</div><div class="grow"><b>${pose.ic} ${esc(pose.n)}</b> <button class="lnk" onclick="glowChange()" aria-label="Change pose">✏️</button>
      <div class="small muted">${esc(pose.d)}</div>
      <div class="small">${done ? `✓ ${esc(monthName(month))}'s photo is in. Retake it any time this month.` : `${esc(monthName(month))}'s photo is waiting.`}</div></div></div>
    <div class="row" style="margin-top:8px"><label class="btn sm ${done ? "ghost" : "coral"}">📷 This month's photo<input type="file" accept="image/*" hidden onchange="glowFile(this)"></label>${pages.length ? `<button class="btn sm aqua" onclick="openGlow()">▶ Flip</button>` : ""}<span class="small muted glow-status"></span></div>`;
}
function pick(id){ const p = poseFor(id); if (!p) return; picking = false; setSettings({ glowPose: p.id }).then(() => { renderGlowCard(); renderGlowNudge(); }).catch(e => toast("Couldn't save: " + (e.message || e), 3000)); }
function change(){ picking = true; renderGlowCard(); }
function cancelPick(){ picking = false; renderGlowCard(); }
function go(){ const n = $("#glowNudge"); if (n) { n.hidden = true; n.innerHTML = ""; } if (typeof window.showPage === "function") window.showPage("me"); }
const status = (t) => { const c = $("#meGlow"); const s = c && c.querySelector && c.querySelector(".glow-status"); if (s) s.textContent = t; };

// Upload this month's photo (the same path as Moments' keep()), then drop the older ones of this month.
async function takePhoto(input){
  const f = input && input.files && input.files[0]; if (input) input.value = ""; if (!f) return;
  const month = monthKey(); const pose = glowPose();
  try { status("Saving…"); const { blob, w, h } = await resizeImage(f); const id = uid();
    const up = await media.upload("photos", id, blob, { contentType: "image/jpeg", name: `glow-${month}.jpg` });
    await storeSet("photos", id, { path: up.path, url: up.url, w, h, size: blob.size, cap: `🌱 ${pose ? pose.n : "Glow-Up"} · ${monthLabel(month)}`, dance: "", glow: month, at: new Date().toISOString() });
    for (const old of olderOfMonth(S.photos, month, id)) { const p = S.photos[old]; try { await storeDel("photos", old); if (p && p.path) await media.remove(p.path); } catch (e) { console.warn("glow retake", e); } }
    status(""); toast(`🌱 ${monthName(month)} is in your flipbook`); renderGlowCard(); renderGlowNudge(); }
  catch (e) { console.warn(e); status(""); toast("Couldn't save it: " + (e.message || e), 3500); }
}

// ---------- the flipbook stage ----------
const F = { i: 0, playing: false, timer: 0, compare: false };
function stop(){ clearInterval(F.timer); F.timer = 0; F.playing = false; }
function openGlow(){ const pages = glowPages(); if (!pages.length) return toast("Take this month's photo first 📷"); F.i = 0; F.compare = false; renderFlip(); openStage("🌱 Glow-Up Flipbook", [$("#glowArea")], `<button class="btn ghost" onclick="closeStage()">Done</button>`); if (pages.length > 1) play(); }
export function renderFlip(){
  const el = $("#glowArea"); if (!el) return; const pages = glowPages(); const fn = firstVsNow(pages); const pose = glowPose();
  if (F.compare && fn) {
    el.innerHTML = `<div class="glow-vs"><figure><img src="${esc(fn.first.url)}" alt="First: ${esc(monthLabel(fn.first.month))}"><figcaption>First · ${esc(monthLabel(fn.first.month))}</figcaption></figure><figure><img src="${esc(fn.now.url)}" alt="Now: ${esc(monthLabel(fn.now.month))}"><figcaption>Now · ${esc(monthLabel(fn.now.month))}</figcaption></figure></div>
      <p class="glow-grown">${fn.months} month${fn.months === 1 ? "" : "s"} of growing 🌱</p>
      <div class="row"><button class="btn sm ghost" onclick="glowCompare(false)">◀ Back to the flipbook</button></div>`;
    return;
  }
  F.i = Math.max(0, Math.min(F.i, pages.length - 1));
  el.innerHTML = `<div class="glow-book">${pages.map((p, i) => `<figure class="glow-page ${i === F.i ? "on" : ""}" data-i="${i}"><img src="${esc(p.url)}" alt="${esc(monthLabel(p.month))}"></figure>`).join("")}<span class="glow-month">${esc(monthLabel((pages[F.i] || {}).month))}</span></div>
    <div class="row glow-ctl"><button class="btn sm coral" onclick="glowPlay()">${F.playing ? "⏸ Pause" : "▶ Play"}</button><input type="range" class="grow" min="0" max="${Math.max(0, pages.length - 1)}" value="${F.i}" oninput="glowScrub(this.value)" aria-label="Pick a month"><span class="small muted">${F.i + 1}/${pages.length}</span></div>
    ${fn ? `<div class="row"><button class="btn sm aqua" onclick="glowCompare(true)">🪞 First vs now</button></div>` : `<p class="small muted">${pose ? esc(pose.n) + " every month: n" : "N"}ext month there's a second page to flip to.</p>`}`;
}
// Move to a page without rebuilding the images (so nothing flickers while it plays).
function show(i){
  const pages = glowPages(); if (!pages.length) return; F.i = ((i % pages.length) + pages.length) % pages.length; const el = $("#glowArea");
  const figs = el && el.querySelectorAll ? [...el.querySelectorAll(".glow-page")] : [];
  if (figs.length !== pages.length) return renderFlip();
  figs.forEach((f, k) => f.classList.toggle("on", k === F.i));
  const lab = el.querySelector(".glow-month"); if (lab) lab.textContent = monthLabel(pages[F.i].month);
  const r = el.querySelector(".glow-ctl input"); if (r) r.value = F.i; const n = el.querySelector(".glow-ctl .small"); if (n) n.textContent = `${F.i + 1}/${pages.length}`;
}
function play(){ stop(); if (glowPages().length < 2) return renderFlip(); F.playing = true; F.timer = setInterval(() => show(F.i + 1), FLIP_MS); renderFlip(); }
function toggle(){ if (F.playing) { stop(); renderFlip(); } else play(); }
function scrub(v){ if (F.playing) { stop(); renderFlip(); } show(+v || 0); }
function compare(on){ stop(); F.compare = !!on; renderFlip(); }

export function initGlow(){ document.addEventListener("stageclosed", () => { stop(); const a = $("#glowArea"); if (a) a.style.display = "none"; }); }
expose({ glowPick: pick, glowChange: change, glowPickCancel: cancelPick, glowGo: go, glowFile: takePhoto, openGlow, glowPlay: toggle, glowScrub: scrub, glowCompare: compare });
