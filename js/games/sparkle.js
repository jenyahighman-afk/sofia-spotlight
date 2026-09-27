// Step & Sparkle: the rhythm game on the full-screen canvas.
import { $, toast, expose } from "../util.js";
import { SPARKLE } from "../data.js";
import { S, storeSet } from "../store.js";

const G={icons:[],on:false};
function startGame(bpm,title,party){ G.bpm=bpm; G.title=title; G.icons=party?SPARKLE.party:SPARKLE.icons; G.party=!!party; G.on=true; G.score=0; G.combo=0; G.best=S.settings.gameBest||0; G.notes=[]; G.t0=performance.now(); G.last=G.t0; G.nextBeat=0; G.dur=30000; G.hits=0; G.total=0;
  $("#gameWrap").classList.add("on"); $("#gameTitle").textContent=title; $("#gameScore").textContent="0"; $("#gameMsg").textContent="Ready…";
  $("#gameLanes").innerHTML=G.icons.map((ic,i)=>`<button ontouchstart="event.preventDefault();laneHit(${i})" onmousedown="laneHit(${i})">${ic}</button>`).join("");
  const cv=$("#gameCv"); cv.width=cv.clientWidth*devicePixelRatio; cv.height=cv.clientHeight*devicePixelRatio; G.cv=cv; G.ctx=cv.getContext("2d"); G.ctx.scale(devicePixelRatio,devicePixelRatio);
  setTimeout(()=>{$("#gameMsg").textContent="";},900); requestAnimationFrame(gameFrame);
  document.addEventListener("keydown",gameKey); }
function gameKey(e){ const k={d:0,f:1,j:2,k:3}[e.key]; if(k!==undefined) laneHit(k); }
function stopGame(){ G.on=false; $("#gameWrap").classList.remove("on"); document.removeEventListener("keydown",gameKey); if(G.score>(S.settings.gameBest||0)) storeSet("settings","main",{...S.settings,gameBest:G.score}); $("#gameBest").textContent=Math.max(G.score,S.settings.gameBest||0); }
function laneHit(i){ if(!G.on) return; const now=performance.now()-G.t0; const zoneY=G.cv.clientHeight-40; const speed=G.cv.clientHeight/2000; let best=null,bd=1e9;
  G.notes.forEach(n=>{ if(n.lane!==i||n.hit) return; const y=(now-n.t)*speed; const d=Math.abs(y-zoneY); if(d<bd){bd=d;best=n;} });
  if(best&&bd<38){ best.hit=true; const perfect=bd<14; G.combo++; G.hits++; G.score+=(perfect?100:50)*(1+Math.min(G.combo,10)/10)*(best.gold?3:1)|0; if(best.gold) toast("✨ GOLDEN ×3!"); G.pop={x:i,t:performance.now(),txt:perfect?"PERFECT ✨":"nice!"}; }
  else { G.combo=0; G.pop={x:i,t:performance.now(),txt:"miss"}; }
  $("#gameScore").textContent=G.score; }
function gameFrame(){ if(!G.on) return; const now=performance.now()-G.t0; const W=G.cv.clientWidth,H=G.cv.clientHeight,ctx=G.ctx; const beat=60000/G.bpm; const speed=H/2000; const zoneY=H-40;
  while(G.nextBeat<G.dur-2000&&G.nextBeat<now+2200){ const lane=Math.floor(Math.random()*4); G.notes.push({lane,t:G.nextBeat+2000,hit:false,gold:G.party&&Math.random()<.12}); G.total++; G.nextBeat+=beat*(G.bpm>100&&Math.random()<.3?0.5:1); }
  ctx.clearRect(0,0,W,H); const lw=W/4;
  for(let i=0;i<4;i++){ ctx.fillStyle=i%2?"rgba(255,92,147,.05)":"rgba(201,167,245,.08)"; ctx.fillRect(i*lw,0,lw,H); }
  ctx.strokeStyle="#FF5C93"; ctx.lineWidth=4; ctx.beginPath(); ctx.moveTo(0,zoneY); ctx.lineTo(W,zoneY); ctx.stroke();
  ctx.font="28px system-ui"; ctx.textAlign="center";
  G.notes.forEach(n=>{ const y=(now-n.t)*speed; if(n.hit||y>H+30) return; if(y>zoneY+40&&!n.missed){n.missed=true;G.combo=0;} ctx.globalAlpha=n.missed?.3:1; if(n.gold){ ctx.fillStyle="rgba(255,210,63,.35)"; ctx.beginPath(); ctx.arc(n.lane*lw+lw/2,y,22,0,7); ctx.fill(); } ctx.fillStyle="#000"; ctx.fillText(G.icons[n.lane],n.lane*lw+lw/2,y+10); ctx.globalAlpha=1; });
  if(G.pop&&performance.now()-G.pop.t<500){ ctx.fillStyle="#7B3F6A"; ctx.font="bold 18px Fredoka, system-ui"; ctx.fillText(G.pop.txt,G.pop.x*lw+lw/2,zoneY-50); }
  ctx.fillStyle="#8A6A80"; ctx.font="bold 13px system-ui"; ctx.textAlign="left"; ctx.fillText("combo ×"+G.combo+"   "+Math.max(0,Math.ceil((G.dur-now)/1000))+"s",10,20);
  if(now>G.dur+1500){ G.on=false; const acc=G.total?Math.round(100*G.hits/G.total):0; $("#gameMsg").innerHTML=`Score ${G.score}<br><span style="font-size:1rem;color:#8A6A80">${acc}% on the beat${G.score>G.best?" · NEW BEST!":""}</span><br><button class="btn coral" style="pointer-events:auto;margin-top:10px" onclick="startGame(${G.bpm},'${G.title}')">Again</button>`; document.removeEventListener("keydown",gameKey); if(G.score>(S.settings.gameBest||0)) storeSet("settings","main",{...S.settings,gameBest:G.score}); return; }
  requestAnimationFrame(gameFrame); }
export { G, startGame, stopGame, laneHit };
expose({ startGame, stopGame, laneHit });
