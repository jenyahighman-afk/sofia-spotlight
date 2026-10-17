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
    out.push({ id, name, url, kind, ...(typeof w.at === "string" ? { at: w.at } : {}) }); if (out.length >= MAX) break;
  }
  return out;
}
export const doneToday = (rec, id) => Array.isArray(rec && rec.workouts) && rec.workouts.includes(id);
// What logging a workout writes: the quick session of its kind (counts like a 5-minute button) and the workout id, once a day.
export function logWorkout(rec, w){
  const r = rec || { done: [], note: "", runs: [] }; if (doneToday(r, w.id)) return null;
  return { ...r, quick: [...(Array.isArray(r.quick) ? r.quick : []), w.kind], workouts: [...(Array.isArray(r.workouts) ? r.workouts : []), w.id] };
}
