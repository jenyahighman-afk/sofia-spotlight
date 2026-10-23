// Trick Cards: a binder with one collectible card for every skill in data/skills.json (all styles). A skill she marks
// clean (her own landing) earns its card; a teacher-checked skill earns the SHINY one (a holographic shimmer). Skills not
// landed yet show as greyed cards with their name, so she can see what's next. Each card shows its style, its number in
// that style's ladder ("No. 3 of 10", straight from the order in skills.json), the Trick Quest gems it has and the date it
// was earned (skills.at for clean, skills.checkedAt for teacher-checked). Nothing extra is stored for the cards themselves:
// they are read from the `skills` collection. The one stored field is the optional photo of her doing the trick: a
// photos document carries `card: skillId` (schema 35). Pure parts up top (tested in Node); the Me card and binder below.
import { $, esc, toast, uid, expose, fmt } from "./util.js";
import { S, storeSet } from "./store.js";
import { SKILLS } from "./data.js";
import { skillState, onSkillState, findSkill, inFocus } from "./skills.js";
import { openStage } from "./stage.js";
import { media, friendlyError } from "./sync.js";
import { resizeImage } from "./media.js";

// Card colours per style (presentation only). Unknown styles fall back to coral.
export const CARD_COLORS = { solo: "#FF5C93", ballet: "#F7A8C6", jazz: "#E0A93A", contemporary: "#7FB3E6", acro: "#B98BEF", hiphop: "#5FB89A" };
// A card id is a skill id: lower-case letters, digits and dashes (same as the onclick-safe pattern).
export const CARD_ID_RE = /^[a-z0-9-]{1,40}$/;
export const normalizeCardLink = (v) => typeof v === "string" && CARD_ID_RE.test(v) ? v : null;
const TIER = { notyet: "locked", learning: "locked", clean: "card", checked: "shiny" };
const RANK = { locked: 0, card: 1, shiny: 2 };
export const tierOf = (state) => TIER[state] || "locked";

// Every card, in binder order (style by style, ladder order inside a style).
export function cardList(skills = S.skills, ladder = SKILLS){
  const out = [];
  for (const [style, st] of Object.entries(ladder.styles || {})) {
    const list = (st.skills || []).filter(sk => inFocus(st, sk) || skillState(skills, sk.id) !== "notyet"); // acro: her group's levels + anything started
    list.forEach((sk, i) => {
      const state = skillState(skills, sk.id); const r = (skills || {})[sk.id] || {}; const tier = tierOf(state);
      const gems = r.quest && Array.isArray(r.quest.gems) ? r.quest.gems.length : 0;
      const date = tier === "shiny" ? String(r.checkedAt || r.at || "") : tier === "card" ? String(r.at || "") : "";
      out.push({ id: sk.id, n: sk.n, tip: sk.tip || "", style, styleName: st.n, ic: st.ic || "✨", color: CARD_COLORS[style] || CARD_COLORS.solo, no: i + 1, of: list.length, state, tier, gems, date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "", teacher: tier === "shiny" ? String(r.teacher || "") : "" });
    });
  }
  return out;
}
export function cardCounts(cards){ const earned = cards.filter(c => c.tier !== "locked").length; return { earned, shiny: cards.filter(c => c.tier === "shiny").length, total: cards.length }; }
// Binder pages: [{ style, styleName, ic, color, cards, earned }].
export function binderGroups(cards){
  const g = []; for (const c of cards) { let p = g.find(x => x.style === c.style); if (!p) g.push(p = { style: c.style, styleName: c.styleName, ic: c.ic, color: c.color, cards: [], earned: 0 }); p.cards.push(c); if (c.tier !== "locked") p.earned++; }
  return g;
}
// skillId → the newest photo linked to that card (not deleted, not a video, has a link).
export function cardPhotos(photos = S.photos){
  const out = {};
  for (const [id, p] of Object.entries(photos || {})) {
    const k = p && normalizeCardLink(p.card); if (!k || p.deleted || p.kind === "video" || !p.url) continue;
    if (!out[k] || String(p.at || "") > String(out[k].at || "")) out[k] = { ...p, id };
  }
  return out;
}
// What a state change earns: "card" (newly landed clean), "shiny" (newly teacher-checked), else null.
export function cardMoment(prev, next){ const a = tierOf(prev), b = tierOf(next); return RANK[b] > RANK[a] ? b : null; }

// ---------- the card element ----------
export function cardHTML(c, { big = false, photo = null } = {}){
  const locked = c.tier === "locked";
  const art = locked || !photo ? `<span class="tc-ic">${locked ? "?" : c.ic}</span>` : `<img class="tc-photo" src="${esc(photo.url)}" alt="${esc(c.n)}" loading="lazy">`;
  const foot = locked ? (c.state === "learning" ? "Learning…" : "Not yet") : c.tier === "shiny" ? "★ Teacher-checked" : "◉ Landed";
  const extra = big ? `${c.gems ? `<span class="tc-gems">💎 ${c.gems}</span>` : ""}${!locked && c.date ? `<span class="tc-date">${esc(fmt(c.date))}</span>` : ""}` : (c.gems && !locked ? `<span class="tc-gems">💎${c.gems}</span>` : "");
  const inner = `<span class="tc-top"><span class="tc-no">No. ${c.no}/${c.of}</span><span class="tc-style">${esc(c.styleName)}</span></span>${art}<span class="tc-name">${esc(c.n)}</span><span class="tc-foot">${foot}</span>${extra ? `<span class="tc-extra">${extra}</span>` : ""}`;
  const cls = `tcard tc-${c.tier}${big ? " big" : ""}`;
  return big ? `<div class="${cls}" style="--c:${c.color}">${inner}</div>`
    : `<button class="${cls}" style="--c:${c.color}" onclick="cardOpen('${c.id}')" aria-label="${esc(c.n)}: ${locked ? "not earned yet" : c.tier === "shiny" ? "shiny card" : "card"}">${inner}</button>`;
}

// ---------- Me card ----------
export function renderCardsCard(){
  const el = $("#meCards"); if (!el) return; const cards = cardList(); const n = cardCounts(cards);
  el.innerHTML = `<div class="row"><h3 class="grow">🃏 My trick cards</h3><span class="chip violet">${n.earned} / ${n.total}</span></div>
    <p class="small muted">Land a trick clean and its card is yours. Teacher-checked tricks turn shiny ✨${n.shiny ? ` · ${n.shiny} shiny` : ""}</p>
    <div class="row"><button class="btn sm coral" onclick="openCards()">🃏 Open my binder</button></div>`;
  const a = $("#cardsArea"); if (a && a.style.display === "block") renderBinder(); // the binder is open: keep it live
}

// ---------- the binder (stage sheet) ----------
let view = "";
function openCards(id){ view = typeof id === "string" ? id : ""; renderBinder(); openStage("🃏 My trick cards", [$("#cardsArea")], `<button class="btn ghost" onclick="closeStage()">Done</button>`); }
export function renderBinder(){
  const el = $("#cardsArea"); if (!el) return; const cards = cardList(); const photos = cardPhotos();
  const c = view && cards.find(x => x.id === view);
  if (c) {
    const ph = photos[c.id]; const locked = c.tier === "locked";
    const line = locked ? (c.state === "learning" ? "You're learning this one. Land it clean and the card is yours!" : "Not started yet. It's waiting for you.")
      : c.tier === "shiny" ? `Teacher-checked${c.teacher ? " by " + esc(c.teacher) : ""}${c.date ? " · " + esc(fmt(c.date)) : ""}. A shiny card! ✨`
      : `You landed it clean${c.date ? " on " + esc(fmt(c.date)) : ""}. When a teacher checks it, it turns shiny.`;
    el.innerHTML = `<div class="row"><button class="btn sm ghost" onclick="cardOpen('')">← All cards</button></div>
      <div class="tc-bigwrap">${cardHTML(c, { big: true, photo: ph })}</div>
      <p class="small" style="text-align:center">${line}</p>${c.tip ? `<p class="small muted" style="text-align:center">💡 ${esc(c.tip)}</p>` : ""}
      ${locked ? "" : `<div class="row" style="justify-content:center"><label class="btn sm aqua">📷 ${ph ? "Change the photo" : "Add a photo"}<input type="file" accept="image/*" hidden onchange="cardPhoto('${c.id}', this)"></label></div><p class="small muted" style="text-align:center">A photo of you doing the trick goes on the card (and in Photos).</p>`}`;
    return;
  }
  const n = cardCounts(cards);
  el.innerHTML = `<p class="small muted">${n.earned} of ${n.total} cards collected${n.shiny ? ` · ${n.shiny} shiny ✨` : ""}. Tap a card to see it big.</p>`
    + binderGroups(cards).map(g => `<h4 class="tc-group" style="--c:${g.color}">${g.ic} ${esc(g.styleName)} <span class="small muted">${g.earned}/${g.cards.length}</span></h4><div class="tc-grid">${g.cards.map(x => cardHTML(x, { photo: photos[x.id] })).join("")}</div>`).join("");
}
function show(id){ view = id || ""; renderBinder(); const b = $("#stageBody"); if (b) b.scrollTop = 0; }
async function addPhoto(id, input){
  const f = input && input.files && input.files[0]; if (input) input.value = ""; if (!f || !findSkill(id)) return;
  try {
    toast("Adding your photo…", 6000); const { blob, w, h } = await resizeImage(f); const pid = uid();
    const { path, url } = await media.upload("photos", pid, blob, { contentType: "image/jpeg", name: f.name });
    // One photo per card: older ones keep living in Photos, they just leave the card.
    for (const [oid, p] of Object.entries(S.photos || {})) if (p && p.card === id) { const { card, ...rest } = p; await storeSet("photos", oid, rest); }
    await storeSet("photos", pid, { path, url, cap: "🃏 " + findSkill(id).n, dance: "", w, h, size: blob.size, card: id, at: new Date().toISOString() });
    toast("On the card! 📷"); renderBinder();
  } catch (e) { console.warn(e); toast("Couldn't add it: " + friendlyError(e), 3500); }
}
// "New card!": a skill that newly reaches clean or teacher-checked pops a toast.
function onState(id, prev, next){ const m = cardMoment(prev, next); if (!m) return; const s = findSkill(id); toast(m === "shiny" ? `✨ Shiny card! ${s ? s.n : ""}` : `🃏 New card! ${s ? s.n : ""}`, 2600); }
export function initCards(){
  onSkillState(onState);
  document.addEventListener("stageclosed", () => { const a = $("#cardsArea"); if (a) a.style.display = "none"; view = ""; });
}
expose({ openCards, cardOpen: show, cardPhoto: addPhoto });
