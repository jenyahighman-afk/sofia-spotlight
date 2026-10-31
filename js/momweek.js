// "This week, for Mom" (Build 3 of the Oct 28 review): one card on the Grown-ups hub with the week in one glance, every
// line from data the app already keeps — today's kind of day with the one plan item that wants a grown-up (Build 4), the
// plan week, the Sunday sheet's state (settings.sunday, keyed by the plan week since schema 51: on a weekday the line is
// about last Sunday's sheet), the week's fix and its video count (settings.fixSeen), this month's privates, the next
// checkpoint, the imagery script read-aloud window (plan rules.imagery.parentDays: a grown-up reads the steps for the first
// two weeks, until Nov 23), and the next mini audience. Pure parts up top (tested in Node); the card below.
import { $, esc, fmt, todayStr, expose } from "./util.js";
import { S, studioDates, calendarOnly } from "./store.js";
import { CLASSES, HOME_DAYS } from "./data.js";
import { weekOf, activePlan, nextCheckpoint, checkpointTicks, allCheckpoints, tickedOn } from "./season15.js";
import { weekFixOrPick, seenCount, FIX_SEEN_TO_MOVE, TAG_EMOJI } from "./corrections.js";
import { privatesStatus, nextRehearsal, studioOn } from "./studio.js";
import { sundayRecords, sundayOf, reviewSunday } from "./sunday.js";
import { planFor, shortKind } from "./planToday.js";
import { momNewsHtml } from "./news.js";

const DAY = 86400000;
const dnum = (iso) => Math.round(new Date(iso + "T00:00:00").getTime() / DAY);
const addDays = (iso, n) => { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + n); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const monthName = (m) => MONTHS[+m.slice(5) - 1];
const isSun = (iso) => new Date(iso + "T00:00:00").getDay() === 0;
const MINI_RE = /mini audience/i;
// "Mini/Jr Acro II/III" → "Acro", "Acro make-up class" → "Acro make-up": the class as a grown-up says it.
export const shortClass = (n) => String(n || "").replace(/^Mini\/Jr |^Mini |^Jr /, "").replace(/\b(I|II|III|IV)(\/(I|II|III|IV))?\b/g, "").replace(/\s+class$/i, "").replace(/\s+/g, " ").trim();
const GROWN_RE = /grown-up|\bmom\b/i;
// The one plan item that wants a grown-up: Pause & Predict, else the first whose words (or its `how`) say so. Its name = the
// words before the colon, without "with a grown-up".
export function grownUpItem(items){
  const it = (items || []).find(i => i && (i.id === "mem-predict" || GROWN_RE.test(`${i.text || ""} ${i.how || ""}`))); if (!it) return "";
  return String(it.text || "").split(/[:(·]/)[0].replace(/\s+with a grown-up.*$/i, "").trim();
}
// Today's line (Build 4): the weekday, the kind of day and what the plan is — the memory run after the last class, Hannah's
// videos, the home plan with its minutes, a rest day — then the item that wants a grown-up.
export function momTodayLine(date, { kind = "rest", classes = [], items = [], homePlan = "" } = {}){
  const wd = new Date(date + "T00:00:00").getDay(); const last = classes.length ? shortClass(classes[classes.length - 1].name) : "";
  const mins = Math.round((items || []).reduce((a, i) => a + (+i.secs || 0), 0) / 60);
  const what = kind === "watch" ? "studio day: Hannah's videos, then the solo in the car — no dancing tonight" : kind === "memory" ? `studio day: the memory run${last ? " after " + last : ""}` : kind === "home" ? `home day: ${homePlan || "home practice"}${mins ? ` · ${mins} min` : ""}` : "rest day: nothing planned, a stretch if she likes";
  const g = grownUpItem(items);
  return { k: "today", ic: kind === "watch" ? "📹" : kind === "memory" ? "🏫" : kind === "home" ? "🏠" : "🌙", text: `${DAYS[wd]}, ${what}${g ? ` · ${g} wants a grown-up` : ""}` };
}
// The lines: [{ k, ic, text, sub?, warn?, go?, btn? }]. Everything is handed in, so the test can set the week up; `today`
// (the kind of day, the classes, the plan's items) adds the first line when given.
export function momWeekLines(date, { plan = activePlan(date), week = weekOf(date, plan), sunday = {}, fix = null, seen = {}, oneOffs = [], ticks = {}, today = null, dates = [] } = {}){
  const out = [];
  // 0. today (Build 4)
  if (today) out.push(momTodayLine(date, today));
  // 1. the week
  if (week) out.push({ k: "week", ic: "📅", text: `Week ${week.w} of ${week.total}${week.phase ? " · " + week.phase.n : ""}${week.light ? " · light week" : ""}${week.taper ? " · taper" : ""}${week.judges ? " · judges' week" : ""}`, sub: `Solo: ${week.solo}${week.fri ? ` · Friday: ${week.fri}` : ""}` });
  else out.push({ k: "week", ic: "📅", text: "No plan week for this date", sub: "The plans run Sep 28 to the Showcase, then Jan 11 to the Ball." });
  // 2. the Sunday sheet — keyed by the plan week (schema 51): today's sheet on a Sunday, last Sunday's on the days after it
  const key = sundayOf(date); const rec = (sunday || {})[key]; const when = fmt(reviewSunday(date)).replace(/^\w+, /, "");
  const bits = rec ? [rec.went ? `went well: “${rec.went}”` : "", rec.fix ? (rec.fix === "yes" ? "the fix showed ✓" : "the fix: not yet") : "", rec.note ? `note: ${rec.note}` : ""].filter(Boolean).join(" · ") : "";
  if (rec && rec.done) out.push({ k: "sunday", ic: "🎬", text: isSun(date) ? `Sunday sheet: done ${fmt(rec.done)}` : `Last Sunday's sheet (${when}): done`, sub: bits || "no words typed" });
  else if (isSun(date)) out.push({ k: "sunday", ic: "🎬", text: "Sunday sheet: today", sub: rec ? "started, not finished" : "Open it from the film-review item, or on Today", go: "openSunday()", btn: "🎬 Open" });
  else out.push({ k: "sunday", ic: "🎬", text: `Last Sunday's sheet (${when}): not filled`, sub: rec ? "started, not finished — it can still be done" : "It can still be filled in: the last run, what went well, the fix", warn: true, go: "openSunday()", btn: "🎬 Fill it" });
  // 3. the week's fix and its video count (picked on the first open of a new week, so "none" means no open note)
  if (fix) { const n = seenCount(seen, fix.id); const twice = n >= FIX_SEEN_TO_MOVE;
    out.push({ k: "fix", ic: TAG_EMOJI[fix.tag] || "🎯", text: `This week's fix: ${fix.text}`, sub: `📹 on video ${n} of ${FIX_SEEN_TO_MOVE} in a row${fix.pinned ? ` · 📌 ${fix.source || "teacher"}` : ""}${twice && fix.pinned ? " · ready to check off (Skills & awards)" : twice ? " · done, the next fix is up" : ""}`, warn: twice && !!fix.pinned, go: twice && fix.pinned ? "showPage('skillcheck')" : "", btn: twice && fix.pinned ? "★ Check it off" : "" }); }
  else out.push({ k: "fix", ic: "🎯", text: "No fix picked this week", sub: "The app picks one when Today opens on a new week; nothing open to pick from yet — add a note on a dance card", warn: true });
  // 4. privates this month
  const month = date.slice(0, 7); const st = privatesStatus(oneOffs, month); const r = nextRehearsal(oneOffs, date);
  if (st[0].need) out.push({ k: "privates", ic: "🩰", text: `Privates in ${monthName(month)}: ${st.map(s => `${s.label} ${s.have}/${s.need}${s.short ? "" : " ✓"}`).join(" · ")}`, sub: r ? `Next solo private: ${fmt(r.start)}${r.time ? " " + r.time : ""}` : "No solo private booked ahead", warn: st.some(s => s.short) || !r, go: "openRehearsal('solo')", btn: "📅 Book" });
  // 4b. the studio's dates in the next 7 days (1.57.0): a showing, a hold weekend, a deadline; an unpicked pair says "sign up for one"
  const soon = (dates || []).filter(e => e && !e.deleted && (e.end || e.start) >= date && e.start <= addDays(date, 6)).sort((a, b) => a.start.localeCompare(b.start));
  if (soon.length) out.push({ k: "dates", ic: "🗓️", text: "Coming up: " + soon.map(e => `${fmt(e.start)} · ${e.short || e.name}${e.pick && !e.chosen ? " (sign up for one)" : ""}`).join("; "), sub: soon[0].notes || "", warn: soon.some(e => e.kind === "deadline" || (e.pick && !e.chosen)), go: "showPage('schedule')", btn: "🗓️ Calendar" });
  // 5. the next checkpoint
  const cp = nextCheckpoint(date, plan, oneOffs, ticks);
  if (cp) out.push({ k: "checkpoint", ic: "🎯", text: cp.state === "book" ? `Book it: ${cp.t}` : cp.state === "passed" ? `${fmt(cp.d)} · ${cp.t}` : `Next checkpoint: ${fmt(cp.d)}${cp.state === "today" ? " · today" : ` (${dnum(cp.d) - dnum(date)} days)`} · ${cp.t}`, sub: cp.state === "passed" ? "Passed and not ticked: did she make it? (tap the 🎯 line on Today, then ✓ Made it)" : cp.state === "book" ? "The rehearsal checkpoint needs a booked private" : "", warn: cp.state === "passed" || cp.state === "book", go: cp.state === "book" ? "openRehearsal('solo')" : "", btn: cp.state === "book" ? "📅 Book" : "" });
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
    else if (open.d && open.d < date) out.push({ k: "mini", ic: "🎤", text: `${open.t} was due ${fmt(open.d)}`, sub: "Did it happen? Tick it from the 🎯 line on Today, or plan the next one", warn: true });
    else { const left = open.d ? dnum(open.d) - dnum(date) : null; out.push({ k: "mini", ic: "🎤", text: `Next mini audience: ${open.d ? fmt(open.d) : "not dated"}${left !== null ? ` (${left} day${left === 1 ? "" : "s"})` : ""}`, sub: open.t, warn: left !== null && left <= 7 }); } }
  return out;
}

// ---- DOM ----
// Today's kind of day from the app's own state: a weekly class or a booked date makes a studio day (the watch day on a Monday,
// the memory run otherwise), a home weekday a home day, anything else rest — the same reading as Today's card.
export function momToday(date = todayStr()){
  const cls = studioOn(date, CLASSES, studioDates()); const wd = new Date(date + "T00:00:00").getDay();
  const kind = cls.length ? shortKind(date) : HOME_DAYS[wd] ? "home" : "rest";
  return { kind, classes: cls, items: kind === "rest" ? [] : planFor(date), homePlan: HOME_DAYS[wd] || "" };
}
export function momWeekNow(date = todayStr()){ return momWeekLines(date, { sunday: sundayRecords(S.settings), fix: weekFixOrPick(date), seen: S.settings.fixSeen, oneOffs: studioDates(), ticks: checkpointTicks(), today: momToday(date), dates: [...calendarOnly(), ...studioDates().filter(e => e.showing)] }); }
export function renderMomWeek(){
  const el = $("#momWeek"); if (!el) return; const date = todayStr(); let lines; try { lines = momWeekNow(date); } catch (e) { console.warn("momweek", e); el.innerHTML = `<p class="small muted">Couldn't read the week.</p>`; return; }
  el.innerHTML = `<div class="row"><h3 class="grow">👩 This week, for Mom</h3><span class="chip">${esc(fmt(date))}</span></div>
    ${lines.map(l => `<div class="mom-line ${l.warn ? "warn" : ""}"><span class="mom-ic">${l.ic}</span><div class="grow"><div>${esc(l.text)}</div>${l.sub ? `<div class="small muted">${esc(l.sub)}</div>` : ""}</div>${l.go && l.btn ? `<button class="btn sm ${l.warn ? "coral" : "ghost"}" onclick="${esc(l.go)}">${esc(l.btn)}</button>` : ""}</div>`).join("")}${momNewsHtml()}`;
}
expose({ renderMomWeek });
