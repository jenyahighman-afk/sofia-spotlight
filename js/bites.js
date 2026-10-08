// Today in bites: a two-tap check-in (energy, mood) picks today's size — easy, normal or big — and shows three small
// bites to do, one at a time, with a cheer, a mind tip and a fuel tip for the day. Pure parts up top (tested in Node).
import { $, esc, todayStr, expose } from "./util.js";
import { S, storeSet, dances } from "./store.js";
import { DAILY } from "./data.js";
import { dayNumber } from "./plan.js";
import { planFor } from "./planToday.js";
import { dayCounts } from "./streak.js";
import { quickDone } from "./quick.js";

export const ENERGY = [[1, "😴 Low"], [2, "🙂 OK"], [3, "⚡ Lots"]], MOOD = [[1, "😕 Meh"], [2, "🙂 Fine"], [3, "😄 Great"]];
export const pickDaily = (list, date) => (list && list.length) ? list[dayNumber(date) % list.length] : "";
// Today's size from the check-in: both low → easy; one low or both middling → normal; otherwise big.
export function levelFor(feel){ if (!feel || !feel.e || !feel.m) return null; const s = feel.e + feel.m; return s <= 3 ? "easy" : s <= 5 ? "normal" : "big"; }
export const LEVEL_LABEL = { easy: "Easy day", normal: "Normal day", big: "Big day" };
// Bites for a level: [{id, text, go}] — text is one short line; go is the onclick. `st` says what's already done today.
export function bitesFor(level, st = {}){
  const run = { id: "run", text: st.hasMusic ? "Run the solo once with the music" : "Mark the solo once, eyes up", go: "showPage('dances')", done: st.runs > 0 };
  const stretch = { id: "flex", text: "5-min stretch", go: "openQuick('flex')", done: st.flex > 0 };
  const strength = { id: "strength", text: "5-min strength", go: "openQuick('strength')", done: st.strength > 0 };
  const practice = { id: "practice", text: "Start practice (tap Done after each one)", go: "showPage('practice');openPracticeMode()", done: !!st.practiced };
  const game = { id: "game", text: "One game: What's Next?", go: "showPage('play');playOpen('nextmove');nmStart()", done: !!st.played };
  const quest = { id: "quest", text: "Trick Quest: one boss", go: "showPage('play');playOpen('quest');qsStart()", done: !!st.quested };
  const coach = { id: "coach", text: "Run check with the coach", go: "openCoachHub()", done: !!st.reviewed };
  if (level === "easy") return [stretch, run, game];
  if (level === "normal") return [strength, practice, run];
  return [practice, quest, st.reviewed ? run : coach];
}
export const nextLevel = (l) => l === "easy" ? "normal" : l === "normal" ? "big" : null;

function stateToday(date){
  const rec = S.practice[date] || {}; const log = (S.settings.starLog || {})[date] || {}; const solo = dances().find(d => d.id === "solo") || {};
  return { runs: Array.isArray(rec.runs) ? rec.runs.length : 0, flex: quickDone(rec, "flex"), strength: quickDone(rec, "strength"), practiced: dayCounts(rec, planFor(date).length) && (rec.done || []).length > 0,
    played: !!log.nextmove, quested: !!log.quest, reviewed: Object.values(S.reviews || {}).some(r => r && !r.deleted && r.date === date), hasMusic: !!((solo.musicFile && solo.musicFile.url) || solo.musicUrl) };
}
export function renderBites(){
  const el = $("#bitesCard"); if (!el) return; const date = todayStr(); const rec = S.practice[date] || {}; const feel = rec.feel || null; const level = rec.level || levelFor(feel);
  const cheer = pickDaily(DAILY.cheers, date), mind = pickDaily(DAILY.mind, date), fuel = pickDaily(DAILY.fuel, date);
  const tips = `<div class="bite-tips"><div>🧠 ${esc(mind)}</div><div>🍎 ${esc(fuel)}</div></div>`;
  if (!level) { el.innerHTML = `<div class="today-what">How are you today?</div><div class="small muted">Energy</div><div class="row">${ENERGY.map(([v, t]) => `<button class="btn sm ${feel && feel.e === v ? "coral" : "ghost"}" onclick="biteFeel('e',${v})">${t}</button>`).join("")}</div>
    <div class="small muted" style="margin-top:6px">Mood</div><div class="row">${MOOD.map(([v, t]) => `<button class="btn sm ${feel && feel.m === v ? "coral" : "ghost"}" onclick="biteFeel('m',${v})">${t}</button>`).join("")}</div><div class="cheer">${esc(cheer)}</div>${tips}`; return; }
  const bites = bitesFor(level, stateToday(date)); const cur = bites.find(b => !b.done); const n = bites.filter(b => b.done).length; const more = nextLevel(level);
  el.innerHTML = `<div class="row"><span class="chip sun">${LEVEL_LABEL[level]}</span><span class="grow"></span><span class="small">${n}/${bites.length}</span><button class="lnk" onclick="biteReset()">change</button></div>
    ${bites.map(b => `<div class="bite ${b.done ? "done" : b === cur ? "now" : ""}">${b.done ? "✅" : b === cur ? "👉" : "○"} <span class="grow">${esc(b.text)}</span>${b === cur ? `<button class="btn sm coral" onclick="${b.go}">Go</button>` : ""}</div>`).join("")}
    ${!cur ? `<div class="cheer">All bites done. ${esc(cheer)}</div>${more ? `<div class="row"><button class="btn sm ghost" onclick="biteMore('${more}')">One more bite?</button></div>` : ""}` : `<div class="cheer">${esc(cheer)}</div>`}${tips}`;
}
async function setFeel(k, v){ const date = todayStr(); const rec = S.practice[date] || { done: [], note: "", runs: [] }; const feel = { ...(rec.feel || {}), [k]: v }; await storeSet("practice", date, { ...rec, feel, level: levelFor(feel) || undefined }); renderBites(); }
async function reset(){ const date = todayStr(); const rec = S.practice[date] || { done: [], note: "", runs: [] }; const { feel, level, ...rest } = rec; await storeSet("practice", date, rest); renderBites(); }
async function moreBites(level){ const date = todayStr(); const rec = S.practice[date] || { done: [], note: "", runs: [] }; await storeSet("practice", date, { ...rec, level }); renderBites(); }
expose({ biteFeel: setFeel, biteReset: reset, biteMore: moreBites });
