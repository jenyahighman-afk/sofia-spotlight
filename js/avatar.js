// The dancer: SVG avatar renderer shared by every game, plus the avatar builder on the Play tab.
// A worn costume (js/costume.js, settings.costumeOn) is drawn here too, so it shows wherever her avatar does.
import { $, esc, expose, toast } from "./util.js";
import { AVATAR_DEFAULT, AV_OPTS, P, COSTUMES } from "./data.js";
import { S, storeSet } from "./store.js";
import { isUnlocked, UNLOCKS, totalStars } from "./stars.js";

// Motion context the Choreo Studio feeds into the renderer (hair/skirt lag, style-specific outfit).
export const MOTION={style:"lyrical",vel:{hx:0,hy:0,hipx:0}};
function shade(hex){ const n=parseInt(hex.slice(1),16); const r=Math.max(0,(n>>16)-40),g=Math.max(0,((n>>8)&255)-40),b=Math.max(0,(n&255)-40); return "#"+((r<<16)|(g<<8)|b).toString(16).padStart(6,"0"); }
// The design she is wearing (settings.costumeOn names one of settings.costumes), or null.
function wornCostume(settings=S.settings){ const on=(settings||{}).costumeOn; if(!on) return null; return (Array.isArray(settings.costumes)?settings.costumes:[]).find(c=>c&&c.id===on)||null; }
function myAvatar(){ const c=wornCostume(); return c?{...AVATAR_DEFAULT,...(S.settings.avatar||{}),costume:c}:{...AVATAR_DEFAULT,...(S.settings.avatar||{})}; }
// ---------- costume parts ----------
// Precedence: a worn costume replaces the leotard colour (the star-unlocked leotards stay locked in the designer too),
// the skirt and sleeves; its headpiece replaces her hair accessory unless it is "My usual". The Choreo Studio's hip-hop
// outfit still wins over a costume, and other dancers (trio) never wear hers.
const cosCol=(id,list,dflt)=>((COSTUMES[list]||[]).find(x=>x.id===id)||{}).c||dflt;
const gem=(x,y,s,c="#fff")=>`<path d="M${x} ${y-s}L${x+s*.3} ${y-s*.3}L${x+s} ${y}L${x+s*.3} ${y+s*.3}L${x} ${y+s}L${x-s*.3} ${y+s*.3}L${x-s} ${y}L${x-s*.3} ${y-s*.3}Z" fill="${c}"/>`;
const star5=(x,y,r,c,st="")=>{ let d=""; for(let i=0;i<10;i++){ const a=-Math.PI/2+i*Math.PI/5, q=i%2?r*.45:r; d+=(i?"L":"M")+(x+Math.cos(a)*q).toFixed(1)+" "+(y+Math.sin(a)*q).toFixed(1); } return `<path d="${d}Z" fill="${c}" ${st}/>`; };
const mix=(a,b,t)=>a+(b-a)*t;
function costumeParts(c,g){ const {ox,oy,sl,sr,el,er,hl,hr,hx,hy,R,sk,skin,leo,leoD,limb}=g;
  const sc=c.skirtC&&c.skirtC!=="match"?cosCol(c.skirtC,"colors",leo):leo, scD=shade(sc), tc=cosCol(c.trim,"trims","#F4C24A"), tcD=shade(tc);
  // skirt
  const skirt={
    none:"",
    chiffon:`<path d="M${ox-16} ${oy+2} Q${ox-30} ${oy+22-sk} ${ox-32-Math.abs(sk)} ${oy+30-sk*1.5} Q${ox-16} ${oy+24-sk} ${ox} ${oy+32-sk*1.2} Q${ox+16} ${oy+24-sk} ${ox+32+Math.abs(sk)} ${oy+30-sk*1.5} Q${ox+30} ${oy+22-sk} ${ox+16} ${oy+2}Z" fill="${sc}" opacity=".85"/><path d="M${ox-16} ${oy+2} Q${ox} ${oy+8} ${ox+16} ${oy+2}" stroke="${scD}" stroke-width="2" fill="none"/>`,
    tutu:`<ellipse cx="${ox}" cy="${oy+9}" rx="35" ry="8" fill="${scD}" opacity=".9"/><ellipse cx="${ox}" cy="${oy+6.5}" rx="31" ry="6.5" fill="${sc}"/><ellipse cx="${ox}" cy="${oy+6.5}" rx="25" ry="4.2" fill="none" stroke="#fff" stroke-width="1.2" stroke-dasharray="3 3" opacity=".7"/><ellipse cx="${ox}" cy="${oy+3}" rx="16" ry="3" fill="${sc}"/>`,
    lyrical:`<path d="M${ox-16} ${oy+2} Q${ox-26} ${oy+26-sk} ${ox-30-sk} ${oy+54-sk} Q${ox-8} ${oy+50-sk} ${ox+4} ${oy+40-sk} Q${ox+18} ${oy+30-sk} ${ox+26-sk*.5} ${oy+26-sk} Q${ox+22} ${oy+12} ${ox+16} ${oy+2}Z" fill="${sc}" opacity=".78"/><path d="M${ox-12} ${oy+6} Q${ox-18} ${oy+30-sk} ${ox-22-sk} ${oy+48-sk}" stroke="${scD}" stroke-width="1.4" fill="none" opacity=".5"/><path d="M${ox-16} ${oy+2} Q${ox} ${oy+8} ${ox+16} ${oy+2}" stroke="${scD}" stroke-width="2" fill="none"/>`,
    fringe:(()=>{ let f=""; for(let i=0;i<=12;i++){ const x=ox-17+i*34/12, sp=(x-ox)*.25; f+=`<path d="M${x.toFixed(1)} ${oy+5} L${(x+sp-sk*.6).toFixed(1)} ${(oy+27-Math.abs(x-ox)*.12).toFixed(1)}" stroke="${i%2?sc:scD}" stroke-width="2.4" stroke-linecap="round"/>`; } return f+`<path d="M${ox-17} ${oy} L${ox+17} ${oy} L${ox+17} ${oy+6} Q${ox} ${oy+10} ${ox-17} ${oy+6}Z" fill="${sc}"/>`; })(),
  }[c.skirt]??"";
  // body: one-shoulder cut, accent, rhinestones
  const one=c.sleeves==="one";
  // one shoulder: skin over the torso's top-right, bounded by the torso's own top curve (from 40% along it) so nothing spills past the body
  const q0=[sl[0]-4,sl[1]], qc=[ox,sl[1]-6], q2=[sr[0]+4,sr[1]], t0=.4, qa=[mix(mix(q0[0],qc[0],t0),mix(qc[0],q2[0],t0),t0),mix(mix(q0[1],qc[1],t0),mix(qc[1],q2[1],t0),t0)], qb=[mix(qc[0],q2[0],t0),mix(qc[1],q2[1],t0)];
  let body=one?`<path d="M${qa[0]} ${qa[1]} Q${qb[0]} ${qb[1]} ${q2[0]} ${q2[1]} L${sr[0]+3} ${sr[1]+11} Z" fill="${skin}"/><path d="M${qa[0]} ${qa[1]+.5} L${sr[0]+3} ${sr[1]+11}" stroke="${leoD}" stroke-width="1.5" opacity=".6"/>`:"";
  const neck=one?`M${qa[0]} ${qa[1]+2} L${sr[0]+2} ${sr[1]+11}`:`M${sl[0]-2} ${sl[1]+1} Q${ox} ${sl[1]-4} ${sr[0]+2} ${sr[1]+1}`;
  body+={
    sash:`<path d="M${sl[0]+1} ${sl[1]+2} L${ox+15} ${oy+1}" stroke="${tc}" stroke-width="5"/><path d="M${sl[0]+1} ${sl[1]+3.5} L${ox+15} ${oy+2.5}" stroke="${tcD}" stroke-width="1" opacity=".5"/>`,
    belt:`<path d="M${ox-15.6} ${oy-5} L${ox+15.6} ${oy-5} L${ox+15.2} ${oy} L${ox-15.2} ${oy}Z" fill="${tc}"/><rect x="${ox-3.5}" y="${oy-6}" width="7" height="7" rx="1.5" fill="none" stroke="${tcD}" stroke-width="1.6"/>`,
    bow:`<path d="M${ox+8} ${oy-2} l-8 -5 v10z M${ox+8} ${oy-2} l8 -5 v10z" fill="${tc}"/><path d="M${ox+7} ${oy-1} l-4 12 M${ox+9} ${oy-1} l4 11" stroke="${tc}" stroke-width="2.4" stroke-linecap="round"/><circle cx="${ox+8}" cy="${oy-2}" r="2.6" fill="${tcD}"/>`,
    trim:`<path d="${neck}" stroke="${tc}" stroke-width="2.8" stroke-dasharray="0.1 3.6" stroke-linecap="round" fill="none"/>${c.skirt==="none"?"":`<path d="M${ox-16} ${oy+2} Q${ox} ${oy+8} ${ox+16} ${oy+2}" stroke="${tc}" stroke-width="2.8" stroke-dasharray="0.1 3.6" stroke-linecap="round" fill="none"/>`}`,
  }[c.accent]||"";
  const lv=Math.max(0,Math.min(3,+c.sparkle||0));
  if(lv){ const top=[(sl[0]+sr[0])/2,(sl[1]+sr[1])/2+3], hw=(sr[0]-sl[0])/2; const at=(t,u)=>[mix(top[0],ox,t)+u*mix(hw,14,t)*.75, mix(top[1],oy+2,t)];
    const torsoPts=[[.35,-.4],[.55,.3],[.75,-.1],[.2,.5],[.45,0],[.85,.55],[.3,-.75],[.65,-.6],[.9,-.4]].slice(0,[0,3,6,9][lv]);
    const skirtPts={chiffon:[[-14,14],[6,20],[20,15],[-4,24],[-24,22],[14,26]],tutu:[[-20,8],[0,10],[20,8],[-10,5],[10,5],[-28,9]],lyrical:[[-14,20],[2,28],[-20,40],[12,24],[-6,40],[18,22]],fringe:[[-10,3],[0,4],[10,3],[-15,3],[5,3],[15,3]],none:[]}[c.skirt]||[];
    body+=torsoPts.map(([t,u],i)=>{ const [x,y]=at(t,u); return gem(x,y,i%3?2.2:2.8); }).join("")+skirtPts.slice(0,[0,1,3,6][lv]).map(([dx,dy],i)=>gem(ox+dx,oy+dy,i%2?2:2.6,i%2?tc:"#fff")).join("");
    if(lv===3&&c.skirt==="tutu") body+=`<ellipse cx="${ox}" cy="${oy+9}" rx="34" ry="7.5" fill="none" stroke="${tc}" stroke-width="2" stroke-dasharray="0.1 4" stroke-linecap="round"/>`; }
  // sleeves (over the arms; hands drawn again so long sleeves end at the wrist)
  const cap=(a,b)=>limb(a,[mix(a[0],b[0],.4),mix(a[1],b[1],.4)],7,6,leo);
  const arms=c.sleeves==="cap"?cap(sl,el)+cap(sr,er):one?cap(sl,el):c.sleeves==="long"?limb(sl,el,6.6,5.6,leo)+limb(el,hl,5.6,4.6,leo)+limb(sr,er,6.6,5.6,leo)+limb(er,hr,5.6,4.6,leo)+`<circle cx="${hl[0]}" cy="${hl[1]}" r="5" fill="${skin}"/><circle cx="${hr[0]}" cy="${hr[1]}" r="5" fill="${skin}"/>`:"";
  const armGems=lv>=2&&(c.sleeves==="cap"||one||c.sleeves==="long")?gem(mix(sl[0],el[0],.25),mix(sl[1],el[1],.25),2)+(one?"":gem(mix(sr[0],er[0],.25),mix(sr[1],er[1],.25),2)):"";
  // headpiece
  const head={
    tiara:`<path d="M${hx-13} ${hy-R-1} L${hx-11} ${hy-R-10} L${hx-5.5} ${hy-R-5} L${hx} ${hy-R-15} L${hx+5.5} ${hy-R-5} L${hx+11} ${hy-R-10} L${hx+13} ${hy-R-1} Q${hx} ${hy-R-5} ${hx-13} ${hy-R-1}Z" fill="${tc}" stroke="${tcD}" stroke-width="1"/><circle cx="${hx}" cy="${hy-R-7}" r="2.3" fill="${leo}"/>${gem(hx-11,hy-R-11,1.6)}${gem(hx+11,hy-R-11,1.6)}`,
    flowers:[200,235,270,305,340].map((a,i)=>{ const r=a*Math.PI/180, x=hx+Math.cos(r)*(R+4), y=hy-4+Math.sin(r)*(R+4); const pc=i%2?sc:"#fff"; return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><circle cx="-3" cy="0" r="2.7" fill="${pc}"/><circle cx="3" cy="0" r="2.7" fill="${pc}"/><circle cx="0" cy="-3" r="2.7" fill="${pc}"/><circle cx="0" cy="3" r="2.7" fill="${pc}"/><circle r="2" fill="${tc}"/></g>`; }).join(""),
    feather:`<path d="M${hx-R+7} ${hy-17} Q${hx-R-12} ${hy-30} ${hx-R-10} ${hy-52} Q${hx-R+2} ${hy-36} ${hx-R+7} ${hy-17}Z" fill="${sc}"/><path d="M${hx-R+7} ${hy-17} Q${hx-R-6} ${hy-32} ${hx-R-10} ${hy-52}" stroke="${tc}" stroke-width="1.3" fill="none"/><circle cx="${hx-R+7}" cy="${hy-17}" r="3.4" fill="${tc}"/>`,
    star:star5(hx-R+7,hy-17,7,tc,`stroke="${tcD}" stroke-width="1"`)+gem(hx-R+7,hy-17,1.6),
  }[c.head]||"";
  return { skirt, body, arms:arms+armGems, head };
}
function avatarSVG(p,o={}){ if(!o.hair&&!o.noAv) o={...myAvatar(),...o}; const ox=o.ox??150, oy=(o.oy??178)-p.lift; const j=(k)=>[ox+p[k][0],oy+p[k][1]]; const [h,sl,sr,el,er,hl,hr,kl,kr,fl,fr]=["h","sl","sr","el","er","hl","hr","kl","kr","fl","fr"].map(j);
  const hip=o.style?o.style==="hiphop":MOTION.style==="hiphop"; const flaw=o.flaw||""; const cos=!hip&&o.costume&&typeof o.costume==="object"?o.costume:null; const leoC=cos?cosCol(cos.leo,"colors",o.leo||"#FF6FA3"):(o.leo||"#FF6FA3"); const skin=o.skin||"#FBE0D0", leo=hip?"#8B6CFF":leoC, leoD=hip?"#6B4CD9":shade(leoC), hair=o.hair||"#F2C86B", hairD=o.hairD||shade(hair), eyeC=o.eyes||"#7B5CFF", hs=o.hairStyle||"ponytail", acc=cos&&cos.head&&cos.head!=="own"?"none":(o.acc||"bow");
  // tapered limb as a quad
  const limb=(a,b,w1,w2,c)=>{ const dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy)||1,nx=-dy/L,ny=dx/L; return `<path d="M${a[0]+nx*w1} ${a[1]+ny*w1} L${b[0]+nx*w2} ${b[1]+ny*w2} L${b[0]-nx*w2} ${b[1]-ny*w2} L${a[0]-nx*w1} ${a[1]-ny*w1}Z" fill="${c}"/><circle cx="${a[0]}" cy="${a[1]}" r="${w1}" fill="${c}"/><circle cx="${b[0]}" cy="${b[1]}" r="${w2}" fill="${c}"/>`; };
  const neck=[(sl[0]+sr[0])/2,(sl[1]+sr[1])/2]; const hx=h[0], hy=h[1]-6; const R=21; const vx=Math.max(-14,Math.min(14,MOTION.vel.hx||0)), vy=Math.max(-10,Math.min(10,MOTION.vel.hy||0)), sk=Math.max(-10,Math.min(10,MOTION.vel.hipx||0));
  const legs=limb([ox-8,oy],kl,8,6.5,hip?"#2E2140":skin)+limb(kl,fl,6.5,5,hip?"#2E2140":skin)+limb([ox+8,oy],kr,8,6.5,hip?"#2E2140":skin)+limb(kr,fr,6.5,5,hip?"#2E2140":skin);
  const shoes=`<ellipse cx="${fl[0]}" cy="${fl[1]+2}" rx="6" ry="4" fill="${hip?"#fff":"#F4B8CF"}"/>`+(flaw==="flex"?`<rect x="${fr[0]-4}" y="${fr[1]-9}" width="8" height="12" rx="3" fill="${hip?"#fff":"#F4B8CF"}" transform="rotate(-70 ${fr[0]} ${fr[1]})"/>`:`<ellipse cx="${fr[0]}" cy="${fr[1]+2}" rx="6" ry="4" fill="${hip?"#fff":"#F4B8CF"}"/>`);
  const torso=`<path d="M${sl[0]-4} ${sl[1]} Q${ox} ${sl[1]-6} ${sr[0]+4} ${sr[1]} L${ox+15} ${oy+6} Q${ox} ${oy+12} ${ox-15} ${oy+6}Z" fill="${leo}"/><path d="M${sl[0]-4} ${sl[1]} L${ox-15} ${oy+6} Q${ox-6} ${oy-10} ${ox-2} ${sl[1]+4}Z" fill="${leoD}" opacity=".35"/>`;
  const cp=cos?costumeParts(cos,{ox,oy,sl,sr,el,er,hl,hr,hx,hy,R,sk,skin,leo,leoD,limb}):null;
  const skirt=cp?cp.skirt+cp.body:hip?`<path d="M${ox-17} ${oy-2} L${ox+17} ${oy-2} L${ox+15} ${oy+12} L${ox-15} ${oy+12}Z" fill="#2E2140"/>`:`<path d="M${ox-16} ${oy+2} Q${ox-30} ${oy+22-sk} ${ox-32-Math.abs(sk)} ${oy+30-sk*1.5} Q${ox-16} ${oy+24-sk} ${ox} ${oy+32-sk*1.2} Q${ox+16} ${oy+24-sk} ${ox+32+Math.abs(sk)} ${oy+30-sk*1.5} Q${ox+30} ${oy+22-sk} ${ox+16} ${oy+2}Z" fill="${leo}" opacity=".85"/><path d="M${ox-16} ${oy+2} Q${ox} ${oy+8} ${ox+16} ${oy+2}" stroke="${leoD}" stroke-width="2" fill="none"/>`;
  const arms=limb(sl,el,6,5,skin)+limb(el,hl,5,4,skin)+limb(sr,er,6,5,skin)+limb(er,hr,5,4,skin)+`<circle cx="${hl[0]}" cy="${hl[1]}" r="5" fill="${skin}"/><circle cx="${hr[0]}" cy="${hr[1]}" r="5" fill="${skin}"/>`;
  const sleeves=hip?`<circle cx="${sl[0]}" cy="${sl[1]}" r="8" fill="${leo}"/><circle cx="${sr[0]}" cy="${sr[1]}" r="8" fill="${leo}"/>`:"";
  const head=`${limb(neck,[hx,hy+R-6],5,4,skin)}
   <path d="M${hx-R-3} ${hy-2} Q${hx-R-6} ${hy-R-8} ${hx} ${hy-R-8} Q${hx+R+6} ${hy-R-8} ${hx+R+3} ${hy-2} L${hx+R-2} ${hy+6} L${hx-R+2} ${hy+6}Z" fill="${hair}"/>
   <circle cx="${hx}" cy="${hy}" r="${R}" fill="${skin}"/>
   <path d="M${hx-R+1} ${hy-4} Q${hx-14} ${hy-R-6} ${hx-2} ${hy-R+2} Q${hx+2} ${hy-R-2} ${hx+8} ${hy-R+4} Q${hx+14} ${hy-R-6} ${hx+R-1} ${hy-4} Q${hx+R} ${hy-R-9} ${hx} ${hy-R-9} Q${hx-R} ${hy-R-9} ${hx-R+1} ${hy-4}Z" fill="${hair}"/>
   ${hs==="ponytail"||hs==="curly"?`<path d="M${hx+R-4} ${hy-14} Q${hx+R+14+vx} ${hy-30+vy} ${hx+R+8+vx*1.6} ${hy-40+vy*1.6} Q${hx+R+18+vx*1.6} ${hy-26+vy*1.4} ${hx+R+12+vx} ${hy-6+vy} Q${hx+R+6} ${hy+6} ${hx+R-2} ${hy-2}Z" fill="${hairD}"/><path d="M${hx+R-6} ${hy-12} Q${hx+R+8+vx} ${hy-24+vy} ${hx+R+2+vx*1.5} ${hy-34+vy*1.5}" stroke="${hair}" stroke-width="5" fill="none" stroke-linecap="round"/>`:""}
   ${hs==="curly"?`<circle cx="${hx+R+6+vx}" cy="${hy-8+vy}" r="5" fill="${hair}"/><circle cx="${hx+R+12+vx*1.2}" cy="${hy-18+vy*1.2}" r="5.5" fill="${hairD}"/><circle cx="${hx+R+5+vx*1.5}" cy="${hy-30+vy*1.5}" r="5" fill="${hair}"/><circle cx="${hx+R+14+vx}" cy="${hy+2+vy}" r="4.5" fill="${hair}"/><circle cx="${hx-R+2}" cy="${hy-R+4}" r="4" fill="${hairD}"/><circle cx="${hx+R-3}" cy="${hy-R+3}" r="4" fill="${hairD}"/>`:""}
   ${hs==="bun"?`<circle cx="${hx}" cy="${hy-R-4}" r="9" fill="${hairD}"/><circle cx="${hx-3}" cy="${hy-R-6}" r="4" fill="${hair}"/>`:""}
   ${hs==="braids"?`<path d="M${hx-R+2} ${hy+2} q-6 14 -3 30 M${hx+R-2} ${hy+2} q6 14 3 30" stroke="${hairD}" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M${hx-R+2} ${hy+2} q-6 14 -3 30 M${hx+R-2} ${hy+2} q6 14 3 30" stroke="${hair}" stroke-width="3" fill="none" stroke-dasharray="4 4"/>`:""}
   ${hs==="loose"?`<path d="M${hx-R-2} ${hy-6} q-8 24 -4 44 l10 -2 q-2 -20 2 -36z M${hx+R+2} ${hy-6} q8 24 4 44 l-10 -2 q2 -20 -2 -36z" fill="${hairD}"/>`:""}
   ${acc==="bow"?`<path d="M${hx+R-9} ${hy-14} l-6 -6 l7 -1 l-2 -7 l7 5 l1 -7 l3 7 l7 -3 l-4 6 l6 4 l-8 1z" fill="#FF3D8A"/>`:""}
   ${acc==="scrunchie"?`<ellipse cx="${hx+R-5}" cy="${hy-13}" rx="7" ry="4.5" fill="none" stroke="#FF3D8A" stroke-width="4" stroke-dasharray="3 2"/>`:""}
   ${acc==="headband"?`<path d="M${hx-R+1} ${hy-6} Q${hx} ${hy-R-2} ${hx+R-1} ${hy-6}" stroke="#FF3D8A" stroke-width="4" fill="none"/>`:""}
   ${acc==="flower"?`<g transform="translate(${hx+R-6} ${hy-16})"><circle cx="-5" cy="0" r="3.5" fill="#FF8FB8"/><circle cx="5" cy="0" r="3.5" fill="#FF8FB8"/><circle cx="0" cy="-5" r="3.5" fill="#FF8FB8"/><circle cx="0" cy="5" r="3.5" fill="#FF8FB8"/><circle r="3" fill="#FFD23F"/></g>`:""}
   <ellipse cx="${hx-8}" cy="${hy+2}" rx="5.5" ry="7.5" fill="#fff"/><ellipse cx="${hx+8}" cy="${hy+2}" rx="5.5" ry="7.5" fill="#fff"/>
   <ellipse cx="${hx-7.5}" cy="${hy+3}" rx="4" ry="6" fill="${eyeC}"/><ellipse cx="${hx+8.5}" cy="${hy+3}" rx="4" ry="6" fill="${eyeC}"/>
   <ellipse cx="${hx-7.5}" cy="${hy+4.5+(flaw==="eyes"?3:0)}" rx="2.6" ry="3.8" fill="#2E2140"/><ellipse cx="${hx+8.5}" cy="${hy+4.5+(flaw==="eyes"?3:0)}" rx="2.6" ry="3.8" fill="#2E2140"/>
   <circle cx="${hx-9.5}" cy="${hy}" r="1.8" fill="#fff"/><circle cx="${hx+6.5}" cy="${hy}" r="1.8" fill="#fff"/><circle cx="${hx-6}" cy="${hy+6}" r=".9" fill="#fff"/><circle cx="${hx+10}" cy="${hy+6}" r=".9" fill="#fff"/>
   <path d="M${hx-13} ${hy-6} q5 -3 10 -1 M${hx+3} ${hy-7} q5 -2 10 1" stroke="#C9924A" stroke-width="1.4" fill="none" stroke-linecap="round"/>
   <circle cx="${hx-14}" cy="${hy+10}" r="3.5" fill="#FF9DBE" opacity=".6"/><circle cx="${hx+14}" cy="${hy+10}" r="3.5" fill="#FF9DBE" opacity=".6"/>
   <path d="M${hx-3} ${hy+13} q3 2.5 6 0" stroke="#C0466E" stroke-width="1.5" fill="none" stroke-linecap="round"/>`;
  const extras=(flaw==="sock"?`<path d="M${kr[0]} ${kr[1]} L${fr[0]} ${fr[1]}" stroke="#fff" stroke-width="9" stroke-linecap="round"/><path d="M${kr[0]} ${kr[1]} L${fr[0]} ${fr[1]}" stroke="#FF5C93" stroke-width="9" stroke-linecap="round" stroke-dasharray="3 6"/>`:"")+(flaw==="shades"?`<rect x="${hx-15}" y="${hy-4}" width="13" height="10" rx="4" fill="#2E2140"/><rect x="${hx+2}" y="${hy-4}" width="13" height="10" rx="4" fill="#2E2140"/><path d="M${hx-2} ${hy} h4" stroke="#2E2140" stroke-width="2"/>`:"");
  const g=`<g transform="${o.pre||""} rotate(${p.rot} ${ox} ${oy})">${legs}${shoes}${torso}${skirt}${sleeves}${arms}${cp?cp.arms:""}${head}${cp?cp.head:""}${extras}</g>`; return g; }
// ---------- AVATAR BUILDER ----------
const AV={open:false};
function avRender(){ const a=myAvatar(); $("#avName").textContent=a.name||"Sofia"; const pose=P({el:[-36,-40],er:[36,-40],hl:[-58,-52],hr:[58,-52],kr:[26,26],fr:[8,36]}); $("#avSvg").innerHTML=avatarSVG(pose,{...a});
  $("#avOpts").style.display=AV.open?"block":"none"; if(!AV.open) return;
  const lab={hairStyle:"Hair",hair:"Hair color",eyes:"Eyes",skin:"Skin",leo:"Leotard",acc:"Accessory"};
  const wc=wornCostume(); $("#avOpts").innerHTML=(wc?`<div class="small muted">👗 You're wearing “${esc(wc.name)}”: its leotard${wc.head!=="own"?" and headpiece":""} show instead. <button class="lnk small" onclick="cosTakeOff()">Usual leotard</button></div>`:"")+`<label class="f">Name</label><input type="text" id="avNameIn" value="${esc(a.name||"Sofia")}" onchange="avSet('name',this.value)">`+Object.entries(AV_OPTS).map(([k,opts])=>`<div class="field-lab">${lab[k]}</div><div class="row" style="margin-top:4px">${opts.map(([v,n])=>{ const u=UNLOCKS.find(x=>x[0]===k&&x[1]===v); const locked=u&&!isUnlocked(k,v); return `<button class="btn sm ${a[k]===v?"coral":"ghost"} ${locked?"locked":""}" onclick="avSet('${k}','${v}')" style="${k==="hair"||k==="leo"||k==="eyes"||k==="skin"?`border-left:10px solid ${v}`:""}">${locked?"🔒 ":""}${n}${locked?` <small>${u[2]}⭐</small>`:""}</button>`; }).join("")}</div>`).join(""); }
async function avSet(k,v){ if(!isUnlocked(k,v)){ const u=UNLOCKS.find(x=>x[0]===k&&x[1]===v); return toast(`🔒 ${u[3]}: ${u[2]-totalStars()} more ⭐ to unlock`); } const a={...myAvatar(),[k]:v}; if(k==="hair") a.hairD=shade(v); await storeSet("settings","main",{...S.settings,avatar:a}); avRender(); }
function avToggle(){ AV.open=!AV.open; avRender(); }
export { shade, myAvatar, wornCostume, avatarSVG, avRender, avSet, avToggle };
expose({ avSet, avToggle, avRender });
