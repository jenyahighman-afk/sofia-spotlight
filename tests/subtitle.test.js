// Today's subtitle on a home day says what the session holds (1.54.2): plan.planSummary names the parts of the day's plan
// in session order, instead of the weekday's old line from data/home-days.json ("Technique + run" on a Friday whose session
// also had strength, flex, the knee block and a film item). Fixed dates only; nothing reads the clock.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installEnv } from "./_env.mjs";
installEnv();
const json = (f) => JSON.parse(readFileSync(new URL("../data/" + f + ".json", import.meta.url), "utf8"));
const src = (f) => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const { applyData, DATA_FILES } = await import("../js/data.js");
const got = {}; for (const f of DATA_FILES) got[f] = json(f); applyData(got);
const { planSummary, MEMORY_RUN, WATCH_DAY } = await import("../js/plan.js");
const { planFor } = await import("../js/planToday.js");

test("the parts in session order, each once: strength, flex and technique as one group, the solo and trio together, no warm-up", () => {
  assert.equal(planSummary(planFor("2026-11-05")), "Strength, flex, technique · knees · solo + trio · film", "Thursday during Memory + knees");
  assert.equal(planSummary(planFor("2026-11-06")), "Strength, flex, technique · knees · solo + trio · film", "Friday: the same session, no longer 'Technique + run'");
  assert.equal(planSummary(planFor("2026-11-08")), "Strength, flex, technique · knees · solo + trio · film · Sunday review", "Sunday adds the film review");
  assert.equal(planSummary(planFor("2026-11-12")), "Strength, flex, technique · trick · aerial · solo + trio · film · picture it", "after Nov 9: the week's trick, the aerial steps, the show in her head");
  assert.equal(planSummary(planFor("2027-01-28")), "🎧 judges · strength, flex, technique · trick · aerial · solo + trio · picture it", "a judges' week opens with the recordings");
  assert.match(planSummary(planFor("2027-05-27")), /pick-up drill · improv/, "the audition weeks name the pick-up drill and improv");
});

test("short plans and odd lists read sensibly", () => {
  assert.equal(planSummary(MEMORY_RUN), "Solo from the top · this week's chunk · Pause & Predict · picture it", "a light week or the night before: the memory run");
  assert.equal(planSummary(WATCH_DAY), "Hannah's videos · picture it in the car");
  assert.equal(planSummary([]), ""); assert.equal(planSummary(null), "");
  assert.equal(planSummary([{ id: "solo-run", kind: "run" }]), "Solo"); assert.equal(planSummary([{ id: "trio-mark", kind: "run" }]), "Trio");
  assert.equal(planSummary([{ id: "x", kind: "flex" }, { id: "y", kind: "core" }]), "Strength, flex", "the group always reads strength, flex, technique");
  assert.equal(planSummary([{ id: "fix-a", kind: "fix" }, { id: "new-b", kind: "fix" }, { id: "solo-run", kind: "run" }]), "Your fix · solo", "two fixes say it once");
});

test("Today's home-day subtitle comes from the plan, the weekday's old line only if the plan is empty", () => {
  const home = src("js/views/home.js"); assert.match(home, /import \{ planSummary \} from "\.\.\/plan\.js";/);
  assert.match(home, /else if\(hp\)\{ what="🏠 Home practice"; sub=`<div class="today-sub">\$\{esc\(planSummary\(plan\)\|\|hp\)\}<\/div>\$\{pd\?"":`<div class="today-sub today-when">\$\{BEST_TIME\}<\/div>`\}`; \}/);
  assert.match(src("js/version.js"), /APP_VERSION = "1\.(54\.[2-9]|5[5-9]|[6-9]\d)/);
});
