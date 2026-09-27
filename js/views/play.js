// Play tab: the avatar builder and the five games. Each game module wires its own globals; this just renders their idle state.
import { $ } from "../util.js";
import { S } from "../store.js";
import { avRender } from "../avatar.js";
import { initChoreo, csRender } from "../games/choreo.js";
import { tfRender } from "../games/trio.js";
import "../games/oops.js";
import "../games/compday.js";
import "../games/sparkle.js";

export function initPlay(){ initChoreo(); }
export function renderPlay(){ csRender(); tfRender(); avRender(); $("#jeBest").textContent=S.settings.jeBest||0; $("#cdBest").textContent=S.settings.cdBest||0; }
