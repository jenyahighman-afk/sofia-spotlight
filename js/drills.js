// Drill box: public social-media posts (YouTube, Instagram, Pinterest) Jenya saves as Sofia's drills, each tied to a skill
// with one line of her own note. Link only — the app never downloads or copies a video. YouTube plays in the app (its own
// embed player); Instagram and Pinterest open in their own app or Safari, and the UI says so.
// drills/{id} = { url, host, vid, skill, note, do, dont, ask, at }, one document per post (schema 27; 25 held them in
// settings.drills and store.js moves those once). A "Try this" is a 2-minute
// practice-mode timer with the post's picture on screen; finishing is the day's trick bite (habit.js markDrillTried).
// Pure parts up top (tested in Node); the shelf, the post sheet and the technique book below.
import { $, esc, toast, todayStr, uid, expose } from "./util.js";
import { S, storeSet, storeDel } from "./store.js";
import { SKILLS, AERIAL } from "./data.js";
import { openPracticeMode } from "./pmode.js";
import { openStage } from "./stage.js";

export const HOSTS = { youtube: { n: "YouTube", ic: "▶️", hint: "Plays here. Tap the title to open YouTube." }, instagram: { n: "Instagram", ic: "📸", hint: "Opens in the Instagram app or Safari." }, pinterest: { n: "Pinterest", ic: "📌", hint: "Opens in the Pinterest app or Safari." }, other: { n: "Web", ic: "🔗", hint: "Opens in Safari." } };
export const TRY_SECS = 120, NOTE_MAX = 140;
const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const yt = (vid) => ({ host: "youtube", vid, url: "https://www.youtube.com/watch?v=" + vid });
// A pasted link → { host, vid, url } (the url cleaned of tracking bits), or null when it isn't a post link.
// YouTube: watch?v=, youtu.be/, /shorts/, /embed/, /live/ (the 11-character id). Instagram: /p/, /reel/, /reels/, /tv/.
// Pinterest: /pin/… on any pinterest domain, or a pin.it short link. Anything else that starts with http is "other".
export function parseLink(raw){
  const s = String(raw || "").trim(); if (!s) return null;
  let u; try { u = new URL(/^[a-z]+:\/\//i.test(s) ? s : "https://" + s); } catch (e) { return null; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.toLowerCase().replace(/^(www|m|mobile)\./, ""); const path = u.pathname;
  if (host === "youtu.be") { const id = path.split("/").filter(Boolean)[0] || ""; return YT_ID.test(id) ? yt(id) : null; }
  if (/^(music\.)?youtube(-nocookie)?\.com$/.test(host)) {
    const v = u.searchParams.get("v") || ""; if (YT_ID.test(v)) return yt(v);
    const m = /^\/(?:shorts|embed|live|v|e)\/([A-Za-z0-9_-]{11})(?:[/?]|$)/.exec(path); return m ? yt(m[1]) : null;
  }
  if (host === "instagram.com" || host === "instagr.am") {
    if (/^\/share\/.+/.test(path)) return { host: "instagram", vid: "", url: "https://www.instagram.com" + path }; // the app's Copy link: a share code, not a post code, kept as is
    const m = /^\/(?:[A-Za-z0-9_.]+\/)?(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/.exec(path); return m ? { host: "instagram", vid: "", url: `https://www.instagram.com/${m[1] === "reels" ? "reel" : m[1]}/${m[2]}/` } : null;
  }
  if (host === "pin.it") return path.length > 1 ? { host: "pinterest", vid: "", url: u.origin + path } : null; // a short link: kept exactly as pasted (minus the query)
  if (/(^|\.)pinterest\.[a-z.]+$/.test(host)) { if (!/^\/pin\/[^/]+/.test(path)) return null; return { host: "pinterest", vid: "", url: u.origin + path.replace(/\/?$/, "/") }; }
  return { host: "other", vid: "", url: u.href };
}
export const thumbFor = (post) => post && post.host === "youtube" && post.vid ? `https://i.ytimg.com/vi/${post.vid}/hqdefault.jpg` : "";
export const embedFor = (post) => post && post.host === "youtube" && post.vid ? `https://www.youtube-nocookie.com/embed/${post.vid}?playsinline=1&rel=0` : "";
export const hostInfo = (post) => HOSTS[(post || {}).host] || HOSTS.other;
const shortText = (t) => { const s = String(t || "").split(/[:,(—]/)[0].trim(); return s.length > 40 ? s.slice(0, 39).trim() + "…" : s; };
// Everything a post can be "for": the skill ladders (data/skills.json) and the aerial mission items (data/aerial.json).
export function skillOptions(ladder = SKILLS, aerial = AERIAL){
  const out = [];
  for (const st of Object.values(ladder.styles || {})) for (const k of st.skills) out.push({ id: k.id, n: k.n, group: st.n });
  for (const a of aerial) out.push({ id: a.id, n: shortText(a.text), group: "Aerial mission · " + a.section });
  return out;
}
export function skillName(id, ladder = SKILLS, aerial = AERIAL){ const o = skillOptions(ladder, aerial).find(x => x.id === id); return o ? o.n : ""; }
const byNewest = (a, b) => (b.at || "").localeCompare(a.at || "") || a.id.localeCompare(b.id);
// The posts of a drills map, newest first; documents the migration emptied (no link) are skipped.
export const allDrills = (drills) => Object.entries(drills || {}).filter(([, p]) => p && !p.deleted && p.url).map(([id, p]) => ({ ...p, id })).sort(byNewest);
export const drillsFor = (skill, drills) => allDrills(drills).filter(p => p.skill === skill);
export const techniqueCards = (drills) => allDrills(drills).filter(p => p.do || p.dont);
export const askedPosts = (drills) => allDrills(drills).filter(p => p.ask);
// How many days a post was tried (practice.drills).
export const triedDays = (postId, practice) => Object.values(practice || {}).filter(r => r && Array.isArray(r.drills) && r.drills.includes(postId)).length;
// The practice-mode item for "Try this": two minutes with the post's picture where the dancer normally is.
export function tryItem(post){
  const thumb = thumbFor(post);
  return { id: "drill:" + post.id, text: post.note || "Watch it once, then try it. Slow first.", how: "Two minutes. Try, rest, try again. Stop if anything hurts.", secs: TRY_SECS, kind: "trick", demo: thumb ? { kind: "photo", url: thumb } : { kind: "link", url: post.url } };
}

// ---------- the shelf (Practice → 📎 Drill box) ----------
// The collection. Posts still in settings.drills (saved by 1.16 / 1.17) are moved into it once by store.js.
const drills = () => S.drills || {};
// The <option>s of a skill select, grouped by style / aerial section, `sel` selected.
export function skillSelectOptions(sel = ""){ const opts = skillOptions(); const groups = [...new Set(opts.map(o => o.group))]; return `<option value="">Which skill?</option>` + groups.map(g => `<optgroup label="${esc(g)}">${opts.filter(o => o.group === g).map(o => `<option value="${o.id}" ${o.id === sel ? "selected" : ""}>${esc(o.n)}</option>`).join("")}</optgroup>`).join(""); }
const post = (id) => { const p = drills()[id]; return p && !p.deleted && p.url ? { ...p, id } : null; };
async function save(id, patch){ const cur = drills()[id]; if (!cur) return; await storeSet("drills", id, { ...cur, ...patch }); }
const skillChip = (p) => { const n = skillName(p.skill); return n ? `<span class="chip violet">${esc(n)}</span>` : `<span class="chip">Any skill</span>`; };
const thumbLabel = (p) => esc("Open: " + (p.note || skillName(p.skill) || hostInfo(p).n));
const thumbHtml = (p) => { const t = thumbFor(p); return t ? `<img class="drill-thumb" src="${esc(t)}" alt="" loading="lazy">` : `<div class="drill-thumb drill-generic"><span>${hostInfo(p).ic}</span><small>${esc(hostInfo(p).n)}</small></div>`; };
const dodont = (p) => (p.do || p.dont) ? `<div class="drill-dd">${p.do ? `<div class="dd-do">✅ ${esc(p.do)}</div>` : ""}${p.dont ? `<div class="dd-dont">❌ ${esc(p.dont)}</div>` : ""}</div>` : "";
function card(p){
  const tried = triedDays(p.id, S.practice);
  return `<div class="drill-card"><button class="drill-open" aria-label="${thumbLabel(p)}" onclick="drillOpen('${p.id}')">${thumbHtml(p)}</button><div class="grow drill-main">
    <div class="row">${skillChip(p)}<span class="small muted">${hostInfo(p).ic} ${esc(hostInfo(p).n)}</span>${p.ask ? `<span class="chip sun">🙋 Ask Ms. Brittany</span>` : ""}${tried ? `<span class="chip mint">tried ${tried}×</span>` : ""}</div>
    ${p.note ? `<div class="drill-note">${esc(p.note)}</div>` : ""}${dodont(p)}
    <div class="row"><button class="btn sm coral" onclick="drillTry('${p.id}')">⏱ Try this</button><button class="btn sm ghost" onclick="drillOpen('${p.id}')">▶ Open</button></div></div></div>`;
}
// The shelf re-renders on every store change (a sync from the other phone included); the add form is only rebuilt while
// nobody is typing in it, so a pasted link doesn't vanish under Jenya's thumb.
export function renderDrillBox(){
  const form = $("#drillForm"), listEl = $("#drillList"); if (!form || !listEl) return; const list = allDrills(drills());
  const cnt = $("#drillCount"); if (cnt) { cnt.textContent = list.length ? `${list.length} saved` : ""; cnt.hidden = !list.length; }
  const fields = [$("#drillUrl"), $("#drillNote"), $("#drillSkill")]; const typing = !!form.innerHTML && fields.some(e => e && (e === document.activeElement || String(e.value || "").trim()));
  if (!typing) {
    form.innerHTML = `<p class="small muted">Paste a public YouTube, Instagram or Pinterest post, say which skill it is for, and one line of what to look at. Just the link is kept — nothing is copied.</p>
    <div class="coach-pick drill-add"><input type="url" id="drillUrl" placeholder="Paste the link" inputmode="url"><select id="drillSkill">${skillSelectOptions()}</select>
    <input type="text" id="drillNote" maxlength="${NOTE_MAX}" placeholder="One line: what to watch for (e.g. the part at 0:40)"><div class="row"><button class="btn sm coral" onclick="drillAdd()">📎 Save to the box</button><span class="grow"></span><button class="btn sm ghost" onclick="openTechniqueBook()">📖 My technique book</button></div></div>`; }
  listEl.innerHTML = list.length ? list.map(card).join("") : `<p class="small muted" style="margin-top:8px">Nothing saved yet. The first one takes ten seconds.</p>`;
}
async function add(){
  const url = ($("#drillUrl") || {}).value, skill = ($("#drillSkill") || {}).value || "", note = String(($("#drillNote") || {}).value || "").trim().slice(0, NOTE_MAX);
  const p = parseLink(url); if (!p) return toast("That doesn't look like a post link. Copy it from the Share button.", 3500);
  const id = uid(); await storeSet("drills", id, { ...p, url: p.url.slice(0, 500), skill, note, do: "", dont: "", ask: false, at: todayStr() });
  for (const f of [$("#drillUrl"), $("#drillNote")]) if (f) f.value = ""; const sel = $("#drillSkill"); if (sel) sel.value = "";
  toast(p.host === "youtube" ? "Saved. It'll play right here ▶️" : `Saved. It opens in ${hostInfo(p).n} 📲`, 2500); renderDrillBox();
}
// ---------- one post (the sheet) ----------
function open(id){
  const p = post(id); if (!p) return; const h = hostInfo(p); const emb = embedFor(p); const name = skillName(p.skill);
  $("#drillTitle").innerHTML = `<a href="${esc(p.url)}" target="_blank" rel="noopener">${h.ic} ${esc(name || h.n)} ↗</a>`;
  $("#drillBody").innerHTML = `${emb ? `<div class="drill-player"><iframe src="${esc(emb)}" title="YouTube" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`
      : `<a class="drill-big" href="${esc(p.url)}" target="_blank" rel="noopener"><span>${h.ic}</span><b>Open in ${esc(h.n)}</b></a>`}
    <p class="small muted" style="text-align:center">${esc(h.hint)}</p>
    ${p.note ? `<div class="drill-note">📝 ${esc(p.note)}</div>` : ""}${dodont(p)}
    <div class="row" style="margin-top:8px"><button class="btn coral big-btn grow" onclick="drillTry('${p.id}')">⏱ Try this (2 min)</button></div>
    <div class="row" style="margin-top:8px"><button class="btn sm ghost" onclick="drillDo('${p.id}')">✅ ${p.do ? "Change the do" : "Add a do"}</button><button class="btn sm ghost" onclick="drillDont('${p.id}')">❌ ${p.dont ? "Change the don't" : "Add a don't"}</button></div>
    <label class="check drill-ask"><input type="checkbox" ${p.ask ? "checked" : ""} onchange="drillAsk('${p.id}',this.checked)"><span>🙋 Ask Ms. Brittany if this is right for me <span class="small muted">(goes on the teacher summary)</span></span></label>
    <div class="row" style="margin-top:8px"><span class="small muted">For:</span><select class="drill-for" onchange="drillSkill('${p.id}',this.value)">${skillSelectOptions(p.skill)}</select></div>
    <div class="row" style="margin-top:8px"><button class="lnk" onclick="drillNote('${p.id}')">✏️ ${p.note ? "Change the note" : "Add a note"}</button><span class="grow"></span><button class="lnk" onclick="drillRemove('${p.id}')">🗑 Remove</button></div>`;
  $("#drill").hidden = false; document.body.classList.add("modal");
}
export function closeDrill(){ const el = $("#drill"); if (!el) return; el.hidden = true; const body = $("#drillBody"); if (body) body.innerHTML = ""; document.body.classList.remove("modal"); }
function tryIt(id){ const p = post(id); if (!p) return; closeDrill(); openPracticeMode([tryItem(p)], { title: "📎 Try this", bite: "trick", drill: id }); }
async function setDo(id){ const p = post(id); if (!p) return; const t = prompt("✅ Do — one line", p.do || ""); if (t === null) return; await save(id, { do: String(t).trim().slice(0, NOTE_MAX) }); open(id); renderDrillBox(); }
async function setDont(id){ const p = post(id); if (!p) return; const t = prompt("❌ Don't — one line", p.dont || ""); if (t === null) return; await save(id, { dont: String(t).trim().slice(0, NOTE_MAX) }); open(id); renderDrillBox(); }
async function setAsk(id, on){ await save(id, { ask: !!on }); toast(on ? "On the teacher summary 🙋" : "Off the teacher summary"); renderDrillBox(); }
async function setNote(id){ const p = post(id); if (!p) return; const t = prompt("Your note (one line)", p.note || ""); if (t === null) return; await save(id, { note: String(t).trim().slice(0, NOTE_MAX) }); open(id); renderDrillBox(); }
async function setSkill(id, skill){ const p = post(id); if (!p) return; const ok = skillOptions().some(o => o.id === skill); await save(id, { skill: ok ? skill : "" }); toast(ok ? "Filed under " + skillName(skill) + " ✓" : "Filed under any skill"); renderDrillBox(); }
async function remove(id){ if (!confirm("Take this post out of the box?")) return; await storeDel("drills", id); closeDrill(); toast("Removed"); renderDrillBox(); }
// "📎 From the drill box: N saved" with thumbnails, for a skill page (Trick Quest prep, an aerial drill card). "" when none.
export function drillStrip(skill){
  const list = drillsFor(skill, drills()); if (!list.length) return "";
  return `<div class="drill-strip"><div class="small"><b>📎 From the drill box:</b> ${list.length} saved</div><div class="drill-thumbs">${list.slice(0, 6).map(p => `<button class="drill-open" aria-label="${thumbLabel(p)}" onclick="event.preventDefault();drillOpen('${p.id}')" title="${esc(p.note || hostInfo(p).n)}">${thumbHtml(p)}</button>`).join("")}</div></div>`;
}
// ---------- My technique book ----------
function openTechniqueBook(){
  const cards = techniqueCards(drills());
  $("#drillArea").innerHTML = `<p class="small muted">Every ✅ and ❌ from the drill box, in one place.</p>${cards.length ? cards.map(p => `<div class="drill-card book"><button class="drill-open" aria-label="${thumbLabel(p)}" onclick="drillOpen('${p.id}')">${thumbHtml(p)}</button><div class="grow drill-main"><div class="row">${skillChip(p)}</div>${dodont(p)}</div></div>`).join("") : `<p class="small muted">No pages yet. Open a saved post and add a ✅ do or a ❌ don't.</p>`}`;
  openStage("📖 My technique book", [$("#drillArea")], `<button class="btn ghost" onclick="closeStage()">Done</button>`);
}
export function initDrills(){ document.addEventListener("stageclosed", () => { const a = $("#drillArea"); if (a) a.style.display = "none"; }); const c = $("#drillClose"); if (c) c.onclick = closeDrill; const m = $("#drill"); if (m) m.addEventListener("click", e => { if (e.target === m) closeDrill(); }); }
expose({ drillAdd: add, drillOpen: open, drillTry: tryIt, drillDo: setDo, drillDont: setDont, drillAsk: setAsk, drillNote: setNote, drillSkill: setSkill, drillRemove: remove, openTechniqueBook, closeDrill });
