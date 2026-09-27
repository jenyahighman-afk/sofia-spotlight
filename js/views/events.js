// Events tab: the season timeline (built-in events + edits), read/edit cards.
import { $, esc, fmt, daysUntil, growAll, toast, uid, expose, roText, edText } from "../util.js";
import { PACKS } from "../data.js";
import { S, storeSet, events, nextEvent } from "../store.js";

export function eventToggle(id){ openEvent=openEvent===id?null:id; editEvent=null; renderEvents(); }
export function eventEdit(id){ editEvent=id; renderEvents(); }
export function initEvents(){
  $("#addEvent").onclick=async()=>{ const n=$("#newEventName").value.trim(); const dt=$("#newEventDate").value; if(!n||!dt) return toast("Name and date needed"); const id="e"+uid(); await storeSet("events",id,{id,name:n,start:dt,end:dt,type:"",dances:"",notes:"",pack:"comp"}); $("#newEventName").value=""; openEvent=id; editEvent=id; };
}
let openEvent=null, editEvent=null;
function renderEvents(){
  if(editEvent&&document.querySelector(`.card[data-id="${editEvent}"] .efield`)) return; // keep an edit in progress when a sync update arrives
  const ne=nextEvent();
  $("#eventList").innerHTML=events().map(e=>{
    const d=daysUntil(e.start); const past=daysUntil(e.end)<0; const opened=openEvent===e.id, editing=editEvent===e.id;
    const head=`<div class="row" onclick="eventToggle('${e.id}')" style="cursor:pointer"><div class="grow"><h3>${esc(e.name)}</h3><div class="small muted">${fmt(e.start)}${e.end!==e.start?" – "+fmt(e.end):""} · ${esc(e.type)}</div></div><span class="chip ${past?"":"sun"}">${past?"done":d<=0?"now":d+" days"}</span></div>`;
    const wrap=(inner)=>`<div class="tl-item ${past?"past":""} ${ne&&ne.id===e.id?"next":""}">${inner}</div>`;
    if(!opened) return wrap(`<div class="card">${head}<div class="small">${esc(e.dances)}</div></div>`);
    if(!editing) return wrap(`<div class="card sun" data-id="${e.id}">${head}
      <div class="row" style="margin-top:6px"><button class="btn sm aqua" onclick="openPack('${e.pack||"comp"}')">Packing list</button><span class="grow"></span><button class="btn sm coral" onclick="eventEdit('${e.id}')">✏️ Edit</button></div>
      ${e.link?`<p><a class="btn sm" href="${esc(e.link)}" target="_blank" rel="noopener">🔗 Event page / room block</a></p>`:""}${roText("Type",e.type)}${roText("Which dances",e.dances)}${roText("Venue / address",e.venue)}${roText("Hotel & room block",e.hotel)}${roText("Call times / schedule",e.times)}${e.fun?`<div class="field-lab">✨ Fun stuff to know</div><div class="ro" style="background:var(--blush);border-radius:10px;padding:8px 10px;border:0">${esc(e.fun)}</div>`:""}${roText("Cost",e.cost)}${roText("Auto-charge date",e.charge)}${roText("Notes",e.notes)}</div>`);
    const f=(k,lab,type="text")=>`<label class="f">${lab}</label><input type="${type}" data-k="${k}" value="${esc(e[k]||"")}" class="efield">`;
    return wrap(`<div class="card sun" data-id="${e.id}">${head}<p class="small muted">Editing. Nothing is saved until you tap Save.</p>
      ${f("start","Starts","date")}${f("end","Ends","date")}${edText("type","Type",e.type).replace("dfield","efield")}${edText("dances","Which dances",e.dances).replace("dfield","efield")}${edText("venue","Venue / address",e.venue).replace("dfield","efield")}${edText("hotel","Hotel & room block",e.hotel).replace("dfield","efield")}${edText("times","Call times / schedule",e.times).replace("dfield","efield")}${edText("cost","Cost",e.cost).replace("dfield","efield")}${edText("charge","Auto-charge date",e.charge).replace("dfield","efield")}${edText("link","Event / hotel link",e.link).replace("dfield","efield")}${edText("notes","Notes",e.notes).replace("dfield","efield")}${edText("fun","Fun stuff to know",e.fun).replace("dfield","efield")}
      <label class="f">Packing list to use</label><select data-k="pack" class="efield">${Object.entries(PACKS).map(([k,p])=>`<option value="${k}" ${e.pack===k?"selected":""}>${p.name}</option>`).join("")}</select>
      <div class="row" style="margin-top:10px"><button class="btn coral" onclick="saveEvent('${e.id}')">Save</button><button class="btn ghost" onclick="eventEdit(null)">Cancel</button><span class="grow"></span><button class="btn sm ghost" onclick="delEvent('${e.id}')">Remove</button></div></div>`);
  }).join("");
  growAll($("#eventList"));
}
async function saveEvent(id){ const card=document.querySelector(`.card[data-id="${id}"]`); const e={...events().find(x=>x.id===id)}; card.querySelectorAll(".efield").forEach(el=>e[el.dataset.k]=el.value); await storeSet("events",id,e); editEvent=null; renderEvents(); toast("Saved"); }
async function delEvent(id){ if(!confirm("Remove this event?")) return; await storeSet("events",id,{...(S.events[id]||{}),deleted:true}); openEvent=null; editEvent=null; }
export { renderEvents, saveEvent, delEvent };
expose({ eventToggle, eventEdit, saveEvent, delEvent });
