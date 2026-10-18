// Count Along: tap the beat to your competition music and see if you're right on the counts. Two modes:
//  · Find the beat: the dance's own music plays (the file the player uses, srcFor) and she taps along. Her tempo (median
//    gap between taps → taps a minute) and steadiness (how even the gaps are) always come back. When the dance has a
//    beat — its BPM on the dance card, or one measured with "Set the beat" (settings.beats, schema 39) — every tap is
//    also judged against that grid; with no count 1 saved, the grid is lined up to her taps, so it checks she stays
//    with the pulse. Saved cue times count as "big moments" she tapped on.
//  · Metronome practice: a steady click at 80 / 100 / 120 (WebAudio), four count-in clicks, then 32 beats to tap.
// Perfect ≤ 60 ms, good ≤ 120 ms. Bests per dance / tempo in settings.countBest (schema 39); 1-3 stars and the game bite.
// Pure parts up top (tested in Node); the Play card below. Audio and timers are only touched inside a round.
import { $, esc, toast, expose } from "../util.js";
import { S, dances, setSettings, normalizeBeats, normalizeCountBest } from "../store.js";
import { srcFor } from "../player.js";
import { normalizeCues } from "../cues.js";
import { awardStars } from "../stars.js";
import { sofiaDancing, recordFriendScore, withFriends, pickedNames, namesLine } from "../who.js";

export const PERFECT_MS = 60, GOOD_MS = 120, TEMPOS = [80, 100, 120], ROUND_TAPS = 32, METRO_BEATS = 32, LEAD_IN = 4, SET_TAPS = 16, MIN_TAPS = 8;

const median = (a) => { const s = [...a].sort((x, y) => x - y), n = s.length; return !n ? NaN : n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const sorted = (taps) => (Array.isArray(taps) ? taps : []).filter(Number.isFinite).sort((a, b) => a - b);
// Gaps between taps in seconds, leaving out double taps (< 0.15 s) and pauses (> 2 s).
export function gaps(taps){ const t = sorted(taps), out = []; for (let i = 1; i < t.length; i++) { const d = t[i] - t[i - 1]; if (d >= 0.15 && d <= 2) out.push(d); } return out; }
// Her tempo: the median gap → taps a minute. null until there are three gaps.
export function tempoFromTaps(taps){ const g = gaps(taps); if (g.length < 3) return null; const m = median(g); return { bpm: Math.round(600 / m) / 10, gap: m }; }
// Steadiness 0-100: 100 when every gap is the same; the average distance from the median gap, as a share of it, counts double.
export function steadiness(taps){ const g = gaps(taps); if (g.length < 3) return null; const m = median(g); const dev = g.reduce((s, d) => s + Math.abs(d - m), 0) / g.length; return Math.max(0, Math.min(100, Math.round(100 * (1 - 2 * dev / m)))); }
// The nearest beat of a grid (bpm, first beat at `offset` s) to a tap: its number and how far off the tap was (s, + = late).
export function beatErr(t, bpm, offset = 0){ const beat = 60 / bpm, x = (t - offset) / beat, index = Math.round(x); return { index, err: (x - index) * beat }; }
export const grade = (errMs) => { const a = Math.abs(errMs); return a <= PERFECT_MS ? "perfect" : a <= GOOD_MS ? "good" : "miss"; };
// Judge every tap against the grid. Two taps on one beat: the second is a miss. `expected` = beats she should have tapped
// (metronome), so skipped beats count against her; 0 (song) scores only the taps she made. pct = % of taps on the beat.
export function scoreTaps(taps, bpm, offset = 0, expected = 0){
  const used = new Set(); let perfect = 0, good = 0, run = 0, streak = 0; const judged = [];
  for (const t of sorted(taps)) { const { index, err } = beatErr(t, bpm, offset); let g = grade(err * 1000); if (g !== "miss" && used.has(index)) g = "miss"; if (g !== "miss") used.add(index);
    if (g === "perfect") { perfect++; run++; streak = Math.max(streak, run); } else { run = 0; if (g === "good") good++; } judged.push({ t, err: Math.round(err * 1000), grade: g, count: (((index % 8) + 8) % 8) + 1 }); }
  const n = Math.max(judged.length, expected | 0), on = perfect + good;
  return { perfect, good, miss: n - on, total: n, pct: n ? Math.round(100 * on / n) : 0, streak, judged };
}
// Line a grid up to her taps (circular mean of where each tap falls in the beat): the first beat's time in [0, beat).
export function fitOffset(taps, bpm){ const beat = 60 / bpm, t = sorted(taps); if (!t.length) return 0; let s = 0, c = 0; for (const x of t) { const a = 2 * Math.PI * (((x % beat) + beat) % beat) / beat; s += Math.sin(a); c += Math.cos(a); } const ph = Math.atan2(s, c) / (2 * Math.PI); return Math.round(((ph + 1) % 1) * beat * 1000) / 1000; }
// Tapping at half or double the song's speed is still on the beat: which of ½, 1, 2 her tempo is closest to.
export function tempoFactor(herBpm, bpm){ if (!(herBpm > 0) || !(bpm > 0)) return 1; return [0.5, 1, 2].reduce((b, f) => Math.abs(Math.log2(herBpm / (bpm * f))) < Math.abs(Math.log2(herBpm / (bpm * b))) ? f : b, 1); }
// "Set the beat": 16 taps starting on a 1, one per beat → { bpm, offset }. Every gap has to be within a third of the median
// (no skipped or doubled beats); then a straight line through tap number → time gives the beat (steadier than one gap)
// and count 1 is where that line starts. null if unusable.
export function measureBeat(taps){
  const t = sorted(taps); const g = gaps(t); if (t.length < SET_TAPS - 2 || g.length !== t.length - 1) return null; const m = median(g); if (g.some(d => Math.abs(d - m) > m / 3)) return null;
  const n = t.length, mi = (n - 1) / 2, mt = t.reduce((s, x) => s + x, 0) / n; let num = 0, den = 0; t.forEach((x, i) => { num += (i - mi) * (x - mt); den += (i - mi) ** 2; });
  const beat = num / den, bpm = Math.round(600 / beat) / 10; if (!(bpm >= 40 && bpm <= 220)) return null;
  let off = mt - mi * beat; if (off < 0) off += beat * Math.ceil(-off / beat);
  return { bpm, offset: Math.round(off * 1000) / 1000 };
}
// Which count (1-8) is on at time t; 0 before the first beat.
export function countAt(t, bpm, offset = 0){ const i = Math.floor((t - offset) * bpm / 60 + 1e-9); return i < 0 ? 0 : (i % 8) + 1; }
// Big moments: the dance's cues inside the stretch she tapped, and how many had a tap within `win` seconds.
export function cueHits(taps, cues, win = 0.4){ const t = sorted(taps); if (!t.length) return { hit: 0, total: 0 }; const list = normalizeCues(cues).filter(c => c.t >= t[0] - win && c.t <= t[t.length - 1] + win); return { hit: list.filter(c => t.some(x => Math.abs(x - c.t) <= win)).length, total: list.length }; }
// The beat to score against: the dance card's BPM (and the count 1 tapped in the player, if any), else a beat set here.
export function gridFor(d, settings = S.settings){
  if (!d) return null; const bpm = +d.bpm;
  if (Number.isFinite(bpm) && bpm >= 40 && bpm <= 220) { const o = +d.countOffset; return { bpm, offset: Number.isFinite(o) && o >= 0 ? o : null, source: "dance" }; }
  const b = normalizeBeats((settings || {}).beats)[d.id]; return b ? { bpm: b.bpm, offset: b.offset, source: "set" } : null;
}
export const bestKey = (mode, x) => mode === "metro" ? "m-" + x : "d-" + x;
export const bests = (settings = S.settings) => normalizeCountBest((settings || {}).countBest);
export const topBest = (settings = S.settings) => { const v = Object.values(bests(settings)); return v.length ? Math.max(...v) : null; };
const fmtS = (s) => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
// The words after a song round (also used by the tests): what she did, kindly.
export function songSummary(r){
  const lines = [];
  if (r.score) lines.push(`<b>${r.score.pct}% on the beat</b>${r.score.streak > 1 ? ` · 🔥 ${r.score.streak} perfect in a row` : ""}`);
  if (r.tempo) lines.push(`Your tempo: ${Math.round(r.tempo.bpm)} taps a minute${r.grid ? ` (the song: ${r.grid.bpm} BPM)` : ""}${r.steady !== null ? ` · steadiness ${r.steady}%` : ""}`);
  if (r.factor === 2) lines.push("You tapped double time: twice for every beat. That still counts!"); else if (r.factor === 0.5) lines.push("You tapped every other beat. That still counts!");
  if (r.grid && r.grid.offset === null) lines.push(`<span class="muted">Count 1 isn't saved for this dance, so I lined the beat up to your taps: this checks you stay with the pulse.</span>`);
  if (!r.grid) lines.push(`<span class="muted">This dance has no beat saved yet. Tap “Set the beat” once (a grown-up can help) and next time I can check you're on the counts.</span>`);
  if (r.cues && r.cues.total) lines.push(`✨ Big moments: you tapped on ${r.cues.hit} of ${r.cues.total}`);
  return lines.join("<br>");
}

// ---------- the Play card ----------
const C = { mode: "song", danceId: "", tempo: 100, on: false, kind: "", taps: [], audio: null, ctx: null, osc: [], raf: 0, grid: null, start: 0, end: 0, lat: 0, count: 0, last: -1, measured: null };
const songDances = () => dances();
const curDance = () => { const ds = songDances(); return ds.find(d => d.id === C.danceId) || ds.find(d => srcFor(d)) || ds[0] || null; };
const counts = (n) => `<div class="ct-counts" aria-hidden="true">${[1, 2, 3, 4, 5, 6, 7, 8].map(i => `<span class="${i === n ? "on" : ""}${i === 1 ? " one" : ""}">${i}</span>`).join("")}</div>`;
function showCount(n){ if (n === C.last) return; C.last = n; const el = $("#ctCounts"); if (el) el.innerHTML = counts(n); }
const say = (h) => { const el = $("#ctSay"); if (el) el.innerHTML = h; };
function beatLine(d){
  const g = gridFor(d);
  if (!g) return `No beat saved for this dance yet: you'll see your tempo and steadiness. Set the beat once to be scored on the counts.`;
  if (g.source === "set") return `Beat set by tapping: ${g.bpm} BPM, count 1 at ${fmtS(g.offset)}.`;
  return `${g.bpm} BPM from the dance card${g.offset === null ? " · count 1 not saved, so I line up to your taps" : ` · count 1 at ${fmtS(g.offset)}`}.`;
}
export function renderCount(){
  const el = $("#countSetup"); if (!el) return; const best = bests(); const b = $("#countBest"); if (b) b.textContent = topBest() === null ? "–" : topBest() + "%";
  const area = $("#countArea"); if (area && !C.on && !C.kind) area.hidden = true; el.hidden = C.on || !!C.kind;
  const tabs = `<div class="row" style="margin:6px 0">${[["song", "🎵 Find the beat"], ["metro", "🥁 Metronome"]].map(([m, n]) => `<button class="btn sm ${C.mode === m ? "coral" : "ghost"}" onclick="countMode('${m}')">${n}</button>`).join("")}</div>`;
  if (C.mode === "metro") {
    el.innerHTML = tabs + `<p class="small muted">A steady click. Four clicks to get ready (5 6 7 8), then tap every beat for four 8-counts.</p>
      <div class="row">${TEMPOS.map(t => `<button class="btn sm ${C.tempo === t ? "sun" : "ghost"}" onclick="countTempo(${t})">${t}${best[bestKey("metro", t)] !== undefined ? ` <span class="small">· best ${best[bestKey("metro", t)]}%</span>` : ""}</button>`).join("")}<span class="grow"></span><button class="btn sm coral" onclick="countStart()">▶ Start</button></div>`;
    return;
  }
  const d = curDance(); if (!d) { el.innerHTML = tabs + `<p class="small muted">No dances yet.</p>`; return; } C.danceId = d.id;
  const src = srcFor(d), g = gridFor(d), bk = best[bestKey("song", d.id)];
  el.innerHTML = tabs + `<label class="f" for="ctDance">Your music</label><select id="ctDance" onchange="countDance(this.value)">${songDances().map(x => `<option value="${esc(x.id)}"${x.id === d.id ? " selected" : ""}>${esc(x.name)}${srcFor(x) ? " ♪" : ""}</option>`).join("")}</select>
    <p class="small muted" style="margin:6px 0">${esc(beatLine(d))}${bk !== undefined ? ` Best ${bk}%.` : ""}</p>
    ${src ? `<div class="row"><button class="btn sm coral" onclick="countStart()">▶ Find the beat</button>${!g || g.source === "set" ? `<button class="btn sm ghost" onclick="countSet()">${g ? "Set the beat again" : "🎯 Set the beat"}</button>` : ""}</div>`
      : `<p class="small bad">No music file for this dance yet. A grown-up can add it on Dances ▸ More ▸ Add music file. Metronome practice works without one.</p>`}`;
}

const clock = () => C.kind === "metro" ? (C.ctx ? C.ctx.currentTime - C.lat : performance.now() / 1000) : (C.audio ? C.audio.currentTime : 0);
function audioCtx(){ try { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; if (!C.ctx) C.ctx = new AC(); if (C.ctx.state === "suspended" && C.ctx.resume) C.ctx.resume(); return C.ctx; } catch (e) { return null; } }
function clickAt(at, one){ const ctx = C.ctx; if (!ctx) return; try { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = one ? 1320 : 880; g.gain.setValueAtTime(0.3, at); g.gain.exponentialRampToValueAtTime(0.001, at + 0.06); o.connect(g); g.connect(ctx.destination); o.start(at); o.stop(at + 0.07); C.osc.push(o); } catch (e) {} }
function openArea(title){ $("#countArea").hidden = false; $("#countSetup").hidden = true; $("#ctRound").textContent = title; $("#ctLive").textContent = ""; C.last = -1; showCount(0); $("#ctActions").innerHTML = `<button class="btn ghost" onclick="countStop()">✕ Stop</button>`; }

// Start a round: the song (Find the beat / Set the beat) or the metronome. Called from a tap, so audio may start here.
export function startCount(kind){
  stopCount(true); kind = kind || (C.mode === "metro" ? "metro" : "song"); C.kind = kind; C.taps = []; C.count = 0; C.measured = null;
  if (kind === "metro") {
    const ctx = audioCtx(); C.lat = ctx ? (+ctx.outputLatency || +ctx.baseLatency || 0) : 0; const beat = 60 / C.tempo;
    // Clicks are scheduled on the audio clock and heard `lat` later; taps are read as audio time − lat, so the grid is the schedule.
    const t0 = (ctx ? ctx.currentTime : performance.now() / 1000) + 0.4; C.start = t0 + LEAD_IN * beat; C.end = C.start + METRO_BEATS * beat; C.grid = { bpm: C.tempo, offset: C.start };
    if (ctx) for (let i = 0; i < LEAD_IN + METRO_BEATS; i++) clickAt(t0 + i * beat, (i - LEAD_IN) % 8 === 0);
    openArea(`🥁 ${C.tempo} BPM · get ready: 5 6 7 8`); say(ctx ? "Listen for four clicks, then tap every beat." : "No sound on this device: watch the counts and tap with them."); C.on = true; loop(); return true;
  }
  const d = curDance(); const src = d && srcFor(d); if (!src) { toast("No music file for this dance yet"); return false; }
  C.grid = kind === "song" ? gridFor(d) : null;
  const a = new Audio(src.url); a.preload = "auto"; C.audio = a; a.addEventListener("ended", () => { if (C.on && C.audio === a) finishCount(); });
  a.addEventListener("error", () => { if (C.audio === a) { say(`<span class="bad">The music didn't load. Check the connection, or try Metronome practice.</span>`); C.on = false; } });
  try { const p = a.play(); if (p && p.catch) p.catch(e => { console.warn(e); say(`<span class="bad">Couldn't play. Tap Stop and try again.</span>`); }); } catch (e) { console.warn(e); }
  openArea(kind === "set" ? `🎯 Set the beat · ${d.name}` : `🎵 ${d.name}`);
  say(kind === "set" ? `Start on a 1 and tap ${SET_TAPS} steady beats. A grown-up can help.` : `Tap with the beat. ${ROUND_TAPS} taps, or tap Done.`);
  if (kind === "song") $("#ctActions").innerHTML = `<button class="btn coral" onclick="countFinish()">Done</button><button class="btn ghost" onclick="countStop()">✕ Stop</button>`;
  C.on = true; loop(); return true;
}
export function tapCount(){
  if (!C.on) return; const t = clock(); if (C.kind === "metro" && (t < C.start - 60 / C.tempo / 2 || t > C.end)) return;
  C.taps.push(t); const pad = $("#ctPad"); if (pad) { pad.classList.remove("hit"); void pad.offsetLeft; pad.classList.add("hit"); }
  const g = C.grid && C.grid.offset !== null ? C.grid : null;
  if (g) { const r = scoreTaps(C.taps, g.bpm, g.offset); const j = r.judged.find(x => x.t === t) || {}; say(j.grade === "perfect" ? "PERFECT ✨" : j.grade === "good" ? (j.err < 0 ? "Good! just early" : "Good! just late") : (j.err < 0 ? "A bit early" : "A bit late")); $("#ctLive").textContent = `${r.pct}% · 🔥 ${r.streak}`; }
  else { C.count = C.count % 8 + 1; showCount(C.count); $("#ctLive").textContent = `${C.taps.length} tap${C.taps.length === 1 ? "" : "s"}`; }
  if (C.kind === "set" && C.taps.length >= SET_TAPS) finishCount(); else if (C.kind === "song" && C.taps.length >= ROUND_TAPS) finishCount();
}
function loop(){
  if (!C.on) return; const t = clock(); const g = C.grid && C.grid.offset !== null ? C.grid : null;
  if (C.kind === "metro") { const beat = 60 / C.tempo; const i = Math.floor((t - C.start) / beat + 1e-9); showCount(i < -LEAD_IN ? 0 : i < 0 ? 9 + i : (i % 8) + 1); if (i === 0) $("#ctRound").textContent = `🥁 ${C.tempo} BPM`; if (t > C.end + beat / 2) return finishCount(); }
  else if (g && C.kind === "song") showCount(countAt(t, g.bpm, g.offset));
  C.raf = requestAnimationFrame(loop);
}
const again = (kind) => `<button class="btn coral" onclick="countAgain('${kind}')">▶ Again</button><button class="btn ghost" onclick="countStop()">Done</button>`;
// End of a round: score it, save the best and the beat, pay stars (Sofia) or the friends' bests.
export async function finishCount(){
  if (!C.on) return null; C.on = false; cancelAnimationFrame(C.raf); const kind = C.kind, taps = [...C.taps]; if (C.audio) { try { C.audio.pause(); } catch (e) {} }
  if (kind === "set") {
    const m = measureBeat(taps); C.measured = m;
    if (!m) { say(`I couldn't hear a steady beat in those taps. Try again, nice and even.`); $("#ctActions").innerHTML = again("set"); return null; }
    say(`I measured <b>${m.bpm} BPM</b>, count 1 at ${fmtS(m.offset)}. Save it for this dance?`);
    $("#ctActions").innerHTML = `<button class="btn coral" onclick="countSaveBeat()">✓ Save the beat</button><button class="btn ghost" onclick="countAgain('set')">Try again</button>`; return m;
  }
  if (taps.length < MIN_TAPS && kind === "song") { say(`Only ${taps.length} tap${taps.length === 1 ? "" : "s"}: try at least ${MIN_TAPS}, one on every beat.`); $("#ctActions").innerHTML = again(kind); return null; }
  let value, key, label, html, r = {};
  if (kind === "metro") { const sc = scoreTaps(taps.filter(t => t >= C.start - 30 / C.tempo && t <= C.end), C.tempo, C.start, METRO_BEATS); r = { score: sc };
    value = sc.pct; key = bestKey("metro", C.tempo); label = `Count Along · ${C.tempo} BPM`; html = `<b>${sc.pct}% on the beat</b> · Perfect ${sc.perfect} · Good ${sc.good}${sc.streak > 1 ? ` · 🔥 ${sc.streak} perfect in a row` : ""}`; }
  else {
    const d = curDance(); const tempo = tempoFromTaps(taps), steady = steadiness(taps), grid = C.grid; r = { tempo, steady, grid, factor: 1, score: null, cues: cueHits(taps, d && d.cues) };
    if (grid) { r.factor = tempoFactor(tempo && tempo.bpm, grid.bpm); const gb = r.factor === 2 ? grid.bpm * 2 : grid.bpm; r.score = scoreTaps(taps, gb, grid.offset === null ? fitOffset(taps, gb) : grid.offset); }
    value = r.score ? r.score.pct : steady || 0; key = r.score ? bestKey("song", d.id) : ""; label = "Count Along · " + (d ? d.name : ""); html = songSummary(r);
  }
  let chip = "";
  if (sofiaDancing()) {
    const b = bests(); if (key && value > (b[key] || 0)) { await setSettings({ countBest: { ...b, [key]: value } }); html += `<br>🏆 New best!`; }
    const st = await awardStars("count", value, label); chip = `⭐ +${st.earned + st.bonus}`;
  }
  await recordFriendScore("count", value); if (withFriends()) chip = `💃 ${esc(namesLine(pickedNames()))}${chip ? " · " + chip : ""}`;
  say(html); $("#ctActions").innerHTML = (chip ? `<span class="chip sun">${chip}</span>` : "") + again(kind); $("#ctLive").textContent = value + "%";
  return { value, key, ...r };
}
export async function saveBeat(){ const m = C.measured, d = curDance(); if (!m || !d) return; await setSettings({ beats: normalizeBeats({ ...(S.settings.beats || {}), [d.id]: m }) }); toast(`Beat saved: ${m.bpm} BPM ✓`); stopCount(); }
export function stopCount(keep){
  C.on = false; cancelAnimationFrame(C.raf); if (C.audio) { try { C.audio.pause(); C.audio.src = ""; } catch (e) {} } C.audio = null;
  for (const o of C.osc) { try { o.stop(0); } catch (e) {} } C.osc = [];
  if (!keep) { C.kind = ""; const a = $("#countArea"); if (a) a.hidden = true; const s = $("#countSetup"); if (s) s.hidden = false; renderCount(); }
}
export const countRunning = () => C.on || !!C.kind;
export function initCount(){
  const pad = $("#ctPad"); if (pad) { pad.onpointerdown = (e) => { if (e && e.preventDefault) e.preventDefault(); tapCount(); }; pad.onkeydown = (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); tapCount(); } }; }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden" && countRunning()) stopCount(); });
}
expose({ countMode: (m) => { C.mode = m === "metro" ? "metro" : "song"; renderCount(); }, countTempo: (t) => { if (TEMPOS.includes(+t)) C.tempo = +t; renderCount(); }, countDance: (id) => { C.danceId = String(id); renderCount(); },
  countStart: () => startCount(), countSet: () => startCount("set"), countAgain: (k) => startCount(k), countStop: () => stopCount(), countFinish: finishCount, countTap: tapCount, countSaveBeat: saveBeat });
