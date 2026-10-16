// Memorize it: a 10-minute daily sequence per dance (say the story, mark a chunk slow, count it, Test me, picture it),
// one chunk a day. A chunk is one of the dance's loop presets (data/dances.json `loops`); the chunk of the day is the
// first one not yet "known", and a chunk becomes known after Test me is perfect on two different days. Finishing the five
// steps is the day's "memo" bite (one bite keeps the streak) and a star. Pure parts up top (tested in Node), DOM below.
// Storage: settings.memo[danceId] = { known: [chunk names], tested: { [chunk name]: [dates] } }; practice[date].memo =
// { [danceId]: [step ids done] }. The printable "Sofia-Memorize-Plan.pdf" in My files carries the same five steps.
import { $, esc, toast, todayStr, expose } from "./util.js";
import { S, storeSet, setSettings, dances } from "./store.js";
import { markBite } from "./habit.js";
import { awardStars } from "./stars.js";
import { openPlayer } from "./player.js";
import { fmtTime } from "./cues.js";

export const STEPS = [
  { id: "story", ic: "🎭", n: "Say the story", t: "30 s", how: "Say the dance's story out loud. Then say which chunk is today's." },
  { id: "mark", ic: "🐢", n: "Mark it slow", t: "3 min", how: "Today's chunk at half speed, twice. Arms and eyes only. Say each move as it comes. Or with Hannah's video: watch one 8-count, pause, do it, next." },
  { id: "count", ic: "🔢", n: "Count it", t: "3 min", how: "From the top through today's chunk, full speed, twice. Count the 8s out loud: spoken counts, then the click, then nothing." },
  { id: "test", ic: "🙈", n: "Test me", t: "2 min", how: "Cue sheet in Test me: say the next move BEFORE you tap it. With the video: pause anywhere, she says what comes next." },
  { id: "picture", ic: "🧠", n: "Picture it", t: "1 min", how: "Eyes closed, no music. Dance the whole chunk in your head, start to finish." },
];
export const STEP_IDS = STEPS.map(s => s.id);
export const KNOWN_AFTER = 2; // perfect Test me days before a chunk counts as known
export const PICTURE_SECS = 60;

// Dances that can be memorized here: a cue sheet and at least one named chunk.
export const memoDances = (list) => (list || []).filter(d => Array.isArray(d.loops) && d.loops.length && Array.isArray(d.cues) && d.cues.length);
export const chunks = (d) => (d.loops || []).filter(l => l && l.n && Number.isFinite(+l.a) && Number.isFinite(+l.b) && +l.b > +l.a).map(l => ({ n: String(l.n), a: +l.a, b: +l.b }));
export const chunkLabel = (c) => c ? `${c.n} · ${fmtTime(c.a)}–${fmtTime(c.b)}` : "";
// The cue moves that fall inside a chunk (what she is memorizing today).
export const chunkMoves = (d, c) => !c ? [] : (d.cues || []).filter(q => +q.t >= c.a && +q.t < c.b).map(q => String(q.move || q.lyric || "").trim()).filter(Boolean);

export function memoFor(settings, danceId){ const m = (settings && settings.memo && settings.memo[danceId]) || {}; return { known: Array.isArray(m.known) ? m.known : [], tested: m.tested && typeof m.tested === "object" ? m.tested : {} }; }
export const isKnown = (settings, danceId, name) => memoFor(settings, danceId).known.includes(name);
// First chunk she doesn't know yet; null once every chunk is known (then it's run days).
export function chunkOfDay(d, settings){ const m = memoFor(settings, d.id); return chunks(d).find(c => !m.known.includes(c.n)) || null; }
// A perfect Test me on `date`: remembered once per day; the chunk is known after KNOWN_AFTER different days. Returns the new settings.memo.
export function markTested(settings, danceId, name, date, perfect = true){
  const all = { ...((settings && settings.memo) || {}) }; const m = memoFor(settings, danceId); const tested = { ...m.tested };
  if (perfect) { const days = [...new Set([...(tested[name] || []), date])].sort(); tested[name] = days.slice(-10); }
  const known = [...m.known]; if (perfect && (tested[name] || []).length >= KNOWN_AFTER && !known.includes(name)) known.push(name);
  all[danceId] = { known, tested }; return all;
}
export function setKnown(settings, danceId, name, on){ const all = { ...((settings && settings.memo) || {}) }; const m = memoFor(settings, danceId); const known = m.known.filter(k => k !== name); if (on) known.push(name); all[danceId] = { known, tested: m.tested }; return all; }
export const stepsDone = (rec, danceId) => { const m = rec && rec.memo && typeof rec.memo === "object" ? rec.memo[danceId] : null; return Array.isArray(m) ? m.filter(s => STEP_IDS.includes(s)) : []; };
export const allDone = (rec, danceId) => STEP_IDS.every(s => stepsDone(rec, danceId).includes(s));
// Today-card line: which dance and chunk is up today (trio first, as the plan says).
export function todayPick(list, settings, date = ""){
  const key = (d) => { const c = nextCheckpoint(d, date); return c ? c.d : "9999-99-99"; };
  const order = memoDances(list).map((d, i) => ({ d, i })).sort((x, y) => key(x.d).localeCompare(key(y.d)) || x.i - y.i).map(x => x.d);
  for (const d of order) { const c = chunkOfDay(d, settings); if (c) return { dance: d, chunk: c, run: false }; } return order[0] ? { dance: order[0], chunk: null, run: true } : null;
}
export const shortName = (d) => String(d.name || "").split("·")[0].trim();
// Dated checkpoints from the dance (data/dances.json `checkpoints`): the next one on or after `date`.
export function nextCheckpoint(d, date){ const cps = (d.checkpoints || []).filter(c => c && /^\d{4}-\d{2}-\d{2}$/.test(String(c.d)) && c.text).sort((a, b) => a.d.localeCompare(b.d)); return cps.find(c => c.d >= date) || null; }
export const daysBetween = (a, b) => Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 86400000);
// The dance's video links (Hannah's clips live here as "Name | https://…" or a bare URL): photos, drive, youtube or a video file.
const VIDEO_HOST = /photos\.(google|app\.goo)|goo\.gl|drive\.google|youtu\.?be|vimeo|\.(mp4|mov|m4v|webm)(\?|$)/i;
export function videoLinks(d){ return (d.links || []).map(l => { const [a, b] = String(l).split("|").map(x => x.trim()); const url = b || a; const name = b ? a : ""; return { name, url }; }).filter(l => /^https?:\/\//.test(l.url) && VIDEO_HOST.test(l.url)).map((l, i) => ({ ...l, name: l.name || "Video " + (i + 1) })); }

// ---- DOM ----
const PIC = { timer: null, left: 0, danceId: "" }; const OPEN = new Map(); // per dance: did she fold the card?
const rec = (date) => S.practice[date] || { done: [], note: "", runs: [] };
export function memoCard(d, date = todayStr()){
  const c = chunkOfDay(d, S.settings); const done = new Set(stepsDone(rec(date), d.id)); const finished = STEP_IDS.every(s => done.has(s)); const m = memoFor(S.settings, d.id);
  const chips = chunks(d).map(k => `<button type="button" class="chip ${m.known.includes(k.n) ? "mint" : c && c.n === k.n ? "coral" : ""}" onclick="memoKnown('${d.id}','${esc(k.n)}')" title="${m.known.includes(k.n) ? "Known · tap to practice it again" : "Tap when she knows it"}">${m.known.includes(k.n) ? "✓ " : c && c.n === k.n ? "★ " : ""}${esc(k.n)}</button>`).join("");
  const moves = chunkMoves(d, c);
  const act = (s) => {
    if (s.id === "story") return `<button class="btn sm ghost" onclick="memoDone('${d.id}','story')">Said it ✓</button>`;
    if (s.id === "mark") return `<button class="btn sm coral" onclick="memoPlay('${d.id}','mark')">▶ 50%</button><button class="btn sm ghost" onclick="memoDone('${d.id}','mark')">Done ✓</button>`;
    if (s.id === "count") return `<button class="btn sm coral" onclick="memoPlay('${d.id}','count')">▶ Counts</button><button class="btn sm ghost" onclick="memoDone('${d.id}','count')">Done ✓</button>`;
    if (s.id === "test") return `<button class="btn sm coral" onclick="memoPlay('${d.id}','test')">▶ Test me</button><button class="btn sm ghost" onclick="memoTested('${d.id}',true)">All right ✓</button><button class="btn sm ghost" onclick="memoTested('${d.id}',false)">Missed one</button>`;
    if (s.id === "picture") return PIC.timer && PIC.danceId === d.id ? `<span class="chip coral memo-clock">${PIC.left}s</span>` : `<button class="btn sm coral" onclick="memoPicture('${d.id}')">▶ 1 min</button>`;
    return "";
  };
  const rows = STEPS.map(s => `<div class="memo-step ${done.has(s.id) ? "done" : ""}"><span class="memo-ic">${done.has(s.id) ? "✅" : s.ic}</span><div class="grow"><b>${esc(s.n)}</b> <span class="small muted">${s.t}</span><div class="small">${esc(s.id === "story" ? (d.story ? "“" + d.story + "”" : s.how) : s.how)}</div>${done.has(s.id) ? "" : `<div class="row memo-act">${act(s)}</div>`}</div></div>`).join("");
  const cp = nextCheckpoint(d, date); const vids = videoLinks(d);
  const cpLine = cp ? `<div class="small memo-cp">🎯 ${daysBetween(date, cp.d) === 0 ? "Today" : daysBetween(date, cp.d) === 1 ? "Tomorrow" : `In ${daysBetween(date, cp.d)} days`} · ${esc(cp.text)}</div>` : "";
  const vidLine = vids.length ? `<div class="row memo-vids">📹 ${vids.map(v => `<a class="chip" href="${esc(v.url)}" target="_blank" rel="noopener">${esc(v.name)}</a>`).join("")}</div>` : "";
  const head = cpLine + vidLine + (c ? `<div class="memo-today">Today's chunk: <b>${esc(chunkLabel(c))}</b>${moves.length ? `<div class="small muted">${esc(moves.map(x => x.length > 42 ? x.slice(0, 40).replace(/\s+\S*$/, "") + "…" : x).join(" · "))}</div>` : ""}</div>`
    : `<div class="memo-today">Every chunk is known 🎉 Now it's run days: once with Lines on, once off. Clean with no help? Ask for the <b>No cues</b> badge.</div>`);
  const open = OPEN.has(d.id) ? OPEN.get(d.id) : !finished;
  return `<details class="more memo" data-memo="${d.id}" ${open ? "open" : ""}><summary>🧠 Memorize it ${finished ? `<span class="chip mint">done today ✓</span>` : `<span class="chip">${done.size}/${STEP_IDS.length}</span>`}</summary>
    <div class="row memo-chips">${chips}</div>${head}${c ? rows : ""}
    <div class="memo-step"><span class="memo-ic">🎬</span><div class="grow"><b>Full run</b> <span class="small muted">once a week</span><div class="small">Once with 📜 Lines on, once with Lines off. Then ▶ Run it in the player.</div><div class="row memo-act"><button class="btn sm ghost" onclick="openPlayer('${d.id}')">▶ Open the player</button></div></div></div>
    <p class="small muted memo-rule">One chunk a day. A chunk is known after Test me is perfect on ${KNOWN_AFTER} different days. The printable plan is in Me → My files.</p></details>`;
}
export function bindMemo(root){ (root || document).querySelectorAll("details[data-memo]").forEach(el => { el.addEventListener("toggle", () => OPEN.set(el.dataset.memo, el.open)); }); }
function rerender(){ document.dispatchEvent(new CustomEvent("memochanged")); }
async function saveStep(danceId, step, date = todayStr()){
  const r = rec(date); const cur = stepsDone(r, danceId); if (cur.includes(step)) return false;
  const next = [...cur, step]; await storeSet("practice", date, { ...r, memo: { ...(r.memo && typeof r.memo === "object" ? r.memo : {}), [danceId]: next } });
  if (STEP_IDS.every(s => next.includes(s))) { await markBite("memo", date); awardStars("quick", 100, "Chunk memorized ✓ That's today's bite"); }
  return true;
}
async function memoDone(danceId, step){ await saveStep(danceId, step); rerender(); }
function memoPlay(danceId, step){
  const d = dances().find(x => x.id === danceId); if (!d) return; const c = chunkOfDay(d, S.settings); const loop = c ? { a: c.a, b: c.b } : null;
  if (step === "mark") openPlayer(danceId, { speed: 50, loop, testMe: false });
  else if (step === "count") openPlayer(danceId, { speed: 100, loop: c ? { a: 0, b: c.b } : null, counts: "voice", testMe: false });
  else openPlayer(danceId, { speed: 100, loop, testMe: true });
}
async function memoTested(danceId, perfect){
  const d = dances().find(x => x.id === danceId); const c = d && chunkOfDay(d, S.settings); const date = todayStr();
  if (c) { const memo = markTested(S.settings, danceId, c.n, date, perfect); const nowKnown = memo[danceId].known.includes(c.n) && !isKnown(S.settings, danceId, c.n); await setSettings({ memo }); if (nowKnown) toast(`${c.n}: known! Next chunk tomorrow 🎉`, 2500); else if (perfect) toast("Perfect once. One more perfect day and it's known."); else toast("That's tomorrow's chunk again. Good test."); }
  await saveStep(danceId, "test"); rerender();
}
function memoPicture(danceId){
  if (PIC.timer) return; PIC.danceId = danceId; PIC.left = PICTURE_SECS; rerender();
  PIC.timer = setInterval(async () => { PIC.left -= 1; const el = document.querySelector(`[data-memo="${danceId}"] .memo-clock`); if (el) el.textContent = PIC.left + "s"; if (PIC.left <= 0) { clearInterval(PIC.timer); PIC.timer = null; await saveStep(danceId, "picture"); rerender(); } }, 1000);
}
async function memoKnown(danceId, name){ const on = !isKnown(S.settings, danceId, name); await setSettings({ memo: setKnown(S.settings, danceId, name, on) }); toast(on ? `${name}: marked known` : `${name}: back in the plan`); rerender(); }
function memoFocus(danceId){ const el = document.querySelector(`[data-memo="${danceId}"]`); if (el) { el.open = true; el.scrollIntoView({ behavior: "smooth", block: "start" }); } }
expose({ memoDone, memoPlay, memoTested, memoPicture, memoKnown, memoFocus });
