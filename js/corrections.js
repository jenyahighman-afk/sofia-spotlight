// Corrections tracker: one record per note {danceId, text, source, date, tag, status}.
// Pure helpers up top (tested in Node); the store-touching functions at the bottom.
import { S, storeSet, setSettings, settled, dances } from "./store.js";
import { DEFAULT_DANCES } from "./data.js";
import { todayStr } from "./util.js";

export const TAGS = ["feet","knees","eyes","arms","timing","spacing","energy","other"];
export const TAG_LABEL = { feet:"Feet", knees:"Knees", eyes:"Eyes", arms:"Arms", timing:"Timing", spacing:"Spacing", energy:"Energy", other:"Other" };
export const TAG_EMOJI = { feet:"🦶", knees:"🦵", eyes:"👀", arms:"💪", timing:"⏱️", spacing:"↔️", energy:"⚡", other:"✨" };

// Which tag a free-text correction belongs to. First match wins; order is the order dancers hear them: feet, knees, eyes, arms.
const RULES = [
  ["feet", /\b(foot|feet|pointed|point (the|your|that|it|them|both)|toe|toes|flex|flexed|relev[eé]|turnout)\b/i],
  ["knees", /\b(knee|knees|straight|straighten|lock|bent)\b/i],
  ["eyes", /\b(eye|eyes|eyeline|eyelines|look|focal|focus|spot|mirror|chin)\b/i],
  ["arms", /\b(arm|arms|elbow|elbows|shoulder|shoulders|reach|hands|fingers)\b/i],
  ["timing", /\b(count|counts|beat|timing|behind|late|early|music|tempo|silence|hold)\b/i],
  ["spacing", /\b(spacing|space|formation|line|lines|match|height|size|agree|travel)\b/i],
  ["energy", /\b(energy|commit|sharp|hit|freeze|full|big|attack|accent|melting)\b/i],
];
export function inferTag(text){ const t = String(text || ""); for (const [tag, re] of RULES) if (re.test(t)) return tag; return "other"; }

// Stable id for a correction copied off a dance card: the same text on the same dance always maps to the same record,
// so the copy can run on both phones (and again after data/dances.json edits) without duplicating anything.
export function hashText(s){ let h = 5381; for (const ch of String(s)) h = ((h * 33) ^ ch.codePointAt(0)) >>> 0; return h.toString(36); }
export const migratedId = (danceId, text) => `c-${danceId}-${hashText(String(text).trim())}`;

// A card line may start with an explicit tag: "#feet Donut roll: chin tucked…". Otherwise the tag is inferred from the words.
const TAG_PREFIX = /^#(feet|knees|eyes|arms|timing|spacing|energy|other)\s+/i;
export function parseLine(line){ const m = TAG_PREFIX.exec(String(line).trim()); const text = String(line).trim().replace(TAG_PREFIX, "").trim(); return { text, tag: m ? m[1].toLowerCase() : inferTag(text), explicit: !!m }; }
// The records the dance-card arrays would produce (pure; used by the runtime copy and the tests).
export function recordsFromDance(dance, date){
  return (dance.corrections || []).map(parseLine).filter(l => l.text).map(({ text, tag, explicit }) => ({ id: migratedId(dance.id, text), danceId: dance.id, text, source: "notes", date, tag, status: "working", explicit }));
}

export const isOpen = (c) => c && !c.deleted && c.status !== "done";
export const isDone = (c) => c && !c.deleted && c.status === "done";
const dateOf = (c) => c.date || (c.at ? String(c.at).slice(0, 10) : "");

export function forDance(corrections, danceId){ return Object.values(corrections || {}).filter(c => !c.deleted && c.danceId === danceId).sort((a, b) => dateOf(b).localeCompare(dateOf(a))); }
export function openFor(corrections, danceId){ return forDance(corrections, danceId).filter(isOpen); }
export function topFixes(corrections, danceId, n = 3){ return openFor(corrections, danceId).slice(0, n); }

// Pattern spotting: tags that came up `min`+ times across all dances in the last `days` days (open or closed — the point is the repetition).
export function patterns(corrections, { today = todayStr(), days = 60, min = 3, danceId = null } = {}){
  const from = shiftDate(today, -days); const counts = {};
  for (const c of Object.values(corrections || {})) {
    if (c.deleted) continue; if (danceId && c.danceId !== danceId) continue;
    const d = dateOf(c); if (!d || d < from || d > today) continue;
    counts[c.tag || "other"] = (counts[c.tag || "other"] || 0) + 1;
  }
  return Object.entries(counts).filter(([, n]) => n >= min).sort((a, b) => b[1] - a[1]).map(([tag, n]) => ({ tag, n }));
}
export function shiftDate(iso, delta){ const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + delta); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }

// The Sunday that starts the week containing `iso` (weeks run Sunday → Saturday, matching the Sunday film review).
export function weekKey(iso){ const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() - d.getDay()); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }

// Exactly one open correction becomes the week's fix: the one whose tag repeats most (60 days), oldest first. Null when nothing is open.
export function chooseWeekFix(corrections, today = todayStr()){
  const open = Object.values(corrections || {}).filter(isOpen); if (!open.length) return null;
  const rank = {}; patterns(corrections, { today, min: 1 }).forEach(p => { rank[p.tag] = p.n; });
  open.sort((a, b) => (rank[b.tag] || 0) - (rank[a.tag] || 0) || dateOf(a).localeCompare(dateOf(b)) || String(a.id).localeCompare(String(b.id)));
  return open[0];
}

// ---------- store-backed ----------
let migrating = false;
// Copy each dance's "Corrections to work on" lines into the collection, once the cloud has told us what's already there.
// Card lines the teacher has since corrected. Their notes are removed (and never re-created from an edited card) so the old advice stops showing.
export const RETIRED_LINES = { solo: ["Donut roll: chin tucked, roll over the shoulder, chest leads"] };
export const retiredIds = () => new Set(Object.entries(RETIRED_LINES).flatMap(([danceId, lines]) => lines.map(t => migratedId(danceId, t))));
export async function migrateDanceCorrections(){
  if (migrating || !settled("corrections") || !settled("dances")) return 0;
  migrating = true; let n = 0;
  try {
    const date = todayStr();
    // Explicit #tags in data/dances.json apply even when the card was edited in-app (the edited copy of the line has no prefix).
    const explicitTags = {}; for (const d of DEFAULT_DANCES) for (const r of recordsFromDance(d, date)) if (r.explicit) explicitTags[r.id] = r.tag;
    // Lines added to data/dances.json after a card was edited in-app would otherwise never be seen (the edited copy of
    // the list wins) — so read both the merged card and the built-in one, de-duplicated by record id.
    const sources = []; const seenIds = new Set();
    for (const d of [...dances(), ...DEFAULT_DANCES]) for (const r of recordsFromDance(d, date)) { if (seenIds.has(r.id)) continue; seenIds.add(r.id); sources.push(r); }
    const retired = retiredIds();
    for (const id of retired) { const old = S.corrections[id]; if (old && !old.deleted && old.source === "notes") await storeSet("corrections", id, { ...old, deleted: true }); }
    for (let { explicit, ...rec } of sources) {
      if (retired.has(rec.id)) continue;
      if (!explicit && explicitTags[rec.id]) { explicit = true; rec = { ...rec, tag: explicitTags[rec.id] }; }
      const have = S.corrections[rec.id];
      if (!have) { await storeSet("corrections", rec.id, rec); n++; continue; }
      // An explicit #tag on the card wins over the tag that was inferred when the line was first copied.
      if (explicit && have.source === "notes" && have.tag !== rec.tag) { await storeSet("corrections", rec.id, { ...have, tag: rec.tag }); }
    }
  } finally { migrating = false; }
  return n;
}
export async function addCorrection({ danceId, text, tag, source }){
  const id = "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const rec = { id, danceId, text: String(text).trim(), tag: TAGS.includes(tag) ? tag : inferTag(text), source: source || "me", date: todayStr(), status: "working" };
  await storeSet("corrections", id, rec); return rec;
}
export async function closeCorrection(id){ const c = S.corrections[id]; if (!c || c.status === "done") return null; await storeSet("corrections", id, { ...c, status: "done", doneAt: todayStr() }); return c; }
export async function reopenCorrection(id){ const c = S.corrections[id]; if (!c) return; await storeSet("corrections", id, { ...c, status: "working", doneAt: "" }); }
export async function removeCorrection(id){ const c = S.corrections[id]; if (!c) return; await storeSet("corrections", id, { ...c, deleted: true }); }

// This week's fix (settings.weekFix = {id, week}). pickWeekFix chooses one when the week has none; the id is what Today shows all week.
export function currentWeekFix(today = todayStr()){ const w = S.settings.weekFix; if (!w || w.week !== weekKey(today)) return null; const c = S.corrections[w.id]; return c && !c.deleted ? c : null; }
export async function pickWeekFix(today = todayStr()){
  const c = chooseWeekFix(S.corrections, today); if (!c) return null;
  await setSettings({ weekFix: { id: c.id, week: weekKey(today), pickedAt: today } }); return c;
}
export const closedCount = (corrections) => Object.values(corrections || {}).filter(isDone).length;
