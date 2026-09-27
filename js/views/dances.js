// Dances tab: the merged list of built-in + edited dances, read/edit cards, per-dance photos and music file.
import { $, esc, growAll, toast, uid, expose, roText, roList, edText, edList } from "../util.js";
import { S, storeSet, dances } from "../store.js";
import { photoTile, uploadMusic } from "./notes.js";

const musicButton=(d)=>`<label class="btn sm ghost" for="dmusic-${d.id}">🎵 ${d.musicFile&&d.musicFile.url?"Replace music file":"Add music file"}</label><input type="file" id="dmusic-${d.id}" accept="audio/*" hidden onchange="addMusic(this.files[0],'${d.id}');this.value=''">`;
const musicPlayer=(d)=>d.musicFile&&d.musicFile.url?`<div class="field-lab">Music file · ${esc(d.musicFile.name||"")}</div><audio controls preload="none" src="${esc(d.musicFile.url)}" style="width:100%;margin-top:4px"></audio>`:"";
async function addMusic(file,danceId){ if(!file) return; await uploadMusic(file,danceId); }
export function danceToggle(id){ openDance=openDance===id?null:id; editDance=null; renderDances(); }
export function danceEdit(id){ editDance=id; renderDances(); }
export function initDances(){
  $("#addDance").onclick=async()=>{ const n=$("#newDanceName").value.trim(); if(!n) return; const id="d"+uid(); await storeSet("dances",id,{id,name:n,song:"",style:"",choreo:"",costume:"",shoes:"",hair:"",color:"coral",music:"",map:"",strengths:[],corrections:[],notes:"",links:[],teacher:"",rehearsal:"",musicUrl:""}); $("#newDanceName").value=""; openDance=id; editDance=id; };
}
let openDance=null, editDance=null;
function renderDances(){
  if(editDance&&document.querySelector(`.card[data-id="${editDance}"] .dfield`)) return; // keep an edit in progress when a sync update arrives
  const list=dances();
  $("#danceList").innerHTML=list.map(d=>{
    const opened=openDance===d.id, editing=editDance===d.id;
    const head=`<div class="row" onclick="danceToggle('${d.id}')" style="cursor:pointer"><div class="grow"><h3>${esc(d.name)}</h3><div class="small muted">${esc(d.song||"song TBD")}${d.style?" · "+esc(d.style):""}${d.choreo?" · "+esc(d.choreo):""}</div></div><span class="chip ${d.color||""}">${opened?"close":"open"}</span></div>`;
    if(!opened) return `<div class="card ${d.color||""}">${head}</div>`;
    const mapbar=d.id==="solo"?`<div class="mapbar" style="margin:8px 0"><div class="soft">soft 0:00–0:48</div><div class="loud">full 0:48–1:52</div><div class="fade">fade</div></div>`:"";
    const photos=`<div class="field-lab">Photos for this dance</div><div class="photos" style="margin-top:6px">${Object.entries(S.photos).filter(([,p])=>p.dance===d.id).map(([pid,p])=>`<div class="ph">${photoTile(p)}${p.cap?`<div class="cap">${esc(p.cap)}</div>`:""}<button class="del" onclick="delPhoto('${pid}')">✕</button></div>`).join("")}</div>
      <div class="row" style="margin-top:6px"><label class="btn sm ghost" for="dphoto-${d.id}">+ Add photo</label><input type="file" id="dphoto-${d.id}" accept="image/*" multiple hidden onchange="addPhotos(this.files,'${d.id}');this.value=''"></div>`;
    if(!editing){
      const links=(d.links||[]).filter(Boolean);
      return `<div class="card ${d.color||""}" data-id="${d.id}">${head}${mapbar}
        <div class="row" style="margin-top:6px">${d.musicUrl?`<a class="btn sm aqua" href="${esc(d.musicUrl)}" target="_blank" rel="noopener">▶ Music</a>`:""}${links.map((u,i)=>`<a class="btn sm" href="${esc(u)}" target="_blank" rel="noopener">🔗 Link ${i+1}</a>`).join("")}${musicButton(d)}<span class="grow"></span><button class="btn sm coral" onclick="danceEdit('${d.id}')">✏️ Edit</button></div>${musicPlayer(d)}
        ${roText("Song",d.song)}${roText("Style",d.style)}${roText("Choreographer",d.choreo)}${roText("Teacher / class",d.teacher)}${roText("Rehearsal & class schedule",d.rehearsal)}
        ${roText("Costume",d.costume)}${roText("Shoes",d.shoes)}${roText("Hair",d.hair)}
        ${roText("Music map",d.music)}${roText("Where the big moments land",d.map)}
        ${roList("What's already strong",d.strengths)}${roList("Corrections to work on",d.corrections)}${roList("Trick drills",d.tricks)}${roList("Where do I look?",d.eyes)}
        ${roText("Notes",d.notes)}${photos}</div>`;
    }
    return `<div class="card ${d.color||""}" data-id="${d.id}">${head}
      <p class="small muted">Editing. Nothing is saved until you tap Save.</p>
      ${edText("song","Song",d.song,"Title — artist")}${edText("style","Style",d.style)}${edText("choreo","Choreographer",d.choreo)}${edText("teacher","Teacher / class",d.teacher)}${edText("rehearsal","Rehearsal & class schedule",d.rehearsal)}
      ${edText("musicUrl","Music link",d.musicUrl,"Paste a link to the track")}${edList("links","Video / other links",d.links)}
      ${edText("costume","Costume",d.costume)}${edText("shoes","Shoes",d.shoes)}${edText("hair","Hair",d.hair)}
      ${edText("music","Music map",d.music)}${edText("map","Where the big moments land",d.map)}
      ${edList("strengths","What's already strong",d.strengths)}${edList("corrections","Corrections to work on",d.corrections)}${edList("tricks","Trick drills",d.tricks)}${edList("eyes","Where do I look?",d.eyes)}
      ${edText("notes","Notes",d.notes)}
      <div class="row" style="margin-top:10px"><button class="btn coral" onclick="saveDance('${d.id}')">Save</button><button class="btn ghost" onclick="danceEdit(null)">Cancel</button><span class="grow"></span><button class="btn sm ghost" onclick="delDance('${d.id}')">Remove dance</button></div></div>`;
  }).join("");
  growAll($("#danceList"));
}
function collectDance(id){ const card=document.querySelector(`.card[data-id="${id}"]`); const d={...dances().find(x=>x.id===id)}; card.querySelectorAll(".dfield").forEach(el=>{ d[el.dataset.k]=el.dataset.list?el.value.split("\n").map(x=>x.trim()).filter(Boolean):el.value; }); return d; }
async function saveDance(id){ await storeSet("dances",id,collectDance(id)); editDance=null; renderDances(); toast("Saved"); }
async function delDance(id){ if(!confirm("Remove this dance from the list?")) return; await storeSet("dances",id,{...(S.dances[id]||{}),deleted:true}); openDance=null; editDance=null; }
export { renderDances, saveDance, delDance };
expose({ danceToggle, danceEdit, saveDance, delDance, addMusic });
