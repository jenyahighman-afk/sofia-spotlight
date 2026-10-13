// Daily reminder ("⏰ My dance time" on Me): one push notification a day at her time, from this phone's own subscription
// (iPhone needs the app on the Home Screen). The worker sends it (worker/src/remind.js) unless a bite was already done
// that day: markBite pings /remind/done. Pure parts up top (tested in Node).
import { $, esc, toast, expose, todayStr } from "./util.js";
import { S, setSettings } from "./store.js";
import { sync } from "./sync.js";
import { coachConfig } from "./firebase-config.js";
import { pushConfig } from "./push-config.js";

export const DEFAULT_TIME = { h: 16, m: 30 };
export const timeParts = (s) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || "").trim()); if (!m) return null; const h = +m[1], mi = +m[2]; return h >= 0 && h <= 23 && mi >= 0 && mi <= 59 ? { h, m: mi } : null; };
export const timeValue = (t) => `${String(t.h).padStart(2, "0")}:${String(t.m).padStart(2, "0")}`;
export const timeLabel = (t) => { const h12 = t.h % 12 || 12; return `${h12}:${String(t.m).padStart(2, "0")} ${t.h < 12 ? "am" : "pm"}`; };
export const reminderOf = (settings) => { const r = (settings || {}).reminder; return r && typeof r === "object" ? { on: !!r.on, h: r.h >= 0 && r.h <= 23 ? r.h : DEFAULT_TIME.h, m: r.m >= 0 && r.m <= 59 ? r.m : DEFAULT_TIME.m } : { on: false, ...DEFAULT_TIME }; };
export function urlB64ToBytes(b64){ const pad = "=".repeat((4 - b64.length % 4) % 4); const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(raw, c => c.charCodeAt(0)); }
// Why reminders can't be turned on here, or "" when they can.
export function pushBlocker({ standalone, hasPush, hasSw, workerUrl }){
  if (!workerUrl) return "The reminder worker isn't set up yet.";
  if (!hasSw || !hasPush) return "This phone's browser can't do reminders. On iPhone: add Spotlight to the Home Screen (Share → Add to Home Screen) and open it from there.";
  if (!standalone) return "Open Spotlight from its Home Screen icon to turn reminders on (Share → Add to Home Screen if it isn't there yet).";
  return "";
}

const LS = "spotlight:push"; // this phone's subscription endpoint
const base = () => String(coachConfig.url || "").replace(/\/$/, "");
const tz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Los_Angeles"; } catch (e) { return "America/Los_Angeles"; } };
async function post(path, body){ const r = await fetch(base() + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || ("HTTP " + r.status)); return j; }
const env = () => ({ standalone: !!(navigator.standalone || (window.matchMedia && matchMedia("(display-mode: standalone)").matches)), hasPush: "PushManager" in window && "Notification" in window, hasSw: "serviceWorker" in navigator, workerUrl: base() });
const subscribedHere = () => { try { return localStorage.getItem(LS) || ""; } catch (e) { return ""; } };

export function renderReminder(){
  const el = $("#meReminder"); if (!el) return; const r = reminderOf(S.settings); const here = !!subscribedHere(); const block = pushBlocker(env());
  el.innerHTML = `<div class="row"><h3 class="grow">⏰ My dance time</h3>${r.on ? `<span class="chip coral">on · ${esc(timeLabel(r))}</span>` : `<span class="chip">off</span>`}</div>
    <p class="small muted">One little nudge a day, from the app, not from Mom. It stays quiet on days a bite is already done.</p>
    <div class="row"><input type="time" id="rmTime" value="${timeValue(r)}" step="900" style="max-width:150px" ${block ? "disabled" : ""}>
      ${block ? `<span class="small muted">${esc(block)}</span>` : here ? `<button class="btn sm ghost" onclick="rmOff()">Turn off on this phone</button><button class="btn sm ghost" onclick="rmTest()">Send a test</button>` : `<button class="btn sm coral" onclick="rmOn()">Remind me on this phone</button>`}</div>
    ${r.on && !here && !block ? `<p class="small muted">Reminders are on for the family. Tap the button to get them on this phone too.</p>` : ""}`;
  const t = $("#rmTime"); if (t) t.onchange = () => { const p = timeParts(t.value); if (!p) return; setSettings({ reminder: { ...r, ...p } }).then(() => { if (subscribedHere()) subscribe(p).catch(e => toast(e.message, 3000)); renderReminder(); }); };
}
async function subscribe(t){
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription(); if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToBytes(pushConfig.publicKey) });
  const j = sub.toJSON(); await post("/remind/subscribe", { familyId: sync.familyId, endpoint: j.endpoint, keys: j.keys, h: t.h, m: t.m, tz: tz() });
  try { localStorage.setItem(LS, j.endpoint); } catch (e) {} return sub;
}
async function on(){
  const block = pushBlocker(env()); if (block) return toast(block, 4000);
  try { const perm = await Notification.requestPermission(); if (perm !== "granted") return toast("Reminders need permission. You can allow them in Settings → Spotlight → Notifications.", 4000);
    const r = reminderOf(S.settings); const p = timeParts(($("#rmTime") || {}).value) || { h: r.h, m: r.m }; await subscribe(p); await setSettings({ reminder: { on: true, h: p.h, m: p.m } }); toast(`⏰ Reminder set for ${timeLabel(p)}`); renderReminder(); }
  catch (e) { console.warn(e); toast("Couldn't turn reminders on: " + (e.message || e), 4000); }
}
async function off(){
  try { const reg = await navigator.serviceWorker.ready; const sub = await reg.pushManager.getSubscription(); const endpoint = sub ? sub.endpoint : subscribedHere();
    if (sub) await sub.unsubscribe(); if (endpoint) await post("/remind/unsubscribe", { endpoint }).catch(() => {}); } catch (e) { console.warn(e); }
  try { localStorage.removeItem(LS); } catch (e) {}
  await setSettings({ reminder: { ...reminderOf(S.settings), on: false } }); toast("Reminders off on this phone"); renderReminder();
}
async function test(){ try { const reg = await navigator.serviceWorker.ready; await reg.showNotification("Dance bite time ✨", { body: "This is what the reminder looks like.", icon: "icons/icon-192.png", badge: "icons/icon-192.png", tag: "dance-bite-test" }); } catch (e) { toast("Couldn't show it: " + (e.message || e), 3000); } }
// Called when a bite is marked: tells the worker today is done, so no reminder is sent to the family tonight.
export function pingDone(){ if (!base() || !sync.familyId) return; fetch(base() + "/remind/done", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ familyId: sync.familyId, tz: tz() }), keepalive: true }).catch(() => {}); }
expose({ rmOn: on, rmOff: off, rmTest: test });
