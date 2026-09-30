// Dances tab: one "cover" card per dance — art, song, ▶ Practice, the top three fixes as chips (tap = Show me), a quick
// "＋ Note from class", and everything text-heavy under "More ▸" (collapsed). Edit mode lives inside More.
import { $, esc, growAll, toast, uid, expose, roText, roList, edText, edList } from "../util.js";
import { S, storeSet, dances } from "../store.js";
import { photoTile, uploadMusic } from "./notes.js";
import { TAGS, TAG_LABEL, TAG_EMOJI, topFixes, forDance, patterns, addCorrection, closeCorrection, reopenCorrection, removeCorrection, inferTag } from "../corrections.js";
import { checkBadges } from "../badges.js";

const STYLE_EMOJI = { lyrical:"🌸", jazz:"⚡", contemporary:"🌊", "hip hop":"🎧", hiphop:"🎧", ballet:"🩰", acro:"🤸", ballroom:"💃", tap:"👟" };
export const danceEmoji = (d) => STYLE_EMOJI[String(d.style || "").toLowerCase().trim()] || "🎵";
const musicButton=(d)=>`<label class="btn sm ghost" for="dmusic-${d.id}">🎵 ${d.musicFile&&d.musicFile.url?"Replace music file":"Add music file"}</label><input type="file" id="dmusic-${d.id}" hidden onchange="addMusic(this.files[0],'${d.id}');this.value=''">`;
const musicPlayer=(d)=>d.musicFile&&d.musicFile.url?`<div class="field-lab">Music file · ${esc(d.musicFile.name||"")}</div><audio controls preload="none" src="${esc(d.musicFile.url)}" style="width:100%;margin-top:4px"></audio>`:"";
async function addMusic(file,danceId){ if(!file) return; await uploadMusic(file,danceId); }
export function danceEdit(id){ editDance=id; if(id) moreOpen.add(id); renderDances(); }
export function initDances(){
  $("#addDance").onclick=async()=>{ const n=$("#newDanceName").value.trim(); if(!n) return; const id="d"+uid(); await storeSet("dances",id,{id,name:n,song:"",style:"",choreo:"",costume:"",shoes:"",hair:"",color:"coral",music:"",map:"",strengths:[],corrections:[],notes:"",links:[],teacher:"",rehearsal:"",musicUrl:"",bpm:""}); $("#newDanceName").value=""; editDance=id; moreOpen.add(id); };
}
let editDance=null, noteFor=null, noteTag="other"; const moreOpen=new Set();
function coverArt(d){ const ph=Object.values(S.photos).filter(p=>p.dance===d.id&&p.kind!=="video").sort((a,b)=>(b.at||"").localeCompare(a.at||""))[0]; return ph&&ph.url?`<img src="${esc(ph.url)}" alt="" loading="lazy">`:`<span>${danceEmoji(d)}</span>`; }
function chips(d){
  const top=topFixes(S.corrections,d.id); if(!top.length) return `<div class="small muted">No fixes yet. Add a note from class.</div>`;
  return `<div class="fixchips">${top.map(c=>`<button class="fixchip" onclick="showMe('${c.id}')">${TAG_EMOJI[c.tag]||"✨"} ${esc(c.text)}</button>`).join("")}</div>`;
}
function patternLine(d){
  const ps=patterns(S.corrections,{danceId:d.id}); if(!ps.length) return "";
  return ps.map(p=>{ const open=forDance(S.corrections,d.id).find(c=>c.tag===p.tag&&c.status!=="done"); return `<div class="row pattern"><span class="grow">${TAG_EMOJI[p.tag]} You've had this note ${p.n} times: <b>${TAG_LABEL[p.tag]}</b></span>${open?`<button class="btn sm sun" onclick="gotIt('${open.id}')">Got it!</button>`:""}</div>`; }).join("");
}
function noteForm(d){
  const sources=[...new Set([d.teacher,d.choreo].map(s=>String(s||"").split(/[(,;·]/)[0].trim()).filter(Boolean)),"Mom","me"];
  return `<div class="note-form" data-note="${d.id}">
    <div class="tagpick">${TAGS.map(t=>`<button class="chip ${noteTag===t?"coral":""}" onclick="noteTagSet('${t}')">${TAG_EMOJI[t]} ${TAG_LABEL[t]}</button>`).join("")}</div>
    <div class="row" style="margin-top:6px"><input type="text" id="noteText-${d.id}" placeholder="What did they say?" maxlength="140" autocomplete="off">${("webkitSpeechRecognition" in window||"SpeechRecognition" in window)?`<button class="btn sm ghost" id="noteMic-${d.id}" onclick="noteMic('${d.id}')" title="Say it">🎤</button>`:""}</div>
    <div class="row" style="margin-top:6px"><select id="noteSrc-${d.id}" style="max-width:150px">${sources.map(s=>`<option>${esc(s)}</option>`).join("")}</select><span class="grow"></span><button class="btn sm ghost" onclick="noteCancel()">Cancel</button><button class="btn sm coral" onclick="noteSave('${d.id}')">Save</button></div></div>`;
}
function fullList(d){
  const all=forDance(S.corrections,d.id); if(!all.length) return `<div class="ro"></div>`;
  return `<div class="ro"><ul class="corr-list">${all.map(c=>`<li class="${c.status==="done"?"done":""}"><span class="chip ${c.status==="done"?"mint":"violet"}">${TAG_EMOJI[c.tag]} ${TAG_LABEL[c.tag]||c.tag}</span> ${esc(c.text)} <span class="muted small">· ${esc(c.source||"")} ${esc(c.date||"")}</span> ${c.status==="done"?`<button class="lnk" onclick="reopenFix('${c.id}')">reopen</button>`:`<button class="lnk" onclick="gotIt('${c.id}')">got it</button>`} <button class="lnk" onclick="removeFix('${c.id}')">remove</button></li>`).join("")}</ul></div>`;
}
function renderDances(){
  if(editDance&&document.querySelector(`.card[data-id="${editDance}"] .dfield`)) return; // keep an edit in progress when a sync update arrives
  if(noteFor&&document.querySelector(`[data-note="${noteFor}"] input`)&&document.querySelector(`[data-note="${noteFor}"] input`).value) return; // keep a note being typed
  const list=dances();
  $("#danceList").innerHTML=list.map(d=>{
    const editing=editDance===d.id; const open=moreOpen.has(d.id);
    const cover=`<div class="cover-top"><div class="cover-art ${d.color||""}">${coverArt(d)}</div><div class="grow"><h3>${esc(d.name)}</h3><div class="small muted">${esc(d.song||"song TBD")}</div></div></div>
      <div class="row cover-actions"><button class="btn coral grow" onclick="openPlayer('${d.id}')">▶ Practice</button><button class="btn ghost" onclick="noteOpen('${d.id}')">＋ Note</button></div>
      ${noteFor===d.id?noteForm(d):""}${chips(d)}${patternLine(d)}`;
    const mapbar=d.id==="solo"?`<div class="mapbar" style="margin:8px 0"><div class="soft">soft 0:00–0:48</div><div class="loud">full 0:48–1:52</div><div class="fade">fade</div></div>`:"";
    const photos=`<div class="field-lab">Photos for this dance</div><div class="photos" style="margin-top:6px">${Object.entries(S.photos).filter(([,p])=>p.dance===d.id).map(([pid,p])=>`<div class="ph">${photoTile(p)}${p.cap?`<div class="cap">${esc(p.cap)}</div>`:""}<button class="del" onclick="delPhoto('${pid}')">✕</button></div>`).join("")}</div>
      <div class="row" style="margin-top:6px"><label class="btn sm ghost" for="dphoto-${d.id}">+ Add photo</label><input type="file" id="dphoto-${d.id}" accept="image/*" multiple hidden onchange="addPhotos(this.files,'${d.id}');this.value=''"></div>`;
    let more;
    if(!editing){
      const links=(d.links||[]).filter(Boolean);
      more=`${mapbar}<div class="row" style="margin-top:6px">${d.musicUrl?`<a class="btn sm aqua" href="${esc(d.musicUrl)}" target="_blank" rel="noopener">▶ Music link</a>`:""}${links.map((u,i)=>`<a class="btn sm" href="${esc(u)}" target="_blank" rel="noopener">🔗 Link ${i+1}</a>`).join("")}${musicButton(d)}<span class="grow"></span><button class="btn sm coral" onclick="danceEdit('${d.id}')">✏️ Edit</button></div>${musicPlayer(d)}
        ${roText("Song",d.song)}${roText("Style",d.style)}${roText("BPM",d.bpm)}${roText("Choreographer",d.choreo)}${roText("Teacher / class",d.teacher)}${roText("Rehearsal & class schedule",d.rehearsal)}
        ${roText("Costume",d.costume)}${roText("Shoes",d.shoes)}${roText("Hair",d.hair)}
        ${roText("Music map",d.music)}${roText("Where the big moments land",d.map)}
        ${roList("What's already strong",d.strengths)}<div class="field-lab">All corrections</div>${fullList(d)}${roList("Trick drills",d.tricks)}${roList("Where do I look?",d.eyes)}
        ${roText("Notes",d.notes)}${photos}`;
    } else {
      more=`<p class="small muted">Editing. Nothing is saved until you tap Save.</p>
      ${edText("song","Song",d.song,"Title — artist")}${edText("style","Style",d.style)}${edText("bpm","BPM (beats per minute, for the count overlay)",d.bpm,"e.g. 76")}${edText("choreo","Choreographer",d.choreo)}${edText("teacher","Teacher / class",d.teacher)}${edText("rehearsal","Rehearsal & class schedule",d.rehearsal)}
      ${edText("musicUrl","Music link",d.musicUrl,"Paste a link to the track")}${edList("links","Video / other links",d.links)}
      ${edText("costume","Costume",d.costume)}${edText("shoes","Shoes",d.shoes)}${edText("hair","Hair",d.hair)}
      ${edText("music","Music map",d.music)}${edText("map","Where the big moments land (m:ss timestamps become loop presets)",d.map)}
      ${edList("strengths","What's already strong",d.strengths)}${edList("corrections","Corrections (older list — new lines become notes)",d.corrections)}${edList("tricks","Trick drills",d.tricks)}${edList("eyes","Where do I look?",d.eyes)}
      ${edText("notes","Notes",d.notes)}
      <div class="row" style="margin-top:10px"><button class="btn coral" onclick="saveDance('${d.id}')">Save</button><button class="btn ghost" onclick="danceEdit(null)">Cancel</button><span class="grow"></span><button class="btn sm ghost" onclick="delDance('${d.id}')">Remove dance</button></div>`;
    }
    return `<div class="card cover ${d.color||""}" data-id="${d.id}">${cover}<details class="more" ${open?"open":""} data-more="${d.id}"><summary>More ▸</summary>${more}</details></div>`;
  }).join("");
  $("#danceList").querySelectorAll("details.more").forEach(el=>el.addEventListener("toggle",()=>{ el.open?moreOpen.add(el.dataset.more):moreOpen.delete(el.dataset.more); }));
  growAll($("#danceList"));
}
function collectDance(id){ const card=document.querySelector(`.card[data-id="${id}"]`); const d={...dances().find(x=>x.id===id)}; card.querySelectorAll(".dfield").forEach(el=>{ d[el.dataset.k]=el.dataset.list?el.value.split("\n").map(x=>x.trim()).filter(Boolean):el.value; }); if(d.bpm!==""&&d.bpm!==undefined){ const n=parseFloat(d.bpm); d.bpm=Number.isFinite(n)&&n>0?n:""; } return d; }
async function saveDance(id){ await storeSet("dances",id,collectDance(id)); editDance=null; renderDances(); toast("Saved"); }
async function delDance(id){ if(!confirm("Remove this dance from the list?")) return; await storeSet("dances",id,{...(S.dances[id]||{}),deleted:true}); editDance=null; }

// ---- quick note ----
let rec=null;
function noteOpen(id){ noteFor=id; noteTag="other"; renderDances(); setTimeout(()=>{ const i=$("#noteText-"+id); if(i) i.focus(); },30); }
function noteCancel(){ noteFor=null; stopMic(); renderDances(); }
function noteTagSet(t){ noteTag=t; document.querySelectorAll(".tagpick .chip").forEach(b=>b.classList.toggle("coral",b.textContent.trim().endsWith(TAG_LABEL[t]))); }
async function noteSave(id){ const text=($("#noteText-"+id)||{}).value||""; if(!text.trim()) return toast("Type or say the note first"); const src=($("#noteSrc-"+id)||{}).value||"me"; const tag=noteTag==="other"?inferTag(text):noteTag; await addCorrection({danceId:id,text,tag,source:src}); noteFor=null; stopMic(); renderDances(); toast("Saved ✓"); }
function stopMic(){ if(rec){ try{ rec.stop(); }catch(e){} rec=null; } }
function noteMic(id){
  if(rec) return stopMic();
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition; if(!SR) return toast("Voice isn't available here");
  rec=new SR(); rec.lang="en-US"; rec.interimResults=true; rec.maxAlternatives=1; const btn=$("#noteMic-"+id); if(btn) btn.classList.add("coral");
  rec.onresult=(e)=>{ const t=[...e.results].map(r=>r[0].transcript).join(" "); const i=$("#noteText-"+id); if(i) i.value=t.trim(); };
  rec.onerror=(e)=>{ toast(e.error==="not-allowed"?"Allow the microphone to use voice":"Voice didn't work — type it"); stopMic(); if(btn) btn.classList.remove("coral"); };
  rec.onend=()=>{ rec=null; if(btn) btn.classList.remove("coral"); const i=$("#noteText-"+id); if(i&&i.value&&noteTag==="other") noteTag=inferTag(i.value); };
  try{ rec.start(); toast("Listening… say the note",2000); }catch(e){ toast("Voice didn't start"); stopMic(); }
}
async function gotIt(id){ const c=await closeCorrection(id); if(c) toast("Got it! ✅"); checkBadges(); }
async function reopenFix(id){ await reopenCorrection(id); }
async function removeFix(id){ if(confirm("Remove this note?")) await removeCorrection(id); }
export { renderDances, saveDance, delDance };
expose({ danceEdit, saveDance, delDance, addMusic, noteOpen, noteCancel, noteTagSet, noteSave, noteMic, gotIt, reopenFix, removeFix });
