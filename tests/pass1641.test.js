// 1.64.1: the in-app Backstage Pass says what the app asks since 1.60.0 and where things are since 1.61.0 (Jenya, Nov 5).
// The printed Pass keeps its Nov 2 words (no more reprints), so the two differ on purpose where the app asks less.
// Reads files only: no clock, no weekday, no timezone.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const src = (f) => readFileSync(new URL("../" + f, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const pass = JSON.parse(src("data/pass.json")), part = (id) => pass.parts.find(p => p.id === id);
const kid = [...pass.parts.flatMap(p => [p.n, ...p.lines, p.check.q, ...p.check.a, p.check.yay, p.check.hint]), ...pass.tips.map(t => t.t)].join("\n");

test("the week: class days ask nothing at home, a home day asks one thing she picks, the whole session is offered", () => {
  const week = part("week").lines, day = (d) => week.find(l => l.startsWith(d + " · "));
  for (const d of ["Mon", "Tue", "Wed", "Sat"]) assert.match(day(d), /No home practice/, d);
  for (const d of ["Thu", "Fri", "Sun"]) assert.match(day(d), /Home day: pick one thing/, d);
  assert.ok(week.some(l => /📋 The whole session\. It's there when you want it\./.test(l)));
  assert.equal(part("week").check.a[part("week").check.ok], "Thu, Fri, Sun"); assert.match(part("week").check.hint, /Mon, Tue, Wed and Sat are class days/);
  assert.match(src("js/views/home.js"), /studio: "No home practice on class days\."/, "the app's own words on a class day"); assert.match(src("js/views/home.js"), /home: "Pick one thing, about 10 minutes\. That's all\."/);
});

test("nothing in it asks for more than the app does", () => {
  assert.doesNotMatch(kid, /memory run|never more than 2 days|then free time|Plan first|timer be the boss|in your head in the car|streak|days? off/i);
  assert.match(part("goal").lines.at(-1), /the count only goes up/);
  const c = part("time").check; assert.equal(c.a[c.ok], "Every day"); assert.match(c.q, /countdown door and the games/); assert.match(part("time").lines.join(" "), /Play is a button on Me\./);
  assert.match(part("sleep").lines.join(" "), /Late studio nights \(Mon, Tue\): dinner, shower, bed\./);
});

test("it names things where they live now: four tabs, the two big buttons, the whole session, Skills", () => {
  assert.match(part("crew").lines[1], /Four tabs at the bottom: Today, Dances, Skills and Me\./); assert.match(part("crew").lines[1], /▶ My solo and ▶ My trio open the practice player/);
  assert.match(part("crew").lines.at(-1), /go with the app/, "the paper was printed first");
  const grab = part("grab").lines.join(" ");
  for (const s of ["▶ My solo on Today", "On Today tap 📋 The whole session, then ▶ Start practice", "📹 Videos on Today has Hannah's videos", "🪞 Mirror", "📝 Fix here in the practice player", "Tap Skills (the third tab at the bottom)", "⭐ My skill this month"]) assert.ok(grab.includes(s), s);
  assert.doesNotMatch(kid, /in Me, Skills|\(on Practice\)/, "the old places are gone");
  const html = src("index.html"), home = src("js/views/home.js");
  for (const [f, s] of [[html, "▶ Start practice</button>"], [html, "🎬 Coach corner</button>"], [html, 'id="plFixHere">📝 Fix here</button>'], [html, 'id="hvMirror"'], [home, "📹 Videos</button>"], [home, "📋 The whole session"], [src("js/monthskill.js"), "⭐ My skill this month"]]) assert.ok(f.includes(s), "the app has: " + s);
  assert.match(src("js/version.js"), /APP_VERSION = "1\.(64\.[1-9]|6[5-9]|[7-9]\d)/); assert.match(src("README.md"), /\*\*1\.64\.1:\*\* the in-app Backstage Pass/);
});

test("the tips: a class-day line and a one-dance line, every tip still names its part", () => {
  const tip = (re) => pass.tips.find(t => re.test(t.t));
  assert.deepEqual(tip(/^Class day: class is your dancing today/).when, ["studio"]); assert.deepEqual(tip(/^Tap ▶ My solo on Today/).when, ["home"]);
  assert.match(tip(/Coach corner/).t, /Today, then 📋 The whole session/);
  assert.ok(pass.tips.every(t => pass.parts.some(p => p.id === t.part)));
});
