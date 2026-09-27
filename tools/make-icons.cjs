// Rasterizes icons/icon.svg into the PNG sizes the manifest and iOS need. One-off; needs `npm i sharp` somewhere on the path.
// Usage: node tools/make-icons.cjs [path-to-node_modules-with-sharp]
const fs = require("fs"); const path = require("path");
const extra = process.argv[2]; if (extra) module.paths.unshift(path.resolve(extra));
const sharp = require("sharp");
const ROOT = path.join(__dirname, "..");
const svg = fs.readFileSync(path.join(ROOT, "icons", "icon.svg"));
(async () => {
  for (const size of [180, 192, 512]) {
    await sharp(svg, { density: 384 }).resize(size, size).png().toFile(path.join(ROOT, "icons", `icon-${size}.png`));
    console.log("icon-" + size + ".png");
  }
  // Maskable: full-bleed cream square, bow inside the safe zone (80% of the canvas).
  const inner = await sharp(svg, { density: 384 }).resize(400, 400).png().toBuffer();
  await sharp({ create: { width: 512, height: 512, channels: 4, background: "#FFF7FA" } }).composite([{ input: inner, left: 56, top: 56 }]).png().toFile(path.join(ROOT, "icons", "icon-512-maskable.png"));
  console.log("icon-512-maskable.png");
})();
