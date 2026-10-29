// Sofia's Backstage Pass inside the app (data/pass.json: the printed Pass's own words, in 10 short parts). Today shows
// the next part until all ten are read; reading a part = getting its one check right (settings.pass.read[part] = the
// day, schema 49; a star). Then the Bunny's tip of the day from the same pages, picked for the kind of day it is (a
// studio day, a home day, Sunday…), the same tip all day; the Bunny says it once per phone per day, and asks for the
// next part once nothing has been read for two days. Pure parts up top (tested in Node); the card and the sheet below.
import { $, esc, todayStr, toast, expose } from "./util.js";
import { PASS, CLASSES, HOME_DAYS } from "./data.js";
import { S, setSettings, normalizePass, studioDates } from "./store.js";
import { dayNumber } from "./plan.js";
import { shiftDate } from "./corrections.js";
import { studioOn } from "./studio.js";
import { openStage } from "./stage.js";
import { awardStars } from "./stars.js";

export const parts = (pass = PASS) => (pass && Array.isArray(pass.parts) ? pass.parts : []).filter(p => p && p.id && p.n && Array.isArray(p.lines) && p.lines.length && p.check && Array.isArray(p.check.a) && p.check.a.length);
export const readMap = (settings = S.settings) => normalizePass((settings || {}).pass).read;
export const isRead = (settings, id) => !!readMap(settings)[id];
export const nextPart = (settings = S.settings, pass = PASS) => parts(pass).find(p => !isRead(settings, p.id)) || null;
export const readCount = (settings = S.settings, pass = PASS) => parts(pass).filter(p => isRead(settings, p.id)).length;
export const lastRead = (settings = S.settings) => Object.values(readMap(settings)).sort().pop() || "";
export const NAG_DAYS = 2;
// The part the Bunny asks for: the next unread one, once nothing has been read for NAG_DAYS (or ever). null = nothing to ask.
export function nudgeFor(settings, today, pass = PASS){ const p = nextPart(settings, pass); if (!p) return null; const last = lastRead(settings); return !last || last <= shiftDate(today, -NAG_DAYS) ? p : null; }
// The moments a day has, for the tips' `when`: studio (a class or rehearsal today; "after" once it's evening), home (a
// home practice day), rest (neither), sat / sun, morning (before 11) / evening (from 7 pm). "any" always.
export function momentsFor(date, { studio = false, home = false, hour = 12 } = {}){
  const wd = new Date(date + "T00:00:00").getDay(); const m = ["any"];
  if (studio) { m.push("studio"); if (hour >= 17) m.push("after"); } if (home) m.push("home"); if (!studio && !home) m.push("rest");
  if (wd === 6) m.push("sat"); if (wd === 0) m.push("sun"); if (hour < 11) m.push("morning"); if (hour >= 19) m.push("evening"); return m;
}
// Today's tip: one of the pass's tips that fits the day, the same one all day (by date). A tip written for one of the
// day's own moments (studio, home, sun…) comes before the "any" ones, so a studio day gets its water-bottle line.
export function tipFor(date, moments = ["any"], pass = PASS){
  const tips = (pass && Array.isArray(pass.tips) ? pass.tips : []).filter(t => t && t.t); const set = new Set(moments);
  const fits = tips.filter(t => (Array.isArray(t.when) ? t.when : ["any"]).some(w => set.has(w)));
  const special = fits.filter(t => (t.when || []).some(w => w !== "any" && set.has(w))); const pool = special.length ? special : fits;
  return pool.length ? pool[dayNumber(date) % pool.length] : null;
}
export const checkAnswer = (part, i) => !!(part && part.check) && +i === +part.check.ok;

// ---- DOM ----
const KEY = "spotlight:pass"; // per phone: the day the Bunny last said the tip
const local = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { return {}; } };
const save = (patch) => { try { localStorage.setItem(KEY, JSON.stringify({ ...local(), ...patch })); } catch (e) {} };
export const tipSaidToday = (today = todayStr()) => local().tipDay === today;
export function markTipSaid(today = todayStr()){ save({ tipDay: today }); }
export function todayTip(date = todayStr(), hour = new Date().getHours()){
  const studio = studioOn(date, CLASSES, studioDates()).length > 0; const home = !!HOME_DAYS[new Date(date + "T00:00:00").getDay()];
  return tipFor(date, momentsFor(date, { studio, home, hour }));
}
const tipLine = (tip) => tip ? `<div class="pass-tip small">🐰 <b>Tip of the day:</b> ${esc(tip.t)}</div>` : "";
// The card on Today: the next part to read (part n of 10, its minutes), or "all read" with the day's tip.
export function renderPassCard(){
  const el = $("#passCard"); if (!el) return; const ps = parts(); if (!ps.length) { el.hidden = true; el.innerHTML = ""; return; }
  const next = nextPart(); const n = readCount(); const tip = todayTip(); el.hidden = false;
  if (next) el.innerHTML = `<div class="row pass-head"><span class="pass-ic">🎟</span><div class="grow"><b>My Backstage Pass</b><div class="small muted">Part ${n + 1} of ${ps.length} · ${esc(next.e || "")} ${esc(next.n)} · ${next.mins || 1} min</div></div><button class="btn sm coral" onclick="openPass('${next.id}')">Read it ▶</button></div>${tipLine(tip)}`;
  else el.innerHTML = `<div class="row pass-head"><span class="pass-ic">🎟</span><div class="grow"><b>Backstage Pass: all ${ps.length} read ⭐</b></div><button class="btn sm ghost" onclick="openPass()">Read again</button></div>${tipLine(tip)}`;
}
// The sheet: the parts as chips (✓ once read), the open part's lines, its check; a star the first time it's right.
let cur = ""; const picked = {}; // picked[partId] = { i, right } for this open sheet
function renderPass(){
  const el = $("#passArea"); if (!el) return; const ps = parts(); const p = ps.find(x => x.id === cur) || ps[0]; if (!p) return; const read = isRead(S.settings, p.id); const st = picked[p.id] || null; const q = p.check;
  const nav = `<div class="pass-nav">${ps.map(x => `<button class="chip ${x.id === p.id ? "coral" : isRead(S.settings, x.id) ? "mint" : ""}" onclick="passGo('${x.id}')" aria-label="${esc(x.n)}">${isRead(S.settings, x.id) ? "✓ " : ""}${esc(x.e || "")}</button>`).join("")}</div>`;
  const body = `<div class="pass-part"><div class="today-what">${esc(p.e || "")} ${esc(p.n)}</div><div class="small muted">Part ${ps.indexOf(p) + 1} of ${ps.length} · ${p.mins || 1} min${read ? " · read ✓" : ""}</div>${p.lines.map(l => `<p class="pass-line">${esc(l)}</p>`).join("")}</div>`;
  const quiz = `<div class="pass-q"><div class="pass-qt">${esc(q.q)}</div>${q.a.map((a, i) => `<button class="btn ${st && st.i === i ? (st.right ? "coral" : "ghost wrong") : "ghost"} pass-a" onclick="passAnswer(${i})">${esc(a)}</button>`).join("")}<div class="pass-msg small">${!st ? (read ? "You've read this one. Try the check again?" : "Quick check: tap the right answer.") : st.right ? "⭐ " + esc(q.yay || "Yes!") : "🤔 " + esc(q.hint || "Try again.")}</div></div>`;
  const next = ps[ps.indexOf(p) + 1];
  el.innerHTML = nav + body + quiz + (st && st.right && next ? `<div class="row" style="margin-top:8px"><button class="btn sm coral" onclick="passGo('${next.id}')">Next part › ${esc(next.e || "")} ${esc(next.n)}</button></div>` : "");
}
export function openPass(id = ""){ const ps = parts(); if (!ps.length) return; cur = id && ps.some(p => p.id === id) ? id : (nextPart() || ps[0]).id; for (const k of Object.keys(picked)) delete picked[k]; renderPass(); openStage("🎟 " + (PASS.title || "My Backstage Pass"), [$("#passArea")], `<button class="btn ghost" onclick="closeStage()">Done</button>`); }
function go(id){ cur = id; renderPass(); const b = $("#stageBody"); if (b) b.scrollTop = 0; }
async function answer(i){
  const p = parts().find(x => x.id === cur); if (!p) return; const right = checkAnswer(p, i); picked[p.id] = { i, right };
  if (right && !isRead(S.settings, p.id)) { await setSettings({ pass: { read: { ...readMap(S.settings), [p.id]: todayStr() } } }); awardStars("pass", 1, "Backstage Pass: " + p.n); renderPassCard(); }
  else if (right) toast("⭐ Still right!"); renderPass();
}
export function initPass(){ document.addEventListener("stageclosed", () => { const a = $("#passArea"); if (a) a.style.display = "none"; }); }
expose({ openPass, passGo: go, passAnswer: answer });
