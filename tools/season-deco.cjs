// The seasonal decorations that dress every screen (css/app.css html[data-season="halloween"|"fall"|"christmas"], js/seasons.js).
// Halloween: cobweb corners, a spider on its thread, bats, a witch hat (her pink band), a little witch on a broom, the
// nav bar's web strand, the header's night sky and the page's wallpaper. Fall (1.53.0): leaf sprigs in the corners, an
// acorn on its stem, a leaf after each title, a pink knit beanie, a leaf garland with a squirrel on the nav bar, the
// header's pumpkins and wheat, falling leaves and a turkey strolling by. Christmas (1.55.0): holly with berries in the
// corners, an ornament and a jingle bell on their ribbons, a candy cane after each title, a Santa hat, a string of
// twinkling lights with a snowman on the nav bar, the header's tree and presents with a snowy bough, snowflakes and
// Santa's sleigh. Writes icons/season/{halloween,fall,christmas}/*.svg:
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

// ---------- Christmas (Dec 1–26) ----------
const XMAS = path.join(__dirname, "..", "icons", "season", "christmas"); fs.mkdirSync(XMAS, { recursive: true });
const HOLLY = "#2F9A5E", HOLLY2 = "#1F6E44", XRED = "#E63946", XRED2 = "#B5172F", PINE = "#2F8F5B", PINE2 = "#3BA36A", FUR = "#E7CBD6", COAL = "#3A2434", XGOLD = "#F4C86A", XGOLD2 = "#D9A520";
const f1 = (n) => +n.toFixed(1);
// A holly leaf in a 40×20 box (its middle at y = 10, so place it with at(…, 10)): spiky tips joined by inward curves.
const HOLLYD = (() => { const top = [[1, 10], [7, 4], [13, 2.2], [20, 1.6], [27, 2.2], [33, 4], [39, 10]]; const pts = [...top, ...top.slice(1, -1).reverse().map(([x, y]) => [x, 20 - y]), top[0]];
  let d = `M${pts[0][0]} ${pts[0][1]}`; for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x, y] = pts[i]; const my = (y0 + y) / 2; d += ` Q${f1((x0 + x) / 2)} ${f1(my + (my < 10 ? 2.6 : -2.6))} ${x} ${y}`; } return d + " Z"; })();
const holly = (fill = HOLLY) => `<path d="${HOLLYD}" fill="${fill}"/><path d="M4 10 L36 10" stroke="${HOLLY2}" stroke-opacity=".55" stroke-width="1.1" stroke-linecap="round"/>`;
const berry = (x, y, r, fill = XRED) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/><circle cx="${f1(x - r * .35)}" cy="${f1(y - r * .35)}" r="${f1(r * .3)}" fill="#fff" opacity=".6"/>`;
// A six-armed snowflake with little branches, centred at (x, y).
const flake = (x, y, r, c, w = 1.6, op = 1) => { let d = ""; for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3, ex = x + r * Math.cos(a), ey = y + r * Math.sin(a), bx = x + .58 * r * Math.cos(a), by = y + .58 * r * Math.sin(a);
  d += `M${x} ${y} L${f1(ex)} ${f1(ey)}`; for (const s of [-1, 1]) d += ` M${f1(bx)} ${f1(by)} L${f1(bx + .34 * r * Math.cos(a + s * .75))} ${f1(by + .34 * r * Math.sin(a + s * .75))}`; }
  return `<path d="${d}" stroke="${c}" stroke-width="${w}" stroke-linecap="round" fill="none"${op < 1 ? ` opacity="${op}"` : ""}/>`; };
// A frosty flier: the flake in its colour with a white line down each arm, so it shows on her pink and on dark.
const flier = (c) => flake(12, 12, 10.5, c, 2.6) + flake(12, 12, 10.5, "#fff", .9, .8) + `<circle cx="12" cy="12" r="2.2" fill="${c}"/>`;
// A five-point star centred at (x, y).
const star = (x, y, r, fill) => { let d = ""; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .45 : r; d += `${i ? "L" : "M"}${f1(x + rr * Math.cos(a))} ${f1(y + rr * Math.sin(a))} `; } return `<path d="${d}Z" fill="${fill}"/>`; };
// A happy face (eyes, cheeks, smile) centred at (x, y).
const face = (x, y, cheek = "#FFD1E1") => `<circle cx="${x - 4}" cy="${y}" r="1.6" fill="${COAL}"/><circle cx="${x + 4}" cy="${y}" r="1.6" fill="${COAL}"/><circle cx="${x - 4.5}" cy="${y - .6}" r=".55" fill="#fff"/><circle cx="${x + 3.5}" cy="${y - .6}" r=".55" fill="#fff"/>
  <ellipse cx="${x - 6.6}" cy="${y + 3.4}" rx="1.8" ry="1.1" fill="${cheek}" opacity=".85"/><ellipse cx="${x + 6.6}" cy="${y + 3.4}" rx="1.8" ry="1.1" fill="${cheek}" opacity=".85"/><path d="M${x - 2.2} ${y + 3.2} Q${x} ${y + 5.2} ${x + 2.2} ${y + 3.2}" stroke="${COAL}" stroke-width="1.1" fill="none" stroke-linecap="round"/>`;
// An ornament on its ribbon (40×70): a gold cap and a round bauble with a zigzag band and a face.
const ornament = (fill, band, cheek) => `<path d="M20 0 L20 30" stroke="${XGOLD2}" stroke-width="1.3"/><circle cx="20" cy="29" r="3" fill="none" stroke="${XGOLD2}" stroke-width="1.3"/><rect x="15" y="30.5" width="10" height="6" rx="1.5" fill="${XGOLD}"/>
  <circle cx="20" cy="50" r="14" fill="${fill}"/><path d="M6.6 54 L10 57.5 L13.4 54 L16.8 57.5 L20.2 54 L23.6 57.5 L27 54 L30.4 57.5 L33.4 54" stroke="${band}" stroke-width="2" fill="none" stroke-linejoin="round" stroke-linecap="round"/>
  <ellipse cx="13.6" cy="42.4" rx="3" ry="4.6" transform="rotate(30 13.6 42.4)" fill="#fff" opacity=".45"/>${face(20, 46.5, cheek)}`;
// A jingle bell on a ribbon (40×70) with a red bow and a face.
const bell = `<path d="M20 0 L20 27" stroke="${XRED}" stroke-width="1.6"/><path d="M20 28 Q12 20 10 26 Q10 32 20 29 Z M20 28 Q28 20 30 26 Q30 32 20 29 Z" fill="${XRED}"/><path d="M19 29 L15 36 M21 29 L25 36" stroke="${XRED}" stroke-width="2" stroke-linecap="round"/><circle cx="20" cy="28.5" r="2.4" fill="${XRED2}"/>
  <path d="M20 31 C12 31 10.5 39 10.5 46 C10.5 52 8 55.5 5 57.5 L35 57.5 C32 55.5 29.5 52 29.5 46 C29.5 39 28 31 20 31 Z" fill="${XGOLD}"/><path d="M5 57.5 L35 57.5" stroke="${XGOLD2}" stroke-width="2.4" stroke-linecap="round"/><circle cx="20" cy="60.5" r="3" fill="${XGOLD2}"/>
  <path d="M14 37 Q12.6 42 13 47" stroke="#fff" stroke-width="2" stroke-linecap="round" fill="none" opacity=".55"/>${face(20, 45, "#FF8FB8")}`;
// The Santa hat (80×56, the beanie's box, flopping to the right): a white fur brim and pom-pom, and a holly leaf with
// her pink berry on the brim.
const santaHat = `<path d="M14 42 C15 20 28 8 44 9 C56 10 64 18 70 30 C64 30 60 33 61 37 L66 42 Z" fill="${XRED}"/><path d="M44 9 C56 10 64 18 70 30 C66 29.5 63 30.5 61.4 33 C58 22 52 14 44 9 Z" fill="${XRED2}" opacity=".45"/>
  <path d="M22 35 Q28 20 40 14" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round" opacity=".3"/>
  <rect x="10" y="38" width="60" height="13" rx="6.5" fill="#fff" stroke="${FUR}" stroke-width="1.2"/>${[18, 28, 38, 48, 58].map((x, i) => `<circle cx="${x}" cy="${i % 2 ? 46 : 43}" r="2.6" fill="${FUR}" opacity=".45"/>`).join("")}
  <circle cx="70.5" cy="33" r="7.5" fill="#fff" stroke="${FUR}" stroke-width="1.2"/><circle cx="68" cy="30.5" r="2.4" fill="${FUR}" opacity=".5"/>
  ${at(23, 41, -24, .36, holly(), 10)}${at(31, 40, 22, .32, holly(), 10)}${berry(27, 40.6, 2.8, PINK)}`;
// A candy cane (20×28), red stripes on white with a dark-red edge so it shows on any card.
const CANE = "M13.5 26 L13.5 9.5 A4.75 4.75 0 0 0 4 9.5 L4 11.5";
const cane = `<path d="${CANE}" stroke="${XRED2}" stroke-width="6.6" fill="none" stroke-linecap="round"/><path d="${CANE}" stroke="#fff" stroke-width="4.6" fill="none" stroke-linecap="round"/><path d="${CANE}" stroke="${XRED}" stroke-width="4.6" fill="none" stroke-dasharray="3 3"/>`;
// The nav bar's string of lights: a sagging wire with bulbs hanging along it (stretched to the bar's width). Each bulb's
// glow twinkles (an SVG animation, so it runs inside the CSS background); lights-still.svg is the same string without the
// twinkle, for reduced motion.
const BULBS = [XRED, XGOLD, "#2FAE6A", PINK, "#5AB0F0"];
const lights = (twinkle) => `<path d="M0 2 Q100 18 200 10 T400 2" stroke="#4E5A4E" stroke-width="1.2" fill="none"/>` + Array.from({ length: 17 }, (_, i) => { const x = 12 + i * 23.5, y = x <= 200 ? qy(2, 18, 10, x / 200) : qy(10, 2, 2, (x - 200) / 200), c = BULBS[i % BULBS.length], a = i % 2 ? 12 : -12;
  const glow = `<circle cx="0" cy="7.6" r="6.6" fill="${c}" opacity=".22">${twinkle ? `<animate attributeName="opacity" values=".06;.5;.06" dur="${(1.6 + (i % 4) * .35).toFixed(2)}s" begin="${((i * .41) % 1.6).toFixed(2)}s" repeatCount="indefinite"/>` : ""}</circle>`;
  return `<g transform="translate(${f1(x)} ${f1(y)}) rotate(${a})">${glow}<rect x="-1.6" y="0" width="3.2" height="3.2" rx=".6" fill="#5E665E"/><ellipse cx="0" cy="7.6" rx="3.1" ry="4.6" fill="${c}"/><ellipse cx="-1" cy="6.2" rx=".9" ry="1.6" fill="#fff" opacity=".6"/></g>`; }).join("");
// A snowman (60×56) sitting on the nav bar: a pink scarf, a carrot nose, a top hat with her pink band, a soft blue edge.
const snowman = `<path d="M17 36 L6 28 M9 30.4 L5 31 M43 36 L54 28 M51 30.4 L55 31" stroke="#7A4A22" stroke-width="1.8" stroke-linecap="round"/>
  <circle cx="30" cy="42" r="13" fill="#fff" stroke="#C9D6E6" stroke-width="1.4"/><circle cx="30" cy="22.5" r="9.5" fill="#fff" stroke="#C9D6E6" stroke-width="1.4"/><path d="M19 47 Q30 56 41 47" stroke="#C9D6E6" stroke-width="2" fill="none" opacity=".7"/>
  <circle cx="30" cy="38" r="1.6" fill="${COAL}"/><circle cx="30" cy="44" r="1.6" fill="${COAL}"/>
  <path d="M21 30 Q30 34.5 39 30 L39.5 33.5 Q30 38 20.5 33.5 Z" fill="${PINK}"/><path d="M34 33 L36.5 42 L40.5 41 L37.5 32.4 Z" fill="${PINK}"/><path d="M36 39.6 L40 38.8" stroke="#fff" stroke-width="1" opacity=".7"/>
  <circle cx="26.6" cy="21" r="1.5" fill="${COAL}"/><circle cx="33.4" cy="21" r="1.5" fill="${COAL}"/><path d="M30 23.4 L37.4 25 L30 25.8 Z" fill="#F28A2E"/><ellipse cx="24" cy="25.4" rx="1.8" ry="1.1" fill="${PINK}" opacity=".7"/><ellipse cx="36" cy="25.4" rx="1.8" ry="1.1" fill="${PINK}" opacity=".7"/>
  <rect x="20.5" y="13.4" width="19" height="2.6" rx="1.3" fill="${COAL}"/><rect x="23.5" y="3" width="13" height="11" rx="1.5" fill="${COAL}"/><rect x="23.5" y="10" width="13" height="2.6" fill="${PINK}"/>`;
// The header: a little tree with a star, ornaments and tinsel, presents and snow at its foot, snowflakes in the air.
const treeScene = `<ellipse cx="150" cy="118" rx="76" ry="10" fill="#fff" opacity=".9"/><rect x="155" y="96" width="10" height="14" fill="#7A4A22"/>
  <path d="M160 52 L190 100 Q160 106 130 100 Z" fill="${PINE}"/><path d="M160 36 L184 74 Q160 80 136 74 Z" fill="${PINE2}"/><path d="M160 20 L178 50 Q160 55 142 50 Z" fill="${PINE}"/>
  <path d="M146 46 Q162 54 174 44 M141 70 Q160 80 180 68 M135 94 Q160 104 186 92" stroke="#fff" stroke-width="1.6" fill="none" opacity=".75"/>
  ${[[152, 40, PINK], [168, 58, XGOLD], [148, 63, XRED], [172, 84, PINK], [146, 88, XGOLD], [160, 75, "#5AB0F0"], [160, 96, XRED]].map(([x, y, c]) => `<circle cx="${x}" cy="${y}" r="3.4" fill="${c}"/>`).join("")}
  ${star(160, 16, 9, XGOLD)}
  <rect x="116" y="100" width="22" height="16" rx="2" fill="${PINK}"/><path d="M127 100 L127 116 M116 107 L138 107" stroke="#fff" stroke-width="3"/><path d="M127 100 Q120 92 122 99 Q124 102 127 100 Q134 92 132 99 Q130 102 127 100 Z" fill="#fff"/>
  <rect x="180" y="104" width="18" height="12" rx="2" fill="${XGOLD}"/><path d="M189 104 L189 116 M180 109.6 L198 109.6" stroke="${XRED}" stroke-width="2.6"/>`;
// The header's top-left corner: a pine bough, white and soft (mirrored by the CSS). Nothing solid hangs from it: the
// header's first line sits right under it.
const bough = (() => { const P0 = [90, 0], C = [66, 14], P1 = [38, 40]; let needles = "";
  for (let t = .08; t <= .96; t += .07) { const x = (1 - t) ** 2 * P0[0] + 2 * (1 - t) * t * C[0] + t * t * P1[0], y = (1 - t) ** 2 * P0[1] + 2 * (1 - t) * t * C[1] + t * t * P1[1];
    const dx = 2 * (1 - t) * (C[0] - P0[0]) + 2 * t * (P1[0] - C[0]), dy = 2 * (1 - t) * (C[1] - P0[1]) + 2 * t * (P1[1] - C[1]), a = Math.atan2(dy, dx);
    for (const s of [-1, 1]) needles += `M${f1(x)} ${f1(y)} L${f1(x + 10 * Math.cos(a + s * .7))} ${f1(y + 10 * Math.sin(a + s * .7))} `; }
  return `<g opacity=".75"><path d="M90 0 Q66 14 38 40" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="${needles}" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/></g>`; })();
// Santa's sleigh (150×60), flying to the right: the reindeer with his red nose, the harness, Santa, her pink sack.
const sleigh = `<g opacity=".85">${star(8, 32, 3.4, XGOLD)}${star(18, 22, 2.4, XGOLD)}${star(20, 40, 2, XGOLD)}</g>
  <path d="M86 34 Q100 30 114 29" stroke="${XGOLD2}" stroke-width="1.4" fill="none"/><path d="M66 22 Q92 18 116 26" stroke="#7A4A22" stroke-width="1" fill="none"/>
  <path d="M114 34 L106 41 M118 35 L112 43 M128 34 L136 41 M132 33 L141 38" stroke="#7A4A22" stroke-width="2.4" stroke-linecap="round"/><ellipse cx="122" cy="30" rx="13" ry="7" fill="#A0673A"/><ellipse cx="121" cy="32.6" rx="7" ry="3" fill="#E8C9A0"/><path d="M109 28 Q104 25 105 30 Z" fill="#E8C9A0"/>
  <path d="M131 27 Q134 20 137 18" stroke="#A0673A" stroke-width="5" stroke-linecap="round" fill="none"/><path d="M114 29 Q120 26 126 29" stroke="${XRED}" stroke-width="2.4" fill="none"/><circle cx="120" cy="28.6" r="1.6" fill="${XGOLD}"/>
  <path d="M136 14 Q133 7 129 4 M133 9 L128 9 M139 14 Q140 6 144 3 M140 9 L145 8" stroke="#7A4A22" stroke-width="1.8" stroke-linecap="round" fill="none"/>
  <ellipse cx="139" cy="18" rx="6" ry="5" fill="#A0673A"/><ellipse cx="144.4" cy="20" rx="3.6" ry="3" fill="#B97A48"/><circle cx="147.6" cy="19.4" r="2.4" fill="${XRED}"/><circle cx="147" cy="18.7" r=".7" fill="#fff" opacity=".8"/><path d="M134.6 14.4 L132 11.6 L136.6 12.6 Z" fill="#A0673A"/><circle cx="139.6" cy="16.6" r="1.2" fill="${COAL}"/>
  <path d="M36 15 Q30 4 40 4 Q50 4 48 15 Q42 18 36 15 Z" fill="${PINK}"/><path d="M38 6 Q42 2 46 6" stroke="#fff" stroke-width="1.6" fill="none"/><rect x="40" y="0" width="7" height="6" rx="1" fill="${XGOLD}" transform="rotate(12 43 3)"/>
  <circle cx="60" cy="25" r="9" fill="${XRED}"/><path d="M51.5 25 L68.5 25" stroke="#fff" stroke-width="2"/><circle cx="60" cy="13" r="6" fill="#F9D7C0"/><path d="M54.4 13.6 Q55 22 60 22.4 Q65 22 65.6 13.6 Q60 16.6 54.4 13.6 Z" fill="#fff"/>
  <circle cx="58" cy="11.8" r="1" fill="${COAL}"/><circle cx="62.6" cy="11.8" r="1" fill="${COAL}"/><ellipse cx="64.4" cy="13.2" rx="1.3" ry=".8" fill="${PINK}" opacity=".8"/>
  <path d="M54 9 Q56 0 64 3 Q60 4 58 9 Z" fill="${XRED}"/><path d="M55 3 Q50 4 50 9" stroke="${XRED}" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="49.6" cy="10" r="2.4" fill="#fff"/><rect x="53.4" y="8" width="13" height="3" rx="1.5" fill="#fff"/>
  <path d="M30 28 L84 28 C90 28 92 34 88 39 L38 43 C30 43 27 36 30 28 Z" fill="${XRED}"/><path d="M33 31 L84 31" stroke="${XGOLD}" stroke-width="1.6"/><path d="M30 28 Q24 22 28 18 Q32 20 31 25" stroke="${XRED}" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M40 43 L40 50 M76 41 L76 50" stroke="${XGOLD2}" stroke-width="2"/><path d="M24 50 L86 50 Q94 50 92 43" stroke="${XGOLD2}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
const xmasFiles = {
  // The card corner: holly from the top-right corner, its berries on the corner (one is her pink).
  "holly.svg": svg(60, 60, `${at(33, 12, -10, .78, holly(), 10)}${at(48, 31, -78, .72, holly(HOLLY), 10)}${at(43, 20, -42, .5, holly("#3FAE6E"), 10)}${berry(50, 12, 4.4)}${berry(56.6, 15.6, 3.8, XRED)}${berry(51.6, 19, 3.6, PINK)}`),
  "ornament.svg": svg(40, 70, ornament(PINK, "#fff", "#FFD1E1")),
  "ornament-red.svg": svg(40, 70, ornament(XRED, XGOLD, "#FF8FB8")),
  "bell.svg": svg(40, 70, bell),
  "cane.svg": svg(20, 28, cane),
  "hat.svg": svg(80, 56, santaHat),
  "lights.svg": svg(400, 26, lights(true), ` preserveAspectRatio="none"`),
  "lights-still.svg": svg(400, 26, lights(false), ` preserveAspectRatio="none"`),
  "snowman.svg": svg(60, 56, snowman),
  "tree.svg": svg(220, 120, treeScene),
  "bough-hero.svg": svg(90, 90, bough),
  "snowflake.svg": svg(24, 24, flier("#7FB8E6")),
  "snowflake-pink.svg": svg(24, 24, flier("#FF7FAE")),
  "snowflake-lilac.svg": svg(24, 24, flier("#B79BE6")),
  "sleigh.svg": svg(150, 60, sleigh, ` overflow="visible"`),
  // The page's wallpaper tile, faint: snowflakes, little trees, stars and pink dots between the cards.
  "pattern.svg": svg(200, 200, `<g opacity=".16">${flake(40, 40, 16, "#2F6FA8", 2.4)}${flake(150, 140, 13, "#2F6FA8", 2.2)}${flake(100, 92, 8, "#2F6FA8", 1.8)}
    <path d="M154 22 L170 50 L138 50 Z M154 38 L172 66 L136 66 Z" fill="${PINE}"/><rect x="151" y="66" width="6" height="8" fill="#7A4A22"/><path d="M40 136 L52 158 L28 158 Z M40 148 L54 170 L26 170 Z" fill="${PINE}"/>
    ${star(96, 168, 7, XGOLD2)}${star(186, 96, 5, XGOLD2)}<g fill="${PINK}">${[[110, 34, 2.4], [70, 104, 2], [16, 96, 1.6], [190, 184, 1.8], [124, 196, 1.4]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join("")}</g></g>`),
};
for (const [f, s] of Object.entries(xmasFiles)) fs.writeFileSync(path.join(XMAS, f), s);
console.log("icons/season/christmas:", Object.keys(xmasFiles).join(", "));
