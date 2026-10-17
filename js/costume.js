// Costume Designer: Sofia designs her dream show costume on her own avatar: leotard colour, skirt (chiffon, tutu, lyrical
// wrap, fringe or none), sleeves, rhinestone sparkle, an accent (sash, belt, bow, sequin trim) with its trim colour and a
// headpiece. Up to 6 designs are kept (settings.costumes, flat objects, schema 36); "Wear it" puts one on her avatar
// everywhere it shows (settings.costumeOn; the drawing lives in avatar.js). "Save picture" hands a PNG to the share sheet.
// Options live in data/costumes.json. Pure parts up top (tested in Node); the stage sheet and the Me card below.
import { $, esc, expose, toast, uid, saveBlob } from "./util.js";
import { S, setSettings, normalizeCostume, normalizeCostumes, COSTUMES_MAX, COSTUME_NAME_MAX } from "./store.js";
import { COSTUMES, P } from "./data.js";
import { avatarSVG, myAvatar, wornCostume, avRender } from "./avatar.js";
import { isUnlocked, UNLOCKS } from "./stars.js";
import { openStage, stageActions } from "./stage.js";

export const POSE = { el: [-36, -40], er: [36, -40], hl: [-58, -52], hr: [58, -52], kr: [26, 26], fr: [8, 36] };
export const costumeList = (settings = S.settings) => normalizeCostumes((settings || {}).costumes);
// A fresh design from the starter look, named "Costume N" after the first free number.
export function newDesign(list = costumeList(), id = "c" + uid()){
  const names = new Set(list.map(c => c.name)); let n = list.length + 1; while (names.has("Costume " + n)) n++;
  return normalizeCostume({ ...(COSTUMES.starter || {}), id, name: "Costume " + n });
}
// Add or replace a design. Returns the settings patch, or null when the list is full and this is a new one.
export function savePatch(settings, design){
  const list = costumeList(settings); const d = normalizeCostume(design, list.length); if (!d) return null;
  const i = list.findIndex(c => c.id === d.id); if (i < 0 && list.length >= COSTUMES_MAX) return null;
  const next = i < 0 ? [...list, d] : list.map(c => c.id === d.id ? d : c); return { costumes: next };
}
export function deletePatch(settings, id){ const on = (settings || {}).costumeOn || ""; return { costumes: costumeList(settings).filter(c => c.id !== id), costumeOn: on === id ? "" : on }; }
// Wear a saved design ("" or an unknown id takes the costume off).
export function wearPatch(settings, id){ return { costumeOn: costumeList(settings).some(c => c.id === id) ? id : "" }; }
// The star-unlocked leotard colours (gold, aqua, black) stay locked here too, matched by colour.
export function colorLocked(colorId, stars){ const c = (COSTUMES.colors || []).find(x => x.id === colorId); return !!c && !isUnlocked("leo", c.c, stars); }
// Her avatar (her own hair, skin, eyes) wearing one design, as a standalone <svg>.
export function costumeSVG(design, { cls = "", xmlns = false, w, h } = {}){
  const a = { ...myAvatar() }; delete a.costume;
  return `<svg ${xmlns ? 'xmlns="http://www.w3.org/2000/svg" ' : ""}viewBox="82 28 136 236"${w ? ` width="${w}" height="${h}"` : ""}${cls ? ` class="${cls}"` : ""}>${avatarSVG(P(POSE), { ...a, costume: design || null })}</svg>`;
}

// ---------- the designer sheet ----------
const D = { draft: null };
const OPT_ROWS = [["leo", "Leotard", "colors"], ["skirt", "Skirt", "skirts"], ["skirtC", "Skirt colour", "colors"], ["sleeves", "Sleeves", "sleeves"], ["sparkle", "Sparkle", "sparkles"], ["accent", "Extra", "accents"], ["trim", "Trim colour", "trims"], ["head", "Headpiece", "heads"]];
function chips(k, list){
  const d = D.draft; const isCol = list === "colors" || list === "trims"; let items = COSTUMES[list] || [];
  if (k === "skirtC") items = [{ id: "match", n: "Same as leotard" }, ...items];
  return `<div class="cos-chips ${isCol ? "swatches" : ""}">${items.map(it => { const v = list === "sparkles" ? it.v : it.id; const on = d[k] === v; const locked = (k === "leo" || k === "skirtC") && colorLocked(v);
    const u = locked ? UNLOCKS.find(x => x[0] === "leo" && x[1] === ((COSTUMES.colors || []).find(c => c.id === v) || {}).c) : null;
    return isCol && it.c ? `<button class="cos-sw ${on ? "on" : ""} ${locked ? "locked" : ""}" style="background:${it.c}" onclick="cosPick('${k}','${v}')" aria-label="${esc(it.n)}${locked ? " (locked)" : ""}" title="${esc(it.n)}${u ? ` · ${u[2]}⭐` : ""}">${locked ? "🔒" : ""}</button>`
      : `<button class="btn sm ${on ? "coral" : "ghost"}" onclick="cosPick('${k}','${v}')">${list === "sparkles" ? "✨".repeat(v) || "○" : ""} ${esc(it.n)}</button>`; }).join("")}</div>`;
}
function renderDesigner(){
  const el = $("#costumeArea"); if (!el || !D.draft) return; const d = D.draft; const list = costumeList(); const saved = list.some(c => c.id === d.id); const worn = (S.settings.costumeOn || "") === d.id;
  el.innerHTML = `<div class="cos-top"><div class="cos-preview">${costumeSVG(d)}</div>
    <div class="cos-side"><label class="f">Name</label><input type="text" id="cosName" maxlength="${COSTUME_NAME_MAX}" value="${esc(d.name)}" oninput="cosName(this.value)" aria-label="Costume name">
    <div class="small muted" style="margin-top:6px">${saved ? (worn ? "👗 You're wearing this one." : "Saved.") : "Not saved yet."} ${list.length}/${COSTUMES_MAX} designs</div>
    ${saved ? `<button class="lnk small" onclick="cosDelete('${d.id}')">🗑 Delete</button>` : ""}</div></div>
    ${list.length ? `<div class="cos-saved">${list.map(c => `<button class="cos-thumb ${c.id === d.id ? "on" : ""}" onclick="cosEdit('${c.id}')" aria-label="${esc(c.name)}">${costumeSVG(c)}</button>`).join("")}${list.length < COSTUMES_MAX ? `<button class="cos-thumb add" onclick="cosNew()" aria-label="New design">＋</button>` : ""}</div>` : ""}
    ${OPT_ROWS.map(([k, lab, src]) => `<div class="field-lab">${lab}</div>${chips(k, src)}`).join("")}`;
  stageActions(`<button class="btn coral" onclick="cosKeep()">✅ Keep design</button><button class="btn sun" onclick="cosWear()">${worn ? "🙈 Take it off" : "👗 Wear it"}</button><button class="btn ghost" onclick="cosPicture()">💾 Save picture</button>`);
}
function openCostumes(id){
  const list = costumeList(); const c = id && list.find(x => x.id === id);
  if (!c && list.length >= COSTUMES_MAX) { D.draft = { ...list[0] }; toast(`You have ${COSTUMES_MAX} designs. Change one, or delete one to make room.`, 3200); }
  else D.draft = c ? { ...c } : newDesign(list);
  openStage("👗 Costume designer", [$("#costumeArea")], ""); renderDesigner();
}
function pick(k, v){
  if (!D.draft) return; if (k === "sparkle") v = +v;
  if ((k === "leo" || k === "skirtC") && colorLocked(v)) { const c = (COSTUMES.colors || []).find(x => x.id === v); const u = UNLOCKS.find(x => x[0] === "leo" && x[1] === c.c); return toast(`🔒 ${c.n} unlocks at ${u[2]} ⭐`); }
  D.draft = { ...D.draft, [k]: v }; renderDesigner();
}
function setName(v){ if (!D.draft) return; D.draft = { ...D.draft, name: String(v || "").trim().slice(0, COSTUME_NAME_MAX) || D.draft.name }; }
async function keep(quiet){
  const p = savePatch(S.settings, D.draft); if (!p) { toast(`You can keep ${COSTUMES_MAX} designs. Delete one first.`, 3000); return false; }
  await setSettings(p); D.draft = p.costumes.find(c => c.id === D.draft.id) || D.draft; if (!quiet) toast(`✅ Kept “${D.draft.name}”`); renderDesigner(); renderCostumeCard(); return true;
}
async function wear(){
  if (!D.draft) return; const worn = (S.settings.costumeOn || "") === D.draft.id;
  if (worn) { await setSettings({ costumeOn: "" }); toast("Back to your usual leotard"); }
  else { if (!(await keep(true))) return; await setSettings(wearPatch(S.settings, D.draft.id)); toast(`👗 Wearing “${D.draft.name}”, everywhere your avatar dances!`, 2600); }
  renderDesigner(); renderCostumeCard(); try { avRender(); } catch (e) {}
}
async function del(id){
  if (typeof confirm === "function" && !confirm("Delete this design?")) return;
  await setSettings(deletePatch(S.settings, id)); const list = costumeList(); D.draft = list[0] ? { ...list[0] } : newDesign(list); renderDesigner(); renderCostumeCard();
}
function edit(id){ const c = costumeList().find(x => x.id === id); if (c) { D.draft = { ...c }; renderDesigner(); } }
function fresh(){ const list = costumeList(); if (list.length >= COSTUMES_MAX) return toast(`You have ${COSTUMES_MAX} designs. Delete one to make room.`); D.draft = newDesign(list); renderDesigner(); }

// ---------- picture: the avatar on a stage card, as a PNG ----------
const loadImg = (url) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error("Couldn't draw the picture")); im.src = url; });
export async function costumePNG(design, W = 720, H = 1080){
  const svg = costumeSVG(design, { xmlns: true, w: 520, h: 902 }); const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try { const im = await loadImg(url); const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const g = cv.getContext("2d");
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#3B1F5C"); bg.addColorStop(1, "#C04D8A"); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.fillStyle = "rgba(255,240,180,.18)"; g.beginPath(); g.moveTo(W / 2 - 60, 0); g.lineTo(W / 2 + 60, 0); g.lineTo(W / 2 + 260, 900); g.lineTo(W / 2 - 260, 900); g.closePath(); g.fill();
    g.fillStyle = "rgba(255,255,255,.15)"; g.beginPath(); g.ellipse(W / 2, 900, 220, 26, 0, 0, Math.PI * 2); g.fill();
    g.drawImage(im, (W - 520) / 2, 40, 520, 902);
    g.fillStyle = "#fff"; g.textAlign = "center"; g.font = "bold 48px Fredoka, sans-serif"; g.fillText(String(design.name || "My costume"), W / 2, H - 60);
    g.font = "bold 26px Fredoka, sans-serif"; g.fillStyle = "rgba(255,255,255,.8)"; g.fillText("designed by " + (String((S.settings.avatar || {}).name || "").trim() || "Sofia") + " ✨", W / 2, H - 22);
    return await new Promise((res, rej) => cv.toBlob(b => b ? res(b) : rej(new Error("Couldn't make the picture")), "image/png")); }
  finally { setTimeout(() => URL.revokeObjectURL(url), 2000); }
}
async function picture(){
  if (!D.draft) return; try { const b = await costumePNG(D.draft); const slug = String(D.draft.name || "costume").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "costume";
    await saveBlob(b, `sofia-costume-${slug}.png`); toast("💾 Picture ready. Look in Photos (or Files)."); } catch (e) { console.warn(e); toast("Couldn't save the picture: " + e.message, 3000); }
}

// ---------- Me card ----------
export function renderCostumeCard(){
  const el = $("#meCostumes"); if (!el) return; const list = costumeList(); const on = (wornCostume() || {}).id || "";
  el.innerHTML = `<div class="row"><h3 class="grow">👗 Costume designer</h3><span class="chip violet">${list.length}/${COSTUMES_MAX}</span></div>
    ${list.length ? `<div class="cos-saved">${list.map(c => `<button class="cos-thumb ${c.id === on ? "on" : ""}" onclick="openCostumes('${c.id}')" aria-label="${esc(c.name)}">${costumeSVG(c)}<small>${esc(c.name)}${c.id === on ? " 👗" : ""}</small></button>`).join("")}</div>`
      : `<p class="small muted">Design your dream show costume on your avatar, then wear it in every game.</p>`}
    <div class="row"><button class="btn sm coral" onclick="openCostumes()">✨ Design a costume</button>${on ? `<button class="btn sm ghost" onclick="cosTakeOff()">🙈 Usual leotard</button>` : ""}</div>`;
}
async function takeOff(){ await setSettings({ costumeOn: "" }); renderCostumeCard(); try { avRender(); } catch (e) {} toast("Back to your usual leotard"); }
export function initCostume(){ document.addEventListener("stageclosed", () => { const a = $("#costumeArea"); if (a) a.style.display = "none"; D.draft = null; }); }
expose({ openCostumes, cosPick: pick, cosName: setName, cosKeep: () => keep(false), cosWear: wear, cosDelete: del, cosEdit: edit, cosNew: fresh, cosPicture: picture, cosTakeOff: takeOff });
