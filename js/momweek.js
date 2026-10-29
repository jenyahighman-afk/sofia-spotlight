// "This week, for Mom" (Build 3 of the Oct 28 review): one card on the Grown-ups hub with the week in one glance, every
// line from data the app already keeps — the plan week, the Sunday sheet's state (settings.sunday), the week's fix and
// its video count (settings.fixSeen), this month's privates, the next checkpoint, the imagery script read-aloud window
// (plan rules.imagery.parentDays: a grown-up reads the steps for the first two weeks, until Nov 23), and the next mini
// audience. Pure parts up top (tested in Node); the card below.
import { $, esc, fmt, todayStr, expose } from "./util.js";
import { S, studioDates } from "./store.js";
import { weekOf, activePlan, nextCheckpoint, checkpointTicks, allCheckpoints, tickedOn } from "./season15.js";
import { currentWeekFix, seenCount, FIX_SEEN_TO_MOVE, TAG_EMOJI, weekKey } from "./corrections.js";
import { privatesStatus, nextRehearsal } from "./studio.js";
import { sundayRecords } from "./sunday.js";

const DAY = 86400000;
const dnum = (iso) => Math.round(new Date(iso + "T00:00:00").getTime() / DAY);
const addDays = (iso, n) => { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + n); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthName = (m) => MONTHS[+m.slice(5) - 1];
const isSun = (iso) => new Date(iso + "T00:00:00").getDay() === 0;
const MINI_RE = /mini audience/i;
// The lines: [{ k, ic, text, sub?, warn?, go?, btn? }]. Everything is handed in, so the test can set the week up.
export function momWeekLines(date, { plan = activePlan(date), week = weekOf(date, plan), sunday = {}, fix = null, seen = {}, oneOffs = [], ticks = {} } = {}){
  const out = [];
  // 1. the week
  if (week) out.push({ k: "week", ic: "📅", text: `Week ${week.w} of ${week.total}${week.phase ? " · " + week.phase.n : ""}${week.light ? " · light week" : ""}${week.taper ? " · taper" : ""}${week.judges ? " · judges' week" : ""}`, sub: `Solo: ${week.solo}${week.fri ? ` · Friday: ${week.fri}` : ""}` });
  else out.push({ k: "week", ic: "📅", text: "No plan week for this date", sub: "The plans run Sep 28 to the Showcase, then Jan 11 to the Ball." });
  // 2. the Sunday sheet (weeks run Sunday → Saturday, so "this week's" is the Sunday on or before the date)
  const key = weekKey(date); const rec = (sunday || {})[key];
  if (rec && rec.done) out.push({ k: "sunday", ic: "🎬", text: `Sunday sheet: done ${fmt(rec.done)}`, sub: [rec.went ? `went well: “${rec.went}”` : "", rec.fix ? (rec.fix === "yes" ? "the fix showed ✓" : "the fix: not yet") : "", rec.note ? `note: ${rec.note}` : ""].filter(Boolean).join(" · ") || "no words typed" });
  else if (isSun(date)) out.push({ k: "sunday", ic: "🎬", text: "Sunday sheet: today", sub: rec ? "started, not finished" : "Open it from the film-review item, or on Today", go: "openSunday()", btn: "🎬 Open" });
  else out.push({ k: "sunday", ic: "🎬", text: `Sunday sheet: not filled this week (${fmt(key)})`, sub: rec ? "started, not finished — it can still be done" : "It can still be filled in: the last run, what went well, the fix", warn: true, go: "openSunday()", btn: "🎬 Fill it" });
  // 3. the week's fix and its video count
  if (fix) { const n = seenCount(seen, fix.id); const twice = n >= FIX_SEEN_TO_MOVE;
    out.push({ k: "fix", ic: TAG_EMOJI[fix.tag] || "🎯", text: `This week's fix: ${fix.text}`, sub: `📹 on video ${n} of ${FIX_SEEN_TO_MOVE} in a row${fix.pinned ? ` · 📌 ${fix.source || "teacher"}` : ""}${twice && fix.pinned ? " · ready to check off (Skills & awards)" : twice ? " · done, the next fix is up" : ""}`, warn: twice && !!fix.pinned, go: twice && fix.pinned ? "showPage('skillcheck')" : "", btn: twice && fix.pinned ? "★ Check it off" : "" }); }
  else out.push({ k: "fix", ic: "🎯", text: "No fix picked this week", sub: "Today's ✨ More for today → This week's fix → Pick one", warn: true });
  // 4. privates this month
  const month = date.slice(0, 7); const st = privatesStatus(oneOffs, month); const r = nextRehearsal(oneOffs, date);
  if (st[0].need) out.push({ k: "privates", ic: "🩰", text: `Privates in ${monthName(month)}: ${st.map(s => `${s.label} ${s.have}/${s.need}${s.short ? "" : " ✓"}`).join(" · ")}`, sub: r ? `Next solo private: ${fmt(r.start)}${r.time ? " " + r.time : ""}` : "No solo private booked ahead", warn: st.some(s => s.short) || !r, go: "openRehearsal('solo')", btn: "📅 Book" });
  // 5. the next checkpoint
  const cp = nextCheckpoint(date, plan, oneOffs, ticks);
  if (cp) out.push({ k: "checkpoint", ic: "🎯", text: cp.state === "book" ? `Book it: ${cp.t}` : cp.state === "passed" ? `${fmt(cp.d)} · ${cp.t}` : `Next checkpoint: ${fmt(cp.d)}${cp.state === "today" ? " · today" : ` (${dnum(cp.d) - dnum(date)} days)`} · ${cp.t}`, sub: cp.state === "passed" ? "Passed and not ticked: did she make it? (✓ on Today's week card)" : cp.state === "book" ? "The rehearsal checkpoint needs a booked private" : "", warn: cp.state === "passed" || cp.state === "book", go: cp.state === "book" ? "openRehearsal('solo')" : "", btn: cp.state === "book" ? "📅 Book" : "" });
  // 6. the Show-in-your-head script: a grown-up reads it aloud for the first parentDays
  const im = (plan && plan.rules && plan.rules.imagery) || null;
  if (im && im.from) { const until = addDays(im.from, +im.parentDays || 0);
    if (date < im.from) out.push({ k: "script", ic: "📖", text: `From ${fmt(im.from)}: read the Show-in-your-head script aloud`, sub: `The first ${+im.parentDays || 0} days, inside every home session (6 min)` });
    else if (date < until) out.push({ k: "script", ic: "📖", text: `Read the Show-in-your-head script aloud, until ${fmt(until)}`, sub: "Seven steps, in the home session; she closes her eyes, you read", warn: true });
    else out.push({ k: "script", ic: "📖", text: "Show in your head: she does the script herself now", sub: `The read-aloud weeks ended ${fmt(until)}` }); }
  // 7. mini audiences: the next one not ticked
  const minis = allCheckpoints(plan, oneOffs, date).filter(c => MINI_RE.test(c.t));
  if (minis.length) { const open = minis.find(c => !tickedOn(ticks, c.id));
    if (!open) out.push({ k: "mini", ic: "🎤", text: `Mini audiences: all ${minis.length} done ✓` });
    else if (open.d && open.d < date) out.push({ k: "mini", ic: "🎤", text: `${open.t} was due ${fmt(open.d)}`, sub: "Did it happen? Tick it on Today's week card, or plan the next one", warn: true });
    else { const left = open.d ? dnum(open.d) - dnum(date) : null; out.push({ k: "mini", ic: "🎤", text: `Next mini audience: ${open.d ? fmt(open.d) : "not dated"}${left !== null ? ` (${left} day${left === 1 ? "" : "s"})` : ""}`, sub: open.t, warn: left !== null && left <= 7 }); } }
  return out;
}

// ---- DOM ----
export function momWeekNow(date = todayStr()){ return momWeekLines(date, { sunday: sundayRecords(S.settings), fix: currentWeekFix(date), seen: S.settings.fixSeen, oneOffs: studioDates(), ticks: checkpointTicks() }); }
export function renderMomWeek(){
  const el = $("#momWeek"); if (!el) return; const date = todayStr(); let lines; try { lines = momWeekNow(date); } catch (e) { console.warn("momweek", e); el.innerHTML = `<p class="small muted">Couldn't read the week.</p>`; return; }
  el.innerHTML = `<div class="row"><h3 class="grow">👩 This week, for Mom</h3><span class="chip">${esc(fmt(date))}</span></div>
    ${lines.map(l => `<div class="mom-line ${l.warn ? "warn" : ""}"><span class="mom-ic">${l.ic}</span><div class="grow"><div>${esc(l.text)}</div>${l.sub ? `<div class="small muted">${esc(l.sub)}</div>` : ""}</div>${l.go && l.btn ? `<button class="btn sm ${l.warn ? "coral" : "ghost"}" onclick="${esc(l.go)}">${esc(l.btn)}</button>` : ""}</div>`).join("")}`;
}
expose({ renderMomWeek });
