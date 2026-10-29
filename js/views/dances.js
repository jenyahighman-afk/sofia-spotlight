// Dances tab: one "cover" card per dance — art, song, ▶ Practice, the top three fixes as chips (tap = Show me), a quick
// "＋ Note from class", and everything text-heavy under "More ▸" (collapsed). Edit mode lives inside More.
import { $, esc, growAll, toast, uid, expose, roText, roList, edText, edList, todayStr } from "../util.js";
import { S, storeSet, dances, events } from "../store.js";
import { media, friendlyError } from "../sync.js";
import { photoTile, uploadMusic } from "./notes.js";
import { TAGS, TAG_LABEL, TAG_EMOJI, topFixes, forDance, patterns, addCorrection, closeCorrection, reopenCorrection, removeCorrection, inferTag } from "../corrections.js";
import { checkBadges } from "../badges.js";
import { normalizeCues, parseCueText, formatCueText, fmtTime, fmtCueTime, isCueTable, lyricLines, lyricTimesFor } from "../cues.js";
import { videosRow, videosEdit } from "../cuecards.js";
import { memoDances, memoCard, bindMemo } from "../memo.js";

const STYLE_EMOJI = { lyrical:"🌸", jazz:"⚡", contemporary:"🌊", "hip hop":"🎧", hiphop:"🎧", ballet:"🩰", acro:"🤸", ballroom:"💃", tap:"👟" };
export const danceEmoji = (d) => STYLE_EMOJI[String(d.style || "").toLowerCase().trim()] || "🎵";
const musicButton=(d)=>`<label class="btn sm ghost" for="dmusic-${d.id}">🎵 ${d.musicFile&&d.musicFile.url?"Replace music file":"Add music file"}</label><input type="file" id="dmusic-${d.id}" hidden onchange="addMusic(this.files[0],'${d.id}');this.value=''">`;
const musicPlayer=(d)=>d.musicFile&&d.musicFile.url?`<div class="field-lab">Music file · ${esc(d.musicFile.name||"")}</div><audio controls preload="none" src="${esc(d.musicFile.url)}" style="width:100%;margin-top:4px"></audio>`:"";
async function addMusic(file,danceId){ if(!file) return; await uploadMusic(file,danceId); }
export function danceEdit(id){ editDance=id; if(id) moreOpen.add(id); renderDances(); }
export function initDances(){
  document.addEventListener("memochanged",()=>renderDances());
  $("#addDance").onclick=async()=>{ const n=$("#newDanceName").value.trim(); if(!n) return; const id="d"+uid(); await storeSet("dances",id,{id,name:n,song:"",style:"",choreo:"",costume:"",shoes:"",hair:"",color:"coral",music:"",map:"",strengths:[],corrections:[],notes:"",links:[],teacher:"",rehearsal:"",musicUrl:"",bpm:""}); $("#newDanceName").value=""; editDance=id; moreOpen.add(id); };
}
let editDance=null, noteFor=null, noteTag="other"; const moreOpen=new Set();
function coverArt(d){ const ph=Object.values(S.photos).filter(p=>p.dance===d.id&&p.kind!=="video").sort((a,b)=>(b.at||"").localeCompare(a.at||""))[0]; return ph&&ph.url?`<img src="${esc(ph.url)}" alt="" loading="lazy">`:`<span>${danceEmoji(d)}</span>`; }
function chips(d){
  const top=topFixes(S.corrections,d.id); if(!top.length) return `<div class="small muted">No fixes yet. Add a note from class.</div>`;
  return `<div class="fixchips">${top.map(c=>`<button class="fixchip ${c.pinned?"pin":""}" onclick="showMe('${c.id}')">${c.pinned?"📌 ":""}${TAG_EMOJI[c.tag]||"✨"} ${esc(c.text)}${c.pinned?` <span class="small muted">· ${esc(c.source||"")}</span>`:""}</button>`).join("")}</div>`;
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
// A dance with a verified cue table (the solo): cue cards, memorize mode, Hannah's videos, the how-to.
const tableTools=(d)=>`<div class="row table-tools"><button class="btn sm violet" onclick="openCueCards('${d.id}')">🃏 Cue cards</button><button class="btn sm violet" onclick="openMemorize('${d.id}','chunks')">🧩 Chunks</button><button class="btn sm violet" onclick="openMemorize('${d.id}','predict')">⏸ Pause &amp; Predict</button><button class="btn sm ghost" onclick="openHowto()">📖 How to practice</button></div>${videosRow(d)}`;
const cueSheetRo=(d)=>{ const list=normalizeCues(d.cues); if(!list.length) return `<div class="ro"></div>`; const tbl=isCueTable(d.cues); return `<div class="ro">${tbl&&d.cueSource?`<div class="small muted">Times: ${esc(d.cueSource)}${d.cueCheckedAt?" · nudged in Cue check "+esc(d.cueCheckedAt):""}</div>`:""}<ul>${list.map(c=>`<li${c.trick?' class="trick"':""}><b>${tbl?fmtCueTime(c.t)+"–"+fmtCueTime(c.end):fmtTime(c.t)}</b> ${c.trick?"★ ":""}${esc(c.move)}${c.lyric?` <span class="muted">“${esc(c.lyric)}”</span>`:""}</li>`).join("")}</ul></div>`; };
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
    const cover=`<div class="cover-top"><div class="cover-art ${d.color||""}">${coverArt(d)}</div><div class="grow"><h3>${esc(d.name)}</h3><div class="small muted">${esc(d.song||"song TBD")}</div>${d.story?`<div class="story">🎭 ${esc(d.story)}</div>`:""}</div></div>
      <div class="row cover-actions"><button class="btn coral grow" onclick="openPlayer('${d.id}')">▶ Practice</button><button class="btn ghost" onclick="noteOpen('${d.id}')">＋ Note</button><button class="btn ghost coach-btn" onclick="openCoach('${d.id}')" title="Coach me">🎬</button></div>${isCueTable(d.cues)?tableTools(d):videosRow(d)}${memoDances([d]).length?memoCard(d):""}
      ${noteFor===d.id?noteForm(d):""}${chips(d)}${patternLine(d)}`;
    const mapbar=d.id==="solo"?`<div class="mapbar" style="margin:8px 0"><div class="soft">soft 0:00–0:48</div><div class="loud">full 0:48–1:52</div><div class="fade">fade</div></div>`:"";
    const photos=`<div class="field-lab">Photos for this dance</div><div class="photos" style="margin-top:6px">${Object.entries(S.photos).filter(([,p])=>p.dance===d.id).map(([pid,p])=>`<div class="ph">${photoTile(p)}${p.cap?`<div class="cap">${esc(p.cap)}</div>`:""}<button class="del" onclick="delPhoto('${pid}')">✕</button></div>`).join("")}</div>
      <div class="row" style="margin-top:6px"><label class="btn sm ghost" for="dphoto-${d.id}">+ Add photo</label><input type="file" id="dphoto-${d.id}" accept="image/*" multiple hidden onchange="addPhotos(this.files,'${d.id}');this.value=''"></div>`;
    let more;
    if(!editing){
      const links=(d.links||[]).filter(Boolean);
      more=`${mapbar}<div class="row" style="margin-top:6px">${d.musicUrl?`<a class="btn sm aqua" href="${esc(d.musicUrl)}" target="_blank" rel="noopener">▶ Music link</a>`:""}${links.map((u,i)=>{ const m=String(u).match(/^(.*?)\s*\|\s*(https?:\S+)$/); const url=m?m[2]:u, label=m?m[1].trim():"Link "+(i+1); return `<a class="btn sm" href="${esc(url)}" target="_blank" rel="noopener">🔗 ${esc(label)}</a>`; }).join("")}${musicButton(d)}<span class="grow"></span><button class="btn sm coral" onclick="danceEdit('${d.id}')">✏️ Edit</button></div>${musicPlayer(d)}
        ${roText("Song",d.song)}${roText("Style",d.style)}${roText("BPM",d.bpm)}${roText("Choreographer",d.choreo)}${roText("Teacher / class",d.teacher)}${roText("Rehearsal & class schedule",d.rehearsal)}
        ${roText("Costume",d.costume)}${roText("Shoes",d.shoes)}${roText("Hair",d.hair)}
        ${roText("Music map",d.music)}${roText("Where the big moments land",d.map)}<div class="field-lab">Cue sheet (shown in the player)</div>${cueSheetRo(d)}
        ${roText("The story (for Sofia)",d.story)}${roList("Step order (from the walkthrough)",d.steps)}${roList("Performance notes",d.performance)}${roList("What's already strong",d.strengths)}<div class="field-lab">All corrections</div>${fullList(d)}${roList("Trick drills",d.tricks)}${roList("Where do I look?",d.eyes)}
        ${roText("Notes",d.notes)}${wordsLine(d)}${d.id==="solo"||d.id==="trio"?judgesHtml(d):""}${d.id==="solo"||d.id==="trio"?videosEdit(d):""}${d.id==="solo"?`<div class="row" style="margin-top:8px"><button class="btn sm ghost" onclick="openRehearsal('solo')">📅 Book a solo private</button><span class="small muted">Booked with Ms. Brittany? That day's home plan becomes the 15-minute memory run.</span></div>`:""}${photos}`;
    } else {
      more=`<p class="small muted">Editing. Nothing is saved until you tap Save.</p>
      ${edText("song","Song",d.song,"Title — artist")}${edText("style","Style",d.style)}${edText("bpm","BPM (beats per minute, for the count overlay)",d.bpm,"e.g. 76")}${edText("choreo","Choreographer",d.choreo)}${edText("teacher","Teacher / class",d.teacher)}${edText("rehearsal","Rehearsal & class schedule",d.rehearsal)}
      ${edText("musicUrl","Music link",d.musicUrl,"Paste a link to the track")}${edList("links","Video, Google Photos and other links (one per line: Name | https://…). Video and Google Photos links also show in Memorize it",d.links)}
      ${edText("costume","Costume",d.costume)}${edText("shoes","Shoes",d.shoes)}${edText("hair","Hair",d.hair)}
      ${edText("music","Music map",d.music)}${edText("map","Where the big moments land (m:ss timestamps become loop presets)",d.map)}${isCueTable(d.cues)?`<div class="field-lab">Cue sheet</div><p class="small muted">The checked cue table (${esc(d.cueSource||"")}). Nudge a time in Grown-ups → 🎯 Cue check.</p>`:`<label class="f">Cue sheet <span class="muted">(one per line: m:ss | words sung | move)</span></label><textarea data-k="cues" data-cues="1" class="dfield" placeholder="0:50 | words here | Cartwheel on the swell">${esc(formatCueText(d.cues))}</textarea>`}
      ${edText("story","The story (one or two lines, shown to Sofia on the card)",d.story)}${edList("steps","Step order (one step per line)",d.steps)}${edList("performance","Performance notes (face, musicality, presence)",d.performance)}${edList("strengths","What's already strong",d.strengths)}${edList("corrections","Corrections (older list — new lines become notes)",d.corrections)}${edList("tricks","Trick drills",d.tricks)}${edList("eyes","Where do I look?",d.eyes)}
      ${edText("notes","Notes",d.notes)}
      ${edText("lyrics","Song words — one sung line per line (they stay in the family space; the player shows them karaoke-style)",d.lyrics)}<div class="row" style="margin-top:4px"><button class="btn sm ghost" onclick="lyricsFromNotes('${d.id}')">⬇ Copy the words from Notes</button><span class="small muted">Then in the player: ⏱ Time the words.</span></div>
      <div class="row" style="margin-top:10px"><button class="btn coral" onclick="saveDance('${d.id}')">Save</button><button class="btn ghost" onclick="danceEdit(null)">Cancel</button><span class="grow"></span><button class="btn sm ghost" onclick="delDance('${d.id}')">Remove dance</button></div>`;
    }
    return `<div class="card cover ${d.color||""}" data-id="${d.id}">${cover}<details class="more" ${open?"open":""} data-more="${d.id}"><summary>More ▸</summary>${more}</details></div>`;
  }).join("");
  bindMemo($("#danceList"));
  $("#danceList").querySelectorAll("details.more").forEach(el=>el.addEventListener("toggle",()=>{ el.open?moreOpen.add(el.dataset.more):moreOpen.delete(el.dataset.more); }));
  growAll($("#danceList"));
}
function collectDance(id){ const card=document.querySelector(`.card[data-id="${id}"]`); const d={...dances().find(x=>x.id===id)}; card.querySelectorAll(".dfield").forEach(el=>{ d[el.dataset.k]=el.dataset.cues?parseCueText(el.value):el.dataset.list?el.value.split("\n").map(x=>x.trim()).filter(Boolean):el.value; }); if(d.bpm!==""&&d.bpm!==undefined){ const n=parseFloat(d.bpm); d.bpm=Number.isFinite(n)&&n>0?n:""; }
  // Data-owned fields stay out of the stored copy, so later data updates (Hannah's words, a new pin) still show through:
  // the pinned teacher notes, and a cue table the family hasn't overridden (nudges live in cueTimes).
  delete d.pinned; delete d.lyricSnaps; delete d.lyricKeys; if(isCueTable(d.cues)&&!(S.dances[id]&&S.dances[id].cues)) delete d.cues; return d; }
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

// Song words (1.44.0): how many sung lines are typed and timed; the words themselves show in the player, not on the card.
const wordsLine=(d)=>{ const n=lyricLines(d.lyrics).length; if(!n) return ""; const t=lyricTimesFor(d.lyrics,d.lyricTimes,d.lyricKeys).filter(x=>x!==null).length; return `<div class="small muted" style="margin-top:6px">🎤 ${n} sung lines · ${t===n?"all timed ⭐":t+" timed — ⏱ Time the words in the player"}</div>`; };
// The family typed the words into Notes first: copy them into the Song words box (trim the rest, then Save).
function lyricsFromNotes(id){ const card=document.querySelector(`.card[data-id="${id}"]`); const n=card&&card.querySelector('.dfield[data-k="notes"]'), l=card&&card.querySelector('.dfield[data-k="lyrics"]'); if(!n||!l) return; if(!n.value.trim()) return toast("Notes are empty"); if(l.value.trim()&&!confirm("Replace the song words with the Notes text?")) return; l.value=n.value; growAll(card); l.focus(); toast("Copied — keep just the song's lines, then Save",3500); }
// Judges' audio (1.46.0): the critiques a comp sends after the weekend, kept in the family space (music kind) on the solo
// and trio cards and played right there; the daily plan's 🎧 item jumps here (judgesOpen). A grown-up adds the files.
const JUDGES_MAX_BYTES=60*1024*1024, JUDGES_MAX=10;
const judgesHtml=(d)=>{ const clips=Array.isArray(d.judgesClips)?d.judgesClips:[]; return `<div class="judges" id="judges-${d.id}"><div class="field-lab">🎧 Judges' audio${clips.length?` · ${clips.length}`:""}</div>${clips.length?clips.map((c,i)=>`<div class="judge-clip"><div class="row"><span class="small grow">${esc(c.comp||"")}${c.comp&&c.at?" · ":""}${esc(c.at||"")}${c.name?` · <span class="muted">${esc(c.name)}</span>`:""}</span><button class="btn sm ghost" onclick="delJudgesClip('${d.id}',${i})">✕</button></div><audio controls preload="none" src="${esc(c.url)}" style="width:100%"></audio></div>`).join(""):`<div class="small muted">After a comp, add each judge's recording here; then listen with Sofia and write the fixes as a note.</div>`}<div class="row" style="margin-top:4px"><label class="btn sm ghost" for="djudge-${d.id}">＋ Add judges' audio</label><input type="file" id="djudge-${d.id}" accept="audio/*,.m4a,.mp3,.wav,.aac" multiple hidden onchange="addJudgesClip(this.files,'${d.id}');this.value=''"></div></div>`; };
// The comp a recording belongs to: the latest competition or showcase that has started (events.json type), by name.
function lastComp(){ const today=todayStr(); const past=events().filter(e=>/compet|showcase/i.test(e.type||"")&&!/convention only/i.test(e.type||"")&&e.start<=today).sort((a,b)=>b.start.localeCompare(a.start)); return past[0]?String(past[0].name).slice(0,60):""; }
async function addJudgesClip(files,danceId){ const list=[...(files||[])]; if(!list.length) return; const comp=lastComp(); const d=dances().find(x=>x.id===danceId); const cur=Array.isArray(d&&d.judgesClips)?[...d.judgesClips]:[];
  for(const file of list){ if(file.size>JUDGES_MAX_BYTES){ toast("Too big — audio up to 60 MB",3000); continue; } if(!/^(audio|video)\//.test(file.type)&&!/\.(mp3|m4a|aac|wav|ogg|oga|flac|mp4|webm)$/i.test(file.name)){ toast("That doesn't look like an audio file",3000); continue; }
    try{ toast("Uploading…",8000); const id="judges-"+uid(); const {path,url}=await media.upload("music",id,file,{contentType:file.type||"audio/mpeg",name:file.name}); cur.push({path,url,name:String(file.name).slice(0,60),at:todayStr(),comp}); }
    catch(e){ console.warn(e); toast("Upload failed: "+friendlyError(e),3500); } }
  await storeSet("dances",danceId,{...(S.dances[danceId]||{}),id:danceId,judgesClips:cur.slice(-JUDGES_MAX)}); moreOpen.add(danceId); renderDances(); toast("Saved to the family space ✓"); }
async function delJudgesClip(danceId,i){ const d=dances().find(x=>x.id===danceId); const clips=Array.isArray(d&&d.judgesClips)?[...d.judgesClips]:[]; const c=clips[i]; if(!c||!confirm("Remove this recording?")) return; clips.splice(i,1); await storeSet("dances",danceId,{...(S.dances[danceId]||{}),id:danceId,judgesClips:clips}); try{ if(c.path) await media.remove(c.path); }catch(e){ console.warn(e); } renderDances(); }
function judgesOpen(id){ moreOpen.add(id); renderDances(); setTimeout(()=>{ const el=$("#judges-"+id); if(el) el.scrollIntoView({behavior:"smooth",block:"center"}); },60); }
expose({ lyricsFromNotes, addJudgesClip, delJudgesClip, judgesOpen });
