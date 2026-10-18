// Teach It (Play): Sofia is the teacher. She builds an 8-count (eight slots, one move per count) from the Choreo Studio
// move list, then "Teach it" plays it on her dancer with the counts shown big: a "5, 6, 7, 8" lead-in, the 8-count slow
// (half speed), another lead-in, then full speed. Counts are spoken when the phone can (speechSynthesis, guarded). Then
// her student — a dance friend from who.js or a grown-up — tries it, and Sofia gives 1-3 stars and one kind tip.
// Teaching one routine pays a couple of stars and is the day's "game" bite (stars.js). Up to 5 routines are saved in
// settings.teach = [{ id, name (≤ 20), moves: [8 move ids], made: "YYYY-MM-DD", taught }] (schema 38). Only floor-safe
// moves are offered: no acro tricks (cartwheel, walkover, handstand, aerial, bridge, rolls). Pure parts up top (tested).
import { $, esc, toast, uid, todayStr, expose } from "../util.js";
import { MOVES, P } from "../data.js";
import { S, setSettings, TEACH_MOVE_IDS, normalizeTeachList } from "../store.js";
import { avatarSVG } from "../avatar.js";
import { poseAt } from "./choreo.js";
import { openStage, stageActions, stageOpen } from "../stage.js";
import { awardStars } from "../stars.js";
import { dancers } from "../who.js";

export const SLOTS = 8, MAX_ROUTINES = 5, NAME_MAX = 20, FILL = "hold";
export const BEAT_MS = 600; // full speed: 100 counts a minute; slow is half speed (1200 ms a count)
export const TIPS = ["Great energy!", "Point those toes", "Watch the counts", "Big arms!", "Smile, you've got this", "Nice and tall", "Lovely ending", "Try it with the music next time"];
export const GROWNUP = { id: "grownup", n: "A grown-up" };

const known = (ids) => new Set(ids || TEACH_MOVE_IDS);
// Exactly 8 move ids: unknown entries become a hold on that count (so the other counts don't shift), extras are trimmed,
// a short list is padded with holds.
export function normalizeMoves(list, ids = TEACH_MOVE_IDS){
  const k = known(ids); const a = Array.isArray(list) ? list.slice(0, SLOTS) : [];
  const out = a.map(x => typeof x === "string" && k.has(x.trim()) ? x.trim() : FILL); while (out.length < SLOTS) out.push(FILL); return out;
}
// One routine / the saved list (flat routines, unique ids, at most 5): the schema-38 normalizer in store.js.
export const normalizeTeach = (list, ids = TEACH_MOVE_IDS) => normalizeTeachList(list, ids);
export function normalizeRoutine(r, i = 0, ids = TEACH_MOVE_IDS){ const [n] = normalizeTeachList([r], ids); if (!n) return null; if (!/^[a-z0-9-]{1,24}$/.test(String(r.id || "").trim().toLowerCase())) n.id = "t" + (i + 1); return n; }
// Save (or update by id) a routine, newest first. Returns null when 5 are already saved and this is a new one.
export function saveRoutine(list, r){
  const cur = normalizeTeach(list); const n = normalizeRoutine(r, cur.length); if (!n) return null; const i = cur.findIndex(x => x.id === n.id);
  if (i >= 0) { cur[i] = n; return cur; } if (cur.length >= MAX_ROUTINES) return null; return [n, ...cur];
}
export const removeRoutine = (list, id) => normalizeTeach(list).filter(r => r.id !== id);
export const markTaught = (list, id) => normalizeTeach(list).map(r => r.id === id ? { ...r, taught: r.taught + 1 } : r);
// Put a move in a slot (null clears it). Returns a new 8-slot array.
export function setSlot(slots, i, id){ const s = Array.from({ length: SLOTS }, (_, k) => (slots || [])[k] || null); if (i >= 0 && i < SLOTS) s[i] = id || null; return s; }
// Where the next tapped move goes: the selected slot, else the first empty one, else the last.
export function nextSlot(slots, sel = -1){ if (sel >= 0 && sel < SLOTS) return sel; const i = (slots || []).findIndex((x, k) => k < SLOTS && !x); return i >= 0 ? i : ((slots || []).length < SLOTS ? (slots || []).length : SLOTS - 1); }

// The play sequence: [{ phase: "lead"|"slow"|"full", count, move, at, dur }]. Each pass is a 5-6-7-8 lead-in (no move,
// at that pass's pace) then counts 1-8, one move per count. Slow is half speed (twice as long a count).
export function teachSequence(moves, { beat = BEAT_MS, slow = true, full = true } = {}){
  const m = normalizeMoves((Array.isArray(moves) ? moves : []).map(x => x || FILL)); const seq = []; let at = 0;
  const pass = (phase, dur) => { for (const c of [5, 6, 7, 8]) { seq.push({ phase: "lead", count: c, move: null, at, dur, pace: phase }); at += dur; } m.forEach((id, i) => { seq.push({ phase, count: i + 1, move: id, at, dur, pace: phase }); at += dur; }); };
  if (slow) pass("slow", beat * 2); if (full) pass("full", beat); return seq;
}
export const sequenceMs = (seq) => seq.length ? seq[seq.length - 1].at + seq[seq.length - 1].dur : 0;
// The step playing at ms (null after the end) and how far through it (0-1).
export function stepAt(seq, ms){ if (ms < 0 || ms >= sequenceMs(seq)) return null; let lo = 0; for (let i = 0; i < seq.length; i++) if (seq[i].at <= ms) lo = i; const s = seq[lo]; return { i: lo, step: s, t: Math.min(1, (ms - s.at) / s.dur) }; }
export const countLabel = (step) => step ? String(step.count) : "";
export const phaseLabel = (step) => !step ? "" : step.phase === "lead" ? (step.pace === "slow" ? "Ready… slow first" : "Ready… full speed!") : step.phase === "slow" ? "🐢 Slow" : "⚡ Full speed";
const WORDS = ["", "one", "two", "three", "four", "five", "six", "seven", "eight"];
export const spokenCount = (step) => step ? WORDS[step.count] || "" : "";
export const clampStars = (n) => Math.max(1, Math.min(3, Math.round(+n || 1)));
// Who can be the student: the dance friends (not Sofia: she's the teacher) and a grown-up.
export const students = (settings = S.settings) => [...dancers(settings).filter(d => d.id !== "sofia"), GROWNUP];
export const teachMoves = (list = MOVES, ids = TEACH_MOVE_IDS) => { const k = known(ids); return list.filter(m => k.has(m.id)); };

// ---------- store-backed ----------
const T = { slots: Array(SLOTS).fill(null), sel: -1, name: "", editing: "", playing: false, run: 0, student: "", stars: 0, tip: "", taught: false };
const routines = () => normalizeTeach(S.settings.teach);
const moveById = (id) => MOVES.find(m => m.id === id) || MOVES.find(m => m.id === FILL) || { id: FILL, n: "Hold", ic: "✋", k: [P()] };
function say(t){ try { if (typeof speechSynthesis === "undefined" || typeof SpeechSynthesisUtterance === "undefined" || !t) return; speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(String(t)); u.rate = 1.3; speechSynthesis.speak(u); } catch (e) {} }

export function renderTeach(){
  const el = $("#teachBuild"); if (!el) return; const ms = teachMoves(); const list = routines();
  el.innerHTML = `<div class="teach-slots">${T.slots.map((id, i) => { const m = id ? moveById(id) : null; return `<button class="teach-slot ${T.sel === i ? "on" : ""} ${m ? "full" : ""}" onclick="teachSel(${i})" aria-label="Count ${i + 1}"><b>${i + 1}</b><span>${m ? m.ic : "＋"}</span><small>${m ? esc(m.n) : "empty"}</small></button>`; }).join("")}</div>
    <p class="small muted" style="margin:4px 0">${T.sel >= 0 ? `Pick a move for count ${T.sel + 1}.` : "Tap a move to fill the next count. Tap a count to change it."} Empty counts are a hold.</p>
    <div class="row" style="margin-bottom:6px"><button class="btn sm ghost" onclick="teachClearSlot()">✕ Clear count</button><button class="btn sm ghost" onclick="teachClear()">Clear all</button><span class="grow"></span><button class="btn sm coral" onclick="teachGo()">🎓 Teach it</button></div>
    <div class="teach-moves">${ms.map(m => `<button class="btn sm ghost teach-move" onclick="teachAdd('${m.id}')"><span>${m.ic}</span><small>${esc(m.n)}</small></button>`).join("")}</div>
    <div class="row" style="margin-top:8px;flex-wrap:nowrap"><input type="text" id="teachName" style="flex:1;min-width:0" maxlength="${NAME_MAX}" placeholder="Name this 8-count" value="${esc(T.name)}" oninput="teachNameIn(this.value)"><button class="btn sm" onclick="teachSave()">${T.editing ? "Update" : "Save"}</button></div>
    <div class="small" style="margin-top:6px">${list.length ? list.map(r => `<div class="check"><span class="chip sun">🎓 ${r.taught}</span><a class="grow" href="#" onclick="teachLoad('${r.id}');return false">${esc(r.name)} <span class="muted">· ${r.moves.map(id => moveById(id).ic).join("")}</span></a><button class="del" onclick="teachDel('${r.id}')" aria-label="Delete">✕</button></div>`).join("") : `<span class="muted">Saved 8-counts show here (up to ${MAX_ROUTINES}).</span>`}</div>`;
}
function sel(i){ T.sel = T.sel === i ? -1 : i; renderTeach(); }
function add(id){ const i = nextSlot(T.slots, T.sel); T.slots = setSlot(T.slots, i, id); T.sel = -1; renderTeach(); }
function clearSlot(){ if (T.sel < 0) return toast("Tap a count first"); T.slots = setSlot(T.slots, T.sel, null); renderTeach(); }
function clearAll(){ T.slots = Array(SLOTS).fill(null); T.sel = -1; T.name = ""; T.editing = ""; renderTeach(); }
function nameIn(v){ T.name = String(v || "").slice(0, NAME_MAX); }
async function save(){
  if (!T.slots.some(Boolean)) return toast("Pick some moves first"); const id = T.editing || uid().replace(/[^a-z0-9]/g, "").slice(0, 24);
  const prev = routines().find(r => r.id === id); const next = saveRoutine(S.settings.teach, { id, name: T.name, moves: T.slots.map(x => x || FILL), made: prev && prev.made ? prev.made : todayStr(), taught: prev ? prev.taught : 0 });
  if (!next) return toast(`${MAX_ROUTINES} saved already. Delete one first.`); await setSettings({ teach: next }); T.editing = id; T.name = next.find(r => r.id === id).name; toast("Saved! 🎓"); renderTeach();
}
function load(id){ const r = routines().find(x => x.id === id); if (!r) return; T.slots = [...r.moves]; T.name = r.name; T.editing = r.id; T.sel = -1; renderTeach(); toast("Loaded " + r.name); }
async function del(id){ await setSettings({ teach: removeRoutine(S.settings.teach, id) }); if (T.editing === id) T.editing = ""; renderTeach(); }

// ---------- teaching (stage) ----------
function draw(step, t){
  const svg = $("#teachSvg"); if (!svg) return; const p = step && step.move ? poseAt(moveById(step.move), t) : P();
  svg.innerHTML = `<rect x="0" y="240" width="300" height="30" fill="#F7A8C6" opacity=".35"/><ellipse cx="150" cy="248" rx="60" ry="6" fill="rgba(74,35,64,.08)"/>${avatarSVG(p)}`;
  $("#teachCount").textContent = countLabel(step); $("#teachCount").className = "teach-count" + (step && step.phase === "lead" ? " lead" : "");
  $("#teachPhase").textContent = phaseLabel(step); $("#teachNow").textContent = step && step.move ? moveById(step.move).ic + " " + moveById(step.move).n : "";
}
// Plays a sequence on the dancer; resolves true when it ran to the end.
function play(seq){
  const run = ++T.run; T.playing = true; const t0 = performance.now(); let last = -1;
  return new Promise(res => { (function f(){ if (run !== T.run) return res(false); const s = stepAt(seq, performance.now() - t0);
    if (!s) { T.playing = false; draw(null, 0); $("#teachPhase").textContent = "✨ That's the 8-count!"; return res(true); }
    if (s.i !== last) { last = s.i; say(spokenCount(s.step)); } draw(s.step, s.t); requestAnimationFrame(f); })(); });
}
const working = () => T.slots.map(x => x || FILL);
async function go(){
  if (!T.slots.some(Boolean)) return toast("Pick some moves first"); T.student = ""; T.stars = 0; T.tip = ""; T.taught = false;
  $("#teachRate").style.display = "none"; openStage("🎓 Teach It", [$("#teachStage"), $("#teachRate")], `<span class="chip sun">Watch the counts…</span>`); $("#teachRate").style.display = "none";
  const done = await play(teachSequence(working())); if (done && stageOpen()) toStudent();
}
function toStudent(){ renderRate(); $("#teachRate").style.display = "block"; stageActions(`<button class="btn sun" onclick="teachAgain()">▶ Count them in</button><button class="btn ghost" onclick="closeStage()">Done</button>`); }
async function again(){ stageActions(`<span class="chip sun">Full speed…</span>`); const done = await play(teachSequence(working(), { slow: false })); if (done && stageOpen()) toStudent(); }
export function renderRate(){
  const el = $("#teachRate"); if (!el) return; const st = students(); const who = st.find(s => s.id === T.student);
  if (T.taught) { el.innerHTML = `<div class="card sun" style="margin:0"><h3>🎓 You taught ${esc(who ? who.n : "it")}!</h3><p class="big" style="margin:4px 0">${"⭐".repeat(T.stars)}</p><p><b>Teacher's tip:</b> ${esc(T.tip)}</p><p class="small muted">Real teachers do this every class. Swap and let them teach you one next!</p></div>`; return; }
  el.innerHTML = `<div class="card violet" style="margin:0"><h3>Your student's turn</h3><p class="small muted">They dance it while you count. Then you're the teacher: give stars and one kind tip.</p>
    <div class="field-lab">Who's learning?</div><div class="row who-chips">${st.map(s => `<button class="btn sm ${T.student === s.id ? "coral" : "ghost"}" onclick="teachStudent('${s.id}')">${esc(s.n)}</button>`).join("")}</div>
    <div class="field-lab">Stars</div><div class="row">${[1, 2, 3].map(n => `<button class="btn sm ${T.stars === n ? "sun" : "ghost"}" onclick="teachStars(${n})">${"⭐".repeat(n)}</button>`).join("")}</div>
    <div class="field-lab">One kind tip</div><div class="row who-chips">${TIPS.map((t, i) => `<button class="btn sm ${T.tip === t ? "coral" : "ghost"}" onclick="teachTip(${i})">${esc(t)}</button>`).join("")}</div>
    <div class="row" style="margin-top:8px"><span class="grow"></span><button class="btn coral" onclick="teachDone()">🎓 Give feedback</button></div></div>`;
}
function student(id){ T.student = id; renderRate(); }
function stars(n){ T.stars = clampStars(n); renderRate(); }
function tip(i){ T.tip = TIPS[i] || TIPS[0]; renderRate(); }
async function finish(){
  if (!T.student) return toast("Who did you teach?"); if (!T.stars) return toast("Pick 1, 2 or 3 stars"); if (!T.tip) return toast("Pick one kind tip");
  T.taught = true; renderRate(); stageActions(`<button class="btn sun" onclick="teachGo()">▶ Teach it again</button><button class="btn ghost" onclick="closeStage()">Done</button>`);
  if (T.editing && routines().some(r => r.id === T.editing)) await setSettings({ teach: markTaught(S.settings.teach, T.editing) });
  await awardStars("teach", T.stars, "Teach It"); renderTeach();
}
export function initTeach(){ document.addEventListener("stageclosed", () => { T.run++; T.playing = false; try { speechSynthesis.cancel(); } catch (e) {} for (const id of ["#teachStage", "#teachRate"]) { const a = $(id); if (a) a.style.display = "none"; } }); }
export { T as TEACH };
expose({ teachSel: sel, teachAdd: add, teachClearSlot: clearSlot, teachClear: clearAll, teachNameIn: nameIn, teachSave: save, teachLoad: load, teachDel: del, teachGo: go, teachAgain: again, teachStudent: student, teachStars: stars, teachTip: tip, teachDone: finish });
