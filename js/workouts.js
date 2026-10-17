// My workouts: saved links to core / flexibility videos (MasterClass, YouTube, anywhere) on the Practice tab, under the
// two 5-minute buttons. A tap opens the video in its own app or the browser; "Done ✓" logs it as a quick session of that
// kind (practice.quick, the same record the 5-minute buttons write, so the day counts, the Today stats and the streak see
// it) and remembers which one (practice.workouts). Storage: workouts/{id} = { name, url, kind, at }, one document per video, up to 8
// (1.20 held them in settings.workouts; store.js saveWorkoutsMove moves those once).
import { $, esc, toast, uid, todayStr, expose } from "./util.js";
import { S, storeSet, storeDel } from "./store.js";
import { checkBadges } from "./badges.js";
import { awardStars } from "./stars.js";

export { KINDS, MAX, normalizeWorkouts, normalizeWorkout, workoutList, hostName, doneToday, logWorkout, progressOf, nextOf, presetsLeft } from "./workouts-core.js";
import { KINDS, MAX, normalizeWorkouts, normalizeWorkout, workoutList, hostName, doneToday, logWorkout, progressOf, nextOf, presetsLeft } from "./workouts-core.js";
import { WORKOUT_PRESETS } from "./data.js";
// The list: the collection, plus anything still held in settings.workouts until the one-time move (store.js saveWorkoutsMove) runs.
export const workouts = (state) => { const col = workoutList(state.workouts); const ids = new Set(col.map(w => w.id)); return [...col, ...normalizeWorkouts(state.settings && state.settings.workouts).filter(w => !ids.has(w.id))].slice(0, MAX); };

// ---- DOM ----
let editing = false; const opened = new Set(); // which workouts were opened today (so Done shows after a tap)
export function renderWorkouts(){
  const el = $("#workoutRow"); if (!el) return; const list = workouts(S); const rec = S.practice[todayStr()] || {}; const left = presetsLeft(WORKOUT_PRESETS, list);
  const sub = (w) => { const bits = [KINDS[w.kind].n]; if (w.n) { const p = progressOf(S.practice, w.id); bits.push(p ? `${p} done` : "new"); bits.push(`next: workout ${nextOf(w, S.practice)} of ${w.n}`); } else bits.push(hostName(w.url)); if (w.mins) bits.push(w.mins + " min"); return bits.join(" · "); };
  const rows = list.map(w => { const done = doneToday(rec, w.id); return `<div class="wo ${done ? "done" : ""}"><a class="wo-open" href="${esc(w.url)}" target="_blank" rel="noopener" onclick="woOpened('${w.id}')"><span class="wo-ic">${done ? "✅" : KINDS[w.kind].ic}</span><span class="grow"><b>${esc(w.name)}</b><span class="small muted"> · ${esc(sub(w))}</span></span></a>${editing ? `<button class="btn sm ghost" onclick="woDel('${w.id}')">✕</button>` : done ? `<span class="chip mint">done</span>` : opened.has(w.id) ? `<button class="btn sm coral" onclick="woDone('${w.id}')">Done ✓</button>` : `<button class="btn sm ghost" onclick="woDone('${w.id}')" title="Already did it? Log it">Did it</button>`}</div>`; }).join("");
  const sugg = left.length && list.length < MAX && !editing ? `<details class="more wo-sugg" ${list.length ? "" : "open"}><summary>✨ Suggested programs (Dance Masterclass) <span class="chip">${left.length}</span></summary>
    <div class="wo-list">${left.map((p, i) => `<div class="wo sugg"><span class="wo-ic">${KINDS[p.kind in KINDS ? p.kind : "strength"].ic}</span><span class="grow"><b>${esc(p.name)}</b><span class="small muted"> · ${p.n ? p.n + " workouts" : ""}${p.mins ? " · " + p.mins + " min" : ""}</span>${p.note ? `<div class="small muted">${esc(p.note)}</div>` : ""}</span><button class="btn sm coral" onclick="woPreset(${WORKOUT_PRESETS.programs.indexOf(p)})">＋</button></div>`).join("")}</div>
    <p class="small muted">One tap adds it to both phones. The site opens on its library; tap the program there, the app keeps count of which workout is next.</p></details>` : "";
  el.innerHTML = `<div class="row wo-head"><span class="field-lab grow">📺 My workouts</span>${list.length < MAX ? `<button class="lnk" onclick="woAdd()">＋ Add a link</button>` : ""}${list.length ? `<button class="lnk" onclick="woEdit()">${editing ? "Done editing" : "Edit"}</button>` : ""}</div>
    ${list.length ? `<div class="wo-list">${rows}</div>` : `<p class="small muted">Core and flexibility programs. Tap one, do today's workout, tap Done: it counts like a 5-minute session.</p>`}${sugg}
    ${editing || !list.length ? "" : `<p class="small muted">Flexibility videos come after a warm-up, never cold. A finished workout counts as that kind of 5-minute session.</p>`}`;
}
function woOpened(id){ opened.add(id); setTimeout(renderWorkouts, 400); }
async function woDone(id){
  const w = workouts(S).find(x => x.id === id); if (!w) return; const date = todayStr(); const next = logWorkout(S.practice[date], w); if (!next) return toast("Already logged today ✓");
  await storeSet("practice", date, next); checkBadges(); awardStars("quick", 100, `${KINDS[w.kind].ic} Workout done`); renderWorkouts();
}
async function woAdd(){
  const url = (prompt("Paste the video's link") || "").trim(); if (!url) return; if (!/^https?:\/\/\S+$/i.test(url)) return toast("That doesn't look like a link");
  const name = (prompt("Name it (short, for the button)", hostName(url)) || "").trim().slice(0, 40); if (!name) return;
  const kind = confirm("Is this a flexibility / stretch video?\nOK = flexibility · Cancel = core / strength") ? "flex" : "strength";
  if (workouts(S).length >= MAX) return toast(`Up to ${MAX} videos`); const w = normalizeWorkout({ id: uid(), name, url, kind, at: new Date().toISOString() }); if (!w) return toast("That doesn't look like a link");
  await storeSet("workouts", w.id, w); toast("Added ✓"); renderWorkouts();
}
async function woPreset(i){
  const p = (WORKOUT_PRESETS.programs || [])[i]; if (!p) return; if (workouts(S).length >= MAX) return toast(`Up to ${MAX} programs`);
  const w = normalizeWorkout({ id: uid(), name: p.name, url: p.url, kind: p.kind, n: p.n, mins: p.mins, at: new Date().toISOString() }); if (!w) return;
  await storeSet("workouts", w.id, w); toast(`${p.name}: added ✓`); renderWorkouts();
}
async function woDel(id){ const w = workouts(S).find(x => x.id === id); if (!w || !confirm(`Remove "${w.name}"?`)) return; if (S.workouts[id]) await storeDel("workouts", id); if (Array.isArray(S.settings.workouts) && S.settings.workouts.some(x => x && x.id === id)) await storeSet("settings", "main", { ...S.settings, workouts: S.settings.workouts.filter(x => !x || x.id !== id) }); renderWorkouts(); }
function woEdit(){ editing = !editing; renderWorkouts(); }
expose({ woOpened, woDone, woAdd, woDel, woEdit, woPreset });
