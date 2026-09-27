// Home tab: next event, week strip, today's plan, top-3 corrections, open to-dos.
import { $, esc, fmt, todayStr, daysUntil, growAll, toast, expose } from "../util.js";
import { CLASSES, HOME_DAYS } from "../data.js";
import { S, storeSet, dances, events, nextEvent } from "../store.js";

let editTop3=false;
export function homeEditTop3(v){ editTop3=v; renderHome(); }
function renderHome(){
  const ne=nextEvent();
  if(ne){ const d=daysUntil(ne.start); $("#nextTitle").textContent=ne.name; $("#nextMeta").textContent=fmt(ne.start)+(ne.end!==ne.start?" – "+fmt(ne.end):"")+" · "+ne.type; $("#nextDays").textContent=d<=0?"now":d; $("#stickerDays").textContent=d<=0?"0":d; $("#stickerWhat").textContent=ne.name; }
  // week strip
  const now=new Date(); const dow=now.getDay(); const monday=new Date(now); monday.setDate(now.getDate()-((dow+6)%7));
  const names=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]; let h="";
  for(let i=0;i<7;i++){ const d=new Date(monday); d.setDate(monday.getDate()+i); const ds=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); const wd=d.getDay();
    let evs=CLASSES.filter(c=>c.day===wd).map(c=>`<div class="ev">${esc(c.name.replace("Mini ","").replace("Mini/Jr ",""))}</div>`).join("");
    if(HOME_DAYS[wd]) evs+=`<div class="ev home">Home: ${HOME_DAYS[wd]}</div>`;
    events().filter(e=>ds>=e.start&&ds<=e.end).forEach(e=>evs+=`<div class="ev comp">${esc(e.name)}</div>`);
    Object.values(S.todos).filter(t=>t.due===ds&&!t.done).forEach(t=>evs+=`<div class="ev other">${esc(t.text)}</div>`);
    h+=`<div class="day ${ds===todayStr()?"today":""}"><b>${names[i]} ${d.getDate()}</b>${evs}</div>`; }
  $("#homeWeek").innerHTML=h; const td=$("#homeWeek .day.today"); if(td) $("#homeWeek").scrollLeft=Math.max(0,td.offsetLeft-8);
  const hp=HOME_DAYS[dow]; const cls=CLASSES.filter(c=>c.day===dow);
  $("#todayPlan").innerHTML=(cls.length?`<p>Studio: ${cls.map(c=>`<b>${esc(c.name)}</b> ${c.t}`).join(" · ")}</p>`:"")+(hp?`<p>Home: <b>${hp}</b>. <button class="btn sm aqua" onclick="showPage('practice')">Open the checklist</button></p>`:cls.length?`<p class="muted">Studio day. Rest at home.</p>`:`<p class="muted">Rest day. Stretch lightly if you want, or don't.</p>`);
  const top3=(S.settings.top3||dances()[0].corrections.slice(0,3));
  if(!editTop3){ $("#top3").innerHTML=top3.map((c,i)=>`<div class="ro"><b>${i+1}.</b> ${esc(c)}</div>`).join("")+`<button class="btn sm ghost" style="margin-top:6px" onclick="homeEditTop3(true)">✏️ Edit</button>`; }
  else { $("#top3").innerHTML=`<textarea id="top3ta">${esc(top3.join("\n"))}</textarea><div class="row" style="margin-top:6px"><button class="btn sm coral" onclick="saveTop3()">Save</button><button class="btn sm ghost" onclick="homeEditTop3(false)">Cancel</button></div>`; growAll($("#top3")); }
  $("#gameBest").textContent=S.settings.gameBest||0;
  const open=Object.entries(S.todos).filter(([,t])=>!t.done).sort((a,b)=>(a[1].due||"9").localeCompare(b[1].due||"9")).slice(0,5);
  $("#homeTodos").innerHTML=open.length?open.map(([id,t])=>`<div class="check"><input type="checkbox" onchange="toggleTodo('${id}')"><span>${esc(t.text)}${t.due?` <span class="chip sun">${fmt(t.due)}</span>`:""}</span></div>`).join(""):`<p class="muted small">Nothing open. Nice.</p>`;
}

async function saveTop3(){ const arr=$("#top3ta").value.split("\n").map(x=>x.trim()).filter(Boolean).slice(0,3); editTop3=false; await storeSet("settings","main",{...S.settings,top3:arr}); renderHome(); toast("Saved"); }
export { renderHome, saveTop3 };
expose({ saveTop3, homeEditTop3 });
