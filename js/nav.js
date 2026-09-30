// Tab navigation. Kept tiny and dependency-free so any view can import it.
// A guard (installed by grownups.js) can redirect a page request — that's how PIN-locked screens bounce to the PIN pad.
import { $$, expose } from "./util.js";

let guard = null;
export function setGuard(fn){ guard = fn; }
export function showPage(p){
  if (guard) { const r = guard(p); if (typeof r === "string") p = r; }
  $$("section.page").forEach(s=>s.classList.toggle("on",s.id==="p-"+p));
  $$("nav.tabs button").forEach(b=>b.classList.toggle("on",b.dataset.p===p||(b.dataset.p==="me"&&["pin","grownups","events","schedule","lists","notes","reviews","reports","settings","skillcheck"].includes(p))));
  window.scrollTo({top:0});
  document.dispatchEvent(new CustomEvent("page", { detail: p }));
}
export function currentPage(){ const s = $$("section.page.on")[0]; return s ? s.id.replace(/^p-/, "") : ""; }
export function initNav(){ $$("nav.tabs button").forEach(b=>b.addEventListener("click",()=>showPage(b.dataset.p))); }
expose({ showPage });
