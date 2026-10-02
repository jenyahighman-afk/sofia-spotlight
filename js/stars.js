// Stars: every game pays 1–3 stars per play (plus a first-play-of-the-day bonus); stars unlock avatar looks on Me.
// Pure parts (starsFor, unlocks, nextUnlock) are tested in Node. settings.stars = total, settings.starLog = {date: {game: plays}}.
import { S, setSettings } from "./store.js";
import { toast, todayStr } from "./util.js";

// How many stars a result earns. Kept generous at the bottom: finishing anything earns one.
export function starsFor(game, value){
  const v = +value || 0;
  switch (game) {
    case "sparkle": return v >= 1000 ? 3 : v >= 500 ? 2 : 1;
    case "oops":    return v >= 9 ? 3 : v >= 7 ? 2 : 1;
    case "compday": return v >= 84 ? 3 : v >= 70 ? 2 : 1;
    case "choreo":  return v >= 84 ? 3 : v >= 74 ? 2 : 1;
    case "trio":    return v >= 84 ? 3 : v >= 74 ? 2 : 1;
    case "mirror":  return v >= 250 ? 3 : v >= 120 ? 2 : 1;
    case "along":   return v >= 80 ? 3 : v >= 50 ? 2 : 1; // % in step with the video
    case "practice": return v >= 100 ? 2 : 1; // a finished practice day
    default: return 1;
  }
}
// Avatar looks that stars unlock: [option group, value, stars needed, label]. Everything not listed is free.
export const UNLOCKS = [
  ["leo", "#FFD23F", 10, "Gold leotard"], ["acc", "flower", 20, "Flower"], ["hair", "#C9A7F5", 35, "Lilac hair"],
  ["leo", "#2ED3C8", 50, "Aqua leotard"], ["hairStyle", "braids", 70, "Braids"], ["leo", "#1F1A1A", 90, "Black leotard"], ["eyes", "#7B5CFF", 120, "Violet eyes"],
];
export const totalStars = () => +S.settings.stars || 0;
export const isUnlocked = (group, value, stars = totalStars()) => { const u = UNLOCKS.find(x => x[0] === group && x[1] === value); return !u || stars >= u[2]; };
export function nextUnlock(stars = totalStars()){ return UNLOCKS.filter(u => u[2] > stars).sort((a, b) => a[2] - b[2])[0] || null; }
export function unlockedList(stars = totalStars()){ return UNLOCKS.filter(u => u[2] <= stars); }

// Award stars for a finished game. The first play of each game each day earns +1 extra. Returns what was paid.
export async function awardStars(game, value, label){
  const earned = starsFor(game, value); const date = todayStr(); const log = { ...(S.settings.starLog || {}) }; const day = { ...(log[date] || {}) };
  const first = !day[game]; day[game] = (day[game] || 0) + 1; log[date] = day;
  for (const k of Object.keys(log)) if (k < date && Object.keys(log).length > 14) delete log[k]; // keep the log small
  const bonus = first ? 1 : 0; const before = totalStars(); const after = before + earned + bonus;
  await setSettings({ stars: after, starLog: log });
  const u = UNLOCKS.find(x => x[2] > before && x[2] <= after);
  try { toast(`⭐ +${earned + bonus} star${earned + bonus === 1 ? "" : "s"}${first ? " (first play today!)" : ""}${label ? " · " + label : ""}${u ? ` · 🎁 ${u[3]} unlocked!` : ""}`, u ? 4000 : 2600); } catch (e) {}
  return { earned, bonus, total: after, unlocked: u ? u[3] : null };
}
