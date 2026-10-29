// Seasonal versions of the app button: the pink bow of icons/icon.svg (always pink: it is Sofia's colour), dressed for each theme in
// js/seasons.js. Writes icons/season/<id>.svg; tools/season-icons.py rasterizes them to <id>-180.png (the iPhone
// home-screen size). Run both after changing a design:
//   node tools/season-icons.cjs && python -I tools/season-icons.py
// Shapes only (no text, no emoji): MuPDF and iOS draw them the same.
const fs = require("fs"); const path = require("path");
const OUT = path.join(__dirname, "..", "icons", "season"); fs.mkdirSync(OUT, { recursive: true });

// The bow, drawn around (0,0) like icons/icon.svg. c = { main, light, tail, knot, spark1, spark2 }.
const bow = (c) => `
    <path d="M-28 30 L-88 168 L-40 150 L-8 60 Z" fill="${c.tail}"/>
    <path d="M28 30 L88 168 L40 150 L8 60 Z" fill="${c.tail}"/>
    <path d="M-28 30 L-60 128 L-40 150 L-8 60 Z" fill="${c.knot}" opacity=".55"/>
    <path d="M28 30 L60 128 L40 150 L8 60 Z" fill="${c.knot}" opacity=".55"/>
    <path d="M-10 0 C-70 -110 -190 -110 -178 -20 C-170 40 -80 60 -10 20 Z" fill="${c.main}"/>
    <path d="M10 0 C70 -110 190 -110 178 -20 C170 40 80 60 10 20 Z" fill="${c.main}"/>
    <path d="M-30 -6 C-70 -70 -140 -80 -150 -30 C-146 10 -80 30 -30 12 Z" fill="${c.light}" opacity=".7"/>
    <path d="M30 -6 C70 -70 140 -80 150 -30 C146 10 80 30 30 12 Z" fill="${c.light}" opacity=".7"/>
    <ellipse cx="0" cy="8" rx="34" ry="30" fill="${c.knot}"/>
    <ellipse cx="-6" cy="0" rx="14" ry="10" fill="${c.light}" opacity=".8"/>`;

const star4 = (x, y, r, fill) => `<path d="M${x} ${y - r} L${x + r * .28} ${y - r * .28} L${x + r} ${y} L${x + r * .28} ${y + r * .28} L${x} ${y + r} L${x - r * .28} ${y + r * .28} L${x - r} ${y} L${x - r * .28} ${y - r * .28} Z" fill="${fill}"/>`;
const star5 = (x, y, r, fill) => { const p = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5; const rr = i % 2 ? r * .45 : r; p.push(`${(x + rr * Math.cos(a)).toFixed(1)} ${(y + rr * Math.sin(a)).toFixed(1)}`); } return `<path d="M${p.join(" L")} Z" fill="${fill}"/>`; };
const heart = (x, y, s, fill, rot = 0) => `<path transform="translate(${x} ${y}) rotate(${rot}) scale(${s})" d="M0 12 C-22 -4 -16 -24 0 -12 C16 -24 22 -4 0 12 Z" fill="${fill}"/>`;
const flake = (x, y, r, stroke) => { let s = ""; for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; const x2 = x + r * Math.cos(a), y2 = y + r * Math.sin(a); s += `<line x1="${x}" y1="${y}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${stroke}" stroke-width="${(r / 6).toFixed(1)}" stroke-linecap="round"/>`; const bx = x + r * .62 * Math.cos(a), by = y + r * .62 * Math.sin(a); for (const d of [-.6, .6]) s += `<line x1="${bx.toFixed(1)}" y1="${by.toFixed(1)}" x2="${(bx + r * .3 * Math.cos(a + d)).toFixed(1)}" y2="${(by + r * .3 * Math.sin(a + d)).toFixed(1)}" stroke="${stroke}" stroke-width="${(r / 8).toFixed(1)}" stroke-linecap="round"/>`; } return s; };
const burst = (x, y, r, colors) => { let s = ""; for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; s += `<line x1="${(x + r * .35 * Math.cos(a)).toFixed(1)}" y1="${(y + r * .35 * Math.sin(a)).toFixed(1)}" x2="${(x + r * Math.cos(a)).toFixed(1)}" y2="${(y + r * Math.sin(a)).toFixed(1)}" stroke="${colors[i % colors.length]}" stroke-width="7" stroke-linecap="round"/>`; } return s + `<circle cx="${x}" cy="${y}" r="6" fill="${colors[0]}"/>`; };
const dots = (list) => list.map(([x, y, r, f]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${f}"/>`).join("");
const leaf = (x, y, s, rot, fill, vein) => `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})"><path d="M0 -40 C26 -26 30 10 0 40 C-30 10 -26 -26 0 -40 Z" fill="${fill}"/><line x1="0" y1="-34" x2="0" y2="46" stroke="${vein}" stroke-width="4" stroke-linecap="round"/><line x1="0" y1="-6" x2="14" y2="-18" stroke="${vein}" stroke-width="3"/><line x1="0" y1="8" x2="-14" y2="-4" stroke="${vein}" stroke-width="3"/></g>`;
const pumpkin = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-6" y="-46" width="12" height="18" rx="4" fill="#4E7A2B"/><ellipse cx="-24" cy="0" rx="26" ry="34" fill="#E8742A"/><ellipse cx="24" cy="0" rx="26" ry="34" fill="#E8742A"/><ellipse cx="0" cy="0" rx="26" ry="36" fill="#FF8A3D"/><path d="M-20 -6 L-10 -16 L-2 -6 Z M20 -6 L10 -16 L2 -6 Z" fill="#3A1E0E"/><path d="M-20 10 Q0 26 20 10 Q0 18 -20 10 Z" fill="#3A1E0E"/></g>`;
const bat = (x, y, s, fill) => `<path transform="translate(${x} ${y}) scale(${s})" d="M0 -6 C6 -14 10 -12 12 -6 C20 -18 34 -16 40 -4 C30 -6 26 2 22 8 C18 2 12 4 8 10 C4 6 2 4 0 6 C-2 4 -4 6 -8 10 C-12 4 -18 2 -22 8 C-26 2 -30 -6 -40 -4 C-34 -16 -20 -18 -12 -6 C-10 -12 -6 -14 0 -6 Z" fill="${fill}"/>`;
const tulip = (x, y, s, fill, dark) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 0 Q-3 30 0 60" stroke="#4E9A4B" stroke-width="6" fill="none"/><path d="M0 40 Q-20 30 -24 14 Q-8 22 0 40 Z" fill="#5DB35A"/><path d="M-18 -30 Q-20 0 0 4 Q20 0 18 -30 L9 -18 L0 -34 L-9 -18 Z" fill="${fill}"/><path d="M0 -34 L-9 -18 Q-6 -2 0 4 Q6 -2 9 -18 Z" fill="${dark}"/></g>`;
const mimosa = (x, y) => dots([[x, y, 9, "#F7C934"], [x + 14, y - 8, 8, "#F9D85A"], [x + 10, y + 12, 8, "#F2B705"], [x - 12, y + 10, 7, "#F9D85A"], [x + 24, y + 6, 6, "#F7C934"]]);
const balloon = (x, y, s, fill, shine) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 40 Q-8 70 4 96" stroke="#B48AA0" stroke-width="3" fill="none"/><ellipse cx="0" cy="0" rx="30" ry="38" fill="${fill}"/><path d="M-6 36 L6 36 L0 44 Z" fill="${fill}"/><ellipse cx="-10" cy="-14" rx="7" ry="11" fill="${shine}" opacity=".7"/></g>`;
const sun = (x, y, r) => { let s = ""; for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5; s += `<line x1="${(x + r * 1.25 * Math.cos(a)).toFixed(1)}" y1="${(y + r * 1.25 * Math.sin(a)).toFixed(1)}" x2="${(x + r * 1.65 * Math.cos(a)).toFixed(1)}" y2="${(y + r * 1.65 * Math.sin(a)).toFixed(1)}" stroke="#FFB627" stroke-width="9" stroke-linecap="round"/>`; } return s + `<circle cx="${x}" cy="${y}" r="${r}" fill="#FFC94D"/>`; };
const holly = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 0 C-14 -10 -30 -6 -44 -18 C-40 -6 -46 2 -40 10 C-28 4 -14 12 0 0 Z" fill="#2F8F5B"/><path d="M0 0 C14 -10 30 -6 44 -18 C40 -6 46 2 40 10 C28 4 14 12 0 0 Z" fill="#257A4C"/>${dots([[-6, -4, 8, "#D62839"], [7, -6, 8, "#E63946"], [0, 7, 8, "#C1121F"]])}</g>`;

const PINK = { main: "#FF5C93", light: "#FF8FB8", tail: "#FF3D8A", knot: "#E0246F" };
// Halloween's extras: a corner web, a friendly spider and a witch hat with her pink band (as in tools/season-deco.cjs).
function webTL(size, stroke){ const rays = [0, 22, 45, 68, 90].map(a => a * Math.PI / 180); let s = ""; for (const a of rays) s += `<line x1="0" y1="0" x2="${(size * Math.cos(a)).toFixed(1)}" y2="${(size * Math.sin(a)).toFixed(1)}"/>`; for (const k of [.34, .6, .86]) { let d = ""; rays.forEach((a, i) => { const x = size * k * Math.cos(a), y = size * k * Math.sin(a); if (!i) d += `M${x.toFixed(1)} ${y.toFixed(1)}`; else { const pa = rays[i - 1]; d += ` Q${(size * k * .86 * Math.cos((a + pa) / 2)).toFixed(1)} ${(size * k * .86 * Math.sin((a + pa) / 2)).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`; } }); s += `<path d="${d}"/>`; } return `<g stroke="${stroke}" stroke-width="3" fill="none" stroke-linecap="round">${s}</g>`; }
const spiderAt = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})"><g stroke="#B79BE6" stroke-width="2.4" stroke-linecap="round" fill="none"><path d="M-6 -2 Q-14 -10 -19 -4"/><path d="M-7 1 Q-16 -2 -20 4"/><path d="M-7 4 Q-15 6 -18 12"/><path d="M-5 6 Q-11 12 -12 17"/><path d="M6 -2 Q14 -10 19 -4"/><path d="M7 1 Q16 -2 20 4"/><path d="M7 4 Q15 6 18 12"/><path d="M5 6 Q11 12 12 17"/></g><ellipse cx="0" cy="2" rx="9" ry="10" fill="#B79BE6"/><circle cx="-3.4" cy="0" r="3" fill="#fff"/><circle cx="3.4" cy="0" r="3" fill="#fff"/><circle cx="-3" cy=".6" r="1.4" fill="#1A0F29"/><circle cx="3.8" cy=".6" r="1.4" fill="#1A0F29"/><ellipse cx="-5.6" cy="5" rx="1.8" ry="1.1" fill="#FF5C93"/><ellipse cx="5.6" cy="5" rx="1.8" ry="1.1" fill="#FF5C93"/></g>`;
const witchHat = (x, y, s) => `<g transform="translate(${x} ${y}) rotate(-12 40 28) scale(${s})"><path d="M8 46 Q40 38 72 46 Q40 54 8 46 Z" fill="#1A0F29"/><path d="M22 44 L36 6 Q38 0 44 4 L52 14 Q46 12 44 16 L58 44 Q40 48 22 44 Z" fill="#4B2A6E"/><path d="M24 38 Q40 42 56 38 L58 44 Q40 48 22 44 Z" fill="#FF5C93"/><rect x="35" y="37.5" width="10" height="7" rx="1.5" fill="none" stroke="#F4C86A" stroke-width="2"/><path d="M36 6 Q38 0 44 4 L52 14 Q46 12 44 16 Z" fill="#1A0F29"/><circle cx="51" cy="13" r="2.2" fill="#F4C86A"/></g>`;
const T = {
  default:    { bg: "#FFF7FA", ring: "#FFD1E1", c: PINK, extra: star4(406, 122, 26, "#F4C86A") + star4(90, 372, 18, "#C9A7F5") },
  halloween:  { bg: "#2E1B45", ring: "#FF8A3D", c: PINK,
                pre: `<circle cx="386" cy="126" r="58" fill="#FFE7A3"/>` + bat(380, 128, 1.15, "#2E1B45") + webTL(150, "#C9B6E8") + `<line x1="176" y1="10" x2="176" y2="92" stroke="#C9B6E8" stroke-width="2.5"/>` + spiderAt(176, 108, 1.9),
                post: witchHat(172, 150, 2.1),
                extra: pumpkin(112, 398, 1.05) + bat(410, 300, .7, "#9A7BD0") },
  fall:       { bg: "#FFF3E0", ring: "#F2A65A", c: PINK,
                extra: leaf(110, 118, 1.15, -30, "#F59F00", "#B8730A") + leaf(404, 132, 1.0, 35, "#D9480F", "#8A2D08") + leaf(400, 392, .9, 150, "#A63A12", "#5E1F08") + leaf(104, 400, .8, -140, "#E8A33D", "#9C6512") },
  christmas:  { bg: "#FDF6F0", ring: "#2F8F5B", c: PINK,
                extra: holly(256, 250, 1.0) + star5(256, 70, 30, "#F4C86A") + flake(96, 130, 26, "#7FB8E6") + flake(420, 380, 22, "#7FB8E6") + flake(410, 140, 16, "#A9D2F2") },
  newyear:    { bg: "#1E1B4B", ring: "#F4C86A", c: PINK,
                pre: burst(110, 130, 62, ["#FF5C93", "#7FD3FF", "#F4C86A"]) + burst(410, 118, 50, ["#B9F18C", "#FF8FB8", "#FFFFFF"]) + burst(420, 392, 42, ["#7FD3FF", "#F4C86A"]),
                extra: dots([[96, 300, 6, "#FF5C93"], [130, 420, 5, "#7FD3FF"], [380, 300, 5, "#FFFFFF"], [200, 450, 4, "#F4C86A"], [330, 452, 5, "#FF8FB8"]]) },
  winter:     { bg: "#EAF6FF", ring: "#9AD2F5", c: PINK,
                extra: flake(104, 124, 34, "#FFFFFF") + flake(104, 124, 30, "#7FB8E6") + flake(410, 126, 26, "#7FB8E6") + flake(414, 392, 30, "#7FB8E6") + flake(96, 394, 20, "#A9D2F2") },
  valentines: { bg: "#FFF0F5", ring: "#FF5C93", c: PINK,
                extra: heart(104, 124, 1.9, "#FF5C93", -18) + heart(410, 122, 1.5, "#FF8FB8", 16) + heart(410, 396, 1.7, "#E8285A", 10) + heart(100, 396, 1.3, "#FFB3C8", -12) },
  womensday:  { bg: "#F6F0FF", ring: "#9B7BEA", c: PINK,
                extra: tulip(104, 344, 1.2, "#FF5C93", "#E0246F") + tulip(150, 372, .95, "#F7C934", "#E0A800") + mimosa(388, 110) + mimosa(410, 150) + tulip(410, 352, 1.05, "#C4B5FD", "#8B5CF6") },
  aprilfools: { bg: "#FFF7FA", ring: "#7FD3FF", flip: true, c: PINK,
                extra: dots([[96, 120, 9, "#7FD3FF"], [120, 400, 8, "#B9F18C"], [414, 130, 10, "#F4C86A"], [404, 404, 8, "#C9A7F5"], [70, 260, 6, "#FF8A3D"], [446, 260, 6, "#7FD3FF"]]) },
  summer:     { bg: "#FFF8DB", ring: "#FFC94D", c: PINK,
                pre: sun(398, 120, 44),
                extra: `<path d="M84 412 Q106 394 128 412 T172 412 T216 412 T260 412 T304 412 T348 412 T392 412 T430 410" stroke="#38B6D9" stroke-width="12" fill="none" stroke-linecap="round"/><path d="M120 446 Q142 428 164 446 T208 446 T252 446 T296 446 T340 446 T392 444" stroke="#7FD3FF" stroke-width="10" fill="none" stroke-linecap="round"/>` },
  july4:      { bg: "#F5F8FF", ring: "#2F5BD3", c: PINK,
                pre: burst(108, 126, 56, ["#E63946", "#2F5BD3", "#E63946"]) + burst(408, 120, 48, ["#2F5BD3", "#E63946"]),
                extra: star5(410, 392, 26, "#2F5BD3") + star5(104, 396, 22, "#E63946") + star5(256, 76, 20, "#2F5BD3") },
  birthday:   { bg: "#FFF7FA", ring: "#FF5C93", c: PINK,
                pre: balloon(104, 120, 1.15, "#7FD3FF", "#FFFFFF") + balloon(410, 112, 1.05, "#F4C86A", "#FFFFFF") + balloon(424, 230, .8, "#C9A7F5", "#FFFFFF"),
                extra: dots([[90, 330, 6, "#FF8A3D"], [130, 420, 6, "#B9F18C"], [380, 420, 6, "#7FD3FF"], [430, 330, 5, "#FF5C93"], [256, 456, 5, "#C9A7F5"]]) },
};

for (const [id, t] of Object.entries(T)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <!-- Sofia's Spotlight button, ${id} theme (tools/season-icons.cjs) -->
  <defs><clipPath id="c"><circle cx="256" cy="256" r="244"/></clipPath></defs>
  <circle cx="256" cy="256" r="248" fill="${t.bg}"/>
  <g clip-path="url(#c)">${t.pre || ""}
  <g transform="translate(256 ${t.flip ? 250 : 268}) scale(.86)${t.flip ? " rotate(180)" : ""}">${bow(t.c)}
  </g>
  ${t.post || ""}
  ${t.extra || ""}</g>
  <circle cx="256" cy="256" r="248" fill="none" stroke="${t.ring}" stroke-width="12"/>
</svg>
`;
  fs.writeFileSync(path.join(OUT, id + ".svg"), svg);
}
console.log("icons/season:", Object.keys(T).join(", "));
