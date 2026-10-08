// Color schemes Sofia can pick on Me (settings.palette). Applied as data-palette on <html>; the CSS variables do the rest.
import { $, expose } from "./util.js";
import { S, setSettings } from "./store.js";

export const PALETTES = [["blush", "🌸 Blush"], ["ocean", "🌊 Ocean"], ["mint", "🍃 Mint"], ["sunset", "🌅 Sunset"], ["grape", "🍇 Grape"]];
export const currentPalette = () => PALETTES.some(p => p[0] === S.settings.palette) ? S.settings.palette : "blush";
export function applyPalette(){ const p = currentPalette(); const h = document.documentElement; if (!h || !h.setAttribute) return; if (p === "blush") h.removeAttribute("data-palette"); else h.setAttribute("data-palette", p); }
export function renderPaletteRow(){ const el = $("#paletteRow"); if (!el) return; const cur = currentPalette(); el.innerHTML = PALETTES.map(([k, n]) => `<button class="chip ${cur === k ? "coral" : ""}" onclick="setPalette('${k}')">${n}</button>`).join(""); }
async function setPalette(k){ await setSettings({ palette: PALETTES.some(p => p[0] === k) ? k : "blush" }); applyPalette(); renderPaletteRow(); }
expose({ setPalette });
