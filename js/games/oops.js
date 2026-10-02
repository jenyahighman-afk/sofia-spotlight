// Spot the Oops: the dancer hits a pose, find the correction (or the silly thing) before the timer runs out.
import { $, expose } from "../util.js";
import { MOVES, JE_FLAWS, JE_MOVES } from "../data.js";
import { S, storeSet } from "../store.js";
import { avatarSVG } from "../avatar.js";
import { openStage, stageActions } from "../stage.js";
import { awardStars } from "../stars.js";

const JE={r:0,score:0,flaw:"",move:null};
function jeStart(){ JE.r=0; JE.score=0; openStage("👀 Spot the Oops", [$("#jeArea")], `<button class="btn ghost" onclick="closeStage()">Done</button>`); jeRound(); }
document.addEventListener("stageclosed", ()=>{ clearTimeout(JE.timer); });
function jeRound(){ clearTimeout(JE.timer); if(JE.r>=10){ $("#jeOpts").innerHTML=""; $("#jeMsg").innerHTML=`<b>Done! ${JE.score}/10.</b> ${JE.score>=9?"You have a judge's eye. 👁️✨":JE.score>=7?"Sharp! A couple slipped by.":"Keep looking at feet, knees, eyes and arms — in that order."} <button class="btn sm coral" onclick="jeStart()">Again</button>`; if(JE.score>(S.settings.jeBest||0)) storeSet("settings","main",{...S.settings,jeBest:JE.score}); $("#jeBest").textContent=Math.max(JE.score,S.settings.jeBest||0); awardStars("oops",JE.score,"Spot the Oops"); return; }
  JE.r++; const m=MOVES.find(x=>x.id===JE_MOVES[Math.floor(Math.random()*JE_MOVES.length)])||MOVES.find(x=>x.id==="arab"); JE.move=m; const f=JE_FLAWS[Math.floor(Math.random()*JE_FLAWS.length)]; JE.flaw=f[0];
  const p=JSON.parse(JSON.stringify(m.k[m.k.length-1])); if(m.id==="kick"||m.id==="leap"){ const mid=m.k[1]; Object.assign(p,JSON.parse(JSON.stringify(mid))); }
  if(JE.flaw==="knee"){ p.kr=[(p.kr[0]+p.fr[0])/2-8,(p.kr[1]+p.fr[1])/2+10]; } if(JE.flaw==="arms"){ p.hl=[p.hl[0]*0.6,p.hl[1]+22]; p.hr=[p.hr[0]*0.6,p.hr[1]+22]; p.el=[p.el[0],p.el[1]+14]; p.er=[p.er[0],p.er[1]+14]; }
  $("#jeSvg").innerHTML=`<rect x="0" y="240" width="300" height="30" fill="#F7A8C6" opacity=".35"/>${avatarSVG(p,{flaw:JE.flaw})}`;
  $("#jeRound").textContent="Round "+JE.r+"/10"; $("#jeMove").textContent=m.ic+" "+m.n; $("#jeScore").textContent=JE.score; $("#jeMsg").textContent="";
  const opts=[...JE_FLAWS].sort(()=>Math.random()-.5); $("#jeOpts").innerHTML=opts.map(o=>`<button class="btn ghost je-opt" onclick="jeAnswer('${o[0]}')">${o[1]}</button>`).join(""); clearTimeout(JE.timer); JE.timer=setTimeout(()=>{ if($("#jeOpts").querySelector("button:not([disabled])")) jeAnswer("__late"); },10000); }
function jeAnswer(a){ clearTimeout(JE.timer); if(!$("#jeOpts").querySelector("button:not([disabled])")) return; const right=a===JE.flaw; if(right) JE.score++; if(a==="__late"){ $("#jeMsg").innerHTML=`<b style="color:#FF5C93">Too slow!</b> Judges look fast. Try the next one.`; $("#jeOpts").querySelectorAll("button").forEach(b=>b.disabled=true); setTimeout(jeRound,1100); return; } $("#jeScore").textContent=JE.score; const label=JE_FLAWS.find(f=>f[0]===JE.flaw)[1]; $("#jeMsg").innerHTML=right?`<b style="color:#2E9E6B">Yes!</b> ${JE.flaw?label+".":"Clean line, nothing to mark."}`:`<b style="color:#FF5C93">Not that.</b> The note was: ${label}`; $("#jeOpts").querySelectorAll("button").forEach(b=>b.disabled=true); setTimeout(jeRound,1100); }

export { JE, jeStart, jeRound, jeAnswer };
expose({ jeStart, jeAnswer });
