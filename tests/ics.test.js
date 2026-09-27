// The .ics export: recurring classes + all-day season events.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildICS, parseTimeRange } from "../js/ics.js";

const read = (f) => JSON.parse(readFileSync(new URL("../data/" + f + ".json", import.meta.url), "utf8"));

test("class times: afternoon hours are PM, late-morning ones are AM", () => {
  assert.deepEqual(parseTimeRange("4:30–5:30"), [[16, 30], [17, 30]]);
  assert.deepEqual(parseTimeRange("11:00–12:15"), [[11, 0], [12, 15]]);
  assert.deepEqual(parseTimeRange("10:00-11:00"), [[10, 0], [11, 0]]);
  assert.equal(parseTimeRange("tba"), null);
});

test("builds a calendar with one recurring event per class and one all-day event per season event", () => {
  const classes = read("classes"), events = read("events"), season = read("season");
  const ics = buildICS({ classes, events, season, now: new Date("2026-09-26T12:00:00Z") });
  assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\n"));
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, classes.length + events.length);
  assert.ok(ics.includes("RRULE:FREQ=WEEKLY;BYDAY=MO;UNTIL=20270620T235959Z"));
  assert.ok(ics.includes("DTSTART;TZID=America/Los_Angeles:20260928T163000")); // first Monday on/after Sep 25 2026, 4:30 PM
  assert.ok(ics.includes("DTSTART;VALUE=DATE:20270108") && ics.includes("DTEND;VALUE=DATE:20270111")); // Winter Formal Jan 8–10 → exclusive end Jan 11
  assert.ok(ics.includes("SUMMARY:Hollywood Connection"));
  assert.ok(ics.includes("BEGIN:VTIMEZONE"));
  for (const line of ics.split("\r\n")) assert.ok(line.length <= 75, "line too long: " + line.slice(0, 40));
});
