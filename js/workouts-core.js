// Pure helpers for My workouts (js/workouts.js), kept apart so js/store.js can use them in migration 29 without a cycle.
export const KINDS = { strength: { ic: "💪", n: "Core / strength" }, flex: { ic: "🧘", n: "Flexibility" } };
export const MAX = 8;
export const hostName = (url) => { try { return new URL(url).hostname.replace(/^www\./, "").split(".")[0].replace(/^\w/, c => c.toUpperCase()); } catch (e) { return "Video"; } };
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
// A clean list from whatever is stored: http links only, short names, a known kind, unique ids, at most MAX.
export function normalizeWorkouts(list){
  const out = []; const seen = new Set();
  for (const w of Array.isArray(list) ? list : []) {
    if (!w || typeof w !== "object") continue; const url = String(w.url || "").trim(); if (!/^https?:\/\/\S+$/i.test(url) || url.length > 500) continue;
    const id = String(w.id || "").trim() || newId(); if (seen.has(id)) continue; seen.add(id);
    const name = String(w.name || "").trim().slice(0, 40) || hostName(url); const kind = w.kind in KINDS ? w.kind : "strength";
    const n = Math.max(0, Math.min(60, Math.round(+w.n || 0))), mins = Math.max(0, Math.min(120, Math.round(+w.mins || 0)));
    out.push({ id, name, url, kind, ...(n ? { n } : {}), ...(mins ? { mins } : {}), ...(typeof w.at === "string" ? { at: w.at } : {}) }); if (out.length >= MAX) break;
  }
  return out;
}
// One collection document (workouts/{id}): the same shape, cleaned; null when it isn't a usable link.
export function normalizeWorkout(doc, id){ const w = normalizeWorkouts([{ ...(doc || {}), id: id || (doc && doc.id) }])[0]; return w || null; }
// The family's list from the collection, oldest first, deleted ones left out.
export function workoutList(col){ return Object.entries(col || {}).filter(([, w]) => w && !w.deleted).map(([id, w]) => normalizeWorkout(w, id)).filter(Boolean).sort((a, b) => String(a.at || "").localeCompare(String(b.at || ""))).slice(0, MAX); }
export const doneToday = (rec, id) => Array.isArray(rec && rec.workouts) && rec.workouts.includes(id);
// What logging a workout writes: the quick session of its kind (counts like a 5-minute button) and the workout id, once a day.
export function logWorkout(rec, w){
  const r = rec || { done: [], note: "", runs: [] }; if (doneToday(r, w.id)) return null;
  return { ...r, quick: [...(Array.isArray(r.quick) ? r.quick : []), w.kind], workouts: [...(Array.isArray(r.workouts) ? r.workouts : []), w.id] };
}
// How many days this workout was logged (practice[date].workouts), and which workout of a program is next: the count
// loops through the program's n workouts (the site has no per-workout links, so Sofia picks workout N on the program page).
export function progressOf(practice, id){ let n = 0; for (const rec of Object.values(practice || {})) if (Array.isArray(rec && rec.workouts) && rec.workouts.includes(id)) n++; return n; }
export function nextOf(w, practice){ if (!w || !w.n) return 0; return (progressOf(practice, w.id) % w.n) + 1; }
// Presets (data/workout-presets.json) the family hasn't added yet: matched by name, case-insensitive.
export function presetsLeft(presets, list){ const have = new Set((list || []).map(w => String(w.name || "").trim().toLowerCase())); return (presets && Array.isArray(presets.programs) ? presets.programs : []).filter(p => p && p.name && p.url && !have.has(String(p.name).trim().toLowerCase())); }
