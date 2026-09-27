// Lists tab: to-dos and packing lists.
import { $, esc, fmt, toast, uid, expose } from "../util.js";
import { PACKS } from "../data.js";
import { S, storeSet, storeDel } from "../store.js";
import { showPage } from "../nav.js";

function renderTodos(){ const list=Object.entries(S.todos).sort((a,b)=>(a[1].done-b[1].done)||((a[1].due||"9").localeCompare(b[1].due||"9")));
  $("#todoList").innerHTML=list.map(([id,t])=>`<div class="check ${t.done?"done":""}"><input type="checkbox" ${t.done?"checked":""} onchange="toggleTodo('${id}')"><span class="grow">${esc(t.text)}${t.due?` <span class="chip sun">${fmt(t.due)}</span>`:""}</span><button class="del" onclick="storeDel('todos','${id}')">✕</button></div>`).join("")||`<p class="muted small">Nothing yet.</p>`; }
async function toggleTodo(id){ const t=S.todos[id]; if(t) await storeSet("todos",id,{...t,done:!t.done}); }
function renderPack(){ const sel=$("#packSel"); if(!sel.options.length) sel.innerHTML=Object.entries(PACKS).map(([k,p])=>`<option value="${k}">${p.name}</option>`).join(""); const k=sel.value||"comp"; const base=PACKS[k].items; const saved=S.packs[k]||{extra:[],checked:[]}; const items=[...base,...(saved.extra||[])];
  $("#packList").innerHTML=items.map((it,i)=>`<div class="check ${saved.checked.includes(i)?"done":""}"><input type="checkbox" ${saved.checked.includes(i)?"checked":""} onchange="togglePack('${k}',${i})"><span class="grow">${esc(it)}</span>${i>=base.length?`<button class="del" onclick="delPackItem('${k}',${i-base.length})">✕</button>`:""}</div>`).join(""); }
async function togglePack(k,i){ const s=S.packs[k]||{extra:[],checked:[]}; const c=new Set(s.checked); c.has(i)?c.delete(i):c.add(i); await storeSet("packs",k,{...s,checked:[...c]}); }
async function delPackItem(k,j){ const s=S.packs[k]||{extra:[],checked:[]}; await storeSet("packs",k,{...s,extra:(s.extra||[]).filter((_,i)=>i!==j),checked:[]}); }
// Open the Lists tab on a given packing list (used by the Events tab).
function openPack(k){ $("#packSel").value=k; renderPack(); showPage("lists"); }
export function initLists(){
  $("#addTodo").onclick=async()=>{ const t=$("#todoText").value.trim(); if(!t) return; await storeSet("todos",uid(),{text:t,due:$("#todoDue").value,done:false,at:new Date().toISOString()}); $("#todoText").value="";$("#todoDue").value=""; };
  $("#packSel").addEventListener("change",renderPack);
  $("#addPack").onclick=async()=>{ const k=$("#packSel").value; const v=$("#packNew").value.trim(); if(!v) return; const s=S.packs[k]||{extra:[],checked:[]}; await storeSet("packs",k,{...s,extra:[...(s.extra||[]),v]}); $("#packNew").value=""; };
  $("#packReset").onclick=async()=>{ const k=$("#packSel").value; const s=S.packs[k]||{extra:[],checked:[]}; await storeSet("packs",k,{...s,checked:[]}); };
}
export { renderTodos, toggleTodo, renderPack, togglePack, delPackItem, openPack };
expose({ toggleTodo, togglePack, delPackItem, openPack, storeDel });
