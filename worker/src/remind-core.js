// Daily reminder, the pure parts (tested in Node, no imports): what to say, when a subscription is due, request checks.
// A subscription record: { familyId, endpoint, keys: {p256dh, auth}, h, m, tz, lastSent? }.
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
export const dayNumber = (iso) => Math.floor(Date.parse(iso + "T00:00:00Z") / 86400000);
export const lineFor = (iso) => LINES[((dayNumber(iso) % LINES.length) + LINES.length) % LINES.length];
// The local date and minutes-since-midnight of an instant in an IANA time zone.
export function localClock(now, tz){
  let f; try { f = new Intl.DateTimeFormat("en-CA", { timeZone: tz || DEFAULT_TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }); }
  catch (e) { f = new Intl.DateTimeFormat("en-CA", { timeZone: DEFAULT_TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }); }
  const p = Object.fromEntries(f.formatToParts(now).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: ((+p.hour) % 24) * 60 + (+p.minute) };
}
// The local date to stamp when this subscription should fire now, else null: its time has come today (within the window) and nothing was sent today.
export function isDue(sub, now = new Date(), window = WINDOW_MIN){
  const { date, minutes } = localClock(now, sub.tz); const target = (+sub.h || 0) * 60 + (+sub.m || 0);
  return sub.lastSent !== date && minutes >= target && minutes < target + window ? date : null;
}
export function validateSubscribe(body){
  const b = body && typeof body === "object" ? body : {};
  if (!FAMILY_RE.test(String(b.familyId || ""))) return { ok: false, status: 400, error: "A valid familyId is required." };
  const endpoint = String(b.endpoint || ""); if (!/^https:\/\/[^\s]{10,500}$/.test(endpoint)) return { ok: false, status: 400, error: "A push endpoint is required." };
  const keys = b.keys && typeof b.keys === "object" ? b.keys : {}; const p256dh = String(keys.p256dh || ""), auth = String(keys.auth || "");
  if (!/^[A-Za-z0-9_-]{80,120}$/.test(p256dh) || !/^[A-Za-z0-9_-]{16,32}$/.test(auth)) return { ok: false, status: 400, error: "The push keys look wrong." };
  const h = parseInt(b.h, 10), m = parseInt(b.m, 10); if (!(h >= 0 && h <= 23) || !(m >= 0 && m <= 59)) return { ok: false, status: 400, error: "Pick a time." };
  const tz = /^[A-Za-z_]+\/[A-Za-z_\/+-]{2,40}$/.test(String(b.tz || "")) ? String(b.tz) : DEFAULT_TZ;
  return { ok: true, sub: { familyId: b.familyId, endpoint, keys: { p256dh, auth }, h, m, tz } };
}
export const subKey = (endpoint) => "sub:" + endpoint;
export const doneKey = (familyId, date) => `done:${familyId}:${date}`;
export const payloadFor = (sub, date) => { const [title, body] = lineFor(date); return JSON.stringify({ title, body, url: "./", tag: "dance-bite" }); };
