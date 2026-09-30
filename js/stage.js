// Full-screen stage for the games: the animation fills the phone and the buttons sit right under it, so nothing plays
// off-screen. openStage() moves the game's own elements (by reference, ids intact) into the overlay; closeStage() puts them back.
import { $, expose } from "./util.js";

const moved = []; // [{el, parent, next}]
export function openStage(title, els, actions = ""){
  closeStage(true);
  const body = $("#stageBody"); body.innerHTML = "";
  for (const el of els) { if (!el) continue; moved.push({ el, parent: el.parentNode, next: el.nextSibling }); body.appendChild(el); el.style.display = "block"; }
  $("#stageTitle").textContent = title; $("#stageActions").innerHTML = actions;
  $("#stage").hidden = false; document.body.classList.add("modal"); body.scrollTop = 0;
}
export function stageActions(html){ $("#stageActions").innerHTML = html; }
export function closeStage(silent){
  while (moved.length) { const { el, parent, next } = moved.pop(); if (parent) parent.insertBefore(el, next); }
  if (!silent) { $("#stage").hidden = true; document.body.classList.remove("modal"); document.dispatchEvent(new CustomEvent("stageclosed")); }
}
export const stageOpen = () => !$("#stage").hidden;
export function initStage(){ $("#stageClose").onclick = () => closeStage(); }
expose({ closeStage });
