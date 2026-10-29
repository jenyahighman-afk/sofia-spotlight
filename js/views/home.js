// Today tab (Build 2 of the Oct 28 review): ONE card at the top with the day's one action — ▶ Start for the home plan,
// the 15-minute memory run or Monday's watch-and-picture, straight from planToday — the plan-done state, the streak, the
// countdown, how much of the solo is known and the next checkpoint. Everything else sits under it: the dated plan boxes,
// the season card (ticks), the pet, the Backstage Pass, the extras (choice cards, tired row) and ✨ More for today.
import { $, esc, fmt, todayStr, daysUntil, expose, toast } from "../util.js";
import { CLASSES, HOME_DAYS, PRACTICE_ITEMS } from "../data.js";
import { S, events, nextEvent, storeSet, dances, studioDates } from "../store.js";
import { todayPick, chunkLabel, shortName } from "../memo.js";
import { renderDayPlan } from "../dayplan.js";
import { computeStreak, dayCounts, planDone, skipsLeft } from "../streak.js";
import { cardsFor, moveOfDay, TIRED, KNEES } from "../habit.js";
import { renderSeasonCard, trickFocus, memoryKnees, nextCheckpoint, checkpointTicks, activePlan } from "../season15.js";
import { shortKind, planFor } from "../planToday.js";
import { studioOn } from "../studio.js";
import { openPracticeMode } from "../pmode.js";
import { todayNudge } from "../moments.js";
import { isCueTable } from "../cues.js";
import { readinessNow } from "../ready.js";
import { renderPassCard } from "../pass.js";
import { currentWeekFix, pickWeekFix, TAG_EMOJI, seenCount, fixOnVideo, FIX_SEEN_TO_MOVE } from "../corrections.js";
import { checkBadges } from "../badges.js";
import { renderGoalReminder } from "../goals.js";
import { renderComp, todayMode } from "../mode.js";
import { renderBites } from "../bites.js";
import { renderMindCard } from "../mind.js";
import { applyPalette } from "../palette.js";
import { renderPet } from "../pet.js";
import { renderAdvent } from "../advent.js";
import { renderDares } from "../dares.js";
import { renderNews } from "../news.js";
import { renderGlowNudge } from "../glow.js";
import { renderSundayCard } from "../sunday.js";

const short = (n) => n.replace(/^Mini\/Jr |^Mini |^Jr /, "");
// Build 3: the countdown doors and the dare moved to Play; on Today they show only once the plan is done (a rest day has
// no plan to finish, so they stay open there). Pure.
export const extrasOpen = ({ pd = false, kind = "" } = {}) => !!pd || kind === "rest";
function gateExtras(open){
  for (const id of ["#adventCard", "#dareCard"]) { const e = $(id); if (!e) continue; if (e.dataset) e.dataset.gated = open ? "" : "1"; if (!open) e.hidden = true; } // renderDares (Play too) reads the flag
  const g = $("#extrasGate"); if (g) { g.hidden = open; g.innerHTML = open ? "" : `🎁 The countdown door and today's dare open here once the plan is done ⭐ <button class="lnk" onclick="showPage('play')">They're on Play too</button>`; }
}
// Pure: the one action for the day. kind = "watch" | "memory" (a studio day) | "home" | "rest"; nDone / total = today's
// session progress; mins = its length. Returns { label, go, ghost } for the big button.
export function startButton({ kind, mins = 0, nDone = 0, total = 0 }){
  const left = total && kind !== "memory" ? ` · ${Math.max(0, mins)} min` : ""; const prog = nDone && total ? ` <span class="today-prog">${nDone} of ${total}</span>` : ""; // the memory run says its own length
  if (total && nDone >= total) return { label: `✅ Practice done${left}`, go: "showPage('practice')", ghost: true };
  if (kind === "rest") return { label: "🧘 2-min stretch", go: "habitTired('stretch')", ghost: false };
  const verb = nDone ? "▶ Keep going" : kind === "watch" ? "▶ Watch + picture" : kind === "memory" ? "▶ 15-min memory run" : "▶ Start";
  return { label: verb + left + prog, go: "showPage('practice');openPracticeMode()", ghost: false };
}
function renderHome(){
  const ne=nextEvent(); const today=todayStr();
  if(ne){ const d=daysUntil(ne.start); $("#stickerDays").textContent=d<=0?"0":d; $("#stickerWhat").textContent=ne.name; }
  // Studio day = a weekly class or a one-off date (a booked solo rehearsal, a make-up class): the home plan is the 15-minute
  // memory run, or on Monday (three classes) Hannah's videos and the solo in her head in the car (planToday.shortKind).
  const dow=new Date().getDay(); const cls=studioOn(today,CLASSES,studioDates()); const hp=HOME_DAYS[dow]; const kind=cls.length?shortKind(today):hp?"home":"rest";
  const rec=S.practice[today]; const doneToday=dayCounts(rec,PRACTICE_ITEMS.length); const pd=planDone(rec);
  // Today's session (planToday): its length and how far she is, for the one button.
  const plan=planFor(today); const mins=Math.round(plan.reduce((a,i)=>a+(+i.secs||0),0)/60); const nDone=((rec&&rec.done)||[]).filter(id=>plan.some(i=>i.id===id)).length; const total=kind==="rest"?0:plan.length;
  let what, sub;
  if(cls.length){ what="🏫 Studio day"; sub=`<div class="today-sub">${cls.map(c=>`<b>${esc(c.t)}</b> ${esc(short(c.name))}${c.oneOff?" ✨":""}`).join("<br>")}</div><div class="today-sub">🏠 At home: ${kind==="watch"?"<b>watch Hannah's videos</b>, then picture the solo in the car. No dancing tonight.":"<b>15-minute memory run</b> instead of the full session"}</div>`; }
  else if(hp){ what="🏠 Home practice"; sub=`<div class="today-sub">${esc(hp)}</div>`; }
  else { what="🌙 Rest day"; sub=`<div class="today-sub">Stretch a little if you want.</div>`; }
  const dayKind=kind==="watch"?"📹 Watch day":cls.length?"🏫 Studio day":hp?"🏠 Home day":"🌙 Rest day";
  const ctx={practice:S.practice,classes:CLASSES,events:events(),totalItems:PRACTICE_ITEMS.length,today}; const streak=computeStreak(ctx); const skips=skipsLeft(ctx);
  // Two tiers, in plain words: ⭐ Plan done (her solo danced) · ✓ Streak safe (a bite, the solo still to do) · days off left.
  const tier=pd?`<span class="chip mint">⭐ Plan done</span>`:doneToday?`<span class="chip sun">✓ Streak safe · solo next</span>`:`<span class="chip">${skips} day${skips===1?"":"s"} off left this week</span>`;
  const sb=startButton({kind,mins,nDone,total});
  // The one progress number (ready.js Know bar) and the next checkpoint (season15, tickable on the season card below).
  let soloLine=""; try{ const r=readinessNow(today); if(r.know.of) soloLine=`<div class="today-line small">🧠 Solo: <b>${r.know.n} / ${r.know.of}</b> moves known${r.know.tricky?` · ${r.know.tricky} tricky`:""} <button class="lnk" onclick="openReady()">How ready?</button></div>`; }catch(e){ console.warn(e); }
  let cpLine=""; try{ const cp=nextCheckpoint(today,activePlan(today),studioDates(),checkpointTicks()); if(cp) cpLine=`<div class="today-line small">🎯 ${cp.state==="book"?`<b>Book it:</b> ${esc(cp.t)} <button class="lnk" onclick="openRehearsal('solo')">book a private</button>`:cp.state==="passed"?`<b>${esc(fmt(cp.d))}</b> · ${esc(cp.t)} · did you make it? <button class="lnk" onclick="cpTick('${cp.id}',true)">✓ yes</button>`:`<b>${esc(fmt(cp.d))}</b>${cp.state==="today"?" <b>· today!</b>":` <span class="muted">(${daysUntil(cp.d)} day${daysUntil(cp.d)===1?"":"s"})</span>`} · ${esc(cp.t)}`}</div>`; }catch(e){ console.warn(e); }
  $("#todayCard").innerHTML=`<div class="today-date small">${esc(fmt(today))} · ${dayKind}${total?` · ${mins} min`:""}</div><div class="today-what">${what}</div>${sub}
    <button class="btn ${sb.ghost?"ghost":"coral"} big-btn today-start" onclick="${sb.go}">${sb.label}</button>
    <div class="row today-meta"><span class="chip ${streak?"coral":""}">🔥 ${streak}-day streak</span>${tier}<span id="todayCount"></span></div>
    ${soloLine}${cpLine}
    <div class="row today-media"><button class="btn sm violet" onclick="openPlayer('solo')">🎵 Solo</button><button class="btn sm violet" onclick="openPlayer('trio')">🎵 Trio</button><button class="btn sm violet" onclick="openVideos()">📹 Videos</button><button class="btn sm violet" onclick="openMemorize('solo','chunks')">🧠 Memorize</button></div>${todayMode().mode==="comp"?`<div class="small" style="margin-top:6px">🏆 Comp mode: no new tricks. Clean runs. Sleep.</div>`:""}`;
  renderHabit(today,{rec,hp,pd,cls});
  renderNews(); renderPet(); renderAdvent(); renderDares(); gateExtras(extrasOpen({pd,kind})); renderGlowNudge(); renderDayPlan(); renderSundayCard(today); renderSeasonCard(today); renderComp(); renderBites(); renderMindCard(); renderPassCard(); applyPalette();
  if(ne){ const d=daysUntil(ne.start); $("#todayCount").innerHTML=`<span class="chip sun">🎀 ${d<=0?"Today":d+" days"} · ${esc(ne.name)}</span>`; }
  // this week's fix
  const fix=currentWeekFix(today); const open=Object.values(S.corrections).some(c=>!c.deleted&&c.status!=="done");
  if(fix) $("#weekFix").innerHTML=`<div class="row"><span class="chip violet">${TAG_EMOJI[fix.tag]||"✨"} This week's fix${fix.pinned?" · 📌 "+esc(fix.source||"teacher"):""}</span><span class="grow"></span><button class="btn sm ghost" onclick="showMe('${fix.id}')">Show me</button></div><div class="fix-text">${esc(fix.text)}</div>${videoRow(fix)}`;
  else if(open) $("#weekFix").innerHTML=`<div class="row"><span class="grow">${dow===0?"🎬 Film review day. Pick this week's fix.":"No fix picked this week yet."}</span><button class="btn sm coral" onclick="pickFix()">Pick one</button></div>`;
  else $("#weekFix").innerHTML=`<span class="small muted">No open notes. Add one from a dance.</span>`;
  renderGoalReminder();
  // week strip
  const now=new Date(); const monday=new Date(now); monday.setDate(now.getDate()-((dow+6)%7));
  const names=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]; let h="";
  for(let i=0;i<7;i++){ const d=new Date(monday); d.setDate(monday.getDate()+i); const ds=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); const wd=d.getDay();
    let evs=studioOn(ds,CLASSES,studioDates()).map(c=>`<div class="ev ${c.oneOff?"oneoff":""}">${esc(short(c.name))}</div>`).join("");
    if(HOME_DAYS[wd]) evs+=`<div class="ev home">Home: ${esc(HOME_DAYS[wd])}</div>`;
    events().filter(e=>ds>=e.start&&ds<=e.end).forEach(e=>evs+=`<div class="ev comp">${esc(e.name)}</div>`);
    if(planDone(S.practice[ds])) evs+=`<div class="ev done">⭐ plan done</div>`; else if(dayCounts(S.practice[ds],PRACTICE_ITEMS.length)) evs+=`<div class="ev done">✓ streak safe</div>`;
    h+=`<div class="day ${ds===today?"today":""}"><b>${names[i]} ${d.getDate()}</b>${evs}</div>`; }
  $("#homeWeek").innerHTML=h; const td=$("#homeWeek .day.today"); if(td) $("#homeWeek").scrollLeft=Math.max(0,td.offsetLeft-8);
}
// ✨ Pick one extra: the choice cards (a trick, a game, a move, Memorize it), the tired-day row, the moment nudge and the
// shortcuts — below the plan now, so a bite is an extra, never the first thing on the screen (Build 2).
function renderHabit(today,{rec,hp,pd,cls}){
  const el=$("#habitCard"); if(!el) return;
  const bites=(rec&&Array.isArray(rec.bites))?rec.bites:[]; const mp=todayPick(dances(),S.settings,today); const memo=mp?{danceId:mp.dance.id,table:isCueTable(mp.dance.cues),label:mp.run?`${shortName(mp.dance)} · full run`:`${shortName(mp.dance)} · ${mp.chunk.n}`}:null;
  const cards=cardsFor(today,{skills:S.skills,bites,memo,focus:trickFocus(today),soloOnly:!!hp&&memoryKnees(today)&&!pd}); const tired=bites.includes("tired");
  el.innerHTML=`<div class="row"><b class="grow">✨ Pick one extra</b>${bites.length?`<span class="chip sun">${bites.length} done</span>`:""}</div>
    ${hp&&!pd&&!cls.length?`<div class="small muted">Your solo first ⭐ These keep the streak, but only the solo finishes the plan.</div>`:""}
    <div class="choice ${cards.length>3?"four":""}">${cards.map(c=>`<button class="choice-card ${c.done?"done":""}" onclick="${c.go}"><span class="ic">${c.done?"✅":c.ic}</span><b>${esc(c.title)}</b><small>${esc(c.sub)}</small></button>`).join("")}</div>
    <div class="tired">${tired?`<span>😴 Rest counted. Streak safe ✓</span>`:`<span>😴 Tired today? That's allowed.</span><div class="row"><button class="btn sm ghost" onclick="habitTired('stretch')">🧘 2-min stretch</button><button class="btn sm ghost" onclick="habitTired('picture')">🎧 Picture the dance</button></div>`}</div>
    ${(()=>{ const n=todayNudge(); return n?`<div class="nudge"><span class="grow">${n.emoji} <b>${esc(n.text)}</b> Make it a moment?</span><button class="btn sm coral" onclick="openMoments('${n.key}')">📸 Yes</button><button class="lnk" onclick="mmLater().then(()=>this.closest('.nudge').remove())">later</button></div>`:""; })()}
    <div class="row" style="margin-top:8px"><button class="btn sm ghost" onclick="showPage('play')">🎮 All games</button><button class="btn sm ghost" onclick="openMoments()">📸 Moment</button></div>`;
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
