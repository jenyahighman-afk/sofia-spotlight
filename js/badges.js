// Badges: which ones exist, which are earned (pure evaluation), and awarding them into the `badges` collection.
import { S, storeSet, settled, dances } from "./store.js";
import { CLASSES, AERIAL, PRACTICE_ITEMS } from "./data.js";
import { events } from "./store.js";
import { computeStreak } from "./streak.js";
import { closedCount } from "./corrections.js";
import { todayStr, toast } from "./util.js";

// Automatic badges. `test(ctx)` returns true when earned. ctx = { streak, closed, aerialPct, settings, practice, weekFixPicked }.
export const AUTO_BADGES = [
  { key: "streak3",   emoji: "🔥", label: "3-day streak",          test: c => c.streak >= 3 },
  { key: "streak7",   emoji: "🌟", label: "7-day streak",          test: c => c.streak >= 7 },
  { key: "fix1",      emoji: "✅", label: "First fix closed",      test: c => c.closed >= 1 },
  { key: "fix5",      emoji: "🏅", label: "5 fixes closed",        test: c => c.closed >= 5 },
  { key: "fix10",     emoji: "🏆", label: "10 fixes closed",       test: c => c.closed >= 10 },
  { key: "aerial25",  emoji: "🤸", label: "Aerial mission ¼",      test: c => c.aerialPct >= 25 },
  { key: "aerial50",  emoji: "🤸", label: "Aerial mission ½",      test: c => c.aerialPct >= 50 },
  { key: "aerial75",  emoji: "🤸", label: "Aerial mission ¾",      test: c => c.aerialPct >= 75 },
  { key: "aerial100", emoji: "🦋", label: "AERIAL UNLOCKED",       test: c => c.aerialPct >= 100 },
  { key: "sparkle",   emoji: "🎀", label: "Sparkle 1,000",         test: c => (c.settings.gameBest || 0) >= 1000 },
  { key: "oops",      emoji: "👁️", label: "Judge's eye (9/10)",    test: c => (c.settings.jeBest || 0) >= 9 },
  { key: "compday",   emoji: "🎒", label: "High Gold comp day",    test: c => (c.settings.cdBest || 0) >= 84 },
  { key: "trio",      emoji: "👯", label: "Trio Platinum",         test: c => (c.settings.tfBest || 0) >= 92 },
  { key: "review1",   emoji: "🎬", label: "First film review",     test: c => !!c.weekFixPicked },
  { key: "run100",    emoji: "▶️", label: "First full run at 100%", test: c => c.fullRun },
];
// Parent-awarded badges are stored with keys "nocues-<danceId>" and "clean5-<skillId or trick>".
export const PARENT_BADGES = [
  { key: "nocues", emoji: "🎯", label: "No cues" },
  { key: "clean5", emoji: "5️⃣", label: "Clean 5 in a row" },
];
export function badgeMeta(key){
  const a = AUTO_BADGES.find(b => b.key === key); if (a) return a;
  const p = PARENT_BADGES.find(b => key.startsWith(b.key + "-")); if (p) return p;
  return { key, emoji: "⭐", label: key };
}

export function evalBadges(ctx){ return AUTO_BADGES.filter(b => { try { return !!b.test(ctx); } catch (e) { return false; } }).map(b => b.key); }

export function context(today = todayStr()){
  const aerialDone = (S.settings.aerial || []).filter(id => AERIAL.some(a => a.id === id)).length;
  const fullRun = Object.values(S.practice).some(p => (p.runs || []).some(r => r.speed >= 100 && r.full));
  return {
    streak: computeStreak({ practice: S.practice, classes: CLASSES, events: events(), totalItems: PRACTICE_ITEMS.length, today }),
    closed: closedCount(S.corrections), aerialPct: AERIAL.length ? Math.round(100 * aerialDone / AERIAL.length) : 0,
    settings: S.settings, practice: S.practice, weekFixPicked: !!(S.settings.weekFix && S.settings.weekFix.id), fullRun,
  };
}

let awarding = false; const toastQueue = [];
// Award anything newly earned. Runs after every store change; only once the badges collection is known (so a fresh phone doesn't re-award).
export async function checkBadges(){
  if (awarding || !settled("badges")) return [];
  awarding = true; const won = [];
  try {
    for (const key of evalBadges(context())) { if (S.badges[key]) continue; const m = badgeMeta(key); await storeSet("badges", key, { key, label: m.label, emoji: m.emoji, at: todayStr() }); won.push(key); }
  } catch (e) { console.warn("badges", e); } finally { awarding = false; }
  if (won.length) { toastQueue.push(...won); flushToasts(); }
  return won;
}
function flushToasts(){ const k = toastQueue.shift(); if (!k) return; const m = badgeMeta(k); try { toast(`${m.emoji} Badge: ${m.label}`, 2600); } catch (e) {} if (toastQueue.length) setTimeout(flushToasts, 2800); }

export async function awardParentBadge(kind, target, label){
  const key = `${kind}-${String(target).replace(/[^a-z0-9-]/gi, "").slice(0, 40)}`; const m = PARENT_BADGES.find(b => b.key === kind);
  await storeSet("badges", key, { key, label: `${m ? m.label : kind}: ${label}`, emoji: m ? m.emoji : "⭐", at: todayStr(), parent: true });
  try { toast(`${m ? m.emoji : "⭐"} Badge: ${m ? m.label : kind}`, 2600); } catch (e) {}
  return key;
}
export function earned(){ return Object.values(S.badges).filter(b => !b.deleted).sort((a, b) => (b.at || "").localeCompare(a.at || "")); }
export const danceName = (id) => { const d = dances().find(x => x.id === id); return d ? d.name : id; };
