// In-memory state, schema versioning and migrations, and the read/write API the views use.
// The cloud backend (sync.js) is plugged in with setBackend(); this file stays importable in Node for the tests.
import { normalizeWorkouts } from "./workouts-core.js";
import { DEFAULT_DANCES, DEFAULT_EVENTS } from "./data.js";
import { daysUntil } from "./util.js";
import { packFrames, FDIM } from "./posemath.js";

// Bump this whenever a stored field is renamed, dropped or changes meaning — and add a MIGRATIONS entry for the new number.
// Every stored document carries _v (the schema it was written with). Documents without _v are schema 1 (the original Claude-hosted app).
export const SCHEMA_VERSION = 29;

export const COLLECTIONS = ["dances","events","notes","todos","packs","practice","photos","files","choreo","settings","corrections","skills","badges","reports","reviews","goals","drills"];

// Schema 1 stored practice.done and settings.aerial as positions in the built-in lists.
// These are those lists' orders at schema 1, frozen here so the migration keeps working after data/*.json is edited.
const V1_PRACTICE_IDS = ["warmup","hollow-superman","planks","releves-balance","leg-lifts","splits","passe-balance","pirouettes","kicks","arms-mirror","solo-run","trio-mark"];
const V1_AERIAL_IDS = ["cartwheel-clean","one-hand-far","one-hand-near","dive-cartwheel","roundoff","single-leg-squats","hollow-hold","jump-lunges","long-jump","hurdle-drill","front-leg-drive","fingertip-cartwheels","wedge-cartwheel","teacher-set-order","spotted-attempts","unspotted-mat","twenty-in-a-row"];

export const DEFAULT_PIN = "2027";
// The daily habit "bites" a practice day can hold (js/habit.js) and the tired-day kinds. Frozen here for the migration.
export const BITE_IDS = ["trick", "game", "move", "tired", "memo"]; const TIRED_KINDS = ["stretch", "picture"];
// Schema 25: the drill box (js/drills.js). settings.drills[id] = a saved public post, link only. Hosts frozen here for the migration.
// Schema 27 moves the posts to their own collection (drills/{id}, one document each), so a post Jenya saves can't be
// overwritten by the other phone's next whole-document settings write. normalizeDrill is shared by both steps.
export const DRILL_HOSTS = ["youtube", "instagram", "pinterest", "other"];
export function normalizeDrill(v){
  if (!v || typeof v !== "object" || !/^https?:\/\//i.test(String(v.url || ""))) return null; const str = (x, n) => String(x == null ? "" : x).trim().slice(0, n);
  return { url: str(v.url, 500), host: DRILL_HOSTS.includes(v.host) ? v.host : "other", vid: str(v.vid, 20), skill: str(v.skill, 40), note: str(v.note, 140), do: str(v.do, 140), dont: str(v.dont, 140), ask: !!v.ask, at: str(v.at, 10) };
}
// Schema 26: the two friend slots (js/who.js), frozen here for the migration.
export const FRIEND_SLOTS = ["f1", "f2"];

// Schema 19: the solo's floor section was re-set; a side-sit leg reach replaces the tailbone balance and the 0:18 lunge reach
// cue is gone. These are the new lines, frozen here like the V1 lists so the step keeps working after data/dances.json is edited again.
export const SOLO_V19 = {
  mapHead: "~0:11 drop to the floor & seated fold · ~0:15 side-sit leg reach (leg to the ceiling, arm traces it) · ~0:17 leg fans down, slide out long ·",
  correction: "Point the foot and keep the knee straight on the side-sit leg reach (~0:15) and every floor extension, including on the way down.",
  trick: "Side-sit leg reach (~0:15): sit on one hip, hand on the floor, leg straight up to the ceiling: 4 counts up, hold 2, 4 down, 6 each side. Arm slides up the leg, fingers past the toes. Cue: push the floor, reach the toe; knee stays straight as the leg fans down.",
  cues: [{ t: 11, move: "Drop to the floor & seated fold" }, { t: 15, move: "Side-sit leg reach — leg to the ceiling, arm traces it" }, { t: 17, move: "Leg fans down, slide out long" }],
};
const TAILBONE = /tailbone/i, LUNGE_CUE = /^lunge reach\b/i, LUNGE_STRENGTH = /reach on the lunge/i;
const isLungeCue = (c) => LUNGE_CUE.test(String((c && c.move) || ""));
// True when a stored solo still has old lines step 19 rewrites: the tailbone balance (map, corrections, tricks, cues) or the lunge reach cue.
export const soloHasOldFloor = (doc) => !!doc && ([doc.map, doc.corrections, doc.tricks, doc.cues].some(f => f !== undefined && TAILBONE.test(JSON.stringify(f)))
  || (Array.isArray(doc.cues) && doc.cues.some(isLungeCue)));
// Schema 20: the lunge-reach strength stays on the card. The 1.12.1 build of step 19 dropped it from a stored solo's
// strengths (and saved that back), so step 20 puts it back in its old place when it is missing.
export const SOLO_LUNGE_STRENGTH = "Full-body reach on the lunge (arms past the body)";
export const soloMissingLungeStrength = (doc) => !!doc && Array.isArray(doc.strengths) && doc.strengths.length > 0 && !doc.strengths.some(l => LUNGE_STRENGTH.test(String(l)));
// Swap only the old lines; whatever else the family edited into the stored solo stays as it is.
function fixSoloFloor(doc){
  if (typeof doc.map === "string" && TAILBONE.test(doc.map)) { const i = doc.map.indexOf("~0:34"); doc.map = i >= 0 ? SOLO_V19.mapHead + " " + doc.map.slice(i) : doc.map.split(" · ").map(s => TAILBONE.test(s) ? SOLO_V19.mapHead.replace(/ ·$/, "") : s).join(" · "); }
  if (Array.isArray(doc.corrections)) doc.corrections = doc.corrections.map(l => TAILBONE.test(String(l)) ? SOLO_V19.correction : l);
  if (Array.isArray(doc.tricks)) doc.tricks = doc.tricks.map(l => TAILBONE.test(String(l)) ? SOLO_V19.trick : l);
  if (Array.isArray(doc.cues) && doc.cues.some(c => TAILBONE.test(String((c && c.move) || "")))) {
    doc.cues = doc.cues.flatMap(c => TAILBONE.test(String((c && c.move) || "")) ? SOLO_V19.cues.map((n, i) => ({ t: n.t, lyric: i ? "" : String(c.lyric || ""), move: n.move })) : [c]).sort((a, b) => a.t - b.t);
  }
  if (Array.isArray(doc.cues) && doc.cues.some(isLungeCue)) doc.cues = doc.cues.filter(c => !isLungeCue(c));
  return doc;
}

// MIGRATIONS[n] upgrades one document from schema n-1 to schema n. Each returns the upgraded document.
export const MIGRATIONS = {
  // 1 → 2: positional indices become stable item ids, so editing data/practice-items.json or data/aerial.json can't re-label old check-offs.
  2: (col, id, doc) => {
    const toIds = (arr, ids) => arr.map(x => typeof x === "number" ? ids[x] : x).filter(x => typeof x === "string");
    if (col === "practice" && Array.isArray(doc.done)) doc.done = toIds(doc.done, V1_PRACTICE_IDS);
    if (col === "settings" && Array.isArray(doc.aerial)) doc.aerial = toIds(doc.aerial, V1_AERIAL_IDS);
    return doc;
  },
  // 2 → 3 (kid mode, practice player, corrections tracker, skills & badges):
  //   practice.runs   — "Run it" logs live on the day's practice record ([] when missing)
  //   settings.pin    — Grown-ups PIN (default 2027), settings.pinOn (true)
  //   corrections     — status defaults to "working", tag to "other", source to "notes"; the dance-card arrays are copied into records by corrections.js at runtime
  //   skills          — state defaults to "learning" (a record only exists once the child has touched the skill)
  3: (col, id, doc) => {
    if (col === "practice") { if (!Array.isArray(doc.runs)) doc.runs = []; if (!Array.isArray(doc.done)) doc.done = []; }
    if (col === "settings") { if (typeof doc.pin !== "string") doc.pin = DEFAULT_PIN; if (typeof doc.pinOn !== "boolean") doc.pinOn = true; }
    if (col === "corrections") { if (!doc.status) doc.status = "working"; if (!doc.tag) doc.tag = "other"; if (!doc.source) doc.source = "notes"; }
    if (col === "skills") { if (!doc.state) doc.state = "learning"; }
    return doc;
  },
  // 3 → 4 (cue sheets): dances.cues = [{t (seconds), lyric, move}]. Only normalized when present — a stored dance doc is a
  // partial override of data/dances.json, so defaulting cues to [] would hide the built-in sheet.
  4: (col, id, doc) => {
    if (col === "dances" && doc.cues !== undefined) {
      const toT = (v) => { if (typeof v === "number") return v; const m = /^(\d+):(\d{2})$/.exec(String(v || "").trim()); return m ? +m[1] * 60 + +m[2] : (Number.isFinite(parseFloat(v)) ? parseFloat(v) : null); };
      doc.cues = (Array.isArray(doc.cues) ? doc.cues : []).map(c => ({ t: toT(c && c.t), lyric: String((c && c.lyric) || ""), move: String((c && c.move) || "") })).filter(c => c.t !== null).sort((a, b) => a.t - b.t);
    }
    return doc;
  },
  // 4 → 5 (AI coach, goals): reviews {danceId, trick, kind, date, thumbs[], pose, review{}}; goals {name, unit, target, checkins[]}.
  // photos may carry `goal` (a check-in photo, hidden from the photo grid). Only defaults are filled; nothing is renamed.
  5: (col, id, doc) => {
    if (col === "reviews") { if (!Array.isArray(doc.thumbs)) doc.thumbs = []; if (!doc.review || typeof doc.review !== "object") doc.review = {}; if (!doc.kind) doc.kind = "video"; }
    if (col === "goals") { if (!Array.isArray(doc.checkins)) doc.checkins = []; if (typeof doc.target !== "number") doc.target = +doc.target || 0; if (typeof doc.unit !== "string") doc.unit = ""; }
    return doc;
  },
  // 5 → 6 (daily practice plan): practice.total = how many items that day's plan had (so 60% is judged against the right
  // list). Older days have no total and fall back to the fixed 12-item list they were saved against.
  6: (col, id, doc) => { if (col === "practice" && doc.total !== undefined) { const n = parseInt(doc.total, 10); if (Number.isFinite(n) && n > 0) doc.total = n; else delete doc.total; } return doc; },
  // 6 → 7 (swap / add / skip moves): practice.custom = { swap: {fromId: toId}, add: [ids], drop: [ids] }, normalized when present.
  7: (col, id, doc) => {
    if (col === "practice" && doc.custom !== undefined) {
      const c = doc.custom && typeof doc.custom === "object" ? doc.custom : {};
      const ids = (a) => (Array.isArray(a) ? a : []).map(String).filter(Boolean);
      const swap = {}; for (const [k, v] of Object.entries(c.swap && typeof c.swap === "object" ? c.swap : {})) if (k && typeof v === "string" && v) swap[k] = v;
      doc.custom = { swap, add: ids(c.add), drop: ids(c.drop) };
    }
    return doc;
  },
  // 7 → 8 (demo pictures): settings.demos = { itemId: { kind: photo|video|link, url, photoId?, name, at } }; photos.demo = itemId.
  8: (col, id, doc) => {
    if (col === "settings" && doc.demos !== undefined) {
      const out = {}; for (const [k, v] of Object.entries(doc.demos && typeof doc.demos === "object" ? doc.demos : {})) if (v && typeof v === "object" && typeof v.url === "string" && v.url) out[k] = { kind: ["photo", "video", "link"].includes(v.kind) ? v.kind : "link", url: v.url, photoId: typeof v.photoId === "string" ? v.photoId : "", name: String(v.name || ""), at: String(v.at || "") };
      doc.demos = out;
    }
    return doc;
  },
  // 8 → 9 (stars): settings.stars (total), settings.starLog ({date: {game: plays}}), settings.mirrorBest. Normalized when present.
  9: (col, id, doc) => {
    if (col === "settings") { if (doc.stars !== undefined) { const n = parseInt(doc.stars, 10); doc.stars = Number.isFinite(n) && n > 0 ? n : 0; } if (doc.starLog !== undefined && (!doc.starLog || typeof doc.starLog !== "object")) doc.starLog = {}; }
    return doc;
  },
  // 9 → 10 (Dance Along): choreo docs may be routines — kind "along" with url/path, fps, frames[] (pose features per frame), best.
  10: (col, id, doc) => {
    if (col === "choreo" && doc.kind === "along") { if (!Array.isArray(doc.frames)) doc.frames = []; if (!(doc.fps > 0)) doc.fps = 8; if (typeof doc.best !== "number") doc.best = 0; if (!Array.isArray(doc.seq)) doc.seq = []; if (!doc.style) doc.style = "along"; }
    return doc;
  },
  // 10 → 11 (Coach corner): reviews.fixId = the correction a review's fix became (older reviews are matched by text instead).
  11: (col, id, doc) => { if (col === "reviews") { if (doc.fixId !== undefined && typeof doc.fixId !== "string") delete doc.fixId; if (typeof doc.fixAdded !== "boolean") doc.fixAdded = !!doc.fixAdded; } return doc; },
  // 12: dances.steps — the step order, one short line per step. Normalized when present; never invented.
  12: (col, id, doc) => { if (col === "dances" && doc.steps !== undefined) doc.steps = Array.isArray(doc.steps) ? doc.steps.map(x => String(x == null ? "" : x).trim()).filter(Boolean) : []; return doc; },
  // 13: practice.quick — the quick sessions finished that day, e.g. ["strength", "flex"]. Normalized when present.
  13: (col, id, doc) => { if (col === "practice" && doc.quick !== undefined) doc.quick = Array.isArray(doc.quick) ? doc.quick.filter(k => k === "strength" || k === "flex") : []; return doc; },
  // 14: settings.nmBest — best What's Next? score (0–10). Normalized when present.
  14: (col, id, doc) => { if (col === "settings" && doc.nmBest !== undefined) { const n = parseInt(doc.nmBest, 10); doc.nmBest = Number.isFinite(n) && n > 0 ? Math.min(10, n) : 0; } return doc; },
  // 15 (Trick Quest): skills.quest = { bars: {feet, knees, arms: 0–100}, gems: [dates] }; settings.gold = { skillId: { f: [numbers], at } }. Normalized when present.
  15: (col, id, doc) => {
    if (col === "skills" && doc.quest !== undefined) { const q = doc.quest && typeof doc.quest === "object" ? doc.quest : {}; const bars = {}; for (const k of ["feet", "knees", "arms"]) { const n = parseInt((q.bars || {})[k], 10); bars[k] = Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 70; } doc.quest = { bars, gems: Array.isArray(q.gems) ? q.gems.filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)) : [] }; }
    if (col === "settings" && doc.gold !== undefined) { const g = doc.gold && typeof doc.gold === "object" ? doc.gold : {}; doc.gold = Object.fromEntries(Object.entries(g).filter(([, v]) => v && Array.isArray(v.f))); }
    return doc;
  },
  // 16 (comp mode): settings.mode auto|learn|comp; practice.compDone = comp-day steps ticked, practice.compFeel 1–3. Normalized when present.
  16: (col, id, doc) => {
    if (col === "settings" && doc.mode !== undefined) doc.mode = ["auto", "learn", "comp"].includes(doc.mode) ? doc.mode : "auto";
    if (col === "practice") { if (doc.compDone !== undefined) doc.compDone = Array.isArray(doc.compDone) ? doc.compDone.filter(x => typeof x === "string") : []; if (doc.compFeel !== undefined) { const n = parseInt(doc.compFeel, 10); if (n >= 1 && n <= 3) doc.compFeel = n; else delete doc.compFeel; } }
    return doc;
  },
  // 17 (bites, colors, lines): practice.feel {e, m: 1–3} and practice.level easy|normal|big; settings.palette; settings.prompter boolean. Normalized when present.
  17: (col, id, doc) => {
    if (col === "practice") { if (doc.feel !== undefined) { const f = doc.feel && typeof doc.feel === "object" ? doc.feel : {}; const n = (v) => { const x = parseInt(v, 10); return x >= 1 && x <= 3 ? x : undefined; }; doc.feel = { e: n(f.e), m: n(f.m) }; if (doc.feel.e === undefined) delete doc.feel.e; if (doc.feel.m === undefined) delete doc.feel.m; } if (doc.level !== undefined && !["easy", "normal", "big"].includes(doc.level)) delete doc.level; }
    if (col === "settings") { if (doc.palette !== undefined && typeof doc.palette !== "string") delete doc.palette; if (doc.prompter !== undefined) doc.prompter = !!doc.prompter; }
    return doc;
  },
  // 18 (pre-stage routine): settings.ritual = ordered step ids. Normalized when present.
  18: (col, id, doc) => { if (col === "settings" && doc.ritual !== undefined) doc.ritual = Array.isArray(doc.ritual) ? doc.ritual.filter(x => typeof x === "string") : []; return doc; },
  // 19 (solo floor re-set): a stored solo that still has the tailbone balance gets the side-sit leg reach lines (SOLO_V19);
  // the lunge reach cue is dropped.
  // This one changes content, not just shape, so saveSoloFix() also writes it back to the family's cloud copy once.
  // files.seedRev: which version of a built-in printable this copy is (seed-data/manifest.json rev). Kept when a string.
  19: (col, id, doc) => { if (col === "dances" && id === "solo") fixSoloFloor(doc); if (col === "files" && doc.seedRev !== undefined && typeof doc.seedRev !== "string") delete doc.seedRev; return doc; },
  // 20 (lunge strength stays): a stored solo whose strengths lost the lunge-reach line gets it back as the second line. Written back like 19.
  20: (col, id, doc) => { if (col === "dances" && id === "solo" && soloMissingLungeStrength(doc)) { doc.strengths = [...doc.strengths]; doc.strengths.splice(1, 0, SOLO_LUNGE_STRENGTH); } return doc; },
  // 21 (Dance Along saves): a routine's frames are stored flat (choreo.frames = numbers, choreo.fdim = numbers per frame),
  // because Firestore rejects an array inside an array — which is why every Dance Along clip "disappeared" before 1.12.4.
  // A nested frames list (local cache / backups only) is packed here.
  21: (col, id, doc) => { if (col === "choreo" && doc.kind === "along" && Array.isArray(doc.frames) && !doc.fdim) { doc.frames = packFrames(doc.frames); doc.fdim = FDIM; } return doc; },
  // 22 (daily habit): practice.bites = the bites done that day (one keeps the streak); practice.tired = which tired-day option. Normalized when present.
  22: (col, id, doc) => { if (col === "practice") { if (doc.bites !== undefined) doc.bites = Array.isArray(doc.bites) ? doc.bites.filter(b => BITE_IDS.includes(b)) : []; if (doc.tired !== undefined && !TIRED_KINDS.includes(doc.tired)) delete doc.tired; } return doc; },
  // 23 (moments): photos.moment = a card made in Moments (shown with ✨); settings.momentNudge = "date|kind" of the nudge dismissed today. Normalized when present.
  23: (col, id, doc) => { if (col === "photos" && doc.moment !== undefined) doc.moment = !!doc.moment; if (col === "settings" && doc.momentNudge !== undefined && typeof doc.momentNudge !== "string") delete doc.momentNudge; return doc; },
  // 24 (daily reminder): settings.reminder = { on, h (0–23), m (0–59) }, the family's reminder time. Normalized when present.
  24: (col, id, doc) => { if (col === "settings" && doc.reminder !== undefined) { const r = doc.reminder && typeof doc.reminder === "object" ? doc.reminder : {}; const h = parseInt(r.h, 10), m = parseInt(r.m, 10); doc.reminder = { on: !!r.on, h: h >= 0 && h <= 23 ? h : 16, m: m >= 0 && m <= 59 ? m : 30 }; } return doc; },
  // 25 (drill box): settings.drills = { id: { url, host, vid (YouTube video id), skill (skill or aerial item id), note, do, dont, ask, at } },
  // saved public posts, link only; practice.drills = the posts tried that day (ids). Normalized when present; a post without an http link is dropped.
  25: (col, id, doc) => {
    if (col === "settings" && doc.drills !== undefined) {
      const out = {}; for (const [k, v] of Object.entries(doc.drills && typeof doc.drills === "object" ? doc.drills : {})) { const p = normalizeDrill(v); if (p) out[k] = p; }
      doc.drills = out;
    }
    if (col === "practice" && doc.drills !== undefined) doc.drills = Array.isArray(doc.drills) ? doc.drills.filter(x => typeof x === "string" && x) : [];
    return doc;
  },
  // 26 (dance with a friend, js/who.js): settings.friends = { f1, f2: name } and settings.friendBests = { f1 | f2: { game: best } }.
  // Normalized when present (names ≤ 20 chars, bests whole numbers ≥ 1); Sofia's own bests stay where they were.
  26: (col, id, doc) => {
    if (col === "settings" && doc.friends !== undefined) { const f = doc.friends && typeof doc.friends === "object" ? doc.friends : {}; const out = {}; for (const k of FRIEND_SLOTS) { const n = String(f[k] == null ? "" : f[k]).trim().slice(0, 20); if (n) out[k] = n; } doc.friends = out; }
    if (col === "settings" && doc.friendBests !== undefined) { const fb = doc.friendBests && typeof doc.friendBests === "object" ? doc.friendBests : {}; const out = {}; for (const k of FRIEND_SLOTS) { const b = fb[k] && typeof fb[k] === "object" ? fb[k] : {}; const o = {}; for (const [g, v] of Object.entries(b)) { const n = parseInt(v, 10); if (Number.isFinite(n) && n > 0) o[g] = n; } if (Object.keys(o).length) out[k] = o; } doc.friendBests = out; }
    return doc;
  },
  // 27 (drill box collection): drills/{id} = one saved post, the same shape settings.drills held. A document without an
  // http link is emptied of its fields (the view skips it). The settings-held posts are moved by saveDrillsMove(), not here.
  27: (col, id, doc) => { if (col === "drills") { const p = normalizeDrill(doc); return p ? { ...p, _v: doc._v, _at: doc._at } : { _v: doc._v, _at: doc._at, deleted: true }; } return doc; },
  // 28 (1.19.0): Memorize it. settings.memo[danceId] = { known: [chunk names], tested: { [chunk]: [dates] } };
  // practice.memo = { [danceId]: [step ids] }; "memo" joins the bite kinds. Normalized when present, never invented.
  28: (col, id, doc) => {
    const strs = (a, max) => Array.isArray(a) ? [...new Set(a.filter(x => typeof x === "string" && x.trim()).map(x => x.trim().slice(0, 60)))].slice(0, max) : [];
    if (col === "settings" && doc.memo !== undefined) { const out = {}; for (const [k, v] of Object.entries(doc.memo && typeof doc.memo === "object" ? doc.memo : {})) { if (!v || typeof v !== "object") continue; const tested = {}; for (const [n, days] of Object.entries(v.tested && typeof v.tested === "object" ? v.tested : {})) { const ds = strs(days, 10).filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x)).sort(); if (ds.length) tested[n.slice(0, 60)] = ds; } out[k] = { known: strs(v.known, 20), tested }; } doc.memo = out; }
    if (col === "practice" && doc.memo !== undefined) { const out = {}; for (const [k, v] of Object.entries(doc.memo && typeof doc.memo === "object" ? doc.memo : {})) { const st = strs(v, 8).filter(x => ["story", "mark", "count", "test", "picture"].includes(x)); if (st.length) out[k] = st; } doc.memo = out; }
    return doc;
  },
  // 29 (1.20.0): My workouts. settings.workouts = [{ id, name, url, kind, at }] (links to core / flexibility videos);
  // practice.workouts = [ids logged that day]. Normalized when present.
  29: (col, id, doc) => {
    if (col === "settings" && doc.workouts !== undefined) doc.workouts = normalizeWorkouts(doc.workouts);
    if (col === "practice" && doc.workouts !== undefined) doc.workouts = Array.isArray(doc.workouts) ? [...new Set(doc.workouts.filter(x => typeof x === "string" && x.trim()).map(x => x.trim().slice(0, 40)))].slice(0, 20) : [];
    return doc;
  }
};

export function docVersion(doc){ return doc && Number.isInteger(doc._v) && doc._v >= 1 ? doc._v : 1; }

// Upgrade a document to SCHEMA_VERSION, one step at a time. Always run on read and on import; never trust a stored version blindly.
export function migrateDoc(col, id, doc){
  let v = docVersion(doc); let d = { ...doc };
  while (v < SCHEMA_VERSION) { v++; const step = MIGRATIONS[v]; if (step) d = step(col, id, d) || d; d._v = v; }
  return d;
}
export function migrateCollection(col, docs){ const out = {}; for (const [id, doc] of Object.entries(docs || {})) out[id] = migrateDoc(col, id, doc); return out; }

// ---------- STATE ----------
export const S = { dances:{}, events:{}, notes:{}, todos:{}, packs:{}, practice:{}, photos:{}, files:{}, choreo:{}, settings:{}, corrections:{}, skills:{}, badges:{}, reports:{}, reviews:{}, goals:{}, drills:{} };
// Which collections the backend has delivered at least once, and whether that delivery was confirmed by the server (not just the local cache).
export const received = { any: new Set(), server: new Set() };

// Firestore rejects undefined values; JSON round-trip drops them (and turns Dates into strings).
const clean = (x) => JSON.parse(JSON.stringify(x));

let backend = null;              // { set(col,id,data), del(col,id) }
const changeListeners = new Set();
let renderTimer = null;
export function setBackend(b){ backend = b; }
export function onChange(fn){ changeListeners.add(fn); return () => changeListeners.delete(fn); }
function notify(){ clearTimeout(renderTimer); renderTimer = setTimeout(() => changeListeners.forEach(fn => { try { fn(); } catch (e) { console.error(e); } }), 30); }

// Called by the backend with the full current contents of one collection ({id: doc}). meta.fromCache tells whether the server has confirmed it.
export function receive(col, docs, meta = {}){
  if (col === "dances") { const raw = docs && docs.solo, v = docVersion(raw); soloStale = !!raw && ((v < 19 && soloHasOldFloor(raw)) || (v < 20 && soloMissingLungeStrength(raw))); }
  const migrated = migrateCollection(col, docs);
  if (col === "settings") S.settings = migrated.main || {}; else S[col] = migrated;
  received.any.add(col); if (meta.fromCache === false) received.server.add(col);
  notify();
}
// True once a collection can be trusted for "create if missing" decisions: confirmed by the server, or we're offline and the cache is all there is.
export function settled(col){ return received.server.has(col) || (received.any.has(col) && typeof navigator !== "undefined" && navigator.onLine === false); }

// Writes land in memory first (so the UI updates even with no signal), then go to the backend, which confirms via receive().
// opts.preserveTime keeps the record's own _at (imports and seeds), otherwise the write is stamped now.
export async function storeSet(col, id, data, opts = {}){
  const rec = clean({ ...data, _v: SCHEMA_VERSION, _at: opts.preserveTime && typeof data._at === "number" ? data._at : Date.now() });
  if (col === "settings") { if (id === "main") S.settings = rec; } else S[col] = { ...S[col], [id]: rec };
  notify();
  if (backend) await backend.set(col, id, rec);
}
export async function storeDel(col, id){
  if (col === "settings") { if (id === "main") S.settings = {}; } else { const o = { ...S[col] }; delete o[id]; S[col] = o; }
  notify();
  if (backend) await backend.del(col, id);
}
// The cloud half of steps 19 and 20. receive() flags a stored solo below schema 19 with old lines, or below 20 without the
// lunge strength; once the server has confirmed the dances, the migrated copy is saved back, so the Firestore doc itself
// changes. After that save its _v is current and it is never flagged again. Two phones doing it at once write the same thing.
let soloStale = false;
export async function saveSoloFix(){
  if (!soloStale || !settled("dances") || !S.dances.solo) return false;
  soloStale = false; await storeSet("dances", "solo", S.dances.solo); return true;
}
// The cloud half of schema 27: posts still held in settings.drills (saved by 1.16 / 1.17) become drills/{id} documents once
// both collections are server-confirmed, and the field is dropped from settings. Each post is written only if the
// collection doesn't already have it, so two phones doing it at once write the same thing. Returns how many moved.
export async function saveDrillsMove(){
  const held = S.settings.drills; if (!held || typeof held !== "object" || !settled("settings") || !settled("drills")) return 0;
  let n = 0; for (const [id, p] of Object.entries(held)) { if (S.drills[id]) continue; const post = normalizeDrill(p); if (!post) continue; await storeSet("drills", id, post); n++; }
  const rest = { ...S.settings }; delete rest.drills; await storeSet("settings", "main", rest); return n;
}
// Settings is one document; this merges a few keys into it.
export function setSettings(patch){ return storeSet("settings", "main", { ...S.settings, ...patch }); }

// Timestamp used for "newer wins" merges (backup import): write time, else the record's own `at`, else 0.
export function docTime(doc){ if (!doc) return 0; if (typeof doc._at === "number") return doc._at; const t = Date.parse(doc.at || ""); return Number.isFinite(t) ? t : 0; }

// ---------- MERGED MODELS ----------
export function dances(){ const merged={}; DEFAULT_DANCES.forEach(d=>merged[d.id]={...d}); Object.entries(S.dances).forEach(([id,d])=>merged[id]={...(merged[id]||{}),...d}); return Object.values(merged).filter(d=>!d.deleted); }
export function events(){ const merged={}; DEFAULT_EVENTS.forEach(e=>merged[e.id]={...e}); Object.entries(S.events).forEach(([id,e])=>merged[id]={...(merged[id]||{}),...e}); return Object.values(merged).filter(e=>!e.deleted).sort((a,b)=>a.start.localeCompare(b.start)); }
export function nextEvent(){ return events().find(e=>daysUntil(e.end)>=0); }
export function pin(){ return typeof S.settings.pin === "string" && S.settings.pin ? S.settings.pin : DEFAULT_PIN; }
export function pinOn(){ return S.settings.pinOn !== false; }
