// Practice mode: the checklist one item at a time, full screen. Manual (tap Done) or timed (each item's own length,
// auto-advance with a click). Every Done is saved to the day's practice record immediately — nothing resets.
// The dancer and a ring show progress; confetti at the end.
import { $, esc, todayStr, toast, expose } from "./util.js";
import { PRACTICE_ITEMS, P, MOVES, EXERCISES, ARMS, BASE } from "./data.js";
import { planFor } from "./planToday.js";
import { poseAt } from "./games/choreo.js";
import { S, storeSet, dances } from "./store.js";
import { avatarSVG } from "./avatar.js";
import { SOLO_ITEMS } from "./streak.js";
import { pingDone } from "./remind.js";
import { canSpeak, speakBunny, stopSpeaking } from "./voice.js";
import { checkBadges } from "./badges.js";
import { confetti } from "./views/practice.js";
import { demoFor, demoHtml } from "./demos.js";
import { awardStars } from "./stars.js";
import { markBite, markDrillTried } from "./habit.js";
import { sofiaDancing, whoSuffix, pickedNames, namesLine } from "./who.js";

const KIND = { warm:"🔥", core:"💪", legs:"🦵", str:"💪", flex:"🧘", tech:"🩰", run:"▶️", fix:"🎯", trick:"✨", aerial:"🤸", mind:"🧠", watch:"📹", listen:"🎧", improv:"💃" };
let ITEMS = [];
// timed: on unless she picked Manual (localStorage spotlight:pmode). ask: the timer ran out and the screen asks "Did it?".
// voice: each item is read out when it comes up (spotlight:pmvoice "off" turns it off).
const PM = { i: 0, timed: true, left: 0, total: 0, timer: 0, paused: false, ctx: null, ask: false, voice: false };
// A quick session (js/quick.js) runs the same screen but keeps its own done list and is saved as one record at the end.
// A "Try this" from the drill box (js/drills.js) is a bite session that also remembers which post was tried.
// `guest`: friends are dancing without Sofia (js/who.js), so nothing is saved to her day — the list just runs.
const MODE = { quick: "", bite: "", drill: "", guest: false }; const localDone = new Set();
const local = () => !!(MODE.quick || MODE.bite || MODE.guest);
const doneIds = () => local() ? [...localDone] : (rec().done || []);

// Pure: which item to show next — the first unchecked one at or after `from`, else the first unchecked anywhere, else -1.
export function nextIndex(items, done, from = 0){
  const d = new Set(done || []);
  for (let i = from; i < items.length; i++) if (!d.has(items[i].id)) return i;
  for (let i = 0; i < from; i++) if (!d.has(items[i].id)) return i;
  return -1;
}
// Pure: the buttons under a practice item, so the music, Hannah's videos, Chunks or Pause & Predict are one tap away
// (the session's timer pauses underneath). `vids` = { solo: [video names], trio: [video names] } from the dances'
// hannahVideos; a watch-day item picks the walkthrough or the run-through by name, else by position.
export function toolsFor(it, vids = {}){
  const id = String((it && it.id) || ""); const dance = (it && it.dance) || ""; const t = [];
  const vid = (d, re, at) => { const names = (vids[d] || []).map(n => String(n || "")); let i = names.findIndex(n => re.test(n)); if (i < 0 && names.length > at) i = at; return i >= 0 ? { label: `📹 ${names[i] || "Video"}`, go: `hvWatch('${d}',${i})` } : null; };
  const push = (x) => { if (x) t.push(x); };
  if (id === "watch-walk") push(vid("solo", /walk/i, 0));
  else if (id === "watch-run") push(vid("solo", /run/i, 1));
  else if (id === "judges-solo") { push({ label: "🎧 Judges' feedback", go: "showPage('dances');judgesOpen('solo')" }); push({ label: "📝 Write the fixes", go: "showPage('dances');noteOpen('solo')" }); }
  else if (id === "judges-trio") { push({ label: "🎧 Judges' feedback", go: "showPage('dances');judgesOpen('trio')" }); push({ label: "📝 Write the fixes", go: "showPage('dances');noteOpen('trio')" }); }
  else if (id === "mem-chunk") { push({ label: "🧩 Chunks", go: "openMemorize('solo','chunks')" }); push({ label: "🎵 Solo music", go: "openPlayer('solo')" }); }
  else if (id === "mem-predict") push({ label: "⏸ Pause & Predict", go: "openMemorize('solo','predict')" });
  else if (id === "film-chunk") { push({ label: "🎬 Film it", go: "openFilm()" }); push({ label: "🎵 Solo music", go: "openPlayer('solo')" }); push({ label: "🧩 Chunks", go: "openMemorize('solo','chunks')" }); }
  // The Sunday film review (Build 3): the sheet — the last run, what went well, ✓ It showed / Not yet, a note — one tap away.
  else if (id === "film-review") { push({ label: "🎬 Sunday sheet", go: "openSunday()" }); push({ label: "🎵 Solo music", go: "openPlayer('solo')" }); }
  else if (id === "trio-mark" || dance === "trio") { push({ label: "🎵 Trio music", go: "openPlayer('trio')" }); push(vid("trio", /run/i, 0)); }
  else if (dance === "solo" || /^(solo-run|mem-top|imagery|tired-picture|watch-picture|knees-memo)$/.test(id)) push({ label: "🎵 Solo music", go: "openPlayer('solo')" });
  return t;
}
const videoNames = () => { const out = {}; for (const d of dances()) if (Array.isArray(d.hannahVideos) && d.hannahVideos.length) out[d.id] = d.hannahVideos.map(v => v.name || ""); return out; };
// The dancer rises with progress: slumped arms at 0% → arms wide → arms up on relevé at 100%.
export function progressPose(pct){
  const t = Math.max(0, Math.min(1, pct / 100)); const mix = (a, b) => a + (b - a) * t;
  return P({ el: [mix(-26, -22), mix(-16, -70)], er: [mix(26, 22), mix(-16, -70)], hl: [mix(-30, -14), mix(12, -100)], hr: [mix(30, 14), mix(12, -100)], h: [0, mix(-74, -80)], lift: mix(0, 8), fl: [mix(-12, -6), 70], fr: [mix(12, 6), 70] });
}
const rec = () => S.practice[todayStr()] || { done: [], note: "", runs: [] };
const pct = () => Math.round(100 * doneIds().filter(id => ITEMS.some(i => i.id === id)).length / Math.max(1, ITEMS.length));
// Keyframes for an item's pose: a game move (moves.json) or an exercise (exercises.json, same joint schema).
export function framesFor(pose){ const mv = MOVES.find(x => x.id === pose); if (mv) return mv.k; const ex = EXERCISES[pose]; if (!ex) return null; return ex.map(kf => { const { arms, ...rest } = kf; return Object.assign({}, BASE, arms && ARMS[arms] ? ARMS[arms] : {}, rest); }); }
let animRaf = 0, animT0 = 0;
function animate(frames){ cancelAnimationFrame(animRaf); if (!frames) return;
  // Lying-down poses are wide, standing ones tall: pick the frame to fit.
  const lying = frames.some(f => Math.abs(f.rot || 0) >= 45 && Math.abs(f.rot || 0) <= 135); $("#pmDancer").setAttribute("viewBox", lying ? "20 70 260 170" : "70 30 160 230"); const k = frames.length > 1 ? frames : [frames[0], frames[0]]; const mv = { id: "ex", k }; animT0 = performance.now(); const dur = 1400 * Math.max(1, k.length - 1);
  const f = () => { const t = ((performance.now() - animT0) % (dur * 2)) / dur; const u = t <= 1 ? t : 2 - t; const pose = poseAt(mv, u); $("#pmDancer").innerHTML = `<rect x="70" y="240" width="160" height="20" fill="#F7A8C6" opacity=".35"/>${avatarSVG(pose)}`; animRaf = requestAnimationFrame(f); }; f(); }

function ring(p){ const r = 44, c = 2 * Math.PI * r; return `<svg viewBox="0 0 100 100" class="ring pm-ring"><circle cx="50" cy="50" r="${r}" class="ring-bg"/><circle cx="50" cy="50" r="${r}" class="ring-fg" transform="rotate(-90 50 50)" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - p / 100)}"/><text x="50" y="50" class="ring-txt">${p}%</text></svg>`; }
function render(){
  const items = ITEMS; const done = doneIds() || []; const p = pct(); const n = done.filter(id => items.some(i => i.id === id)).length;
  // An item can bring its own picture (a drill-box post's thumbnail); otherwise the move's demo picture, else the dancer.
  const cur = PM.i >= 0 ? items[PM.i] : null; const frames = cur ? framesFor(cur.pose) : null; const demo = cur ? (cur.demo || demoFor(cur.id)) : null;
  const box = $("#pmDemo"); box.hidden = !demo; box.style.display = demo ? "grid" : "none"; const dancer = $("#pmDancer"); dancer.hidden = !!demo; dancer.style.display = demo ? "none" : ""; if (demo) { cancelAnimationFrame(animRaf); box.innerHTML = demoHtml(demo); }
  const pic = $("#pmPic"); pic.hidden = !cur || !!(cur && cur.demo); if (cur && !cur.demo) pic.innerHTML = `<button class="lnk" onclick="openDemoSheet('${cur.id}','${esc(cur.text.split(/[:—(]/)[0].trim())}')">${demo ? "📷 Change picture" : "📷 Use a photo or clip"}</button>`;
  if (demo) {} else if (frames) animate(frames); else { cancelAnimationFrame(animRaf); $("#pmDancer").setAttribute("viewBox", "70 30 160 230"); $("#pmDancer").innerHTML = `<rect x="70" y="240" width="160" height="20" fill="#F7A8C6" opacity=".35"/>${avatarSVG(progressPose(p))}`; }
  $("#pmRing").innerHTML = ring(p); $("#pmCount").textContent = `${n} / ${items.length}`;
  if (PM.i < 0) { $("#pmItem").innerHTML = `<div class="pm-text">All done! 🎉</div><div class="small muted">${MODE.guest ? "Nice dancing!" : MODE.drill ? "That's today's trick. Want a picture of it?" : "Today counts. Go you."}</div>`; $("#pmActions").innerHTML = `${MODE.drill && !MODE.guest ? `<button class="btn ghost" onclick="pmClose();openMoments('drill')">📸 Moment</button>` : ""}<button class="btn coral big-btn" onclick="pmClose()">Done</button>`; $("#pmTimer").hidden = true; return; }
  const it = items[PM.i];
  $("#pmItem").innerHTML = `<div class="pm-kind">${KIND[it.kind] || "✨"}</div><div class="pm-text">${esc(it.text)}</div>${it.how ? `<div class="pm-how small">${esc(it.how)}</div>` : ""}`;
  const tools = $("#pmTools"); if (tools) tools.innerHTML = (MODE.guest ? [] : toolsFor(it, videoNames())).map(t => `<button class="btn sm violet" onclick="pmHold();${esc(t.go)}">${esc(t.label)}</button>`).join("");
  const secs = +it.secs || 0;
  $("#pmTimer").hidden = !PM.timed; if (PM.timed) $("#pmTimer").innerHTML = PM.ask ? `<div class="pm-clock">⏰ Time!</div><div class="small muted">Did you do it?</div>` : secs ? `<div class="pm-clock ${PM.paused ? "paused" : ""}">${fmt(PM.left)}</div><button class="btn sm ghost" onclick="pmPause()">${PM.paused ? "▶ Go" : "❚❚ Pause"}</button>` : `<div class="small muted">No timer for this one — tap Done when finished.</div>`;
  $("#pmActions").innerHTML = PM.ask ? `<button class="btn ghost" onclick="pmAgain()">↻ Again</button><button class="btn coral big-btn grow" onclick="pmDone()">✅ Did it</button>` : `<button class="btn ghost" onclick="pmSkip()">Skip</button><button class="btn coral big-btn grow" onclick="pmDone()">✅ Done</button>`;
  $("#pmMode").innerHTML = `<button class="btn sm ${PM.timed ? "ghost" : "coral"}" onclick="pmSetTimed(false)">Manual</button><button class="btn sm ${PM.timed ? "coral" : "ghost"}" onclick="pmSetTimed(true)">Timed</button>${canSpeak() ? `<button class="btn sm ghost" onclick="pmVoice()" aria-label="Read each item out loud">${PM.voice ? "🔊" : "🔇"}</button>` : ""}`;
}
// Read the item out when it comes up (the bunny voice; iPhone only lets it start from a tap, which Start / Done / Did it are).
function sayItem(){ if (!PM.voice || PM.i < 0 || !canSpeak()) return; const it = ITEMS[PM.i]; if (!it) return; const t = String(it.text || "").replace(/^[^A-Za-z0-9]+/, "").split(/\s[·(]/)[0]; if (t) speakBunny(t); }
const fmt = (s) => Math.floor(s / 60) + ":" + String(Math.max(0, s) % 60).padStart(2, "0");
// The timer running out doesn't tick the item off: it beeps and asks "Did it?" (✅ Did it / ↻ Again), so a timer is never a Done.
function startTimer(){ clearInterval(PM.timer); PM.ask = false; const it = ITEMS[PM.i]; if (!PM.timed || !it || !+it.secs) return; PM.left = +it.secs; PM.paused = false; const el0 = $("#pmTimer .pm-clock"); if (el0) el0.textContent = fmt(PM.left);
  PM.timer = setInterval(() => { if (PM.paused) return; PM.left--; const el = $("#pmTimer .pm-clock"); if (el) el.textContent = fmt(PM.left); if (PM.left <= 0) { clearInterval(PM.timer); beep(); PM.ask = true; render(); } }, 1000); }
function again(){ render(); startTimer(); }
// A tool button (the music, a video, Chunks) opens over the session: the clock waits until she taps ▶ Go.
function hold(){ if (PM.timed && !PM.paused && !PM.ask) { PM.paused = true; render(); } }
function voiceToggle(){ PM.voice = !PM.voice; try { localStorage.setItem("spotlight:pmvoice", PM.voice ? "on" : "off"); } catch (e) {} if (!PM.voice) stopSpeaking(); render(); if (PM.voice) sayItem(); }
function beep(){ try { if (!PM.ctx) PM.ctx = new (window.AudioContext || window.webkitAudioContext)(); const o = PM.ctx.createOscillator(), g = PM.ctx.createGain(); o.frequency.value = 1046; g.gain.value = 0.3; o.connect(g); g.connect(PM.ctx.destination); const t = PM.ctx.currentTime; o.start(t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35); o.stop(t + 0.4); } catch (e) {} }
async function done(){
  if (PM.busy) return; PM.busy = true;
  try {
  const it = ITEMS[PM.i]; if (!it) return; PM.ask = false; if (local()) { localDone.add(it.id); advance(); return; } const r = rec(); const doneIds = [...new Set([...(r.done || []), it.id])];
  const date = todayStr(); await storeSet("practice", date, { ...r, done: doneIds, total: ITEMS.length });
  if (SOLO_ITEMS.includes(it.id)) try { pingDone(); } catch (e) {} // the solo part is done: the plan is done, no reminder tonight
  if (it.aerialId) { const ad = new Set(S.settings.aerial || []); if (!ad.has(it.aerialId)) { ad.add(it.aerialId); await storeSet("settings", "main", { ...S.settings, aerial: [...ad] }); } }
  try { localStorage.setItem("spotlight:practice:" + date, JSON.stringify(doneIds)); } catch (e) {}
  advance();
  } finally { PM.busy = false; }
}
function advance(){ PM.i = nextIndex(ITEMS, doneIds(), PM.i + 1); render(); if (PM.i < 0) { clearInterval(PM.timer); stopSpeaking(); confetti(); if (MODE.guest) toast(`Nice one, ${namesLine(pickedNames())}! 🎉`, 2500); else if (MODE.quick) finishQuick(); else if (MODE.bite) finishBite(); else { checkBadges(); awardStars("practice", 100, "Practice done"); } } else { startTimer(); sayItem(); } }
// A bite session (Today's move of the day, a tired-day option): the bite is what counts; a star for showing up.
async function finishBite(){ const b = MODE.bite; if (MODE.drill) await markDrillTried(MODE.drill); else await markBite(b); checkBadges(); awardStars("quick", 100, MODE.drill ? "Tried it ✓ That's today's trick" : b === "tired" ? "Rest counts. Streak safe" : "Move done"); }
async function finishQuick(){ const r = rec(); const date = todayStr(); await storeSet("practice", date, { ...r, quick: [...(Array.isArray(r.quick) ? r.quick : []), MODE.quick] }); checkBadges(); awardStars("quick", 100, "Quick session done"); }
function skip(){ PM.ask = false; PM.i = nextIndex(ITEMS, doneIds(), PM.i + 1); if (PM.i < 0) PM.i = nextIndex(ITEMS, doneIds(), 0); render(); startTimer(); sayItem(); }
function setTimed(v){ PM.timed = v; try { localStorage.setItem("spotlight:pmode", v ? "timed" : "manual"); } catch (e) {} render(); startTimer(); }
function pause(){ PM.paused = !PM.paused; render(); }
export function openPracticeMode(items, opts = {}){
  try { PM.timed = localStorage.getItem("spotlight:pmode") !== "manual"; PM.voice = localStorage.getItem("spotlight:pmvoice") !== "off"; } catch (e) { PM.timed = true; PM.voice = true; }
  MODE.quick = opts.quick || ""; MODE.bite = opts.bite || ""; MODE.drill = opts.drill || ""; MODE.guest = !sofiaDancing(); localDone.clear(); if (MODE.quick || MODE.bite) PM.timed = true; $("#pmTitle").textContent = (opts.title || "Practice") + whoSuffix();
  ITEMS = Array.isArray(items) && items.length ? items : planFor(todayStr()); PM.i = nextIndex(ITEMS, doneIds(), 0); if (PM.i < 0) PM.i = 0;
  $("#pmode").hidden = false; document.body.classList.add("modal"); render(); startTimer(); sayItem();
}
export function closePracticeMode(){ clearInterval(PM.timer); cancelAnimationFrame(animRaf); stopSpeaking(); $("#pmode").hidden = true; document.body.classList.remove("modal"); }
export function initPracticeMode(){ $("#pmClose").onclick = closePracticeMode; $("#startPractice").onclick = () => openPracticeMode(); document.addEventListener("demochanged", () => { if (!$("#pmode").hidden) render(); }); }
expose({ pmDone: done, pmSkip: skip, pmSetTimed: setTimed, pmPause: pause, pmAgain: again, pmHold: hold, pmVoice: voiceToggle, pmClose: closePracticeMode, openPracticeMode });
