// What's Next?: a step from the dance comes up, tap the step that follows. Ten rounds, built from the dance's cue table
// when it has one (the solo's 28 cue names) or its typed step order (dances.steps). Pure parts up top (tested in Node).
import { $, esc, expose } from "../util.js";
import { S, storeSet, dances } from "../store.js";
import { openStage } from "../stage.js";
import { awardStars } from "../stars.js";
import { isCueTable, normalizeCues } from "../cues.js";

export const ROUNDS = 10;
// The steps a dance is quizzed on: the verified cue table's move names when it has one (the solo's 28, the same names as
// the cue cards, Chunks and Pause & Predict — one memorize path, Build 2), else its typed step order.
export const quizSteps = (d) => d && isCueTable(d.cues) ? normalizeCues(d.cues).filter(c => c.n).map(c => String(c.move || "").trim()).filter(Boolean) : (d && Array.isArray(d.steps) ? d.steps : []);
// Dances that know their steps well enough to quiz on.
export const quizDances = (list) => (list || []).filter(d => quizSteps(d).length >= 8);
// One round: the step shown, the right answer, and three options (the answer plus two other steps) in a random order.
export function makeRound(steps, i, rand = Math.random){
  if (!Array.isArray(steps) || i < 0 || i + 1 >= steps.length) return null;
  const answer = steps[i + 1]; const others = steps.filter((s, j) => j !== i + 1 && s !== answer && s !== steps[i]);
  const picks = []; const pool = [...others];
  while (picks.length < 2 && pool.length) { const k = Math.floor(rand() * pool.length); const [s] = pool.splice(k, 1); if (!picks.includes(s)) picks.push(s); }
  const options = [answer, ...picks]; for (let k = options.length - 1; k > 0; k--) { const j = Math.floor(rand() * (k + 1)); [options[k], options[j]] = [options[j], options[k]]; }
  return { prompt: steps[i], answer, options, index: i };
}
// Ten distinct round positions spread through the dance (never the last step: it has no "next").
export function roundOrder(n, rounds = ROUNDS, rand = Math.random){
  const idx = Array.from({ length: Math.max(0, n - 1) }, (_, i) => i); for (let k = idx.length - 1; k > 0; k--) { const j = Math.floor(rand() * (k + 1)); [idx[k], idx[j]] = [idx[j], idx[k]]; }
  return idx.slice(0, rounds).sort((a, b) => a - b);
}

const NM = { dance: null, steps: [], order: [], r: 0, score: 0, round: null, timer: 0 };
function nmStart(){
  const ds = quizDances(dances()); if (!ds.length) { $("#nmMsg").textContent = "No dance has its steps yet. A grown-up adds them under the dance's Edit."; return; }
  NM.dance = ds[Math.floor(Math.random() * ds.length)]; NM.steps = quizSteps(NM.dance); NM.order = roundOrder(NM.steps.length); NM.r = 0; NM.score = 0;
  openStage("🧠 What's Next?", [$("#nmArea")], `<button class="btn ghost" onclick="closeStage()">Done</button>`); nmRound();
}
document.addEventListener("stageclosed", () => clearTimeout(NM.timer));
function nmRound(){
  clearTimeout(NM.timer);
  if (NM.r >= NM.order.length) { $("#nmOpts").innerHTML = ""; $("#nmStep").innerHTML = `<div class="pm-text">Done! ${NM.score}/${NM.order.length}</div>`;
    $("#nmMsg").innerHTML = `${NM.score >= 9 ? "You know it by heart. 🧠✨" : NM.score >= 7 ? "Nearly all of it. Run it once more today." : "Read the step order on the dance card, then try again."} <button class="btn sm coral" onclick="nmStart()">Again</button>`;
    if (NM.score > (S.settings.nmBest || 0)) storeSet("settings", "main", { ...S.settings, nmBest: NM.score }); $("#nmBest").textContent = Math.max(NM.score, S.settings.nmBest || 0); awardStars("nextmove", NM.score, "What's Next?"); return; }
  NM.r++; NM.round = makeRound(NM.steps, NM.order[NM.r - 1]);
  $("#nmRound").textContent = `Round ${NM.r}/${NM.order.length}`; $("#nmDance").textContent = NM.dance.name.split(" · ")[0]; $("#nmScore").textContent = NM.score;
  $("#nmStep").innerHTML = `<div class="small muted">After…</div><div class="pm-text">${esc(NM.round.prompt)}</div><div class="small muted" style="margin-top:6px">…what comes next?</div>`;
  $("#nmOpts").innerHTML = NM.round.options.map((o, i) => `<button class="btn ghost je-opt" onclick="nmAnswer(${i})">${esc(o)}</button>`).join(""); $("#nmMsg").textContent = "";
}
function nmAnswer(i){
  if (!NM.round || !$("#nmOpts").querySelector("button:not([disabled])")) return;
  const right = NM.round.options[i] === NM.round.answer; if (right) NM.score++; $("#nmScore").textContent = NM.score;
  $("#nmMsg").innerHTML = right ? `<b style="color:#2E9E6B">Yes!</b>` : `<b style="color:#FF5C93">Not that.</b> Next is: ${esc(NM.round.answer)}`;
  $("#nmOpts").querySelectorAll("button").forEach(b => b.disabled = true); NM.timer = setTimeout(nmRound, right ? 700 : 1600);
}
export { nmStart, nmAnswer };
expose({ nmStart, nmAnswer });
