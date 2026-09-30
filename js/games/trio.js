// Trio Formations: pick formations and patterns per 8-count, watch the three dancers, get judged.
import { $, esc, toast, lerp, expose } from "../util.js";
import { MOVES, TF_FORMS, TF_PATS, TF_MOVES, TF_DANCERS } from "../data.js";
import { S, storeSet } from "../store.js";
import { avatarSVG } from "../avatar.js";
import { poseAt } from "./choreo.js";
import { openStage, stageActions, stageOpen } from "../stage.js";

const TF={eights:[],playing:false};
function tfAdd(){ if(TF.eights.length>=8) return toast("8 eights is a full trio!"); TF.eights.push({form:"line",pat:"unison",mv:"reach"}); tfRender(); }
function tfRender(){ $("#tfBuild").innerHTML=TF.eights.length?TF.eights.map((e,i)=>`<div class="row" style="margin:4px 0;background:var(--blush);border-radius:10px;padding:4px 6px"><span class="chip sun">8 #${i+1}</span>
   <select onchange="tfSet(${i},'form',this.value)" style="flex:1;padding:6px">${Object.entries(TF_FORMS).map(([k,f])=>`<option value="${k}" ${e.form===k?"selected":""}>${f.ic} ${f.n}</option>`).join("")}</select>
   <select onchange="tfSet(${i},'pat',this.value)" style="flex:1;padding:6px">${Object.entries(TF_PATS).map(([k,f])=>`<option value="${k}" ${e.pat===k?"selected":""}>${f.ic} ${f.n}</option>`).join("")}</select>
   <select onchange="tfSet(${i},'mv',this.value)" style="flex:1;padding:6px">${TF_MOVES.map(k=>{const m=MOVES.find(x=>x.id===k);return `<option value="${k}" ${e.mv===k?"selected":""}>${m.ic} ${m.n}</option>`;}).join("")}</select></div>`).join(""):`<p class="small muted">Tap "+ Add an 8" to start. Try 4 eights.</p>`; }
function tfUndo(){ TF.eights.pop(); tfRender(); }
function tfSet(i,k,v){ if(TF.eights[i]) TF.eights[i][k]=v; }
function tfDrawFrame(posA,posB,t,pat,mv,u){ const m=MOVES.find(x=>x.id===mv); let out=`<rect x="0" y="0" width="300" height="200" fill="none"/>`;
  for(let d=0;d<3;d++){ const x=lerp(posA[d][0],posB[d][0],t), y=lerp(posA[d][1],posB[d][1],t); let mt=u; if(pat==="canon") mt=Math.max(0,Math.min(1,u*1.6-d*0.3)); if(pat==="solo"&&d>0) mt=0; const pose=poseAt(m,mt); if(pat==="mirror"&&d===2){ ["h","sl","sr","el","er","hl","hr","kl","kr","fl","fr"].forEach(k=>pose[k]=[-pose[k][0],pose[k][1]]); pose.rot=-pose.rot; }
    const sc=0.4+ (y-80)/200*0.2; out+=`<ellipse cx="${x}" cy="${y+16}" rx="18" ry="4" fill="rgba(74,35,64,.08)"/>`+avatarSVG(pose,{ox:0,oy:0,pre:`translate(${x} ${y-40*sc}) scale(${sc})`,...TF_DANCERS[d]}); }
  $("#tfSvg").innerHTML=out; }
async function tfPlay(){ if(!TF.eights.length) return toast("Add some eights first"); if(TF.playing) return; TF.playing=true; openStage("👯 Trio Formations", [$("#tfStage"), $("#tfResult")], `<span class="chip sun">Watch…</span>`); $("#tfResult").style.display="none"; let prev=TF_FORMS[TF.eights[0].form].pos;
  for(let i=0;i<TF.eights.length;i++){ const e=TF.eights[i]; const pos=TF_FORMS[e.form].pos; $("#tfNow").textContent=`8 #${i+1} · ${TF_FORMS[e.form].n} · ${TF_PATS[e.pat].n}`; const t0=performance.now(); const dur=2400;
    await new Promise(res=>{ (function f(){ const t=Math.min(1,(performance.now()-t0)/dur); const travel=Math.min(1,t*2.5); tfDrawFrame(prev,pos,travel*travel*(3-2*travel),e.pat,e.mv,Math.max(0,(t-0.3)/0.7)); if(t<1) requestAnimationFrame(f); else res(); })(); }); prev=pos; }
  $("#tfNow").textContent="✨ Done!"; TF.playing=false; if(stageOpen()) stageActions(`<button class="btn sun" onclick="tfPlay()">▶ Again</button><button class="btn coral" onclick="tfJudge()">⭐ Judge</button><button class="btn ghost" onclick="closeStage()">Done</button>`); }
function tfJudge(){ const E=TF.eights; if(!E.length) return toast("Build it first"); const n=E.length; const forms=new Set(E.map(e=>e.form)).size, pats=new Set(E.map(e=>e.pat)).size; let sp=10+Math.min(15,forms*4); let pic=8; if(E[n-1].form!=="spread") pic+=6; if(["triangle","vee","cluster"].includes(E[n-1].form)) pic+=6; if(E[0].form!==E[n-1].form) pic+=3;
  let tog=10+Math.min(15,pats*4); const canons=E.filter(e=>e.pat==="canon").length; if(canons>n/2) tog-=6; const solos=E.filter(e=>e.pat==="solo").length; if(solos>1) tog-=4;
  let fl=10+Math.min(12,new Set(E.map(e=>e.mv)).size*3); let rep=0; for(let i=1;i<n;i++) if(E[i].form===E[i-1].form&&E[i].pat===E[i-1].pat) rep++; fl-=rep*3; if(n<3) fl-=5;
  const cl=(v)=>Math.max(3,Math.min(25,Math.round(v))); sp=cl(sp);pic=cl(pic);tog=cl(tog);fl=cl(fl); const total=sp+pic+tog+fl; const award=total>=92?"💎 Platinum":total>=84?"🏆 High Gold":total>=74?"🥇 Gold":total>=62?"🥈 High Silver":"🥉 Silver";
  const c=[]; if(forms<3) c.push(["Miss Relevé","Three dancers, one shape the whole time. Change formations — judges score the pictures you make."]); else c.push(["Miss Relevé","Nice pictures. The formation changes gave every 8 a new look."]);
  if(canons>n/2) c.push(["DJ Groove","Too much canon. Canon is the spice, unison is the meal."]); else if(canons) c.push(["DJ Groove","A canon in the middle — that's the moment people remember."]);
  if(solos>1) c.push(["Coach Sparkle","A trio is three. More than one Sofia-solo eight and it stops being a trio."]);
  if(["triangle","vee","cluster"].includes(E[n-1].form)) c.push(["Coach Sparkle","Strong final picture. Hold it!"]); else c.push(["Coach Sparkle","End in a shape that photographs — a triangle, a V or a cluster."]);
  if(rep) c.push(["Miss Relevé","Two eights in a row that look identical read as a repeat."]);
  if(!stageOpen()) openStage("⭐ The judges", [$("#tfStage"), $("#tfResult")], `<button class="btn sun" onclick="tfPlay()">▶ Again</button><button class="btn ghost" onclick="closeStage()">Done</button>`); $("#tfStage").style.display="block"; $("#tfResult").style.display="block"; $("#tfResult").innerHTML=`<div class="card sun" style="margin:0"><div class="row"><h3 class="grow">${award}</h3><span class="big">${total}</span></div><div class="grid2 small" style="margin:6px 0"><div>Spacing <b>${sp}</b>/25</div><div>Pictures <b>${pic}</b>/25</div><div>Togetherness <b>${tog}</b>/25</div><div>Flow <b>${fl}</b>/25</div></div>${c.map(([who,txt])=>`<div class="check"><span class="chip ${who==="DJ Groove"?"violet":who==="Miss Relevé"?"":"mint"}">${who}</span><span>${esc(txt)}</span></div>`).join("")}</div>`; if(total>(S.settings.tfBest||0)) storeSet("settings","main",{...S.settings,tfBest:total}); }

export { TF, tfAdd, tfUndo, tfSet, tfRender, tfDrawFrame, tfPlay, tfJudge };
expose({ tfAdd, tfUndo, tfSet, tfPlay, tfJudge });
