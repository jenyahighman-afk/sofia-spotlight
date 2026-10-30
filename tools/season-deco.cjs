// The seasonal decorations that dress every screen (css/app.css html[data-season="halloween"|"fall"], js/seasons.js).
// Halloween: cobweb corners, a spider on its thread, bats, a witch hat (her pink band), a little witch on a broom, the
// nav bar's web strand, the header's night sky and the page's wallpaper. Fall (1.53.0): leaf sprigs in the corners, an
// acorn on its stem, a leaf after each title, a pink knit beanie, a leaf garland with a squirrel on the nav bar, the
// header's pumpkins and wheat, falling leaves and a turkey strolling by. Writes icons/season/{halloween,fall}/*.svg:
//   node tools/season-deco.cjs
// Shapes only, kid-friendly (round spiders and acorns with big eyes), in the season's colors with her pink.
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

// ---------- Fall (Nov 1 to the Sunday after Thanksgiving) ----------
const FALL = path.join(__dirname, "..", "icons", "season", "fall"); fs.mkdirSync(FALL, { recursive: true });
const RUST = "#E86A33", RED = "#D9472B", AMBER = "#F2B33D", BROWN = "#8B5A2B", BARK = "#6B4220", TAN = "#E0954A", CREAM = "#F7D9A8", LEAFPINK = "#FF7FAE";
// A maple leaf in a 40×40 box (stem at the bottom), and a long oval leaf in 40×20.
const MAPLE = "M20 1 L22.6 8.6 L27.4 5.4 L26.6 13.4 L34.6 11 L31.4 17.4 L38.6 20.2 L29.4 23.4 L31 28.6 L22.4 26.4 L21.2 33 L18.8 33 L17.6 26.4 L9 28.6 L10.6 23.4 L1.4 20.2 L8.6 17.4 L5.4 11 L13.4 13.4 L12.6 5.4 L17.4 8.6 Z";
const maple = (fill, vein = "#5A2A10", stem = BARK, vop = .3) => `<path d="${MAPLE}" fill="${fill}"/><g stroke="${vein}" stroke-opacity="${vop}" stroke-width="1" stroke-linecap="round" fill="none"><path d="M20 32 L20 7"/><path d="M20 21 L32 13"/><path d="M20 21 L8 13"/><path d="M20 25 L28 27"/><path d="M20 25 L12 27"/></g><path d="M20 32 L20 39" stroke="${stem}" stroke-width="1.8" stroke-linecap="round"/>`;
const oval = (fill, vein = "#5A2A10", vop = .3) => `<path d="M2 10 Q20 -6 38 10 Q20 26 2 10 Z" fill="${fill}"/><path d="M4 10 L36 10" stroke="${vein}" stroke-opacity="${vop}" stroke-width="1" stroke-linecap="round"/>`;
// Place a leaf (40 wide; its middle at y = cy) centred at (x, y), turned by a degrees, at scale s.
const at = (x, y, a, s, body, cy = 20) => `<g transform="translate(${x} ${y}) rotate(${a}) scale(${s}) translate(-20 ${-cy})">${body}</g>`; // cy = 10 for an oval leaf
// A round acorn with a face, its cap at (x, y).
const acorn = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><ellipse cx="0" cy="9" rx="8.5" ry="10" fill="${TAN}"/><path d="M-1.6 18 L0 21.5 L1.6 18 Z" fill="${TAN}"/>
  <ellipse cx="-3.6" cy="7" rx="1.8" ry="3.4" fill="#fff" opacity=".35"/><circle cx="-3" cy="9" r="1.4" fill="#4A2A12"/><circle cx="3" cy="9" r="1.4" fill="#4A2A12"/><ellipse cx="-5.2" cy="12.6" rx="1.7" ry="1" fill="${PINK}" opacity=".8"/><ellipse cx="5.2" cy="12.6" rx="1.7" ry="1" fill="${PINK}" opacity=".8"/>
  <path d="M-11 2 Q-11 -7 0 -7 Q11 -7 11 2 Q0 5 -11 2 Z" fill="${BROWN}"/><path d="M-8 -2 L8 -2 M-9 1 L9 1 M-4 -5 L-4 2 M0 -6 L0 2 M4 -5 L4 2" stroke="${BARK}" stroke-width=".9" opacity=".7"/><path d="M0 -7 Q1 -11 4.5 -12" stroke="${BARK}" stroke-width="2" fill="none" stroke-linecap="round"/></g>`;
const pumpkin = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><ellipse cx="-9" cy="0" rx="11" ry="13" fill="#F07C3E"/><ellipse cx="9" cy="0" rx="11" ry="13" fill="#F07C3E"/><ellipse cx="0" cy="0" rx="9" ry="14" fill="#F58A48"/>
  <path d="M-9 -11 Q-12 0 -9 11 M9 -11 Q12 0 9 11" stroke="#D9622A" stroke-width="1.2" fill="none"/><path d="M0 -13 Q1 -19 5 -21" stroke="#5E7D3A" stroke-width="3.4" fill="none" stroke-linecap="round"/><path d="M3 -16 Q10 -22 14 -16 Q8 -15 3 -16 Z" fill="#7FA650"/></g>`;
const wheat = (x, y, a) => `<g transform="translate(${x} ${y}) rotate(${a})"><path d="M0 0 L0 -44" stroke="#D9A94A" stroke-width="1.6"/>${[0, 1, 2, 3, 4].map(i => `<ellipse cx="-3" cy="${-44 + i * 5}" rx="2.4" ry="4.4" transform="rotate(-24 -3 ${-44 + i * 5})" fill="#F2D06B"/><ellipse cx="3" cy="${-42 + i * 5}" rx="2.4" ry="4.4" transform="rotate(24 3 ${-42 + i * 5})" fill="#F2D06B"/>`).join("")}<ellipse cx="0" cy="-48" rx="2.2" ry="4.2" fill="#F2D06B"/></g>`;
const squirrel = `<path d="M37 49 C55 47 57 24 47 14 C41 8 32 12 34 20" stroke="#B9632B" stroke-width="13" fill="none" stroke-linecap="round"/><path d="M38 47 C51 44 52 26 45 18" stroke="#E08B4A" stroke-width="4" fill="none" stroke-linecap="round" opacity=".8"/>
  <ellipse cx="26" cy="40" rx="12" ry="13" fill="#C97638"/><ellipse cx="22" cy="43" rx="7" ry="8.5" fill="${CREAM}"/><circle cx="20" cy="23" r="10" fill="#C97638"/><path d="M21 15 L25 5 L29 16 Z" fill="#C97638"/><path d="M23 14 L25 8 L27 15 Z" fill="${LEAFPINK}"/>
  <circle cx="15.5" cy="21.5" r="2.4" fill="#3A2212"/><circle cx="14.8" cy="20.7" r=".8" fill="#fff"/><circle cx="10.6" cy="25" r="1.7" fill="#3A2212"/><ellipse cx="17" cy="28" rx="2.8" ry="1.7" fill="${PINK}" opacity=".7"/>
  ${acorn(15, 34, .5)}<ellipse cx="19" cy="38" rx="3" ry="2.4" fill="#C97638"/><ellipse cx="22" cy="52" rx="5" ry="2.6" fill="#B9632B"/><ellipse cx="31" cy="52" rx="5" ry="2.6" fill="#B9632B"/>`;
const turkey = `<g>${[[-66, RED], [-44, RUST], [-22, AMBER], [0, PINK], [22, AMBER], [44, RUST], [66, RED]].map(([a, c]) => `<ellipse cx="32" cy="14" rx="6.5" ry="16" transform="rotate(${a} 32 36)" fill="${c}"/>`).join("")}</g>
  <path d="M27 50 L26 58 M37 50 L38 58 M23 58 L29 58 M35 58 L41 58" stroke="${AMBER}" stroke-width="2.2" stroke-linecap="round"/><ellipse cx="32" cy="39" rx="13" ry="14" fill="${BROWN}"/><ellipse cx="32" cy="43" rx="8" ry="8" fill="#A86B3C"/>
  <circle cx="32" cy="23" r="7.5" fill="#A86B3C"/><circle cx="29.2" cy="21.5" r="2.2" fill="#fff"/><circle cx="34.8" cy="21.5" r="2.2" fill="#fff"/><circle cx="29.6" cy="22" r="1.1" fill="#3A2212"/><circle cx="35.2" cy="22" r="1.1" fill="#3A2212"/>
  <path d="M30 25 L34 25 L32 28.5 Z" fill="${AMBER}"/><path d="M33.2 27 Q36.4 31 33.4 34.5 Q31.4 31 33.2 27 Z" fill="${RED}"/><ellipse cx="26.6" cy="26" rx="1.8" ry="1.1" fill="${PINK}" opacity=".85"/><ellipse cx="37.4" cy="26" rx="1.8" ry="1.1" fill="${PINK}" opacity=".85"/>`;
const beanie = `<path d="M14 44 Q14 9 40 9 Q66 9 66 44 Z" fill="${PINK}"/><path d="M17 31 Q40 22 63 31" stroke="${AMBER}" stroke-width="4" fill="none"/><path d="M15.5 38 Q40 30 64.5 38" stroke="#fff" stroke-width="2" fill="none" opacity=".55"/>
  <rect x="10" y="38" width="60" height="13" rx="6.5" fill="#FF8FB8"/>${[16, 22, 28, 34, 40, 46, 52, 58, 64].map(x => `<path d="M${x} 40.5 L${x} 48.5" stroke="${PINK}" stroke-width="1.4" opacity=".55" stroke-linecap="round"/>`).join("")}
  <circle cx="40" cy="9" r="8.5" fill="#FFD1E1"/><circle cx="37" cy="6.5" r="3" fill="#fff" opacity=".6"/>${at(60, 34, 30, .42, maple(RUST))}`;
// The garland on the nav bar: a sagging string with small leaves hanging along it (x = 200t on each half, so a leaf at x
// sits on the curve at the Bézier's y for t = x/200).
const qy = (y0, yc, y1, t) => (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * yc + t * t * y1;
const garlandLeaves = [20, 60, 100, 140, 180, 220, 260, 300, 340, 380].map((x, i) => { const y = x <= 200 ? qy(2, 18, 10, x / 200) : qy(10, 2, 2, (x - 200) / 200); const c = [RUST, RED, AMBER, LEAFPINK][i % 4]; return at(x, y + 7, i % 2 ? 14 : -14, .3, maple(c)); }).join("");
const fallFiles = {
  // The card corner: a twig from the top-right corner with three leaves.
  "sprig.svg": svg(60, 60, `<path d="M60 0 Q46 10 30 26" stroke="${BARK}" stroke-width="2.2" fill="none" stroke-linecap="round"/><path d="M47 9 Q50 18 46 24" stroke="${BARK}" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    ${at(44, 12, 200, .52, maple(RUST))}${at(30, 27, 150, .5, maple(RED))}${at(45, 27, 105, .46, oval(AMBER), 10)}`),
  "leaf.svg": svg(40, 40, maple(RUST)),
  "leaf-red.svg": svg(40, 40, maple(RED)),
  "leaf-gold.svg": svg(40, 40, maple(AMBER)),
  "leaf-pink.svg": svg(40, 40, maple(LEAFPINK)),
  // An acorn hanging from its stem (the card's swinging friend, like Halloween's spider).
  "acorn.svg": svg(40, 70, `<path d="M20 0 L20 33" stroke="${BARK}" stroke-width="1.4"/>${at(25, 22, 20, .28, oval("#7FA650"), 10)}` + acorn(20, 42, 1)),
  "squirrel.svg": svg(60, 56, squirrel),
  "turkey.svg": svg(64, 60, turkey, ` overflow="visible"`),
  "beanie.svg": svg(80, 56, beanie),
  "garland.svg": svg(400, 26, `<path d="M0 2 Q100 18 200 10 T400 2" stroke="${BARK}" stroke-width="1.3" fill="none"/>${garlandLeaves}`, ` preserveAspectRatio="none"`),
  // The header: pumpkins and wheat at the bottom right, a few leaves in the air, over the theme's gradient.
  "harvest.svg": svg(220, 120, `${wheat(176, 112, 8)}${wheat(186, 112, 18)}${wheat(166, 112, -6)}${pumpkin(150, 104, 1)}${pumpkin(194, 108, .7)}
    ${at(60, 40, 30, .5, maple(AMBER))}${at(100, 78, -20, .42, maple("#fff", "#000", BARK, .12))}${at(28, 86, 60, .4, maple(RED))}${at(120, 24, -40, .36, maple(LEAFPINK))}`),
  // The header's top-left corner: a branch with leaves, white and soft (mirrored by the CSS).
  "branch-hero.svg": svg(90, 90, `<g opacity=".7"><path d="M90 0 Q66 16 40 40" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M70 12 Q74 26 68 34" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round"/>
    ${at(64, 16, 200, .62, maple("#fff", "#000", "#fff", .08))}${at(42, 40, 150, .56, maple("#fff", "#000", "#fff", .08))}${at(68, 40, 105, .55, oval("#fff", "#000", .08), 10)}</g>`),
  // The page's wallpaper tile, faint: leaves, acorns and pink dots between the cards.
  "pattern.svg": svg(200, 200, `<g opacity=".16">${at(36, 40, 20, .7, maple("#B45309", "none", "#B45309"))}${at(140, 130, -30, .6, maple("#C2410C", "none", "#C2410C"))}${at(150, 40, 70, .55, oval("#B45309", "none"), 10)}${at(40, 150, -50, .55, oval("#C2410C", "none"), 10)}
    ${acorn(100, 86, .8)}<g fill="${PINK}">${[[178, 84, 2.4], [70, 104, 2], [20, 100, 1.6], [110, 180, 1.8], [186, 186, 1.4]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join("")}</g></g>`),
};
for (const [f, s] of Object.entries(fallFiles)) fs.writeFileSync(path.join(FALL, f), s);
console.log("icons/season/fall:", Object.keys(fallFiles).join(", "));
