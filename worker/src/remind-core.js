// Daily reminder, the pure parts (tested in Node, no imports): what to say, when a subscription is due, request checks.
// A subscription record: { familyId, endpoint, keys: {p256dh, auth}, h, m, tz, lastSent?, days?, kinds?, h2?, m2?, lastSent2? }.
// Build 3 (1.48.0): `days` = the weekdays with a plan (the app's planWeekdays; absent = every day), `kinds` = what kind of
// day each is (watch | memory | home: the line names it), `h2`/`m2` = a second nudge later in the evening, sent only if the
// plan still isn't done (the same done key), stamped in `lastSent2`.
export const FAMILY_RE = /^[A-Z2-9]{24}$/;
export const DEFAULT_TZ = "America/Los_Angeles";
export const WINDOW_MIN = 20; // a cron that fires a little late still sends; later than this and the moment has passed
// Seven short lines, one per day, never nagging. [title, body]
export const LINES = [
  ["Dance bite time ✨", "Pick one card. Two minutes counts."],
  ["Your streak is waiting 🔥", "One bite keeps it. A tired day counts too."],
  ["Hey Sofia 💃", "Trick, game or move? You choose."],
  ["Two minutes 🩰", "Open Spotlight and pick one."],
  ["Spotlight time ✿", "A move, a game or a trick. Then you're done."],
  ["Ready? 🎀", "Open the app, tap one card."],
  ["Dance o'clock 🕺", "One bite. Then free time."],
];
// The line for a kind of plan day (the app's planWeekdays kinds), and the second nudge's lines.
export const KINDS = ["watch", "memory", "home"];
export const KIND_LINES = {
  watch: ["Watch day 📹", "Hannah's two videos, then the solo in your head."],
  memory: ["Memory run 🧠", "The solo from the top, Lines off, then a little trio."],
  home: ["Home practice 🏠", "Tap ▶ Start. Your solo first ⭐"],
};
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
// end at 7:30, the run is 15 minutes) never gets it, so it doesn't land in the car after three classes. A day without a kind
// (an older subscription) keeps it.
export const secondSlotFor = (kind) => kind !== "watch" && kind !== "memory";
export function dueSlot(sub, now = new Date(), window = WINDOW_MIN){
  const { date, minutes } = localClock(now, sub.tz); if (Array.isArray(sub.days) && sub.days.length && !sub.days.includes(weekdayOf(date))) return null;
  const inWin = (h, m) => { const t = (+h || 0) * 60 + (+m || 0); return minutes >= t && minutes < t + window; };
  if (sub.lastSent !== date && inWin(sub.h, sub.m)) return { slot: 1, date };
  if (Number.isInteger(sub.h2) && Number.isInteger(sub.m2) && sub.lastSent2 !== date && secondSlotFor((sub.kinds || {})[weekdayOf(date)]) && inWin(sub.h2, sub.m2)) return { slot: 2, date };
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
  const h2 = parseInt(b.h2, 10), m2 = parseInt(b.m2, 10); if (h2 >= 0 && h2 <= 23 && m2 >= 0 && m2 <= 59) { sub.h2 = h2; sub.m2 = m2; }
  return { ok: true, sub };
}
export const subKey = (endpoint) => "sub:" + endpoint;
export const doneKey = (familyId, date) => `done:${familyId}:${date}`;
// Slot 1 says what kind of day it is when the subscription knows (kinds), else the rotating line; slot 2 is the evening nudge (its own tag, so it never replaces the first).
export const payloadFor = (sub, date, slot = 1) => { const kind = (sub.kinds || {})[weekdayOf(date)]; const [title, body] = slot === 2 ? nth(SECOND_LINES, date) : (KIND_LINES[kind] || lineFor(date)); return JSON.stringify({ title, body, url: "./", tag: slot === 2 ? "dance-bite-2" : "dance-bite" }); };
