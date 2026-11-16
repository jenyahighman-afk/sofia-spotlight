// 🌟 Look how far I've come (1.79.0, Jenya Nov 14: "what is the quick and easy way for her to see her progress in app or on
// paper?" and "add the print button in the app"). One page from what the app already keeps: her stepping stones, the days
// she danced in the last four weeks, each competition dance, each goal with its first and newest picture, and her teachers'
// notes. It opens from 🪜 My stepping stones on Today; 🖨️ Print puts the same page on one sheet of paper. Nothing new is
// stored. progressData and progressHtml are pure (tested in Node).
import { esc, todayStr, expose, toast } from "./util.js";
import { S, dances } from "./store.js";
import { stones, danceProgress, workingIds, goalRow, workedDates } from "./working.js";
import { shiftDate, mondayKey, isDone } from "./corrections.js";
import { openStage } from "./stage.js";
import { tipFor } from "./wisdom.js";

const DATE = /^\d{4}-\d{2}-\d{2}$/, WEEKS = 4;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const short = (d, now = todayStr()) => { const t = new Date(d + "T00:00:00"); return isNaN(t) ? "" : t.toLocaleDateString("en-US", String(d).slice(0, 4) === String(now).slice(0, 4) ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" }); };
// Did she dance or work on something that day, at home or at the studio? Pure.
export function activeDay(r){
  if (!r) return false; const s = r.studio || {}, n = (a) => Array.isArray(a) ? a.length : 0;
  return n(r.runs) + n(r.done) + n(r.skills) + n(r.notes) + n(s.dances) + n(s.skills) + n(s.classes) > 0;
}
// Everything the page shows. Pure.
export function progressData({ practice = {}, photos = {}, corrections = {}, settings = {}, list = [], rows = null } = {}, today = todayStr()){
  const st = stones({ practice, photos, corrections }, today);
  const start = shiftDate(mondayKey(today), -7 * (WEEKS - 1)), days = [];
  for (let i = 0; i < 7 * WEEKS; i++) { const d = shiftDate(start, i); days.push({ d, on: activeDay(practice[d]), future: d > today, today: d === today }); }
  const all = Object.keys(practice || {}).filter(d => DATE.test(d) && activeDay(practice[d])).sort();
  const goals = (rows || []).map(r => ({ id: r.id, n: r.n, ic: r.ic, how: r.how || "", stones: workedDates(practice, r.id).length, first: r.shots[0] || null, last: r.shots.length > 1 ? r.shots[r.shots.length - 1] : null }));
  const notes = Object.values(corrections || {}).filter(c => c && !c.deleted && c.studio);
  return { today, stones: st, days, activeDays: days.filter(x => x.on).length, everDays: all.length, since: all[0] || "", dances: danceProgress(list, { practice, corrections, settings }, today), goals, notes: { got: notes.filter(isDone).length, open: notes.filter(c => !isDone(c)).length }, tip: tipFor(today) };
}
// The page. Pure.
export function progressHtml(p){
  const a = p.stones.all, bits = [[a.dances, "🎵", "dance", "dances"], [a.skills, "⭐", "skill time", "skill times"], [a.notes, "💪", "note worked on", "notes worked on"], [a.photos, "📷", "picture", "pictures"], [a.fixes, "✅", "fix done", "fixes done"]].filter(b => b[0]).map(b => `<span>${b[1]} ${plural(b[0], b[2], b[3])}</span>`).join("");
  const grid = `<div class="pg-grid" aria-hidden="true">${["M", "T", "W", "T", "F", "S", "S"].map(w => `<small>${w}</small>`).join("")}${p.days.map(x => `<i class="${x.on ? "on" : ""}${x.future ? " fut" : ""}${x.today ? " now" : ""}"></i>`).join("")}</div>`;
  const dn = p.dances.map(r => { const did = [r.runs ? `🎵 ${plural(r.runs, "time", "times")} at home` : "", r.studio ? `🏫 ${plural(r.studio, "time", "times")} at the studio` : ""].filter(Boolean).join(" · ") || "🎵 Not danced here yet";
    const more = [r.fixesAll ? `✅ ${r.fixesDone} of ${plural(r.fixesAll, "fix", "fixes")} done` : "", r.parts ? `🧠 ${r.known} of ${plural(r.parts, "part", "parts")} by heart` : ""].filter(Boolean).join(" · ");
    return `<div class="pg-row"><b>${esc(r.n)}</b><span>${did}</span>${more ? `<span>${more}</span>` : ""}${r.fixesAll ? `<span class="pg-bar"><i style="width:${Math.round(100 * r.fixesDone / r.fixesAll)}%"></i></span>` : ""}</div>`; }).join("");
  const pic = (s, lab) => s ? `<figure><img src="${esc(s.url)}" alt=""><figcaption>${lab} · ${esc(short(s.date))}</figcaption></figure>` : "";
  const gl = p.goals.map(g => `<div class="pg-goal"><div class="pg-row"><b>${g.ic} ${esc(g.n)}</b><span>${g.stones ? "🪜 " + plural(g.stones, "stepping stone", "stepping stones") : "🪜 Your first stepping stone is waiting"}${g.how ? " · " + esc(g.how) : ""}</span></div>${g.first ? `<div class="pg-pics">${pic(g.first, "Start")}${g.last ? `<span class="pg-arrow">➜</span>${pic(g.last, "Now")}` : ""}</div>` : ""}</div>`).join("");
  const nt = p.notes.got + p.notes.open ? `<h3>📝 From my teachers</h3><div class="pg-row"><span>✅ ${plural(p.notes.got, "note", "notes")} I got · 💪 ${plural(p.notes.open, "note", "notes")} I'm working on</span></div>` : "";
  return `<div class="pg-head"><h2>🌟 Look how far I've come</h2><small>${esc(short(p.today))}${p.since ? ` · dancing here since ${esc(short(p.since))}` : ""}</small></div>
    <div class="pg-big"><b>${a.n}</b><span>stepping ${a.n === 1 ? "stone" : "stones"} so far${p.stones.week.n ? ` · ${p.stones.week.n} this week` : ""}</span></div>${bits ? `<div class="pg-bits">${bits}</div>` : ""}
    <h3>📅 My last ${WEEKS} weeks</h3>${grid}<p class="pg-line">${p.activeDays ? `I danced on <b>${plural(p.activeDays, "day", "days")}</b>. Every dot is a day I showed up.` : "Every dot will be a day I showed up. The first one is waiting."}</p>
    <div class="pg-cols">${dn ? `<div class="pg-col"><h3>💃 My dances</h3>${dn}${nt}</div>` : nt ? `<div class="pg-col">${nt}</div>` : ""}${gl ? `<div class="pg-col"><h3>⭐ My skills</h3>${gl}</div>` : ""}</div>
    <p class="pg-tip">💬 ${esc(p.tip)}</p><p class="pg-proud">What I'm proud of: <span></span></p>
    <p class="pg-foot">Every little bit counts. This is how a dance gets to look easy.</p>`;
}
// ---- DOM ----
const build = () => { const working = workingIds(S.settings); return progressHtml(progressData({ practice: S.practice, photos: S.photos, corrections: S.corrections, settings: S.settings, list: dances(), rows: working.map(id => goalRow(id, { working })).filter(Boolean) })); };
export function openProgress(){ const box = document.createElement("div"); box.className = "pg"; box.innerHTML = build(); openStage("🌟 My progress", [box], `<button class="btn sun" onclick="pgPrint()">🖨️ Print</button><button class="btn coral" onclick="closeStage()">✓ Done</button>`); }
// 🖨️ The page on one sheet: a copy goes straight under <body>, everything else is hidden while the print window is open.
function pgPrint(){
  if (typeof window.print !== "function") return toast("This phone can't print from here. Open the app in the browser and try again.", 3500);
  const old = document.querySelector("[data-print-sheet]"); if (old) old.remove();
  const sheet = document.createElement("div"); sheet.className = "pg pg-sheet"; sheet.setAttribute("data-print-sheet", ""); sheet.innerHTML = build(); document.body.appendChild(sheet); document.body.classList.add("print-sheet");
  const done = () => { document.body.classList.remove("print-sheet"); sheet.remove(); window.removeEventListener("afterprint", done); };
  window.addEventListener("afterprint", done); setTimeout(() => { try { window.print(); } catch (e) { done(); toast("Couldn't open the print window", 3000); } }, 150); setTimeout(done, 60000);
}
expose({ openProgress, pgPrint });
