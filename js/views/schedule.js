// Schedule tab: weekly classes table, month calendar, the printable week view, and the .ics export.
import { $, esc, todayStr, dateStr, toast, saveBlob } from "../util.js";
import { CLASSES, HOME_DAYS, SEASON } from "../data.js";
import { S, events } from "../store.js";
import { buildICS } from "../ics.js";

function renderClasses(){ const names=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]; $("#classTable").innerHTML=`<thead><tr><th>Day</th><th>Time</th><th>Class</th><th>Room</th></tr></thead><tbody>`+CLASSES.map(c=>`<tr><td>${names[c.day]}</td><td>${c.t}</td><td>${esc(c.name)}</td><td>${c.room}</td></tr>`).join("")+`</tbody>`; }

let calMonth=new Date(new Date().getFullYear(),new Date().getMonth(),1);
let calMode="month"; // "month" | "week"
let weekStart=mondayOf(new Date());
function mondayOf(d){ const m=new Date(d.getFullYear(),d.getMonth(),d.getDate()); m.setDate(m.getDate()-((m.getDay()+6)%7)); return m; }

function renderCal(){
  $("#calLabel").textContent=calMonth.toLocaleDateString(undefined,{month:"long",year:"numeric"});
  const y=calMonth.getFullYear(), m=calMonth.getMonth(); const first=new Date(y,m,1); const startDow=(first.getDay()+6)%7; const dim=new Date(y,m+1,0).getDate();
  let h=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(n=>`<div class="hd">${n}</div>`).join("");
  for(let i=0;i<startDow;i++) h+=`<div class="d off"></div>`;
  for(let day=1;day<=dim;day++){ const d=new Date(y,m,day); const ds=y+"-"+String(m+1).padStart(2,"0")+"-"+String(day).padStart(2,"0"); const wd=d.getDay(); let ev="";
    CLASSES.filter(c=>c.day===wd).forEach(c=>ev+=`<div class="ev">${esc(c.name.replace(/Mini\/Jr |Mini /,""))}</div>`);
    if(HOME_DAYS[wd]) ev+=`<div class="ev home">Home practice</div>`;
    events().filter(e=>ds>=e.start&&ds<=e.end).forEach(e=>ev+=`<div class="ev comp">${esc(e.name)}</div>`);
    Object.values(S.todos).filter(t=>t.due===ds).forEach(t=>ev+=`<div class="ev other">${esc(t.text)}</div>`);
    h+=`<div class="d ${ds===todayStr()?"today":""}"><b>${day}</b>${ev}</div>`; }
  $("#calGrid").innerHTML=h;
}

// One week, Monday to Sunday, every class with its time — prints as seven columns.
function renderWeek(){
  const end=new Date(weekStart); end.setDate(end.getDate()+6);
  const opt={month:"short",day:"numeric"}; $("#calLabel").textContent=weekStart.toLocaleDateString(undefined,opt)+" – "+end.toLocaleDateString(undefined,{...opt,year:"numeric"});
  const names=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]; let h="";
  for(let i=0;i<7;i++){ const d=new Date(weekStart); d.setDate(weekStart.getDate()+i); const ds=dateStr(d); const wd=d.getDay(); let items="";
    CLASSES.filter(c=>c.day===wd).sort((a,b)=>a.t.localeCompare(b.t)).forEach(c=>items+=`<div class="ev"><b>${esc(c.t)}</b> ${esc(c.name)} <span class="muted">· ${esc(c.room)}</span></div>`);
    if(HOME_DAYS[wd]) items+=`<div class="ev home">Home: ${esc(HOME_DAYS[wd])}</div>`;
    events().filter(e=>ds>=e.start&&ds<=e.end).forEach(e=>items+=`<div class="ev comp">${esc(e.name)}</div>`);
    Object.values(S.todos).filter(t=>t.due===ds&&!t.done).forEach(t=>items+=`<div class="ev other">To-do: ${esc(t.text)}</div>`);
    h+=`<div class="wd ${ds===todayStr()?"today":""}"><b>${names[i]} <span class="muted">${d.getDate()}</span></b>${items||`<div class="muted small">—</div>`}</div>`; }
  $("#weekGrid").innerHTML=h;
}

function renderCalendar(){ const week=calMode==="week"; $("#calGrid").hidden=week; $("#weekGrid").hidden=!week; $("#viewMonth").classList.toggle("coral",!week); $("#viewMonth").classList.toggle("ghost",week); $("#viewWeek").classList.toggle("coral",week); $("#viewWeek").classList.toggle("ghost",!week); week?renderWeek():renderCal(); }
function step(dir){ if(calMode==="week"){ weekStart=new Date(weekStart); weekStart.setDate(weekStart.getDate()+7*dir); } else calMonth=new Date(calMonth.getFullYear(),calMonth.getMonth()+dir,1); renderCalendar(); }
function setMode(m){ calMode=m; if(m==="week") weekStart=mondayOf(calMonth.getMonth()===new Date().getMonth()&&calMonth.getFullYear()===new Date().getFullYear()?new Date():calMonth); else calMonth=new Date(weekStart.getFullYear(),weekStart.getMonth(),1); renderCalendar(); }

async function exportIcs(){
  try{ const ics=buildICS({classes:CLASSES,events:events(),season:SEASON}); await saveBlob(new Blob([ics],{type:"text/calendar;charset=utf-8"}),"sofia-spotlight.ics"); toast("Calendar file ready"); }
  catch(e){ console.warn(e); toast("Couldn't build the calendar file",2500); }
}

export function initSchedule(){
  $("#calPrev").onclick=()=>step(-1);
  $("#calNext").onclick=()=>step(1);
  $("#viewMonth").onclick=()=>setMode("month");
  $("#viewWeek").onclick=()=>setMode("week");
  $("#printCal").onclick=()=>{ $("#p-schedule").classList.add("print-target"); window.print(); setTimeout(()=>$("#p-schedule").classList.remove("print-target"),500); };
  $("#exportIcs").onclick=exportIcs;
}
export { renderClasses, renderCal, renderWeek, renderCalendar, exportIcs };
