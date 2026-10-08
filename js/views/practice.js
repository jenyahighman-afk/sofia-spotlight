// Practice tab: the checklist IS the screen — progress ring, tap to check (auto-saved), confetti at 100%.
// Plan, safety rules, aerial mission, notes and history sit under accordions.
import { $, $$, esc, fmt, todayStr, toast, expose } from "../util.js";
import { PRACTICE_ITEMS, PHASES, AERIAL, CLASSES } from "../data.js";
import { S, storeSet, events } from "../store.js";
import { computeStreak } from "../streak.js";
import { renderQuick } from "../quick.js";
import { planFor } from "../planToday.js";
import { PRACTICE_POOL } from "../data.js";
import { poolItems } from "../plan.js";
import { checkBadges } from "../badges.js";

const KIND = { warm:"🔥", core:"💪", legs:"🦵", str:"💪", flex:"🧘", tech:"🩰", run:"▶️", fix:"🎯", trick:"✨", aerial:"🤸" };
const GROUP = { warm:"Warm-up", core:"Core", legs:"Legs", flex:"Flex", tech:"Technique", fix:"This week's fix", trick:"Trick", aerial:"Aerial mission", run:"Runs" };
const SWAPPABLE = new Set(["warm","core","legs","flex","tech"]);
let lastPct = -1, dateSel = null;
const curDate = () => dateSel || todayStr();

function ring(pct){ const r=44, c=2*Math.PI*r; return `<svg viewBox="0 0 100 100" class="ring"><circle cx="50" cy="50" r="${r}" class="ring-bg"/><circle cx="50" cy="50" r="${r}" class="ring-fg" stroke-dasharray="${c}" stroke-dashoffset="${c*(1-pct/100)}"/><text x="50" y="50" class="ring-txt">${pct}%</text></svg>`; }
function renderPractice(){
  renderQuick();
  const date=curDate(); const rec=S.practice[date]||{done:[],note:"",runs:[]}; const done=new Set(rec.done||[]); const plan=planFor(date);
  const pct=plan.length?Math.round(100*[...done].filter(id=>plan.some(i=>i.id===id)).length/plan.length):0;
  const streak=computeStreak({practice:S.practice,classes:CLASSES,events:events(),totalItems:PRACTICE_ITEMS.length,today:todayStr()});
  $("#practiceHead").innerHTML=`${ring(pct)}<div class="grow"><div class="today-what">${date===todayStr()?"Today":fmt(date)}</div><div class="row"><span class="chip ${streak?"coral":""}">🔥 ${streak}-day streak</span>${(rec.runs||[]).length?`<span class="chip sun">▶ ${rec.runs.length} run${rec.runs.length>1?"s":""}</span>`:""}</div><div class="small muted" style="margin-top:4px">${pct>=100?"All done. Go you! 🎉":pct>=60?"That counts as a practice day ✓":"Get to 60% and today counts."}</div></div>`;
  let lastKind=""; $("#practiceChecklist").innerHTML=plan.map(it=>{ const head=it.kind!==lastKind?`<div class="row pgroup"><span class="grow">${KIND[it.kind]||"✨"} ${GROUP[it.kind]||it.kind}</span>${SWAPPABLE.has(it.kind)?`<button type="button" class="lnk" onclick="swapOpen('${it.kind}','')">＋ one more</button>`:""}</div>`:""; lastKind=it.kind;
    return head+`<label class="pitem ${done.has(it.id)?"done":""}"><input type="checkbox" ${done.has(it.id)?"checked":""} data-id="${it.id}" class="pchk"><span class="pk">${KIND[it.kind]||"✨"}</span><span class="grow">${esc(it.text)}</span>${it.kind==="tech"?`<button type="button" class="lnk" onclick="event.preventDefault();openCoach('','${esc(it.text.split(/[:,(]/)[0].trim())}')" title="Coach me">🎬</button>`:""}${SWAPPABLE.has(it.kind)?`<button type="button" class="lnk" onclick="event.preventDefault();swapOpen('${it.kind}','${it.id}')" title="Swap">🔁</button>`:""}</label>`; }).join("");
  $$(".pchk").forEach(c=>c.addEventListener("change",onCheck));
  if($("#practiceNote")!==document.activeElement) $("#practiceNote").value=rec.note||"";
  $("#practiceDate").value=date;
  const ad=new Set(S.settings.aerial||[]); let lastSec="";
  $("#aerialList").innerHTML=AERIAL.map(it=>{ const h=(it.section!==lastSec)?`<div class="chip sun" style="margin-top:8px">${esc(it.section)}</div>`:""; lastSec=it.section; return h+`<label class="pitem ${ad.has(it.id)?"done":""}"><input type="checkbox" ${ad.has(it.id)?"checked":""} onchange="toggleAerial('${it.id}')"><span class="grow">${esc(it.text)}</span>${it.section.startsWith("Drills")||it.section==="Prerequisites"?`<button type="button" class="lnk" onclick="event.preventDefault();openCoach('','${esc(it.text.split(/[:,(]/)[0].trim())}')" title="Coach me">🎬</button>`:""}</label>`; }).join("");
  const apct=Math.round(100*[...ad].filter(id=>AERIAL.some(a=>a.id===id)).length/AERIAL.length); $("#aerialPct").textContent=apct+"%";
  $("#phases").innerHTML=PHASES.map(p=>`<div class="check"><span class="chip violet">${esc(p.d)}</span><span><b>${esc(p.n)}</b><br><span class="small">${esc(p.g)}</span></span></div>`).join("");
  const hist=Object.entries(S.practice).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,30);
  $("#practiceHistory").innerHTML=hist.length?hist.map(([d,r])=>`<div class="check"><span class="chip mint">${fmt(d)}</span><span>${(r.done||[]).length}/${r.total||PRACTICE_ITEMS.length}${(r.runs||[]).length?` · ▶ ${r.runs.length}`:""}${r.note?" · "+esc(r.note):""}</span></div>`).join(""):`<p class="muted small">Nothing yet. Today is a good day.</p>`;
  lastPct=pct;
}
// Safety net: today's checks are mirrored in localStorage the moment they're tapped; if the record ever comes back
// without them (a reload before the write flushed), they're put back and re-saved.
export function restoreTodayChecks(){
  const date=todayStr(); let mirror=[]; try{ mirror=JSON.parse(localStorage.getItem("spotlight:practice:"+date)||"[]"); }catch(e){}
  if(!Array.isArray(mirror)||!mirror.length) return;
  const r=S.practice[date]||{done:[],note:"",runs:[]}; const have=new Set(r.done||[]); const missing=mirror.filter(id=>!have.has(id)&&PRACTICE_ITEMS.some(i=>i.id===id));
  if(missing.length) storeSet("practice",date,{...r,done:[...(r.done||[]),...missing]});
}
async function onCheck(e){
  const date=curDate(); const rec=S.practice[date]||{done:[],note:"",runs:[]}; const done=$$(".pchk").filter(x=>x.checked).map(x=>x.dataset.id);
  e.target.closest(".pitem").classList.toggle("done",e.target.checked);
  const plan=planFor(date); const pct=Math.round(100*done.length/Math.max(1,plan.length));
  await storeSet("practice",date,{...rec,done,total:plan.length});
  const aer=plan.find(i=>i.id===e.target.dataset.id&&i.aerialId); if(aer&&e.target.checked){ const ad=new Set(S.settings.aerial||[]); if(!ad.has(aer.aerialId)){ ad.add(aer.aerialId); await storeSet("settings","main",{...S.settings,aerial:[...ad]}); } }
  if(date===todayStr()){ try{ localStorage.setItem("spotlight:practice:"+date,JSON.stringify(done)); }catch(e){} }
  if(pct>=100&&lastPct<100) confetti(); lastPct=pct; checkBadges();
}
async function saveNote(){ const date=curDate(); const rec=S.practice[date]||{done:[],note:"",runs:[]}; await storeSet("practice",date,{...rec,note:$("#practiceNote").value}); toast("Saved"); }
async function toggleAerial(id){ const ad=new Set(S.settings.aerial||[]); ad.has(id)?ad.delete(id):ad.add(id); await storeSet("settings","main",{...S.settings,aerial:[...ad]}); if(AERIAL.every(a=>ad.has(a.id))){ toast("AERIAL UNLOCKED 🎉"); confetti(); } checkBadges(); }
export function confetti(){
  const box=document.createElement("div"); box.className="confetti"; const colors=["#FF5C93","#F4C86A","#C9A7F5","#F7A8C6","#2ED3C8","#fff"];
  for(let i=0;i<70;i++){ const s=document.createElement("i"); s.style.left=Math.random()*100+"%"; s.style.background=colors[i%colors.length]; s.style.animationDelay=(Math.random()*0.6)+"s"; s.style.animationDuration=(1.6+Math.random()*1.2)+"s"; s.style.transform=`rotate(${Math.random()*360}deg)`; box.appendChild(s); }
  document.body.appendChild(box); setTimeout(()=>box.remove(),3200);
}
// ---- swap / add / skip (per day) ----
let swapKind="", swapFrom="";
function swapOpen(kind, fromId){ swapKind=kind; swapFrom=fromId||""; const date=curDate(); const plan=planFor(date); const inPlan=new Set(plan.map(i=>i.id)); const cands=poolItems(PRACTICE_POOL,kind).filter(it=>!inPlan.has(it.id));
  $("#swapTitle").textContent=(fromId?"Swap for…":"Add one more")+" · "+(GROUP[kind]||kind);
  $("#swapList").innerHTML=(cands.length?cands.map(it=>`<button class="skill" onclick="swapPick('${it.id}')"><span class="st">${KIND[kind]||"✨"}</span><span class="grow">${esc(it.text)}</span><small>${Math.round((it.secs||60)/60)} min</small></button>`).join(""):`<p class="small muted">Everything in this group is already in today's plan.</p>`)+(fromId?`<button class="btn ghost" style="width:100%;margin-top:8px" onclick="swapPick('')">Skip this one today</button>`:"");
  $("#swap").hidden=false; document.body.classList.add("modal"); }
function swapClose(){ $("#swap").hidden=true; document.body.classList.remove("modal"); }
async function swapPick(toId){ const date=curDate(); const rec=S.practice[date]||{done:[],note:"",runs:[]}; const c={swap:{...((rec.custom||{}).swap||{})},add:[...((rec.custom||{}).add||[])],drop:[...((rec.custom||{}).drop||[])]};
  if(swapFrom&&toId) c.swap[swapFrom]=toId; else if(swapFrom&&!toId) c.drop.push(swapFrom); else if(!swapFrom&&toId) c.add.push(toId);
  const done=(rec.done||[]).filter(id=>id!==swapFrom);
  await storeSet("practice",date,{...rec,done,custom:c}); swapClose(); toast(toId?(swapFrom?"Swapped ✓":"Added ✓"):"Skipped for today"); renderPractice(); }
export function initPractice(){
  $("#swapClose").onclick=swapClose; $("#swap").addEventListener("click",e=>{ if(e.target===$("#swap")) swapClose(); });
  $("#practiceDate").addEventListener("change",(e)=>{ dateSel=e.target.value||null; lastPct=-1; renderPractice(); });
  $("#saveNote").onclick=saveNote;
}
export { renderPractice, toggleAerial };
expose({ toggleAerial, swapOpen, swapPick });
