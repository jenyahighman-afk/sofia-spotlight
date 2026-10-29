// Share with the teacher: a plain-text summary a grown-up can copy or share from Grown-ups → Coach reviews. Text only —
// no photos, no clips, no links to the family space. Pure (tested in Node) except the two buttons.
import { $, toast, todayStr, expose, fmt } from "./util.js";
import { S, dances, studioDates } from "./store.js";
import { SKILLS } from "./data.js";
import { forDance, isOpen, TAG_LABEL } from "./corrections.js";
import { skillState, STATE_LABEL } from "./skills.js";
import { askedPosts, skillName } from "./drills.js";
import { readinessLines, readinessNow } from "./ready.js";
import { weekOf, activePlan, nextCheckpoint, checkpointTicks } from "./season15.js";

// The plan week and the checkpoint that matters now (the same one Today's card shows: a passed one not ticked, today's, the
// rehearsal to book, else the next), one line each, for the teacher. Pure: the plan, the booked dates and the ticks come in.
export function planLines(today, { plan = activePlan(today), oneOffs = [], ticks = {} } = {}){
  const out = []; const wk = weekOf(today, plan);
  if (wk) out.push(`📅 Week ${wk.w} of ${wk.total}${wk.phase ? " · " + wk.phase.n : ""}`);
  const cp = nextCheckpoint(today, plan, oneOffs, ticks);
  if (cp) out.push(cp.state === "book" ? `🎯 Next checkpoint: ${cp.t} (a solo private still to book)` : cp.state === "passed" ? `🎯 Checkpoint ${fmt(cp.d)}: ${cp.t} (not ticked in the app yet)` : `🎯 Next checkpoint: ${fmt(cp.d)}${cp.state === "today" ? " (today)" : ""} · ${cp.t}`);
  return out;
}

// `ready` = ready.js soloReadiness (the four bars as text, after the solo tricks); null leaves them out. `plan` = planLines
// (the plan week and the next checkpoint), printed just above the bars; null leaves them out.
export function teacherSummary({ dances: ds = [], corrections = {}, skills = {}, reviews = {}, goals = {}, drills = {}, ladder = SKILLS, today = todayStr(), ready = null, plan = null } = {}){
  const lines = [`Sofia — practice summary, ${today}`, ""];
  for (const d of ds) {
    const open = forDance(corrections, d.id).filter(isOpen); const done = forDance(corrections, d.id).filter(c => c.status === "done");
    const rv = Object.values(reviews).filter(r => r && !r.deleted && r.review && r.danceId === d.id).sort((a, b) => (b.at || b.date || "").localeCompare(a.at || a.date || "")).slice(0, 2);
    if (!open.length && !done.length && !rv.length) continue;
    lines.push(`${d.name}`);
    for (const c of open) lines.push(`  • working on (${TAG_LABEL[c.tag] || c.tag}): ${c.text}`);
    for (const c of done.slice(0, 3)) lines.push(`  ✓ fixed: ${c.text}`);
    for (const r of rv) lines.push(`  🎬 ${r.date || ""}${r.trick ? " · " + r.trick : ""}: ${r.review.fix}`);
    lines.push("");
  }
  const solo = (ladder.styles || {}).solo;
  if (solo) { lines.push("Solo tricks"); for (const k of solo.skills) { const st = skillState(skills, k.id); const rec = skills[k.id] || {}; lines.push(`  ${st === "checked" ? "★" : st === "clean" ? "◉" : st === "learning" ? "◔" : "○"} ${k.n} — ${STATE_LABEL[st]}${st === "checked" && rec.teacher ? " (" + rec.teacher + ")" : ""}`); } lines.push(""); }
  const where = [...(Array.isArray(plan) ? plan : []), ...(ready ? readinessLines(ready) : [])];
  if (where.length) { lines.push(...where); lines.push(""); }
  const gs = Object.values(goals).filter(g => g && !g.deleted && Array.isArray(g.checkins) && g.checkins.length);
  if (gs.length) { lines.push("Goals"); for (const g of gs) { const c = g.checkins.filter(x => typeof x.value === "number"); lines.push(`  ${g.emoji || "🎯"} ${g.name}: ${c.length ? `${c[0].value} → ${c[c.length - 1].value}${g.unit ? " " + g.unit : ""}` : `${g.checkins.length} check-in${g.checkins.length === 1 ? "" : "s"}`}`); } lines.push(""); }
  // Drill-box posts flagged "Ask Ms. Brittany if this is right for me" — public links, with the note that went with them. (Documents the migration emptied have no url and are skipped.)
  const asked = askedPosts(drills);
  if (asked.length) { lines.push("Posts from the internet — is this right for her?"); for (const p of asked) lines.push(`  📎 ${skillName(p.skill, ladder) || "a drill"}${p.note ? ": " + p.note : ""} — ${p.url}`); lines.push(""); }
  lines.push("Questions for you: what should she fix first, and is anything above wrong?");
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
export function renderTeacher(){ const el = $("#teacherText"); if (!el) return; let ready = null, plan = null; try { ready = readinessNow(); } catch (e) { console.warn(e); }
  try { plan = planLines(todayStr(), { oneOffs: studioDates(), ticks: checkpointTicks() }); } catch (e) { console.warn(e); }
  el.value = teacherSummary({ dances: dances(), corrections: S.corrections, skills: S.skills, reviews: S.reviews, goals: S.goals, drills: S.drills, ready, plan }); }
async function copy(){ const t = ($("#teacherText") || {}).value || ""; try { await navigator.clipboard.writeText(t); toast("Copied ✓"); } catch (e) { const el = $("#teacherText"); el.focus(); el.select(); toast("Select all and copy"); } }
async function share(){ const t = ($("#teacherText") || {}).value || ""; if (navigator.share) { try { await navigator.share({ title: "Sofia — practice summary", text: t }); } catch (e) {} } else copy(); }
expose({ teacherCopy: copy, teacherShare: share, teacherRefresh: renderTeacher });
