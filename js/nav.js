// Tab navigation. Kept tiny and dependency-free so any view can import it.
// A guard (installed by grownups.js) can redirect a page request — that's how PIN-locked screens bounce to the PIN pad.
import { $$, expose } from "./util.js";

let guard = null;
export function setGuard(fn){ guard = fn; }
// The tab a page belongs to (1.61.0: Today · Dances · Skills · Me). Practice and the Coach corner open from Today, Play and the
// Grown-ups pages from Me, so their tab stays lit. A goal's page (1.66.0) opens from Skills. Pure.
export const TABS = ["home", "dances", "skills", "me"];
export function tabFor(p){ if (TABS.includes(p)) return p; if (p === "practice" || p === "coach") return "home"; if (p === "goal") return "skills"; return "me"; }
// 1.67.0: every page change is a history entry, so the phone's back button and the swipe from the edge go back a page
// instead of leaving the app; with a sheet or a stage open, back closes that first. lastTab(): the tab she was on, for
// a back button that should return where she came from (the PIN pad).
let tab = "home";
export const lastTab = () => tab;
const canPush = () => typeof history !== "undefined" && typeof history.pushState === "function";
export function showPage(p, fromBack = false){
  if (guard) { const r = guard(p); if (typeof r === "string") p = r; }
  if (TABS.includes(p)) tab = p;
  if (fromBack !== true && canPush() && currentPage() !== p) { try { history.pushState({ p }, ""); } catch (e) {} }
  $$("section.page").forEach(s=>s.classList.toggle("on",s.id==="p-"+p));
  document.body.classList.toggle("pg-home",p==="home");
  $$("nav.tabs button").forEach(b=>b.classList.toggle("on",b.dataset.p===tabFor(p)));
  const w = document.querySelector(".wrap"); if (w) w.scrollTop = 0; window.scrollTo({top:0});
  document.dispatchEvent(new CustomEvent("page", { detail: p }));
}
export function currentPage(){ const s = $$("section.page.on")[0]; return s ? s.id.replace(/^p-/, "") : ""; }
export function initNav(){
  $$("nav.tabs button").forEach(b=>b.addEventListener("click",()=>showPage(b.dataset.p)));
  if (!canPush()) return; try { history.replaceState({ p: "home" }, ""); } catch (e) {}
  window.addEventListener("popstate", (e) => {
    const over = [...document.querySelectorAll("div.modal, div.stage")].filter(m => !m.hidden).pop();
    if (over) { const x = over.querySelector('button[id$="Close"]'); if (x) { x.click(); try { history.pushState({ p: currentPage() }, ""); } catch (err) {} return; } }
    showPage((e.state && e.state.p) || "home", true);
  });
}
expose({ showPage });
