// Boot: load content, wire the views, connect to Firebase, gate on a family space, then stream everything live.
import { $, toast } from "./util.js";
import { loadData } from "./data.js";
import { onChange, saveSoloFix, saveDrillsMove, saveWorkoutsMove } from "./store.js";
import { initNav, setGuard } from "./nav.js";
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
import { initMe, renderMe } from "./views/me.js";
import { initSkillCheck, renderSkillCheck } from "./views/skillcheck.js";
import { initSettings, renderSettings } from "./views/settings.js";
import { initGrownups, renderGrownups, isUnlocked, GROWNUP_PAGES } from "./grownups.js";
import { initShowMe } from "./showme.js";
import { initPlayer } from "./player.js";
import { initStage } from "./stage.js";
import { initPracticeMode } from "./pmode.js";
import { initCoach, renderReviews } from "./coach.js";
import { renderCoachHub } from "./coachhub.js";
import { initGoals } from "./goals.js";
import { initMirror } from "./games/mirror.js";
import { initAlong } from "./games/along.js";
import { initRunCheck } from "./runcheck.js";
import { initDemos } from "./demos.js";
import { initDrills } from "./drills.js";
import { initPet } from "./pet.js";
import { initAdvent } from "./advent.js";
import { initCards } from "./cards.js";
import { initNews } from "./news.js";
import { initBuddy, renderBuddy, buddyAuto } from "./buddy.js";
import { initCostume } from "./costume.js";
import { initGlow } from "./glow.js";
import { restoreTodayChecks } from "./views/practice.js";
import { settled } from "./store.js";
import { installErrorCapture, installReportLinks, guard, renderReports } from "./reports.js";
import { migrateDanceCorrections } from "./corrections.js";
import { checkBadges } from "./badges.js";
import { refreshSeedFiles } from "./seed.js";
import { initCueCards, initVideos } from "./cuecards.js";
import { initCueCheck, renderCueCheck } from "./cuecheck.js";
import { initMemorize } from "./memorize.js";
import { initHowto } from "./howto.js";
import { initStudio } from "./studio.js";
import { initFilm } from "./film.js";
import { initReady } from "./ready.js";
import { initPass } from "./pass.js";
import { initSeason } from "./season15.js";
import { initSunday } from "./sunday.js";

const VERSION_KEY = "spotlight:version";

// Each screen renders inside guard(): one broken screen shows its own error state instead of blanking the app.
const renders = [
  guard("home", renderHome), guard("dances", renderDances), guard("practice", renderPractice), guard("play", renderPlay), guard("me", renderMe),
  guard("events", renderEvents), guard("schedule", () => { renderClasses(); renderCalendar(); }), guard("notes", () => { renderNotes(); renderPhotos(); renderFiles(); }),
  guard("lists", () => { renderTodos(); renderPack(); }), guard("skillcheck", renderSkillCheck), guard("reports", renderReports), guard("reviews", renderReviews), guard("coach", renderCoachHub), guard("grownups", renderGrownups), guard("settings", renderSettings), guard("buddy", renderBuddy), guard("cuecheck", renderCueCheck),
];
function renderAll(){ renders.forEach(r => r()); }
function initViews(){ initNav(); initDances(); initEvents(); initSchedule(); initPractice(); initNotes(); initLists(); initPlay(); initMe(); initSkillCheck(); initSettings(); initGrownups(); initShowMe(); initPlayer(); initStage(); initPracticeMode(); initCoach(); initGoals(); initMirror(); initAlong(); initRunCheck(); initDemos(); initDrills(); initPet(); initAdvent(); initCards(); initNews(); initBuddy(); initCostume(); initGlow(); initCueCards(); initVideos(); initCueCheck(); initMemorize(); initHowto(); initStudio(); initFilm(); initReady(); initPass(); initSeason(); initSunday(); installReportLinks(); }

// Cache-first app shell: a new version installs in the background and is used on the next open.
async function registerSW(){
  if (!("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" });
    // A new version waits until every open copy of the app is gone, which on a Home Screen app can be days. So when one is
    // waiting, show a Reload bar: the tap tells the new worker to take over (SKIP_WAITING) and reloads once it has.
    const offer = (w) => { const bar = $("#updateBar"); if (!bar || !w) return; bar.hidden = false; $("#updateReload").onclick = () => { $("#updateReload").textContent = "…"; w.postMessage({ type: "SKIP_WAITING" }); }; };
    let reloading = false; navigator.serviceWorker.addEventListener("controllerchange", () => { if (reloading) return; reloading = true; location.reload(); });
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener("updatefound", () => { const w = reg.installing; if (!w) return; w.addEventListener("statechange", () => { if (w.state === "installed" && navigator.serviceWorker.controller) offer(reg.waiting || w); }); });
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") reg.update().catch(() => {}); });
  } catch (e) { console.warn("service worker registration failed", e); }
  // The last version seen is per phone (localStorage); private mode or a full phone may refuse it, and that's no reason to stop.
  let seen = null; try { seen = localStorage.getItem(VERSION_KEY); } catch (e) {}
  if (seen && seen !== self.APP_VERSION) toast("Updated ✨ v" + self.APP_VERSION, 3000);
  try { localStorage.setItem(VERSION_KEY, self.APP_VERSION); } catch (e) {}
}

function fatal(msg){ const g = $("#gate"); g.hidden = false; document.body.classList.add("gated"); ["gateHome","gateJoin","gateCreated","gateBusy"].forEach(x => { $("#" + x).hidden = true; }); $("#gateMsg").textContent = msg; $("#gateMsg").style.color = "#FF5C93"; }

(async () => {
  installErrorCapture();
  try {
    registerSW();
    await loadData();
    initViews();
    // Locked Grown-ups pages bounce to the PIN pad (which remembers where to go next).
    setGuard(p => { if (GROWNUP_PAGES.includes(p) && !isUnlocked()) { $("#pinTarget").value = p; $("#pinIn").value = ""; $("#pinMsg").textContent = ""; return "pin"; } return p; });
    let restored = false;
    onChange(() => { renderAll(); buddyAuto(settled("practice") && settled("settings")); if (!restored && settled("practice")) { restored = true; try { restoreTodayChecks(); } catch (e) { console.warn(e); } } migrateDanceCorrections().then(n => { if (n) toast("Your notes moved into the tracker ✓"); }).catch(console.warn); saveSoloFix().catch(console.warn); saveDrillsMove().then(n => { if (n) toast("Your drill box moved to its own shelf ✓"); }).catch(console.warn); saveWorkoutsMove().then(n => { if (n) toast("Your workouts moved to their own shelf ✓"); }).catch(console.warn); refreshSeedFiles().then(names => { if (names.length) toast("New version in My files: " + names.join(", "), 3500); }).catch(console.warn); checkBadges().catch(console.warn); });
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
