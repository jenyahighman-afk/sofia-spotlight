// "How to practice my solo": Sofia's steps in kid words; a grown-up toggle opens what the sources say (research or
// expert opinion) with every source linked. Content in data/howto.json.
import { $, esc, expose } from "./util.js";
import { HOWTO } from "./data.js";

const EV = { research: "🔬 research", expert: "🎓 expert", both: "🔬🎓 both" };
let grown = false;
export function howtoHtml(h = HOWTO, showGrown = false){
  const src = Object.fromEntries((h.sources || []).map(s => [s.id, s]));
  const kid = `<ol class="howto-kid">${(h.kid || []).map(k => `<li><span class="ic">${esc(k.ic)}</span><span>${esc(k.t)}</span></li>`).join("")}</ol>`;
  if (!showGrown) return kid;
  const cites = (ids) => (ids || []).map(id => src[id]).filter(Boolean).map(s => `<a href="${esc(s.u)}" target="_blank" rel="noopener">${esc(s.t)}</a>`).join(" · ");
  return kid + `<div class="howto-grown"><div class="field-lab">For grown-ups: what the sources say</div>
    ${(h.grown || []).map(g => `<div class="howto-rec"><div><b>${g.n}. ${esc(g.t)}</b> <span class="chip ${g.ev === "research" ? "violet" : g.ev === "expert" ? "sun" : "mint"}">${EV[g.ev] || esc(g.ev)}</span></div><div class="small">${esc(g.note)}</div><div class="small muted">${cites(g.src)}</div></div>`).join("")}
    ${h.caveat ? `<p class="small muted">${esc(h.caveat)}</p>` : ""}</div>`;
}
function render(){ $("#htBody").innerHTML = howtoHtml(HOWTO, grown); $("#htGrown").textContent = grown ? "Hide grown-up details" : "👩 Grown-up details + sources"; }
export function openHowto(){ grown = false; $("#htTitle").textContent = "📖 " + (HOWTO.title || "How to practice my solo"); $("#howto").hidden = false; document.body.classList.add("modal"); render(); }
export function closeHowto(){ $("#howto").hidden = true; document.body.classList.remove("modal"); }
export function initHowto(){ $("#htClose").onclick = closeHowto; $("#htGrown").onclick = () => { grown = !grown; render(); }; }
expose({ openHowto });
