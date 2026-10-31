// The Backstage Pass keeps up with the app (Build 4, Part B, Oct 29). Every README feature — each "### " heading from
// "AI coach" to "Skills, badges, streaks", and inside the "### Build N" sections each bold lead (a bold that opens a
// paragraph or a sentence and starts with a capital: **The Sunday sheet.**, **Checkpoints as goals.**, **Mom's card** …) —
// is either named in Sofia's own words in data/pass.json (the parts' lines and checks and the tips, never the _note: a
// phrase from PHRASES) or allowed out here with a one-word reason (ALLOW: grown-up · self-explaining · spring). A new
// heading or lead fails by name until the Pass says it or this list says why not; the list lives here, not in the kid file.
// Beside it: the Toolkit's page count (its <!-- PAGE n --> markers) is the count both Pass sources name, the printed Pass
// lists every Toolkit page, the six binder dividers of the printed Pass are in both, and the sentences the two Passes
// share read the same. Reads files only: no clock, no weekday, no timezone.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const src = (f) => readFileSync(new URL("../" + f, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const readme = src("README.md"), pass = JSON.parse(src("data/pass.json"));
const html = src("tools/print/Sofia-Backstage-Pass.html"), toolkit = src("tools/print/Sofia-Practice-Toolkit.html");

// What Sofia reads in the app: the parts (name, lines, check) and the Bunny's tips.
const kid = [...pass.parts.flatMap(p => [p.n, ...p.lines, p.check.q, ...p.check.a, p.check.yay, p.check.hint]), ...pass.tips.map(t => t.t)].join("\n");
// The printed Pass as text: no comments, style or script; tags out; &amp; back to &.
const paper = html.replace(/<!--[\s\S]*?-->/g, " ").replace(/<(style|script)[\s\S]*?<\/\1>/g, " ").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&");

// A heading or lead → its key: the name before a colon or dash, no (…) or `code`, no emoji or punctuation, no leading "the".
const keyOf = (s) => s.replace(/\s*[:—].*$/s, "").replace(/\([^)]*\)/g, " ").replace(/[’'"`]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim().toLowerCase().replace(/^the /, "").replace(/\s+/g, "-");
function readmeFeatures(md){
  const from = md.indexOf("### AI coach"), last = md.indexOf("### Skills, badges, streaks"), to = md.indexOf("\n## ", last);
  assert.ok(from >= 0 && last > from && to > last, "the README's feature list runs from AI coach to Skills, badges, streaks");
  const out = [];
  for (const sec of md.slice(from, to).split(/^(?=### )/m)) {
    const head = sec.match(/^### (.+)$/m)[1];
    if (!/^Build \d/.test(head)) { out.push({ name: head, key: keyOf(head) }); continue; }
    // A Build section is a container: its leads are the features (a version note like **1.47.1:** is not one).
    const lead = /(?:^|[.;!?]\s+)\*\*([^*]+?)\*\*/gm; const body = sec.slice(sec.indexOf("\n")); let m;
    while ((m = lead.exec(body))) { const t = m[1].trim(); if (/^[A-Z]/.test(t)) out.push({ name: `${head.split(" (")[0]} › ${t}`, key: keyOf(t.replace(/[.:]$/, "")) }); }
  }
  return out;
}

// Covered: the key → words Sofia reads in data/pass.json.
const PHRASES = {
  "solo-and-trio-first": "the solo and the trio come first",
  "solos-cue-table-cue-cards-and-memorize-mode": "🧠 Memorize",
  "15-week-plan-teacher-homework-studio-dates": "Own it",
  "practice-rules-from-the-research": "two videos in a row",
  "today-one-card-one-button": "⭐ Plan done",
  "today-fits-one-screen": "Spotlight app = TODAY",
  "checkpoints-as-goals": "✓ Made it",
  "solo-readiness-bars": "How ready?",
  "backstage-pass-in-the-app": "Backstage Pass",
  "one-memorize-path": "🧠 Memorize",
  "paper": "page 2b",
  "sunday-sheet": "Sunday sheet",
  "extras-on-play": "✨ Extras",
  "weeks-fix-and-the-sunday-sheet-live-in-the-plan-week": "Sunday sheet",
  "checkpoints": "✓ Made it",
  "readiness": "How ready?",
  "pass": "Backstage Pass",
  "two-tiers-of-done": "⭐ Plan done",
  "daily-practice-plan": "▶ Start practice",
  "practice-mode": "▶ Start practice",
  "todays-plan": "It tells you what to do today",
  "memorize-it": "🧠 Memorize",
  "show-countdown": "countdown door",
  "dance-dares": "the dare",
  "mind-skills-pre-stage-routine-comp-day-fuel": "smell the flower",
  "practice-player": "practice player",
  "corrections-tracker": "＋ Note",
  "progress-lineup": "your photos line up",
  "stars": "stars and games",
};
// Left out on purpose, with one word why: grown-up (Mom's side or set-up), self-explaining (she finds it by tapping),
// spring (after the Showcase; the Pass gets its spring words then).
const ALLOW = {
  "ai-coach": "grown-up", "coach-corner": "grown-up", "skeleton-view": "grown-up", "goals": "self-explaining",
  "spring-plan": "spring", "whats-next": "self-explaining",
  "pinned-notes-close-through-grown-ups": "grown-up", "this-week-for-mom": "grown-up", "nudges-that-follow-the-plan": "grown-up",
  "worker-must-be-redeployed": "grown-up", "dance-along-with-hannahs-videos": "grown-up",
  "one-kind-of-day-for-every-screen": "self-explaining", "second-nudge": "grown-up", "moms-card": "grown-up",
  "plan-items": "self-explaining", "smaller": "self-explaining",
  "quick-sessions": "self-explaining", "run-check": "grown-up", "trick-quest": "self-explaining", "updates": "self-explaining",
  "my-workouts": "self-explaining", "daily-reminder": "grown-up", "moments": "self-explaining", "drill-box": "grown-up",
  "dance-with-a-friend": "self-explaining", "dance-pet": "self-explaining", "talking-helper": "self-explaining",
  "whats-new": "self-explaining", "trick-cards": "self-explaining",
  "costume-designer": "self-explaining", "growing-up-flipbook": "self-explaining", "teach-it": "self-explaining",
  "count-along": "self-explaining", "daily-habit": "self-explaining", "today-in-bites": "self-explaining",
  "scrolling-lines": "self-explaining", "colors": "self-explaining", "seasonal-themes": "self-explaining", "trick-clips": "grown-up",
  "learn-mode-vs-comp-mode": "grown-up", "comp-weekend": "self-explaining", "share-with-the-teacher": "grown-up",
  "mirror": "self-explaining", "dance-along": "self-explaining", "skills-badges-streaks": "self-explaining",
};
const REASONS = new Set(["grown-up", "self-explaining", "spring"]);

test("every README feature is in Sofia's Backstage Pass, or allowed out with a one-word reason", () => {
  const feats = readmeFeatures(readme); assert.ok(feats.length >= 60, `the README's features were found (${feats.length})`);
  assert.ok(feats.some(f => f.key === "sunday-sheet") && feats.some(f => f.key === "checkpoints-as-goals") && feats.some(f => f.key === "moms-card"), "the Build sections' leads are read");
  const missing = feats.filter(f => !(f.key in PHRASES) && !(f.key in ALLOW)).map(f => `"${f.name}" (key ${f.key})`);
  assert.deepEqual(missing, [], "not in the Pass and not allowed out: add a line to data/pass.json and its phrase to PHRASES, or a reason to ALLOW");
  const unsaid = Object.entries(PHRASES).filter(([, p]) => !kid.includes(p)).map(([k, p]) => `${k}: "${p}"`);
  assert.deepEqual(unsaid, [], "a covered feature's words must be in what Sofia reads (lines, checks, tips; not the _note)");
  assert.deepEqual(Object.entries(ALLOW).filter(([, r]) => !REASONS.has(r)), [], "a reason is grown-up, self-explaining or spring");
  assert.deepEqual(Object.keys(PHRASES).filter(k => k in ALLOW), [], "covered or allowed out, not both");
  const keys = new Set(feats.map(f => f.key)); assert.deepEqual([...Object.keys(PHRASES), ...Object.keys(ALLOW)].filter(k => !keys.has(k)), [], "no stale keys: every entry is still a README feature");
});

test("the Toolkit's page count is the one both Passes name, and the printed Pass lists every Toolkit page", () => {
  const pages = [...toolkit.matchAll(/<!-- PAGE (\w+)/g)].map(m => m[1]); assert.ok(pages.length >= 6, `Toolkit pages: ${pages.join(" ")}`);
  const appLine = pass.parts.find(p => p.id === "crew").lines.find(l => l.includes("Practice Toolkit")); assert.ok(appLine, "the crew part names the Toolkit");
  assert.equal(+(appLine.match(/(\d+) pages/) || [])[1], pages.length, "data/pass.json: " + appLine);
  const at = html.indexOf('<article class="helper kit">'), card = html.slice(at, html.indexOf("</article>", at));
  assert.equal(+(card.match(/Paper · (\d+) pages/) || [])[1], pages.length, "the printed Pass's Toolkit card");
  assert.deepEqual(pages.filter(p => !card.includes(`<span class="pg">p.${p}</span>`)), [], "every Toolkit page has its line on the card");
  for (const t of [kid, paper]) assert.match(t, /16 pages, 6 in your binder/, "the Workbook: 16 pages, 6 in the binder");
});

test("the binder's six dividers (from the printed Pass) are in both Passes, in order", () => {
  const at = html.indexOf('<ol class="tabs6">'), binder = html.slice(at, html.indexOf("</ol>", at));
  const tabs = [...binder.matchAll(/<span class="tn">(\d)<\/span>([^<]+)<\/span>/g)].map(m => [+m[1], m[2].trim()]);
  assert.deepEqual(tabs.map(t => t[0]), [1, 2, 3, 4, 5, 6]); assert.match(paper, /Six tabs, in this order/);
  const lines = pass.parts.find(p => p.id === "binder").lines; assert.match(lines[0], /6 tabs, in this order/);
  for (const [n, name] of tabs) assert.ok(lines.some(l => l.startsWith(`${n} · ${name}:`)), `data/pass.json binder: ${n} · ${name}`);
});

test("the sentences the two Passes share read the same (emoji and ★/⭐ aside: paper leaves color emoji out for black ink)", () => {
  const norm = (s) => s.replace(/[\u{1F000}-\u{1FFFF}☀-➿⬀-⯿️]/gu, " ").replace(/\s+/g, " ").toLowerCase();
  const app = norm(kid), print = norm(paper);
  const SHARED = [
    "When the app says ⭐ Plan done, put a sticker on",
    "Dances, your solo, 🧠 Memorize. Chunks plays one piece at a time, Pause & Predict asks what comes next. One 8-count at a time",
    "It walks you and Mom through it: watch the last run, say what went well, then ✓ It showed or Not yet for your one fix.",
    "Your finish lines are on Today's season card and on Toolkit page 1. When you make one, tap ✓ Made it with Mom, then pick a reward",
    "Tap How ready? on Today to see four bars for your solo. Pause & Predict fills Know, fixes that showed fill Clean, your eight tricks fill Tricks, full runs and Sunday films fill Perform.",
    "In the app too: on a home day the solo and the trio come first. The countdown door, the dare and the weekend games open once both are done",
    "Best time on a home day: a small snack after school, dance about 45 minutes later, dinner after. Never right after a big meal: wait 1½–2 hours.",
    "pack your dance bag and put it by the door, help with dinner",
  ];
  for (const s of SHARED) { const n = norm(s); assert.ok(app.includes(n), "app: " + s); assert.ok(print.includes(n), "paper: " + s); }
  assert.doesNotMatch(paper + kid, /make your bed|send it to Coach me|Chunks or Cue cards|Tap Done/i, "the old lines are gone from both");
  assert.ok(/Co Tech · PITCH rehearsal\s+10:00–12:15\s+\+ memory run/.test(paper), "Saturday carries the memory run on paper, like Wednesday");
  assert.ok(pass.parts.find(p => p.id === "week").lines.some(l => /^Sat .*15-minute memory run/.test(l)), "and in the app");
  assert.ok(!/[\u{1F000}-\u{1FFFF}]/u.test(paper), "no color emoji on paper (black-ink printer)");
});
