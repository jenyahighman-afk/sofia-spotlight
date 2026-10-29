// The daily habit: Today shows three choice cards (learn a trick, a dance game, show me a move) and a tired-day option.
// Finishing any one of them is a "bite" (practice.bites) and one bite keeps the streak (streak.js). Pure parts up top
// (tested in Node); the store-backed markBite at the bottom. The cards rotate by date so Today never looks the same twice.
import { todayStr } from "./util.js";
import { S, storeSet, BITE_IDS } from "./store.js";
import { SKILLS, PRACTICE_POOL } from "./data.js";
import { dayNumber } from "./plan.js";
import { skillState } from "./skills.js";
import { pingDone } from "./remind.js";
import { planDone } from "./streak.js";

export const BITES = BITE_IDS;
// Games that make sense as a quick daily pick (no camera clip needed, finished in a few minutes).
export const GAME_ROTATION = [["sparkle", "Step & Sparkle", "🎀"], ["nextmove", "What's Next?", "🧠"], ["oops", "Spot the Oops", "👀"], ["compday", "Comp Day", "🎒"], ["trio", "Trio Formations", "👯"], ["mirror", "Mirror", "🪞"]];
// Today's trick: the solo tricks she is still learning, in turn; once all are clean, all of them in turn.
export function trickOfDay(date, skills = {}, ladder = SKILLS){ const st = (ladder.styles || {}).solo; if (!st || !st.skills.length) return null; const open = st.skills.filter(k => !["clean", "checked"].includes(skillState(skills, k.id))); const list = open.length ? open : st.skills; return list[dayNumber(date) % list.length]; }
// Today's move: one technique item from the practice pool, in turn (shown with its animated dancer in practice mode).
export function moveOfDay(date, pool = PRACTICE_POOL){ const slot = (pool.slots || []).find(s => s.kind === "tech"); if (!slot || !slot.pool.length) return null; return slot.pool[dayNumber(date) % slot.pool.length]; }
export const gameOfDay = (date) => GAME_ROTATION[dayNumber(date) % GAME_ROTATION.length];
const short = (t) => String(t || "").split(/[:,(—]/)[0].trim();
// The three cards: [{id, ic, title, sub, go (onclick), done}]. `bites` = what today's practice record already has.
// `memo` (optional, from memo.js todayPick): { danceId, label } adds a fourth card, Memorize it.
// `focus` (optional, from season15.trickFocus): the 15-week plan's say on the trick card. "knees" = Memory + knees, no new
// tricks yet (until Nov 9) · "rest" / "none" = a light or taper week (picture the solo instead) · "trick" = the week's
// numbered trick(s) · "weakest" = her weakest one. Without a focus the card rotates her open solo tricks as before.
export function trickCard(date, { skills = {}, ladder, focus = null, done = false } = {}){
  if (focus && focus.kind === "knees") return { id: "trick", ic: "🦵", title: "Memory + knees", sub: "No new tricks yet", go: "habitKnees()", done };
  if (focus && (focus.kind === "rest" || focus.kind === "none")) return { id: "trick", ic: "🎧", title: focus.kind === "rest" ? "Light week" : "Nothing new", sub: "Picture the solo", go: "habitPicture()", done };
  const list = (((ladder || SKILLS).styles || {}).solo || {}).skills || [];
  let t = null;
  if (focus && focus.kind === "trick") { const mine = list.filter(s => focus.ids.includes(s.id)); const open = mine.filter(s => !["clean", "checked"].includes(skillState(skills, s.id))); const pick = open.length ? open : mine; t = pick.length ? pick[dayNumber(date) % pick.length] : null; }
  else if (focus && focus.kind === "weakest") t = list.find(s => s.ladder && !["clean", "checked"].includes(skillState(skills, s.id))) || null;
  t = t || trickOfDay(date, skills, ladder);
  return { id: "trick", ic: "⚔️", title: "Learn a trick", sub: t ? t.n : "Trick Quest", go: t ? `showPage('play');playOpen('quest');qsStart();qsPick('${t.id}')` : "showPage('play');playOpen('quest')", done };
}
// Memory + knees (Ms. Brittany, Oct 13): the knee block that stands in for a trick until the solo is memorized.
export const KNEES = { title: "🦵 Memory + knees", items: [
  { id: "knees-plie1", text: "Pliés in 1st facing the mirror ×8: knees go out over the toes, never fall in", secs: 60, pose: "plie", kind: "tech" },
  { id: "knees-plie2", text: "Pliés in 2nd ×8: knees over the toes the whole way down and up", secs: 60, pose: "plie", kind: "tech" },
  { id: "knees-lunge", text: "Slow lunges ×5 each side: front knee over the toes", secs: 90, pose: "lunge", kind: "tech" },
  { id: "knees-releve", text: "Slow relevés ×10: knees straight, ankles don't roll", secs: 45, pose: "releve", kind: "tech" },
  { id: "knees-memo", text: "Say the solo from the top, move by move, as far as you know", secs: 60, pose: "pose", kind: "tech" },
] };
// `soloOnly` (a home day during Own it, before the plan is done): the game card is What's Next? — solo work — not a filler game.
export function cardsFor(date, { skills = {}, bites = [], ladder, pool, memo = null, focus = null, soloOnly = false } = {}){
  const m = moveOfDay(date, pool), g = soloOnly ? ["nextmove", "What's Next?", "🧠"] : gameOfDay(date); const done = new Set(Array.isArray(bites) ? bites : []);
  const extra = memo && memo.danceId ? [{ id: "memo", ic: "🧠", title: "Memorize it", sub: memo.label || "A chunk", go: `showPage('dances');memoFocus('${memo.danceId}')`, done: done.has("memo") }] : [];
  return [...[
    trickCard(date, { skills, ladder, focus, done: done.has("trick") }),
    { id: "game", ic: g[2], title: "Dance game", sub: g[1], go: `showPage('play');playOpen('${g[0]}')`, done: done.has("game") },
    { id: "move", ic: "✨", title: "Show me a move", sub: m ? short(m.text) : "Technique", go: "habitMove()", done: done.has("move") },
  ], ...extra];
}
// Tired-day options: short, lying down, and they count. "Picture the dance" is mental rehearsal (see Mind skills).
export const TIRED = {
  stretch: { title: "🧘 2-minute stretch", items: [{ id: "tired-breathe", text: "Lie on your back. Breathe in for 4, out for 6", secs: 60, pose: "hollow", kind: "flex" }, { id: "tired-cobra", text: "Cobra, then seal. Slow and easy", secs: 60, pose: "cobra", kind: "flex" }] },
  picture: { title: "🎧 Picture the dance", items: [{ id: "tired-picture", text: "Lie down, eyes closed. Dance the whole solo in your head, counts and all", secs: 90, pose: "hollow", kind: "flex" }] },
};
// Add a bite to today's record (once). Returns true when it was new. The reminder goes quiet only once the plan is done
// (streak.js planDone): a plan box or a Memorize chunk does it, a game or a dare keeps the streak but not the nudge.
export async function markBite(id, date = todayStr()){
  if (!BITES.includes(id)) return false; const rec = S.practice[date] || { done: [], note: "", runs: [] }; const have = Array.isArray(rec.bites) ? rec.bites : [];
  if (have.includes(id)) return false; const next = { ...rec, bites: [...have, id] }; await storeSet("practice", date, next); if (planDone(next)) try { pingDone(); } catch (e) {}
  try { document.dispatchEvent(new CustomEvent("bitedone", { detail: id })); } catch (e) {} // the helper (buddy.js) says well done + what's next
  return true;
}
// A drill-box post tried for two minutes (js/drills.js): remembered on the day (practice.drills, once per post) and it is
// the day's trick bite. Returns what markBite returned (true when the bite was new).
export async function markDrillTried(postId, date = todayStr()){
  const id = String(postId || ""); if (!id) return false; const rec = S.practice[date] || { done: [], note: "", runs: [] }; const have = Array.isArray(rec.drills) ? rec.drills : [];
  if (!have.includes(id)) await storeSet("practice", date, { ...rec, drills: [...have, id] });
  return markBite("trick", date);
}
