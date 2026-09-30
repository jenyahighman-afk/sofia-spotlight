// Play tab: the five games. Each game module wires its own globals; this just renders their idle state. (The avatar builder lives on Me.)
import { $ } from "../util.js";
import { S } from "../store.js";
import { initChoreo, csRender } from "../games/choreo.js";
import { tfRender } from "../games/trio.js";
import "../games/oops.js";
import "../games/compday.js";
import "../games/sparkle.js";
import "../games/mirror.js";

export function initPlay(){ initChoreo(); }
export function renderPlay(){ csRender(); tfRender(); $("#jeBest").textContent=S.settings.jeBest||0; $("#cdBest").textContent=S.settings.cdBest||0; $("#gameBest").textContent=S.settings.gameBest||0; $("#mirrorBest").textContent=S.settings.mirrorBest||0; }
