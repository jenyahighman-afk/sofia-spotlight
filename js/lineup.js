// Trick progress lineup (Me → 🃏 → tap a card, or 📷 on a started skill row): every photo linked to a trick card
// (photos.card = skillId, schema 35) in one lineup, oldest → newest, each in a frame she picks and stamped with the
// trick's name, the day and what the trick was then. The newest photo stays the card's art (js/cards.js reads
// cardPhotos() from here). Stored on the photo doc, schema 44: `frame` (one of FRAMES), `taken` (a local YYYY-MM-DD she
// can change; an older card photo falls back to the day of its upload) and `stage` (learning / clean / checked at the
// time). The frames are CSS in the app and canvas when a picture is saved: one framed photo, the whole lineup as one
// sheet, or first vs now, handed to the share sheet like Moments. No image files. Pure parts up top (tested in Node);
// the lineup under the big card, the photo editor and the canvas drawing below.
import { $, esc, toast, todayStr, uid, expose, saveBlob, fmt } from "./util.js";
import { S, storeSet, docTime, FRAME_IDS } from "./store.js";
import { findSkill, skillState } from "./skills.js";
import { media, friendlyError } from "./sync.js";
import { resizeImage } from "./media.js";
import { coverRect, daysBetween, wrapLines } from "./moments.js";

// The frames she can pick. The ids are frozen in store.js (FRAME_IDS) for the migration; a test checks the lists match.
export const FRAMES = [
  { id: "polaroid", n: "Polaroid", ic: "📸" },
  { id: "film", n: "Film strip", ic: "🎞️" },
  { id: "star", n: "Gold star", ic: "⭐" },
  { id: "sparkle", n: "Sparkle", ic: "✨" },
  { id: "spotlight", n: "Spotlight", ic: "🔦" },
  { id: "sticker", n: "Sticker", ic: "🩷" },
];
export const DEFAULT_FRAME = "polaroid";
export const STAGES = ["learning", "clean", "checked"];
const STAGE_LABEL = { learning: "Learning", clean: "Clean", checked: "Teacher-checked" };
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
// A card id is a skill id: lower-case letters, digits and dashes (same as the onclick-safe pattern).
export const CARD_ID_RE = /^[a-z0-9-]{1,40}$/;
export const normalizeCardLink = (v) => typeof v === "string" && CARD_ID_RE.test(v) ? v : null;
export const isFrame = (v) => FRAMES.some(f => f.id === v);
export const frameOf = (id) => FRAMES.find(f => f.id === id) || FRAMES[0];
export const stageLabel = (s) => STAGE_LABEL[s] || "";
// The day a photo is from: `taken`, else the day of its upload (`at`), else "".
export function photoDate(p){ if (!p) return ""; if (DATE_RE.test(String(p.taken || ""))) return p.taken; const d = String(p.at || "").slice(0, 10); return DATE_RE.test(d) ? d : ""; }
// Lineup order: the day, then the upload time (`at`, never re-stamped), then the write time. A frame change writes the
// doc back (new _at) and must not move the photo past one uploaded later the same day.
const order = (p) => photoDate(p) + "|" + String(p.at || "") + "|" + String(docTime(p)).padStart(15, "0");
// A photo that belongs on a card: linked to a skill, not deleted, not a video, has a url.
export const isCardPhoto = (p) => !!p && !p.deleted && p.kind !== "video" && !!p.url && !!normalizeCardLink(p.card);
// One trick's photos, oldest → newest: [{ ...doc, id, date, frame, stage }] (frame and stage normalized for showing).
export function lineup(skillId, photos = S.photos){
  const out = [];
  for (const [id, p] of Object.entries(photos || {})) if (isCardPhoto(p) && p.card === skillId) out.push({ ...p, id, date: photoDate(p), frame: isFrame(p.frame) ? p.frame : DEFAULT_FRAME, stage: STAGES.includes(p.stage) ? p.stage : "" });
  return out.sort((a, b) => order(a).localeCompare(order(b)));
}
// skillId → the newest photo linked to that card: the card's art (js/cards.js).
export function cardPhotos(photos = S.photos){
  const out = {};
  for (const [id, p] of Object.entries(photos || {})) { if (!isCardPhoto(p)) continue; if (!out[p.card] || order(p) > order(out[p.card])) out[p.card] = { ...p, id }; }
  return out;
}
// skillId → how many photos are in its lineup.
export function lineupCounts(photos = S.photos){ const n = {}; for (const p of Object.values(photos || {})) if (isCardPhoto(p)) n[p.card] = (n[p.card] || 0) + 1; return n; }
// First vs now: the first and the newest photo and the days between (null until there are two).
export const firstVsNow = (list) => list.length >= 2 ? { first: list[0], now: list[list.length - 1], days: list[0].date && list[list.length - 1].date ? Math.max(0, daysBetween(list[0].date, list[list.length - 1].date)) : 0 } : null;
// The stamp on a framed photo: the trick's name, the day, what the trick was then.
export const stampFor = (p, name) => ({ name: String(name || ""), date: p.date ? fmt(p.date) : "", stage: stageLabel(p.stage) });

// ---------- the saved picture: 1080 px wide, framed photos in a grid ----------
export const SHEET_W = 1080;
// Cells for n framed photos: 1 across for one, 2 across up to four, 3 across after that; each cell is a photo (3:4) plus
// the stamp band. top / bottom: room for the title line and the footer.
export function gridLayout(n, { W = SHEET_W, pad = 40, top = 50, bottom = 90 } = {}){
  const cols = n <= 1 ? 1 : n <= 4 ? 2 : 3; const rows = Math.max(1, Math.ceil(n / cols));
  const w = Math.floor((W - pad * (cols + 1)) / cols), h = Math.round(w * 1.32);
  const cells = []; for (let i = 0; i < n; i++) cells.push({ x: pad + (i % cols) * (w + pad), y: top + Math.floor(i / cols) * (h + pad), w, h });
  return { cols, rows, w, h, cells, W, H: top + rows * (h + pad) - pad + bottom };
}
function roundRect(ctx, x, y, w, h, r){ ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
const dim = (im) => [im.naturalWidth || im.width, im.naturalHeight || im.height];
function drawPhoto(ctx, img, x, y, w, h, r){ ctx.save(); roundRect(ctx, x, y, w, h, r); ctx.clip(); if (img) { const [iw, ih] = dim(img); const c = coverRect(iw, ih, w, h); ctx.drawImage(img, c.sx, c.sy, c.sw, c.sh, x, y, w, h); } else { ctx.fillStyle = "#F3ECF0"; ctx.fillRect(x, y, w, h); } ctx.restore(); }
const emoji = (ctx, e, x, y, px) => { ctx.font = `${px}px system-ui, "Apple Color Emoji", "Noto Color Emoji", sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "#000"; ctx.fillText(e, x, y); };
// One framed photo in a cell. Each frame: a background, the photo inset, a stamp band at the bottom (the name big, the day
// and stage small) in the frame's colours, and its decoration. u = 1% of the cell width, so a frame scales with its cell.
export function drawFramed(ctx, img, frame, stamp, cell, color = "#FF5C93"){
  const { x, y, w, h } = cell; const u = w / 100; const band = 24 * u; let ink = "#4A2340", sub = "#8A6A80", bandTop = y + h - band;
  ctx.save();
  if (frame === "film") {
    ctx.fillStyle = "#1B1420"; roundRect(ctx, x, y, w, h, 3 * u); ctx.fill();
    ctx.fillStyle = "#FFF8FB"; for (let hx = x + 4 * u; hx + 5 * u <= x + w - 4 * u; hx += 9 * u) { roundRect(ctx, hx, y + 2.5 * u, 5 * u, 3.5 * u, u); ctx.fill(); roundRect(ctx, hx, y + h - 6 * u, 5 * u, 3.5 * u, u); ctx.fill(); }
    bandTop = y + h - 7 * u - band; drawPhoto(ctx, img, x + 4 * u, y + 8.5 * u, w - 8 * u, bandTop - y - 9.5 * u, u); ink = "#F4C86A"; sub = "#FFF0F5";
  } else if (frame === "star") {
    ctx.fillStyle = "#F4C86A"; roundRect(ctx, x, y, w, h, 5 * u); ctx.fill(); ctx.fillStyle = "#FFF8E1"; roundRect(ctx, x + 2.5 * u, y + 2.5 * u, w - 5 * u, h - 5 * u, 4 * u); ctx.fill();
    drawPhoto(ctx, img, x + 6 * u, y + 6 * u, w - 12 * u, bandTop - y - 7 * u, 3 * u); emoji(ctx, "⭐", x + 6 * u, y + 5 * u, 16 * u); ink = "#8A5A00"; sub = "#B07A12";
  } else if (frame === "sparkle") {
    const g = ctx.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, "#FFC2D6"); g.addColorStop(0.5, "#FF7FAE"); g.addColorStop(1, "#D9B3FF"); ctx.fillStyle = g; roundRect(ctx, x, y, w, h, 6 * u); ctx.fill();
    ctx.fillStyle = "#FFF8FB"; roundRect(ctx, x + 3 * u, y + 3 * u, w - 6 * u, h - 6 * u, 5 * u); ctx.fill();
    drawPhoto(ctx, img, x + 6 * u, y + 6 * u, w - 12 * u, bandTop - y - 7 * u, 4 * u); emoji(ctx, "✨", x + w - 7 * u, y + 5 * u, 14 * u); emoji(ctx, "✨", x + 5 * u, bandTop - 4 * u, 11 * u); sub = "#B5509A";
  } else if (frame === "spotlight") {
    ctx.fillStyle = "#1E1738"; roundRect(ctx, x, y, w, h, 4 * u); ctx.fill();
    const px = x + 5 * u, py = y + 9 * u, pw = w - 10 * u, ph = bandTop - y - 10 * u; drawPhoto(ctx, img, px, py, pw, ph, 3 * u);
    ctx.save(); roundRect(ctx, px, py, pw, ph, 3 * u); ctx.clip(); const r = ctx.createRadialGradient(x + w / 2, py, 2 * u, x + w / 2, py, w * 0.85); r.addColorStop(0, "rgba(255,244,200,.5)"); r.addColorStop(1, "rgba(255,244,200,0)"); ctx.fillStyle = r; ctx.fillRect(px, py, pw, ph); ctx.restore();
    ctx.fillStyle = "#F4C86A"; ctx.font = `800 ${3.6 * u}px Nunito, system-ui, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("★   ★   ★", x + w / 2, y + 4.5 * u); ink = "#FFF0F5"; sub = "#F4C86A";
  } else if (frame === "sticker") {
    ctx.fillStyle = "#FFF8FB"; roundRect(ctx, x, y, w, h, 8 * u); ctx.fill();
    ctx.setLineDash([4 * u, 3 * u]); ctx.lineWidth = 2 * u; ctx.strokeStyle = color; roundRect(ctx, x + 2.5 * u, y + 2.5 * u, w - 5 * u, h - 5 * u, 6 * u); ctx.stroke(); ctx.setLineDash([]);
    drawPhoto(ctx, img, x + 7 * u, y + 7 * u, w - 14 * u, bandTop - y - 8 * u, 5 * u); emoji(ctx, "🩷", x + w - 6 * u, y + 5 * u, 14 * u);
  } else { // polaroid
    ctx.shadowColor = "rgba(74,35,64,.28)"; ctx.shadowBlur = 3 * u; ctx.shadowOffsetY = 1.5 * u; ctx.fillStyle = "#FFFFFF"; roundRect(ctx, x, y, w, h, 1.5 * u); ctx.fill(); ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    drawPhoto(ctx, img, x + 5 * u, y + 5 * u, w - 10 * u, bandTop - y - 6 * u, 0.6 * u);
  }
  // the stamp, centred in the band: the name (one or two lines), then the day and what the trick was
  ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = ink;
  const measure = (t) => ctx.measureText(t).width; let big = 7.5 * u; ctx.font = `600 ${big}px Fredoka, Nunito, sans-serif`;
  let lines = wrapLines(stamp.name, w - 12 * u, measure).slice(0, 2);
  if (lines.length > 1) { big = 5.8 * u; ctx.font = `600 ${big}px Fredoka, Nunito, sans-serif`; lines = wrapLines(stamp.name, w - 12 * u, measure).slice(0, 2); }
  const small = 4.4 * u; let ty = bandTop + (band - (lines.length * big * 1.08 + small * 1.4)) / 2 + big / 2;
  for (const l of lines) { ctx.fillText(l, x + w / 2, ty); ty += big * 1.08; }
  ctx.font = `800 ${small}px Nunito, system-ui, sans-serif`; ctx.fillStyle = sub; ctx.fillText([stamp.date, stamp.stage].filter(Boolean).join("  ·  "), x + w / 2, ty - big / 2 + small * 0.9);
  ctx.restore();
}
// The saved picture: a blush sheet, a title line, the framed photos in a grid (a label pill over each cell for first vs
// now), a line under them and the footer. items: [{ img, frame, stamp, color }]; o: { title, labels, sub }.
export function drawSheet(cv, items, o = {}){
  const L = gridLayout(items.length, { top: o.title ? 140 : 50, bottom: o.sub ? 150 : 90 }); cv.width = L.W; cv.height = L.H; const ctx = cv.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, L.W, L.H); g.addColorStop(0, "#FFE6EF"); g.addColorStop(1, "#EBDDFF"); ctx.fillStyle = g; ctx.fillRect(0, 0, L.W, L.H);
  ctx.fillStyle = "rgba(255,255,255,.35)"; for (let i = 0; i < 16; i++) { ctx.beginPath(); ctx.arc((i * 211 + 97) % L.W, (i * 397 + 53) % L.H, 18 + (i % 4) * 14, 0, Math.PI * 2); ctx.fill(); }
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  if (o.title) { ctx.fillStyle = "#4A2340"; ctx.font = "600 54px Fredoka, Nunito, sans-serif"; ctx.fillText(o.title, L.W / 2, 72); }
  items.forEach((it, i) => {
    const c = L.cells[i]; drawFramed(ctx, it.img, it.frame, it.stamp, c, it.color);
    if (o.labels && o.labels[i]) { ctx.font = "600 34px Fredoka, Nunito, sans-serif"; const t = o.labels[i], tw = ctx.measureText(t).width + 50; ctx.fillStyle = i ? "#FF5C93" : "rgba(74,35,64,.8)"; roundRect(ctx, c.x + c.w / 2 - tw / 2, c.y - 26, tw, 52, 26); ctx.fill(); ctx.fillStyle = "#fff"; ctx.fillText(t, c.x + c.w / 2, c.y); }
  });
  if (o.sub) { ctx.fillStyle = "#4A2340"; ctx.font = "600 40px Fredoka, Nunito, sans-serif"; ctx.fillText(o.sub, L.W / 2, L.H - 96); }
  ctx.font = "700 26px Nunito, system-ui, sans-serif"; ctx.fillStyle = "rgba(74,35,64,.6)"; ctx.fillText("✿ Sofia's Spotlight", L.W / 2, L.H - 38);
  return cv;
}

// ---------- the lineup under a big card (js/cards.js renders <div id="tcLineup"> in the big view and calls renderLineup) ----------
const L = { card: null, sel: "", vs: false, lastFrame: DEFAULT_FRAME };
export function resetLineup(){ L.card = null; L.sel = ""; L.vs = false; }
// One framed, stamped photo (CSS frames: css/app.css .lf-*).
export function framedHTML(p, name, color){
  const s = stampFor(p, name);
  return `<figure class="lf lf-${p.frame}" style="--c:${color}"><div class="lf-pic"><img src="${esc(p.url)}" alt="${esc(s.name)}${s.date ? ", " + esc(s.date) : ""}" loading="lazy"></div><figcaption class="lf-stamp"><b>${esc(s.name)}</b><span>${esc([s.date, s.stage].filter(Boolean).join(" · "))}</span></figcaption></figure>`;
}
const editHTML = (p, c) => `<div class="lf-edit"><div class="lf-big">${framedHTML(p, c.n, c.color)}</div>
  <div class="lf-frames">${FRAMES.map(f => `<button class="btn sm ${p.frame === f.id ? "coral" : "ghost"}" onclick="lineupFrame(${esc(JSON.stringify(p.id))}, '${f.id}')">${f.ic} ${esc(f.n)}</button>`).join("")}</div>
  <div class="row" style="justify-content:center;margin-top:8px"><label class="small">📅 Taken <input type="date" value="${esc(p.date)}" max="${todayStr()}" onchange="lineupDate(${esc(JSON.stringify(p.id))}, this.value)"></label></div>
  <div class="row" style="justify-content:center;margin-top:8px"><button class="btn sm coral" onclick="lineupSave('one')">💾 Save this picture</button><button class="btn sm ghost" onclick="lineupOff(${esc(JSON.stringify(p.id))})">Take it off</button><button class="btn sm ghost" onclick="lineupPick('')">Done</button></div></div>`;
const grownLine = (fn) => fn.days ? `${fn.days} day${fn.days === 1 ? "" : "s"} of practice 💪` : "Same day, two tries 💪";
const vsHTML = (fn, c) => `<div class="lf-vs"><div class="lf-vs-col"><span class="lf-tag">First</span>${framedHTML(fn.first, c.n, c.color)}</div><div class="lf-vs-col"><span class="lf-tag now">Now</span>${framedHTML(fn.now, c.n, c.color)}</div></div>
  <p class="lf-grown">${grownLine(fn)}</p>
  <div class="row" style="justify-content:center"><button class="btn sm coral" onclick="lineupSave('vs')">💾 Save this picture</button><button class="btn sm ghost" onclick="lineupVs()">Back to the lineup</button></div>`;
// c: the card from cardList() ({ id, n, color, state, … }). Adding works from learning on; the newest photo is the card's art.
export function renderLineup(c){
  const el = $("#tcLineup"); if (!el || !c) return; if (!L.card || L.card.id !== c.id) { L.sel = ""; L.vs = false; } L.card = c;
  const list = lineup(c.id); const fn = firstVsNow(list); const started = c.state !== "notyet"; if (L.sel && !list.some(p => p.id === L.sel)) L.sel = "";
  const add = started ? `<label class="btn sm aqua">📷 Add a photo<input type="file" accept="image/*" hidden onchange="lineupAdd('${c.id}', this)"></label>` : "";
  if (!list.length) { el.innerHTML = `<div class="row lf-btns">${add}</div><p class="small muted" style="text-align:center">${started ? "Snap one now and one every few weeks. Your lineup shows how far you've come." : "Start learning it on Me → Skills. Then your progress photos line up here."}</p>`; return; }
  const sel = list.find(p => p.id === L.sel);
  el.innerHTML = `<h4 class="lf-head">📷 Progress lineup <span class="small muted">${list.length} photo${list.length === 1 ? "" : "s"} · oldest → newest</span></h4>
    <div class="lf-strip">${list.map(p => `<button class="lf-item ${sel && sel.id === p.id ? "on" : ""}" onclick="lineupPick(${esc(JSON.stringify(p.id))})" aria-label="${esc(p.date ? fmt(p.date) : "Photo")}, ${esc(frameOf(p.frame).n)} frame">${framedHTML(p, c.n, c.color)}</button>`).join("")}</div>
    <div class="row lf-btns">${add}${fn ? `<button class="btn sm ${L.vs ? "coral" : "ghost"}" onclick="lineupVs()">🪞 First vs now</button>` : ""}<button class="btn sm ghost" onclick="lineupSave('all')">🖼️ Save the lineup</button></div>
    <p class="small muted lf-status" id="lfStatus">${sel || L.vs ? "" : "Tap a photo to pick its frame or change the day."}</p>
    ${L.vs && fn ? vsHTML(fn, c) : sel ? editHTML(sel, c) : ""}`;
}
function pick(id){ L.sel = id || ""; L.vs = false; renderLineup(L.card); }
function toggleVs(){ L.vs = !L.vs; L.sel = ""; renderLineup(L.card); }
// Upload like a card photo (resizeImage → media.upload("photos") → storeSet("photos")) and link it with today's day, the
// last frame she picked and what the trick is right now. Older photos stay in the lineup; this one becomes the card's art.
async function addPhoto(id, input){
  const f = input && input.files && input.files[0]; if (input) input.value = ""; const sk = findSkill(id); if (!f || !sk) return;
  try {
    toast("Adding your photo…", 6000); const { blob, w, h } = await resizeImage(f); const pid = uid();
    const { path, url } = await media.upload("photos", pid, blob, { contentType: "image/jpeg", name: f.name });
    const doc = { path, url, cap: "🃏 " + sk.n, dance: "", w, h, size: blob.size, card: id, frame: L.lastFrame, taken: todayStr(), at: new Date().toISOString() };
    const st = skillState(S.skills, id); if (STAGES.includes(st)) doc.stage = st;
    await storeSet("photos", pid, doc); L.sel = pid; L.vs = false; toast("In your lineup! 📷"); renderLineup(L.card);
  } catch (e) { console.warn(e); toast("Couldn't add it: " + friendlyError(e), 3500); }
}
async function setFrame(pid, frame){ const p = S.photos[pid]; if (!p || !isFrame(frame)) return; L.lastFrame = frame; try { await storeSet("photos", pid, { ...p, frame }); } catch (e) { console.warn(e); toast("Couldn't save: " + friendlyError(e), 3000); } renderLineup(L.card); }
async function setDate(pid, v){ const p = S.photos[pid]; if (!p || !DATE_RE.test(String(v || ""))) return; try { await storeSet("photos", pid, { ...p, taken: v }); } catch (e) { console.warn(e); toast("Couldn't save: " + friendlyError(e), 3000); } renderLineup(L.card); }
// Off the lineup: the link and its stamp fields go; the photo itself stays in Photos.
async function takeOff(pid){
  const p = S.photos[pid]; if (!p || !confirm("Take this photo off the lineup? It stays in Photos.")) return;
  const { card, frame, taken, stage, ...rest } = p;
  try { await storeSet("photos", pid, rest); L.sel = ""; toast("Off the lineup"); } catch (e) { console.warn(e); toast("Couldn't save: " + friendlyError(e), 3000); }
  renderLineup(L.card);
}
// ---------- saving a picture (the share sheet, like Moments) ----------
const loadImg = (url) => new Promise((res, rej) => { const im = new Image(); im.crossOrigin = "anonymous"; im.onload = () => res(im); im.onerror = () => rej(new Error("cloud photo")); im.src = url; });
const status = (t) => { const el = $("#lfStatus"); if (el) el.textContent = t; };
async function save(kind){
  const c = L.card; if (!c) return; const list = lineup(c.id); const fn = firstVsNow(list);
  const picks = kind === "one" ? list.filter(p => p.id === L.sel) : kind === "vs" && fn ? [fn.first, fn.now] : list; if (!picks.length) return toast("Tap a photo first");
  try {
    status("Making the picture…"); try { await document.fonts.load("600 48px Fredoka"); } catch (e) {}
    const imgs = await Promise.all(picks.map(p => loadImg(p.url)));
    const items = picks.map((p, i) => ({ img: imgs[i], frame: p.frame, stamp: stampFor(p, c.n), color: c.color }));
    const o = kind === "vs" ? { title: c.n, labels: ["FIRST", "NOW"], sub: grownLine(fn) } : kind === "all" ? { title: `${c.n} · my progress`, sub: list.length > 1 ? `${fmt(list[0].date)} → ${fmt(list[list.length - 1].date)}` : "" } : {};
    const cv = document.createElement("canvas"); drawSheet(cv, items, o);
    const blob = await new Promise((res, rej) => { try { cv.toBlob(b => b ? res(b) : rej(new Error("Couldn't make the picture")), "image/jpeg", 0.92); } catch (e) { rej(e); } });
    await saveBlob(blob, `sofia-${c.id}-${kind === "vs" ? "first-vs-now" : kind === "all" ? "lineup" : "photo"}-${todayStr()}.jpg`); status("Saved. Look in Photos (or Files).");
  } catch (e) { console.warn(e); status(""); toast(/cloud photo|tainted|security/i.test(String((e && e.message) || e)) ? "This phone can't read the cloud photos into a picture. A grown-up can check the Storage CORS step in the README." : "Couldn't save: " + (e.message || e), 4000); }
}
expose({ lineupAdd: addPhoto, lineupPick: pick, lineupVs: toggleVs, lineupFrame: setFrame, lineupDate: setDate, lineupOff: takeOff, lineupSave: save });
