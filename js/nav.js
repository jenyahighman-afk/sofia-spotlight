// Tab navigation. Kept tiny and dependency-free so any view can import it.
import { $$, expose } from "./util.js";

export function showPage(p){ $$("section.page").forEach(s=>s.classList.toggle("on",s.id==="p-"+p)); $$("nav.tabs button").forEach(b=>b.classList.toggle("on",b.dataset.p===p)); window.scrollTo({top:0}); }
export function initNav(){ $$("nav.tabs button").forEach(b=>b.addEventListener("click",()=>showPage(b.dataset.p))); }
expose({ showPage });
