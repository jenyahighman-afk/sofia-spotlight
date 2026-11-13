// Today tab: ONE card. Since 1.60.0 (Jenya, Nov 5) it asks less: ▶ My solo and ▶ My trio on every day ("Dance it once",
// about 2 minutes each), counts that only go up, the Videos · Memorize · trick row, and on a home day the whole session one
// link away; a class day asks nothing at home. The next finish line is folded under it (the season card inside). Since 1.52.0 Today
// fits one screen: this module still draws the pieces that moved — the pet, the Pass, What's new and the week strip on Me,
// ✨ Pick one extra and More for today on Play, this week's fix on Practice — so every page stays current on each render.
import { $, esc, fmt, todayStr, daysUntil, expose, toast } from "../util.js";
import { CLASSES } from "../data.js";
import { S, events, nextEvent, storeSet, dances, studioDates, calendarOnly } from "../store.js";
import { todayPick, chunkLabel, shortName } from "../memo.js";
import { planDone, trioDone, danced, danceDays, danceCount } from "../streak.js";
import { cardsFor, trickCard, moveOfDay, TIRED, KNEES } from "../habit.js";
import { renderSeasonCard, trickFocus, checkpointsToShow, checkpointTicks, activePlan } from "../season15.js";
import { planFor } from "../planToday.js";
import { studioOn } from "../studio.js";
import { dayKindNow, weekdayOf } from "../daykind.js";
import { openPracticeMode } from "../pmode.js";
import { todayNudge, shortEventName } from "../moments.js";
import { isCueTable } from "../cues.js";
import { renderPassCard } from "../pass.js";
import { currentWeekFix, pickWeekFix, TAG_EMOJI, seenCount, fixOnVideo, FIX_SEEN_TO_MOVE } from "../corrections.js";
import { checkBadges } from "../badges.js";
import { renderComp, todayMode } from "../mode.js";
import { renderBites } from "../bites.js";
import { renderMindCard } from "../mind.js";
import { applyPalette } from "../palette.js";
import { renderPet } from "../pet.js";
import { renderNews } from "../news.js";
import { renderSundayCard } from "../sunday.js";
import { todayGoal, todaySkillHtml, workedDates, goalHow, soloDanceNow } from "../working.js";
import { topFixes } from "../corrections.js";

const short = (n) => n.replace(/^Mini\/Jr |^Mini |^Jr /, "");
// The one line under the big buttons (1.60.0, Jenya Nov 5): counts that only go up — the days she danced her solo or her trio
// and the dances she ran from the player — then How ready?. Nothing here counts days without dancing. Pure.
export function metaLine({ days = 0, dances = 0 } = {}){
  const count = days ? `<span class="today-streak">⭐ ${days} dance day${days === 1 ? "" : "s"}</span>${dances ? ` · 🎵 ${dances} dance${dances === 1 ? "" : "s"}` : ""}` : `⭐ Your first dance day starts with one tap`;
  return `<div class="today-line small today-meta">${count} · <button class="lnk" onclick="openReady()">How ready?</button></div>`;
}
// The folded finish line's one line (season15 nextCheckpoint): book it, today, or how many days. A passed one shows its date
// and words only (1.60.0): whether she made it is Mom's card's question, not Today's. Pure.
export function finishLine(cp, today = todayStr()){
  if (!cp) return "🏁 My finish lines";
  if (cp.state === "book") return `🎯 <b>Book it:</b> ${esc(cp.t)}`;
  if (cp.state === "passed") return `🎯 <b>${esc(fmt(cp.d))}</b> · ${esc(cp.t)}`;
  if (cp.state === "today") return `🎯 <b>Today!</b> ${esc(cp.t)}`;
  const n = daysUntil(cp.d); return `🎯 <b>${esc(fmt(cp.d))}</b> <span class="muted">(${n} day${n === 1 ? "" : "s"})</span> · ${esc(cp.t)}`;
}
// The best time on a home day (Jenya, Oct 30: she practised right after eating and got a stomach ache, or waited until it was late):
// a small snack after school, the dancing about 45 minutes later, dinner after it. Shown until she has danced.
export const BEST_TIME = "🍌 Snack first, dance 45 min later, dinner after";
// The big buttons (1.60.0): ▶ My solo and ▶ My trio, the same on every day. Each opens the player with the music playing
// (player.js { once: true }); the track played to its end is one dance, logged without questions. A dance done today shows ✅
// and can be danced again. Show day keeps its checklist. Pure: solo / trio = danced today.
export function danceButtons({ kind = "", solo = false, trio = false } = {}){
  if (kind === "show") return `<button class="btn coral big-btn today-start" onclick="buddyScroll('#compCard')">🎒 Show day checklist</button>`;
  const b = (id, name, done) => `<button class="btn ${done ? "ghost" : "coral"} big-btn" onclick="openPlayer('${id}',{once:true})">${done ? "✅" : "▶"} ${name}</button>`;
  return `<div class="today-once-lab small">💃 Practice a dance <span class="today-once-how">Dance it once ✨ about 2 minutes</span></div><div class="today-once">${b("solo", "My solo", solo)}${b("trio", "My trio", trio)}</div>`;
}
// The Pass and Toolkit p.2 say "When the app says ⭐ Plan done, put a sticker on": the app says it once her solo is danced today.
export const PLAN_DONE = "⭐ Plan done: you danced your solo today";
export const PLAN_DONE_QUIET = "⭐ Plan done for today";
// What a day asks at home (1.60.0, Jenya Nov 5: class days are free; on a home day one thing she picks, about 10 minutes, with
// the whole session offered and not expected). Pure: the words under the day's name.
export const DAY_ASK = { home: "Pick one thing, about 10 minutes. That's all.", homeDone: "That's your one thing for today ⭐", studio: "No home practice on class days.", rest: "Nothing planned. Dance if you feel like it." };
// The whole session's link on a home day: its length, or how far she is once she has started. Pure.
export function sessionLink({ kind = "", mins = 0, nDone = 0, total = 0 } = {}){
  if (kind !== "home" || !total) return "";
  const words = nDone >= total ? `✅ The whole session is done` : nDone ? `📋 Keep going with the session · ${nDone} of ${total} ›` : `📋 The whole session · ${mins} min ›`;
  return `<button class="lnk today-fun" onclick="showPage('practice');openPracticeMode()">${words}</button>`;
}
// One thing to think about while she dances (1.68.0): this week's fix, or the newest open one of the solo, with its dance's
// name and Show me. "" when there is none. Pure.
export function focusLine(fix, danceName = ""){
  if (!fix) return ""; return `<div class="today-focus"><span class="tf-lab">🎯 One thing to think about${danceName ? ` in your ${esc(danceName.toLowerCase())}` : ""}</span><span class="tf-text">${TAG_EMOJI[fix.tag] || "✨"} ${esc(fix.text)}</span><button class="lnk" onclick="showMe('${fix.id}')">Show me ›</button></div>`;
}
function renderHome(){
  const ne=nextEvent(); const today=todayStr();
  if(ne){ const d=daysUntil(ne.start); $("#stickerDays").textContent=d<=0?"0":d; $("#stickerWhat").textContent=shortEventName(ne.name); } // "Winter Showcase", not "(Winter Formal)" too
  // Studio day = a weekly class or a one-off date (a booked solo rehearsal, a make-up class). The kind of day comes from
  // daykind.js (the same answer Play, the week strip and the Schedule use), from the date string, never the clock (Build 4).
  const dow=weekdayOf(today); const cls=studioOn(today,CLASSES,studioDates()); const kind=dayKindNow(today); const home=kind==="home";
  const rec=S.practice[today]; const pd=planDone(rec); const td=trioDone(rec);
  // Today's session (planToday): its length and how far she is, for the whole session's link on a home day.
  const plan=planFor(today); const mins=Math.round(plan.reduce((a,i)=>a+(+i.secs||0),0)/60); const nDone=((rec&&rec.done)||[]).filter(id=>plan.some(i=>i.id===id)).length; const total=kind==="rest"||kind==="show"?0:plan.length;
  // 1.60.0 (Jenya, Nov 5): a class day asks nothing at home; a home day asks one thing she picks, with the whole session
  // one link away; every day offers ▶ My solo and ▶ My trio.
  let what, sub;
  if(kind==="show"){ const ev=nextEvent(); what="🌟 Show day"; sub=`<div class="today-sub">${esc(ev?shortEventName(ev.name):"The show")} ★ No practice today: dance your best on stage!</div>`; }
  else if(cls.length){ what="🏫 Studio day"; sub=`<div class="today-sub">${cls.map(c=>`<b>${esc(c.t)}</b> ${esc(short(c.name))}${c.oneOff?" ✨":""}`).join("<br>")}</div><div class="today-sub">${DAY_ASK.studio}</div>`; }
  else if(home){ what="🏠 Home day"; sub=`<div class="today-sub">${pd||td?DAY_ASK.homeDone:DAY_ASK.home}</div>${pd||td?"":`<div class="today-sub today-when">${BEST_TIME}</div>`}`; }
  else { what="🌙 Rest day"; sub=`<div class="today-sub">${DAY_ASK.rest}</div>`; }
  const dayKind=kind==="show"?"🌟 Show day":cls.length?"🏫 Studio day":home?"🏠 Home day":"🌙 Rest day";
  // 🧠 Memorize opens the dance whose turn it is today (memo.todayPick: the solo and the trio take turns): the Memorize sheet for a
  // dance with a cue table, its Five steps on Dances otherwise (the trio; habit.js's own rule), the solo when nothing is picked.
  const mp=todayPick(dances(),S.settings,today); const memoGo=!mp?"openMemorize('solo','chunks')":isCueTable(mp.dance.cues)?`openMemorize('${mp.dance.id}','chunks')`:`showPage('dances');memoFocus('${mp.dance.id}')`;
  // 1.68.0: the week's trick left Today (its button opened a timed Trick Quest station for a trick she had not picked);
  // Play still has it. The two helpers under the dance buttons are Hannah's videos and Memorize.
  // "You danced your solo" only when she ran it; a watched video or a memory step finishes the plan in its own words.
  const ran=((rec&&rec.runs)||[]).some(r=>r&&(!r.danceId||r.danceId==="solo")); const tg=kind==="show"?null:todayGoal(S.settings,today); const skillPick=kind==="show"?"":todaySkillHtml(tg,tg?{dates:workedDates(S.practice,tg.id),today,how:goalHow(tg,{soloDance:soloDanceNow()})[0]||""}:{});
  const ff=kind==="show"?null:(currentWeekFix(today)||topFixes(S.corrections,"solo",1)[0]||null); const fd=ff?dances().find(d=>d.id===ff.danceId):null; const focus=focusLine(ff,fd?shortName(fd):"");
  $("#todayCard").innerHTML=`<div class="today-date small">${esc(fmt(today))} · ${dayKind}</div><div class="today-what">${what}</div>${sub}
    <div class="today-line small dp-line" id="dayPlan" hidden></div>
    ${danceButtons({kind,solo:pd,trio:td})}${pd?`<div class="today-line small today-done">${ran?PLAN_DONE:PLAN_DONE_QUIET}</div>`:""}
    ${focus}
    <div class="today-help"><span class="small muted">Not sure of the steps?</span><button class="btn sm violet" onclick="openVideos()">📹 Videos</button><button class="btn sm violet" onclick="${memoGo}">🧠 Memorize<small>${mp?esc(shortName(mp.dance)):""}</small></button></div>
    ${skillPick}
    ${metaLine({days:danceDays(S.practice),dances:danceCount(S.practice)})}${todayMode().mode==="comp"?`<div class="small" style="margin-top:6px">🏆 Comp mode: no new tricks. Clean runs. Sleep.</div>`:""}${sessionLink({kind,mins,nDone,total})}`;
  // The dated line from plan10 (its headline and note) is off Today since 1.60.0: "That's all." is not followed by a to-do.
  // The line's place stays in the card, hidden; dayplan.js and its ticks are unchanged.
  { const dp=$("#dayPlan"); if(dp){ dp.hidden=true; dp.innerHTML=""; } }
  renderSeasonCard(today);
  // The next finish line is the fold's one line; the season card (✓ Made it, the week, the pinned notes) opens under it.
  // 1.60.0: the line names the next one to come, never one whose day has gone by (those stay inside the fold, with ✓ Made it).
  let cp=null; try{ const list=checkpointsToShow(today,activePlan(today),studioDates(),checkpointTicks()); cp=["today","next","book"].map(st=>list.find(c=>c.state===st)).find(Boolean)||null; }catch(e){ console.warn(e); }
  const sc=$("#seasonCard"); $("#seasonSum").innerHTML=`<span class="fl-text">${finishLine(cp,today)}</span>`; $("#seasonFold").hidden=!cp&&!!(sc&&sc.hidden);
  renderHabit(today,{rec});
  // The other pages' cards drawn from here (1.52.0) each in their own guard, so one error leaves the rest drawn (the re-audit).
  for(const f of [renderNews,renderPet,()=>renderSundayCard(today),renderComp,renderBites,renderMindCard,renderPassCard,applyPalette]){ try{ f(); }catch(e){ console.error("renderHome", e); } }
  // this week's fix
  const fix=currentWeekFix(today); const open=Object.values(S.corrections).some(c=>!c.deleted&&c.status!=="done");
  if(fix) $("#weekFix").innerHTML=`<div class="row"><span class="chip violet">${TAG_EMOJI[fix.tag]||"✨"} This week's fix${fix.pinned?" · 📌 "+esc(fix.source||"teacher"):""}</span><span class="grow"></span><button class="btn sm ghost" onclick="showMe('${fix.id}')">Show me</button></div><div class="fix-text">${esc(fix.text)}</div>${videoRow(fix)}`;
  else if(open) $("#weekFix").innerHTML=`<div class="row"><span class="grow">${dow===0?"🎬 Film review day. Pick this week's fix.":"No fix picked this week yet."}</span><button class="btn sm coral" onclick="pickFix()">Pick one</button></div>`;
  else $("#weekFix").innerHTML=`<span class="small muted">No open notes. Add one from a dance.</span>`;
  // week strip (from today's date string, Monday first); a class on a home weekday makes its home line the memory run (daykind)
  const now=new Date(today+"T00:00:00"); const monday=new Date(now); monday.setDate(now.getDate()-((dow+6)%7));
  const names=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]; let h="";
  for(let i=0;i<7;i++){ const d=new Date(monday); d.setDate(monday.getDate()+i); const ds=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
    let evs=studioOn(ds,CLASSES,studioDates()).map(c=>`<div class="ev ${c.oneOff?"oneoff":""}">${esc(short(c.name))}</div>`).join("");
    calendarOnly().filter(e=>ds>=e.start&&ds<=(e.end||e.start)).forEach(e=>evs+=`<div class="ev other">${esc(e.short||e.name)}${e.pick?"?":""}</div>`);
    if(dayKindNow(ds)==="home") evs+=`<div class="ev home">Home day</div>`; // a class day asks nothing at home (1.60.0)
    events().filter(e=>ds>=e.start&&ds<=e.end).forEach(e=>evs+=`<div class="ev comp">${esc(shortEventName(e.name))}</div>`);
    if(danced(S.practice[ds])) evs+=`<div class="ev done">⭐ danced</div>`;
    h+=`<div class="day ${ds===today?"today":""}"><b>${names[i]} ${d.getDate()}</b>${evs}</div>`; }
  $("#homeWeek").innerHTML=h; weekToToday();
}
// The week strip lives on Me (1.52.0): scrolled while Me was hidden it stayed at Monday (offsetLeft 0), so it also scrolls when Me shows.
function weekToToday(){ const w=$("#homeWeek"), td=$("#homeWeek .day.today"); if(w&&td&&td.offsetLeft) w.scrollLeft=Math.max(0,td.offsetLeft-8); }
if(typeof document!=="undefined"&&document.addEventListener) document.addEventListener("page",e=>{ if(e&&e.detail==="me") setTimeout(weekToToday,0); });
// ✨ Pick one extra: the choice cards (a trick, a game, a move, Memorize it), the tired-day row, the moment nudge and the
// Moment shortcut — on Play since 1.52.0, under the games, so a bite is an extra, never the first thing on Today.
function renderHabit(today,{rec}){
  const el=$("#habitCard"); if(!el) return;
  const bites=(rec&&Array.isArray(rec.bites))?rec.bites:[]; const mp=todayPick(dances(),S.settings,today); const memo=mp?{danceId:mp.dance.id,table:isCueTable(mp.dance.cues),label:mp.run?`${shortName(mp.dance)} · full run`:`${shortName(mp.dance)} · ${mp.chunk.n}`}:null;
  const cards=cardsFor(today,{skills:S.skills,bites,memo,focus:trickFocus(today)}); const tired=bites.includes("tired");
  el.innerHTML=`<div class="row"><b class="grow">✨ Pick one extra</b>${bites.length?`<span class="chip sun">${bites.length} done</span>`:""}</div>
    <div class="choice ${cards.length>3?"four":""}">${cards.map(c=>`<button class="choice-card ${c.done?"done":""}" onclick="${c.go}"><span class="ic">${c.done?"✅":c.ic}</span><b>${esc(c.title)}</b><small>${esc(c.sub)}</small></button>`).join("")}</div>
    <div class="tired">${tired?`<span>😴 Rest counted ✓</span>`:`<span>😴 Tired today? That's allowed.</span><div class="row"><button class="btn sm ghost" onclick="habitTired('stretch')">🧘 2-min stretch</button><button class="btn sm ghost" onclick="habitTired('picture')">🎧 Picture the dance</button></div>`}</div>
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
