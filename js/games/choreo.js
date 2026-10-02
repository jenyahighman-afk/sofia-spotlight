// Choreo Studio: build a dance from moves, watch the dancer perform it, face the judges.
import { $, esc, toast, uid, lerp, lp, expose } from "../util.js";
import { STYLES, MOVES } from "../data.js";
import { S, storeSet, storeDel } from "../store.js";
import { avatarSVG, MOTION } from "../avatar.js";
import { openStage, stageActions, stageOpen } from "../stage.js";
import { awardStars } from "../stars.js";

const CS={style:"lyrical",seq:[],playing:false,cur:null,vel:MOTION.vel,tail:[],prevH:null,prevHip:null,t:0};
function csRender(){
  $("#csStyles").innerHTML=Object.entries(STYLES).map(([k,v])=>`<button class="btn sm ${CS.style===k?"coral":"ghost"}" onclick="csSetStyle('${k}')">${v.ic} ${v.n}</button>`).join("");
  const list=MOVES.filter(m=>m.st.includes(CS.style)); const others=MOVES.filter(m=>!m.st.includes(CS.style));
  const card=(m,dim)=>`<button class="btn sm ghost" style="display:flex;flex-direction:column;align-items:center;padding:6px 2px;${dim?"opacity:.5":""}" onclick="csAdd('${m.id}')"><span style="font-size:1.4rem">${m.ic}</span><span style="font-size:.68rem;line-height:1.1">${m.n}</span><span class="small muted" style="font-size:.6rem">${m.c} cts · ${"★".repeat(m.d)}</span></button>`;
  $("#csMoves").innerHTML=list.map(m=>card(m,false)).join("")+`<div style="grid-column:1/-1" class="field-lab">Borrow from other styles (judges notice)</div>`+others.map(m=>card(m,true)).join("");
  $("#csTimeline").innerHTML=CS.seq.length?CS.seq.map((id,i)=>{const m=MOVES.find(x=>x.id===id);return `<span class="chip" style="background:#fff;font-size:.9rem" onclick="csRemove(${i})">${m.ic} ${m.n}</span>`}).join(""):`<span class="small muted" style="padding:10px">Tap moves below to build your dance (8, 16 or 32 counts works best)</span>`;
  const cts=CS.seq.reduce((a,id)=>a+MOVES.find(x=>x.id===id).c,0); $("#csCounts").textContent=cts+" counts";
  const saved=Object.entries(S.choreo||{}).sort((a,b)=>(b[1].at||"").localeCompare(a[1].at||"")); $("#csSaved").innerHTML=saved.map(([id,c])=>`<div class="check"><span class="chip sun">${c.score||"–"}</span><a class="grow" href="#" onclick="csLoad('${id}');return false">${esc(c.name)} <span class="muted">· ${STYLES[c.style]?STYLES[c.style].n:c.style} · ${c.seq.length} moves</span></a><button class="del" onclick="storeDel('choreo','${id}')">✕</button></div>`).join(""); }
function csAdd(id){ if(CS.seq.length>=24) return toast("That's a full dance already!"); CS.seq.push(id); $("#csResult").style.display="none"; csRender(); }
function csRemove(i){ CS.seq.splice(i,1); csRender(); }
function csSetStyle(k){ CS.style=k; MOTION.style=k; csRender(); }
export function initChoreo(){
  $("#csUndo").onclick=()=>{CS.seq.pop();csRender();}; $("#csClear").onclick=()=>{CS.seq=[];$("#csResult").style.display="none";csRender();};
  $("#csPlay").onclick=csPlay; $("#csJudge").onclick=csJudge; $("#csSave").onclick=csSave;
}
function csDraw(p){ const ox=150, oy=178-p.lift;
  if(p.trail){ CS.tail.push({x:ox+(Math.random()*60-30),y:oy+(Math.random()*60-30),t:performance.now()}); } CS.tail=CS.tail.filter(t=>performance.now()-t.t<600);
  const sparkles=CS.tail.map(t=>{const a=1-(performance.now()-t.t)/600; return `<text x="${t.x}" y="${t.y}" font-size="${8+a*8}" opacity="${a}" text-anchor="middle">✦</text>`;}).join("");
  const shadowR=Math.max(30,70-p.lift*0.5);
  $("#csSvg").innerHTML=`<rect x="0" y="240" width="300" height="30" fill="#F7A8C6" opacity=".35"/><ellipse cx="150" cy="248" rx="${shadowR}" ry="6" fill="rgba(74,35,64,.08)"/>${sparkles}${avatarSVG(p)}`; }
function ease(u,kind){ if(kind==="jump"){ return u<.5? 2*u*u : 1-Math.pow(-2*u+2,2)/2; } const c1=1.2,c3=c1+1; const back=1+c3*Math.pow(u-1,3)+c1*Math.pow(u-1,2); return kind==="snap"?Math.min(1,Math.max(0,back)):u*u*(3-2*u); }
function poseAt(m,t){ const ks=m.k.length>1?m.k:[m.k[0],m.k[0]]; const seg=t*(ks.length-1); const i=Math.min(ks.length-2,Math.floor(seg)); const u=seg-i; const kind=["saute","leap","aerial","cartwheel"].includes(m.id)?"jump":(["jazz","hiphop"].includes(CS.style)?"snap":"smooth"); const e=ease(u,kind); const a=ks[i],b=ks[i+1]; const o={rot:lerp(a.rot,b.rot,e),lift:lerp(a.lift,b.lift,e)}; ["h","sl","sr","el","er","hl","hr","kl","kr","fl","fr"].forEach(k=>o[k]=lp(a[k],b[k],e)); return o; }
function csSmooth(target,m){ const K=["h","sl","sr","el","er","hl","hr","kl","kr","fl","fr"]; const now=performance.now()/1000; const breathe=Math.sin(now*2.1)*1.4; const sway=Math.sin(now*1.3)*1.2;
  if(!CS.cur){ CS.cur=JSON.parse(JSON.stringify(target)); }
  const cur=CS.cur; const isTrick=Math.abs(target.rot-cur.rot)>5||target.lift>30; const a=isTrick?0.34:0.22;
  K.forEach(k=>{ cur[k][0]+= (target[k][0]-cur[k][0])*a; cur[k][1]+= (target[k][1]-cur[k][1])*a; });
  cur.rot+=(target.rot-cur.rot)*a; cur.lift+=(target.lift-cur.lift)*a;
  const out=JSON.parse(JSON.stringify(cur)); out.lift+=breathe; out.h[0]+=sway*0.6; out.hl[0]+=sway; out.hr[0]+=sway; out.hl[1]+=breathe*0.6; out.hr[1]+=breathe*0.6;
  // secondary motion: hair + skirt lag from velocity
  const hv=CS.prevH?[(out.h[0]-CS.prevH[0]),(out.h[1]-CS.prevH[1])]:[0,0]; CS.prevH=[out.h[0],out.h[1]];
  const hipv=CS.prevHip!==null?(out.lift-CS.prevHip):0; CS.prevHip=out.lift;
  CS.vel.hx+= (-hv[0]*2.2-CS.vel.hx)*0.3; CS.vel.hy+= (-hv[1]*1.6-CS.vel.hy)*0.3; CS.vel.hipx+= (hipv*1.5-CS.vel.hipx)*0.25;
  out.trail=isTrick||out.lift>25; return out; }
async function csPlay(){ if(!CS.seq.length) return toast("Add some moves first"); if(CS.playing) return; CS.playing=true; CS.cur=null; CS.prevH=null; CS.prevHip=null; CS.tail=[]; openStage("💃 Choreo Studio", [$("#csStage"), $("#csResult")], `<span class="chip sun">Watch…</span>`); $("#csResult").style.display="none"; const beat=STYLES[CS.style].beat; let count=0;
  for(const id of CS.seq){ const m=MOVES.find(x=>x.id===id); $("#csNow").textContent=m.ic+" "+m.n; const dur=m.c*beat; const t0=performance.now();
    await new Promise(res=>{ (function f(){ const t=Math.min(1,(performance.now()-t0)/dur); csDraw(csSmooth(poseAt(m,t),m)); $("#csCount").textContent="count "+(count+Math.min(m.c,Math.floor(t*m.c)+1)); if(t<1&&CS.playing) requestAnimationFrame(f); else res(); })(); }); count+=m.c; }
  $("#csNow").textContent="✨ Done!"; CS.playing=false; if(stageOpen()) stageActions(`<button class="btn sun" onclick="csPlay()">▶ Again</button><button class="btn coral" onclick="csJudge()">⭐ Judges</button><button class="btn ghost" onclick="closeStage()">Done</button>`); }
function csJudge(){ const seq=CS.seq.map(id=>MOVES.find(x=>x.id===id)); if(!seq.length) return toast("Build a dance first"); const cts=seq.reduce((a,m)=>a+m.c,0); const n=seq.length; const uniq=new Set(seq.map(m=>m.id)).size; const st=STYLES[CS.style].n;
  const diff=seq.reduce((a,m)=>a+m.d,0)/n; let tech=Math.min(25,9+diff*3.6); const tricks=["cartwheel","walkover","aerial","pirouette","leap","tilt","donut","handstand","bridge","backroll","fankick","layout"]; let backToBack=0; for(let i=1;i<n;i++) if(tricks.includes(seq[i].id)&&tricks.includes(seq[i-1].id)) backToBack++; tech-=Math.min(8,backToBack*3);
  const hasAerial=seq.some(m=>m.id==="aerial"); const aerialUnlocked=(S.settings.aerial||[]).length>=17; if(hasAerial&&!aerialUnlocked) tech-=6;
  const match=seq.filter(m=>m.st.includes(CS.style)).length/n; let mus=8+match*14; if(cts%8===0) mus+=3; else mus-=2;
  let perf=12; const first=seq[0].id, last=seq[n-1].id; if(first==="pose") perf+=4; if(last==="hold"||(CS.style==="hiphop"&&last==="freeze")) perf+=6; else perf-=2; const hasFloor=seq.some(m=>["floor","donut","spiral","backroll","bridge"].includes(m.id)); const hasAir=seq.some(m=>["leap","saute","cartwheel","walkover","aerial","handstand"].includes(m.id)); if(hasFloor) perf+=2; if(hasAir) perf+=2;
  let cre=8+Math.min(12,uniq*1.5); let rep=0; for(let i=1;i<n;i++) if(seq[i].id===seq[i-1].id) rep++; cre-=Math.min(6,rep*2); if(n<4) cre-=4;
  const clamp=(v)=>Math.max(3,Math.min(25,Math.round(v))); tech=clamp(tech); mus=clamp(mus); perf=clamp(perf); cre=clamp(cre); const total=tech+mus+perf+cre;
  const award=total>=92?"💎 Platinum":total>=84?"🏆 High Gold":total>=74?"🥇 Gold":total>=62?"🥈 High Silver":"🥉 Silver";
  const c=[];
  if(last==="hold"||(CS.style==="hiphop"&&last==="freeze")) c.push(["Coach Sparkle","You held your ending. Judges LOVE that."]); else c.push(["Coach Sparkle",CS.style==="hiphop"?"End on a Freeze so the last picture stays.":"Where did the ending go? Add an Ending hold so the last picture stays."]);
  if(first!=="pose") c.push(["Miss Relevé","Start with an Opening pose so we know the dance has begun."]);
  if(backToBack) c.push(["Miss Relevé","Tricks back to back — the dancing between them is what wins. Put a Chassé, Plié or Reach between."]); else if(seq.some(m=>tricks.includes(m.id))) c.push(["Miss Relevé","Nice — your tricks come out of real dancing, not a setup."]);
  if(match<0.6) c.push(["DJ Groove",`This is a ${st} dance but a lot of the moves belong to other styles. Borrowing one or two is creative; more than that confuses the judges.`]); else c.push(["DJ Groove",`That reads as ${st} from the first count. Clear style.`]);
  if(cts%8!==0) c.push(["DJ Groove",`${cts} counts doesn't finish on an 8. Add or remove a move so the music and the dance end together.`]);
  if(hasAerial&&!aerialUnlocked) c.push(["Coach Sparkle","An aerial before it's earned? Finish the Aerial Mission checklist first — a clean cartwheel scores higher than a wobbly aerial."]);
  if(rep) c.push(["Coach Sparkle","Same move twice in a row reads as a repeat, not a phrase."]);
  if(!hasFloor&&["lyrical","contemporary"].includes(CS.style)) c.push(["Miss Relevé",`${st} usually visits the floor at least once. Try a Floor roll or Spiral.`]);
  if(!hasAir&&["jazz","ballet","acro"].includes(CS.style)) c.push(["Miss Relevé","No air time! A Sauté, Grand jeté or Cartwheel would lift this."]);
  if(uniq>=9) c.push(["DJ Groove","So much variety! Every 8 looked different."]);
  if(n<4) c.push(["Miss Relevé","That was over before I sat down. Make it longer!"]);
  CS.last={total,award}; awardStars("choreo",total,"Choreo Studio"); if(!stageOpen()) openStage("⭐ The judges", [$("#csStage"), $("#csResult")], `<button class="btn sun" onclick="csPlay()">▶ Again</button><button class="btn ghost" onclick="closeStage()">Done</button>`); $("#csStage").style.display="block"; $("#csResult").style.display="block"; const crowd=total>=92?"🎉 The crowd is on its feet. Someone's mom is crying.":total>=84?"👏 Big applause. The PITCH girls are screaming your name.":total>=74?"👏 Warm applause, one whoop from the back.":"🙂 Polite clapping. Someone yawned. Rude.";
  $("#csResult").innerHTML=`<div class="card sun" style="margin:0"><div class="row"><h3 class="grow">${award}</h3><span class="big">${total}</span></div>
    <p class="small">${crowd}</p><div class="grid2 small" style="margin:6px 0"><div>Technique <b>${tech}</b>/25</div><div>Musicality <b>${mus}</b>/25</div><div>Performance <b>${perf}</b>/25</div><div>Creativity <b>${cre}</b>/25</div></div>
    ${c.map(([who,txt])=>`<div class="check"><span class="chip ${who==="DJ Groove"?"violet":who==="Miss Relevé"?"":"mint"}">${who}</span><span>${esc(txt)}</span></div>`).join("")}</div>`; $("#csResult").scrollIntoView({behavior:"smooth",block:"nearest"}); }
async function csSave(){ const name=$("#csName").value.trim()||"My dance"; if(!CS.seq.length) return toast("Build a dance first"); await storeSet("choreo",uid(),{name,style:CS.style,seq:[...CS.seq],score:CS.last?CS.last.total:null,award:CS.last?CS.last.award:"",at:new Date().toISOString()}); $("#csName").value=""; toast("Saved!"); }
function csLoad(id){ const c=S.choreo[id]; if(!c) return; CS.seq=[...c.seq].filter(x=>MOVES.find(m=>m.id===x)); CS.style=STYLES[c.style]?c.style:"lyrical"; MOTION.style=CS.style; $("#csResult").style.display="none"; csRender(); toast("Loaded "+c.name); }
export { CS, csRender, csAdd, csRemove, csSetStyle, csDraw, ease, poseAt, csSmooth, csPlay, csJudge, csSave, csLoad };
expose({ csAdd, csRemove, csSetStyle, csLoad, csJudge, csPlay });
