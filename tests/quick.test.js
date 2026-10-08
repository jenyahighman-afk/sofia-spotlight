// Quick sessions: five minutes of strength or stretching from the practice pools, rotating by day.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installEnv } from "./_env.mjs";
installEnv();
const { buildQuick, quickSecs, quickDone, QUICK } = await import("../js/quick.js");
const { dayCounts } = await import("../js/streak.js");
const { starsFor } = await import("../js/stars.js");

const pool = JSON.parse(readFileSync(new URL("../data/practice-pool.json", import.meta.url), "utf8"));

test("a strength session is a warm-up plus three core/legs items, 4–6 minutes, and rotates by day", () => {
  const a = buildQuick("strength", "2026-10-07", pool), b = buildQuick("strength", "2026-10-08", pool);
  assert.equal(a.length, 4); assert.equal(a[0].kind, "warm"); assert.ok(a.slice(1).every(it => ["core", "legs"].includes(it.kind)));
  assert.ok(a.slice(1).some(it => it.kind === "core") && a.slice(1).some(it => it.kind === "legs"));
  for (const s of [a, b]) { const secs = quickSecs(s); assert.ok(secs >= 240 && secs <= 360, "secs " + secs); assert.ok(s.every(it => it.secs <= 90 || it.kind === "warm")); }
  assert.notDeepEqual(a.map(x => x.id), b.map(x => x.id));
  assert.equal(new Set(a.map(x => x.id)).size, 4);
});
test("a stretch session is a warm-up plus three flexibility items; unknown kinds give nothing", () => {
  const s = buildQuick("flex", "2026-10-07", pool); assert.equal(s.length, 4); assert.ok(s.slice(1).every(it => it.kind === "flex"));
  assert.deepEqual(buildQuick("nope", "2026-10-07", pool), []);
  assert.deepEqual(Object.keys(QUICK), ["strength", "flex"]);
});
test("a finished quick session counts the day for the streak and pays a star", () => {
  assert.equal(dayCounts({ done: [], total: 12, quick: ["flex"] }, 12), true);
  assert.equal(dayCounts({ done: [], total: 12, quick: [] }, 12), false);
  assert.equal(quickDone({ quick: ["strength", "flex", "strength"] }, "strength"), 2); assert.equal(quickDone({}, "flex"), 0);
  assert.equal(starsFor("quick", 100), 1);
});
