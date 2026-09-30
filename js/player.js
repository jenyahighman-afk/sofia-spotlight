// Practice player: the dance's music with speed 50–100% (pitch kept), A–B loop with presets from the music map,
// an 8-count overlay driven by the dance's BPM + a tapped-in offset, and "Run it" (3-2-1, full track, two questions, logged to practice).
import { $, esc, toast, expose, todayStr } from "./util.js";
import { S, storeSet, dances } from "./store.js";
import { checkBadges } from "./badges.js";

const AUDIO_RE = /\.(mp3|m4a|aac|wav|ogg|oga|flac|webm)(\?.*)?$/i;
const fmtT = (s) => { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
export const parseTime = (t) => { const m = /^(\d+):(\d{2})$/.exec(t); return m ? +m[1] * 60 + +m[2] : null; };

// Loop presets: the dance's explicit `loops` plus one section per timestamp found in its "big moments" map ("~0:50 cartwheel · ~1:08 …").
// "cartwheel (right on the swell)" → "cartwheel": drop parentheticals, cut at a word boundary.
export const shortLabel = (s) => { let t = String(s).replace(/\(.*$/, "").replace(/^[—–-]\s*/, "").trim(); if (t.length > 20) t = t.slice(0, 20).replace(/\s+\S*$/, ""); return t; };
export function presetsFor(d, duration = 0){
  const out = [...(d.loops || [])].filter(l => Number.isFinite(l.a) && Number.isFinite(l.b) && l.b > l.a);
  const found = [...String(d.map || "").matchAll(/(\d+:\d{2})\s*([^·,;\n]*)/g)].map(m => ({ t: parseTime(m[1]), n: shortLabel(m[2]) })).filter(x => x.t !== null);
  found.forEach((f, i) => { const next = found[i + 1]; const b = next ? next.t : (duration ? Math.ceil(duration) : f.t + 12); if (b > f.t && !out.some(o => o.a === f.t)) out.push({ n: f.n || fmtT(f.t), a: f.t, b, fromMap: true }); });
  return out;
}

const PL = { dance: null, audio: null, objUrl: "", a: null, b: null, speed: 100, counts: false, voice: "off", raf: 0, lastCount: 0, run: null, ctx: null, offline: false };
let objectUrlCache = {}; // danceId → object URL for a track already downloaded this session

function srcFor(d){ if (d.musicFile && d.musicFile.url) return { url: d.musicFile.url, kind: "file" }; if (d.musicUrl && AUDIO_RE.test(d.musicUrl)) return { url: d.musicUrl, kind: "link" }; return null; }

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
  if (PL.counts && +PL.dance.bpm) { const beat = Math.floor((t - (+PL.dance.countOffset || 0)) * (+PL.dance.bpm) / 60); if (beat >= 0) { const c = (beat % 8) + 1; if (beat !== PL.lastCount) { PL.lastCount = beat; $("#plCount").textContent = c; $("#plCount").classList.toggle("one", c === 1); if (!a.paused) { if (PL.voice === "click") click(c === 1); else if (PL.voice === "voice") say(c); } } } else $("#plCount").textContent = "…"; }
  PL.raf = requestAnimationFrame(tick);
}
function play(){ if (!PL.audio) return; ensureCtx(); PL.audio.play().then(() => { $("#plPlay").textContent = "❚❚"; }).catch(e => { console.warn(e); setStatus(`<span class="bad">Couldn't play. Tap ▶ again, or check the file under More ▸.</span>`); }); }
function pause(){ if (!PL.audio) return; PL.audio.pause(); $("#plPlay").textContent = "▶"; }
function toggle(){ if (!PL.audio) return; PL.audio.paused ? play() : pause(); }
function seek(ev){ if (!PL.audio || !Number.isFinite(PL.audio.duration)) return; const r = ev.currentTarget.getBoundingClientRect(); PL.audio.currentTime = PL.audio.duration * Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)); }

// ---- Run it ----
async function runIt(){
  if (!PL.audio) return; pause(); clearLoop(); setSpeed(100); PL.audio.currentTime = 0;
  const box = $("#plRun"); box.hidden = false; box.innerHTML = `<div class="run-count">3</div>`;
  for (const n of [3, 2, 1]) { box.innerHTML = `<div class="run-count">${n}</div>`; if (PL.voice === "click") click(n === 1); await new Promise(r => setTimeout(r, 1000)); if (!PL.audio) return; }
  box.innerHTML = `<div class="run-count small-run">GO ✨</div>`; setTimeout(() => { if (PL.run) box.innerHTML = `<div class="run-live">Full run · eyes up</div>`; }, 900);
  PL.run = { started: Date.now(), danceId: PL.dance.id }; play();
}
async function runEnded(){
  const run = PL.run; PL.run = null; if (!run) return; pause();
  const box = $("#plRun"); box.hidden = false;
  const ask = (q) => new Promise(res => { box.innerHTML = `<div class="run-q">${q}</div><div class="row run-yn"><button class="btn coral" id="plYes">Yes!</button><button class="btn ghost" id="plNo">Not yet</button></div>`; $("#plYes").onclick = () => res(true); $("#plNo").onclick = () => res(false); });
  const ending = await ask("Did you hold the ending?"); const eyes = await ask("Eyes up?");
  const date = todayStr(); const rec = S.practice[date] || { done: [], note: "", runs: [] };
  await storeSet("practice", date, { ...rec, runs: [...(rec.runs || []), { at: new Date().toISOString(), danceId: run.danceId, speed: 100, full: true, ending, eyes }] });
  box.innerHTML = `<div class="run-q">${ending && eyes ? "Both! ⭐ Logged." : "Logged. Next run: " + (!ending ? "hold the ending" : "eyes up") + "."}</div><div class="row run-yn"><button class="btn coral" onclick="plRunClose()">Done</button><button class="btn ghost" onclick="plRunIt()">Again</button></div>`;
  checkBadges();
}
function runClose(){ $("#plRun").hidden = true; $("#plRun").innerHTML = ""; }

// ---- open / close ----
export async function openPlayer(danceId){
  const d = dances().find(x => x.id === danceId); if (!d) return toast("That dance isn't here");
  closePlayer(true); PL.dance = d; PL.a = null; PL.b = null; PL.speed = 100; PL.lastCount = -1; PL.run = null;
  $("#player").hidden = false; document.body.classList.add("modal");
  $("#plTitle").textContent = d.name; $("#plSong").textContent = d.song || ""; $("#plTime").textContent = "0:00"; $("#plBar").style.width = "0"; $("#plPlay").textContent = "▶"; $("#plCount").textContent = "…"; runClose();
  speedUI(); loopUI(); countsUI(); renderPresets();
  const src = srcFor(d);
  if (!src) { setStatus(`<span class="bad">No music file yet.<br>Ask a grown-up: More ▸ Add music file.</span>`); return; }
  setStatus(`Loading music…`);
  const audio = new Audio(); audio.preload = "auto"; audio.preservesPitch = true; audio.mozPreservesPitch = true; audio.webkitPreservesPitch = true; PL.audio = audio;
  audio.addEventListener("ended", () => { $("#plPlay").textContent = "▶"; if (PL.run) runEnded(); });
  audio.addEventListener("loadedmetadata", () => { renderPresets(); setStatus(navigator.onLine ? "" : "Offline · playing the saved copy"); });
  audio.addEventListener("error", () => setStatus(`<span class="bad">The music didn't load.<br>Check the connection, or re-add the file under More ▸.</span>`));
  try {
    // Download once (through the service worker's media cache, so it plays offline next time) and play the local copy: no range requests, no buffering.
    let url = objectUrlCache[d.id + "|" + src.url];
    if (!url) { const res = await fetch(src.url); if (!res.ok) throw new Error("HTTP " + res.status); const blob = await res.blob(); url = URL.createObjectURL(blob); objectUrlCache[d.id + "|" + src.url] = url; }
    if (PL.audio !== audio) return; audio.src = url;
  } catch (e) { console.warn("player: direct fetch failed, streaming instead", e); if (PL.audio !== audio) return; audio.src = src.url; if (src.kind === "link") setStatus(`Streaming from the link · works online only`); }
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
}
expose({ openPlayer, closePlayer, plPreset, plRunIt: runIt, plRunClose: runClose });
