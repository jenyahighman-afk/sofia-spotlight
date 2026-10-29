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

// A studio class or rehearsal day: the short version, a 15-minute memory run (the toolkit's rule).
export const MEMORY_RUN = [
  { id: "mem-warm", text: "Warm up 3 min: jumping jacks, arm circles, leg swings", secs: 180, pose: "jacks", kind: "warm" },
  { id: "mem-top", text: "15-minute memory run · From the top: the solo as far as you know, with the music, Lines off", secs: 300, pose: "hold", kind: "run" },
  { id: "mem-chunk", text: "This week's chunk: Again, Next, From the top (🧠 Memorize → Chunks)", secs: 240, pose: "reach", kind: "run" },
  { id: "mem-predict", text: "Pause & Predict with a grown-up: what comes next?", secs: 180, pose: "pose", kind: "run" },
  { id: "mem-picture", text: "Picture it: eyes closed, the whole solo in your head, counts and all", secs: 60, pose: "hold", kind: "run" },
];
// Monday (three classes, plan15.json rules.studioDays): no dancing at home. Hannah's two videos, then the solo with eyes
// closed in the car. The videos are one tap away from the item (pmode.js toolsFor).
export const WATCH_DAY = [
  { id: "watch-walk", text: "Watch Hannah's walkthrough: arms, feet, head, where she looks", secs: 240, pose: "hold", kind: "watch" },
  { id: "watch-run", text: "Watch Hannah's run-through once, saying the counts out loud", secs: 150, pose: "hold", kind: "watch" },
  { id: "watch-picture", text: "In the car: eyes closed, dance the whole solo in your head, counts and all", secs: 120, pose: "hollow", kind: "mind" },
];
export const KNEE_DRILL = { id: "knees-block", text: "Memory + knees: pliés in 1st and 2nd facing the mirror 2×8, knees over toes · slow lunges 2×5 each side · relevés. Tricks wait until the solo is memorized.", secs: 300, kind: "trick", pose: "plie" };
// opts: { pool, date, preferTags, weekFix: {id,text,tag}|null, tricks: [string], aerial: [{id,section,text}], aerialDone: Set|array, dances: [{id,...}],
//   session: season15.sessionRules(date) (imagery, clips, review, run, taper), newNotes: [{id, text, source, tag}] (a teacher's notes from the last 7 days),
//   short: true | "memory" on a studio day, a light week or the night before the show (MEMORY_RUN only; nightBefore: no full-out), "watch" on a Monday (WATCH_DAY),
//   focus: "knees" (KNEE_DRILL instead of a trick) | "none" (no trick drill) | [trick lines] (this week's tricks only) }
export function buildPlan(opts){
  const { pool, date } = opts; const day = dayNumber(date); const wd = weekday(date); const items = [];
  if (opts.short === "watch") return WATCH_DAY.map(it => ({ ...it }));
  if (opts.short) return MEMORY_RUN.map(it => it.id === "mem-top" && opts.nightBefore ? { ...it, text: "Night before the show · From the top, marking it with the music: no full-out tonight" } : { ...it });
  const ses = opts.session || {};
  const prefer = opts.preferTags || [];
  const comp = opts.mode === "comp"; // comp week: one core, one legs, no trick drills or aerial missions — clean runs instead
  // Taper (from Dec 28): one core, one legs, one technique — fewer exercises, the full-out stays.
  const fewer = (k) => (comp && (k === "core" || k === "legs")) || (ses.taper && (k === "core" || k === "legs" || k === "tech"));
  for (const slot of pool.slots || []) for (const it of rotate(slot.pool, fewer(slot.kind) ? Math.min(1, slot.n) : slot.n, day, slot.kind === "tech" ? prefer : [])) items.push({ ...it, kind: slot.kind });
  // This week's fix, as a drill (kept in the plan all week; the same id all week so a check-off sticks per day).
  // A teacher's new correction (last 7 days) is practised right away, not saved for the cleaning weeks.
  for (const n of (opts.newNotes || []).slice(0, 2)) if (n && n.text && (!opts.weekFix || n.id !== opts.weekFix.id)) items.push({ id: "new-" + n.id, text: `New from ${n.source}: ${n.text}`, secs: 90, kind: "fix", pose: (pool.fixPoses || {})[n.tag] || "pose", tag: n.tag });
  if (opts.weekFix && opts.weekFix.text) items.push({ id: "fix-" + opts.weekFix.id, text: "This week's fix: " + opts.weekFix.text, secs: 120, kind: "fix", pose: (pool.fixPoses || {})[opts.weekFix.tag] || "pose", tag: opts.weekFix.tag });
  // One trick drill from the dance cards, rotating daily.
  const tricks = (Array.isArray(opts.focus) && opts.focus.length ? opts.focus : opts.tricks || []).map(firstSentence).filter(Boolean);
  if (opts.focus === "knees" && !comp) items.push({ ...KNEE_DRILL });
  else if (tricks.length && !comp && opts.focus !== "none") { const t = tricks[day % tricks.length]; items.push({ id: "trick-" + (day % tricks.length), text: "Trick drill: " + t, secs: 120, kind: "trick", pose: /calypso/i.test(t) ? "calypso" : /scorpion|needle/i.test(t) ? "arab" : /cartwheel/i.test(t) ? "cartwheel" : /walkover|handstand/i.test(t) ? "handstand" : /turn|passé|passe/i.test(t) ? "pirouette" : /kick/i.test(t) ? "kick" : /donut|bridge|back/i.test(t) ? "bridge" : /extension|attitude/i.test(t) ? "develop" : "reach" }); }
  // Aerial mission: unchecked steps from the drill/strength sections, on the weekdays the pool says (home days), in the
  // mission's own order (each step builds on the one before). Not during Memory + knees: no acro at home until the solo is memorized.
  const nAerial = (pool.aerialByWeekday || {})[String(wd)] || 0;
  if (nAerial && !comp && opts.focus !== "knees") { const done = new Set(opts.aerialDone || []); const open = (opts.aerial || []).filter(a => !done.has(a.id) && a.section !== "In class only");
    const want = wd === 4 ? (a) => a.section === "Strength" : (a) => a.section.startsWith("Drills");
    const picks = open.filter(want).slice(0, nAerial); if (picks.length < nAerial) picks.push(...open.filter(a => !want(a) && !picks.includes(a)).slice(0, nAerial - picks.length));
    for (const a of picks) items.push({ id: "aerial-" + a.id, text: "Aerial mission: " + a.text, secs: 90, kind: "aerial", pose: (pool.aerialPoses || {})[a.section] || "cartwheel", aerialId: a.id, ...(a.how ? { how: a.how } : {}) }); }
  // Runs: only dances that exist (built-in or added) and aren't deleted.
  const have = new Set((opts.dances || []).map(d => d.id));
  for (const r of pool.runs || []) if (!r.dance || have.has(r.dance)) items.push({ ...r, ...(r.id === "solo-run" && ses.run ? { text: ses.run.text, secs: ses.run.secs } : {}), kind: "run" });
  // The research rules (season15.sessionRules): film one chunk (weeks 1–9), the Sunday review, the show in her head (from Nov 9).
  if (ses.clips) items.push({ id: "film-chunk", text: ses.clips.text, secs: ses.clips.secs, kind: "run", pose: "pose" });
  if (ses.review) items.push({ id: "film-review", text: ses.review.text, secs: ses.review.secs, kind: "run", pose: "pose" });
  if (ses.imagery) items.push({ id: "imagery", text: ses.imagery.title, how: ses.imagery.how, secs: ses.imagery.secs, kind: "mind", pose: "hold" });
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
