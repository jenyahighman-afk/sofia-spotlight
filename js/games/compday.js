// Comp Day: a whole competition day, one choice at a time.
import { $, esc, expose } from "../util.js";
import { CD_SCENES } from "../data.js";
import { S, storeSet } from "../store.js";

const CD={i:0,e:5,f:5,s:5};
function cdStart(){ CD.i=0; CD.e=5; CD.f=5; CD.s=5; const first=CD_SCENES.slice(0,2), last=CD_SCENES[CD_SCENES.length-1], mid=CD_SCENES.slice(2,-1).sort(()=>Math.random()-.5).slice(0,4); CD.scenes=[...first,...mid,last]; $("#cdArea").style.display="block"; cdScene(); }
function cdBar(v,ic){ const w=Math.max(0,Math.min(100,v*8)); return `<div class="row small"><span style="width:22px">${ic}</span><div class="progress grow"><i style="width:${w}%"></i></div></div>`; }
function cdScene(){ const sc=CD.scenes[CD.i]; if(!sc){ const total=Math.round((CD.e+CD.f+CD.s)*3.3); const award=total>=92?"💎 Platinum":total>=84?"🏆 High Gold":total>=74?"🥇 Gold":total>=62?"🥈 High Silver":"🥉 Silver"; if(total>(S.settings.cdBest||0)) storeSet("settings","main",{...S.settings,cdBest:total}); $("#cdBest").textContent=Math.max(total,S.settings.cdBest||0);
   $("#cdArea").innerHTML=`<div class="card sun" style="margin:0"><div class="row"><h3 class="grow">${award}</h3><span class="big">${total}</span></div>${cdBar(CD.e,"⚡")}${cdBar(CD.f,"🎯")}${cdBar(CD.s,"✨")}<p class="small">${total>=84?"The PITCH girls scream when your name is called. Best day.":total>=70?"Solid day. One or two choices to make differently next time.":"Long day. The stage is only as good as the morning before it."}</p><button class="btn sm coral" onclick="cdStart()">New day</button></div>`; return; }
  $("#cdArea").innerHTML=`<div style="background:var(--blush);border-radius:12px;padding:10px"><div class="small muted">Scene ${CD.i+1}/${CD.scenes.length}</div><p><b>${esc(sc.t)}</b></p>${sc.o.map((o,j)=>`<button class="btn sm ghost" style="display:block;width:100%;text-align:left;margin:4px 0" onclick="cdPick(${j})">${esc(o[0])}</button>`).join("")}<div id="cdNote" class="small" style="min-height:18px;margin-top:6px"></div></div><div style="margin-top:6px">${cdBar(CD.e,"⚡")}${cdBar(CD.f,"🎯")}${cdBar(CD.s,"✨")}</div>`; }
function cdPick(j){ const o=CD.scenes[CD.i].o[j]; CD.e+=o[1].e; CD.f+=o[1].f; CD.s+=o[1].s; $("#cdNote").innerHTML="<i>"+esc(o[2])+"</i>"; $("#cdArea").querySelectorAll("button").forEach(b=>b.disabled=true); setTimeout(()=>{CD.i++; cdScene();},1300); }
export { CD, cdStart, cdScene, cdPick };
expose({ cdStart, cdPick });
