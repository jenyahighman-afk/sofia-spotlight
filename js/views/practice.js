// Practice tab: today's checklist (stored by item id since schema 2), the 15-week plan, aerial progression, history.
import { $, $$, esc, fmt, todayStr, toast, expose } from "../util.js";
import { PRACTICE_ITEMS, PHASES, AERIAL } from "../data.js";
import { S, storeSet } from "../store.js";

function renderPractice(){
  const date=$("#practiceDate").value||todayStr(); $("#practiceDate").value=date;
  const rec=S.practice[date]||{done:[],note:""}; const done=new Set(rec.done||[]);
  $("#practiceChecklist").innerHTML=PRACTICE_ITEMS.map(it=>`<div class="check ${done.has(it.id)?"done":""}"><input type="checkbox" ${done.has(it.id)?"checked":""} data-id="${it.id}" class="pchk"><span>${esc(it.text)}</span></div>`).join("");
  $("#practiceNote").value=rec.note||"";
  const pct=Math.round(100*done.size/PRACTICE_ITEMS.length); $("#practiceBar").style.width=pct+"%";
  $("#streak").textContent=Object.keys(S.practice).length;
  $$(".pchk").forEach(c=>c.addEventListener("change",()=>{ const n=$$(".pchk").filter(x=>x.checked).length; $("#practiceBar").style.width=Math.round(100*n/PRACTICE_ITEMS.length)+"%"; c.closest(".check").classList.toggle("done",c.checked); }));
  const ad=new Set(S.settings.aerial||[]); let lastSec="";
  $("#aerialList").innerHTML=AERIAL.map(it=>{ const h=(it.section!==lastSec)?`<div class="chip sun" style="margin-top:8px">${esc(it.section)}</div>`:""; lastSec=it.section; return h+`<div class="check ${ad.has(it.id)?"done":""}"><input type="checkbox" ${ad.has(it.id)?"checked":""} onchange="toggleAerial('${it.id}')"><span>${esc(it.text)}</span></div>`; }).join("");
  $("#aerialPct").textContent=Math.round(100*[...ad].filter(id=>AERIAL.some(a=>a.id===id)).length/AERIAL.length)+"%";
  $("#phases").innerHTML=PHASES.map(p=>`<details><summary>${esc(p.n)} <span class="chip violet">${esc(p.d)}</span></summary><p class="small">${esc(p.g)}</p></details>`).join("");
  const hist=Object.entries(S.practice).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,20);
  $("#practiceHistory").innerHTML=hist.length?hist.map(([d,r])=>`<div class="check"><span class="chip mint">${fmt(d)}</span><span>${(r.done||[]).length}/${PRACTICE_ITEMS.length} done${r.note?" · "+esc(r.note):""}</span></div>`).join(""):`<p class="muted">Nothing logged yet. Today is a good day to start.</p>`;
}
async function toggleAerial(id){ const ad=new Set(S.settings.aerial||[]); ad.has(id)?ad.delete(id):ad.add(id); await storeSet("settings","main",{...S.settings,aerial:[...ad]}); if(AERIAL.every(a=>ad.has(a.id))) toast("AERIAL UNLOCKED 🎉"); }
async function savePractice(){ const date=$("#practiceDate").value||todayStr(); const done=$$(".pchk").filter(x=>x.checked).map(x=>x.dataset.id); await storeSet("practice",date,{done,note:$("#practiceNote").value}); toast("Logged. Go you."); }

export function initPractice(){
  $("#practiceDate").addEventListener("change",renderPractice);
  $("#savePractice").onclick=savePractice;
}
export { renderPractice, toggleAerial, savePractice };
expose({ toggleAerial });
