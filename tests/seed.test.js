// Built-in printables: the manifest knows each file's rev, and a changed rev swaps the family's copy in "My files".
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { installEnv } from "./_env.mjs";
installEnv();
const { planFileRefresh, seedFileId } = await import("../js/seed.js");
const man = JSON.parse(readFileSync(new URL("../seed-data/manifest.json", import.meta.url), "utf8"));

test("every manifest file carries the size and rev of the file on disk (run `node tools/seed-manifest.cjs` after replacing one)", () => {
  for (const f of man.files) {
    const buf = readFileSync(new URL("../" + f.path, import.meta.url));
    assert.equal(f.size, buf.length, f.name + " size"); assert.equal(f.rev, createHash("sha256").update(buf).digest("hex").slice(0, 12), f.name + " rev");
  }
});

test("refresh plan: same rev → nothing; first seeded copy (same size, no rev) → stamp; changed → replace; never re-added", () => {
  const files = [{ name: "A.pdf", rev: "aaa", size: 10 }, { name: "B.pdf", rev: "bbb", size: 20 }, { name: "C.pdf", rev: "ccc", size: 30 }, { name: "Gone.pdf", rev: "ggg", size: 5 }];
  const fam = {
    x1: { name: "A.pdf", size: 10, seedRev: "aaa" },   // already current
    x2: { name: "B.pdf", size: 20 },                   // the seeded copy, never stamped
    x3: { name: "C.pdf", size: 99 },                   // an older version
    x4: { name: "C.pdf", size: 98, seedRev: "old" },   // and another old one with the same name
    x5: { name: "Mine.pdf", size: 1 },                 // the family's own file
  };
  const { stamp, replace } = planFileRefresh(files, fam);
  assert.deepEqual(stamp, [{ id: "x2", rev: "bbb" }]);
  assert.deepEqual(replace, [{ file: files[2], old: ["x3", "x4"] }]);
  assert.deepEqual(planFileRefresh(files, {}), { stamp: [], replace: [] }, "nothing the family doesn't have is added");
  assert.deepEqual(planFileRefresh([{ name: "A.pdf", size: 10 }], { y: { name: "A.pdf", size: 3 } }), { stamp: [], replace: [] }, "an old manifest without revs changes nothing");
  // After a replace the new record has the rev, so the next run does nothing.
  assert.deepEqual(planFileRefresh(files.slice(2, 3), { [seedFileId("ccc")]: { name: "C.pdf", size: 30, seedRev: "ccc" } }), { stamp: [], replace: [] });
});

test("the new Aerial Mission sheet replaces the family's first copy; the unchanged printables are only stamped", () => {
  const aerial = man.files.find(f => f.name === "Sofia-Aerial-Mission-Print.pdf"); assert.ok(aerial);
  const firstSeed = Object.fromEntries(man.files.map((f, i) => [`s${i}`, { name: f.name, size: f.name === aerial.name ? 40205 : f.size }]));
  const { stamp, replace } = planFileRefresh(man.files, firstSeed);
  assert.deepEqual(replace.map(r => r.file.name), [aerial.name]); assert.equal(stamp.length, man.files.length - 1);
});

test("refreshSeedFiles swaps a changed printable once: checks the download, uploads to a new path, removes the old copy", async () => {
  const { receive, setBackend, S } = await import("../js/store.js");
  const { removedPaths } = await import("./_stubs/firebase.mjs");
  const { sync } = await import("../js/sync.js"); sync.familyId = "fam";
  const fresh = new Blob(["new sheet"]), rev = createHash("sha256").update("new sheet").digest("hex").slice(0, 12);
  const manifest = { docs: [], files: [{ name: "Sheet.pdf", path: "files/Sheet.pdf", type: "application/pdf", size: fresh.size, rev }] };
  let serve = new Blob(["the old sheet"]); // a web cache still handing out the old file
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (u) => ({ json: async () => manifest, blob: async () => (String(u).endsWith("Sheet.pdf") ? serve : new Blob([])) });
  const writes = []; setBackend({ set: async (col, id, rec) => { writes.push(["set", col, id, rec]); }, del: async (col, id) => { writes.push(["del", col, id]); } });
  try {
    receive("files", { old1: { name: "Sheet.pdf", size: 13, path: "families/fam/files/old1", url: "u" }, mine: { name: "Mine.pdf", size: 1 } }, { fromCache: false });
    const first = await import("../js/seed.js?stale");
    assert.deepEqual(await first.refreshSeedFiles(), [], "the stale download is not uploaded"); assert.equal(writes.length, 0);
    assert.deepEqual(await first.refreshSeedFiles(), [], "once per app open");
    serve = fresh; const next = await import("../js/seed.js?fresh");
    assert.deepEqual(await next.refreshSeedFiles(), ["Sheet.pdf"]);
    const id = "f-" + rev; assert.equal(S.files[id].seedRev, rev); assert.equal(S.files[id].path, "families/fam/files/" + id); assert.equal(S.files[id].name, "Sheet.pdf");
    assert.equal(S.files.old1, undefined); assert.ok(S.files.mine, "the family's own file is untouched"); assert.deepEqual(removedPaths, ["families/fam/files/old1"]);
  } finally { globalThis.fetch = realFetch; setBackend(null); }
});
