// Seasonal themes (1.50.0): Halloween, fall and Thanksgiving, Christmas, New Year's, winter, Valentine's Day, International
// Women's Day, April Fools, summer, the 4th of July and Sofia's birthday week, switched on by date. A theme dresses the
// header (its gradient, the sticker's emoji, a row of motifs), says hello on the day itself, sends a short emoji shower
// the first time the app opens that day, and points the home-screen icon link at its own button (icons/season/, made
// by tools/season-icons.cjs). Her colours stay hers: cards, buttons and text keep her palette (Sofia likes her pink).
// settings.seasons = "off" turns them off; settings.birthday = "MM-DD" (the family space, never the repo) makes the
// birthday week; a peek (this phone, today only) tries any theme. Pure parts up top, tested in Node; the DOM below.
import { $, esc, todayStr, expose, toast } from "./util.js";
import { S, setSettings } from "./store.js";

export const THEMES = {
  halloween:  { n: "Halloween", e: "🎃", motif: "🦇 ✦ 🎃 ✦ 👻", shower: ["🦇", "🎃", "👻", "🍬", "🕸️"], hero: "linear-gradient(135deg,#2E1B45 0%,#7A2E6E 48%,#FF5C93 100%)", ring: "#FF8A3D", line: "solo 🎃 trio 🎃 team PITCH", hello: "Happy Halloween, Sofia! 🎃" },
  fall:       { n: "Fall leaves", e: "🍂", motif: "🍁 ✦ 🍂 ✦ 🍁", shower: ["🍂", "🍁", "🍂", "🌰"], hero: "linear-gradient(135deg,#F4A261 0%,#FF7FAE 60%,#E9A1C9 100%)", ring: "#E86A33", line: "solo 🍂 trio 🍂 team PITCH", hello: "Happy Thanksgiving, Sofia! 🦃" },
  christmas:  { n: "Christmas", e: "🎄", motif: "❄ ✦ 🎄 ✦ ❄", shower: ["❄️", "⭐", "🎄", "🎁", "❄️"], hero: "linear-gradient(135deg,#2F8F5B 0%,#E63946 52%,#FF8FB8 100%)", ring: "#2F8F5B", line: "solo 🎄 trio 🎄 team PITCH", hello: "Merry Christmas, Sofia! 🎄" },
  newyear:    { n: "New Year's", e: "🎆", motif: "✨ ✦ 🎆 ✦ ✨", shower: ["🎉", "✨", "🎆", "🥳", "✨"], hero: "linear-gradient(135deg,#1E1B4B 0%,#7A3E8E 50%,#FF5C93 100%)", ring: "#F4C86A", line: "solo ✨ trio ✨ team PITCH", hello: "Happy New Year, Sofia! 🎆" },
  winter:     { n: "Winter", e: "❄️", motif: "❄ ✦ ❄ ✦ ❄", shower: ["❄️", "❄️", "⛄", "❄️"], hero: "linear-gradient(135deg,#9AD2F5 0%,#FF9EC4 60%,#D9B3FF 100%)", ring: "#7FB8E6", line: "solo ❄ trio ❄ team PITCH", hello: "" },
  valentines: { n: "Valentine's", e: "💖", motif: "♥ ✦ 💖 ✦ ♥", shower: ["💖", "💕", "💗", "🌹", "💌"], hero: "linear-gradient(135deg,#FF3D6E 0%,#FF7FAE 55%,#FFC2D6 100%)", ring: "#FF3D6E", line: "solo ♥ trio ♥ team PITCH", hello: "Happy Valentine's Day, Sofia! 💖" },
  womensday:  { n: "Women's Day", e: "🌷", motif: "🌷 ✦ 🌼 ✦ 🌷", shower: ["🌷", "🌼", "💐", "🌷"], hero: "linear-gradient(135deg,#8B5CF6 0%,#FF7FAE 58%,#F7C934 100%)", ring: "#9B7BEA", line: "solo 🌷 trio 🌷 team PITCH", hello: "Happy Women's Day, Sofia! 🌷" },
  aprilfools: { n: "April Fools", e: "🙃", motif: "🙃 ✦ 🤪 ✦ 🙃", shower: ["🙃", "🤪", "🎈", "😜"], hero: "linear-gradient(315deg,#FFC2D6 0%,#FF7FAE 55%,#7FD3FF 100%)", ring: "#7FD3FF", line: "PITCH team ✿ trio ✿ solo", hello: "April Fools! Tap the title to fix it 🙃" },
  summer:     { n: "Summer", e: "☀️", motif: "☀ ✦ 🌊 ✦ ☀", shower: ["☀️", "🌸", "🍉", "🌊"], hero: "linear-gradient(135deg,#FFC94D 0%,#FF7FAE 55%,#7FD3FF 100%)", ring: "#FFC94D", line: "solo ☀ trio ☀ team PITCH", hello: "" },
  july4:      { n: "4th of July", e: "🎆", motif: "★ ✦ 🎆 ✦ ★", shower: ["🎆", "⭐", "🎇", "✨"], hero: "linear-gradient(135deg,#2F5BD3 0%,#FF7FAE 55%,#E63946 100%)", ring: "#2F5BD3", line: "solo ★ trio ★ team PITCH", hello: "Happy 4th of July, Sofia! 🎆" },
  birthday:   { n: "Birthday week", e: "🎂", motif: "🎈 ✦ 🎂 ✦ 🎈", shower: ["🎈", "🎉", "🎂", "🎁", "✨"], hero: "linear-gradient(135deg,#7FD3FF 0%,#FF7FAE 50%,#F4C86A 100%)", ring: "#FF5C93", line: "🎂 it's birthday week! 🎂", hello: "Happy birthday, Sofia! 🎂" },
};
// The order a date is checked in: a short or personal theme wins over a long season it falls inside.
export const PRIORITY = ["birthday", "aprilfools", "july4", "womensday", "valentines", "newyear", "christmas", "halloween", "fall", "winter", "summer"];

const pad = (n) => String(n).padStart(2, "0");
const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const shift = (s, n) => { const d = new Date(s + "T00:00:00"); d.setDate(d.getDate() + n); return iso(d.getFullYear(), d.getMonth() + 1, d.getDate()); };
// Thanksgiving: the fourth Thursday of November.
export function thanksgiving(y){ const dow = new Date(`${y}-11-01T00:00:00`).getDay(); return iso(y, 11, 1 + ((4 - dow + 7) % 7) + 21); }
export const validBirthday = (b) => typeof b === "string" && /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(b) ? b : "";

// Each theme's windows in year y, as [from, to] inclusive "YYYY-MM-DD". Halloween runs all of October (she loves it);
// fall runs to the Sunday after Thanksgiving; New Year's crosses into January; the birthday week is the day ±3.
export function windows(y, birthday = ""){
  const w = {
    halloween: [[iso(y, 10, 1), iso(y, 10, 31)]],
    fall: [[iso(y, 11, 1), shift(thanksgiving(y), 3)]],
    christmas: [[iso(y, 12, 1), iso(y, 12, 26)]],
    newyear: [[iso(y, 12, 27), iso(y + 1, 1, 2)], [iso(y - 1, 12, 27), iso(y, 1, 2)]],
    winter: [[iso(y, 1, 3), iso(y, 3, 6)]],
    valentines: [[iso(y, 2, 7), iso(y, 2, 14)]],
    womensday: [[iso(y, 3, 7), iso(y, 3, 9)]],
    aprilfools: [[iso(y, 4, 1), iso(y, 4, 1)]],
    summer: [[iso(y, 6, 15), iso(y, 8, 31)]],
    july4: [[iso(y, 7, 1), iso(y, 7, 5)]],
    birthday: [],
  };
  const b = validBirthday(birthday);
  if (b) for (const yy of [y - 1, y, y + 1]) { const day = `${yy}-${b}`; if (!Number.isNaN(Date.parse(day + "T00:00:00"))) w.birthday.push([shift(day, -3), shift(day, 3)]); }
  return w;
}
// The theme for a date, or "" (the everyday look). Pure.
export function seasonFor(date, { birthday = "" } = {}){
  const w = windows(+date.slice(0, 4), birthday);
  for (const id of PRIORITY) if (w[id].some(([a, b]) => date >= a && date <= b)) return id;
  return "";
}
// The hello line on the day itself (the hero's sub line), else "".
export function helloFor(date, id, { birthday = "" } = {}){
  const t = THEMES[id]; if (!t || !t.hello) return "";
  const md = date.slice(5); const y = +date.slice(0, 4);
  const days = { halloween: ["10-31"], fall: [thanksgiving(y).slice(5)], christmas: ["12-24", "12-25"], newyear: ["12-31", "01-01"], valentines: ["02-14"], womensday: ["03-08"], aprilfools: ["04-01"], july4: ["07-04"], birthday: [validBirthday(birthday)] }[id] || [];
  return days.includes(md) ? t.hello : "";
}
// The next theme after this one, with the day it starts (for the Me card). Pure; looks a year ahead.
export function nextSeason(date, opts = {}){
  const cur = seasonFor(date, opts);
  for (let i = 1, d = shift(date, 1); i <= 400; i++, d = shift(d, 1)) { const s = seasonFor(d, opts); if (s && s !== cur) return { id: s, from: d }; }
  return null;
}
// Which theme shows: a peek for today wins, then the schedule unless turned off.
export function pickSeason(date, { settings = {}, peek = null } = {}){
  if (peek && peek.date === date && (peek.id === "" || THEMES[peek.id])) return peek.id;
  if (settings.seasons === "off") return "";
  return seasonFor(date, { birthday: settings.birthday });
}
export const iconFor = (id) => `icons/season/${THEMES[id] ? id : "default"}-180.png`;
// The fliers a theme adds over every screen (Halloween: three bats and a little witch on her broom; Fall: four leaves
// drifting down and a turkey strolling along the bottom), or "".
const DECO = {
  halloween: '<span class="hw-bat b1"></span><span class="hw-bat b2"></span><span class="hw-bat b3"></span><span class="hw-witch"></span>',
  fall: '<span class="fl-leaf l1"></span><span class="fl-leaf l2"></span><span class="fl-leaf l3"></span><span class="fl-leaf l4"></span><span class="fl-turkey"></span>',
};
export function decoHtml(id){ return DECO[id] || ""; }

// ---- DOM ----
const PEEK = "spotlight:seasonpeek", SHOWER = "spotlight:seasonshower";
const lsGet = (k) => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const short = (s) => new Date(s + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
export const seasonNow = (date = todayStr()) => pickSeason(date, { settings: S.settings || {}, peek: lsGet(PEEK) });

export function applySeason(date = todayStr()){
  const h = document.documentElement; if (!h || !h.setAttribute) return;
  const id = seasonNow(date); const t = THEMES[id];
  if (t) { h.setAttribute("data-season", id); h.style.setProperty("--season-hero", t.hero); h.style.setProperty("--season-e", `"${t.e}"`); h.style.setProperty("--season-motif", `"${t.motif}"`); h.style.setProperty("--season-ring", t.ring); }
  else { h.removeAttribute("data-season"); for (const v of ["--season-hero", "--season-e", "--season-motif", "--season-ring"]) h.style.removeProperty(v); }
  const line = $("#heroLine"); if (line) { if (!line.dataset.base) line.dataset.base = line.textContent; line.textContent = t ? (helloFor(date, id, { birthday: (S.settings || {}).birthday }) || t.line) : line.dataset.base; }
  const touch = document.querySelector('link[rel="apple-touch-icon"]'); if (touch) touch.setAttribute("href", iconFor(id));
  const fav = document.querySelector('link[rel="icon"]'); if (fav) fav.setAttribute("href", `icons/season/${t ? id : "default"}.svg`);
  const hero = document.querySelector("header.hero"); if (hero) { hero.classList.remove("fixed"); if (id === "aprilfools" && !hero.dataset.fools) { hero.dataset.fools = "1"; hero.addEventListener("click", (e) => { if (e.target.closest && e.target.closest("button")) return; if (document.documentElement.getAttribute("data-season") !== "aprilfools" || hero.classList.contains("fixed")) return; hero.classList.add("fixed"); toast("April Fools! 🙃"); }); } }
  ensureDeco(id);
  if (t) showerOnce(id, date);
}
function ensureDeco(id){ let el = document.getElementById("seasonDeco"); const html = decoHtml(id); if (!html) { if (el) el.remove(); return; } if (!el) { el = document.createElement("div"); el.id = "seasonDeco"; el.className = "season-deco"; el.setAttribute("aria-hidden", "true"); document.body.appendChild(el); } if (el.dataset.id !== id) { el.dataset.id = id; el.innerHTML = html; } }
// A short emoji shower the first time the app opens on a theme day (this phone), and on a peek. Never with reduced motion.
function showerOnce(id, date, force = false){
  const key = `${date}:${id}`; if (!force && lsGet(SHOWER) === key) return; lsSet(SHOWER, key);
  try { if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return; } catch (e) {}
  const t = THEMES[id]; if (!t || !document.body) return;
  const box = document.createElement("div"); box.className = "season-shower"; box.setAttribute("aria-hidden", "true");
  for (let i = 0; i < 18; i++) { const s = document.createElement("span"); s.textContent = t.shower[i % t.shower.length]; s.style.left = (Math.random() * 94) + "%"; s.style.animationDuration = (3.5 + Math.random() * 2.5).toFixed(2) + "s"; s.style.animationDelay = (Math.random() * 1.6).toFixed(2) + "s"; s.style.setProperty("--r", (Math.random() * 360 - 180).toFixed(0) + "deg"); s.style.fontSize = (18 + Math.random() * 14).toFixed(0) + "px"; box.appendChild(s); }
  document.body.appendChild(box); setTimeout(() => box.remove(), 8500);
}

// The Seasons part of Me → 🎨 Colors: what's on now, what's next, on/off, a peek at each, her birthday, this season's button.
export function renderSeasonRow(date = todayStr()){
  const el = $("#seasonRow"); if (!el) return;
  const st = S.settings || {}; const id = seasonNow(date); const t = THEMES[id]; const nx = nextSeason(date, { birthday: st.birthday }); const off = st.seasons === "off";
  const bd = validBirthday(st.birthday);
  el.innerHTML = `<div class="season-now"><img class="season-btn" src="icons/season/${t ? id : "default"}.svg" alt="" width="56" height="56"><div class="grow small"><b>${t ? `${t.e} ${esc(t.n)}` : "✿ Everyday pink"}</b>${off ? " · seasons are off" : ""}${nx && !off ? `<br>Next: ${THEMES[nx.id].e} ${esc(THEMES[nx.id].n)} from ${esc(short(nx.from))}` : ""}</div></div>
    <div class="row"><span class="small grow">Seasonal themes</span><button class="chip ${off ? "" : "coral"}" onclick="setSeasons('on')">On</button><button class="chip ${off ? "coral" : ""}" onclick="setSeasons('off')">Off</button></div>
    <div class="small muted" style="margin-top:6px">Peek at one for today:</div>
    <div class="row season-peek">${Object.entries(THEMES).map(([k, v]) => `<button class="chip ${id === k ? "coral" : ""}" onclick="seasonPeek('${k}')" aria-label="${esc(v.n)}" title="${esc(v.n)}">${v.e}</button>`).join("")}<button class="chip" onclick="seasonPeek('')" title="Back to the schedule">↺</button></div>
    <label class="row small" style="margin-top:6px">🎂 My birthday <input type="date" class="season-bday" value="${bd ? `2000-${bd}` : ""}" onchange="seasonBirthday(this.value)"></label>
    <div class="small muted">On iPhone the home-screen button keeps the picture it had when the app was added; this season's is the one above.</div>`;
}
async function setSeasons(v){ await setSettings({ seasons: v === "off" ? "off" : "on" }); try { localStorage.removeItem(PEEK); } catch (e) {} applySeason(); renderSeasonRow(); }
function seasonPeek(id){ const date = todayStr(); if (id === "") { try { localStorage.removeItem(PEEK); } catch (e) {} } else lsSet(PEEK, { id, date }); applySeason(date); if (id) showerOnce(id, date, true); renderSeasonRow(date); }
async function seasonBirthday(v){ const md = typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v.slice(5) : ""; await setSettings({ birthday: validBirthday(md) }); applySeason(); renderSeasonRow(); if (md) toast("Birthday saved 🎂"); }
expose({ setSeasons, seasonPeek, seasonBirthday });
