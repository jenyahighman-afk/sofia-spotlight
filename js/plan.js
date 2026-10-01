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
  for (const slot of pool.slots || []) for (const it of rotate(slot.pool, slot.n, day, slot.kind === "tech" ? prefer : [])) items.push({ ...it, kind: slot.kind });
  // This week's fix, as a drill (kept in the plan all week; the same id all week so a check-off sticks per day).
  if (opts.weekFix && opts.weekFix.text) items.push({ id: "fix-" + opts.weekFix.id, text: "This week's fix: " + opts.weekFix.text, secs: 120, kind: "fix", pose: (pool.fixPoses || {})[opts.weekFix.tag] || "pose", tag: opts.weekFix.tag });
  // One trick drill from the dance cards, rotating daily.
  const tricks = (opts.tricks || []).map(firstSentence).filter(Boolean);
  if (tricks.length) { const t = tricks[day % tricks.length]; items.push({ id: "trick-" + (day % tricks.length), text: "Trick drill: " + t, secs: 120, kind: "trick", pose: /cartwheel/i.test(t) ? "cartwheel" : /walkover|handstand/i.test(t) ? "handstand" : /turn|passé|passe/i.test(t) ? "pirouette" : /kick/i.test(t) ? "kick" : /donut|bridge|back/i.test(t) ? "bridge" : /extension|attitude/i.test(t) ? "develop" : "reach" }); }
  // Aerial mission: unchecked steps from the drill/strength sections, on the weekdays the pool says (home days).
  const nAerial = (pool.aerialByWeekday || {})[String(wd)] || 0;
  if (nAerial) { const done = new Set(opts.aerialDone || []); const open = (opts.aerial || []).filter(a => !done.has(a.id) && a.section !== "In class only");
    const want = wd === 4 ? (a) => a.section === "Strength" : (a) => a.section.startsWith("Drills");
    const picks = rotate(open.filter(want), nAerial, day); if (picks.length < nAerial) picks.push(...rotate(open.filter(a => !want(a) && !picks.includes(a)), nAerial - picks.length, day));
    for (const a of picks) items.push({ id: "aerial-" + a.id, text: "Aerial mission: " + a.text, secs: 90, kind: "aerial", pose: (pool.aerialPoses || {})[a.section] || "cartwheel", aerialId: a.id }); }
  // Runs: only dances that exist (built-in or added) and aren't deleted.
  const have = new Set((opts.dances || []).map(d => d.id));
  for (const r of pool.runs || []) if (!r.dance || have.has(r.dance)) items.push({ ...r, kind: "run" });
  return items;
}
export const planTotal = (items) => items.length;
