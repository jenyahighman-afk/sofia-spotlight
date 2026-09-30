// Today tab: one big card (what's on, Start, countdown, streak, Play), this week's fix, then the week strip.
import { $, esc, fmt, todayStr, daysUntil, expose, toast } from "../util.js";
import { CLASSES, HOME_DAYS, PRACTICE_ITEMS } from "../data.js";
import { S, events, nextEvent } from "../store.js";
import { computeStreak, dayCounts } from "../streak.js";
import { currentWeekFix, pickWeekFix, TAG_EMOJI } from "../corrections.js";
import { checkBadges } from "../badges.js";

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
  const streak=computeStreak({practice:S.practice,classes:CLASSES,events:events(),totalItems:PRACTICE_ITEMS.length,today});
  $("#todayCard").innerHTML=`${what}
    <div class="today-actions"><button class="btn coral big-btn" onclick="showPage('practice')">${doneToday?"✅ Done today":"▶ "+verb}</button><button class="btn big-btn" onclick="showPage('play')">🎮 Play</button></div>
    <div class="row today-meta"><span class="chip ${streak?"coral":""}">🔥 ${streak}-day streak</span><span id="todayCount"></span></div>`;
  if(ne){ const d=daysUntil(ne.start); $("#todayCount").innerHTML=`<span class="chip sun">🎀 ${d<=0?"Today":d+" days"} · ${esc(ne.name)}</span>`; }
  // this week's fix
  const fix=currentWeekFix(today); const open=Object.values(S.corrections).some(c=>!c.deleted&&c.status!=="done");
  if(fix) $("#weekFix").innerHTML=`<div class="row"><span class="chip violet">${TAG_EMOJI[fix.tag]||"✨"} This week's fix</span><span class="grow"></span><button class="btn sm ghost" onclick="showMe('${fix.id}')">Show me</button></div><div class="fix-text">${esc(fix.text)}</div>`;
  else if(open) $("#weekFix").innerHTML=`<div class="row"><span class="grow">${dow===0?"🎬 Film review day. Pick this week's fix.":"No fix picked this week yet."}</span><button class="btn sm coral" onclick="pickFix()">Pick one</button></div>`;
  else $("#weekFix").innerHTML=`<span class="small muted">No open notes. Add one from a dance.</span>`;
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
async function pickFix(){ const c=await pickWeekFix(); if(!c) return toast("Nothing open to pick"); toast("This week: "+c.text.slice(0,40)); renderHome(); checkBadges(); }
export { renderHome, pickFix };
expose({ pickFix });
