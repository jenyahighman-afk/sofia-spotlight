// Today tab: one big card (what's on, Start, countdown, streak, Play), this week's fix, then the week strip.
import { $, esc, fmt, todayStr, daysUntil, expose, toast } from "../util.js";
import { CLASSES, HOME_DAYS, PRACTICE_ITEMS } from "../data.js";
import { S, events, nextEvent, storeSet, dances } from "../store.js";
import { todayPick, chunkLabel, shortName } from "../memo.js";
import { renderDayPlan } from "../dayplan.js";
import { computeStreak, dayCounts, skipsLeft } from "../streak.js";
import { cardsFor, moveOfDay, TIRED } from "../habit.js";
import { openPracticeMode } from "../pmode.js";
import { todayNudge } from "../moments.js";
import { currentWeekFix, pickWeekFix, TAG_EMOJI } from "../corrections.js";
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

const short = (n) => n.replace(/^Mini\/Jr |^Mini |^Jr /, "");
function renderHome(){
  const ne=nextEvent(); const today=todayStr();
  if(ne){ const d=daysUntil(ne.start); $("#stickerDays").textContent=d<=0?"0":d; $("#stickerWhat").textContent=ne.name; }
  const dow=new Date().getDay(); const cls=CLASSES.filter(c=>c.day===dow).sort((a,b)=>a.t.localeCompare(b.t)); const hp=HOME_DAYS[dow];
  const rec=S.practice[today]; const doneToday=dayCounts(rec,PRACTICE_ITEMS.length);
  let what, verb;
  if(cls.length){ what=`<div class="today-what">🏫 Studio day</div><div class="today-sub">${cls.map(c=>`<b>${esc(c.t)}</b> ${esc(short(c.name))}`).join("<br>")}</div>`; verb="Stretch"; }
  else if(hp){ what=`<div class="today-what">🏠 Home practice</div><div class="today-sub">${esc(hp)}</div>`; verb="Start"; }
  else { what=`<div class="today-what">🌙 Rest day</div><div class="today-sub">Stretch a little if you want.</div>`; verb="Stretch"; }
  const ctx={practice:S.practice,classes:CLASSES,events:events(),totalItems:PRACTICE_ITEMS.length,today}; const streak=computeStreak(ctx); const skips=skipsLeft(ctx);
  const bites=(rec&&Array.isArray(rec.bites))?rec.bites:[]; const mp=todayPick(dances(),S.settings,today); const memo=mp?{danceId:mp.dance.id,label:mp.run?`${shortName(mp.dance)} · full run`:`${shortName(mp.dance)} · ${mp.chunk.n}`}:null; const cards=cardsFor(today,{skills:S.skills,bites,memo}); const tired=bites.includes("tired");
  const fullDone=!!rec&&dayCounts({done:rec.done,total:rec.total},PRACTICE_ITEMS.length);
  $("#todayCard").innerHTML=`${what}
    <div class="row today-meta"><span class="chip ${streak?"coral":""}">🔥 ${streak}-day streak</span><span class="chip">${skips} free skip${skips===1?"":"s"} left</span><span id="todayCount"></span></div>
    <div class="pick">${bites.length?"Pick another? ✨":"Pick one 👇"}</div>
    <div class="choice ${cards.length>3?"four":""}">${cards.map(c=>`<button class="choice-card ${c.done?"done":""}" onclick="${c.go}"><span class="ic">${c.done?"✅":c.ic}</span><b>${esc(c.title)}</b><small>${esc(c.sub)}</small></button>`).join("")}</div>
    <div class="tired">${tired?`<span>😴 Rest counted. Streak safe ✓</span>`:`<span>😴 Tired today? That's allowed.</span><div class="row"><button class="btn sm ghost" onclick="habitTired('stretch')">🧘 2-min stretch</button><button class="btn sm ghost" onclick="habitTired('picture')">🎧 Picture the dance</button></div>`}</div>
    ${(()=>{ const n=todayNudge(); return n?`<div class="nudge"><span class="grow">${n.emoji} <b>${esc(n.text)}</b> Make it a moment?</span><button class="btn sm coral" onclick="openMoments('${n.key}')">📸 Yes</button><button class="lnk" onclick="mmLater().then(()=>this.closest('.nudge').remove())">later</button></div>`:""; })()}
    <div class="row" style="margin-top:8px"><button class="btn sm ghost" onclick="showPage('practice')">${fullDone?"✅ Full practice done":(hp?"▶ Full practice":"Practice list")}</button><button class="btn sm ghost" onclick="showPage('play')">🎮 All games</button><button class="btn sm ghost" onclick="openMoments()">📸 Moment</button></div>${todayMode().mode==="comp"?`<div class="small" style="margin-top:6px">🏆 Comp mode: no new tricks. Clean runs. Sleep.</div>`:""}`;
  renderNews(); renderPet(); renderAdvent(); renderDares(); renderGlowNudge(); renderDayPlan(); renderComp(); renderBites(); renderMindCard(); applyPalette();
  if(ne){ const d=daysUntil(ne.start); $("#todayCount").innerHTML=`<span class="chip sun">🎀 ${d<=0?"Today":d+" days"} · ${esc(ne.name)}</span>`; }
  // this week's fix
  const fix=currentWeekFix(today); const open=Object.values(S.corrections).some(c=>!c.deleted&&c.status!=="done");
  if(fix) $("#weekFix").innerHTML=`<div class="row"><span class="chip violet">${TAG_EMOJI[fix.tag]||"✨"} This week's fix</span><span class="grow"></span><button class="btn sm ghost" onclick="showMe('${fix.id}')">Show me</button></div><div class="fix-text">${esc(fix.text)}</div>`;
  else if(open) $("#weekFix").innerHTML=`<div class="row"><span class="grow">${dow===0?"🎬 Film review day. Pick this week's fix.":"No fix picked this week yet."}</span><button class="btn sm coral" onclick="pickFix()">Pick one</button></div>`;
  else $("#weekFix").innerHTML=`<span class="small muted">No open notes. Add one from a dance.</span>`;
  renderGoalReminder();
  // week strip
  const now=new Date(); const monday=new Date(now); monday.setDate(now.getDate()-((dow+6)%7));
  const names=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]; let h="";
  for(let i=0;i<7;i++){ const d=new Date(monday); d.setDate(monday.getDate()+i); const ds=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); const wd=d.getDay();
    let evs=CLASSES.filter(c=>c.day===wd).map(c=>`<div class="ev">${esc(short(c.name))}</div>`).join("");
    if(HOME_DAYS[wd]) evs+=`<div class="ev home">Home: ${esc(HOME_DAYS[wd])}</div>`;
    events().filter(e=>ds>=e.start&&ds<=e.end).forEach(e=>evs+=`<div class="ev comp">${esc(e.name)}</div>`);
    if(dayCounts(S.practice[ds],PRACTICE_ITEMS.length)) evs+=`<div class="ev done">✅ practiced</div>`;
    h+=`<div class="day ${ds===today?"today":""}"><b>${names[i]} ${d.getDate()}</b>${evs}</div>`; }
  $("#homeWeek").innerHTML=h; const td=$("#homeWeek .day.today"); if(td) $("#homeWeek").scrollLeft=Math.max(0,td.offsetLeft-8);
}
// Today's "Show me a move": one technique item with its animated dancer, timed, as a bite.
function habitMove(){ const m=moveOfDay(todayStr()); if(!m) return toast("No move today"); openPracticeMode([{...m,kind:"tech"}],{title:"✨ Move of the day",bite:"move"}); }
// Tired day: a short lying-down option that still counts. Never a lecture.
async function habitTired(kind){ const t=TIRED[kind]; if(!t) return; const date=todayStr(); const rec=S.practice[date]||{done:[],note:"",runs:[]}; await storeSet("practice",date,{...rec,tired:kind}); openPracticeMode(t.items,{title:t.title,bite:"tired"}); }
async function pickFix(){ const c=await pickWeekFix(); if(!c) return toast("Nothing open to pick"); toast("This week: "+c.text.slice(0,40)); renderHome(); checkBadges(); }
export { renderHome, pickFix };
expose({ pickFix, habitMove, habitTired });
