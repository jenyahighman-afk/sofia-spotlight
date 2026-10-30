// What's new: a message for Sofia when a release brings new features (data/news.json). Today shows a "🎁 New in your
// app" row until she opens it; the sheet lists each new thing with "👀 Show me how" (a few steps, one at a time) and
// "▶ Try it" (closes the sheet and opens the feature). Seen is kept per phone in localStorage (no stored family field):
// a grown-up's phone shows it once too, which is fine. Me keeps a "🎁 What's new" link to open it again.
// Pure parts up top (tested in Node); the Today row and the sheet below.
import { $, esc, expose } from "./util.js";
import { S } from "./store.js";
import { NEWS } from "./data.js";
import { openStage, closeStage } from "./stage.js";

const KEY = "spotlight:news";
// Where "▶ Try it" goes for each item: the page, then the feature's own opener when it has one.
export const TRY = {
  // 1.52.0 (Today fits one screen)
  me: { page: "me", scroll: "#petCard" },
  extras: { page: "play", scroll: "#habitCard" },
  // 1.48.0 (Build 3 from the Oct 28 review)
  sunday: { page: "home", call: "openSunday" },
  mom: { page: "grownups", scroll: "#momWeek" },
  remind: { page: "me", scroll: "#meReminder" },
  along: { page: "play", game: "along" },
  play: { page: "play" },
  // 1.47.0 (Build 2 from the Oct 28 review)
  today: { page: "home", scroll: "#todayCard" },
  checkpoints: { page: "home", scroll: "#seasonFold", open: true },
  ready: { page: "home", call: "openReady" },
  pass: { page: "me", call: "openPass" },
  // 1.43.0 (Build 1 from the Oct 28 review)
  plan: { page: "home", scroll: "#todayCard" },
  monday: { page: "home", scroll: "#todayCard" },
  tools: { page: "home", scroll: "#todayCard" },
  timer: { page: "practice" },
  games: { page: "play" },
  // 1.30 (the poll features; kept so an old link still goes somewhere)
  dares: { page: "play", scroll: "#playDare" },
  cards: { page: "me", call: "openCards" },
  costume: { page: "me", call: "openCostumes" },
  glow: { page: "me", scroll: "#meGlow" },
  teach: { page: "play", game: "teach" },
  count: { page: "play", game: "count" },
};
export const newsItems = (news = NEWS) => (news && Array.isArray(news.items) ? news.items.filter(i => i && i.id && Array.isArray(i.steps) && i.steps.length) : []);
export const seenId = () => { try { return localStorage.getItem(KEY) || ""; } catch (e) { return ""; } };
export const isNew = (news = NEWS) => !!(news && news.id && newsItems(news).length && seenId() !== news.id);
export function markSeen(news = NEWS){ try { if (news && news.id) localStorage.setItem(KEY, news.id); } catch (e) {} }
const firstName = () => String(((S.settings || {}).avatar || {}).name || "").trim() || "Sofia";
// Mom's line of the edition (data/news.json `mom`, Build 4): the grown-up items of a release in one line, shown on the
// Grown-ups hub's "This week, for Mom" card (momweek.js renderMomWeek) until she taps Got it on that phone (spotlight:momnews).
const MOM_KEY = "spotlight:momnews";
export const momNews = (news = NEWS) => news && news.id && typeof news.mom === "string" && news.mom.trim() ? { id: news.id, text: news.mom.trim() } : null;
export const momSeenId = () => { try { return localStorage.getItem(MOM_KEY) || ""; } catch (e) { return ""; } };
export const momNewsFor = (news = NEWS) => { const m = momNews(news); return m && momSeenId() !== m.id ? m : null; };
export function momNewsHtml(news = NEWS){ const m = momNewsFor(news); return m ? `<div class="mom-line mom-news"><span class="mom-ic">🎁</span><div class="grow"><div>${esc(m.text)}</div></div><button class="lnk" onclick="momNewsGotIt()">Got it</button></div>` : ""; }
function momGotIt(){ const m = momNews(); try { if (m) localStorage.setItem(MOM_KEY, m.id); } catch (e) {} if (typeof window.renderMomWeek === "function") window.renderMomWeek(); }

// ---------- Today row ----------
// The row sits on Me (1.52.0) and a dot on Me's tab says it's there until she opens it.
export function renderNews(){
  const el = $("#newsCard"); if (!el) return; const tab = document.querySelector('nav.tabs button[data-p="me"]'); if (tab && tab.classList) tab.classList.toggle("has-news", isNew());
  if (!isNew()) { el.hidden = true; el.innerHTML = ""; return; }
  el.hidden = false; const n = newsItems().length;
  el.innerHTML = `<div class="row"><span class="news-ic">🎁</span><div class="grow"><b>${esc(firstName())}, ${n} new things in your app!</b><div class="small muted">${newsItems().map(i => esc(i.e)).join(" ")}</div></div>
    <button class="btn sm coral" onclick="openNews()">See what's new</button></div>`;
}

// ---------- the sheet ----------
let howId = "", step = 0;
function openNews(){ howId = ""; step = 0; markSeen(); renderSheet(); openStage("🎁 What's new", [$("#newsArea")], `<button class="btn ghost" onclick="closeStage()">Done</button>`); renderNews(); }
export function renderSheet(){
  const el = $("#newsArea"); if (!el) return; const items = newsItems(); const it = items.find(i => i.id === howId);
  if (it) {
    const last = step >= it.steps.length - 1;
    el.innerHTML = `<div class="news-how"><div class="news-big">${esc(it.e)}</div><h3>${esc(it.n)}</h3><div class="small muted">Step ${step + 1} of ${it.steps.length} · on ${esc(it.where)}</div>
      <div class="news-dots">${it.steps.map((_, k) => `<span class="${k === step ? "on" : ""}"></span>`).join("")}</div>
      <p class="news-step">${esc(it.steps[step])}</p>
      <div class="row news-nav"><button class="btn sm ghost" onclick="newsStep(-1)">${step ? "‹ Back" : "‹ All new things"}</button><span class="grow"></span>
      ${last ? `<button class="btn sm coral" onclick="newsTry('${it.id}')">▶ Try it now</button>` : `<button class="btn sm coral" onclick="newsStep(1)">Next ›</button>`}</div></div>`;
    return;
  }
  el.innerHTML = `<p class="news-intro"><b>Hi ${esc(firstName())}! 🎉 ${esc(NEWS.title || "")}</b><br><span class="small">${esc(NEWS.intro || "")}</span></p>
    ${items.map(i => `<div class="news-item"><span class="news-e">${esc(i.e)}</span><div class="grow"><b>${esc(i.n)}</b> <span class="chip">${esc(i.where)}</span><div class="small">${esc(i.pitch || "")}</div>
      <div class="row news-btns"><button class="btn sm ghost" onclick="newsHow('${i.id}')">👀 Show me how</button><button class="btn sm coral" onclick="newsTry('${i.id}')">▶ Try it</button></div></div></div>`).join("")}`;
}
function how(id){ howId = newsItems().some(i => i.id === id) ? id : ""; step = 0; renderSheet(); }
function stepBy(d){ const it = newsItems().find(i => i.id === howId); if (!it) return; const s = step + d; if (s < 0) { howId = ""; step = 0; } else step = Math.min(s, it.steps.length - 1); renderSheet(); }
function tryIt(id){
  const t = TRY[id]; if (!t) return; closeStage(); const w = window;
  if (w.showPage) w.showPage(t.page);
  if (t.game && w.playOpen) w.playOpen(t.game);
  if (t.call && typeof w[t.call] === "function") w[t.call]();
  if (t.scroll) { const e = $(t.scroll); if (e && t.open) e.open = true; if (e && e.scrollIntoView) setTimeout(() => { try { e.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (x) {} }, 50); }
}
export function initNews(){ document.addEventListener("stageclosed", () => { const a = $("#newsArea"); if (a) a.style.display = "none"; }); }
expose({ openNews, newsHow: how, newsStep: stepBy, newsTry: tryIt, momNewsGotIt: momGotIt });
