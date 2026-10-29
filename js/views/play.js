// Play tab: a grid of game tiles; tap one to open that game (one at a time), "All games" to come back.
// Each game module wires its own globals; this renders the tiles and the idle state of the open game.
import { $, $$, esc, expose, todayStr } from "../util.js";
import { S } from "../store.js";
import { HOME_DAYS } from "../data.js";
import { memoryKnees } from "../season15.js";
import { planDone } from "../streak.js";
import { initChoreo, csRender } from "../games/choreo.js";
import { tfRender } from "../games/trio.js";
import "../games/oops.js";
import "../games/nextmove.js";
import "../games/quest.js";
import "../games/compday.js";
import "../games/sparkle.js";
import "../games/mirror.js";
import { renderAlong } from "../games/along.js";
import { initTeach, renderTeach } from "../games/teach.js";
import { renderCount, initCount, stopCount, countRunning, topBest } from "../games/count.js";
import { renderWho } from "../who.js";
import { doorsFor, showEvent } from "../advent.js";
import { renderDares } from "../dares.js";

export const GAMES = [
  { id: "choreo",  emoji: "💃", name: "Choreo Studio",  blurb: "Build a dance, face the judges", best: (s) => s.csBest ? s.csBest : null },
  { id: "oops",    emoji: "👀", name: "Spot the Oops",  blurb: "Find the correction, fast",     best: (s) => (s.jeBest || 0) + "/10" },
  { id: "quest",   emoji: "⚔️", name: "Trick Quest",    blurb: "Beat a trick, win a gem",        best: (s) => null },
  { id: "nextmove", emoji: "🧠", name: "What's Next?",   blurb: "Know your dance by heart",    best: (s) => s.nmBest ? s.nmBest + "/10" : null },
  { id: "trio",    emoji: "👯", name: "Trio Formations", blurb: "Shapes for three",             best: (s) => s.tfBest || 0 },
  { id: "compday", emoji: "🎒", name: "Comp Day",       blurb: "One choice at a time",         best: (s) => s.cdBest || 0 },
  { id: "sparkle", emoji: "🎀", name: "Step & Sparkle", blurb: "Tap on the beat",              best: (s) => s.gameBest || 0 },
  { id: "mirror",  emoji: "🪞", name: "Mirror",         blurb: "Copy the dancer (camera)",     best: (s) => s.mirrorBest || 0 },
  { id: "teach",   emoji: "🎓", name: "Teach It",       blurb: "Be the teacher: make an 8-count", best: () => null },
  { id: "along",   emoji: "🕺", name: "Dance Along",    blurb: "Learn a dance from a video",   best: () => null },
  { id: "count",   emoji: "🥁", name: "Count Along",    blurb: "Tap the beat of your music",   best: (s) => { const b = topBest(s); return b === null ? null : b + "%"; } },
];
// The games that are solo work; the rest are fillers. Pure: which tiles show on `date` — Trick Quest waits until the solo is
// memorized (Memory + knees), and on a home day during Own it the fillers wait until the plan is done (`gate`).
export const SOLO_GAMES = ["nextmove", "along", "count"];
export function gamesFor(date, { home = false, knees = false, done = false, games = GAMES } = {}){
  const gate = home && knees && !done;
  return { gate, games: games.filter(g => !(g.id === "quest" && knees) && !(gate && !SOLO_GAMES.includes(g.id))) };
}
// Build 3 (the review's "demote the extras"): Play is three sections — 🌸 Solo work (the solo games and Trick Quest), 🎉 Weekend
// games (the fillers) and ✨ Extras (the countdown doors while they run, the costume designer, the dare card under them).
// The gate above hides the weekend games and the extras alike; `doors` = the show countdown is running.
export const SOLO_WORK = ["nextmove", "along", "count", "quest"];
export const EXTRAS = [
  { id: "doors", emoji: "🎁", name: "Show countdown", blurb: "Open today's door", go: "openAdvent()" },
  { id: "costume", emoji: "👗", name: "Costume designer", blurb: "Dress your dancer", go: "openCostumes()" },
];
export function playSections(date, { home = false, knees = false, done = false, doors = false, games = GAMES, extras = EXTRAS } = {}){
  const { gate, games: shown } = gamesFor(date, { home, knees, done, games });
  const solo = shown.filter(g => SOLO_WORK.includes(g.id)), weekend = shown.filter(g => !SOLO_WORK.includes(g.id));
  const sections = [{ id: "solo", title: "🌸 Solo work", sub: "counts for the plan", games: solo }];
  if (weekend.length) sections.push({ id: "weekend", title: "🎉 Weekend games", sub: "after the plan", games: weekend });
  if (!gate) sections.push({ id: "extras", title: "✨ Extras", sub: "doors, dares, costumes", games: extras.filter(e => e.id !== "doors" || doors), dare: true });
  return { gate, sections };
}
let openGame = "";
export function playOpen(id){ openGame = id; renderPlay(); if (id) { const c = document.querySelector(`.game-card[data-game="${id}"]`); if (c && c.scrollIntoView) c.scrollIntoView({ behavior: "smooth", block: "start" }); } else window.scrollTo({ top: 0 }); }
export function initPlay(){ initChoreo(); initTeach(); initCount(); }
export function renderPlay(){
  const s = S.settings; renderWho(); const today = todayStr();
  const ev = showEvent(); const doors = doorsFor(); const doorsOn = !!ev && doors.length > 0 && today >= doors[0].date && today <= (ev.end || ev.start);
  const { gate, sections } = playSections(today, { home: !!HOME_DAYS[new Date().getDay()], knees: memoryKnees(today), done: planDone(S.practice[today]), doors: doorsOn });
  const tile = (g) => { const b = g.best ? g.best(s) : null; return `<button class="game-tile" onclick="${g.go || `playOpen('${g.id}')`}"><span class="gt-emoji">${g.emoji}</span><span class="gt-name">${esc(g.name)}</span><small>${esc(g.blurb)}</small>${b !== null ? `<small class="gt-best">Best ${esc(String(b))}</small>` : ""}</button>`; };
  $("#gameGrid").innerHTML = (gate ? `<div class="game-gate"><span class="grow">🏠 Home day: the solo first. The other games open when the plan is done ⭐</span><button class="btn sm coral" onclick="showPage('practice')">▶ Start practice</button></div>` : "")
    + sections.map(sec => `<div class="game-sec" data-sec="${sec.id}"><b>${sec.title}</b><small>${esc(sec.sub)}</small></div>` + sec.games.map(tile).join("")).join("");
  if (openGame !== "count" && countRunning()) stopCount(); // leaving the game stops its music or clicks
  $("#gameGrid").hidden = !!openGame; $("#gameBack").hidden = !openGame;
  const px = $("#playExtras"); if (px) px.hidden = !!openGame || gate; renderDares();
  $$(".game-card").forEach(c => { c.hidden = c.dataset.game !== openGame; });
  csRender(); tfRender(); renderAlong(); renderTeach(); renderCount(); $("#jeBest").textContent=s.jeBest||0; $("#nmBest").textContent=s.nmBest||0; $("#cdBest").textContent=s.cdBest||0; $("#gameBest").textContent=s.gameBest||0; $("#mirrorBest").textContent=s.mirrorBest||0;
}
expose({ playOpen });
