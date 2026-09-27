// Builds an iCalendar file: weekly studio classes (recurring through the season) + season events (all-day). Pure; tested in tests/ics.test.js.
const DAY = ["SU","MO","TU","WE","TH","FR","SA"];
const pad = (n) => String(n).padStart(2, "0");
const escText = (s) => String(s ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
// RFC 5545 lines are folded at 75 octets; fold at 70 characters to stay safely under with multibyte text.
const fold = (line) => { const out = []; let s = line; while (s.length > 70) { out.push(s.slice(0, 70)); s = " " + s.slice(70); } out.push(s); return out.join("\r\n"); };

// "4:30–5:30" / "11:00–12:15" → [[16,30],[17,30]]. Classes run in the afternoon except late-morning Saturday ones: hours 1–8 are PM.
export function parseTimeRange(t){
  const m = /^(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})$/.exec(String(t).trim());
  if (!m) return null;
  const toH = (h) => { h = +h; return h >= 1 && h <= 8 ? h + 12 : h; };
  return [[toH(m[1]), +m[2]], [toH(m[3]), +m[4]]];
}
function firstOnOrAfter(startISO, weekday){ const d = new Date(startISO + "T00:00:00"); while (d.getDay() !== weekday) d.setDate(d.getDate() + 1); return d; }
const dt = (d, h, mi) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(h)}${pad(mi)}00`;
const dateOnly = (iso) => iso.replace(/-/g, "");
// All-day DTEND is exclusive, so the day after the last day.
const plusOneDay = (iso) => { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + 1); return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`; };

export function buildICS({ classes, events, season, now = new Date() }){
  const tz = season.timezone || "America/Los_Angeles";
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Sofia's Spotlight//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:Sofia's Spotlight " + (season.name || ""), "X-WR-TIMEZONE:" + tz,
    // Pacific time definition so every calendar app agrees on class times.
    "BEGIN:VTIMEZONE", "TZID:" + tz, "BEGIN:DAYLIGHT", "TZOFFSETFROM:-0800", "TZOFFSETTO:-0700", "TZNAME:PDT", "DTSTART:19700308T020000", "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU", "END:DAYLIGHT", "BEGIN:STANDARD", "TZOFFSETFROM:-0700", "TZOFFSETTO:-0800", "TZNAME:PST", "DTSTART:19701101T020000", "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU", "END:STANDARD", "END:VTIMEZONE"];
  const untilUTC = dateOnly(season.end) + "T235959Z";
  classes.forEach((c, i) => {
    const range = parseTimeRange(c.t); if (!range) return;
    const d = firstOnOrAfter(season.start, c.day);
    L.push("BEGIN:VEVENT", `UID:class-${i}-${c.day}@sofia-spotlight`, `DTSTAMP:${stamp}`, `DTSTART;TZID=${tz}:${dt(d, range[0][0], range[0][1])}`, `DTEND;TZID=${tz}:${dt(d, range[1][0], range[1][1])}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${DAY[c.day]};UNTIL=${untilUTC}`, `SUMMARY:${escText(c.name)}`, `LOCATION:${escText((c.room ? c.room + ", " : "") + (season.studio || "") + (season.address ? ", " + season.address : ""))}`, "END:VEVENT");
  });
  events.forEach(e => {
    if (!e.start) return;
    const desc = [e.type, e.dances && "Dances: " + e.dances, e.cost && "Cost: " + e.cost, e.charge && "Auto-charge: " + e.charge, e.hotel && "Hotel: " + e.hotel, e.notes].filter(Boolean).join("\n");
    L.push("BEGIN:VEVENT", `UID:event-${e.id}@sofia-spotlight`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${dateOnly(e.start)}`, `DTEND;VALUE=DATE:${plusOneDay(e.end || e.start)}`, `SUMMARY:${escText(e.name)}`);
    if (desc) L.push(`DESCRIPTION:${escText(desc)}`);
    if (e.venue) L.push(`LOCATION:${escText(e.venue)}`);
    if (e.link) L.push(`URL:${e.link}`);
    L.push("END:VEVENT");
  });
  L.push("END:VCALENDAR");
  return L.map(fold).join("\r\n") + "\r\n";
}
