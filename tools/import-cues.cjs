// Imports the verified solo cue table into data/dances.json (the solo's `cues`). Source of truth:
//   media/cue-pack/cue-photos/cues.json   (from Sofia-cue-pack.zip; media/ is git-ignored, the photos never enter the repo)
// Run after the pack changes:  node tools/import-cues.cjs
// Each cue: { n, t (start, seconds of TRACK time), end, move (label), trick, photo (file name), pt (photo time) } plus the
// Hannah word cues kept from the previous import (hannahWord; hannahClip is a family upload, never in the repo).
const fs = require("fs"); const path = require("path");
const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "media", "cue-pack", "cue-photos", "cues.json");
const OUT = path.join(ROOT, "data", "dances.json");
const sec = (v) => { if (typeof v === "number") return v; const m = /^(\d+):(\d{1,2}(?:\.\d+)?)$/.exec(String(v).trim()); if (!m) throw new Error("Bad time: " + v); return +m[1] * 60 + +m[2]; };

const pack = JSON.parse(fs.readFileSync(SRC, "utf8"));
const dances = JSON.parse(fs.readFileSync(OUT, "utf8"));
const solo = dances.find(d => d.id === "solo"); if (!solo) throw new Error("No solo in data/dances.json");
const prev = new Map((solo.cues || []).filter(c => c && c.n).map(c => [c.n, c]));
const cues = pack.map(c => {
  const old = prev.get(c.n) || {}; const cue = { n: c.n, t: sec(c.start), end: sec(c.end), move: String(c.label).trim(), trick: !!c.trick, photo: String(c.photo || ""), pt: +c.photo_time || sec(c.start) };
  if (old.hannahWord) cue.hannahWord = old.hannahWord;
  return cue;
}).sort((a, b) => a.t - b.t);
cues.forEach((c, i) => { if (!(c.end > c.t)) throw new Error(`Cue ${c.n} ends before it starts`); if (i && cues[i - 1].end > c.t + 1e-9) throw new Error(`Cue ${cues[i - 1].n} overlaps cue ${c.n}`); });
solo.cues = cues; solo.cueSource = "Hannah run-through, checked Oct 25";
fs.writeFileSync(OUT, JSON.stringify(dances, null, 1) + "\n");
console.log(`data/dances.json: solo cues ${cues.length} (${cues.filter(c => c.trick).length} key tricks)`);
