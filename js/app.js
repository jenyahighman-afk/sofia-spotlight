// Boot: load content, wire the views, connect to Firebase, gate on a family space, then stream everything live.
import { $, toast } from "./util.js";
import { loadData } from "./data.js";
import { onChange } from "./store.js";
import { initNav } from "./nav.js";
import { initFirebase, getFamilyId, joinFamily, isValidFamilyId, normalizeFamilyId, startWatching, friendlyError, sync } from "./sync.js";
import { showGate } from "./family.js";
import { initDances, renderDances } from "./views/dances.js";
import { renderHome } from "./views/home.js";
import { initEvents, renderEvents } from "./views/events.js";
import { initSchedule, renderClasses, renderCalendar } from "./views/schedule.js";
import { initPractice, renderPractice } from "./views/practice.js";
import { initNotes, renderNotes, renderPhotos, renderFiles } from "./views/notes.js";
import { initLists, renderTodos, renderPack } from "./views/lists.js";
import { initPlay, renderPlay } from "./views/play.js";
import { initSettings, renderSettings } from "./views/settings.js";

const VERSION_KEY = "spotlight:version";

function renderAll(){ renderHome(); renderDances(); renderEvents(); renderClasses(); renderCalendar(); renderPractice(); renderNotes(); renderPhotos(); renderFiles(); renderTodos(); renderPlay(); renderPack(); renderSettings(); }

function initViews(){ initNav(); initDances(); initEvents(); initSchedule(); initPractice(); initNotes(); initLists(); initPlay(); initSettings(); }

// Cache-first app shell: a new version installs in the background and is used on the next open.
async function registerSW(){
  if (!("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" });
    reg.addEventListener("updatefound", () => { const w = reg.installing; if (!w) return; w.addEventListener("statechange", () => { if (w.state === "installed" && navigator.serviceWorker.controller) toast("Update ready ✨ It'll load next time you open the app", 3500); }); });
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") reg.update().catch(() => {}); });
  } catch (e) { console.warn("service worker registration failed", e); }
  const seen = localStorage.getItem(VERSION_KEY);
  if (seen && seen !== self.APP_VERSION) toast("Updated ✨ v" + self.APP_VERSION, 3000);
  localStorage.setItem(VERSION_KEY, self.APP_VERSION);
}

function fatal(msg){ const g = $("#gate"); g.hidden = false; document.body.classList.add("gated"); ["gateHome","gateJoin","gateCreated","gateBusy"].forEach(x => { $("#" + x).hidden = true; }); $("#gateMsg").textContent = msg; $("#gateMsg").style.color = "#FF5C93"; }

(async () => {
  try {
    registerSW();
    await loadData();
    initViews();
    onChange(renderAll);
    renderAll();
  } catch (e) { console.error(e); return fatal("The app couldn't load its content: " + (e.message || e)); }

  try { await initFirebase(); }
  catch (e) { console.error(e); return fatal("Couldn't connect to Firebase: " + friendlyError(e) + (navigator.onLine ? "" : " (the first launch needs internet)")); }

  // A ?join=CODE link (from the QR code or a shared link) pre-fills or switches the family space.
  let fid = getFamilyId();
  const url = new URL(location.href); const joinParam = normalizeFamilyId(url.searchParams.get("join") || "");
  if (joinParam) { url.searchParams.delete("join"); history.replaceState(null, "", url.pathname + (url.search || "") + url.hash); }
  if (joinParam && isValidFamilyId(joinParam) && joinParam !== fid) {
    if (!fid) { try { fid = await joinFamily(joinParam); toast("Joined!"); } catch (e) { console.warn(e); fid = await showGate(joinParam); } }
    else if (confirm("This link is for a different family space. Switch to it on this phone?")) { try { fid = await joinFamily(joinParam); toast("Switched"); } catch (e) { toast(friendlyError(e), 3500); } }
  }
  if (!fid) fid = await showGate();
  startWatching(fid);
  renderSettings();
})();
