// Play tab: a grid of game tiles; tap one to open that game (one at a time), "All games" to come back.
// Each game module wires its own globals; this renders the tiles and the idle state of the open game.
import { $, $$, esc, expose } from "../util.js";
import { S } from "../store.js";
import { initChoreo, csRender } from "../games/choreo.js";
import { tfRender } from "../games/trio.js";
import "../games/oops.js";
import "../games/nextmove.js";
import "../games/compday.js";
import "../games/sparkle.js";
import "../games/mirror.js";
import { renderAlong } from "../games/along.js";

export const GAMES = [
  { id: "choreo",  emoji: "💃", name: "Choreo Studio",  blurb: "Build a dance, face the judges", best: (s) => s.csBest ? s.csBest : null },
  { id: "oops",    emoji: "👀", name: "Spot the Oops",  blurb: "Find the correction, fast",     best: (s) => (s.jeBest || 0) + "/10" },
  { id: "nextmove", emoji: "🧠", name: "What's Next?",   blurb: "Know your dance by heart",    best: (s) => s.nmBest ? s.nmBest + "/10" : null },
  { id: "trio",    emoji: "👯", name: "Trio Formations", blurb: "Shapes for three",             best: (s) => s.tfBest || 0 },
  { id: "compday", emoji: "🎒", name: "Comp Day",       blurb: "One choice at a time",         best: (s) => s.cdBest || 0 },
  { id: "sparkle", emoji: "🎀", name: "Step & Sparkle", blurb: "Tap on the beat",              best: (s) => s.gameBest || 0 },
  { id: "mirror",  emoji: "🪞", name: "Mirror",         blurb: "Copy the dancer (camera)",     best: (s) => s.mirrorBest || 0 },
  { id: "along",   emoji: "🕺", name: "Dance Along",    blurb: "Learn a dance from a video",   best: () => null },
];
let openGame = "";
export function playOpen(id){ openGame = id; renderPlay(); if (id) { const c = document.querySelector(`.game-card[data-game="${id}"]`); if (c && c.scrollIntoView) c.scrollIntoView({ behavior: "smooth", block: "start" }); } else window.scrollTo({ top: 0 }); }
export function initPlay(){ initChoreo(); }
export function renderPlay(){
  const s = S.settings;
  $("#gameGrid").innerHTML = GAMES.map(g => { const b = g.best(s); return `<button class="game-tile" onclick="playOpen('${g.id}')"><span class="gt-emoji">${g.emoji}</span><span class="gt-name">${esc(g.name)}</span><small>${esc(g.blurb)}</small>${b !== null ? `<small class="gt-best">Best ${esc(String(b))}</small>` : ""}</button>`; }).join("");
  $("#gameGrid").hidden = !!openGame; $("#gameBack").hidden = !openGame;
  $$(".game-card").forEach(c => { c.hidden = c.dataset.game !== openGame; });
  csRender(); tfRender(); renderAlong(); $("#jeBest").textContent=s.jeBest||0; $("#nmBest").textContent=s.nmBest||0; $("#cdBest").textContent=s.cdBest||0; $("#gameBest").textContent=s.gameBest||0; $("#mirrorBest").textContent=s.mirrorBest||0;
}
expose({ playOpen });
