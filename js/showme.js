// "Show me": the dancer does the wrong version and the fixed version side by side, one pair per correction tag.
import { $, esc, expose } from "./util.js";
import { P } from "./data.js";
import { avatarSVG } from "./avatar.js";
import { S } from "./store.js";
import { closeCorrection, TAG_LABEL } from "./corrections.js";
import { checkBadges } from "./badges.js";

const SECOND = { el:[-40,-40], er:[40,-40], hl:[-66,-30], hr:[66,-30] };
const UP = { el:[-22,-70], er:[22,-70], hl:[-14,-100], hr:[14,-100] };
const EXT = { ...SECOND, kr:[34,10], fr:[72,-4] };            // leg extended to the front-side at hip height

// [wrong, fixed] poses per tag. Each entry: { p: pose overrides, o: avatar options (flaw), cue: kid copy }
export const PAIRS = {
  feet:    [{ p: EXT, o: { flaw: "flex" }, cue: "Flexed foot" },                                   { p: EXT, o: {}, cue: "Point your foot" }],
  knees:   [{ p: { ...EXT, kr:[36,26], fr:[64,10] }, o: {}, cue: "Bent knee" },                   { p: EXT, o: {}, cue: "Straighten the knee" }],
  eyes:    [{ p: UP, o: { flaw: "eyes" }, cue: "Eyes down" },                                       { p: { ...UP, h:[0,-80] }, o: {}, cue: "Eyes up" }],
  arms:    [{ p: { el:[-24,-30], er:[24,-30], hl:[-16,-52], hr:[16,-52] }, o: {}, cue: "Arms low" }, { p: UP, o: {}, cue: "Long arms, shoulders down" }],
  spacing: [{ p: { ...SECOND, kl:[-3,36], kr:[3,36], fl:[-4,70], fr:[4,70] }, o: {}, cue: "Narrow stance" }, { p: { ...SECOND, kl:[-22,36], kr:[22,36], fl:[-30,70], fr:[30,70] }, o: {}, cue: "Wide stance" }],
  energy:  [{ p: { el:[-18,-26], er:[18,-26], hl:[-46,-20], hr:[46,-20] }, o: {}, cue: "Elbows forward" }, { p: SECOND, o: {}, cue: "Elbows wide" }],
};
PAIRS.timing = PAIRS.energy; PAIRS.other = PAIRS.energy;

export function pairFor(tag){ return PAIRS[tag] || PAIRS.other; }
const stage = (side, on) => `<svg viewBox="70 30 160 230" class="showme-svg ${on ? "good" : "bad"}"><rect x="70" y="240" width="160" height="20" fill="#F7A8C6" opacity=".35"/>${avatarSVG(P(side.p), { ...side.o })}</svg><div class="showme-cue ${on ? "good" : "bad"}">${on ? "✅" : "❌"} ${esc(side.cue)}</div>`;

let current = null;
export function showMe(corrId, tag){
  const c = corrId ? S.corrections[corrId] : null; tag = tag || (c && c.tag) || "other"; current = corrId || null;
  const [wrong, right] = pairFor(tag);
  $("#showmeTag").textContent = TAG_LABEL[tag] || "Fix";
  $("#showmeText").textContent = c ? c.text : "";
  $("#showmeStage").innerHTML = `<div>${stage(wrong, false)}</div><div>${stage(right, true)}</div>`;
  $("#showmeGot").hidden = !(c && c.status !== "done");
  $("#showme").hidden = false; document.body.classList.add("modal");
}
export function hideShowMe(){ $("#showme").hidden = true; document.body.classList.remove("modal"); current = null; }
async function showmeGotIt(){ if (!current) return hideShowMe(); await closeCorrection(current); hideShowMe(); checkBadges(); }
export function initShowMe(){ $("#showmeClose").onclick = hideShowMe; $("#showmeGot").onclick = showmeGotIt; $("#showme").addEventListener("click", e => { if (e.target === $("#showme")) hideShowMe(); }); }
expose({ showMe, hideShowMe });
