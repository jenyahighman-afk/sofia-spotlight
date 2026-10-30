// 🎬 Film it: the research rule for weeks 1–9 is "film one chunk, watch it when you want, try it again", and the plan's
// item had no camera (the Oct 28 review's "no Film button on the film-one-chunk item"). This sheet opens the phone's
// camera (a file input with capture, behind a label so iPhone Safari allows it), plays the clip straight back, and offers
// 🎥 Film again and 💾 Keep it (the share sheet → Save Video). The clip stays on this phone: nothing is uploaded or stored
// in the family space, and closing the sheet lets it go. A .modal, so it opens over practice mode. Pure parts up top.
import { $, esc, toast, saveBlob, todayStr, expose } from "./util.js";

// The file name a kept clip gets: "solo-chunk-2026-11-05-2.mov" (the extension from the clip's own type or name).
export function clipFileName(file, date, n = 1){
  const t = String((file && file.type) || ""), nm = String((file && file.name) || "");
  const ext = /quicktime/i.test(t) ? "mov" : /webm/i.test(t) ? "webm" : /mp4/i.test(t) ? "mp4" : (/\.([a-z0-9]{2,4})$/i.exec(nm) || [])[1] || "mp4";
  return `solo-chunk-${date}-${Math.max(1, n | 0)}.${ext.toLowerCase()}`;
}
export const isVideoFile = (file) => !!file && (/^video\//.test(String(file.type || "")) || /\.(mov|mp4|m4v|webm)$/i.test(String(file.name || "")));

// ---- DOM ----
const F = { file: null, url: "", n: 0 };
function drop(){ if (F.url) { try { URL.revokeObjectURL(F.url); } catch (e) {} } F.url = ""; F.file = null; }
function render(){
  const el = $("#filmBody"); if (!el) return; const cam = `<label class="btn coral big-btn film-cam" for="filmIn">${F.file ? "🎥 Film again" : "🎥 Film a chunk"}</label>`;
  el.innerHTML = F.file
    ? `<video id="filmVideo" src="${esc(F.url)}" playsinline controls autoplay></video><div class="small muted">Clip ${F.n} · watch it, pick ONE thing to try, then film it again.</div><div class="row film-btns">${cam}<button class="btn ghost" onclick="filmKeep()">💾 Keep it</button></div>`
    : `<p>Prop the phone up so all of you is in the picture. Film one chunk: 8 to 16 counts, with the music.</p>${cam}<p class="small muted">The clip stays on this phone. Nothing is uploaded. Watch it right here, then film it again.</p>`;
}
export function openFilm(){ drop(); F.n = 0; render(); $("#film").hidden = false; document.body.classList.add("modal"); }
export function closeFilm(){ const v = $("#filmVideo"); if (v) { try { v.pause(); } catch (e) {} } drop(); $("#film").hidden = true; if ($("#pmode").hidden) document.body.classList.remove("modal"); }
function picked(file){ if (!file) return; if (!isVideoFile(file)) return toast("That isn't a video. Tap 🎥 and film one."); drop(); F.file = file; F.url = URL.createObjectURL(file); F.n++; render(); }
async function keep(){ if (!F.file) return; try { await saveBlob(F.file, clipFileName(F.file, todayStr(), F.n)); } catch (e) { console.warn(e); toast("Couldn't save it here"); } }
export function initFilm(){ const i = $("#filmIn"); if (i) i.onchange = () => { const f = i.files && i.files[0]; i.value = ""; picked(f); }; const c = $("#filmClose"); if (c) c.onclick = closeFilm; }
expose({ openFilm, closeFilm, filmKeep: keep });
