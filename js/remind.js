// Daily reminder ("⏰ My dance time" on Me): a push notification at her time, from this phone's own subscription (iPhone
// needs the app on the Home Screen). The worker sends it (worker/src/remind.js) unless the plan was already done that
// day (pingDone). Build 3: the nudge follows the plan's days — every weekday with a plan (a home day, Monday's watch day,
// the memory-run studio days: planWeekdays) with a line for that kind of day — and a second nudge later in the evening
// (settings.reminder.second / h2 / m2, on unless turned off, schema 50) goes out only if the plan still isn't done.
// Pure parts up top (tested in Node).
import { $, esc, toast, expose, todayStr } from "./util.js";
import { S, setSettings } from "./store.js";
import { CLASSES, HOME_DAYS, PLAN15 } from "./data.js";
import { sync } from "./sync.js";
import { coachConfig } from "./firebase-config.js";
import { pushConfig } from "./push-config.js";

export const DEFAULT_TIME = { h: 16, m: 30 }, DEFAULT_SECOND = { h: 19, m: 30 };
export const timeParts = (s) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || "").trim()); if (!m) return null; const h = +m[1], mi = +m[2]; return h >= 0 && h <= 23 && mi >= 0 && mi <= 59 ? { h, m: mi } : null; };
export const timeValue = (t) => `${String(t.h).padStart(2, "0")}:${String(t.m).padStart(2, "0")}`;
export const timeLabel = (t) => { const h12 = t.h % 12 || 12; return `${h12}:${String(t.m).padStart(2, "0")} ${t.h < 12 ? "am" : "pm"}`; };
// The family's reminder settings, whole: { on, h, m, second (the evening nudge, on unless turned off), h2, m2 }.
const num = (v, max, d) => Number.isInteger(v) && v >= 0 && v <= max ? v : d;
export const reminderOf = (settings) => { const r = (settings || {}).reminder; const o = r && typeof r === "object" ? r : {}; return { on: !!o.on, h: num(o.h, 23, DEFAULT_TIME.h), m: num(o.m, 59, DEFAULT_TIME.m), second: o.second !== false, h2: num(o.h2, 23, DEFAULT_SECOND.h), m2: num(o.m2, 59, DEFAULT_SECOND.m) }; };
export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const KIND_ICON = { watch: "📹", memory: "🧠", home: "🏠" };
// The weekdays a nudge makes sense on — every day with a plan: a studio day (Monday = the watch day, plan15 rules.studioDays;
// the memory run otherwise) or a home day (data/home-days.json). { days: [weekday numbers], kinds: { weekday: "watch" | "memory" | "home" } }.
export function planWeekdays(classes = CLASSES, homeDays = HOME_DAYS, plan = PLAN15){
  const kinds = {}; const sd = ((plan || {}).rules || {}).studioDays || {};
  for (let wd = 0; wd < 7; wd++) { if ((classes || []).some(c => c && c.day === wd)) kinds[wd] = sd[String(wd)] === "watch" ? "watch" : "memory"; else if (homeDays && homeDays[wd]) kinds[wd] = "home"; }
  return { days: Object.keys(kinds).map(Number), kinds };
}
// "📹 Mon · 🧠 Tue, Wed, Sat · 🏠 Sun, Thu, Fri"
export function daysLabel({ kinds = {} } = {}){ const by = {}; for (const [wd, k] of Object.entries(kinds)) (by[k] ||= []).push(DAY_NAMES[+wd]); return ["watch", "memory", "home"].filter(k => by[k]).map(k => `${KIND_ICON[k]} ${by[k].join(", ")}`).join(" · "); }
// What the worker is told: the time, the plan days with their kinds, and the second nudge's time when it is on.
export function subscribeBody(r, { familyId, endpoint, keys, tz, plan = planWeekdays() }){ const b = { familyId, endpoint, keys, h: r.h, m: r.m, tz, days: plan.days, kinds: plan.kinds }; if (r.second) { b.h2 = r.h2; b.m2 = r.m2; } return b; }
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
// What to tell the family when the worker says no. A worker deployed before the reminder routes existed treats every
// POST as a coach request and answers with the coach's "No frames" error, so that case gets a message about deploying.
export const OLD_WORKER_MSG = "The server-side worker is older than the app, so it doesn't know about reminders yet. In worker/, run: npx wrangler deploy (see worker/README.md), then tap again.";
export function postError(status, j){ const e = String((j || {}).error || ""); if (!e) return "HTTP " + status; if (status === 400 && /frames/i.test(e)) return OLD_WORKER_MSG; if (status === 404) return OLD_WORKER_MSG; return e; }
async function post(path, body){ const r = await fetch(base() + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(postError(r.status, j)); return j; }
const env = () => ({ standalone: !!(navigator.standalone || (window.matchMedia && matchMedia("(display-mode: standalone)").matches)), hasPush: "PushManager" in window && "Notification" in window, hasSw: "serviceWorker" in navigator, workerUrl: base() });
const subscribedHere = () => { try { return localStorage.getItem(LS) || ""; } catch (e) { return ""; } };

export function renderReminder(){
  const el = $("#meReminder"); if (!el) return; const r = reminderOf(S.settings); const here = !!subscribedHere(); const block = pushBlocker(env()); const pw = planWeekdays();
  el.innerHTML = `<div class="row"><h3 class="grow">⏰ My dance time</h3>${r.on ? `<span class="chip coral">on · ${esc(timeLabel(r))}</span>` : `<span class="chip">off</span>`}</div>
    <p class="small muted">One little nudge on plan days, from the app, not from Mom. It stays quiet once the plan is done.</p>
    <div class="row"><input type="time" id="rmTime" value="${timeValue(r)}" step="900" style="max-width:150px" ${block ? "disabled" : ""}>
      ${block ? `<span class="small muted">${esc(block)}</span>` : here ? `<button class="btn sm ghost" onclick="rmOff()">Turn off on this phone</button><button class="btn sm ghost" onclick="rmTest()">Send a test</button>` : `<button class="btn sm coral" onclick="rmOn()">Remind me on this phone</button>`}</div>
    <div class="small muted rm-days">Plan days: ${esc(daysLabel(pw)) || "none right now"}</div>
    <div class="rm-second"><div class="row"><span class="grow">🌙 A second nudge at <b>${esc(timeLabel({ h: r.h2, m: r.m2 }))}</b> if the plan isn't done yet</span><button class="btn sm ${r.second ? "coral" : "ghost"}" onclick="rmSecond()">${r.second ? "On" : "Off"}</button></div>
      ${r.second ? `<div class="row" style="margin-top:6px"><input type="time" id="rmTime2" value="${timeValue({ h: r.h2, m: r.m2 })}" step="900" style="max-width:150px" ${block ? "disabled" : ""}><span class="small muted">Never more than two a day.</span></div>` : ""}</div>
    ${r.on && !here && !block ? `<p class="small muted">Reminders are on for the family. Tap the button to get them on this phone too.</p>` : ""}`;
  const t = $("#rmTime"); if (t) t.onchange = () => { const p = timeParts(t.value); if (!p) return; setSettings({ reminder: { ...r, ...p } }).then(() => { if (subscribedHere()) subscribe(reminderOf(S.settings)).catch(e => toast(e.message, 3000)); renderReminder(); }); };
  const t2 = $("#rmTime2"); if (t2) t2.onchange = () => { const p = timeParts(t2.value); if (!p) return; setSettings({ reminder: { ...r, h2: p.h, m2: p.m } }).then(() => { if (subscribedHere()) subscribe(reminderOf(S.settings)).catch(e => toast(e.message, 3000)); renderReminder(); }); };
}
// The second nudge on or off (the family setting); this phone's subscription follows right away.
async function second(){ const r = reminderOf(S.settings); await setSettings({ reminder: { ...r, second: !r.second } }); if (subscribedHere()) subscribe(reminderOf(S.settings)).catch(e => toast(e.message, 3000)); toast(r.second ? "Second nudge off" : "Second nudge on 🌙"); renderReminder(); }
async function subscribe(r){
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription(); if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToBytes(pushConfig.publicKey) });
  const j = sub.toJSON(); await post("/remind/subscribe", subscribeBody(r, { familyId: sync.familyId, endpoint: j.endpoint, keys: j.keys, tz: tz() }));
  try { localStorage.setItem(LS, j.endpoint); } catch (e) {} return sub;
}
async function on(){
  const block = pushBlocker(env()); if (block) return toast(block, 4000);
  try { const perm = await Notification.requestPermission(); if (perm !== "granted") return toast("Reminders need permission. You can allow them in Settings → Spotlight → Notifications.", 4000);
    const r = reminderOf(S.settings); const p = timeParts(($("#rmTime") || {}).value) || { h: r.h, m: r.m }; const next = { ...r, on: true, h: p.h, m: p.m }; await subscribe(next); await setSettings({ reminder: next }); toast(`⏰ Reminder set for ${timeLabel(p)}`); renderReminder(); }
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
expose({ rmOn: on, rmOff: off, rmTest: test, rmSecond: second });
