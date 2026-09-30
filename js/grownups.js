// Grown-ups area: PIN gate (PIN in settings, default 2027, can be switched off) + the hub that links to every text-heavy screen.
import { $, esc, toast, expose } from "./util.js";
import { S, pin, pinOn, setSettings } from "./store.js";
import { showPage } from "./nav.js";

const UNLOCK_KEY = "spotlight:grownups";
const UNLOCK_MS = 20 * 60 * 1000; // stay unlocked for 20 minutes
export const isUnlocked = () => { if (!pinOn()) return true; const t = +(sessionStorage.getItem(UNLOCK_KEY) || 0); return Date.now() - t < UNLOCK_MS; };
export function lockGrownups(){ sessionStorage.removeItem(UNLOCK_KEY); }

// Every page that lives behind the gate. showPage() sends any of these back through the gate when locked.
export const GROWNUP_PAGES = ["grownups","events","schedule","lists","notes","reviews","reports","settings","skillcheck"];

export function openGrownups(page = "grownups"){
  if (isUnlocked()) return showPage(page);
  $("#pinTarget").value = page; $("#pinIn").value = ""; $("#pinMsg").textContent = ""; showPage("pin"); setTimeout(() => $("#pinIn").focus(), 50);
}
function tryPin(){
  const v = $("#pinIn").value.trim();
  if (v !== pin()) { $("#pinMsg").textContent = "That's not it. Ask a grown-up."; $("#pinIn").value = ""; return; }
  sessionStorage.setItem(UNLOCK_KEY, String(Date.now())); showPage($("#pinTarget").value || "grownups");
}
async function changePin(){
  const cur = prompt("Current PIN"); if (cur === null) return; if (cur.trim() !== pin()) return toast("Wrong PIN");
  const next = prompt("New PIN (4–8 digits)"); if (next === null) return; if (!/^\d{4,8}$/.test(next.trim())) return toast("Use 4 to 8 digits");
  await setSettings({ pin: next.trim(), pinOn: true }); toast("PIN changed");
}
async function togglePin(){
  if (pinOn()) { const cur = prompt("PIN to switch the lock off"); if (cur === null) return; if (cur.trim() !== pin()) return toast("Wrong PIN"); await setSettings({ pinOn: false }); toast("Grown-ups is open without a PIN"); }
  else { await setSettings({ pinOn: true }); lockGrownups(); toast("PIN lock is on"); }
  renderGrownups();
}
export function renderGrownups(){
  const el = $("#pinState"); if (el) el.textContent = pinOn() ? `PIN lock on (PIN ${"•".repeat(pin().length)})` : "PIN lock off";
  const b = $("#pinToggle"); if (b) b.textContent = pinOn() ? "Turn PIN off" : "Turn PIN on";
}
export function initGrownups(){
  $("#pinGo").onclick = tryPin; $("#pinIn").addEventListener("keydown", e => { if (e.key === "Enter") tryPin(); });
  $("#pinBack").onclick = () => showPage("me");
  $("#pinChange").onclick = changePin; $("#pinToggle").onclick = togglePin;
  $("#grownupsLock").onclick = () => { lockGrownups(); showPage("me"); toast("Locked"); };
}
expose({ openGrownups });
