// Practice player: the dance's music with speed 50–100% (pitch kept), A–B loop with presets from the music map,
// an 8-count overlay driven by the dance's BPM + a tapped-in offset, and "Run it" (3-2-1, full track, two questions, logged to practice).
import { $, esc, toast, expose, todayStr } from "./util.js";
import { S, storeSet, dances, setSettings } from "./store.js";
import { checkBadges } from "./badges.js";
import { normalizeCues, cueAt, fmtTime, fmtCueTime, isCueTable, trickAhead, lyricLines, lyricAt, normalizeLyricTimes, countAt, snapTime } from "./cues.js";
import { srcFor, trackUrl } from "./track.js";
import { cuePhoto } from "./cuecards.js";
import { pingDone } from "./remind.js";
import { prompterHtml, karaokeHtml } from "./prompter.js";
export { srcFor };

const fmtT = (s) => { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
export const parseTime = (t) => { const m = /^(\d+):(\d{2}(?:\.\d+)?)$/.exec(t); return m ? +m[1] * 60 + +m[2] : null; };

// Loop presets: the dance's explicit `loops` plus one section per timestamp found in its "big moments" map ("~0:50 cartwheel · ~1:08 …").
// "cartwheel (right on the swell)" → "cartwheel": drop parentheticals, cut at a word boundary.
export const shortLabel = (s) => { let t = String(s).replace(/\(.*$/, "").replace(/^[—–-]\s*/, "").trim(); if (t.length > 20) t = t.slice(0, 20).replace(/\s+\S*$/, ""); return t; };
export function presetsFor(d, duration = 0){
  const out = [...(d.loops || [])].filter(l => Number.isFinite(l.a) && Number.isFinite(l.b) && l.b > l.a);
  const found = [...String(d.map || "").matchAll(/(\d+:\d{2}(?:\.\d+)?)\s*([^·,;\n]*)/g)].map(m => ({ t: parseTime(m[1]), n: shortLabel(m[2]) })).filter(x => x.t !== null);
  found.forEach((f, i) => { const next = found[i + 1]; const b = next ? next.t : (duration ? Math.ceil(duration) : f.t + 12); if (b > f.t && !out.some(o => o.a === f.t)) out.push({ n: f.n || fmtT(f.t), a: f.t, b, fromMap: true }); });
  return out;
}

const PL = { lastHtml: "", dance: null, audio: null, objUrl: "", a: null, b: null, speed: 100, counts: false, voice: "off", raf: 0, lastCount: 0, run: null, ctx: null, offline: false, testMe: false, revealed: -1, lastCueIdx: -2, showList: false };


function setStatus(html){ $("#plStatus").innerHTML = html; }
function speedUI(){ [50, 75, 100].forEach(v => $("#plS" + v).classList.toggle("coral", PL.speed === v)); $("#plRange").value = PL.speed; $("#plSpeedLab").textContent = PL.speed + "%"; }
function setSpeed(v){ PL.speed = Math.max(50, Math.min(100, Math.round(v))); if (PL.audio) PL.audio.playbackRate = PL.speed / 100; speedUI(); }
function loopUI(){ const has = PL.a !== null; $("#plA").classList.toggle("sun", has); $("#plB").classList.toggle("sun", PL.b !== null); $("#plLoopLab").textContent = has ? (PL.b !== null ? `Loop ${fmtT(PL.a)} – ${fmtT(PL.b)}` : `A at ${fmtT(PL.a)} · tap B`) : "Tap A, then B, to loop a part"; $("#plClear").hidden = !has; }
function setLoop(a, b){ PL.a = a; PL.b = b; loopUI(); if (PL.audio && a !== null && (PL.audio.currentTime < a || (b !== null && PL.audio.currentTime > b))) PL.audio.currentTime = a; }
function markA(){ if (!PL.audio) return; setLoop(PL.audio.currentTime, null); }
function markB(){ if (!PL.audio) return; if (PL.a === null) return markA(); const t = PL.audio.currentTime; if (t <= PL.a + 0.5) return toast("Tap B after A"); setLoop(PL.a, t); }
function clearLoop(){ setLoop(null, null); }
function renderPresets(){ const d = PL.dance; const dur = PL.audio ? PL.audio.duration : 0; const ps = presetsFor(d, Number.isFinite(dur) ? dur : 0);
  $("#plPresets").innerHTML = ps.length ? ps.map((p, i) => `<button class="chip ${PL.a === p.a && PL.b === p.b ? "coral" : ""}" onclick="plPreset(${p.a},${p.b})">${esc(p.n)} <span class="muted">${fmtT(p.a)}–${fmtT(p.b)}</span></button>`).join("") : `<span class="small muted">No sections yet. A grown-up can add them under More ▸ big moments.</span>`; }
function plPreset(a, b){ setLoop(a, b); renderPresets(); if (PL.audio && PL.audio.paused) play(); }

// ---- counts ----
function countsUI(){ $("#plCounts").classList.toggle("coral", PL.counts); $("#plCountBox").hidden = !PL.counts; ["off", "click", "voice"].forEach(v => $("#plV_" + v).classList.toggle("coral", PL.voice === v)); const bpm = +PL.dance.bpm || 0; $("#plBpm").textContent = bpm ? bpm + " BPM" : "No BPM yet"; $("#plTap").hidden = !bpm; }
function toggleCounts(){ PL.counts = !PL.counts; countsUI(); }
function setVoice(v){ PL.voice = v; countsUI(); if (v === "click") ensureCtx(); }
function ensureCtx(){ try { if (!PL.ctx) PL.ctx = new (window.AudioContext || window.webkitAudioContext)(); if (PL.ctx.state === "suspended") PL.ctx.resume(); } catch (e) {} }
function click(one){ if (!PL.ctx) return; const o = PL.ctx.createOscillator(), g = PL.ctx.createGain(); o.frequency.value = one ? 1320 : 880; g.gain.value = 0.25; o.connect(g); g.connect(PL.ctx.destination); const t = PL.ctx.currentTime; o.start(t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.06); o.stop(t + 0.07); }
function say(n){ try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(String(n)); u.rate = 1.4; speechSynthesis.speak(u); } catch (e) {} }
async function tapOne(){ if (!PL.audio) return; const off = PL.audio.currentTime; const d = PL.dance; await storeSet("dances", d.id, { ...(S.dances[d.id] || {}), id: d.id, countOffset: +off.toFixed(3) }); PL.dance = dances().find(x => x.id === d.id) || d; toast("Count 1 set at " + fmtT(off) + " ✓"); }
function tick(){
  if (!PL.audio) return; const a = PL.audio; const t = a.currentTime;
  $("#plTime").textContent = fmtT(t) + " / " + (Number.isFinite(a.duration) ? fmtT(a.duration) : "–:––"); if (Number.isFinite(a.duration) && a.duration) $("#plBar").style.width = (100 * t / a.duration) + "%";
  if (PL.b !== null && t >= PL.b) a.currentTime = PL.a;
  const k = countAt(t, PL.dance.bpm, PL.dance.countOffset);
  if (PL.counts && k) { if (k.count) { if (k.beat !== PL.lastCount) { PL.lastCount = k.beat; $("#plCount").textContent = k.count; $("#plCount").classList.toggle("one", k.count === 1); if (!a.paused) { if (PL.voice === "click") click(k.count === 1); else if (PL.voice === "voice") say(k.count); } } } else $("#plCount").textContent = "…"; }
  renderKCount(k); renderKara(t); renderCue(t);
  PL.raf = requestAnimationFrame(tick);
}
function play(){ if (!PL.audio) return; ensureCtx(); PL.audio.play().then(() => { $("#plPlay").textContent = "❚❚"; }).catch(e => { console.warn(e); setStatus(`<span class="bad">Couldn't play. Tap ▶ again, or check the file under More ▸.</span>`); }); }
function pause(){ if (!PL.audio) return; PL.audio.pause(); $("#plPlay").textContent = "▶"; }
function toggle(){ if (!PL.audio) return; PL.audio.paused ? play() : pause(); }
function seek(ev){ if (!PL.audio || !Number.isFinite(PL.audio.duration)) return; const r = ev.currentTarget.getBoundingClientRect(); PL.audio.currentTime = PL.audio.duration * Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)); }

// ---- cue sheet ----
// A cue table (the solo) shows Sofia's photo in the shape above the label, key tricks as a bold ★ card, and a preview of
// the next key trick 2 s before it lands. Nothing holds past a cue's end.
const cues = () => normalizeCues(PL.dance && PL.dance.cues);
const table = () => isCueTable(PL.dance && PL.dance.cues);
const timeOf = (t) => table() ? fmtCueTime(t) : fmtTime(t);
const photoImg = (c, cls) => { const u = c && c.n ? cuePhoto(PL.dance, c.n) : ""; return u ? `<img class="${cls}" src="${esc(u)}" alt="">` : ""; };
function cueHtml(t){
  const list = cues(); const { cur, next, soon, untilNext, index } = cueAt(list, t);
  if (!cur && !next) return "";
  const hidden = PL.testMe && cur && PL.revealed !== index;
  const move = cur ? (hidden ? `<span class="cue-hidden" onclick="plReveal(${index})">Tap to show</span>` : (cur.trick ? "★ " : "") + esc(cur.move || "…")) : "…";
  const lyric = cur && cur.lyric ? `<div class="cue-lyric">“${esc(cur.lyric)}”</div>` : "";
  const word = cur && cur.hannahWord && !hidden ? `<div class="cue-word">Hannah: “${esc(cur.hannahWord)}”</div>` : "";
  const ahead = !PL.testMe && trickAhead(list, t, 2);
  const nx = ahead ? `<div class="cue-preview">${photoImg(ahead, "cue-pthumb")}<span>NEXT ★ ${esc(ahead.move)}</span></div>`
    : next ? `<div class="cue-next">${soon ? "NEXT" : "next"} · ${PL.testMe ? "…" : esc(next.move || next.lyric)} · ${Math.ceil(untilNext)}s</div>` : (cur ? `<div class="cue-next">last cue</div>` : "");
  return `${cur && !hidden ? photoImg(cur, "cue-photo") : ""}<div class="cue-move">${move}</div>${lyric}${word}${nx}`;
}
function renderCue(t){
  const list = cues(); const { cur, index, soon } = cueAt(list, t); const html = cueHtml(t);
  const box = $("#plCue"); box.hidden = !html; if (html !== PL.lastHtml) { PL.lastHtml = html; if (html) box.innerHTML = html; } box.classList.toggle("soon", soon); box.classList.toggle("trick", !!(cur && cur.trick));
  const run = $("#plRunCue"); if (run) { const rh = S.settings.prompter && list.length ? prompterHtml(list, t) : (html || `<div class="cue-move">Full run · eyes up</div>`); if (run._h !== rh) { run._h = rh; run.innerHTML = rh; } run.classList.toggle("soon", soon); run.classList.toggle("trick", !!(cur && cur.trick)); }
  if (index !== PL.lastCueIdx) { PL.lastCueIdx = index; }
}
function cueSheetUI(){ const list = cues(); const tbl = table(); const pl = $("#plLines"); if (pl) pl.classList.toggle("coral", !!S.settings.prompter); $("#plCueCount").textContent = list.length ? `· ${list.length} cue${list.length === 1 ? "" : "s"}${tbl && PL.dance.cueSource ? " · " + PL.dance.cueSource : ""}` : "· none yet"; $("#plTestMe").classList.toggle("coral", PL.testMe); $("#plCueList").classList.toggle("coral", PL.showList); $("#plAddCue").hidden = tbl; const el = $("#plCues"); el.hidden = !PL.showList;
  el.innerHTML = list.length ? list.map((c, i) => `<div class="check ${c.trick ? "trick" : ""}"><span class="cue-t" onclick="plSeek(${c.t})">${timeOf(c.t)}</span><span class="grow"><b>${c.trick ? "★ " : ""}${esc(c.move)}</b>${c.lyric ? ` <span class="muted">“${esc(c.lyric)}”</span>` : ""}</span>${tbl ? "" : `<button class="del" onclick="plCueEdit(${i})" title="Edit">✏️</button><button class="del" onclick="plCueDel(${i})">✕</button>`}</div>`).join("") + (tbl ? `<p class="small muted">Checked times. A grown-up can nudge a cue in Grown-ups → 🎯 Cue check.</p>` : "") : `<p class="small muted">Play the track and tap ＋ Cue here at each moment. Type the words being sung and what she does.</p>`; }
async function saveCues(list){ const d = PL.dance; await storeSet("dances", d.id, { ...(S.dances[d.id] || {}), id: d.id, cues: normalizeCues(list) }); PL.dance = dances().find(x => x.id === d.id) || d; PL.lastCueIdx = -2; cueSheetUI(); }
async function addCue(){ if (!PL.audio || table()) return; const wasPlaying = !PL.audio.paused; pause(); const t = PL.audio.currentTime;
  const lyric = prompt(`Cue at ${fmtTime(t)} — what words are sung here? (optional)`, ""); if (lyric === null) { if (wasPlaying) play(); return; }
  const move = prompt("What does she do here?", ""); if (move === null) { if (wasPlaying) play(); return; }
  if (!lyric.trim() && !move.trim()) return toast("Type the words or the move");
  await saveCues([...cues(), { t: Math.round(t * 10) / 10, lyric, move }]); toast("Cue added at " + fmtTime(t)); }
async function cueEdit(i){ const list = cues(); const c = list[i]; if (!c) return; const lyric = prompt("Words sung here", c.lyric); if (lyric === null) return; const move = prompt("What she does", c.move); if (move === null) return; list[i] = { ...c, lyric, move }; await saveCues(list); }
async function cueDel(i){ const list = cues(); if (!list[i]) return; if (!confirm("Remove this cue?")) return; list.splice(i, 1); await saveCues(list); }
function toggleTestMe(){ PL.testMe = !PL.testMe; PL.revealed = -1; cueSheetUI(); if (PL.audio) renderCue(PL.audio.currentTime); toast(PL.testMe ? "Moves hidden — tap to show" : "Moves shown"); }
function reveal(i){ PL.revealed = i; if (PL.audio) renderCue(PL.audio.currentTime); }
function plSeek(t){ if (PL.audio) { PL.audio.currentTime = t; PL.revealed = -1; } }

// ---- Song words, karaoke-style (1.44.0) ----
// The sung line above the move (player and Run it) with a colour wipe, the 8-count in the corner. The line's HTML is
// rebuilt only when the line changes; the wipe (--p) moves every frame. Hidden while the words are being timed.
const KARA_RUN = `<div class="kara-box run-kara" id="plRunKaraBox" hidden><div id="plRunKara"></div><span class="kcount" id="plRunKCount" hidden>…</span></div>`;
const lyricsOf = () => lyricLines(PL.dance && PL.dance.lyrics);
function renderKara(t){
  const lines = lyricsOf();
  for (const [bx, kx] of [["#plKaraBox", "#plKara"], ["#plRunKaraBox", "#plRunKara"]]) {
    const box = $(bx), el = $(kx); if (!box || !el) continue;
    if (!lines.length || (bx === "#plKaraBox" && PL.timing)) { box.hidden = true; continue; } box.hidden = false;
    const k = lyricAt(lines, PL.dance.lyricTimes, t); const key = `${k.cur ? k.cur.i : -1}|${k.next ? k.next.i : -1}|${k.timed}`;
    if (el._k !== key) { el._k = key; el.innerHTML = karaokeHtml(lines, PL.dance.lyricTimes, t); }
    const now = el.querySelector(".kl.now"); if (now) now.style.setProperty("--p", Math.round(k.progress * 100) + "%");
  }
}
function renderKCount(k){ for (const id of ["#plKCount", "#plRunKCount"]) { const el = $(id); if (!el) continue; const on = !!(k && k.count); el.hidden = !on; if (on && el._c !== k.count) { el._c = k.count; el.textContent = k.count; el.classList.toggle("one", k.count === 1); } } }
// ⏱ Time the words: the track plays, a grown-up (or Sofia) taps ▼ as each line starts; each tap is saved at once (lyricTimes),
// snapped to the nearest sung-line onset the data knows (lyricSnaps). ↶ Back one re-does a line (the track jumps 3 s before it).
function timingUI(){
  const p = $("#plTiming"), btn = $("#plTimeWords"), lines = lyricsOf(); if (btn) { btn.hidden = !lines.length; btn.classList.toggle("coral", !!PL.timing); } if (!p) return;
  p.hidden = !PL.timing; if (!PL.timing) return;
  const i = PL.timing.i, tm = normalizeLyricTimes(PL.dance.lyricTimes, lines.length);
  if (i >= lines.length) { p.innerHTML = `<div class="tl-now">All ${lines.length} lines timed ⭐</div><div class="row" style="justify-content:center;margin-top:8px"><button class="btn coral" onclick="plTimeDone()">Done</button><button class="btn ghost sm" onclick="plTimeBack()">↶ Back one</button></div>`; return; }
  const was = tm[i] !== undefined && tm[i] !== null ? " · was " + fmtTime(tm[i]) : "";
  p.innerHTML = `<div class="small muted">Line ${i + 1} of ${lines.length}${was} · tap when it starts</div><div class="tl-now">${esc(lines[i])}</div>${lines[i + 1] ? `<div class="tl-next small">${esc(lines[i + 1])}</div>` : ""}<button class="btn coral tl-btn" onclick="plTimeTap()">▼ Starts now</button><div class="row" style="justify-content:center;margin-top:6px"><button class="btn ghost sm" onclick="plTimeBack()">↶ Back one</button><button class="btn ghost sm" onclick="plTimeDone()">✓ Done</button></div>`;
}
function timeWords(){
  if (PL.timing) return timeDone(); if (!PL.audio) return toast("Add the music file first");
  const lines = lyricsOf(); if (!lines.length) return toast("Type the words first: Dances ▸ More ▸ Edit ▸ Song words", 3500);
  const tm = normalizeLyricTimes(PL.dance.lyricTimes, lines.length); let i = tm.findIndex(x => x === null); if (i < 0) i = tm.length < lines.length ? tm.length : 0;
  PL.timing = { i }; clearLoop(); setSpeed(100); PL.audio.currentTime = i > 0 && tm[i - 1] !== null && tm[i - 1] !== undefined ? Math.max(0, tm[i - 1] - 1) : 0;
  timingUI(); renderKara(PL.audio.currentTime); if (PL.audio.paused) play();
}
async function timeTap(){
  if (!PL.timing || !PL.audio) return; const lines = lyricsOf(), i = PL.timing.i; if (i >= lines.length) return;
  const tm = normalizeLyricTimes(PL.dance.lyricTimes, lines.length); while (tm.length < i) tm.push(null); tm[i] = snapTime(PL.audio.currentTime, PL.dance.lyricSnaps);
  const d = PL.dance; await storeSet("dances", d.id, { ...(S.dances[d.id] || {}), id: d.id, lyricTimes: tm }); PL.dance = dances().find(x => x.id === d.id) || d;
  PL.timing = { i: i + 1 }; timingUI();
}
function timeBack(){ if (!PL.timing) return; const i = Math.max(0, PL.timing.i - 1); PL.timing = { i }; const tm = normalizeLyricTimes(PL.dance.lyricTimes); if (PL.audio && tm[i] !== undefined && tm[i] !== null) PL.audio.currentTime = Math.max(0, tm[i] - 3); timingUI(); }
function timeDone(){ if (!PL.timing) return; PL.timing = null; timingUI(); if (PL.audio) { renderKara(PL.audio.currentTime); } const n = normalizeLyricTimes(PL.dance.lyricTimes).filter(x => x !== null).length; toast(n ? `${n} of ${lyricsOf().length} lines timed` : "No lines timed yet"); }

// ---- Run it ----
const STOP = `<button class="btn ghost run-stop" onclick="plRunStop()">✕ Stop</button>`;
async function runIt(){
  if (!PL.audio) return; pause(); clearLoop(); setSpeed(100); PL.audio.currentTime = 0;
  const run = { started: Date.now(), danceId: PL.dance.id, live: false }; PL.run = run;
  const box = $("#plRun"); box.hidden = false;
  for (const n of [3, 2, 1]) { box.innerHTML = `<div class="run-count">${n}</div>${STOP}`; if (PL.voice === "click") click(n === 1); await new Promise(r => setTimeout(r, 1000)); if (PL.run !== run || !PL.audio) return; }
  box.innerHTML = `<div class="run-count small-run">GO ✨</div>${STOP}`; setTimeout(() => { if (PL.run === run) box.innerHTML = `${KARA_RUN}<div class="cue" id="plRunCue"><div class="cue-move">Full run · eyes up</div></div>${STOP}`; if (PL.audio) { renderKara(PL.audio.currentTime); renderKCount(countAt(PL.audio.currentTime, PL.dance.bpm, PL.dance.countOffset)); } }, 900);
  run.live = true; play();
}
// Stop cancels the run: nothing is logged, the player stays open.
function runStop(){ PL.run = null; pause(); runClose(); }
async function runEnded(){
  const run = PL.run; PL.run = null; if (!run) return; pause();
  const box = $("#plRun"); box.hidden = false;
  const ask = (q) => new Promise(res => { box.innerHTML = `<div class="run-q">${q}</div><div class="row run-yn"><button class="btn coral" id="plYes">Yes!</button><button class="btn ghost" id="plNo">Not yet</button></div>`; $("#plYes").onclick = () => res(true); $("#plNo").onclick = () => res(false); });
  const ending = await ask("Did you hold the ending?"); const eyes = await ask("Eyes up?");
  const date = todayStr(); const rec = S.practice[date] || { done: [], note: "", runs: [] };
  await storeSet("practice", date, { ...rec, runs: [...(rec.runs || []), { at: new Date().toISOString(), danceId: run.danceId, speed: 100, full: true, ending, eyes }] });
  try { pingDone(); } catch (e) {} // a logged run = the plan is done: no reminder tonight
  box.innerHTML = `<div class="run-q">${ending && eyes ? "Both! ⭐ Logged." : "Logged. Next run: " + (!ending ? "hold the ending" : "eyes up") + "."}</div><div class="row run-yn"><button class="btn coral" onclick="plRunClose()">Done</button><button class="btn ghost" onclick="plRunIt()">Again</button></div>`;
  checkBadges();
}
function runClose(){ $("#plRun").hidden = true; $("#plRun").innerHTML = ""; }

// ---- open / close ----
// opts (the Memorize card): { speed: 50|75|100, loop: {a, b} seconds, counts: "voice"|"click"|"off" (turns the 8-count on), testMe: true|false }.
export async function openPlayer(danceId, opts = {}){
  const d = dances().find(x => x.id === danceId); if (!d) return toast("That dance isn't here");
  closePlayer(true); PL.dance = d; PL.lastHtml = ""; PL.a = null; PL.b = null; PL.speed = 100; PL.lastCount = -1; PL.run = null; PL.revealed = -1; PL.lastCueIdx = -2; PL.showList = false; PL.timing = null;
  if (opts.speed) PL.speed = Math.max(50, Math.min(100, Math.round(+opts.speed))); if (opts.loop && Number.isFinite(+opts.loop.a) && Number.isFinite(+opts.loop.b)) { PL.a = +opts.loop.a; PL.b = +opts.loop.b; }
  if (opts.counts) { PL.counts = true; PL.voice = opts.counts; if (opts.counts === "click") ensureCtx(); } if (typeof opts.testMe === "boolean") PL.testMe = opts.testMe;
  $("#player").hidden = false; document.body.classList.add("modal");
  $("#plTitle").textContent = d.name; $("#plSong").textContent = d.song || ""; $("#plTime").textContent = "0:00"; $("#plBar").style.width = "0"; $("#plPlay").textContent = "▶"; $("#plCount").textContent = "…"; runClose();
  speedUI(); loopUI(); countsUI(); renderPresets(); cueSheetUI(); timingUI(); $("#plCue").hidden = true; renderKara(0); renderKCount(null); renderCue(0);
  const src = srcFor(d);
  if (!src) { setStatus(`<span class="bad">No music file yet.<br>Ask a grown-up: More ▸ Add music file.</span>`); return; }
  setStatus(`Loading music…`);
  const audio = new Audio(); audio.preload = "auto"; audio.preservesPitch = true; audio.mozPreservesPitch = true; audio.webkitPreservesPitch = true; PL.audio = audio;
  audio.addEventListener("ended", () => { $("#plPlay").textContent = "▶"; if (PL.run) runEnded(); });
  audio.addEventListener("loadedmetadata", () => { renderPresets(); setStatus(navigator.onLine ? "" : "Offline · playing the saved copy"); });
  audio.addEventListener("error", () => setStatus(`<span class="bad">The music didn't load.<br>Check the connection, or re-add the file under More ▸.</span>`));
  // Download once (through the service worker's media cache, so it plays offline next time) and play the local copy: no range requests, no buffering.
  const got = await trackUrl(d); if (PL.audio !== audio || !got) return; audio.src = got.url; if (got.streamed && got.link) setStatus(`Streaming from the link · works online only`);
  audio.playbackRate = PL.speed / 100; cancelAnimationFrame(PL.raf); tick();
}
export function closePlayer(silent){
  cancelAnimationFrame(PL.raf); if (PL.audio) { try { PL.audio.pause(); PL.audio.src = ""; } catch (e) {} } PL.audio = null; PL.run = null; try { speechSynthesis.cancel(); } catch (e) {}
  if (!silent) { $("#player").hidden = true; document.body.classList.remove("modal"); }
}
export function initPlayer(){
  $("#plClose").onclick = () => closePlayer(); $("#plPlay").onclick = toggle; $("#plBarWrap").onclick = seek;
  [50, 75, 100].forEach(v => { $("#plS" + v).onclick = () => setSpeed(v); }); $("#plRange").oninput = (e) => setSpeed(+e.target.value);
  $("#plA").onclick = markA; $("#plB").onclick = markB; $("#plClear").onclick = clearLoop;
  $("#plCounts").onclick = toggleCounts; ["off", "click", "voice"].forEach(v => { $("#plV_" + v).onclick = () => setVoice(v); }); $("#plTap").onclick = tapOne;
  $("#plRunBtn").onclick = runIt;
  $("#plAddCue").onclick = addCue; $("#plLines").onclick = async () => { await setSettings({ prompter: !S.settings.prompter }); cueSheetUI(); }; $("#plTestMe").onclick = toggleTestMe; $("#plTimeWords").onclick = timeWords; $("#plCueList").onclick = () => { PL.showList = !PL.showList; cueSheetUI(); };
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("#player").hidden) { if (PL.run) runStop(); else closePlayer(); } });
}
expose({ openPlayer, closePlayer, plPreset, plRunIt: runIt, plRunClose: runClose, plRunStop: runStop, plReveal: reveal, plSeek, plCueEdit: cueEdit, plCueDel: cueDel, plTimeTap: timeTap, plTimeBack: timeBack, plTimeDone: timeDone });
