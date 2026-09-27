// Small shared helpers. Nothing here touches the DOM at import time (store.js and the tests import this in Node).
export const $=(s)=>document.querySelector(s); export const $$=(s)=>[...document.querySelectorAll(s)];
export const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
export const esc=(s)=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
export const fmt=(d)=>new Date(d+"T00:00:00").toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric"});
export const todayStr=()=>{const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");};
export const dateStr=(d)=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
export const daysUntil=(d)=>Math.ceil((new Date(d+"T00:00:00")-new Date(todayStr()+"T00:00:00"))/86400000);
export function grow(el){ el.style.height="auto"; el.style.height=(el.scrollHeight+2)+"px"; }
export function growAll(root){ (root||document).querySelectorAll("textarea").forEach(t=>{ grow(t); t.oninput=()=>grow(t); }); }
export const roText=(lab,v)=>`<div class="field-lab">${lab}</div><div class="ro">${esc(v||"")}</div>`;
export const roList=(lab,arr)=>{ const a=(arr||[]).filter(x=>String(x).trim()); return `<div class="field-lab">${lab}</div><div class="ro">${a.length?`<ul>${a.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`:""}</div>`; };
export const edText=(k,lab,v,ph)=>`<label class="f">${lab}</label><textarea data-k="${k}" class="dfield" placeholder="${ph||""}">${esc(v||"")}</textarea>`;
export const edList=(k,lab,arr)=>`<label class="f">${lab} <span class="muted">(one per line)</span></label><textarea data-k="${k}" data-list="1" class="dfield">${esc((arr||[]).join("\n"))}</textarea>`;
export function toast(m,ms=1600){ const t=$("#toast"); t.textContent=m; t.classList.add("on"); clearTimeout(t._t); t._t=setTimeout(()=>t.classList.remove("on"),ms); }
export function lerp(a,b,t){return a+(b-a)*t;} export function lp(a,b,t){return [lerp(a[0],b[0],t),lerp(a[1],b[1],t)];}
// Inline onclick="" handlers in the markup call these by global name.
export const expose=(o)=>Object.assign(window,o);
export const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
// Hand a Blob to the device: the share sheet on phones (Save to Files), a download elsewhere.
export async function saveBlob(blob,name){
  const file=new File([blob],name,{type:blob.type||"application/octet-stream"});
  if(navigator.canShare&&navigator.canShare({files:[file]})){ try{ await navigator.share({files:[file],title:name}); return; }catch(e){ if(e.name==="AbortError") return; } }
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },4000);
}
// Load a classic (non-module) script from a pinned CDN once.
const loaded={};
export function loadScript(src){ return loaded[src]||(loaded[src]=new Promise((res,rej)=>{ const s=document.createElement("script"); s.src=src; s.onload=res; s.onerror=()=>{ delete loaded[src]; rej(new Error("Could not load "+src)); }; document.head.appendChild(s); })); }
