// In-memory state, schema versioning and migrations, and the read/write API the views use.
// The cloud backend (sync.js) is plugged in with setBackend(); this file stays importable in Node for the tests.
import { DEFAULT_DANCES, DEFAULT_EVENTS } from "./data.js";
import { daysUntil } from "./util.js";

// Bump this whenever a stored field is renamed, dropped or changes meaning — and add a MIGRATIONS entry for the new number.
// Every stored document carries _v (the schema it was written with). Documents without _v are schema 1 (the original Claude-hosted app).
export const SCHEMA_VERSION = 2;

export const COLLECTIONS = ["dances","events","notes","todos","packs","practice","photos","files","choreo","settings"];

// Schema 1 stored practice.done and settings.aerial as positions in the built-in lists.
// These are those lists' orders at schema 1, frozen here so the migration keeps working after data/*.json is edited.
const V1_PRACTICE_IDS = ["warmup","hollow-superman","planks","releves-balance","leg-lifts","splits","passe-balance","pirouettes","kicks","arms-mirror","solo-run","trio-mark"];
const V1_AERIAL_IDS = ["cartwheel-clean","one-hand-far","one-hand-near","dive-cartwheel","roundoff","single-leg-squats","hollow-hold","jump-lunges","long-jump","hurdle-drill","front-leg-drive","fingertip-cartwheels","wedge-cartwheel","teacher-set-order","spotted-attempts","unspotted-mat","twenty-in-a-row"];

// MIGRATIONS[n] upgrades one document from schema n-1 to schema n. Each returns the upgraded document.
export const MIGRATIONS = {
  // 1 → 2: positional indices become stable item ids, so editing data/practice-items.json or data/aerial.json can't re-label old check-offs.
  2: (col, id, doc) => {
    const toIds = (arr, ids) => arr.map(x => typeof x === "number" ? ids[x] : x).filter(x => typeof x === "string");
    if (col === "practice" && Array.isArray(doc.done)) doc.done = toIds(doc.done, V1_PRACTICE_IDS);
    if (col === "settings" && Array.isArray(doc.aerial)) doc.aerial = toIds(doc.aerial, V1_AERIAL_IDS);
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
export const S = { dances:{}, events:{}, notes:{}, todos:{}, packs:{}, practice:{}, photos:{}, files:{}, choreo:{}, settings:{} };

// Firestore rejects undefined values; JSON round-trip drops them (and turns Dates into strings).
const clean = (x) => JSON.parse(JSON.stringify(x));

let backend = null;              // { set(col,id,data), del(col,id) }
const changeListeners = new Set();
let renderTimer = null;
export function setBackend(b){ backend = b; }
export function onChange(fn){ changeListeners.add(fn); return () => changeListeners.delete(fn); }
function notify(){ clearTimeout(renderTimer); renderTimer = setTimeout(() => changeListeners.forEach(fn => { try { fn(); } catch (e) { console.error(e); } }), 30); }

// Called by the backend with the full current contents of one collection ({id: doc}).
export function receive(col, docs){
  const migrated = migrateCollection(col, docs);
  if (col === "settings") S.settings = migrated.main || {}; else S[col] = migrated;
  notify();
}

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

// Timestamp used for "newer wins" merges (backup import): write time, else the record's own `at`, else 0.
export function docTime(doc){ if (!doc) return 0; if (typeof doc._at === "number") return doc._at; const t = Date.parse(doc.at || ""); return Number.isFinite(t) ? t : 0; }

// ---------- MERGED MODELS ----------
export function dances(){ const merged={}; DEFAULT_DANCES.forEach(d=>merged[d.id]={...d}); Object.entries(S.dances).forEach(([id,d])=>merged[id]={...(merged[id]||{}),...d}); return Object.values(merged).filter(d=>!d.deleted); }
export function events(){ const merged={}; DEFAULT_EVENTS.forEach(e=>merged[e.id]={...e}); Object.entries(S.events).forEach(([id,e])=>merged[id]={...(merged[id]||{}),...e}); return Object.values(merged).filter(e=>!e.deleted).sort((a,b)=>a.start.localeCompare(b.start)); }
export function nextEvent(){ return events().find(e=>daysUntil(e.end)>=0); }
