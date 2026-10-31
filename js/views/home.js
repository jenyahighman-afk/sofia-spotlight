// Today tab: ONE card with the day's one action — ▶ Start for the home plan, the memory run or Monday's
// watch-and-picture, straight from planToday (Build 2) — the streak and the day off in one line, the dated note, the
// Solo · Trio · Videos · Memorize row; the next finish line folded under it (the season card inside). Since 1.52.0 Today
// fits one screen: this module still draws the pieces that moved — the pet, the Pass, What's new and the week strip on Me,
// ✨ Pick one extra and More for today on Play, this week's fix on Practice — so every page stays current on each render.
import { $, esc, fmt, todayStr, daysUntil, expose, toast } from "../util.js";
import { CLASSES, HOME_DAYS, PRACTICE_ITEMS } from "../data.js";
import { S, events, nextEvent, storeSet, dances, studioDates, calendarOnly } from "../store.js";
import { todayPick, chunkLabel, shortName } from "../memo.js";
import { renderDayPlan } from "../dayplan.js";
import { computeStreak, dayCounts, planDone, skipsLeft, gateOpen } from "../streak.js";
import { cardsFor, moveOfDay, TIRED, KNEES } from "../habit.js";
import { renderSeasonCard, trickFocus, memoryKnees, nextCheckpoint, checkpointTicks, activePlan, daysSinceDance } from "../season15.js";
import { planFor } from "../planToday.js";
import { planSummary } from "../plan.js";
import { studioOn } from "../studio.js";
import { dayKindNow, homeLineNow, weekdayOf } from "../daykind.js";
import { openPracticeMode } from "../pmode.js";
import { todayNudge, shortEventName } from "../moments.js";
import { isCueTable } from "../cues.js";
import { renderPassCard } from "../pass.js";
import { currentWeekFix, pickWeekFix, TAG_EMOJI, seenCount, fixOnVideo, FIX_SEEN_TO_MOVE } from "../corrections.js";
import { checkBadges } from "../badges.js";
import { renderGoalReminder } from "../goals.js";
import { renderComp, todayMode } from "../mode.js";
import { renderBites } from "../bites.js";
import { renderMindCard } from "../mind.js";
import { applyPalette } from "../palette.js";
import { renderPet } from "../pet.js";
import { renderNews } from "../news.js";
import { renderGlowNudge } from "../glow.js";
import { renderSundayCard } from "../sunday.js";

const short = (n) => n.replace(/^Mini\/Jr |^Mini |^Jr /, "");
// The one line under the big button: the streak and the plan's state or the days off left, then How ready? (1.52.0: the
// show countdown is the header's sticker only). Pure.
export function metaLine({ streak = 0, pd = false, safe = false, skips = 0 } = {}){
  const tier = pd ? "⭐ Plan done" : safe ? "✓ Streak safe · solo next" : `${skips} day${skips === 1 ? "" : "s"} off left this week`;
  return `<div class="today-line small today-meta"><span class="${streak ? "today-streak" : ""}">🔥 ${streak}-day streak</span> · ${tier} · <button class="lnk" onclick="openReady()">How ready?</button></div>`;
}
// The folded finish line's one line (season15 nextCheckpoint): book it, did you make it, today, or how many days. Pure.
export function finishLine(cp, today = todayStr()){
  if (!cp) return "🏁 My finish lines";
  if (cp.state === "book") return `🎯 <b>Book it:</b> ${esc(cp.t)}`;
  if (cp.state === "passed") return `🎯 <b>${esc(fmt(cp.d))}</b> · ${esc(cp.t)} · <b>did you make it?</b>`;
  if (cp.state === "today") return `🎯 <b>Today!</b> ${esc(cp.t)}`;
  const n = daysUntil(cp.d); return `🎯 <b>${esc(fmt(cp.d))}</b> <span class="muted">(${n} day${n === 1 ? "" : "s"})</span> · ${esc(cp.t)}`;
}
// The way to the extras once there's nothing left to do on Today (the plan done, or a rest day). Pure.
// `trio`: the solo is done on a home day but the trio isn't (streak.gateOpen): the trio is next, Play after it.
export const funLink = ({ pd = false, kind = "", trio = false } = {}) => pd && trio ? `<button class="lnk today-fun" onclick="showPage('practice')">⭐ Solo done! Now your trio 👯 ›</button>` : pd ? `<button class="lnk today-fun" onclick="showPage('play')">⭐ Plan done! Pick something fun on Play ›</button>` : kind === "rest" ? `<button class="lnk today-fun" onclick="showPage('play')">🎮 Games and extras are on Play ›</button>` : "";
// The best time on a home day (Jenya, Oct 30: she practised right after eating and got a stomach ache, or waited until it was late):
// a small snack after school, the session about 45 minutes later, dinner after it. Shown until the plan is done.
export const BEST_TIME = "🍌 Snack first, dance 45 min later, dinner after";
// Pure: the one action for the day. kind = "watch" | "memory" (a studio day) | "home" | "rest"; nDone / total = today's
// session progress; mins = its length. Returns { label, go, ghost } for the big button.
export function startButton({ kind, mins = 0, nDone = 0, total = 0 }){
  const left = total ? ` · ${Math.max(0, mins)} min` : ""; const prog = nDone && total ? ` <span class="today-prog">${nDone} of ${total}</span>` : ""; // the memory run says its own length
  if (total && nDone >= total) return { label: `✅ Practice done${left}`, go: "showPage('practice')", ghost: true };
  if (kind === "rest") return { label: "🧘 2-min stretch", go: "habitTired('stretch')", ghost: false };
  if (kind === "show") return { label: "🎒 Show day checklist", go: "buddyScroll('#compCard')", ghost: false }; // show day: no session (1.58.0)
  const verb = nDone ? "▶ Keep going" : kind === "watch" ? "▶ Watch + picture" : kind === "memory" ? "▶ Memory run" : "▶ Start practice"; // the Pass's words (1.52.0)
  return { label: verb + left + prog, go: "showPage('practice');openPracticeMode()", ghost: false };
}
function renderHome(){
  const ne=nextEvent(); const today=todayStr();
  if(ne){ const d=daysUntil(ne.start); $("#stickerDays").textContent=d<=0?"0":d; $("#stickerWhat").textContent=shortEventName(ne.name); } // "Winter Showcase", not "(Winter Formal)" too
  // Studio day = a weekly class or a one-off date (a booked solo rehearsal, a make-up class): the home plan is the 
  // memory run, or on Monday (three classes) Hannah's videos and the solo in her head in the car. The kind of day comes from
  // daykind.js (the same answer Play, the week strip and the Schedule use), from the date string, never the clock (Build 4).
  const dow=weekdayOf(today); const cls=studioOn(today,CLASSES,studioDates()); const hp=HOME_DAYS[dow]; const kind=dayKindNow(today); const home=kind==="home";
  const rec=S.practice[today]; const doneToday=dayCounts(rec,PRACTICE_ITEMS.length); const pd=planDone(rec);
  // Today's session (planToday): its length and how far she is, for the one button.
  const plan=planFor(today); const mins=Math.round(plan.reduce((a,i)=>a+(+i.secs||0),0)/60); const nDone=((rec&&rec.done)||[]).filter(id=>plan.some(i=>i.id===id)).length; const total=kind==="rest"?0:plan.length;
  // The button names the home part of a studio day ("▶ Memory run", "▶ Watch + picture"), so the card adds only the
  // classes and, on Monday, "no dancing tonight".
  let what, sub;
  if(cls.length){ what="🏫 Studio day"; sub=`<div class="today-sub">${cls.map(c=>`<b>${esc(c.t)}</b> ${esc(short(c.name))}${c.oneOff?" ✨":""}`).join("<br>")}</div>${kind==="watch"?`<div class="today-sub">🏠 Hannah's videos, then picture the solo in the car. No dancing tonight.</div>`:""}`; }
  // A home day says what its session holds (plan.planSummary), not the weekday's old line from home-days.json.
  else if(kind==="show"){ const ev=nextEvent(); what="🌟 Show day"; sub=`<div class="today-sub">${esc(ev?shortEventName(ev.name):"The show")} ★ No practice today: dance your best on stage!</div>`; }
  else if(home){ what="🏠 Home practice"; sub=`<div class="today-sub">${esc(planSummary(plan)||hp||"Home practice")}</div>${pd?"":`<div class="today-sub today-when">${BEST_TIME}</div>`}`; }
  else { what="🌙 Rest day"; sub=`<div class="today-sub">Stretch a little if you want.</div>`; }
  const dayKind=kind==="show"?"🌟 Show day":kind==="watch"?"📹 Watch day":kind==="memory"?"🏫 Studio day":home?"🏠 Home day":"🌙 Rest day";
  const ctx={practice:S.practice,classes:CLASSES,events:[...events(),...studioDates()],totalItems:PRACTICE_ITEMS.length,today}; const streak=computeStreak(ctx); const skips=skipsLeft(ctx);
  const sb=startButton({kind,mins,nDone,total}); const gd=gateOpen(rec,plan);
  // Two days without the solo (plan rules.maxGap): one line on the card, not only inside the folded finish lines (the re-audit).
  const gap=daysSinceDance(S.practice,today); const maxGap=(((activePlan(today)||{}).rules)||{}).maxGap||2; const gapLine=!pd&&(home||kind==="memory")&&Number.isFinite(gap)&&gap>=maxGap?`<div class="today-line small today-gap">🧠 ${gap} days without your solo: dance it today, even the memory run counts</div>`:"";
  // 🧠 Memorize opens the dance whose turn it is today (memo.todayPick: the solo and the trio take turns): the Memorize sheet for a
  // dance with a cue table, its Five steps on Dances otherwise (the trio; habit.js's own rule), the solo when nothing is picked.
  const mp=todayPick(dances(),S.settings,today); const memoGo=!mp?"openMemorize('solo','chunks')":isCueTable(mp.dance.cues)?`openMemorize('${mp.dance.id}','chunks')`:`showPage('dances');memoFocus('${mp.dance.id}')`;
  // Two tiers, in plain words: ⭐ Plan done (her solo danced) · ✓ Streak safe (a bite, the solo still to do) · days off left.
  $("#todayCard").innerHTML=`<div class="today-date small">${esc(fmt(today))} · ${dayKind}${total?` · ${mins} min`:""}</div><div class="today-what">${what}</div>${sub}
    <div class="today-line small dp-line" id="dayPlan" hidden></div>
    <button class="btn ${sb.ghost?"ghost":"coral"} big-btn today-start" onclick="${sb.go}">${sb.label}</button>
    ${metaLine({streak,pd,safe:doneToday,skips})}${gapLine}
    <div class="today-media"><button class="btn sm violet" onclick="openPlayer('solo')">🎵 Solo</button><button class="btn sm violet" onclick="openPlayer('trio')">🎵 Trio</button><button class="btn sm violet" onclick="openVideos()">📹 Videos</button><button class="btn sm violet" onclick="${memoGo}">🧠 Memorize</button></div>${todayMode().mode==="comp"?`<div class="small" style="margin-top:6px">🏆 Comp mode: no new tricks. Clean runs. Sleep.</div>`:""}${funLink({pd,kind,trio:home&&pd&&!gd})}`;
  // The dated line from plan10 on home days only (the re-audit: "★ Tricks start today" under "No dancing tonight" on a studio day).
  if(home) renderDayPlan(today); else { const dp=$("#dayPlan"); if(dp){ dp.hidden=true; dp.innerHTML=""; } }
  renderSeasonCard(today);
  // The next finish line is the fold's one line; the season card (✓ Made it, the week, the pinned notes) opens under it.
  let cp=null; try{ cp=nextCheckpoint(today,activePlan(today),studioDates(),checkpointTicks()); }catch(e){ console.warn(e); }
  const sc=$("#seasonCard"); $("#seasonSum").innerHTML=`<span class="fl-text">${finishLine(cp,today)}</span>`; $("#seasonFold").hidden=!cp&&!!(sc&&sc.hidden);
  renderHabit(today,{rec,home,pd,gd});
  // The other pages' cards drawn from here (1.52.0) each in their own guard, so one error leaves the rest drawn (the re-audit).
  for(const f of [renderNews,renderPet,renderGlowNudge,()=>renderSundayCard(today),renderComp,renderBites,renderMindCard,renderPassCard,applyPalette]){ try{ f(); }catch(e){ console.error("renderHome", e); } }
  // this week's fix
  const fix=currentWeekFix(today); const open=Object.values(S.corrections).some(c=>!c.deleted&&c.status!=="done");
  if(fix) $("#weekFix").innerHTML=`<div class="row"><span class="chip violet">${TAG_EMOJI[fix.tag]||"✨"} This week's fix${fix.pinned?" · 📌 "+esc(fix.source||"teacher"):""}</span><span class="grow"></span><button class="btn sm ghost" onclick="showMe('${fix.id}')">Show me</button></div><div class="fix-text">${esc(fix.text)}</div>${videoRow(fix)}`;
  else if(open) $("#weekFix").innerHTML=`<div class="row"><span class="grow">${dow===0?"🎬 Film review day. Pick this week's fix.":"No fix picked this week yet."}</span><button class="btn sm coral" onclick="pickFix()">Pick one</button></div>`;
  else $("#weekFix").innerHTML=`<span class="small muted">No open notes. Add one from a dance.</span>`;
  renderGoalReminder();
  // week strip (from today's date string, Monday first); a class on a home weekday makes its home line the memory run (daykind)
  const now=new Date(today+"T00:00:00"); const monday=new Date(now); monday.setDate(now.getDate()-((dow+6)%7));
  const names=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]; let h="";
  for(let i=0;i<7;i++){ const d=new Date(monday); d.setDate(monday.getDate()+i); const ds=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
    let evs=studioOn(ds,CLASSES,studioDates()).map(c=>`<div class="ev ${c.oneOff?"oneoff":""}">${esc(short(c.name))}</div>`).join("");
    calendarOnly().filter(e=>ds>=e.start&&ds<=(e.end||e.start)).forEach(e=>evs+=`<div class="ev other">${esc(e.short||e.name)}${e.pick?"?":""}</div>`);
    const hl=homeLineNow(ds); if(hl) evs+=`<div class="ev home">Home: ${esc(hl)}</div>`;
    events().filter(e=>ds>=e.start&&ds<=e.end).forEach(e=>evs+=`<div class="ev comp">${esc(shortEventName(e.name))}</div>`);
    if(planDone(S.practice[ds])) evs+=`<div class="ev done">⭐ plan done</div>`; else if(dayCounts(S.practice[ds],PRACTICE_ITEMS.length)) evs+=`<div class="ev done">✓ streak safe</div>`;
    h+=`<div class="day ${ds===today?"today":""}"><b>${names[i]} ${d.getDate()}</b>${evs}</div>`; }
  $("#homeWeek").innerHTML=h; weekToToday();
}
// The week strip lives on Me (1.52.0): scrolled while Me was hidden it stayed at Monday (offsetLeft 0), so it also scrolls when Me shows.
function weekToToday(){ const w=$("#homeWeek"), td=$("#homeWeek .day.today"); if(w&&td&&td.offsetLeft) w.scrollLeft=Math.max(0,td.offsetLeft-8); }
if(typeof document!=="undefined"&&document.addEventListener) document.addEventListener("page",e=>{ if(e&&e.detail==="me") setTimeout(weekToToday,0); });
// ✨ Pick one extra: the choice cards (a trick, a game, a move, Memorize it), the tired-day row, the moment nudge and the
// Moment shortcut — on Play since 1.52.0, under the games, so a bite is an extra, never the first thing on Today.
function renderHabit(today,{rec,home,pd,gd}){
  const el=$("#habitCard"); if(!el) return;
  const bites=(rec&&Array.isArray(rec.bites))?rec.bites:[]; const mp=todayPick(dances(),S.settings,today); const memo=mp?{danceId:mp.dance.id,table:isCueTable(mp.dance.cues),label:mp.run?`${shortName(mp.dance)} · full run`:`${shortName(mp.dance)} · ${mp.chunk.n}`}:null;
  const cards=cardsFor(today,{skills:S.skills,bites,memo,focus:trickFocus(today),soloOnly:home&&!gd}); const tired=bites.includes("tired"); // `home` = a real home day (daykind), never a class day
  el.innerHTML=`<div class="row"><b class="grow">✨ Pick one extra</b>${bites.length?`<span class="chip sun">${bites.length} done</span>`:""}</div>
    ${home&&!gd?`<div class="small muted">${pd?"Now your trio 👯 The games open once it's done.":"Your solo first ⭐ These keep the streak, but only the solo finishes the plan."}</div>`:""}
    <div class="choice ${cards.length>3?"four":""}">${cards.map(c=>`<button class="choice-card ${c.done?"done":""}" onclick="${c.go}"><span class="ic">${c.done?"✅":c.ic}</span><b>${esc(c.title)}</b><small>${esc(c.sub)}</small></button>`).join("")}</div>
    <div class="tired">${tired?`<span>😴 Rest counted. Streak safe ✓</span>`:`<span>😴 Tired today? That's allowed.</span><div class="row"><button class="btn sm ghost" onclick="habitTired('stretch')">🧘 2-min stretch</button><button class="btn sm ghost" onclick="habitTired('picture')">🎧 Picture the dance</button></div>`}</div>
    ${(()=>{ const n=todayNudge(); return n?`<div class="nudge"><span class="grow">${n.emoji} <b>${esc(n.text)}</b> Make it a moment?</span><button class="btn sm coral" onclick="openMoments('${n.key}')">📸 Yes</button><button class="lnk" onclick="mmLater().then(()=>this.closest('.nudge').remove())">later</button></div>`:""; })()}
    <div class="row" style="margin-top:8px"><button class="btn sm ghost" onclick="openMoments()">📸 Moment</button></div>`;
}
// Today's "Show me a move": one technique item with its animated dancer, timed, as a bite.
function habitMove(){ const m=moveOfDay(todayStr()); if(!m) return toast("No move today"); openPracticeMode([{...m,kind:"tech"}],{title:"✨ Move of the day",bite:"move"}); }
// Memory + knees (until Nov 9): the knee block counts as the day's trick bite. A light or taper week: picture the solo.
function habitKnees(){ openPracticeMode(KNEES.items,{title:KNEES.title,bite:"trick"}); }
function habitPicture(){ openPracticeMode(TIRED.picture.items,{title:"🎧 Picture the solo",bite:"trick"}); }
// Tired day: a short lying-down option that still counts. Never a lecture.
async function habitTired(kind){ const t=TIRED[kind]; if(!t) return; const date=todayStr(); const rec=S.practice[date]||{done:[],note:"",runs:[]}; await storeSet("practice",date,{...rec,tired:kind}); openPracticeMode(t.items,{title:t.title,bite:"tired"}); }
// One fix at a time: after a filmed run, did the fix show on the video? Twice in a row = on to the next fix
// (Ms. Brittany's pinned notes wait for her to check them off).
function videoRow(fix){
  const n=seenCount(S.settings.fixSeen,fix.id); const twice=n>=FIX_SEEN_TO_MOVE;
  return `<div class="row fix-video"><span class="small muted grow">${twice&&fix.pinned?"📹 On two videos in a row: show Ms. Brittany so she can check it off":`📹 On the video: ${n} of ${FIX_SEEN_TO_MOVE} in a row`}</span>${twice&&fix.pinned?"":`<button class="btn sm coral" onclick="fixVideo('${fix.id}',true)">✓ It showed</button><button class="btn sm ghost" onclick="fixVideo('${fix.id}',false)">Not yet</button>`}</div>`;
}
async function fixVideo(id,ok){ const r=await fixOnVideo(id,ok); if(r.moved) toast("Twice on video! ✅ Next fix: "+r.moved.text.slice(0,40),3200); else if(r.ask) toast("Twice in a row! 🎉 Show Ms. Brittany",3000); else toast(ok?`📹 ${r.count} of ${FIX_SEEN_TO_MOVE}: one more video to go`:"Okay, the count starts again",2400); renderHome(); checkBadges(); }
async function pickFix(){ const c=await pickWeekFix(); if(!c) return toast("Nothing open to pick"); toast("This week: "+c.text.slice(0,40)); renderHome(); checkBadges(); }
export { renderHome, pickFix };
expose({ pickFix, fixVideo, habitMove, habitTired, habitKnees, habitPicture });
