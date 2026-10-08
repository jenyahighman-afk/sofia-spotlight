// Trick Quest: every solo trick is a boss with three bars (feet, knees, arms — the coach's checks). Three timed
// stations (prep drill, slow five, to the music) knock the bars down; a freeze shot (camera at the trick's cue moment,
// scored against a saved "gold shape") hits all three. Empty bars = a gem; three gems on different days = the trick's
// circle goes to "clean". Pure parts up top (tested in Node).
import { $, esc, toast, todayStr, expose } from "../util.js";
import { SKILLS } from "../data.js";
import { S, storeSet, setSettings, dances } from "../store.js";
import { normalizeCues } from "../cues.js";
import { openFor } from "../corrections.js";
import { lastTrickReview } from "../coachhub.js";
import { srcFor } from "../player.js";
import { openStage, stageActions } from "../stage.js";
import { awardStars } from "../stars.js";
import { poseAvailable, detectVideoFrame, drawSkeleton } from "../pose.js";
import { poseFeatures, featureDistance } from "../posemath.js";
import { findSkill, kidCycle, skillState } from "../skills.js";

export const BARS = ["feet", "knees", "arms"], BAR_ICON = { feet: "🦶", knees: "🦵", arms: "💪" }, FULL = 100, STATION_HIT = 15, SHOT_HIT = 25, GEMS_FOR_CLEAN = 3;
const ok = (v) => !v || /^\s*✓/.test(String(v));
// Fresh bars for a trick: a check the coach ticked last time starts low, one it flagged starts full; no review = 70.
export function seedBars(review){ const b = {}; for (const k of BARS) { const v = review && review.review ? review.review[k === "arms" ? "arms" : k] : undefined; b[k] = !review ? 70 : ok(v) ? 35 : FULL; } return b; }
export const questOf = (rec) => { const q = (rec || {}).quest || {}; return { bars: BARS.every(k => typeof (q.bars || {})[k] === "number") ? { ...q.bars } : null, gems: Array.isArray(q.gems) ? [...q.gems] : [] }; };
const hit = (bars, k, n) => ({ ...bars, [k]: Math.max(0, (bars[k] || 0) - n) });
export const cleared = (bars) => BARS.every(k => (bars[k] || 0) <= 0);
// The music loop for a trick: the cue whose move names it, 6 s before to 8 s after; else null.
export function trickLoop(dance, name){ const cs = normalizeCues((dance || {}).cues); const key = String(name).toLowerCase().split(/\s|→/)[0]; const c = cs.find(x => x.move.toLowerCase().includes(key)); if (!c) return null; return { a: Math.max(0, c.t - 6), b: c.t + 8, at: c.t }; }
// Stations for a trick: [{kind, title, cue, secs, bar}]. `cue` is the one line on screen; the bar each station mainly hits.
export function buildStations(skill, dance, corrections = []){
  const name = skill.n; const drill = (dance.tricks || []).find(t => t.toLowerCase().startsWith(name.toLowerCase().split(/\s|→/)[0])) || "";
  const prep = drill.split(/(?<=[.!?])\s/).slice(1, 3).join(" ").trim() || drill.slice(0, 120) || `Warm up for the ${name}.`;
  const note = corrections.map(c => c.text).find(t => t.toLowerCase().includes(name.toLowerCase().split(/\s|→/)[0]));
  const cue = note ? note.replace(/^[^:]*:\s*/, "") : skill.tip || "Clean lines. Eyes up.";
  const loop = trickLoop(dance, name);
  return [
    { kind: "prep", title: "Prep", cue: prep, secs: 90, bar: "knees" },
    { kind: "slow", title: "Slow five", cue: `${name} ×5, slowly. ${cue}`, secs: 90, bar: "feet", reps: 5 },
    { kind: "music", title: "To the music", cue: loop ? "Twice slow, twice full speed. Hit the shape ON the beat." : "No cue for this trick yet — dance the section from memory, 4 times.", secs: loop ? Math.round((loop.b - loop.a) * 4 / 0.93) : 60, bar: "arms", loop }
  ];
}
export const shotScore = (mine, gold) => { const d = featureDistance(mine, gold); return !Number.isFinite(d) ? 0 : Math.max(0, Math.min(100, Math.round(100 - d * 90))); };

// iPhone: a sound can only start inside a tap, so the music element is poked on the tap and really played later.
function unlock(a){ try { const p = a.play(); if (p && p.then) p.then(() => { if (!a._armed) a.pause(); }).catch(() => {}); } catch (e) {} }
const Q = { skill: null, dance: null, stations: [], i: 0, bars: null, timer: 0, left: 0, audio: null, stream: null, shot: null, busy: false };
function chime(f = 1046){ try { const ctx = Q.ctx || (Q.ctx = new (window.AudioContext || window.webkitAudioContext)()); const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = f; g.gain.value = 0.25; o.connect(g); g.connect(ctx.destination); const t = ctx.currentTime; o.start(t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3); o.stop(t + 0.35); } catch (e) {} }
const fmt = (s) => Math.floor(s / 60) + ":" + String(Math.max(0, s) % 60).padStart(2, "0");
const barsHtml = (bars) => `<div class="qs-bars">${BARS.map(k => `<div class="qs-bar"><span>${BAR_ICON[k]}</span><div class="qs-track"><div class="qs-fill" style="width:${bars[k]}%"></div></div><small>${bars[k]}</small></div>`).join("")}</div>`;
// A save that fails (offline burst, no space yet) never stops the game; the next save carries the bars.
async function saveBars(){ const rec = S.skills[Q.skill.id] || { id: Q.skill.id, style: "solo", state: "learning" }; const q = questOf(rec); try { await storeSet("skills", Q.skill.id, { ...rec, quest: { bars: Q.bars, gems: q.gems } }); } catch (e) { console.warn("quest save", e); } }

// ---- boss pick ----
function qsStart(){
  const st = (SKILLS.styles || {}).solo; if (!st) return toast("No tricks yet");
  Q.dance = dances().find(d => d.id === "solo") || {}; stopAll();
  openStage("⚔️ Trick Quest", [$("#qsArea")], `<button class="btn ghost" onclick="closeStage()">Done</button>`);
  $("#qsArea").innerHTML = `<p class="small muted">Pick a boss. Empty its three bars to win a gem.</p>${st.skills.map(k => { const q = questOf(S.skills[k.id]); const bars = q.bars || seedBars(lastTrickReview(S.reviews, k.n)); return `<button class="qs-boss" onclick="qsPick('${k.id}')"><b>${esc(k.n)}</b> <span class="small">${"💎".repeat(Math.min(5, q.gems.length))}${skillState(S.skills, k.id) === "clean" || skillState(S.skills, k.id) === "checked" ? " ✓" : ""}</span>${barsHtml(bars)}</button>`; }).join("")}`;
}
function qsPick(id){
  const k = findSkill(id); if (!k) return; Q.skill = k; const q = questOf(S.skills[id]); Q.bars = q.bars || seedBars(lastTrickReview(S.reviews, k.n)); Q.stations = buildStations(k, Q.dance, openFor(S.corrections, "solo")); Q.i = 0; station();
}
// ---- stations ----
function station(){
  stopAll(); const s = Q.stations[Q.i]; if (!s) return shotIntro();
  Q.left = s.secs; $("#qsArea").innerHTML = `<div class="row"><span class="chip sun">Station ${Q.i + 1}/3 · ${esc(s.title)}</span><span class="grow"></span><span class="chip">${esc(Q.skill.n)}</span></div>${barsHtml(Q.bars)}
    <div class="pm-item"><div class="pm-text">${esc(s.cue)}</div></div><div class="pm-timer"><div class="pm-clock" id="qsClock">${fmt(Q.left)}</div></div><div class="small muted" id="qsNote" style="text-align:center">${s.kind === "music" && s.loop ? "Music starts on its own." : s.reps ? "A chime every rep." : ""}</div>`;
  stageActions(`<button class="btn ghost" onclick="qsSkip()">Skip</button><button class="btn coral big-btn grow" onclick="qsDone()">✅ Done</button>`);
  if (s.kind === "music" && s.loop) playLoop(s.loop);
  Q.timer = setInterval(() => { Q.left--; const el = $("#qsClock"); if (el) el.textContent = fmt(Q.left); if (s.reps && Q.left > 0 && Q.left % Math.round(s.secs / s.reps) === 0) chime(880); if (Q.left <= 0) { chime(1760); done(); } }, 1000);
}
function playLoop(loop){
  const src = srcFor(Q.dance); if (!src) { $("#qsNote").textContent = "Add the solo's music to hear the section."; return; }
  const a = new Audio(src.url); a.preload = "auto"; Q.audio = a; unlock(a); let pass = 0; const go = () => { a._armed = true; a.playbackRate = pass < 2 ? 0.85 : 1; a.currentTime = loop.a; a.play().catch(() => { $("#qsNote").textContent = "Tap Done when the section is danced 4 times."; }); };
  a.addEventListener("timeupdate", () => { if (a.currentTime >= loop.b) { pass++; if (pass >= 4) { a.pause(); $("#qsNote").textContent = "Four passes done. Tap ✅ Done."; } else { $("#qsNote").textContent = `Pass ${pass + 1} of 4 · ${pass < 2 ? "slow" : "full speed"}`; go(); } } });
  a.addEventListener("loadedmetadata", go, { once: true }); a.load();
}
async function done(){ if (Q.busy) return; Q.busy = true; try { const s = Q.stations[Q.i]; if (s) { Q.bars = hit(Q.bars, s.bar, STATION_HIT); await saveBars(); } Q.i++; station(); } finally { Q.busy = false; } }
function skip(){ Q.i++; station(); }
// ---- freeze shot ----
function shotIntro(){
  stopAll(); const loop = Q.stations[2] && Q.stations[2].loop; const gold = (S.settings.gold || {})[Q.skill.id];
  $("#qsArea").innerHTML = `<div class="row"><span class="chip sun">Freeze shot</span><span class="grow"></span><span class="chip">${esc(Q.skill.n)}</span></div>${barsHtml(Q.bars)}
    <div class="pm-item"><div class="pm-text">${loop ? "Prop the phone up. The section plays and the camera snaps your shape at the trick." : "Prop the phone up. 5-count, then hold your best shape."}</div></div>
    <div class="rc-cam" id="qsCamBox" hidden><video id="qsCam" playsinline muted autoplay class="mirrored"></video><div id="qsBig" class="rc-big" hidden></div></div><canvas id="qsShot" hidden style="width:100%;border-radius:14px"></canvas>
    <div class="small muted" id="qsNote" style="text-align:center">${gold ? "Scored against your gold shape." : "No gold shape yet — a grown-up can save this shot as the gold one."}</div>`;
  stageActions(`<button class="btn ghost" onclick="qsFinish()">Skip shot</button><button class="btn coral big-btn grow" onclick="qsShot()">📸 Freeze shot</button>`);
}
async function shot(){
  if (!poseAvailable() || !navigator.mediaDevices) return toast("No camera on this device");
  const src0 = srcFor(Q.dance); const pre = src0 ? new Audio(src0.url) : null; if (pre) { pre.preload = "auto"; unlock(pre); }
  const box = $("#qsCamBox"), v = $("#qsCam"); box.hidden = false; $("#qsShot").hidden = true; stageActions(`<button class="btn ghost" onclick="qsFinish()">Stop</button>`);
  try { Q.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 960 } }, audio: false }); v.srcObject = Q.stream; await v.play(); } catch (e) { $("#qsNote").textContent = "Camera didn't open: " + (e.message || e); return shotIntro(); }
  const big = (t) => { $("#qsBig").textContent = t; $("#qsBig").hidden = !t; };
  for (let n = 5; n >= 1; n--) { big(String(n)); chime(n === 1 ? 1760 : 880); await new Promise(r => setTimeout(r, 1000)); } big("");
  const loop = Q.stations[2] && Q.stations[2].loop; const src = srcFor(Q.dance); let wait = 2500;
  if (loop && src && pre) { const a = pre; Q.audio = a; a._armed = true; a.currentTime = loop.a; try { await a.play(); wait = (loop.at - loop.a) * 1000 + 300; } catch (e) {} }
  await new Promise(r => setTimeout(r, wait)); if (!Q.stream) return;
  const cv = $("#qsShot"); cv.width = v.videoWidth || 640; cv.height = v.videoHeight || 480; const ctx = cv.getContext("2d"); ctx.translate(cv.width, 0); ctx.scale(-1, 1); ctx.drawImage(v, 0, 0, cv.width, cv.height); ctx.setTransform(1, 0, 0, 1, 0, 0); chime(1320);
  let lm = null; try { lm = await detectVideoFrame(v, performance.now()); } catch (e) {}
  stopAll(); box.hidden = true; cv.hidden = false; if (lm) drawSkeleton(ctx, lm, cv.width, cv.height);
  const mine = lm ? poseFeatures(lm.map(p => ({ ...p, x: 1 - p.x }))) : null; Q.shot = mine; const gold = (S.settings.gold || {})[Q.skill.id];
  if (!mine) { $("#qsNote").textContent = "I couldn't see the whole shape. Step back and try again."; stageActions(`<button class="btn ghost" onclick="qsFinish()">Skip shot</button><button class="btn coral big-btn grow" onclick="qsShot()">📸 Again</button>`); return; }
  if (gold && gold.f) { const sc = shotScore(mine, gold.f); const good = sc >= 70; $("#qsNote").innerHTML = `<b>${sc}% like your gold shape.</b> ${good ? "Boss hit! 💥" : "Close — hold it longer next time."}`; if (good) { for (const k of BARS) Q.bars = hit(Q.bars, k, SHOT_HIT); await saveBars(); } awardStars("quest", sc, "Freeze shot"); }
  else $("#qsNote").innerHTML = `Shape saved. A grown-up can make it the gold shape.`;
  stageActions(`<button class="btn ghost" onclick="qsShot()">📸 Again</button><button class="btn sm ghost" onclick="qsGold()">⭐ Make this gold</button><button class="btn coral big-btn grow" onclick="qsFinish()">Finish</button>`);
}
async function makeGold(){ if (!Q.shot) return; await setSettings({ gold: { ...(S.settings.gold || {}), [Q.skill.id]: { f: Q.shot, at: todayStr() } } }); toast("Gold shape saved ⭐"); }
// ---- loot ----
async function finish(){
  stopAll(); const rec = S.skills[Q.skill.id] || { id: Q.skill.id, style: "solo", state: "learning" }; const q = questOf(rec); let gem = false;
  if (cleared(Q.bars)) { gem = true; if (!q.gems.includes(todayStr())) q.gems.push(todayStr()); Q.bars = seedBars(lastTrickReview(S.reviews, Q.skill.n)); }
  try { await storeSet("skills", Q.skill.id, { ...rec, quest: { bars: Q.bars, gems: q.gems } }); } catch (e) { console.warn("quest save", e); }
  if (gem && q.gems.length >= GEMS_FOR_CLEAN && skillState(S.skills, Q.skill.id) === "learning") await kidCycle(Q.skill.id);
  awardStars("quest", gem ? 100 : 40, "Trick Quest");
  $("#qsArea").innerHTML = `<div class="pm-item"><div class="pm-kind">${gem ? "💎" : "⚔️"}</div><div class="pm-text">${gem ? `Gem! ${esc(Q.skill.n)} is on the ropes.` : `${esc(Q.skill.n)}: bars down. Come back tomorrow.`}</div></div>${barsHtml(Q.bars)}<p class="small muted" style="text-align:center">${q.gems.length} gem${q.gems.length === 1 ? "" : "s"} · ${GEMS_FOR_CLEAN} on different days make it clean.</p>`;
  stageActions(`<button class="btn ghost" onclick="closeStage()">Done</button><button class="btn coral big-btn grow" onclick="qsStart()">Another boss</button>`);
}
function stopAll(){ clearInterval(Q.timer); if (Q.audio) { try { Q.audio.pause(); Q.audio.src = ""; } catch (e) {} Q.audio = null; } if (Q.stream) { Q.stream.getTracks().forEach(t => t.stop()); Q.stream = null; } }
document.addEventListener("stageclosed", stopAll);
expose({ qsStart, qsPick, qsDone: done, qsSkip: skip, qsShot: shot, qsGold: makeGold, qsFinish: finish });
