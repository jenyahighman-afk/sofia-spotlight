// 🏫 Studio log (1.70.0, Jenya Nov 13: "can she have an option to log dances and skills that she worked on at the studio and
// what date and add some notes if she wants them there? She should be able to update last 2 weeks at any time. Maybe a
// regular nudge to log her work at the studio would help. The updates should be very easy to record - just a few clicks -
// more emojies and symbols and less words."). One sheet: a strip of the last LOG_DAYS days (🏫 marks a class day, a dot a
// day that has a log), her competition dances and her goals as chips, four faces, a note if she wants one. Every tap saves
// at once; there is no Save button. A day's log lives in that day's practice record:
//   practice[date].studio = { dances: [dance id, …], skills: [goal id, …], feel: "" | FEELS key, note: "", skip: true? }
// It counts where her work counts (js/working.js): a dance and a skill logged here are stepping stones, a skill's page shows
// the day as a filled dot, a dance's row on Today says how many times at the studio. Nothing here touches the day's home
// practice (done, runs, skills). The nudge on Today asks about a class day of the last NUDGE_DAYS days that has no log yet;
// 🚫 marks that day "nothing to log" (skip) and it is not asked about again. Pure parts up top (tested in Node).
import { $, esc, todayStr, expose, toast } from "./util.js";
import { S, storeSet, dances, studioDates } from "./store.js";
import { CLASSES } from "./data.js";
import { studioOn } from "./studio.js";
import { shiftDate, TAGS, TAG_EMOJI, TAG_LABEL, inferTag, isOpen, closeCorrection } from "./corrections.js";
import { openStage } from "./stage.js";
import { workingIds, goalRow, danceLabel, renderStones, pickGroups } from "./working.js";

export const LOG_DAYS = 14, NUDGE_DAYS = 3, NOTE_MAX = 200;
export const FEELS = [["great", "🤩"], ["good", "🙂"], ["ok", "😐"], ["hard", "😓"]];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const isClassDance = (d) => /class dance/i.test((d && d.name) || "") || /^wf-/.test((d && d.id) || "");
const strs = (a) => Array.isArray(a) ? [...new Set(a.filter(x => typeof x === "string" && x))] : [];
// A day's studio log, whatever is stored: always the same five fields. Pure.
export function studioRec(practice, date){
  const s = ((practice || {})[date] || {}).studio || {};
  return { classes: strs(s.classes), dances: strs(s.dances), skills: strs(s.skills), feel: FEELS.some(f => f[0] === s.feel) ? s.feel : "", note: String(s.note || "").slice(0, NOTE_MAX), skip: !!s.skip };
}
// Is there anything in it? (skip alone is "she said there was nothing".) Pure.
export const hasLog = (r) => !!r && ((r.classes || []).length > 0 || r.dances.length > 0 || r.skills.length > 0 || !!r.feel || !!r.note);
// The day's practice record with its studio log changed; everything else in the record stays. Logging something lifts a skip. Pure.
export function withStudio(rec, patch){
  const base = rec && typeof rec === "object" ? rec : { done: [], note: "", runs: [] }; const cur = studioRec({ d: base }, "d"); const next = { ...cur, ...patch };
  const out = { classes: strs(next.classes), dances: strs(next.dances), skills: strs(next.skills), feel: next.feel || "", note: String(next.note || "").slice(0, NOTE_MAX) };
  if (next.skip && !hasLog({ ...out })) out.skip = true;
  return { ...base, studio: out };
}
export const toggleIn = (list, id) => list.includes(id) ? list.filter(x => x !== id) : [...list, id];
// The strip's days, oldest → today. Pure.
export const logDays = (today, n = LOG_DAYS) => Array.from({ length: n }, (_, i) => shiftDate(today, i - (n - 1)));
// The class days of the last few days (today too) with no log and no skip, newest first. Pure: `isClassDay(date)` is given.
export function nudgeDays(practice, today, isClassDay, span = NUDGE_DAYS){
  return logDays(today, span).reverse().filter(d => isClassDay(d) && !hasLog(studioRec(practice, d)) && !studioRec(practice, d).skip);
}
const WD = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const dayParts = (date) => { const d = new Date(date + "T00:00:00"); return { wd: WD[d.getDay()], n: d.getDate() }; };
export const dayWords = (date, today) => date === today ? "Today" : date === shiftDate(today, -1) ? "Yesterday" : new Date(date + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
// 📝 Teacher said (1.71.0, Jenya Nov 13: "My goal with these logs is to help her develop a habit to write down teacher's
// feedback and corrections in the way that's quick and easy for her to add and work on at home so the next time she shows
// up in class she knows and can show that she listened and learned and took action to improve."). A note from class is a
// correction like any other (the `corrections` collection: it shows on its dance's page, can be this week's fix, counts in
// the dance's bar) with `studio: true`, the class day as its date, and what it is about: a dance's id, or "skill:<goal id>".
// At home, 📝 From my teachers on Today lists the open ones: 💪 = I worked on it today (practice[date].notes = [id, …], a
// stepping stone), ✅ = got it (closes it, as on the dance's page). On a class day the card says to show them in class.
export const SAID_MAX = 160;
export const aboutSkill = (about) => String(about || "").startsWith("skill:") ? String(about).slice(6) : "";
// The note's record. null without words. Pure.
// 1.74.0 (Jenya, Nov 13: "each note should be tied to what we already have in our app - Dance class (type), skill,
// competitive dance that it applies to, teacher's or choreographer's name" without making it a task in itself): a note
// starts from the CLASS she was in. One tap on the class gives its name (`cls`) and its teacher (`source`, from
// data/classes.json or the booked private); the dance or skill stays optional (`danceId` = the dance, "skill:<goal id>",
// or "class:<name>" when it is about the class as a whole); the day is the strip's.
export const aboutClass = (about) => String(about || "").startsWith("class:") ? String(about).slice(6) : "";
export const shortClass = (n) => String(n || "").replace(/^Mini\/Jr |^Mini |^Jr /, "");
export function noteRec({ about = "", text = "", tag = "", date = "", id = "", cls = "", teacher = "" } = {}){
  if (!about && cls) about = "class:" + cls;
  const t = String(text || "").replace(/\s+/g, " ").trim().slice(0, SAID_MAX); if (!t || !about || !DATE.test(String(date)) || !id) return null;
  return { id, danceId: String(about), text: t, tag: TAGS.includes(tag) ? tag : inferTag(t), source: String(teacher || "").trim() || "class", date, status: "working", studio: true, ...(cls ? { cls: String(cls) } : {}) };
}
// Her class notes, newest first; `open` keeps the ones not done yet. Pure.
export function classNotes(corrections, { open = false, date = "" } = {}){
  return Object.values(corrections || {}).filter(c => c && c.studio && !c.deleted && (!open || isOpen(c)) && (!date || c.date === date)).sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.id).localeCompare(String(a.id)));
}
// The days she worked on a note at home, oldest first. Pure.
export const noteDays = (practice, id) => Object.entries(practice || {}).filter(([d, r]) => DATE.test(d) && r && Array.isArray(r.notes) && r.notes.includes(id)).map(([d]) => d).sort();
// Today's card. `label(about)` names what a note is about. Pure.
export function notesCardHtml(notes, { today, practice = {}, classToday = false, label = () => "", cap = 4 } = {}){
  if (!notes.length) return "";
  const row = (c) => { const days = noteDays(practice, c.id), on = days.includes(today), about = label(c.danceId);
    return `<div class="tn-row"><div class="tn-text"><b>${TAG_EMOJI[c.tag] || "✨"} ${esc(c.text)}</b><small>${about ? esc(about) + " · " : ""}${c.source && c.source !== "class" ? "👩‍🏫 " + esc(c.source) + " · " : ""}🏫 ${esc(dayWords(c.date, today))}${days.length ? ` · 💪 ×${days.length}` : ""}</small></div><div class="tn-btns"><button class="tn-btn${on ? " on" : ""}" onclick="tnWorked('${c.id}')" aria-pressed="${on}" aria-label="I worked on it today">💪</button><button class="tn-btn" onclick="tnGot('${c.id}')" aria-label="Got it">✅</button></div></div>`; };
  return `<div class="row"><span class="st-head grow">📝 From my teachers</span><span class="chip violet">${notes.length}</span></div><p class="small muted">${classToday ? "🏫 Class today: show them you worked on these!" : "💪 = I worked on it today · ✅ = got it"}</p>${notes.slice(0, cap).map(row).join("")}${notes.length > cap ? `<p class="small muted">＋ ${notes.length - cap} more on your dances</p>` : ""}`;
}
// The sheet. `list` = her competition dances [{ id, n }], `goals` = her goals [{ id, n, ic }]. Pure.
export function sheetHtml({ date, today, practice = {}, list = [], goals = [], isClassDay = () => false, more = [], said = [], about = "", tag = "", label = () => "", classes = [], cls = "" } = {}){
  const r = studioRec(practice, date);
  const strip = logDays(today).map(d => { const p = dayParts(d), has = hasLog(studioRec(practice, d)); return `<button class="sl-day${d === date ? " on" : ""}${has ? " has" : ""}" onclick="slDay('${d}')" aria-label="${esc(dayWords(d, today))}${has ? ", logged" : ""}"><small>${p.wd}</small><b>${p.n}</b><span>${isClassDay(d) ? "🏫" : "·"}</span></button>`; }).join("");
  const chip = (fn, id, label, on) => `<button class="sl-chip${on ? " on" : ""}" onclick="${fn}('${id}')" aria-pressed="${on}">${on ? "✅ " : ""}${label}</button>`;
  const dn = list.length ? list.map(d => chip("slDance", d.id, esc(d.n), r.dances.includes(d.id))).join("") : `<span class="small muted">—</span>`;
  const sk = goals.length ? goals.map(g => chip("slSkill", g.id, `${g.ic} ${esc(g.n)}`, r.skills.includes(g.id))).join("") : `<button class="lnk" onclick="closeStage();showPage('skills');wkPick()">＋ ⭐</button>`;
  // ＋ any other skill (1.71.0): the picker's own groups, folded; a tap logs it for this day like one of her goals.
  const moreHtml = more.length ? `<details class="sl-more"><summary>＋ ⭐</summary>${more.map(g => `<div class="sl-mlab">${esc(g.label)}</div><div class="sl-chips">${g.items.map(i => chip("slSkill", i.id, esc(i.n), r.skills.includes(i.id))).join("")}</div>`).join("")}</details>` : "";
  // 📝 Teacher said: what it is about (what she logged for this day; every dance when nothing is logged yet), the body part
  // or idea as one emoji, the words, ＋.
  const opts = [...list.filter(d => r.dances.includes(d.id)).map(d => ({ id: d.id, n: d.n })), ...goals.filter(g => r.skills.includes(g.id)).map(g => ({ id: "skill:" + g.id, n: `${g.ic} ${g.n}` }))]; const abouts = opts.length ? opts : list.map(d => ({ id: d.id, n: d.n }));
  // With classes to pick from, the class is what a note needs; the dance or skill is an optional second tap.
  const curCls = classes.some(c => c.name === cls) ? cls : "", klass = classes.find(c => c.name === curCls) || null;
  const cur = abouts.some(a => a.id === about) ? about : classes.length ? "" : (abouts[0] || {}).id || "";
  const clsHtml = classes.length ? `<div class="sl-chips sl-cls">${classes.map((c, i) => { const was = r.classes.includes(c.name), on = c.name === curCls; return `<button class="sl-chip${on ? " on" : ""}" onclick="slCls(${i})" aria-pressed="${on}">${was ? "✅ " : ""}🏫 ${esc(c.label || c.name)}${c.t ? `<small>${esc(c.t)}</small>` : ""}</button>`; }).join("")}</div>${klass && klass.teacher ? `<div class="sl-teacher">👩‍🏫 ${esc(klass.teacher)}</div>` : ""}<div class="sl-mlab">💃 ⭐ ?</div>` : "";
  const aboutHtml = abouts.map(a => `<button class="sl-chip sm${a.id === cur ? " on" : ""}" onclick="slAbout('${a.id}')" aria-pressed="${a.id === cur}">${esc(a.n)}</button>`).join("");
  const tags = TAGS.map(t => `<button class="sl-tag${t === tag ? " on" : ""}" onclick="slTag('${t}')" aria-label="${TAG_LABEL[t]}" aria-pressed="${t === tag}">${TAG_EMOJI[t]}</button>`).join("");
  const saidHtml = said.map(c => `<div class="sl-said"><span class="grow">${TAG_EMOJI[c.tag] || "✨"} ${esc(c.text)}<small>${esc([label(c.danceId), c.source && c.source !== "class" ? "👩‍🏫 " + c.source : ""].filter(Boolean).join(" · "))}</small></span><button class="del" onclick="slSaidDel('${c.id}')" aria-label="Delete">✕</button></div>`).join("");
  const teacher = `<div class="sl-lab">📝 <span class="sl-labw">Teacher said</span></div>${saidHtml}${clsHtml}<div class="sl-chips">${aboutHtml}</div><div class="sl-tags">${tags}</div>
    <div class="sl-add"><input type="text" class="sl-note" id="slSaid" maxlength="${SAID_MAX}" placeholder="📝 …" aria-label="What the teacher said" onkeydown="if(event.key==='Enter')slSaidAdd()"><button class="btn coral" data-about="${esc(cur)}" data-cls="${esc(curCls)}" onclick="slSaidAdd()" aria-label="Add">＋</button></div>`;
  const feel = FEELS.map(([k, e]) => `<button class="sl-feel${r.feel === k ? " on" : ""}" onclick="slFeel('${k}')" aria-label="${k}" aria-pressed="${r.feel === k}">${e}</button>`).join("");
  return `<div class="sl-strip" id="slStrip">${strip}</div>
    <div class="sl-date">🏫 ${esc(dayWords(date, today))}${hasLog(r) ? " ✅" : ""}</div>
    <div class="sl-lab">💃</div><div class="sl-chips">${dn}</div>
    <div class="sl-lab">⭐</div><div class="sl-chips">${sk}</div>${moreHtml}
    ${teacher}
    <div class="sl-lab">💬</div><div class="sl-feels">${feel}</div>
    <input type="text" class="sl-note" id="slNote" maxlength="${NOTE_MAX}" placeholder="✏️ my own note…" value="${esc(r.note)}" onchange="slNote(this.value)" aria-label="Note">
    <p class="small muted sl-hint">Tap = saved ✓ · tap again = off</p>`;
}
// Today's nudge: the newest class day with no log. Pure.
export function nudgeHtml(days, today){
  if (!days.length) return "";
  return `<div class="row"><span class="grow"><b>🏫 ${esc(dayWords(days[0], today))}</b><small class="sl-nsub">What did you work on at the studio? 💃 ⭐${days.length > 1 ? ` · ＋${days.length - 1}` : ""}</small></span><button class="btn sm coral" onclick="openStudioLog('${days[0]}')">✏️ Log</button><button class="btn sm ghost" onclick="slSkip('${days[0]}')" aria-label="Nothing to log">🚫</button></div>`;
}

// ---- DOM ----
let cur = "", box = null;
const classDay = (d) => studioOn(d, CLASSES, studioDates()).length > 0;
const compDances = () => dances().filter(d => !isClassDance(d)).map(d => ({ id: d.id, n: danceLabel(d) }));
const myGoals = () => { const working = workingIds(S.settings); return working.map(id => goalRow(id, { working })).filter(Boolean).map(r => ({ id: r.id, n: r.n, ic: r.ic })); };
// What a note is about, in words: the dance, or the skill.
export const aboutLabel = (about) => { const k = aboutClass(about); if (k) return "🏫 " + shortClass(k); const sk = aboutSkill(about); if (sk) { const r = goalRow(sk); return r ? `${r.ic} ${r.n}` : ""; } const d = dances().find(x => x.id === about); return d ? danceLabel(d) : ""; };
// Her goals, plus any other skill logged for the day (so its chip stays to be tapped off).
const dayGoals = () => { const mine = myGoals(), have = new Set(mine.map(g => g.id)); for (const id of studioRec(S.practice, cur).skills) { if (have.has(id)) continue; const r = goalRow(id); if (r) mine.push({ id: r.id, n: r.n, ic: r.ic }); } return mine; };
const moreGroups = () => { const shown = new Set(dayGoals().map(g => g.id)); return pickGroups({ working: workingIds(S.settings) }).map(g => ({ label: g.label, items: g.parts.flatMap(p => p.items).filter(i => !shown.has(i.id)).map(i => ({ id: i.id, n: String(i.n).replace(/^🦋 /, "") })) })).filter(g => g.items.length); };
// The classes to offer for a day: that day's (weekly classes and booked dates: a private, a make-up), each with its time and
// teacher; on a day with none (a make-up nobody booked in the app), every weekly class.
export function classesOn(date, { weekly = CLASSES, oneOffs = studioDates() } = {}){
  const on = studioOn(date, weekly, oneOffs), src = on.length ? on : weekly.map(c => ({ t: "", name: c.name })), seen = new Set(), out = [];
  for (const c of src) { if (!c || !c.name || seen.has(c.name)) continue; seen.add(c.name); const w = weekly.find(x => x.name === c.name), o = oneOffs.find(e => e && e.start === date && e.name === c.name); out.push({ name: c.name, label: shortClass(c.short || c.name), t: on.length ? String(c.t || "") : "", teacher: String((o && o.teacher) || (w && w.teacher) || "") }); }
  return out;
}
let clsSel = "";
let about = "", tag = "", keepMore = true; // the ＋ ⭐ list folds again once she has picked from it, so 📝 Teacher said is back in reach
function draw(){
  if (!box) return; const keep = (document.querySelector(".sl-add input") || {}).value || "", open = keepMore && !!(box.querySelector && box.querySelector(".sl-more[open]"));
  box.innerHTML = sheetHtml({ date: cur, today: todayStr(), practice: S.practice, list: compDances(), goals: dayGoals(), isClassDay: classDay, more: moreGroups(), said: classNotes(S.corrections, { date: cur }), about, tag, label: aboutLabel, classes: classesOn(cur), cls: clsSel });
  const inp = document.querySelector(".sl-add input"); if (inp && keep) inp.value = keep; const m = box.querySelector && box.querySelector(".sl-more"); if (m && open) m.open = true;
  const on = box.querySelector && box.querySelector(".sl-day.on"); if (on && on.scrollIntoView) on.scrollIntoView({ inline: "center", block: "nearest" });
}
export function renderStudioNudge(){ renderTeacherNotes(); const el = $("#studioNudge"); if (!el) return; const h = nudgeHtml(nudgeDays(S.practice, todayStr(), classDay), todayStr()); el.hidden = !h; el.innerHTML = h; }
export function openStudioLog(date){
  const today = todayStr(); cur = DATE.test(String(date)) && logDays(today).includes(date) ? date : today;
  box = document.createElement("div"); box.className = "sl"; openStage("🏫 ✏️ Studio log", [box], `<button class="btn coral" onclick="closeStage()">✓ Done</button>`); draw();
}
async function save(date, patch){ await storeSet("practice", date, withStudio(S.practice[date], patch)); draw(); renderStudioNudge(); renderStones(); }
const now = () => studioRec(S.practice, cur);
function slDay(d){ if (!logDays(todayStr()).includes(d)) return; cur = d; clsSel = ""; about = ""; draw(); }
// A class chip: she was there (the day's log) and the next note is from it; a second tap takes both back.
async function slCls(i){ const c = classesOn(cur)[i]; if (!c) return; const have = now().classes, was = have.includes(c.name) && clsSel === c.name; clsSel = was ? "" : c.name; await save(cur, { classes: was ? have.filter(x => x !== c.name) : [...new Set([...have, c.name])] }); }
async function slDance(id){ await save(cur, { dances: toggleIn(now().dances, id) }); }
async function slSkill(id){ keepMore = false; try { await save(cur, { skills: toggleIn(now().skills, id) }); } finally { keepMore = true; } }
async function slFeel(k){ await save(cur, { feel: now().feel === k ? "" : k }); }
async function slNote(v){ await save(cur, { note: String(v || "").trim() }); toast("✓"); }
async function slSkip(d){ if (!DATE.test(String(d))) return; await storeSet("practice", d, withStudio(S.practice[d], { skip: true })); renderStudioNudge(); toast("👌"); }
function slAbout(id){ about = about === id ? "" : id; draw(); }
function slTag(t){ tag = tag === t ? "" : t; draw(); }
async function slSaidAdd(){
  const inp = document.querySelector(".sl-add input"), btn = document.querySelector(".sl-add .btn"), to = btn ? btn.getAttribute("data-about") || "" : about, k = btn ? btn.getAttribute("data-cls") || "" : clsSel;
  if (!to && !k) return toast("🏫 ?"); const kc = classesOn(cur).find(c => c.name === k);
  const rec = noteRec({ about: to, cls: k, teacher: kc ? kc.teacher : "", text: (inp || {}).value, tag, date: cur, id: "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) }); if (!rec) return toast("📝 ?");
  if (inp) inp.value = ""; tag = ""; await storeSet("corrections", rec.id, rec); draw(); renderTeacherNotes(); renderStones(); toast("📝 ✓");
}
async function slSaidDel(id){ const c = S.corrections[id]; if (!c || !c.studio) return; await storeSet("corrections", id, { ...c, deleted: true }); draw(); renderTeacherNotes(); }
export function renderTeacherNotes(){
  const el = $("#teacherNotes"); if (!el) return; const today = todayStr();
  const h = notesCardHtml(classNotes(S.corrections, { open: true }), { today, practice: S.practice, classToday: classDay(today), label: aboutLabel }); el.hidden = !h; el.innerHTML = h;
}
async function tnWorked(id){ const today = todayStr(), rec = S.practice[today] || { done: [], note: "", runs: [] }, have = Array.isArray(rec.notes) ? rec.notes : [], on = !have.includes(id); await storeSet("practice", today, { ...rec, notes: on ? [...have, id] : have.filter(x => x !== id) }); renderTeacherNotes(); renderStones(); toast(on ? "💪 That's a stepping stone 🪜" : "↩"); }
async function tnGot(id){ const c = await closeCorrection(id); renderTeacherNotes(); renderStones(); if (c) toast("Got it! ✅ Show your teacher 🌟", 2400); }
expose({ openStudioLog, slCls, slDay, slDance, slSkill, slFeel, slNote, slSkip, slAbout, slTag, slSaidAdd, slSaidDel, tnWorked, tnGot });
