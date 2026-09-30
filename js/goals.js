// Progress goals (flexibility, strength, balance): presets + custom, a check-in every two weeks (photo or clip, optional
// number), a line chart, and a first-vs-latest slider compare. Photos live in the family space and are only shown here.
import { $, esc, toast, uid, expose, todayStr } from "./util.js";
import { S, storeSet, storeDel, setSettings } from "./store.js";
import { media, friendlyError } from "./sync.js";
import { resizeImage, VIDEO_MAX_BYTES } from "./media.js";
import { shiftDate } from "./corrections.js";
import { detectImage } from "./pose.js";
import { readouts } from "./posemath.js";

export const PRESETS = [
  { key: "split-r", name: "Right split", unit: "deg", measure: "split", target: 180, emoji: "🦵" },
  { key: "split-l", name: "Left split", unit: "deg", measure: "split", target: 180, emoji: "🦵" },
  { key: "split-m", name: "Middle split", unit: "deg", measure: "split", target: 180, emoji: "🧘" },
  { key: "bridge", name: "Bridge", unit: "sec", target: 20, emoji: "🌉" },
  { key: "arabesque", name: "Arabesque height", unit: "deg", measure: "knee", target: 90, emoji: "🕊️" },
  { key: "side-ext", name: "Side extension height", unit: "deg", target: 120, emoji: "🦩" },
  { key: "handstand", name: "Handstand hold", unit: "sec", target: 10, emoji: "🤸" },
  { key: "hollow", name: "Hollow hold", unit: "sec", target: 45, emoji: "💪" },
  { key: "passe", name: "Passé balance on relevé", unit: "sec", target: 15, emoji: "🩰" },
  { key: "aerial", name: "Aerial progression", unit: "", target: 0, emoji: "🦋" },
];
export const UNIT_LABEL = { sec: "seconds held", deg: "degrees", "": "" };
export const CADENCE_DAYS = 14;

// ---- pure helpers (tested) ----
export const checkins = (g) => (g && Array.isArray(g.checkins) ? g.checkins : []).filter(c => c && c.date).sort((a, b) => a.date.localeCompare(b.date));
export const latest = (g) => { const c = checkins(g); return c.length ? c[c.length - 1] : null; };
export const first = (g) => { const c = checkins(g); return c.length ? c[0] : null; };
// Ring progress 0–100: numeric goals = latest / target; others = check-ins toward six.
export function progress(g){ const l = latest(g); if (!l) return 0; if (g.target > 0 && typeof l.value === "number") return Math.max(0, Math.min(100, Math.round(100 * l.value / g.target))); return Math.min(100, Math.round(100 * checkins(g).length / 6)); }
export const dueOn = (g) => { const l = latest(g); return l ? shiftDate(l.date, CADENCE_DAYS) : (g.createdAt || todayStr()); };
export const isDue = (g, today = todayStr()) => dueOn(g) <= today;
export function dueGoals(goals, today = todayStr(), snoozeUntil = ""){ if (snoozeUntil && snoozeUntil > today) return []; return Object.values(goals || {}).filter(g => !g.deleted && isDue(g, today)); }
// Chart points as an SVG polyline over [0,100]x[0,100] (x by date order, y by value against the max of target/values).
export function chartPoints(g){ const c = checkins(g).filter(x => typeof x.value === "number"); if (c.length < 1) return ""; const max = Math.max(g.target || 0, ...c.map(x => x.value)) || 1; return c.map((x, i) => `${c.length === 1 ? 50 : (100 * i / (c.length - 1)).toFixed(1)},${(100 - 100 * x.value / max).toFixed(1)}`).join(" "); }

// ---- store ----
export async function addGoal(preset, custom = {}){
  const id = "g" + uid(); const p = PRESETS.find(x => x.key === preset);
  const g = { id, name: custom.name || (p ? p.name : "My goal"), preset: p ? p.key : "custom", unit: custom.unit !== undefined ? custom.unit : (p ? p.unit : ""), measure: p ? p.measure || "" : "", target: custom.target !== undefined ? +custom.target || 0 : (p ? p.target : 0), emoji: p ? p.emoji : "⭐", createdAt: todayStr(), checkins: [] };
  await storeSet("goals", id, g); return g;
}
export async function removeGoal(id){ const g = S.goals[id]; if (!g) return; await storeSet("goals", id, { ...g, deleted: true }); }
export async function setTarget(id, target){ const g = S.goals[id]; if (!g) return; await storeSet("goals", id, { ...g, target: +target || 0 }); }
async function snooze(){ await setSettings({ goalSnooze: shiftDate(todayStr(), 3) }); toast("Okay — I'll ask again in a few days"); }

// A check-in: a photo (shrunk, uploaded to the family space under photos/ with kind "goal") or a short clip, plus an optional number.
export async function checkIn(goalId, file, value){
  const g = S.goals[goalId]; if (!g) return; const id = uid(); let mediaRec = null;
  if (file) {
    if (file.type.startsWith("video/")) { if (file.size > VIDEO_MAX_BYTES) throw new Error("Clips up to 50 MB"); const up = await media.upload("videos", id, file, { contentType: file.type, name: file.name }); mediaRec = { kind: "video", path: up.path, url: up.url, size: file.size }; }
    else { const { blob, w, h } = await resizeImage(file, 1200); const up = await media.upload("photos", id, blob, { contentType: "image/jpeg", name: file.name }); mediaRec = { path: up.path, url: up.url, w, h, size: blob.size }; }
    await storeSet("photos", id, { ...mediaRec, cap: g.name, dance: "", goal: goalId, at: new Date().toISOString() });
  }
  const c = { id, date: todayStr(), at: new Date().toISOString(), photoId: file ? id : "", value: Number.isFinite(+value) && value !== "" && value !== null ? +value : null };
  await storeSet("goals", goalId, { ...g, checkins: [...checkins(g), c] });
  return c;
}
// Measure a split/arabesque photo with the pose tool before saving the check-in.
export async function measurePhoto(file, measure){
  const img = await new Promise((res, rej) => { const u = URL.createObjectURL(file); const im = new Image(); im.onload = () => { URL.revokeObjectURL(u); res(im); }; im.onerror = () => rej(new Error("Couldn't read the photo")); im.src = u; });
  const cv = document.createElement("canvas"); const sc = Math.min(1, 768 / Math.max(img.naturalWidth, img.naturalHeight)); cv.width = Math.round(img.naturalWidth * sc); cv.height = Math.round(img.naturalHeight * sc); cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
  const lm = await detectImage(cv); if (!lm) return null; const r = readouts(lm); return measure === "knee" ? r.numbers.knee ?? null : r.numbers.split ?? null;
}

// ---- UI: Me card + goal modal + Today reminder ----
const ring = (pct, emoji) => { const r = 26, c = 2 * Math.PI * r; return `<svg viewBox="0 0 64 64" class="mini-ring goal-ring"><circle cx="32" cy="32" r="${r}" class="ring-bg"/><circle cx="32" cy="32" r="${r}" class="ring-fg" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct / 100)}"/><text x="32" y="32" class="ring-ic">${emoji}</text></svg>`; };
const photoOf = (c) => c && c.photoId && S.photos[c.photoId] ? S.photos[c.photoId] : null;
export function renderGoalsCard(){
  const el = $("#goalRings"); if (!el) return; const list = Object.values(S.goals).filter(g => !g.deleted).sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
  el.innerHTML = list.map(g => { const l = latest(g); const ph = photoOf(l); return `<button class="goal-tile" onclick="openGoal('${g.id}')">${ring(progress(g), g.emoji || "⭐")}<small>${esc(g.name)}</small>${ph && ph.url && ph.kind !== "video" ? `<img src="${esc(ph.url)}" alt="">` : `<span class="goal-empty">${l ? "🎥" : "＋ check in"}</span>`}${l && typeof l.value === "number" ? `<small class="muted">${l.value}${g.unit === "sec" ? " s" : g.unit === "deg" ? "°" : ""}</small>` : ""}</button>`; }).join("") + `<button class="goal-tile add" onclick="goalPicker()"><span class="goal-plus">＋</span><small>New goal</small></button>`;
}
export function renderGoalReminder(){
  const el = $("#goalReminder"); if (!el) return; const due = dueGoals(S.goals, todayStr(), S.settings.goalSnooze || "");
  el.hidden = !due.length; if (due.length) el.innerHTML = `<div class="row"><span class="grow">📸 Check-in time: ${esc(due.map(g => g.name).slice(0, 2).join(", "))}${due.length > 2 ? " +" + (due.length - 2) : ""}</span><button class="btn sm coral" onclick="openGoal('${due[0].id}')">Go</button><button class="btn sm ghost" onclick="goalSnooze()">Later</button></div>`;
}
function picker(){
  const have = new Set(Object.values(S.goals).filter(g => !g.deleted).map(g => g.preset));
  body(`<h3>New goal</h3><div class="preset-grid">${PRESETS.map(p => `<button class="btn ${have.has(p.key) ? "ghost" : "sun"}" onclick="goalAdd('${p.key}')" ${have.has(p.key) ? "disabled" : ""}>${p.emoji} ${esc(p.name)}</button>`).join("")}</div>
    <div class="row" style="margin-top:10px"><input type="text" id="goalCustomName" placeholder="Something else…"><select id="goalCustomUnit" style="max-width:120px"><option value="sec">seconds</option><option value="deg">degrees</option><option value="">photo only</option></select><button class="btn sm coral" onclick="goalAddCustom()">Add</button></div>`);
  $("#goal").hidden = false; document.body.classList.add("modal");
}
const body = (html) => { $("#goalBody").innerHTML = html; };
let open = null;
export function openGoal(id){
  const g = S.goals[id]; if (!g) return; open = id; $("#goal").hidden = false; document.body.classList.add("modal");
  const cs = checkins(g); const f = first(g), l = latest(g); const fp = photoOf(f), lp = photoOf(l);
  const unit = g.unit === "sec" ? " s" : g.unit === "deg" ? "°" : "";
  const timeline = cs.length ? [...cs].reverse().map(c => { const ph = photoOf(c); return `<div class="tl"><div class="tl-media">${ph ? (ph.kind === "video" ? `<video src="${esc(ph.url)}" playsinline controls preload="metadata"></video>` : `<img src="${esc(ph.url)}" alt="">`) : `<span class="goal-empty">no photo</span>`}</div><div class="tl-meta"><b>${esc(c.date)}</b>${typeof c.value === "number" ? `<br>${c.value}${unit}` : ""}</div></div>`; }).join("") : `<p class="small muted">No check-ins yet.</p>`;
  const pts = chartPoints(g);
  body(`<div class="row"><h3 class="grow">${g.emoji || "⭐"} ${esc(g.name)}</h3><span class="chip sun">${progress(g)}%</span></div>
    <div class="row small muted"><span>Target: <b>${g.target ? g.target + unit : "just keep checking in"}</b></span><button class="lnk" onclick="goalTarget('${g.id}')">change</button><span class="grow"></span><span>Next check-in: ${esc(dueOn(g))}</span></div>
    ${pts ? `<svg viewBox="-4 -4 108 108" class="goal-chart" preserveAspectRatio="none"><line x1="0" y1="${g.target ? 0 : 100}" x2="100" y2="${g.target ? 0 : 100}" class="chart-target"/><polyline points="${pts}" class="chart-line"/>${pts.split(" ").map(p => `<circle cx="${p.split(",")[0]}" cy="${p.split(",")[1]}" r="2.5" class="chart-dot"/>`).join("")}</svg>` : ""}
    ${fp && lp && fp !== lp && fp.kind !== "video" && lp.kind !== "video" ? `<div class="field-lab">First vs latest — slide</div><div class="compare" id="goalCompare"><img src="${esc(fp.url)}" alt=""><img src="${esc(lp.url)}" alt="" id="goalCompareTop" style="clip-path:inset(0 0 0 50%)"><div class="compare-lab"><span>${esc(f.date)}</span><span>${esc(l.date)}</span></div></div><input type="range" id="goalSlider" min="0" max="100" value="50" oninput="document.getElementById('goalCompareTop').style.clipPath='inset(0 0 0 '+this.value+'%)'">` : ""}
    <div class="field-lab">Check in</div>
    <div class="row"><label class="btn coral" for="goalPhoto">📷 Photo / clip</label><input type="file" id="goalPhoto" accept="image/*,video/*" capture="environment" hidden>${g.unit ? `<input type="number" id="goalValue" placeholder="${esc(UNIT_LABEL[g.unit])}" style="max-width:150px" inputmode="decimal">` : ""}<button class="btn sm ghost" onclick="goalCheckIn('${g.id}')">Save</button></div>
    ${g.measure ? `<p class="small muted">Pick a photo and the pose tool fills in the ${g.measure === "knee" ? "knee angle" : "split angle"} for you (you can change it).</p>` : ""}
    <div class="field-lab">Timeline</div><div class="timeline-goal">${timeline}</div>
    <div class="row" style="margin-top:10px"><button class="btn ghost" onclick="closeGoal()">Close</button><span class="grow"></span><button class="btn sm ghost" onclick="goalRemove('${g.id}')">Remove goal</button></div>
    <p class="small muted">Photos stay in the family space and are only shown here. Only flexibility, strength and balance are measured.</p>`);
  $("#goalPhoto").onchange = async (e) => { const f = e.target.files[0]; e.target.value = ""; if (!f) return; pendingFile = f; toast("Photo picked — tap Save"); if (g.measure && f.type.startsWith("image/")) { try { toast("Measuring…", 3000); const v = await measurePhoto(f, g.measure); const inp = $("#goalValue"); if (v !== null && inp) { inp.value = v; toast(`Measured ${v}° — check it, then Save`, 3000); } else toast("Couldn't find the pose — type the number if you know it", 3000); } catch (err) { console.warn(err); toast("Pose tool needs a connection the first time", 3000); } } };
}
let pendingFile = null;
export function closeGoal(){ $("#goal").hidden = true; document.body.classList.remove("modal"); open = null; pendingFile = null; }
async function doCheckIn(id){ const v = ($("#goalValue") || {}).value; if (!pendingFile && (v === undefined || v === "")) return toast("Add a photo or a number first"); try { toast("Saving…", 4000); await checkIn(id, pendingFile, v); pendingFile = null; toast("Checked in ✓"); openGoal(id); } catch (e) { console.warn(e); toast("Couldn't save: " + friendlyError(e), 3500); } }
async function add(key){ const g = await addGoal(key); openGoal(g.id); }
async function addCustom(){ const name = ($("#goalCustomName").value || "").trim(); if (!name) return toast("Name the goal"); const unit = $("#goalCustomUnit").value; const t = unit ? prompt(unit === "sec" ? "Target seconds" : "Target degrees", unit === "sec" ? "10" : "180") : "0"; if (t === null) return; const g = await addGoal("custom", { name, unit, target: +t || 0 }); openGoal(g.id); }
async function target(id){ const g = S.goals[id]; const t = prompt("Target" + (g.unit === "sec" ? " (seconds)" : g.unit === "deg" ? " (degrees)" : ""), String(g.target || "")); if (t === null) return; await setTarget(id, t); openGoal(id); }
async function remove(id){ if (!confirm("Remove this goal? The photos stay in the family space.")) return; await removeGoal(id); closeGoal(); }
export function initGoals(){ $("#goalClose").onclick = closeGoal; $("#goal").addEventListener("click", e => { if (e.target === $("#goal")) closeGoal(); }); }
expose({ openGoal, closeGoal, goalPicker: picker, goalAdd: add, goalAddCustom: addCustom, goalCheckIn: doCheckIn, goalTarget: target, goalRemove: remove, goalSnooze: snooze });
