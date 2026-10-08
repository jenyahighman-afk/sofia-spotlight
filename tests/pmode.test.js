// Practice mode: next-item logic and the progress pose.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installEnv } from "./_env.mjs";
installEnv();
const { applyData } = await import("../js/data.js");
const got = {}; for (const f of ["dances","events","classes","home-days","practice-items","phases","packs","aerial","season","styles","moves","avatar-options","oops","trio","compday","sparkle","skills","practice-pool","exercises","daily"]) got[f] = JSON.parse(readFileSync(new URL("../data/" + f + ".json", import.meta.url), "utf8")); applyData(got);
const { nextIndex, progressPose, framesFor } = await import("../js/pmode.js");
const items = got["practice-items"];

test("next item: first unchecked at or after the cursor, wrapping, -1 when all done", () => {
  assert.equal(nextIndex(items, [], 0), 0);
  assert.equal(nextIndex(items, [items[0].id, items[1].id], 0), 2);
  assert.equal(nextIndex(items, [items[0].id], 5), 5);
  assert.equal(nextIndex(items, items.slice(1).map(i => i.id), 3), 0, "wraps to the one left behind");
  assert.equal(nextIndex(items, items.map(i => i.id), 0), -1);
});
test("every practice item has a timer length and the dancer rises with progress", () => {
  for (const it of items) assert.ok(it.secs > 0, it.id + " needs secs");
  const a = progressPose(0), b = progressPose(100);
  assert.ok(b.hl[1] < a.hl[1] && b.hr[1] < a.hr[1], "hands go up");
  assert.ok(b.lift > a.lift, "relevé at 100%");
  assert.equal(progressPose(50).lift, 4);
});

test("practice-mode pictures: every pool pose resolves to keyframes with the full joint set", () => {
  const pool = JSON.parse(readFileSync(new URL("../data/practice-pool.json", import.meta.url), "utf8"));
  const joints = ["h","sl","sr","el","er","hl","hr","kl","kr","fl","fr","rot","lift"];
  for (const slot of pool.slots) for (const it of slot.pool) { const f = framesFor(it.pose); assert.ok(f && f.length, it.id); for (const kf of f) for (const j of joints) assert.ok(j in kf, it.id + " " + j); }
  assert.equal(framesFor("nope"), null);
});
