// Photo cue cards for a dance with a cue table (the solo): Sofia in each shape, the exact time, the label, Hannah's cue
// word and her 2–3 s voice clip, as a swipeable deck. Photos and clips live in the family's Firebase Storage only
// (dances.cueMedia, uploaded from Grown-ups → 🎯 Cue check) — the repo is public and never holds them. Also the
// "Hannah's videos" slot on the solo card (dances.hannahVideos: up to two, with where the music starts in each).
import { $, esc, toast, uid, expose } from "./util.js";
import { S, storeSet, dances } from "./store.js";
import { normalizeCues, isCueTable, fmtCueTime } from "./cues.js";
import { media, friendlyError } from "./sync.js";
import { VIDEO_MAX_BYTES } from "./media.js";
import { trackUrl } from "./track.js";

export const cueMediaOf = (d, n) => ((d && d.cueMedia) || {})[n] || {};
export const cuePhoto = (d, n) => (cueMediaOf(d, n).photo || {}).url || "";
export const cueClip = (d, n) => (cueMediaOf(d, n).clip || {}).url || "";
export const cueRange = (c) => fmtCueTime(c.t) + "–" + fmtCueTime(c.end);
export const tableDance = (id) => { const d = dances().find(x => x.id === id); return d && isCueTable(d.cues) ? d : null; };
// The cards to show: every cue, or only the key tricks.
export const deckFor = (d, onlyTricks = false) => normalizeCues(d && d.cues).filter(c => c.n && (!onlyTricks || c.trick));
// Hannah's videos that are synced to the track (offset > 0 = where the music starts in that video).
export const syncedVideos = (d) => ((d && d.hannahVideos) || []).filter(v => v && v.url && v.offset > 0);

// ---- the deck ----
const CC = { danceId: "", tricks: false, audio: null, stop: 0, clip: null };
function cardHtml(d, c, i, total){
  const ph = cuePhoto(d, c.n), clip = cueClip(d, c.n);
  return `<div class="cc-card ${c.trick ? "trick" : ""}" data-i="${i}">
    <div class="cc-photo">${ph ? `<img src="${esc(ph)}" alt="${esc(c.move)}" loading="lazy">` : `<span>${c.trick ? "★" : "💃"}</span><small>No photo yet</small>`}</div>
    <div class="cc-time">${cueRange(c)} <span class="muted">· ${c.n} of ${total}</span></div>
    <div class="cc-label">${c.trick ? "★ " : ""}${esc(c.move)}</div>
    ${c.hannahWord ? `<div class="cc-word">Hannah says: “${esc(c.hannahWord)}”</div>` : ""}
    <div class="row cc-btns">${clip ? `<button class="btn sm aqua" onclick="ccClip(${c.n})">🔊 Hannah</button>` : ""}<button class="btn sm coral" onclick="ccMusic(${c.n})">▶ Music</button></div>
  </div>`;
}
function renderDeck(keep){
  const d = tableDance(CC.danceId); const el = $("#ccTrack"); if (!d || !el) return;
  const deck = deckFor(d, CC.tricks); const total = normalizeCues(d.cues).length; const at = keep ? currentIndex() : 0;
  el.innerHTML = deck.map((c, i) => cardHtml(d, c, i, total)).join("");
  $("#ccAll").classList.toggle("coral", !CC.tricks); $("#ccTricks").classList.toggle("coral", CC.tricks);
  $("#ccSource").textContent = d.cueSource ? "Times: " + d.cueSource : "";
  go(Math.min(at, deck.length - 1), false); counter();
}
function currentIndex(){ const el = $("#ccTrack"); if (!el || !el.clientWidth) return 0; return Math.round(el.scrollLeft / el.clientWidth); }
function counter(){ const el = $("#ccTrack"); const n = el ? el.children.length : 0; $("#ccCount").textContent = n ? `${currentIndex() + 1} / ${n}` : ""; }
function go(i, smooth = true){ const el = $("#ccTrack"); if (!el) return; const n = el.children.length; if (!n) return; i = Math.max(0, Math.min(n - 1, i)); el.scrollTo({ left: i * el.clientWidth, behavior: smooth ? "smooth" : "auto" }); setTimeout(counter, smooth ? 350 : 0); }
function stopSound(){ if (CC.audio) { try { CC.audio.pause(); } catch (e) {} } if (CC.clip) { try { CC.clip.pause(); } catch (e) {} } cancelAnimationFrame(CC.stop); }
async function playMusic(n){
  const d = tableDance(CC.danceId); const c = d && normalizeCues(d.cues).find(x => x.n === n); if (!c) return; stopSound();
  const got = await trackUrl(d); if (!got) return toast("No music file yet. A grown-up can add it under More ▸");
  if (!CC.audio) CC.audio = new Audio(); const a = CC.audio; if (a.src !== got.url) a.src = got.url;
  try { a.currentTime = Math.max(0, c.t - 1); await a.play(); } catch (e) { console.warn(e); return toast("Tap ▶ again to play"); }
  const end = c.end; const watch = () => { if (a.paused) return; if (a.currentTime >= end) { a.pause(); return; } CC.stop = requestAnimationFrame(watch); }; watch();
}
function playClip(n){ const d = tableDance(CC.danceId); const url = cueClip(d, n); if (!url) return; stopSound(); CC.clip = new Audio(url); CC.clip.play().catch(e => { console.warn(e); toast("Couldn't play the clip"); }); }
export function openCueCards(danceId = "solo", n = 0){
  const d = tableDance(danceId); if (!d) return toast("No cue table for this dance yet");
  CC.danceId = danceId; CC.tricks = false; $("#cuecards").hidden = false; document.body.classList.add("modal"); $("#ccTitle").textContent = "🃏 Cue cards · " + String(d.name || "").split("·")[0].trim();
  renderDeck(false); if (n) { const i = deckFor(d).findIndex(c => c.n === n); if (i > 0) setTimeout(() => go(i, false), 30); }
}
export function closeCueCards(){ stopSound(); $("#cuecards").hidden = true; document.body.classList.remove("modal"); }
export function initCueCards(){
  $("#ccClose").onclick = closeCueCards; $("#ccPrev").onclick = () => go(currentIndex() - 1); $("#ccNext").onclick = () => go(currentIndex() + 1);
  $("#ccAll").onclick = () => { CC.tricks = false; renderDeck(false); }; $("#ccTricks").onclick = () => { CC.tricks = true; renderDeck(false); };
  let t = 0; $("#ccTrack").addEventListener("scroll", () => { clearTimeout(t); t = setTimeout(counter, 80); });
  document.addEventListener("keydown", e => { if ($("#cuecards").hidden) return; if (e.key === "ArrowRight") go(currentIndex() + 1); else if (e.key === "ArrowLeft") go(currentIndex() - 1); else if (e.key === "Escape") closeCueCards(); });
}

// ---- Hannah's videos (solo card) ----
export function videosRow(d){
  const vs = (d.hannahVideos || []); if (!vs.length) return "";
  return `<div class="hv-row"><span class="small muted">📹 Hannah's videos</span>${vs.map((v, i) => `<button class="btn sm violet" onclick="hvWatch('${d.id}',${i})">▶ ${esc(v.name || "Video " + (i + 1))}</button>`).join("")}</div>`;
}
// Grown-up controls, under More ▸ on the card.
export function videosEdit(d){
  const vs = (d.hannahVideos || []);
  return `<div class="field-lab">Hannah's videos <span class="muted">(up to 2 · family space only)</span></div>
    ${vs.map((v, i) => `<div class="check"><span class="grow">📹 <b>${esc(v.name || "Video " + (i + 1))}</b> <span class="small muted">${v.offset > 0 ? "music starts at " + v.offset + " s · chunks play on it" : "not synced to the music"}</span></span><button class="lnk" onclick="hvOffset('${d.id}',${i})">sync</button> <button class="del" onclick="hvDel('${d.id}',${i})">✕</button></div>`).join("")}
    ${vs.length < 2 ? `<div class="row" style="margin-top:6px"><label class="btn sm ghost" for="hvIn-${d.id}">＋ Upload a video</label><input type="file" id="hvIn-${d.id}" accept="video/*" hidden onchange="hvAdd(this.files[0],'${d.id}');this.value=''"><button class="btn sm ghost" onclick="hvLink('${d.id}')">＋ Paste a link</button></div><p class="small muted">Videos up to 50 MB (a phone clip of 2–3 minutes at 720p). Bigger? Paste a Google Photos or Drive link instead.</p>` : ""}`;
}
const askOffset = (cur) => { const v = prompt("Where does the music start in this video, in seconds? (Hannah's run-through: 4.98. Leave 0 if it isn't the music.)", String(cur || 0)); if (v === null) return null; const n = parseFloat(v); return Number.isFinite(n) && n >= 0 && n < 600 ? Math.round(n * 100) / 100 : 0; };
async function saveVideos(danceId, list){ await storeSet("dances", danceId, { ...(S.dances[danceId] || {}), id: danceId, hannahVideos: list }); }
async function hvAdd(file, danceId){
  if (!file) return; if (file.size > VIDEO_MAX_BYTES) return toast(`Videos up to 50 MB — this one is ${Math.round(file.size / 1048576)} MB. Paste a link instead.`, 4000);
  const d = dances().find(x => x.id === danceId); const list = [...((d && d.hannahVideos) || [])]; if (list.length >= 2) return toast("Two videos already");
  const name = prompt("Name for this video", list.length ? "Walkthrough" : "Run-through"); if (name === null) return; const offset = askOffset(/run/i.test(name) ? 4.98 : 0); if (offset === null) return;
  try { const id = uid(); const { path, url } = await media.upload("videos", id, file, { contentType: file.type || "video/mp4", name: file.name, onProgress: (p) => { if (p < 1) toast("Uploading video… " + Math.round(p * 100) + "%", 8000); } });
    await saveVideos(danceId, [...list, { name: name.trim().slice(0, 60), url, path, offset }]); toast("Video added ✓"); }
  catch (e) { console.warn(e); toast("Upload failed: " + friendlyError(e), 3500); }
}
async function hvLink(danceId){
  const d = dances().find(x => x.id === danceId); const list = [...((d && d.hannahVideos) || [])]; if (list.length >= 2) return toast("Two videos already");
  const url = prompt("Paste the video link (Google Photos, Drive, YouTube…)"); if (!url) return; if (!/^https?:\/\//i.test(url.trim())) return toast("That isn't a link");
  const name = prompt("Name for this video", list.length ? "Walkthrough" : "Run-through"); if (name === null) return;
  await saveVideos(danceId, [...list, { name: name.trim().slice(0, 60), url: url.trim(), path: "", offset: 0 }]); toast("Link added ✓");
}
async function hvOffset(danceId, i){ const d = dances().find(x => x.id === danceId); const list = [...((d && d.hannahVideos) || [])]; if (!list[i]) return; if (!list[i].path) return toast("Only uploaded videos can be synced"); const o = askOffset(list[i].offset); if (o === null) return; list[i] = { ...list[i], offset: o }; await saveVideos(danceId, list); }
async function hvDel(danceId, i){ const d = dances().find(x => x.id === danceId); const list = [...((d && d.hannahVideos) || [])]; const v = list[i]; if (!v || !confirm(`Remove "${v.name || "this video"}"?`)) return; list.splice(i, 1); await saveVideos(danceId, list); if (v.path) { try { await media.remove(v.path); } catch (e) { console.warn(e); } } }
function hvWatch(danceId, i){
  const d = dances().find(x => x.id === danceId); const v = d && (d.hannahVideos || [])[i]; if (!v) return;
  if (!v.path) { window.open(v.url, "_blank", "noopener"); return; }
  $("#hvTitle").textContent = "📹 " + (v.name || "Hannah's video"); const el = $("#hvVideo"); el.src = v.url; $("#hvideo").hidden = false; document.body.classList.add("modal"); el.play().catch(() => {});
}
function hvClose(){ const el = $("#hvVideo"); try { el.pause(); } catch (e) {} el.removeAttribute("src"); try { el.load(); } catch (e) {} $("#hvideo").hidden = true; document.body.classList.remove("modal"); }
export function initVideos(){ $("#hvClose").onclick = hvClose; }
expose({ openCueCards, closeCueCards, ccMusic: playMusic, ccClip: playClip, hvAdd, hvLink, hvOffset, hvDel, hvWatch });
