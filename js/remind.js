// Daily reminder ("⏰ My dance time" on Me): a push notification at her time, from this phone's own subscription (iPhone
// needs the app on the Home Screen). The worker sends it (worker/src/remind.js) unless she already danced that day (pingDone).
// 1.60.0 (Jenya, Nov 5: "let her choose when she wants to have a reminder"): it is off until Sofia turns it on and picks the
// time; one nudge a day, on home days only (a class day asks nothing at home), and no last call: the second nudge's time is
// never sent to the worker, and a phone that was subscribed before 1.60.0 is switched off once (OFF160). The stored
// settings.reminder keeps its second / h2 / m2 fields; nothing reads them.
// Pure parts up top (tested in Node).
import { $, esc, toast, expose, todayStr } from "./util.js";
import { S, setSettings } from "./store.js";
import { CLASSES, HOME_DAYS } from "./data.js";
import { dayKindNow } from "./daykind.js";
import { shiftDate } from "./corrections.js";
import { sync } from "./sync.js";
import { coachConfig } from "./firebase-config.js";
import { pushConfig } from "./push-config.js";
import { reminderMsgs } from "./wisdom.js";

// 1.78.0 (Jenya, Nov 14: "pushed reminders for her to log her practice every day and prep for solo and trio"): the reminder
// is every day now. At her dance time: what to do (a home day: solo once, trio once; a class day: class first, one run if
// there's a chance) with the day's dancer's tip (js/wisdom.js). In the evening, at her log time (DEFAULT_LOG): "what did you
// dance today?", silent once something was logged that day (pingLogged). Still opt-in per phone, and still silent on show
// day. The worker must be the 1.78.0 one for the tip, the class-day line and the log reminder (worker/README.md).
export const DEFAULT_LOG = { h: 19, m: 45 };
export const DEFAULT_TIME = { h: 16, m: 30 }, DEFAULT_SECOND = { h: 18, m: 30 };
export const timeParts = (s) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || "").trim()); if (!m) return null; const h = +m[1], mi = +m[2]; return h >= 0 && h <= 23 && mi >= 0 && mi <= 59 ? { h, m: mi } : null; };
export const timeValue = (t) => `${String(t.h).padStart(2, "0")}:${String(t.m).padStart(2, "0")}`;
export const timeLabel = (t) => { const h12 = t.h % 12 || 12; return `${h12}:${String(t.m).padStart(2, "0")} ${t.h < 12 ? "am" : "pm"}`; };
// The family's reminder settings, whole: { on, h, m, second (the evening nudge, on unless turned off), h2, m2 }.
const num = (v, max, d) => Number.isInteger(v) && v >= 0 && v <= max ? v : d;
export const reminderOf = (settings) => { const r = (settings || {}).reminder; const o = r && typeof r === "object" ? r : {}; return { on: !!o.on, h: num(o.h, 23, DEFAULT_TIME.h), m: num(o.m, 59, DEFAULT_TIME.m), second: o.second !== false, h2: num(o.h2, 23, DEFAULT_SECOND.h), m2: num(o.m2, 59, DEFAULT_SECOND.m), log: o.log !== false, lh: num(o.lh, 23, DEFAULT_LOG.h), lm: num(o.lm, 59, DEFAULT_LOG.m) }; };
export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const KIND_ICON = { watch: "📹", memory: "🧠", home: "🏠" };
// The weekdays a nudge goes out on: the home days (data/home-days.json) without a weekly class. { days: [weekday numbers],
// kinds: { weekday: "home" } }. Until 1.60.0 the class days were in too (the watch day, the memory run).
export function planWeekdays(classes = CLASSES, homeDays = HOME_DAYS){
  const kinds = {};
  for (let wd = 0; wd < 7; wd++) if (!(classes || []).some(c => c && c.day === wd) && homeDays && homeDays[wd]) kinds[wd] = "home";
  return { days: Object.keys(kinds).map(Number), kinds };
}
// The dates whose nudge isn't the weekday's usual one, for the next DATE_SPAN days (1.59.0): { "YYYY-MM-DD": "home" | "off" }.
// It is the app's own answer for the day (daykind.dayKind): a studio closure's class day is a home day and gets the nudge; a
// home weekday with a studio date booked, show day and a rest day get none.
export const DATE_SPAN = 150;
export function reminderKind(date, kindOf = dayKindNow){ return kindOf(date) === "home" ? "home" : "off"; }
export function planDates(plan = planWeekdays(), from = todayStr(), span = DATE_SPAN, kindOf = reminderKind){
  const out = {}; for (let i = 0; i < span; i++) { const d = shiftDate(from, i); const k = kindOf(d); if (k !== ((plan.kinds || {})[new Date(d + "T00:00:00").getDay()] || "off")) out[d] = k; } return out;
}
// Every day (1.78.0): a weekday with a weekly class is "studio", any other "home". { days: [0..6], kinds }. Pure.
export function dailyPlan(classes = CLASSES){ const kinds = {}; for (let wd = 0; wd < 7; wd++) kinds[wd] = (classes || []).some(c => c && c.day === wd) ? "studio" : "home"; return { days: [0, 1, 2, 3, 4, 5, 6], kinds }; }
// The app's own answer for a date: show day "off", a home or rest day "home", anything at the studio "studio". Pure given kindOf.
export function dailyKind(date, kindOf = dayKindNow){ const k = kindOf(date); return k === "show" ? "off" : k === "home" || k === "rest" ? "home" : "studio"; }
export const MSG_DAYS = 30;
// "Thu, Fri, Sun": the home days, Monday first.
export function daysLabel({ kinds = {} } = {}){ return Object.keys(kinds).map(Number).sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map(wd => DAY_NAMES[wd]).join(", "); }
// What the worker is told: the time, the home days, the dates that differ. Never a second time (h2 / m2): no last call since 1.60.0.
export function subscribeBody(r, { familyId, endpoint, keys, tz, plan = dailyPlan(), dates = planDates(plan, todayStr(), DATE_SPAN, dailyKind), msgs = reminderMsgs(todayStr(), MSG_DAYS, dailyKind, shiftDate) }){
  const b = { familyId, endpoint, keys, h: r.h, m: r.m, tz, days: plan.days, kinds: plan.kinds }; if (Object.keys(dates).length) b.dates = dates;
  if (r.log !== false && Number.isInteger(r.lh) && Number.isInteger(r.lm)) { b.log = true; b.lh = r.lh; b.lm = r.lm; } // the evening log reminder; never h2 / m2, so a worker older than 1.78.0 sends no "last call"
  if (msgs && Object.keys(msgs).length) b.msgs = msgs; return b;
}
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
  el.innerHTML = `<div class="row"><h3 class="grow">⏰ My dance time</h3>${r.on && here ? `<span class="chip coral">on · ${esc(timeLabel(r))}</span>` : `<span class="chip">off</span>`}</div>
    <p class="small muted">You pick the time. Every day: what to do today, with a dancer's tip. None once you've danced. In the evening: a nudge to log what you danced.</p>
    <div class="row"><input type="time" id="rmTime" value="${timeValue(r)}" step="900" style="max-width:150px" ${block ? "disabled" : ""}>
      ${block ? `<span class="small muted">${esc(block)}</span>` : here ? `<button class="btn sm ghost" onclick="rmOff()">Turn off on this phone</button><button class="btn sm ghost" onclick="rmTest()">Send a test</button>` : `<button class="btn sm coral" onclick="rmOn()">Remind me on this phone</button>`}</div>
    <div class="row rm-log"><span class="small">📝 Log reminder</span><input type="time" data-rm="log" aria-label="Log reminder time" value="${timeValue({ h: r.lh, m: r.lm })}" step="900" style="max-width:150px" ${block ? "disabled" : ""}><label class="small"><input type="checkbox" data-rm="logon" ${r.log ? "checked" : ""} ${block ? "disabled" : ""}> on</label></div>
    <div class="small muted rm-days">Home days: ${esc(daysLabel(pw)) || "none right now"} · class days get an "after class" nudge</div>`;
  const again = () => { if (subscribedHere()) subscribe(reminderOf(S.settings)).catch(e => toast(e.message, 3000)); renderReminder(); };
  const lt = el.querySelector ? el.querySelector('[data-rm="log"]') : null; if (lt) lt.onchange = () => { const p = timeParts(lt.value); if (!p) return; setSettings({ reminder: { ...r, lh: p.h, lm: p.m } }).then(again); };
  const lo = el.querySelector ? el.querySelector('[data-rm="logon"]') : null; if (lo) lo.onchange = () => { setSettings({ reminder: { ...r, log: !!lo.checked } }).then(again); };
  const t = $("#rmTime"); if (t) t.onchange = () => { const p = timeParts(t.value); if (!p) return; setSettings({ reminder: { ...r, ...p } }).then(() => { if (subscribedHere()) subscribe(reminderOf(S.settings)).catch(e => toast(e.message, 3000)); renderReminder(); }); };
}
async function subscribe(r){
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription(); if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToBytes(pushConfig.publicKey) });
  const j = sub.toJSON(); await post("/remind/subscribe", subscribeBody(r, { familyId: sync.familyId, endpoint: j.endpoint, keys: j.keys, tz: tz() }));
  try { localStorage.setItem(LS, j.endpoint); localStorage.setItem(SENT, sentSig(r)); } catch (e) {} return sub;
}
// What this phone last sent the worker: the times, the plan days and the dates that differ. On open, a subscribed phone whose
// times or days changed since (a new default, a migrated time, a new class, a date booked or passed) subscribes again, once per run, quietly.
const SENT = "spotlight:pushsent";
export const sentSig = (r, plan = dailyPlan(), dates = planDates(plan, todayStr(), DATE_SPAN, dailyKind)) => JSON.stringify([r.h, r.m, plan.days, plan.kinds, dates, r.log !== false ? [r.lh, r.lm] : 0, todayStr()]); // today's date is in it: the tips' window moves on, so a subscribed phone sends the next weeks' words once a day
// 1.60.0: a phone subscribed before this version is switched off once, quietly; from then on a reminder exists only if she turns it on.
const OFF160 = "spotlight:remind160";
let resynced = false;
export function resyncReminder(){
  if (resynced) return; resynced = true;
  let seen = "1"; try { seen = localStorage.getItem(OFF160) || ""; localStorage.setItem(OFF160, "1"); } catch (e) {}
  if (!seen && subscribedHere()) { off(true).catch(e => console.warn("reminder off", e)); return; }
  if (!subscribedHere() || !sync.familyId || pushBlocker(env())) return;
  let last = ""; try { last = localStorage.getItem(SENT) || ""; } catch (e) {}
  const r = reminderOf(S.settings); if (!r.on || last === sentSig(r)) return;
  try { if (typeof Notification !== "undefined" && Notification.permission !== "granted") return; } catch (e) { return; }
  subscribe(r).catch(e => console.warn("reminder resync", e));
}
async function on(){
  const block = pushBlocker(env()); if (block) return toast(block, 4000);
  try { const perm = await Notification.requestPermission(); if (perm !== "granted") return toast("Reminders need permission. You can allow them in Settings → Spotlight → Notifications.", 4000);
    const r = reminderOf(S.settings); const p = timeParts(($("#rmTime") || {}).value) || { h: r.h, m: r.m }; const next = { ...r, on: true, h: p.h, m: p.m }; await subscribe(next); await setSettings({ reminder: next }); try { localStorage.setItem(OFF160, "1"); } catch (e) {} toast(`⏰ Reminder set for ${timeLabel(p)}`); renderReminder(); }
  catch (e) { console.warn(e); toast("Couldn't turn reminders on: " + (e.message || e), 4000); }
}
async function off(quiet){
  try { const reg = await navigator.serviceWorker.ready; const sub = await reg.pushManager.getSubscription(); const endpoint = sub ? sub.endpoint : subscribedHere();
    if (sub) await sub.unsubscribe(); if (endpoint) await post("/remind/unsubscribe", { endpoint }).catch(() => {}); } catch (e) { console.warn(e); }
  try { localStorage.removeItem(LS); } catch (e) {}
  await setSettings({ reminder: { ...reminderOf(S.settings), on: false } }); if (quiet !== true) toast("Reminders off on this phone"); renderReminder();
}
async function test(){ try { const reg = await navigator.serviceWorker.ready; await reg.showNotification("Dance time 🎵", { body: "This is what the reminder looks like.", icon: "icons/icon-192.png", badge: "icons/icon-192.png", tag: "dance-bite-test" }); } catch (e) { toast("Couldn't show it: " + (e.message || e), 3000); } }
// Called once she has danced today: tells the worker, so no reminder is sent to the family tonight.
export function pingDone(){ if (!base() || !sync.familyId) return; fetch(base() + "/remind/done", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ familyId: sync.familyId, tz: tz() }), keepalive: true }).catch(() => {}); }
// Called when she logs something (the studio log, ✓ I worked on it, 💪 on a teacher's note, a dance danced to the end): the
// evening log reminder stays quiet today.
export function pingLogged(){ if (!base() || !sync.familyId) return; fetch(base() + "/remind/done", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ familyId: sync.familyId, tz: tz(), what: "log" }), keepalive: true }).catch(() => {}); }
expose({ rmOn: on, rmOff: () => off(), rmTest: test });
