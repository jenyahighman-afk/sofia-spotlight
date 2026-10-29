// Memorize mode for a dance with a cue table (the solo). Two tools in one sheet:
//  🧩 Chunks — plays one cue segment (the verified table) or one 8-count, then pauses: Again / Next / From the top
//     (from 0:00 through the end of this chunk, so every session starts at the top and chains what she knows).
//  ⏸ Pause & Predict — a grown-up game: the music stops at a cue boundary, Sofia shows what comes next, the grown-up
//     taps Got it / Missed it. Results per cue in settings.predict = { [n]: { got, missed, last } }; cues whose last
//     try was missed are listed (tap one to drill it), and they come up more often.
// Plays the real track, or one of Hannah's videos when it's synced to the music (hannahVideos[].offset). Pure parts up top.
import { $, esc, toast, expose } from "./util.js";
import { S, setSettings, dances } from "./store.js";
import { normalizeCues, isCueTable, fmtCueTime } from "./cues.js";
import { trackUrl } from "./track.js";
import { cuePhoto, syncedVideos } from "./cuecards.js";
import { knownCues } from "./ready.js";

// One 8-count per segment, from count 1 (the dance's countOffset) to the end; a lead-in before the first count 1.
export function eightCounts(bpm, offset = 0, duration = 0){
  if (!(+bpm > 0) || !(duration > 0)) return []; const len = 8 * 60 / +bpm;
  const out = []; const o = Math.max(0, +offset || 0); if (o > 0.5) out.push({ a: 0, b: +o.toFixed(2), label: "Before count 1" });
  for (let a = o, i = 1; a < duration - 0.25; a += len, i++) out.push({ a: +a.toFixed(2), b: +Math.min(duration, a + len).toFixed(2), label: "8-count " + i });
  return out;
}
// The chunks for a mode: "cue" = the table's cues (with n, trick), "eight" = 8-counts.
export function chunksFor(mode, d, duration){ return mode === "eight" ? eightCounts(d.bpm, d.countOffset, duration || (normalizeCues(d.cues).slice(-1)[0] || {}).end || 0) : normalizeCues(d.cues).filter(c => c.n).map(c => ({ a: c.t, b: c.end, label: c.move, n: c.n, trick: !!c.trick })); }
export function statsOf(settings){ const p = settings && settings.predict && typeof settings.predict === "object" ? settings.predict : {}; return p; }
// A Got it / Missed it for cue n. Returns the new settings.predict.
export function recordPredict(stats, n, got){ const s = { ...(stats || {}) }; const e = s[n] || { got: 0, missed: 0, last: "" }; s[n] = { got: e.got + (got ? 1 : 0), missed: e.missed + (got ? 0 : 1), last: got ? "got" : "missed" }; return s; }
// Cues still missed: the last try was a miss. Most-missed first.
export function stillMissed(stats, cues){ return normalizeCues(cues).filter(c => c.n && stats[c.n] && stats[c.n].last === "missed").sort((a, b) => stats[b.n].missed - stats[a.n].missed || a.t - b.t); }
// Which boundary to stop at: cue i (i ≥ 1) is the one she must predict. Missed and never-tried cues weigh more, known
// ones less. Plays from the cue before it (at most 8 s of it). rand ∈ [0, 1).
export function pickPredict(cues, stats = {}, rand = Math.random){
  const list = normalizeCues(cues).filter(c => c.n); if (list.length < 2) return null;
  const w = list.slice(1).map(c => { const e = stats[c.n]; return !e ? 3 : e.last === "missed" ? 4 + e.missed : Math.max(0.5, 2 - e.got * 0.5); });
  let r = rand() * w.reduce((a, b) => a + b, 0), i = 0; while (i < w.length - 1 && r >= w[i]) { r -= w[i]; i++; }
  const cue = list[i + 1], prev = list[i]; return { cue, from: +Math.max(prev.t, cue.t - 8).toFixed(2), at: cue.t };
}

// ---- DOM ----
const MZ = { danceId: "", tab: "chunks", mode: "cue", i: 0, src: "music", el: null, raf: 0, stopAt: 0, speed: 100, round: null, duration: 0 };
const dance = () => dances().find(d => d.id === MZ.danceId);
const chunks = () => chunksFor(MZ.mode, dance(), MZ.duration);
const video = () => MZ.src === "music" ? null : syncedVideos(dance())[+MZ.src] || null;
const offset = () => { const v = video(); return v ? v.offset : 0; };
function stopWatch(){ cancelAnimationFrame(MZ.raf); MZ.stopAt = 0; }
async function mediaEl(){
  const v = video();
  if (v) { const el = $("#mzVideo"); el.hidden = false; if (el.dataset.src !== v.url) { el.src = v.url; el.dataset.src = v.url; } MZ.el = el; }
  else { $("#mzVideo").hidden = true; if (!MZ.audio) { const got = await trackUrl(dance()); if (!got) { toast("No music file yet. A grown-up can add it under More ▸"); return null; } MZ.audio = new Audio(got.url); MZ.audio.preload = "auto"; MZ.audio.addEventListener("loadedmetadata", () => { MZ.duration = MZ.audio.duration || 0; if (MZ.mode === "eight") render(); }); } MZ.el = MZ.audio; }
  MZ.el.playbackRate = MZ.speed / 100; return MZ.el;
}
// Play [a, b) in track time, pause at b, then call done().
async function playSpan(a, b, done){
  const el = await mediaEl(); if (!el) return; stopWatch(); const off = offset();
  try { el.currentTime = Math.max(0, a + off); await el.play(); } catch (e) { console.warn(e); return toast("Tap again to play"); }
  MZ.stopAt = b + off; const watch = () => { if (el.paused) return; if (el.currentTime >= MZ.stopAt) { el.pause(); MZ.stopAt = 0; if (done) done(); return; } MZ.raf = requestAnimationFrame(watch); }; watch();
}
function pauseAll(){ stopWatch(); for (const el of [MZ.audio, $("#mzVideo")]) { try { el && el.pause(); } catch (e) {} } }

function chunkCard(c){ const d = dance(); const ph = c.n ? cuePhoto(d, c.n) : ""; return `<div class="mz-chunk ${c.trick ? "trick" : ""}">${ph ? `<img src="${esc(ph)}" alt="">` : ""}<div class="mz-label">${c.trick ? "★ " : ""}${esc(c.label)}</div><div class="small muted">${fmtCueTime(c.a)}–${fmtCueTime(c.b)}${c.n ? " · cue " + c.n : ""}</div></div>`; }
// One memorize path (Build 2): this sheet is the door; every other way to learn the solo is one tap from here.
// "N / 28 known" is the Know bar (ready.js): a move got right twice in a row in Pause & Predict.
export function knownLine(d, settings = S.settings){ const k = knownCues(d && d.cues, (settings || {}).predict); return k.of ? `<div class="small muted mz-known">🧠 <b>${k.known} / ${k.of}</b> moves known${k.tricky ? ` · ${k.tricky} tricky` : ""} · <button class="lnk" onclick="closeMemorize();openReady()">how ready?</button></div>` : ""; }
export function moreWays(d){
  if (!d) return ""; const vids = Array.isArray(d.hannahVideos) && d.hannahVideos.length; const loops = Array.isArray(d.loops) && d.loops.length;
  return `<div class="mz-more"><span class="small muted">More ways:</span><button class="chip" onclick="closeMemorize();openCueCards('${d.id}')">🃏 Cue cards</button><button class="chip" onclick="closeMemorize();openPlayer('${d.id}')">🎤 Words + music</button>${loops ? `<button class="chip" onclick="closeMemorize();showPage('dances');memoFocus('${d.id}')">📋 Five steps</button>` : ""}<button class="chip" onclick="closeMemorize();showPage('play');playOpen('nextmove');nmStart()">🧠 What's Next?</button>${vids ? `<button class="chip" onclick="closeMemorize();openVideos()">📹 Videos</button>` : ""}</div>`;
}
function srcChips(){ const vs = syncedVideos(dance()); if (!vs.length) return ""; return `<div class="row mz-src"><span class="small muted">Play:</span><button class="chip ${MZ.src === "music" ? "coral" : ""}" onclick="mzSrc('music')">🎵 Music</button>${vs.map((v, i) => `<button class="chip ${MZ.src === String(i) ? "coral" : ""}" onclick="mzSrc('${i}')">📹 ${esc(v.name || "Hannah")}</button>`).join("")}</div>`; }
function render(){
  const d = dance(); if (!d) return; const body = $("#mzBody");
  $("#mzTabChunks").classList.toggle("coral", MZ.tab === "chunks"); $("#mzTabPredict").classList.toggle("coral", MZ.tab === "predict");
  if (MZ.tab === "chunks") {
    const list = chunks(); MZ.i = Math.max(0, Math.min(MZ.i, list.length - 1)); const c = list[MZ.i];
    body.innerHTML = `${srcChips()}<div class="row mz-mode"><button class="chip ${MZ.mode === "cue" ? "coral" : ""}" onclick="mzMode('cue')">One cue</button><button class="chip ${MZ.mode === "eight" ? "coral" : ""}" onclick="mzMode('eight')" ${+d.bpm ? "" : "disabled"}>One 8-count</button><span class="grow"></span><button class="chip ${MZ.speed === 75 ? "coral" : ""}" onclick="mzSpeed(75)">75%</button><button class="chip ${MZ.speed === 100 ? "coral" : ""}" onclick="mzSpeed(100)">100%</button></div>
      ${c ? chunkCard(c) : `<p class="small muted">${MZ.mode === "eight" ? "Loading the music to count it…" : "No cues."}</p>`}
      <div class="mz-btns"><button class="btn coral big-btn" onclick="mzAgain()">↻ Again</button><button class="btn big-btn" onclick="mzNext()">Next ›</button><button class="btn sun big-btn" onclick="mzTop()">⏮ From the top</button></div>
      <div class="row small muted" style="justify-content:space-between"><button class="lnk" onclick="mzPrev()">‹ back one</button><span>${list.length ? MZ.i + 1 + " of " + list.length : ""}</span></div>
      <p class="small muted">Watch it, do it, say the move's name out loud. From the top = from 0:00 through this chunk.</p>${knownLine(d)}${moreWays(d)}`;
  } else {
    const stats = statsOf(S.settings); const missed = stillMissed(stats, d.cues); const r = MZ.round; const tried = Object.keys(stats).length;
    let stage;
    if (!r) stage = `<p>The music stops where one move ends. Sofia shows what comes next. You tap what happened.</p><button class="btn coral big-btn" style="width:100%" onclick="mzRound()">▶ Start a round</button>`;
    else if (r.phase === "playing") stage = `<div class="mz-ask">Listen… 🎵</div>`;
    else if (r.phase === "ask") stage = `<div class="mz-ask">⏸ What comes next? Show it!</div><div class="mz-btns two"><button class="btn coral big-btn" onclick="mzAnswer(true)">✅ Got it</button><button class="btn ghost big-btn" onclick="mzAnswer(false)">❌ Missed it</button></div>`;
    else stage = `<div class="mz-ask">${r.got ? "✅ Got it!" : "Next time! It was:"}</div>${chunkCard({ a: r.cue.t, b: r.cue.end, label: r.cue.move, n: r.cue.n, trick: r.cue.trick })}${r.cue.hannahWord ? `<div class="cc-word">Hannah says: “${esc(r.cue.hannahWord)}”</div>` : ""}<div class="mz-btns two"><button class="btn coral big-btn" onclick="mzRound()">Next round ›</button><button class="btn ghost big-btn" onclick="mzShow()">▶ Show it</button></div>`;
    body.innerHTML = `${srcChips()}${stage}
      <div class="field-lab">Still getting missed ${missed.length ? `<span class="chip coral">${missed.length}</span>` : ""}</div>
      ${missed.length ? `<div class="mz-missed">${missed.map(c => `<button class="chip" onclick="mzDrill(${c.n})">${c.trick ? "★ " : ""}${esc(c.move)} <span class="muted">${fmtCueTime(c.t)}</span></button>`).join("")}</div>` : `<p class="small muted">${tried ? "Nothing missed on the last try. 🎉" : "No rounds yet."}</p>`}
      ${tried ? `<p class="small muted">${tried} of ${normalizeCues(d.cues).length} cues tried. <button class="lnk" onclick="mzResetStats()">start over</button></p>` : ""}${knownLine(d)}${moreWays(d)}`;
  }
}
function setMode(m){ MZ.mode = m; MZ.i = 0; pauseAll(); render(); if (m === "eight") mediaEl(); }
function setSpeed(v){ MZ.speed = v; if (MZ.el) MZ.el.playbackRate = v / 100; render(); }
function setSrc(s){ pauseAll(); MZ.src = s; MZ.el = null; render(); }
function again(){ const c = chunks()[MZ.i]; if (c) playSpan(c.a, c.b); }
function next(){ const list = chunks(); if (MZ.i < list.length - 1) { MZ.i++; render(); again(); } else toast("That's the end! ⏮ From the top"); }
function prev(){ if (MZ.i > 0) { MZ.i--; render(); } }
function top(){ const c = chunks()[MZ.i]; if (c) playSpan(0, c.b); }
function round(){ const d = dance(); const p = pickPredict(d.cues, statsOf(S.settings)); if (!p) return; MZ.round = { ...p, phase: "playing" }; render(); playSpan(p.from, p.at, () => { if (MZ.round && MZ.round.cue === p.cue) { MZ.round.phase = "ask"; render(); } }); }
async function answer(got){ const r = MZ.round; if (!r || r.phase !== "ask") return; r.phase = "done"; r.got = got; await setSettings({ predict: recordPredict(statsOf(S.settings), r.cue.n, got) }); render(); }
function show(){ const r = MZ.round; if (r) playSpan(r.cue.t, r.cue.end); }
function drill(n){ MZ.tab = "chunks"; MZ.mode = "cue"; const i = chunks().findIndex(c => c.n === n); MZ.i = Math.max(0, i); pauseAll(); render(); again(); }
async function resetStats(){ if (!confirm("Clear the Pause & Predict results?")) return; await setSettings({ predict: {} }); render(); }
function tab(t){ MZ.tab = t; MZ.round = null; pauseAll(); render(); }
export function openMemorize(danceId = "solo", t = "chunks", n = 0){
  const d = dances().find(x => x.id === danceId); if (!d || !isCueTable(d.cues)) return toast("No cue table for this dance yet");
  MZ.danceId = danceId; MZ.tab = t; MZ.mode = "cue"; MZ.i = 0; MZ.round = null; MZ.src = "music"; MZ.el = null; if (MZ.audio) { try { MZ.audio.pause(); } catch (e) {} MZ.audio = null; }
  if (n) { const i = chunks().findIndex(c => c.n === n); if (i > 0) MZ.i = i; }
  $("#mzTitle").textContent = "🧠 Memorize · " + String(d.name || "").split("·")[0].trim(); $("#memorize").hidden = false; document.body.classList.add("modal"); render();
}
export function closeMemorize(){ pauseAll(); const v = $("#mzVideo"); v.removeAttribute("src"); v.dataset.src = ""; try { v.load(); } catch (e) {} v.hidden = true; $("#memorize").hidden = true; document.body.classList.remove("modal"); }
export function initMemorize(){ $("#mzClose").onclick = closeMemorize; $("#mzTabChunks").onclick = () => tab("chunks"); $("#mzTabPredict").onclick = () => tab("predict"); }
expose({ openMemorize, closeMemorize, mzMode: setMode, mzSpeed: setSpeed, mzSrc: setSrc, mzAgain: again, mzNext: next, mzPrev: prev, mzTop: top, mzRound: round, mzAnswer: answer, mzShow: show, mzDrill: drill, mzResetStats: resetStats });
