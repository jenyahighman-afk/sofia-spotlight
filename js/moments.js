// Moments: a photo (or two side by side: then vs now) becomes a styled card with a sticker, the date, the streak and her
// avatar, saved to the phone through the share sheet (Save Image) so it can go into CapCut or to family, and optionally
// kept in the Photos tab. Stickers suggest themselves from the day (a gem, a badge, a streak milestone). Pure parts up
// top (tested in Node); canvas drawing and the stage UI below.
import { $, esc, toast, todayStr, uid, expose, saveBlob, daysUntil, fmt } from "./util.js";
import { S, storeSet, setSettings, events, nextEvent, studioDates } from "./store.js";
import { CLASSES, PRACTICE_ITEMS, P } from "./data.js";
import { computeStreak, dayCounts } from "./streak.js";
import { checkins } from "./goals.js";
import { findSkill } from "./skills.js";
import { avatarSVG } from "./avatar.js";
import { openStage } from "./stage.js";
import { media } from "./sync.js";
import { dancers, pickedNames, momentSub } from "./who.js";

export const SIZES = { story: { w: 1080, h: 1920, label: "9:16" }, post: { w: 1080, h: 1350, label: "4:5" } };
export const MILESTONES = [7, 14, 30, 50, 100];
// Sticker ideas for a day, best first. `big` ones are worth a nudge on Today.
// ctx: { streak, bites, gemTrick, badges (labels earned today), fullPractice, drillTried, eventName, eventDays }
export function stickersFor(ctx = {}){
  const out = []; const s = +ctx.streak || 0; const bites = Array.isArray(ctx.bites) ? ctx.bites : [];
  if (MILESTONES.includes(s)) out.push({ key: "milestone", emoji: "🔥", text: `${s}-day streak!`, big: true });
  if (ctx.gemTrick) out.push({ key: "gem", emoji: "💎", text: `Gem! ${ctx.gemTrick}`, big: true });
  for (const b of ctx.badges || []) out.push({ key: "badge", emoji: "🏅", text: String(b), big: true });
  if (ctx.fullPractice) out.push({ key: "practice", emoji: "✅", text: "Full practice done" });
  if (s > 0 && !MILESTONES.includes(s)) out.push({ key: "streak", emoji: "🔥", text: `Day ${s}` });
  if (bites.includes("tired")) out.push({ key: "rest", emoji: "😴", text: "Rest day. Still here." });
  if (ctx.drillTried) out.push({ key: "drill", emoji: "📎", text: "Tried it from a clip" });
  if (bites.includes("trick") && !ctx.drillTried) out.push({ key: "trick", emoji: "⚔️", text: "Trick Quest day" });
  const ev = shortEventName(ctx.eventName);
  if (ev && ctx.eventDays >= 0) out.push({ key: "event", emoji: "🎀", text: ctx.eventDays === 0 ? `${ev} day!` : `${ctx.eventDays} days to ${ev}` });
  out.push({ key: "dance", emoji: "💃", text: "Dance day" });
  return out;
}
// An event's name without the part in brackets, for a sticker or a chip: "Winter Showcase (Winter Formal)" → "Winter Showcase".
// Shared with Today's countdown sticker and chip (views/home.js).
export const shortEventName = (name) => String(name || "").replace(/\s*\([^)]*\)/g, "").trim();
export const nudgeFor = (stickers) => (stickers || []).find(s => s.big) || null;
// The source rect of an iw×ih image that fills a w×h box edge to edge (centre crop).
export function coverRect(iw, ih, w, h){ const s = Math.max(w / iw, h / ih); const cw = w / s, ch = h / s; return { sx: (iw - cw) / 2, sy: (ih - ch) / 2, sw: cw, sh: ch }; }
export const daysBetween = (a, b) => Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 86400000);
// Then-vs-now pairs from the goals: the first and the latest photo check-in of every goal that has two or more.
export function thenNowPairs(goals, photos){
  const out = [];
  for (const g of Object.values(goals || {})) {
    if (!g || g.deleted) continue; const ph = checkins(g).filter(c => c.photoId && photos[c.photoId] && photos[c.photoId].url && photos[c.photoId].kind !== "video"); if (ph.length < 2) continue;
    const a = ph[0], b = ph[ph.length - 1]; out.push({ goalId: g.id, label: g.name, then: { url: photos[a.photoId].url, date: a.date }, now: { url: photos[b.photoId].url, date: b.date }, days: daysBetween(a.date, b.date) });
  }
  return out;
}
// Break a line into at most three that fit maxW (measure = text → width).
export function wrapLines(text, maxW, measure){ const words = String(text).trim().split(/\s+/); const lines = []; let cur = ""; for (const w of words) { const t = cur ? cur + " " + w : w; if (measure(t) > maxW && cur) { lines.push(cur); cur = w; } else cur = t; } if (cur) lines.push(cur); return lines.slice(0, 3); }

// ---------- drawing ----------
function roundRect(ctx, x, y, w, h, r){ ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
const loadImg = (url, cors) => new Promise((res, rej) => { const im = new Image(); if (cors) im.crossOrigin = "anonymous"; im.onload = () => res(im); im.onerror = () => rej(new Error("Couldn't read that picture")); im.src = url; });
async function fileImage(file){ const url = URL.createObjectURL(file); try { return await loadImg(url); } finally { setTimeout(() => URL.revokeObjectURL(url), 2000); } }
// Her avatar (arms up) as an image for the card corner.
async function avatarImage(){
  try { const pose = P({ el: [-36, -40], er: [36, -40], hl: [-58, -52], hr: [58, -52], kr: [26, 26], fr: [8, 36] }); const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="90 30 120 230" width="240" height="460">${avatarSVG(pose)}</svg>`;
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" })); try { return await loadImg(url); } finally { setTimeout(() => URL.revokeObjectURL(url), 2000); } }
  catch (e) { console.warn("avatar image", e); return null; }
}
// Draw the card. o: { size, photos: [img] (0–2), sticker: {emoji, text}, sub, date, labels: [then, now], avatar }
export function drawMoment(cv, o){
  const { w, h } = SIZES[o.size] || SIZES.story; cv.width = w; cv.height = h; const ctx = cv.getContext("2d"); const imgs = (o.photos || []).filter(Boolean);
  const dim = (im) => [im.naturalWidth || im.width, im.naturalHeight || im.height];
  if (imgs.length >= 2) { const half = w / 2; imgs.slice(0, 2).forEach((im, i) => { const [iw, ih] = dim(im); const r = coverRect(iw, ih, half, h); ctx.drawImage(im, r.sx, r.sy, r.sw, r.sh, i * half, 0, half, h); }); ctx.fillStyle = "#fff"; ctx.fillRect(half - 4, 0, 8, h); }
  else if (imgs.length === 1) { const [iw, ih] = dim(imgs[0]); const r = coverRect(iw, ih, w, h); ctx.drawImage(imgs[0], r.sx, r.sy, r.sw, r.sh, 0, 0, w, h); }
  else { const g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0, "#FFC2D6"); g.addColorStop(0.55, "#FF7FAE"); g.addColorStop(1, "#D9B3FF"); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); ctx.fillStyle = "rgba(255,255,255,.18)"; for (let i = 0; i < 14; i++) { ctx.beginPath(); ctx.arc((i * 211) % w, (i * 397) % (h * 0.6), w * 0.04 + (i % 3) * w * 0.02, 0, Math.PI * 2); ctx.fill(); } }
  const grad = ctx.createLinearGradient(0, h * 0.5, 0, h); grad.addColorStop(0, "rgba(74,35,64,0)"); grad.addColorStop(1, "rgba(74,35,64,.8)"); ctx.fillStyle = grad; ctx.fillRect(0, h * 0.5, w, h * 0.5);
  if (imgs.length >= 2 && o.labels) { ctx.font = `700 ${Math.round(w * 0.045)}px Fredoka, Nunito, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    o.labels.forEach((t, i) => { const cx = w * (0.25 + 0.5 * i), y = Math.round(h * 0.06), tw = ctx.measureText(t).width + w * 0.06; ctx.fillStyle = i ? "#FF5C93" : "rgba(74,35,64,.78)"; roundRect(ctx, cx - tw / 2, y - w * 0.04, tw, w * 0.08, w * 0.04); ctx.fill(); ctx.fillStyle = "#fff"; ctx.fillText(t, cx, y); }); }
  const pad = Math.round(w * 0.07), avW = Math.round(w * 0.3 * 120 / 230); const textW = w - pad * 2 - (o.avatar ? avW + pad / 2 : 0);
  const big = Math.round(w * ((o.sticker.text || "").length > 18 ? 0.08 : 0.105));
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.font = `700 ${big}px Fredoka, Nunito, sans-serif`;
  const lines = wrapLines(o.sticker.text, textW, (t) => ctx.measureText(t).width);
  let y = h - pad - Math.round(w * 0.14) - (lines.length - 1) * big * 1.1;
  ctx.font = `${Math.round(w * 0.13)}px system-ui, "Apple Color Emoji", "Noto Color Emoji", sans-serif`; ctx.fillText(o.sticker.emoji || "", pad, y - big * 1.15);
  ctx.font = `700 ${big}px Fredoka, Nunito, sans-serif`; ctx.fillStyle = "#fff"; ctx.shadowColor = "rgba(74,35,64,.45)"; ctx.shadowBlur = w * 0.012; ctx.shadowOffsetY = w * 0.004;
  for (const l of lines) { ctx.fillText(l, pad, y); y += big * 1.1; }
  ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  ctx.font = `700 ${Math.round(w * 0.04)}px Nunito, system-ui, sans-serif`; ctx.fillStyle = "rgba(255,255,255,.95)"; ctx.fillText([o.sub, o.date].filter(Boolean).join("  ·  "), pad, h - pad - Math.round(w * 0.055));
  ctx.font = `700 ${Math.round(w * 0.03)}px Nunito, system-ui, sans-serif`; ctx.fillStyle = "rgba(255,255,255,.7)"; ctx.fillText("✿ Sofia's Spotlight", pad, h - pad);
  if (o.avatar) { const ah = Math.round(w * 0.3); ctx.drawImage(o.avatar, w - pad - avW, h - pad - ah + Math.round(w * 0.025), avW, ah); }
  return cv;
}

// ---------- today's context ----------
export function todayContext(){
  const today = todayStr(); const rec = S.practice[today] || {};
  const streak = computeStreak({ practice: S.practice, classes: CLASSES, events: [...events(), ...studioDates()], totalItems: PRACTICE_ITEMS.length, today });
  const gem = Object.values(S.skills || {}).find(k => k && k.quest && Array.isArray(k.quest.gems) && k.quest.gems.includes(today)); const gemTrick = gem ? ((findSkill(gem.id) || {}).n || "a trick") : "";
  const badges = Object.values(S.badges || {}).filter(b => b && !b.deleted && b.at === today).map(b => b.label);
  const ne = nextEvent();
  return { streak, bites: Array.isArray(rec.bites) ? rec.bites : [], gemTrick, badges, fullPractice: dayCounts({ done: rec.done, total: rec.total }, PRACTICE_ITEMS.length), drillTried: Array.isArray(rec.drills) && rec.drills.length > 0, eventName: ne ? ne.name : "", eventDays: ne ? daysUntil(ne.start) : -1 };
}
export const todayStickers = () => stickersFor(todayContext());
// The nudge Today shows for a big moment, once per day per kind.
export function todayNudge(){ const n = nudgeFor(todayStickers()); if (!n) return null; return S.settings.momentNudge === todayStr() + "|" + n.key ? null : n; }

// The "Who danced" chips on the stage: every dancer, the ones on the card lit. The name goes through esc() inside the
// onclick too, because JSON's own quotes would end the attribute.
export const whoChips = (names, picked) => names.map(n => `<button class="btn sm ${picked.includes(n) ? "coral" : "ghost"}" onclick="mmWho(${esc(JSON.stringify(n))})">${esc(n)}</button>`).join("");
// ---------- the stage UI ----------
const M = { mode: "one", size: "story", sticker: null, imgs: [], labels: null, sub: "", avatar: null, custom: "", names: [], streak: 0 };
let drawTimer = 0;
export async function openMoments(stickerKey){
  const st = todayStickers(); M.sticker = st.find(s => s.key === stickerKey) || st[0]; M.mode = "one"; M.imgs = []; M.labels = null; M.custom = "";
  // Who danced goes on the card (js/who.js): the current pick to start with, toggled on the stage.
  const c = todayContext(); M.streak = c.streak; M.names = pickedNames(); M.sub = momentSub(M.names, M.streak, dancers()[0].n);
  openStage("📸 Moments", [$("#momentsArea")], `<button class="btn ghost" onclick="closeStage()">Done</button>`); render();
  try { await document.fonts.load("700 48px Fredoka"); } catch (e) {}
  if (!M.avatar) M.avatar = await avatarImage(); preview();
}
function render(){
  const st = todayStickers(); if (M.custom) st.unshift({ key: "own", emoji: "✏️", text: M.custom }); const pairs = thenNowPairs(S.goals, S.photos);
  $("#momentsArea").innerHTML = `<p class="small muted">Pick a sticker, add a photo, save it to your phone. Then it's yours: CapCut, grandparents, anyone.</p>
    <div class="row mm-stickers">${st.map(s => `<button class="btn sm ${M.sticker && M.sticker.text === s.text ? "coral" : "ghost"}" onclick="mmSticker(${esc(JSON.stringify(s.text))})">${s.emoji} ${esc(s.text)}</button>`).join("")}<button class="btn sm ghost" onclick="mmOwn()">✏️ My own words</button></div>
    <div class="row" style="margin-top:8px"><span class="small muted">Who danced:</span>${whoChips(dancers().map(d => d.n), M.names)}</div>
    <div class="row" style="margin-top:8px"><button class="btn sm ${M.mode === "one" ? "coral" : "ghost"}" onclick="mmMode('one')">One photo</button><button class="btn sm ${M.mode === "two" ? "coral" : "ghost"}" onclick="mmMode('two')">Then vs now</button><span class="grow"></span>${Object.entries(SIZES).map(([k, v]) => `<button class="btn sm ${M.size === k ? "coral" : "ghost"}" onclick="mmSize('${k}')">${v.label}</button>`).join("")}</div>
    ${M.mode === "one" ? `<div class="row" style="margin-top:8px"><label class="btn sm aqua" for="mmPhoto">📷 Add a photo</label><input type="file" id="mmPhoto" accept="image/*" hidden><span class="small muted">No photo? The card works with just the sticker.</span></div>`
      : `<div class="row" style="margin-top:8px"><label class="btn sm aqua" for="mmThen">📷 Then</label><input type="file" id="mmThen" accept="image/*" hidden><label class="btn sm aqua" for="mmNow">📷 Now</label><input type="file" id="mmNow" accept="image/*" hidden>${pairs.length ? `<select id="mmPair" style="max-width:220px"><option value="">From my goal check-ins…</option>${pairs.map((p, i) => `<option value="${i}">${esc(p.label)} · ${esc(fmt(p.then.date))} → ${esc(fmt(p.now.date))}</option>`).join("")}</select>` : ""}</div>`}
    <canvas id="mmCanvas" class="mm-canvas ${M.size}"></canvas>
    <div class="row" style="margin-top:8px"><button class="btn coral" onclick="mmSave()">💾 Save to Photos</button><button class="btn ghost" onclick="mmKeep()">✨ Keep in the app</button></div><p class="small muted" id="mmStatus"></p>`;
  const onFile = (id, slot) => { const el = $("#" + id); if (!el) return; el.onchange = async (e) => { const f = e.target.files[0]; e.target.value = ""; if (!f) return; try { const im = await fileImage(f); if (M.mode === "one") M.imgs = [im]; else { M.imgs[slot] = im; M.labels = M.labels || ["THEN", "NOW"]; } preview(); } catch (err) { toast(err.message, 3000); } }; };
  onFile("mmPhoto", 0); onFile("mmThen", 0); onFile("mmNow", 1);
  const sel = $("#mmPair"); if (sel) sel.onchange = async () => { const p = pairs[+sel.value]; if (!p) return; status("Loading the check-ins…"); try { M.imgs = await Promise.all([loadImg(p.then.url, true), loadImg(p.now.url, true)]); M.labels = [`THEN · ${fmt(p.then.date)}`, `NOW · ${fmt(p.now.date)}`]; M.sub = `${esc(p.label)} · ${p.days} days apart`; status(""); preview(); } catch (e) { status(""); toast("The app can't read those from the cloud on this phone. Pick the two photos from Photos instead.", 4000); } };
  preview();
}
const status = (t) => { const el = $("#mmStatus"); if (el) el.textContent = t; };
function preview(){ clearTimeout(drawTimer); drawTimer = setTimeout(() => { const cv = $("#mmCanvas"); if (!cv || !M.sticker) return; try { drawMoment(cv, { size: M.size, photos: M.imgs, sticker: M.sticker, sub: M.sub, date: fmt(todayStr()), labels: M.labels, avatar: M.avatar }); } catch (e) { console.warn(e); } }, 30); }
function setSticker(text){ const st = todayStickers(); M.sticker = st.find(s => s.text === text) || { key: "own", emoji: "✏️", text }; render(); }
function own(){ const t = prompt("Your words for the card", M.custom || ""); if (t === null) return; M.custom = String(t).trim().slice(0, 60); if (M.custom) M.sticker = { key: "own", emoji: "✨", text: M.custom }; render(); }
function setMode(m){ M.mode = m; M.imgs = []; M.labels = null; render(); }
function setWho(name){ const order = dancers().map(d => d.n); M.names = M.names.includes(name) ? M.names.filter(n => n !== name) : order.filter(n => n === name || M.names.includes(n)); M.sub = momentSub(M.names, M.streak, dancers()[0].n); render(); }
function setSize(s){ M.size = s; render(); }
async function toBlob(){ const cv = $("#mmCanvas"); return new Promise((res, rej) => { try { cv.toBlob(b => b ? res(b) : rej(new Error("Couldn't make the picture")), "image/jpeg", 0.92); } catch (e) { rej(e); } }); }
async function save(){ try { const b = await toBlob(); await saveBlob(b, `sofia-moment-${todayStr()}.jpg`); status("Saved. Look in Photos (or Files)."); } catch (e) { console.warn(e); toast(/tainted|security/i.test(String(e)) ? "That photo came from the cloud and can't be saved here. Pick it from Photos instead." : "Couldn't save: " + e.message, 4000); } }
async function keep(){
  try { const b = await toBlob(); const id = uid(); status("Keeping it…"); const { w, h } = SIZES[M.size]; const up = await media.upload("photos", id, b, { contentType: "image/jpeg", name: `moment-${todayStr()}.jpg` });
    await storeSet("photos", id, { path: up.path, url: up.url, w, h, size: b.size, cap: M.sticker.text, dance: "", moment: true, at: new Date().toISOString() }); status("Kept ✨ It's in Photos with friends & team."); toast("Kept ✨"); }
  catch (e) { console.warn(e); status(""); toast("Couldn't keep it: " + (e.message || e), 3500); }
}
async function later(){ const n = nudgeFor(todayStickers()); if (n) await setSettings({ momentNudge: todayStr() + "|" + n.key }); }
export const momentCount = () => Object.values(S.photos || {}).filter(p => p && p.moment && !p.deleted).length;
expose({ openMoments, mmSticker: setSticker, mmOwn: own, mmMode: setMode, mmWho: setWho, mmSize: setSize, mmSave: save, mmKeep: keep, mmLater: later });
