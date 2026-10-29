// The Halloween decorations that dress every screen (css/app.css html[data-season="halloween"], js/seasons.js):
// cobweb corners, a spider on its thread, bats, a witch hat (her pink band), a little witch on a broom, the nav bar's
// web strand, the header's night sky and the page's wallpaper. Writes icons/season/halloween/*.svg:
//   node tools/season-deco.cjs
// Shapes only, kid-friendly (round spiders with big eyes), in Halloween purple with her pink.
const fs = require("fs"); const path = require("path");
const OUT = path.join(__dirname, "..", "icons", "season", "halloween"); fs.mkdirSync(OUT, { recursive: true });
const PURPLE = "#2E1B45", PURPLE2 = "#4B2A6E", PINK = "#FF5C93", ORANGE = "#FF8A3D", GOLD = "#F4C86A";
const svg = (w, h, body, extra = "") => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"${extra}>${body}</svg>\n`;

// A quarter cobweb from the top-right corner: radial threads and sagging rings.
function web(size, stroke, width){
  const r = size, rays = [0, 22, 45, 68, 90].map(a => a * Math.PI / 180); let s = "";
  for (const a of rays) s += `<line x1="${size}" y1="0" x2="${(size - r * Math.cos(a)).toFixed(1)}" y2="${(r * Math.sin(a)).toFixed(1)}"/>`;
  for (const k of [.32, .56, .8]) { let d = ""; rays.forEach((a, i) => { const x = size - r * k * Math.cos(a), y = r * k * Math.sin(a); if (!i) d += `M${x.toFixed(1)} ${y.toFixed(1)}`; else { const pa = rays[i - 1], mx = size - r * k * .86 * Math.cos((a + pa) / 2), my = r * k * .86 * Math.sin((a + pa) / 2); d += ` Q${mx.toFixed(1)} ${my.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`; } }); s += `<path d="${d}" fill="none"/>`; }
  return `<g stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" fill="none">${s}</g>`;
}
// A round, friendly spider centred at (x, y).
const spider = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><g stroke="${PURPLE}" stroke-width="2.2" stroke-linecap="round" fill="none">
  <path d="M-6 -2 Q-14 -10 -19 -4"/><path d="M-7 1 Q-16 -2 -20 4"/><path d="M-7 4 Q-15 6 -18 12"/><path d="M-5 6 Q-11 12 -12 17"/>
  <path d="M6 -2 Q14 -10 19 -4"/><path d="M7 1 Q16 -2 20 4"/><path d="M7 4 Q15 6 18 12"/><path d="M5 6 Q11 12 12 17"/></g>
  <ellipse cx="0" cy="2" rx="9" ry="10" fill="${PURPLE}"/><circle cx="-3.4" cy="0" r="3" fill="#fff"/><circle cx="3.4" cy="0" r="3" fill="#fff"/>
  <circle cx="-3" cy="0.6" r="1.4" fill="${PURPLE}"/><circle cx="3.8" cy="0.6" r="1.4" fill="${PURPLE}"/><ellipse cx="-5.6" cy="5" rx="1.8" ry="1.1" fill="${PINK}" opacity=".85"/><ellipse cx="5.6" cy="5" rx="1.8" ry="1.1" fill="${PINK}" opacity=".85"/></g>`;
const bat = (fill, eyes = true) => `<path d="M30 9 C33 4 37 4 39 9 C44 1 54 0 60 6 C53 6 50 11 49 16 C45 12 41 14 39 18 C36 15 33 15 30 18 C27 15 24 15 21 18 C19 14 15 12 11 16 C10 11 7 6 0 6 C6 0 16 1 21 9 C23 4 27 4 30 9 Z" fill="${fill}"/>${eyes ? `<circle cx="27.6" cy="10" r="1.6" fill="#fff"/><circle cx="32.4" cy="10" r="1.6" fill="#fff"/>` : ""}`;
const hat = `<path d="M8 46 Q40 38 72 46 Q40 54 8 46 Z" fill="${PURPLE}"/><path d="M22 44 L36 6 Q38 0 44 4 L52 14 Q46 12 44 16 L58 44 Q40 48 22 44 Z" fill="${PURPLE2}"/>
  <path d="M24 38 Q40 42 56 38 L58 44 Q40 48 22 44 Z" fill="${PINK}"/><rect x="35" y="37.5" width="10" height="7" rx="1.5" fill="none" stroke="${GOLD}" stroke-width="2"/>
  <path d="M36 6 Q38 0 44 4 L52 14 Q46 12 44 16 Z" fill="${PURPLE}"/><circle cx="51" cy="13" r="2.2" fill="${GOLD}"/>`;
const witch = `<g fill="${PURPLE}"><path d="M4 40 L92 30" stroke="#6B3E1E" stroke-width="3.2" stroke-linecap="round"/><path d="M84 31 L104 22 L106 30 L108 40 L86 36 Z" fill="#B8742E"/>
  <path d="M40 36 Q34 22 44 16 Q52 14 56 24 L64 36 Q52 40 40 36 Z"/><path d="M40 34 Q28 36 22 44 Q32 42 42 40 Z" fill="${PINK}"/>
  <circle cx="50" cy="13" r="6"/><path d="M38 12 Q50 8 62 12 Q50 15 38 12 Z"/><path d="M44 11 L52 -4 Q54 -8 57 -5 L58 0 Q55 -1 54 2 L56 11 Z"/></g>`;

const files = {
  "web.svg": svg(60, 60, web(60, "#9A86BD", 1.3)),
  "web-light.svg": svg(60, 60, web(60, "#E9DDF7", 1.3)),
  "web-hero.svg": svg(90, 90, `<g opacity=".75">${web(90, "#FFFFFF", 1.5)}</g>`),
  "spider.svg": svg(40, 70, `<line x1="20" y1="0" x2="20" y2="44" stroke="#9A86BD" stroke-width="1.2"/>` + spider(20, 52, 1)),
  "spider-light.svg": svg(40, 70, `<line x1="20" y1="0" x2="20" y2="44" stroke="#E9DDF7" stroke-width="1.2"/>` + spider(20, 52, 1)),
  "bat.svg": svg(60, 20, bat(PURPLE)),
  "bat-light.svg": svg(60, 20, bat("#C9A7F5")),
  "hat.svg": svg(80, 56, hat),
  "witch.svg": svg(112, 50, witch, ` overflow="visible"`),
  // The nav bar's strand: a sagging thread with two small webs at the ends (stretched to the bar's width).
  "strand.svg": svg(400, 24, `<path d="M0 2 Q100 20 200 10 T400 2" stroke="#9A86BD" stroke-width="1.4" fill="none"/><path d="M0 2 Q60 10 120 13" stroke="#9A86BD" stroke-width="1" fill="none" opacity=".7"/><path d="M400 2 Q340 10 280 12" stroke="#9A86BD" stroke-width="1" fill="none" opacity=".7"/>`, ` preserveAspectRatio="none"`),
  // The header's night: a crescent moon, stars and bats, over the theme's gradient.
  "night.svg": svg(220, 120, `<path d="M170 18 A22 22 0 1 0 192 46 A18 18 0 1 1 170 18 Z" fill="#FFE7A3"/>
    <g fill="#FFE7A3">${[[30, 18, 1.6], [70, 40, 1.2], [110, 14, 1.8], [138, 70, 1.3], [205, 82, 1.4], [92, 92, 1.1], [16, 70, 1.3]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join("")}</g>
    <g transform="translate(118 46) scale(.55)">${bat(PURPLE, false)}</g><g transform="translate(60 64) scale(.4)">${bat(PURPLE, false)}</g>`),
  // The page's wallpaper tile, faint: bats, stars and tiny webs between the cards.
  "pattern.svg": svg(200, 200, `<g opacity=".16"><g transform="translate(18 30) scale(.5)">${bat(PURPLE2, false)}</g><g transform="translate(120 120) scale(.45) rotate(-10)">${bat(PURPLE2, false)}</g>
    <g fill="${ORANGE}">${[[150, 30, 2.4], [60, 150, 2], [100, 80, 1.6], [180, 180, 1.8]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join("")}</g>
    <g transform="translate(140 52) scale(.5)">${web(60, PURPLE2, 2)}</g><g transform="translate(6 120) scale(.45) rotate(90 30 30)">${web(60, PURPLE2, 2)}</g></g>`),
};
for (const [f, s] of Object.entries(files)) fs.writeFileSync(path.join(OUT, f), s);
console.log("icons/season/halloween:", Object.keys(files).join(", "));
