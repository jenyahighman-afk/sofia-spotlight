// Daily reminder, the pure parts (tested in Node, no imports): what to say, when a subscription is due, request checks.
// A subscription record: { familyId, endpoint, keys: {p256dh, auth}, h, m, tz, lastSent?, days?, kinds?, dates?, h2?, m2?, lastSent2? }.
// Build 3 (1.48.0): `days` = the weekdays with a plan (the app's planWeekdays; absent = every day), `kinds` = what kind of
// day each is (watch | memory | home: the line names it), `h2`/`m2` = a second nudge later in the evening, sent only if the
// plan still isn't done (the same done key), stamped in `lastSent2`.
// 1.59.0: `dates` = the exact dates whose plan isn't the weekday's usual one (the app's own answer for the day: a studio closure
// makes a class day a home day, a light week or the night before the show is the memory run, a booked studio date on a home day
// is the memory run, show day is "off": no practice nudge). A date in `dates` wins over `days` and `kinds`.
export const FAMILY_RE = /^[A-Z2-9]{24}$/;
export const DEFAULT_TZ = "America/Los_Angeles";
export const WINDOW_MIN = 20; // a cron that fires a little late still sends; later than this and the moment has passed
// Seven short lines, one per day, never nagging. [title, body]
export const LINES = [
  ["Dance time ✨", "Pick one thing. Two minutes counts."],
  ["Your music is ready 🎵", "One dance, if you feel like it."],
  ["Hey Sofia 💃", "Trick, game or move? You choose."],
  ["Two minutes 🩰", "Open Spotlight and pick one."],
  ["Spotlight time ✿", "A move, a game or a trick. Then you're done."],
  ["Ready? 🎀", "Open the app, tap one card."],
  ["Dance o'clock 🕺", "One little thing. Then free time."],
];
// The line for a kind of plan day (the app's planWeekdays kinds), and the second nudge's lines.
// 1.78.0 (Jenya, Nov 14: "pushed reminders for her to log her practice every day and prep for solo and trio", with a
// dancer's tip for the part of the season she is in): the app now sends every day ("studio" = a class day: class first, one
// dance welcome), the words for the coming days (`msgs`: { date: [title, body] }, the app's own line and tip; the KIND_LINES
// below when a date has none), and an evening log reminder (`log: true` with `lh` / `lm`, kept as the second slot h2 / m2):
// "what did you dance today?", sent every day unless the family already logged something that day (the `logged` key).
export const KINDS = ["watch", "memory", "home", "studio"];
export const DATE_KINDS = [...KINDS, "off"];
// The kind of `date` for this subscription: its own entry in `dates` first, then the weekday's kind.
const dateKind = (sub, date) => { const d = sub && sub.dates; return d && Object.prototype.hasOwnProperty.call(d, date) ? d[date] : ""; };
export const kindOn = (sub, date) => dateKind(sub, date) || ((sub || {}).kinds || {})[weekdayOf(date)];
export const KIND_LINES = {
  watch: ["Watch day 📹", "Hannah's two videos, then the solo in your head."],
  memory: ["Memory run 🧠", "The solo from the top, Lines off, then a little trio."],
  home: ["Dance time 🎵", "Your music is ready. One dance, about 2 minutes ⭐"], // 1.60.0: the button is ▶ My solo, nothing is "first"
  studio: ["Class day 🏫", "After class, got a chance at home? One dance counts ⭐"],
};
// The evening log reminder (slot 2 of a subscription with `log`).
export const LOG_LINES = [
  ["What did you dance today? 📝", "Tap to log it: class, a dance, a skill. Every bit is a stepping stone 🪜"],
  ["Log time 📝", "What did your teacher say today? Put it in your app before you forget."],
  ["Before bed 🌙", "Log today's dancing. Two taps, then sleep."],
];
export const MSG_MAX = 45, MSG_TITLE = 48, MSG_BODY = 170;
const clean = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);
// The last call (6:30 pm since 1.56.0, Jenya Oct 30): start now, so practice is done long before bed.
export const SECOND_LINES = [
  ["Last call ⏰", "Start by 7:00 and you're done long before bed ⭐"],
  ["Last call 🩰", "Solo first, then the trio. Tap ▶ Start."],
  ["Last call 🌙", "Dance now, sleep on time. Sleep saves your steps."],
];
export const dayNumber = (iso) => Math.floor(Date.parse(iso + "T00:00:00Z") / 86400000);
const nth = (list, iso) => list[((dayNumber(iso) % list.length) + list.length) % list.length];
export const lineFor = (iso) => nth(LINES, iso);
export const weekdayOf = (iso) => new Date(iso + "T00:00:00Z").getUTCDay();
// The local date and minutes-since-midnight of an instant in an IANA time zone.
export function localClock(now, tz){
  let f; try { f = new Intl.DateTimeFormat("en-CA", { timeZone: tz || DEFAULT_TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }); }
  catch (e) { f = new Intl.DateTimeFormat("en-CA", { timeZone: DEFAULT_TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }); }
  const p = Object.fromEntries(f.formatToParts(now).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: ((+p.hour) % 24) * 60 + (+p.minute) };
}
// Which nudge is due now, if any: { slot: 1 | 2, date } — 1 = the dance time (stamped in lastSent), 2 = the second nudge
// (h2 / m2, stamped in lastSent2), each within its window, once a local day. A subscription with `days` only fires on those weekdays.
// Build 4: the second nudge goes out on home kinds only — a watch day (Monday: no dancing at home) or a memory-run day (classes
// end at 7:30, the run is about 18 minutes) never gets it, so it doesn't land in the car after three classes. A day without a kind
// (an older subscription) keeps it.
export const secondSlotFor = (kind, sub) => (sub && sub.log) ? true : kind !== "watch" && kind !== "memory";
export function dueSlot(sub, now = new Date(), window = WINDOW_MIN){
  const { date, minutes } = localClock(now, sub.tz); const dk = dateKind(sub, date); if (dk === "off") return null; if (!dk && Array.isArray(sub.days) && sub.days.length && !sub.days.includes(weekdayOf(date))) return null;
  const inWin = (h, m) => { const t = (+h || 0) * 60 + (+m || 0); return minutes >= t && minutes < t + window; };
  if (sub.lastSent !== date && inWin(sub.h, sub.m)) return { slot: 1, date };
  if (Number.isInteger(sub.h2) && Number.isInteger(sub.m2) && sub.lastSent2 !== date && secondSlotFor(kindOn(sub, date), sub) && inWin(sub.h2, sub.m2)) return { slot: 2, date };
  return null;
}
// The local date to stamp when the dance-time nudge should fire now, else null (the first slot of dueSlot).
export function isDue(sub, now = new Date(), window = WINDOW_MIN){ const d = dueSlot(sub, now, window); return d && d.slot === 1 ? d.date : null; }
export function validateSubscribe(body){
  const b = body && typeof body === "object" ? body : {};
  if (!FAMILY_RE.test(String(b.familyId || ""))) return { ok: false, status: 400, error: "A valid familyId is required." };
  const endpoint = String(b.endpoint || ""); if (!/^https:\/\/[^\s]{10,500}$/.test(endpoint)) return { ok: false, status: 400, error: "A push endpoint is required." };
  const keys = b.keys && typeof b.keys === "object" ? b.keys : {}; const p256dh = String(keys.p256dh || ""), auth = String(keys.auth || "");
  if (!/^[A-Za-z0-9_-]{80,120}$/.test(p256dh) || !/^[A-Za-z0-9_-]{16,32}$/.test(auth)) return { ok: false, status: 400, error: "The push keys look wrong." };
  const h = parseInt(b.h, 10), m = parseInt(b.m, 10); if (!(h >= 0 && h <= 23) || !(m >= 0 && m <= 59)) return { ok: false, status: 400, error: "Pick a time." };
  const tz = /^[A-Za-z_]+\/[A-Za-z_\/+-]{2,40}$/.test(String(b.tz || "")) ? String(b.tz) : DEFAULT_TZ;
  const sub = { familyId: b.familyId, endpoint, keys: { p256dh, auth }, h, m, tz };
  const days = Array.isArray(b.days) ? [...new Set(b.days.map(x => parseInt(x, 10)).filter(x => x >= 0 && x <= 6))].sort((a, c) => a - c) : null; if (days && days.length) sub.days = days;
  const kinds = {}; if (b.kinds && typeof b.kinds === "object" && !Array.isArray(b.kinds)) for (const [k, v] of Object.entries(b.kinds)) { const wd = parseInt(k, 10); if (wd >= 0 && wd <= 6 && KINDS.includes(v)) kinds[wd] = v; } if (Object.keys(kinds).length) sub.kinds = kinds;
  const dates = {}; if (b.dates && typeof b.dates === "object" && !Array.isArray(b.dates)) for (const [d, v] of Object.entries(b.dates).slice(0, 200)) if (/^\d{4}-\d{2}-\d{2}$/.test(d) && DATE_KINDS.includes(v)) dates[d] = v; if (Object.keys(dates).length) sub.dates = dates;
  const h2 = parseInt(b.h2, 10), m2 = parseInt(b.m2, 10); if (h2 >= 0 && h2 <= 23 && m2 >= 0 && m2 <= 59) { sub.h2 = h2; sub.m2 = m2; }
  // The evening log reminder takes the second slot (and its own words); a subscription has one or the other.
  const lh = parseInt(b.lh, 10), lm = parseInt(b.lm, 10); if (b.log === true && lh >= 0 && lh <= 23 && lm >= 0 && lm <= 59) { sub.h2 = lh; sub.m2 = lm; sub.log = true; }
  const msgs = {}; if (b.msgs && typeof b.msgs === "object" && !Array.isArray(b.msgs)) for (const [d, v] of Object.entries(b.msgs).slice(0, MSG_MAX)) { if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !Array.isArray(v)) continue; const t = clean(v[0], MSG_TITLE), body = clean(v[1], MSG_BODY); if (t && body) msgs[d] = [t, body]; } if (Object.keys(msgs).length) sub.msgs = msgs;
  return { ok: true, sub };
}
export const subKey = (endpoint) => "sub:" + endpoint;
export const doneKey = (familyId, date) => `done:${familyId}:${date}`;
export const loggedKey = (familyId, date) => `logged:${familyId}:${date}`;
// The key that silences a slot: the plan done for the dance time and the old last call; something logged for the log reminder.
export const quietKey = (sub, date, slot) => slot === 2 && sub && sub.log ? loggedKey(sub.familyId, date) : doneKey(sub.familyId, date);
// Slot 1 says what kind of day it is when the subscription knows (kinds), else the rotating line; slot 2 is the evening nudge (its own tag, so it never replaces the first).
export const payloadFor = (sub, date, slot = 1) => { const kind = kindOn(sub, date); const own = sub && sub.msgs && Array.isArray(sub.msgs[date]) ? sub.msgs[date] : null; const [title, body] = slot === 2 ? nth(sub && sub.log ? LOG_LINES : SECOND_LINES, date) : (own || KIND_LINES[kind] || lineFor(date)); return JSON.stringify({ title, body, url: "./", tag: slot === 2 ? (sub && sub.log ? "dance-log" : "dance-bite-2") : "dance-bite" }); };
