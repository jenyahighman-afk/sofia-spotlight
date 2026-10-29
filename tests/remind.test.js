// Daily reminder: the worker's due logic and request checks (pure), the app's time helpers, schema 24.
import { test } from "node:test";
import assert from "node:assert/strict";
import { LINES, lineFor, localClock, isDue, validateSubscribe, payloadFor, subKey, doneKey, WINDOW_MIN } from "../worker/src/remind-core.js";
import { installEnv } from "./_env.mjs";
installEnv();
const { timeParts, timeValue, timeLabel, reminderOf, urlB64ToBytes, pushBlocker, postError, OLD_WORKER_MSG, DEFAULT_TIME, DEFAULT_SECOND } = await import("../js/remind.js");
const { migrateDoc, SCHEMA_VERSION } = await import("../js/store.js");
const { pushConfig } = await import("../js/push-config.js");
import { readFileSync } from "node:fs";

test("seven short lines, one per day, rotating; the payload names the app and carries the day's line", () => {
  assert.equal(LINES.length, 7); for (const [t, b] of LINES) assert.ok(t.length <= 30 && b.length <= 60, t);
  assert.notEqual(lineFor("2026-10-13")[0], lineFor("2026-10-14")[0]); assert.equal(lineFor("2026-10-13")[0], lineFor("2026-10-20")[0]);
  const p = JSON.parse(payloadFor({ h: 16, m: 30 }, "2026-10-13")); assert.equal(p.title, lineFor("2026-10-13")[0]); assert.equal(p.tag, "dance-bite"); assert.equal(p.url, "./");
  assert.equal(subKey("https://x/y"), "sub:https://x/y"); assert.equal(doneKey("ABCDEFGHJKLMNPQRSTUVWXYZ", "2026-10-13"), "done:ABCDEFGHJKLMNPQRSTUVWXYZ:2026-10-13");
});

test("local clock and due window in Seattle time; once per local day; a bad zone falls back", () => {
  // 2026-10-13 16:32 PDT = 23:32 UTC
  const now = new Date("2026-10-13T23:32:00Z");
  assert.deepEqual(localClock(now, "America/Los_Angeles"), { date: "2026-10-13", minutes: 16 * 60 + 32 });
  assert.equal(localClock(now, "UTC").minutes, 23 * 60 + 32); assert.equal(localClock(now, "Not/AZone").date, "2026-10-13", "falls back to Seattle");
  const sub = { h: 16, m: 30, tz: "America/Los_Angeles" };
  assert.equal(isDue(sub, now), "2026-10-13"); assert.equal(isDue({ ...sub, lastSent: "2026-10-13" }, now), null, "already sent today");
  assert.equal(isDue({ ...sub, lastSent: "2026-10-12" }, now), "2026-10-13", "yesterday's send doesn't block today");
  assert.equal(isDue(sub, new Date("2026-10-13T23:29:00Z")), null, "a minute early");
  assert.equal(isDue(sub, new Date(now.getTime() + (WINDOW_MIN - 3) * 60000)), "2026-10-13", "a late cron inside the window still sends");
  assert.equal(isDue(sub, new Date("2026-10-14T00:00:00Z")), null, "17:00 local: the moment has passed");
  assert.equal(isDue({ h: 0, m: 0, tz: "America/Los_Angeles" }, new Date("2026-10-13T07:05:00Z")), "2026-10-13", "midnight local works");
});

test("subscribe requests need the family id, an https endpoint, plausible keys and a time; the zone is checked", () => {
  const good = { familyId: "ABCDEFGHJKLMNPQRSTUVWXYZ", endpoint: "https://web.push.apple.com/QAbcdefghijklmnop", keys: { p256dh: "B".repeat(87), auth: "a".repeat(22) }, h: "16", m: 30, tz: "America/Los_Angeles" };
  const v = validateSubscribe(good); assert.equal(v.ok, true); assert.deepEqual(v.sub, { familyId: good.familyId, endpoint: good.endpoint, keys: good.keys, h: 16, m: 30, tz: "America/Los_Angeles" });
  assert.equal(validateSubscribe({ ...good, familyId: "nope" }).status, 400); assert.equal(validateSubscribe({ ...good, endpoint: "http://x" }).status, 400);
  assert.equal(validateSubscribe({ ...good, keys: { p256dh: "short", auth: "a".repeat(22) } }).status, 400); assert.equal(validateSubscribe({ ...good, h: 24 }).status, 400);
  assert.equal(validateSubscribe({ ...good, tz: "<script>" }).sub.tz, "America/Los_Angeles"); assert.equal(validateSubscribe(null).ok, false);
});

test("app side: time helpers, settings shape, key decoding, and why reminders can't turn on", () => {
  assert.deepEqual(timeParts("16:30"), { h: 16, m: 30 }); assert.deepEqual(timeParts("7:05"), { h: 7, m: 5 }); assert.equal(timeParts("25:00"), null); assert.equal(timeParts(""), null);
  assert.equal(timeValue({ h: 7, m: 5 }), "07:05"); assert.equal(timeLabel({ h: 16, m: 30 }), "4:30 pm"); assert.equal(timeLabel({ h: 0, m: 0 }), "12:00 am"); assert.equal(timeLabel({ h: 12, m: 15 }), "12:15 pm");
  // Build 3: the second nudge rides along (on unless turned off, 7:30 pm unless set); see tests/build3.test.js for its own checks.
  const sec = { second: true, h2: DEFAULT_SECOND.h, m2: DEFAULT_SECOND.m };
  assert.deepEqual(reminderOf({}), { on: false, ...DEFAULT_TIME, ...sec }); assert.deepEqual(reminderOf({ reminder: { on: true, h: 17, m: 0 } }), { on: true, h: 17, m: 0, ...sec }); assert.deepEqual(reminderOf({ reminder: { on: 1, h: 99 } }), { on: true, h: 16, m: 30, ...sec });
  const bytes = urlB64ToBytes(pushConfig.publicKey); assert.equal(bytes.length, 65); assert.equal(bytes[0], 4, "an uncompressed P-256 point");
  const toml = readFileSync(new URL("../worker/wrangler.toml", import.meta.url), "utf8"); assert.ok(toml.includes(`VAPID_PUBLIC_KEY = "${pushConfig.publicKey}"`), "the worker and the app hold the same public key");
  assert.ok(/\[vars\][\s\S]*VAPID_PUBLIC_KEY[\s\S]*\[triggers\]/.test(toml), "the key sits inside [vars], before the next table");
  assert.equal(pushBlocker({ standalone: true, hasPush: true, hasSw: true, workerUrl: "https://w" }), "");
  assert.match(pushBlocker({ standalone: false, hasPush: true, hasSw: true, workerUrl: "https://w" }), /Home Screen/); assert.match(pushBlocker({ standalone: true, hasPush: false, hasSw: true, workerUrl: "https://w" }), /Add to Home Screen/);
  assert.match(pushBlocker({ standalone: true, hasPush: true, hasSw: true, workerUrl: "" }), /worker/);
  // A worker deployed before the reminder routes answers the subscribe POST as if it were a coach request.
  assert.equal(postError(400, { ok: false, status: 400, error: "No frames. Film or pick a clip or a photo first." }), OLD_WORKER_MSG); assert.match(OLD_WORKER_MSG, /wrangler deploy/);
  assert.equal(postError(404, { error: "Not found" }), OLD_WORKER_MSG);
  assert.equal(postError(503, { error: "Reminders aren't set up on the worker yet (REMIND namespace and VAPID keys)." }), "Reminders aren't set up on the worker yet (REMIND namespace and VAPID keys).");
  assert.equal(postError(400, { error: "A valid familyId is required." }), "A valid familyId is required."); assert.equal(postError(502, {}), "HTTP 502");
  const s = migrateDoc("settings", "main", { _v: 23, reminder: { on: "yes", h: "17", m: 99 } }); assert.deepEqual(s.reminder, { on: true, h: 17, m: 30 }); assert.equal(s._v, SCHEMA_VERSION);
  assert.equal("reminder" in migrateDoc("settings", "main", { _v: 23 }), false);
});
