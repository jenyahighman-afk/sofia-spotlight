// Dance with a friend on the same phone: a "Who's dancing?" picker (Play) — Sofia, Hannah, Lauren or all three — that the
// games (Trio Formations, Step & Sparkle, Dance Along, Count Along) and practice mode read. No accounts, no messaging. The friends'
// names live in settings.friends (editable on Me) and their best scores in settings.friendBests (schema 26). Sofia's own
// stats, stars, bites and the streak stay hers: a game without Sofia dancing saves only the friends' scores. The pick
// itself is per phone (localStorage), not synced. Pure parts up top (tested in Node).
import { $, esc, expose, todayStr } from "./util.js";
import { S, setSettings } from "./store.js";

export const SLOTS = ["f1", "f2"], DEFAULT_FRIENDS = { f1: "Hannah", f2: "Lauren" }, NAME_MAX = 20;
export const FRIEND_GAMES = { sparkle: ["🎀", "Step & Sparkle"], trio: ["👯", "Trio Formations"], along: ["🕺", "Dance Along"], count: ["🥁", "Count Along"] };
const KEY = "spotlight:who";
// Who can dance: [{ id: "sofia" | "f1" | "f2", n }], Sofia first (her name from the avatar), friends from settings.friends.
export function dancers(settings = S.settings){ const st = settings || {}; const f = st.friends || {}; const sofia = String((st.avatar || {}).name || "").trim() || "Sofia"; return [{ id: "sofia", n: sofia }, ...SLOTS.map(id => ({ id, n: String(f[id] || "").trim() || DEFAULT_FRIENDS[id] }))]; }
// A pick, normalized: known ids only, no repeats, Sofia when nothing is left.
export function normalizePick(ids){ const order = ["sofia", ...SLOTS]; const have = new Set(Array.isArray(ids) ? ids : []); const out = order.filter(x => have.has(x)); return out.length ? out : ["sofia"]; }
export function togglePick(ids, id){ const cur = normalizePick(ids); if (id === "all") return ["sofia", ...SLOTS]; return normalizePick(cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id]); }
export const includesSofia = (ids) => normalizePick(ids).includes("sofia");
export const friendSlots = (ids) => normalizePick(ids).filter(id => id !== "sofia");
// "Sofia, Hannah & Lauren"
export function namesLine(names){ const n = (names || []).map(x => String(x || "").trim()).filter(Boolean); return n.length <= 1 ? n.join("") : n.slice(0, -1).join(", ") + " & " + n[n.length - 1]; }
// The friends' bests after a game: the max per friend per game, only for the friends in the pick. Sofia's bests are not here.
export function bestsAfter(bests, pick, game, score){ const out = { ...(bests || {}) }; const v = Math.round(+score || 0); for (const id of friendSlots(pick)) { const b = { ...(out[id] || {}) }; if (v > (+b[game] || 0)) b[game] = v; out[id] = b; } return out; }
// The line under a Moment's sticker: who danced (unless it's Sofia alone, which reads as before) and the streak, which is
// Sofia's, so it only shows when she is on the card.
export function momentSub(names, streak, sofia = "Sofia"){ const who = (names || []).filter(Boolean); const alone = who.length === 1 && who[0] === sofia; return [who.length && !alone ? "💃 " + namesLine(who) : "", (!who.length || who.includes(sofia)) && streak > 0 ? `🔥 ${streak}-day streak` : ""].filter(Boolean).join("  ·  "); }

// ---------- the pick on this phone ----------
// Kept for the day only: tomorrow the app is Sofia's again, so a playdate's pick can't quietly stop her bites counting.
let pick = null, pickDay = "";
export function currentPick(){ const today = todayStr(); if (!pick || pickDay !== today) { pick = ["sofia"]; pickDay = today; try { const saved = JSON.parse(localStorage.getItem(KEY) || "{}"); if (saved && saved.d === today) pick = normalizePick(saved.ids); } catch (e) {} } return pick; }
export function resetPickCache(){ pick = null; pickDay = ""; } // tests: re-read the stored pick
export function setPick(ids){ pick = normalizePick(ids); pickDay = todayStr(); try { localStorage.setItem(KEY, JSON.stringify({ ids: pick, d: pickDay })); } catch (e) {} renderWho(); return pick; }
export function pickedNames(){ const d = dancers(); return currentPick().map(id => (d.find(x => x.id === id) || {}).n).filter(Boolean); }
export const sofiaDancing = () => includesSofia(currentPick());
export const withFriends = () => friendSlots(currentPick()).length > 0;
// " · Sofia & Hannah" for a title; "" when Sofia dances alone.
export const whoSuffix = () => withFriends() ? " · " + namesLine(pickedNames()) : "";
// The best of the friends in the pick for a game (0 when none), so "NEW BEST!" in a game can mean theirs, not Sofia's.
export const friendBest = (game) => Math.max(0, ...friendSlots(currentPick()).map(id => +(((S.settings.friendBests || {})[id] || {})[game]) || 0));
// A game's end: saves the friends' bests for the friends in the pick. Returns true when friends were dancing.
export async function recordFriendScore(game, score){ if (!withFriends()) return false; await setSettings({ friendBests: bestsAfter(S.settings.friendBests, currentPick(), game, score) }); return true; }
export function renderWho(){
  const el = $("#whoRow"); if (!el) return; const cur = currentPick(); const d = dancers(); const all = cur.length === d.length;
  el.innerHTML = `<div class="row"><b class="grow">Who's dancing?</b><span class="small muted">${withFriends() ? "Scores save for each of you." : "Just you today."}</span></div>
    <div class="row who-chips">${d.map(x => `<button class="btn sm ${cur.includes(x.id) ? "coral" : "ghost"}" onclick="whoPick('${x.id}')">${x.id === "sofia" ? "💃 " : ""}${esc(x.n)}</button>`).join("")}<button class="btn sm ${all ? "coral" : "ghost"}" onclick="whoPick('all')">👯 All three</button></div>`;
}
function whoPick(id){ setPick(togglePick(currentPick(), id)); }
// Me: the friends' names (editable) and their bests.
export function renderFriends(){
  const el = $("#meFriends"); if (!el) return; const fb = S.settings.friendBests || {};
  el.innerHTML = `<h3>👯 My dance friends</h3><p class="small muted">Dance together on this phone: pick who's dancing on Play. Their scores save here. The streak and the stars are Sofia's.</p>
    ${dancers().slice(1).map(f => { const b = fb[f.id] || {}; const line = Object.entries(FRIEND_GAMES).map(([g, [ic]]) => b[g] ? `${ic} ${b[g]}${g === "along" || g === "count" ? "%" : ""}` : "").filter(Boolean).join(" · "); return `<div class="row who-friend"><input type="text" maxlength="${NAME_MAX}" value="${esc(f.n)}" onchange="whoName('${f.id}',this.value)" aria-label="Friend's name"><span class="small ${line ? "" : "muted"}">${line || "no scores yet"}</span></div>`; }).join("")}`;
}
async function setName(id, v){ if (!SLOTS.includes(id)) return; const n = String(v || "").trim().slice(0, NAME_MAX) || DEFAULT_FRIENDS[id]; await setSettings({ friends: { ...(S.settings.friends || {}), [id]: n } }); renderWho(); renderFriends(); }
expose({ whoPick, whoName: setName });
