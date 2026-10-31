// The Sunday sheet in the app (Build 3 of the Oct 28 review). The film-review plan item (Sundays; plan15 / plan-spring
// rules.review) opens it from practice mode: watch the last run → "what went well" (Sofia says it, Mom types one word) →
// ✓ It showed / Not yet for the week's fix → an optional ＋ Note → done. Saved once a week in the family space:
// settings.sunday[the plan week's Monday] = { went, fix: "yes" | "no" | "", fixId, note, done } (schema 50; keyed by the plan
// week since schema 51, Build 4: the sheet reviews a Sunday, and that Sunday closes the plan week that began the Monday before —
// opened on a weekday it is still last Sunday's sheet, titled "Last Sunday (date)"). On Sundays Today carries the week's fix
// row with its state (renderSundayCard). Closing one of Ms. Brittany's pinned notes goes through Grown-ups → Skills & awards
// (PIN_MSG); the memory pin offers to close once every solo cue is known (pinOffers). Pure parts up top (tested in Node).
import { $, esc, todayStr, toast, expose, fmt } from "./util.js";
import { S, setSettings, storeSet, normalizeSunday, dances } from "./store.js";
import { planWeekKey, weekFixOrPick, seenCount, fixOnVideo, FIX_SEEN_TO_MOVE, TAG_EMOJI, pinnedOpen, isOpen } from "./corrections.js";
import { knownCues } from "./ready.js";
import { openStage } from "./stage.js";

export const WENT_MAX = 60, NOTE_MAX = 200;
export const PIN_MSG = "📌 Ms. Brittany's homework: a grown-up checks it off in Grown-ups → Skills & awards";
export const isSunday = (date) => new Date(date + "T00:00:00").getDay() === 0;
const shift = (iso, n) => { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + n); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
// The Sunday a sheet opened on `date` reviews: the date itself on a Sunday, else the Sunday just gone (last Sunday's sheet).
export const reviewSunday = (date) => shift(date, -new Date(date + "T00:00:00").getDay());
// The record's key: the plan week that Sunday closes, as its Monday (corrections.planWeekKey; the same key as the week's fix).
export const sundayOf = (date) => planWeekKey(reviewSunday(date));
export const EMPTY = { went: "", fix: "", fixId: "", note: "", done: "" };
// The fix the sheet asks about: the one of the week that Sunday closes. On a Sunday that is this week's fix; on the days after,
// the app has moved on to the new week's, so: the week's fix while settings still hold it, the one already answered on this
// sheet, a teacher's pinned fix (it carries over), else none, and the step is skipped (the Oct 30 re-audit: a weekday sheet
// asked about this week's fix and filed the answer under last week). Pure but for weekFixOrPick on a Sunday.
export function sheetFix(date, settings = S.settings, corrections = S.corrections){
  if (isSunday(date)) return weekFixOrPick(date);
  const key = sundayOf(date); const ok = (c) => c && !c.deleted ? c : null; const w = (settings || {}).weekFix;
  if (w && w.week === key && ok((corrections || {})[w.id])) return corrections[w.id];
  const rec = sundayRecords(settings)[key]; if (rec && rec.fixId && ok((corrections || {})[rec.fixId])) return corrections[rec.fixId];
  return pinnedOpen(corrections || {})[0] || null;
}
export const sundayRecords = (settings = S.settings) => normalizeSunday((settings || {}).sunday);
export const sundayRecord = (settings, date) => sundayRecords(settings)[sundayOf(date)] || null;
// Where the week's sheet stands: { key, sunday, rec, done, started, label, bits } (bits = the short facts for a card or a line).
export function sundayState(settings, date){
  const key = sundayOf(date); const rec = sundayRecords(settings)[key] || null; const done = !!(rec && rec.done); const started = !!rec;
  const bits = []; if (rec && rec.went) bits.push(`went well: “${rec.went}”`); if (rec && rec.fix) bits.push(rec.fix === "yes" ? "the fix showed ✓" : "the fix: not yet"); if (rec && rec.note) bits.push("a note");
  return { key, sunday: reviewSunday(date), rec, done, started, label: done ? "done " + fmt(rec.done) : started ? "started" : "not yet", bits };
}
// The sheet's title: "Sunday sheet" on a Sunday, "Last Sunday (Nov 1)" on the days after it.
export const sheetTitle = (date) => isSunday(date) ? "🎬 Sunday sheet" : `🎬 Last Sunday (${fmt(reviewSunday(date)).replace(/^\w+, /, "")})`;
// What a pinned teacher note has earned: ready to be checked off once it showed on two videos in a row, or — the memory
// note — once every cue of the solo is known in Pause & Predict (`known` = ready.js knownCues for the solo).
export function pinOffers(pins, { seen = {}, known = null } = {}){
  return (pins || []).filter(isOpen).map(c => {
    const n = seenCount(seen, c.id); const twice = n >= FIX_SEEN_TO_MOVE;
    const memoryDone = c.tag === "memory" && !!known && known.of > 0 && known.known >= known.of;
    const why = twice ? `on ${FIX_SEEN_TO_MOVE} videos in a row` : memoryDone ? `all ${known.of} moves known in Pause & Predict` : "";
    return { id: c.id, text: c.text, tag: c.tag, source: c.source || "teacher", seen: n, twice, memoryDone, ready: twice || memoryDone, why };
  });
}

// ---- DOM ----
const soloKnown = () => { const d = dances().find(x => x.id === "solo"); return d ? knownCues(d.cues, (S.settings || {}).predict) : null; };
export const offersNow = () => pinOffers(pinnedOpen(S.corrections), { seen: S.settings.fixSeen, known: soloKnown() });
// The card on Today, Sundays only: the sheet's state, the week's fix with ✓ It showed / Not yet, the door to the sheet.
export function renderSundayCard(date = todayStr()){
  const el = $("#sundayCard"); if (!el) return; if (!isSunday(date)) { el.hidden = true; el.innerHTML = ""; return; }
  const st = sundayState(S.settings, date); const fix = weekFixOrPick(date); const n = fix ? seenCount(S.settings.fixSeen, fix.id) : 0; const twice = n >= FIX_SEEN_TO_MOVE;
  el.hidden = false;
  el.innerHTML = `<div class="row"><b class="grow">🎬 Sunday film review</b><span class="chip ${st.done ? "mint" : "sun"}">${st.done ? "✅ " : ""}${esc(st.label)}</span></div>
    <div class="small muted">${st.bits.length ? esc(st.bits.join(" · ")) : "Watch the last run with a grown-up: what went well first, then one fix."}</div>
    ${fix ? `<div class="fix-text" style="margin-top:6px">${TAG_EMOJI[fix.tag] || "✨"} <b>This week's fix:</b> ${esc(fix.text)}${fix.pinned ? ` <span class="small muted">· 📌 ${esc(fix.source || "teacher")}</span>` : ""}</div>
      <div class="row fix-video"><span class="small muted grow">${twice && fix.pinned ? "📹 On two videos in a row: a grown-up checks it off" : `📹 On the video: ${n} of ${FIX_SEEN_TO_MOVE} in a row`}</span>${twice && fix.pinned ? "" : `<button class="btn sm coral" onclick="fixVideo('${fix.id}',true)">✓ It showed</button><button class="btn sm ghost" onclick="fixVideo('${fix.id}',false)">Not yet</button>`}</div>`
    : `<div class="row" style="margin-top:6px"><span class="small muted grow">No fix picked this week yet.</span><button class="btn sm ghost" onclick="pickFix()">Pick one</button></div>`}
    <div class="row" style="margin-top:8px"><button class="btn sm ${st.done ? "ghost" : "coral"}" onclick="openSunday()">🎬 ${st.done ? "Open the Sunday sheet" : "Sunday sheet"}</button></div>`;
}

// The sheet: four small steps, each saved as it goes, so a half-filled sheet survives closing it.
const SD = { step: 1, msg: "" };
const STEPS = ["Last run", "What went well", "The fix", "A note"];
const today = () => todayStr();
const cur = () => sundayRecord(S.settings, today()) || { ...EMPTY };
async function save(patch){ const key = sundayOf(today()); const all = { ...sundayRecords(S.settings) }; all[key] = { ...(all[key] || EMPTY), ...patch }; await setSettings({ sunday: normalizeSunday(all) }); }
const bar = () => `<div class="sd-steps">${STEPS.map((s, i) => `<span class="${i + 1 < SD.step ? "done" : i + 1 === SD.step ? "on" : ""}"></span>`).join("")}</div><div class="small muted">Step ${SD.step} of ${STEPS.length} · ${STEPS[SD.step - 1]}</div>`;
const nav = (back, next) => `<div class="row sd-nav">${back ? `<button class="btn sm ghost" onclick="sdStep(${SD.step - 1})">‹ Back</button>` : ""}<span class="grow"></span>${next || ""}</div>`;
function fixStep(r){
  const fix = sheetFix(today()); if (!fix && !isSunday(today())) return `<div class="sd-q">🎯 Last week's fix</div><p class="small muted">The app has moved on to this week's fix, so this step is skipped. On Sunday it asks on the day.</p>${nav(true, `<button class="btn sm coral" onclick="sdStep(4)">Next ›</button>`)}`;
  if (!fix) return `<div class="sd-q">🎯 This week's fix</div><p class="small muted">No fix picked for this week yet.</p><div class="row"><button class="btn sm coral" onclick="sdPickFix()">Pick one</button></div>${nav(true, `<button class="btn sm ghost" onclick="sdStep(4)">Skip ›</button>`)}`;
  const n = seenCount(S.settings.fixSeen, fix.id); const twice = n >= FIX_SEEN_TO_MOVE; const mem = offersNow().find(o => o.memoryDone);
  const recorded = r.fixId === fix.id && r.fix ? `<div class="small">Today: <b>${r.fix === "yes" ? "it showed ✓" : "not yet"}</b></div>` : "";
  return `<div class="sd-q">🎯 Did the fix show on the video?</div><div class="fix-text">${TAG_EMOJI[fix.tag] || "✨"} ${esc(fix.text)}${fix.pinned ? ` <span class="small muted">· 📌 ${esc(fix.source || "teacher")}</span>` : ""}</div>
    <div class="small muted" style="margin-top:4px">📹 On the video: ${n} of ${FIX_SEEN_TO_MOVE} in a row${twice && fix.pinned ? " · ready for Ms. Brittany's check" : ""}</div>${recorded}
    ${twice && fix.pinned ? `<div class="sd-pin small">${esc(PIN_MSG)}</div><div class="row"><button class="btn sm violet" onclick="closeStage();openGrownups('skillcheck')">🔒 Grown-ups</button></div>` : `<div class="row" style="margin-top:6px"><button class="btn sm coral" onclick="sdFix(true)">✓ It showed</button><button class="btn sm ghost" onclick="sdFix(false)">Not yet</button></div>`}
    ${mem && mem.id !== fix.id ? `<div class="sd-pin small">🧠 All ${soloKnown().of} moves known: Ms. Brittany's memory note can be checked off in Grown-ups → Skills &amp; awards.</div>` : ""}
    ${SD.msg ? `<div class="sd-msg small">${esc(SD.msg)}</div>` : ""}${nav(true, `<button class="btn sm ${r.fix ? "coral" : "ghost"}" onclick="sdStep(4)">Next ›</button>`)}`;
}
function render(){
  const el = $("#sundayArea"); if (!el) return; const r = cur();
  if (SD.step === 0) { const st = sundayState(S.settings, today());
    el.innerHTML = `<div class="sd-q">✅ Sunday sheet ${esc(st.label)}</div><div class="sd-sum"><div>✨ Went well: <b>${r.went ? esc(r.went) : "—"}</b> <button class="lnk" onclick="sdStep(2)">change</button></div><div>🎯 The fix: <b>${r.fix === "yes" ? "it showed ✓" : r.fix === "no" ? "not yet" : "—"}</b> <button class="lnk" onclick="sdStep(3)">change</button></div><div>📝 Note: <b>${r.note ? esc(r.note) : "—"}</b> <button class="lnk" onclick="sdStep(4)">change</button></div></div><p class="small muted">Next Sunday: a new sheet. Mom's card in Grown-ups shows this one all week.</p>`; return; }
  let body;
  if (SD.step === 1) body = `<div class="sd-q">🎬 Watch the last run together</div><p>Today's clip, or the solo once more right now. Say the good things first.</p><div class="row"><button class="btn sm violet" onclick="openPlayer('solo')">🎵 Play the solo</button></div>${nav(false, `<button class="btn sm coral" onclick="sdStep(2)">Watched it ›</button>`)}`;
  else if (SD.step === 2) body = `<div class="sd-q">✨ What went well?</div><p class="small muted">Sofia says it. Mom types one word.</p><input type="text" id="sdWent" maxlength="${WENT_MAX}" value="${esc(r.went)}" placeholder="one word, like “arms”" autocomplete="off">${nav(true, `<button class="btn sm coral" onclick="sdWent()">Next ›</button>`)}`;
  else if (SD.step === 3) body = fixStep(r);
  else body = `<div class="sd-q">📝 A note? (optional)</div><p class="small muted">Anything to remember for next week.</p><textarea id="sdNote" maxlength="${NOTE_MAX}" rows="3" placeholder="e.g. film the second half next time">${esc(r.note)}</textarea>${nav(true, `<button class="btn coral" onclick="sdDone()">✅ Done</button>`)}`;
  el.innerHTML = bar() + body;
  if (SD.step === 2) setTimeout(() => { const i = $("#sdWent"); if (i && i.focus) i.focus(); }, 30);
}
export function openSunday(step){ SD.msg = ""; SD.step = step || (cur().done ? 0 : 1); render(); openStage(sheetTitle(today()), [$("#sundayArea")], `<button class="btn ghost" onclick="closeStage()">Close</button>`); }
function go(n){ SD.msg = ""; SD.step = Math.max(0, Math.min(STEPS.length, +n || 0)); render(); const b = $("#stageBody"); if (b) b.scrollTop = 0; }
async function went(){ const v = String((($("#sdWent") || {}).value) || "").replace(/\s+/g, " ").trim().slice(0, WENT_MAX); await save({ went: v }); go(3); }
async function fix(ok){
  const f = sheetFix(today()); if (!f) return go(4); const r = await fixOnVideo(f.id, ok); await save({ fix: ok ? "yes" : "no", fixId: f.id });
  SD.msg = r.moved ? "Twice on video! ✅ Next fix: " + r.moved.text.slice(0, 40) : r.ask ? "Twice in a row 🎉 A grown-up checks it off in Grown-ups" : ok ? `📹 ${r.count} of ${FIX_SEEN_TO_MOVE}: one more video to go` : "Okay, the count starts again";
  render();
}
async function pickOne(){ if (typeof window.pickFix === "function") await window.pickFix(); render(); }
async function done(){
  const v = String((($("#sdNote") || {}).value) || "").replace(/\s+/g, " ").trim().slice(0, NOTE_MAX); const d = today(); await save({ note: v, done: d });
  // The plan's film-review item is this sheet: finishing it ticks the item on a Sunday (practice mode's Done is then a no-op).
  if (isSunday(d)) { const r = S.practice[d] || { done: [], note: "", runs: [] }; const have = Array.isArray(r.done) ? r.done : []; if (!have.includes("film-review")) await storeSet("practice", d, { ...r, done: [...have, "film-review"] }); }
  toast("🎬 Sunday sheet done ✓"); go(0); renderSundayCard();
}
export function initSunday(){ document.addEventListener("stageclosed", () => { const a = $("#sundayArea"); if (a) a.style.display = "none"; }); }
expose({ openSunday, sdStep: go, sdWent: went, sdFix: fix, sdDone: done, sdPickFix: pickOne });
