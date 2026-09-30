// Notes & photos tab: notes, "My files", photos & short videos. Also owns the media upload helpers the Dances tab reuses.
import { $, esc, toast, uid, expose } from "../util.js";
import { S, storeSet, storeDel } from "../store.js";
import { media, sync, friendlyError } from "../sync.js";
import { resizeImage, VIDEO_MAX_BYTES } from "../media.js";

const FILE_MAX_BYTES = 60 * 1024 * 1024; // matches storage.rules
export const mediaSrc = (p) => p.url || "";
export const photoTile = (p) => p.kind === "video" ? `<video src="${esc(mediaSrc(p))}" playsinline controls preload="metadata"></video>` : `<img src="${esc(mediaSrc(p))}" alt="${esc(p.cap)}" loading="lazy">`;

function renderNotes(){ const list=Object.entries(S.notes).sort((a,b)=>(b[1].at||"").localeCompare(a[1].at||""));
  $("#noteList").innerHTML=list.map(([id,n])=>`<div class="card"><div class="row"><span class="chip violet">${esc(n.tag)}</span><span class="small muted grow">${esc(n.at?n.at.slice(0,10):"")}</span><button class="del" onclick="delNote('${id}')">✕</button></div><h3>${esc(n.title)}</h3><p class="small" style="white-space:pre-wrap">${esc(n.body)}</p></div>`).join("")||`<p class="muted small">No notes yet.</p>`; }
async function addNote(){ const title=$("#noteTitle").value.trim(); const body=$("#noteBody").value.trim(); if(!title&&!body) return; await storeSet("notes",uid(),{title:title||"Note",body,tag:$("#noteTag").value,at:new Date().toISOString()}); $("#noteTitle").value="";$("#noteBody").value=""; toast("Saved"); }
async function delNote(id){ if(confirm("Delete this note?")) await storeDel("notes",id); }

function renderFiles(){ const list=Object.entries(S.files||{}).sort((a,b)=>(b[1].at||"").localeCompare(a[1].at||""));
  $("#fileList").innerHTML=list.map(([id,f])=>`<div class="check"><span class="chip sun">📄</span><a class="grow" href="${esc(mediaSrc(f))}" target="_blank" rel="noopener">${esc(f.name)}</a><button class="del" onclick="delFile('${id}')">✕</button></div>`).join("")||`<p class="muted small">No files yet.</p>`; }
async function addFiles(fileList){
  for(const f of [...fileList]){
    if(f.size>FILE_MAX_BYTES){ toast("Too big — files up to 60 MB",2500); continue; }
    try{ toast("Uploading "+f.name+"…",5000); const id=uid(); const {path,url}=await media.upload("files",id,f,{contentType:f.type||"application/octet-stream",name:f.name});
      await storeSet("files",id,{path,url,name:f.name,type:f.type||"",size:f.size,at:new Date().toISOString()}); toast("Added "+f.name); }
    catch(e){ console.warn(e); toast("Upload failed: "+friendlyError(e),3500); }
  }
}
async function delFile(id){ if(!confirm("Delete this file?")) return; const f=S.files[id]; await storeDel("files",id); if(f&&f.path){ try{ await media.remove(f.path); }catch(e){ console.warn(e); } } }

function renderPhotos(){ const list=Object.entries(S.photos).sort((a,b)=>(b[1].at||"").localeCompare(a[1].at||""));
  $("#photoGrid").innerHTML=list.map(([id,p])=>`<div class="ph">${photoTile(p)}${p.cap?`<div class="cap">${esc(p.cap)}</div>`:""}<button class="del" onclick="delPhoto('${id}')">✕</button></div>`).join("");
  $("#photoHint").textContent=sync.online?"":"Offline — new photos and videos upload once you're back online."; }
// Photos are shrunk to 1600px before upload; short videos (up to 50 MB) go up as they are.
async function addPhotos(fileList,dance){ const files=[...fileList]; const cap=dance?"":$("#photoCap").value.trim(); let added=0;
  for(const f of files){
    try{
      const id=uid();
      if(f.type.startsWith("video/")){
        if(f.size>VIDEO_MAX_BYTES){ toast("Videos up to 50 MB only",2500); continue; }
        toast("Uploading video…",8000);
        const {path,url}=await media.upload("videos",id,f,{contentType:f.type,name:f.name,onProgress:(p)=>{ if(p<1) toast("Uploading video… "+Math.round(p*100)+"%",8000); }});
        await storeSet("photos",id,{kind:"video",path,url,cap,dance:dance||"",size:f.size,at:new Date().toISOString()});
      } else {
        const {blob,w,h}=await resizeImage(f);
        const {path,url}=await media.upload("photos",id,blob,{contentType:"image/jpeg",name:f.name});
        await storeSet("photos",id,{path,url,cap,dance:dance||"",w,h,size:blob.size,at:new Date().toISOString()});
      }
      added++;
    }catch(e){ console.warn(e); toast("Upload failed: "+friendlyError(e),3500); }
  }
  if(!dance) $("#photoCap").value=""; if(added) toast("Added"); }
async function delPhoto(id){ if(!confirm("Delete this photo?")) return; const p=S.photos[id]; await storeDel("photos",id); if(p&&p.path){ try{ await media.remove(p.path); }catch(e){ console.warn(e); } } }

// A music file for one dance (audio, up to 60 MB). Replaces the previous one.
async function uploadMusic(file,danceId){
  if(file.size>FILE_MAX_BYTES) return toast("Too big — music files up to 60 MB (this one is "+Math.round(file.size/1048576)+" MB)",3500);
  if(!/^(audio|video)\//.test(file.type)&&!/\.(mp3|m4a|aac|wav|ogg|oga|flac|mp4|m4v|mov|webm)$/i.test(file.name)) return toast("That doesn't look like a music file — use an mp3, m4a or wav",3500);
  try{ toast("Uploading music…",8000); const id=uid(); const {path,url}=await media.upload("music",id,file,{contentType:file.type||"audio/mpeg",name:file.name});
    const prev=(S.dances[danceId]||{}).musicFile;
    await storeSet("dances",danceId,{...(S.dances[danceId]||{}),id:danceId,musicFile:{path,url,name:file.name,type:file.type||"",size:file.size}});
    if(prev&&prev.path){ try{ await media.remove(prev.path); }catch(e){ console.warn(e); } }
    toast("Music added"); }
  catch(e){ console.warn(e); toast("Upload failed: "+friendlyError(e),3500); }
}

export function initNotes(){
  $("#addNote").onclick=addNote;
  $("#fileIn").addEventListener("change",async(ev)=>{ const files=[...ev.target.files]; ev.target.value=""; await addFiles(files); });
  $("#photoIn").addEventListener("change",(ev)=>{ const files=[...ev.target.files]; ev.target.value=""; addPhotos(files,""); });
}
export { renderNotes, delNote, renderFiles, addFiles, delFile, renderPhotos, addPhotos, delPhoto, uploadMusic };
expose({ delNote, delFile, delPhoto, addPhotos });
