// The daily practice plan (pure; tested in Node). Built from data/practice-pool.json so the exercises rotate day to day,
// plus items that come from the dances: this week's fix as a drill, technique picks that match her open-correction tags,
// one trick drill from the solo card, aerial-mission steps on home days, and the runs.
const DAY_MS = 86400000;
export const dayNumber = (iso) => Math.floor(new Date(iso + "T00:00:00").getTime() / DAY_MS);
export const weekday = (iso) => new Date(iso + "T00:00:00").getDay();

// Rotate `n` picks out of `pool` for a given day: consecutive days move through the pool so nothing repeats until it has to.
export function rotate(pool, n, day, prefer = []){
  if (!pool.length || n <= 0) return [];
  const start = (day * n) % pool.length; const order = [...pool.slice(start), ...pool.slice(0, start)];
  if (prefer.length) { const score = (it) => (it.tags || []).reduce((a, t) => a + (prefer.includes(t) ? 2 : 0), 0); order.sort((a, b) => score(b) - score(a)); }
  const out = []; for (const it of order) { if (!out.some(x => x.id === it.id)) out.push(it); if (out.length >= n) break; }
  return out;
}
const firstSentence = (s) => String(s || "").split(/(?<=[.!?])\s/)[0].slice(0, 110).trim();

// opts: { pool, date, preferTags, weekFix: {id,text,tag}|null, tricks: [string], aerial: [{id,section,text}], aerialDone: Set|array, dances: [{id,...}] }
export function buildPlan(opts){
  const { pool, date } = opts; const day = dayNumber(date); const wd = weekday(date); const items = [];
  const prefer = opts.preferTags || [];
  const comp = opts.mode === "comp"; // comp week: one core, one legs, no trick drills or aerial missions — clean runs instead
  for (const slot of pool.slots || []) for (const it of rotate(slot.pool, comp && (slot.kind === "core" || slot.kind === "legs") ? Math.min(1, slot.n) : slot.n, day, slot.kind === "tech" ? prefer : [])) items.push({ ...it, kind: slot.kind });
  // This week's fix, as a drill (kept in the plan all week; the same id all week so a check-off sticks per day).
  if (opts.weekFix && opts.weekFix.text) items.push({ id: "fix-" + opts.weekFix.id, text: "This week's fix: " + opts.weekFix.text, secs: 120, kind: "fix", pose: (pool.fixPoses || {})[opts.weekFix.tag] || "pose", tag: opts.weekFix.tag });
  // One trick drill from the dance cards, rotating daily.
  const tricks = (opts.tricks || []).map(firstSentence).filter(Boolean);
  if (tricks.length && !comp) { const t = tricks[day % tricks.length]; items.push({ id: "trick-" + (day % tricks.length), text: "Trick drill: " + t, secs: 120, kind: "trick", pose: /calypso/i.test(t) ? "calypso" : /scorpion|needle/i.test(t) ? "arab" : /cartwheel/i.test(t) ? "cartwheel" : /walkover|handstand/i.test(t) ? "handstand" : /turn|passé|passe/i.test(t) ? "pirouette" : /kick/i.test(t) ? "kick" : /donut|bridge|back/i.test(t) ? "bridge" : /extension|attitude/i.test(t) ? "develop" : "reach" }); }
  // Aerial mission: unchecked steps from the drill/strength sections, on the weekdays the pool says (home days).
  const nAerial = (pool.aerialByWeekday || {})[String(wd)] || 0;
  if (nAerial && !comp) { const done = new Set(opts.aerialDone || []); const open = (opts.aerial || []).filter(a => !done.has(a.id) && a.section !== "In class only");
    const want = wd === 4 ? (a) => a.section === "Strength" : (a) => a.section.startsWith("Drills");
    const picks = rotate(open.filter(want), nAerial, day); if (picks.length < nAerial) picks.push(...rotate(open.filter(a => !want(a) && !picks.includes(a)), nAerial - picks.length, day));
    for (const a of picks) items.push({ id: "aerial-" + a.id, text: "Aerial mission: " + a.text, secs: 90, kind: "aerial", pose: (pool.aerialPoses || {})[a.section] || "cartwheel", aerialId: a.id }); }
  // Runs: only dances that exist (built-in or added) and aren't deleted.
  const have = new Set((opts.dances || []).map(d => d.id));
  for (const r of pool.runs || []) if (!r.dance || have.has(r.dance)) items.push({ ...r, kind: "run" });
  return items;
}
export const planTotal = (items) => items.length;

// Per-day customisation stored on the practice record: custom = { swap: {fromId: toId}, add: [ids], drop: [ids] }.
// Swaps and adds only take items from the same pool kind; unknown ids are ignored so stale data can't break the plan.
export function poolItems(pool, kind){ const slot = (pool.slots || []).find(s => s.kind === kind); return slot ? slot.pool.map(it => ({ ...it, kind })) : []; }
export function applyCustom(items, pool, custom){
  if (!custom || typeof custom !== "object") return items;
  const swap = custom.swap || {}, add = Array.isArray(custom.add) ? custom.add : [], drop = new Set(Array.isArray(custom.drop) ? custom.drop : []);
  const find = (id, kind) => (pool.slots || []).flatMap(s => s.kind === kind ? s.pool.map(it => ({ ...it, kind })) : []).find(it => it.id === id);
  let out = items.map(it => { const to = swap[it.id]; if (!to) return it; const rep = find(to, it.kind); return rep || it; }).filter(it => !drop.has(it.id));
  for (const id of add) { if (out.some(it => it.id === id)) continue; const kind = (pool.slots || []).find(s => s.pool.some(it => it.id === id)); if (kind) out.push({ ...kind.pool.find(it => it.id === id), kind: kind.kind, added: true }); }
  // keep pool items grouped by kind in the slot order, custom additions after their group, dance items after
  const order = (pool.slots || []).map(s => s.kind); const rank = (it) => { const i = order.indexOf(it.kind); return i < 0 ? 100 : i; };
  return out.map((it, i) => ({ it, i })).sort((a, b) => rank(a.it) - rank(b.it) || a.i - b.i).map(x => x.it);
}
