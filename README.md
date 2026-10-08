# Sofia's Spotlight

Sofia's 2026–27 dance-season app: dances, practice player, corrections tracker, skills & badges, home practice, five games — plus everything a parent needs (season events, schedule, packing lists, notes & photos, files, backup) behind a PIN. Installed on two phones and kept in sync live through one shared **family space**. No accounts, no logins: the 24-character family code is the only key.

- **Live site:** https://jenyahighman-afk.github.io/sofia-spotlight/
- **Stack:** static HTML/CSS/JS (ES modules, no build step) · Firebase anonymous auth + Firestore (offline-first) + Firebase Storage · GitHub Pages · service worker (installable, works offline)

## Kid mode vs Grown-ups (since 1.1.0)

Sofia sees five tabs, each built to *do* something with as few words as possible:

| Tab | What's on it |
|---|---|
| **Today** | One card: what's on (studio classes or the home-practice plan), a big **Start** / **Play** button, the countdown to the next event, the practice streak. Below it: this week's fix, then the week strip. |
| **Dances** | One cover card per dance: emoji or the latest photo, song, **▶ Practice** (opens the practice player), **＋ Note** (quick note from class, with voice-to-text where the browser has it), the top three open fixes as chips. Tap a chip → **Show me**: the dancer does the wrong version and the fixed version side by side. Everything text-heavy is under **More ▸** (music map, moments, all corrections, strengths, tricks, costume, links, notes, photos, Edit). |
| **Practice** | The checklist *is* the screen: progress ring, tap to check (saved as you go), confetti at 100%. Notes, the aerial mission, the 15-week plan, safety rules and history sit under accordions. |
| **Play** | A grid of eight game tiles (Choreo Studio, Spot the Oops, What's Next?, Trio Formations, Comp Day, Step & Sparkle, Mirror, Dance Along) with each game's best; tap one to open it, **‹ All games** to come back. |
| **Me** | Avatar (tap = customize, **long-press = Grown-ups**), streak + personal bests, badge case, skill progress rings per style, "notes that keep coming back", and the **Grown-ups 🔒** link at the bottom. |

**Grown-ups** (PIN, default **2027**; change it or switch it off under Grown-ups → PIN) holds: Events (costs, notes, hotels), Schedule (classes, calendar, print, .ics), Lists (to-dos, packing), Notes (notes, files, photos), Skills & awards (teacher-checked skills, "No cues" / "Clean 5 in a row" badges), Coach reviews (placeholder until session 2B), Reports, Settings & backup. The ⚙️ in the header goes through the same gate. The gate stays open for 20 minutes after the PIN is typed. Nothing was deleted from the old tabs; it moved here.

Every screen has an error state ("This screen hit a snag … Send a report") and a small **Something went wrong? Tap to send a report** link at the bottom. Reports land in the `reports` collection and show under Grown-ups → Reports with the last error that phone captured.

### AI coach (🎬 Coach me)
On every dance cover, next to the technique items and aerial drills in Practice, and on every goal's sheet (🎬 Coach me on this). Film or pick a clip (up to 3 minutes, so a full run fits; 1080p at 30 fps is plenty; a run longer than 90 s on a dance with a cue sheet samples 8 even frames plus one just after each cue — start the music right after tapping record) or pick photos on the phone. The app samples 16 frames evenly plus 4 around the loudest moment of the audio, shrinks them to 768 px, draws the skeleton on four of them (on-device, see below) and sends only those stills — never the video — to the coach worker in `worker/` with the dance name and style, its music map, the open corrections and the trick name. The worker adds the fixed coaching prompt (verbatim in `worker/src/core.js`; the app cannot send a prompt, so there is no chat) and returns one review: **One thing you did really well**, **One fix for this week** (one tap turns it into a correction, tag pre-filled, source "AI coach"), a feet/knees/eyes/arms check, and an optional **Try this** drill. Reviews are saved to `reviews` with thumbnails and numbers only, and are listed under Grown-ups → Coach reviews. Limits: 20 reviews per family per day; needs a connection. Until the worker is deployed (`worker/README.md`) and its URL is set in `js/firebase-config.js` → `coachConfig.url`, Coach me still works as a skeleton view and says the coach isn't connected.

### Coach corner (Practice → 🎬 Coach corner)
One place for everything coach: start a review for any dance (chips) or any skill (the ladder skills, Calypso, aerial drills), and look back. Reviews are grouped by dance or skill; each group shows how **feet, knees, eyes and arms** checked out over the last three reviews with a row of dots and an up/down arrow against the three before, the list of **fixes the coach gave** with their state (new → noted → working on it → ✅ got it, following the correction it became), the latest review, and older ones folded away. At the top sits **Solo tricks** (the `solo` group in `data/skills.json`: donut roll, calypso, front walkover to knee, scorpion → needle, cartwheel on the swell, tailbone balance, side extension, floor kick, passé turns): each row has a state circle Sofia taps (learning → clean), the teacher-check ★ with name and date once a grown-up records it under Grown-ups → Skills & awards, a 🎬 button that starts a coach review for that trick, and the latest coach fix for it. The same tricks have drills on the solo card, so they rotate through the daily practice plan. Sofia can see it; the full list with delete stays under Grown-ups → Coach reviews. "Film now" and "Pick a clip from Photos" are separate buttons (a single button forces the camera on iPhones).

### Skeleton view (free, on-device)
MediaPipe Pose Landmarker (Tasks Vision, pinned on jsDelivr; the model file from Google's model store) runs in the browser. On any clip or photo it draws the skeleton and reads out the working-leg knee angle ("Knee: 176° — straight!" at 170° or more), arm height against the shoulder line, shoulder and hip tilt, and the split angle. Only the numbers and thumbnails are stored with a review. The first use needs a connection to fetch the model (~5 MB); after that it is cached. **🪞 Mirror** in Play uses the same tool live on the front camera: hold a relevé for 10 s, match three arm positions to the dancer, then lift your arms on count 1 at the solo's BPM. Nothing is recorded.

### Goals (Me → 🎯 Goals)
`goals` collection. Presets: right / left / middle split, bridge, arabesque height, side extension height, handstand hold, hollow hold, passé balance on relevé, aerial progression; custom goals too. Each goal has a target (seconds or degrees, or photo-only), a check-in timeline (photo or short clip, date, optional number — for splits and arabesque the pose tool measures the angle from the photo and fills it in), a line chart, and a first-vs-latest slider compare. Check-ins are every two weeks: Today shows a gentle "Check-in time" line when one is due (Later snoozes it three days); never daily. Goal photos live in the family space under `photos` with a `goal` field, are hidden from the photo grid, shown only inside the goal, and have no share button. Only flexibility, strength and balance are measured. Rings and the latest photo show on Me.

### The daily practice plan
Practice is built fresh each day from `data/practice-pool.json` (`js/plan.js`): one warm-up, **two core**, **two leg**, one flexibility and **two technique** items rotate through their pools so the same moves don't come up every day (over a week she sees most of the pool). On top of that the plan takes from the dances: **this week's fix** becomes a drill, the technique picks favor the tags of her open corrections (eyes notes → spotting and eye-line drills, feet → point/relevé work…), **one trick drill** from the solo card rotates in, and the runs stay. **Aerial mission** steps are part of the plan on home days — two strength steps on Thursday, one drill on Friday — pulled from the steps not yet checked; ticking one in practice also ticks the mission. In-class-only steps never appear at home. Each day's record stores its own `total`, so the 60% streak rule is judged against that day's list. **Sofia can shape the day's list herself:** on the Practice tab every warm-up, core, leg, flex and technique item has a 🔁 that opens a picker from that group's pool (swap it, or "Skip this one today"), and each group header has **＋ one more**. Choices are saved on that day's record (`practice.custom`) and the plan is back to the normal rotation the next day.

### Practice mode (▶ Start practice)
The checklist one item at a time, full screen: Manual (tap Done) or Timed (each item's own length from `practice-items.json` `secs`, auto-advance with a chime, pause). Every Done is saved to the day's practice record the moment it's tapped, mirrored in localStorage as a safety net. The dancer **performs the move** (game moves from `moves.json`, exercises from `data/exercises.json` — plank, hollow, superman, leg lifts, bridges, squats, lunges, splits, jacks and more) and a ring shows progress. **📷 Use a photo or clip** under the dancer swaps the animation for a photo or short clip of Sofia doing that move (recorded or picked on the phone; stored in the family space with `photos.demo = itemId`, hidden from the photo grid, in backups) or a web link (image/video file links play inline, other links get an Open button). "Back to the dancer" removes it. Stored in `settings.demos` so both phones see the same picture. Skip moves on without checking. Confetti at the end.

### Quick sessions (💪 5-min strength · 🧘 5-min stretch)
Under Start practice on the Practice tab (`js/quick.js`): a one-minute warm-up plus three timed items from the same pools as the daily plan (strength: core + legs, alternating 2+1 / 1+2 by day; stretch: three flexibility items), each capped at 90 s so the whole thing is about five minutes. Runs in practice mode (timed, with its own done list, so it never touches the day's checklist). Finishing one is saved as `practice.quick` for the day, counts the day for the streak like a run does, shows ⚡ on Today and ✓ on the button, and pays a star. Any number per day.

### What's Next? (Play)
A memory game built from a dance's step order (`js/games/nextmove.js`, any dance with 8+ `steps`; today that is the solo): a step comes up, Sofia taps which of three steps comes next, ten rounds spread through the dance. Best score in `settings.nmBest`, stars like Spot the Oops (9+ = 3).

### Practice player
On any dance, **▶ Practice** opens the player for that dance's music: the uploaded music file (More ▸ Add music file — any audio file, or a video file if that's what the studio sent; only the sound is used) or, failing that, a music link that points straight at an audio file (.mp3/.m4a/.wav…). Streaming links like YouTube/Spotify can't be played; add the file instead.
- **Speed** 50 · 75 · 100 (and a slider), pitch preserved.
- **A–B loop**: tap A then B while it plays. Presets come from the dance's `loops` (data/dances.json) plus every `m:ss` timestamp in "Where the big moments land" (each one loops until the next timestamp).
- **8-count overlay**: needs the dance's BPM (More ▸ Edit; solo 76, jazz 123, trio 86 are filled in) and a one-time **Tap on count 1** while the track plays (stored as `countOffset` on the dance). Quiet, click, or spoken counts.
- **Cue sheet** (memorizing the routine): a list of moments per dance, each with a time, the words sung there and the move or spot. While the track plays the player shows the current move big with the words under it, and the next cue counts down from 4 seconds out; the same block sits on the Run it screen. **＋ Cue here** while the track plays (it pauses, asks for the words and the move, and saves to the dance); **List** shows, edits and deletes cues, tapping a time seeks there; **🙈 Test me** hides each move until she taps it. Grown-ups can also edit the whole sheet as text under More ▸ Edit (`m:ss | words | move`, one per line) or in `data/dances.json` as `cues: [{"t":50,"lyric":"…","move":"Cartwheel"}]`. The solo, trio and jazz cards ship with moves from their music maps and blank words — type the lyrics in yourself; the app never ships song lyrics.
- **Run it**: 3-2-1, the whole track at 100%, then "Did you hold the ending?" / "Eyes up?" — logged to that day's `practice` record as a run. A run counts as a practice day.
- The track is downloaded once through the service worker's media cache, so it plays offline after that.

### Corrections tracker
`corrections` records: `{danceId, text, source, date, tag, status}` with tags feet / knees / eyes / arms / timing / spacing / energy / other and status working / done. The "Corrections to work on" lines on each dance card are copied into records once (source `notes`, id derived from the dance + text, so it's safe on both phones and after data edits). The dance card reads from the records; the old array stays on the card and new lines in it become records too. Start a line with `#feet ` (or `#knees`, `#eyes`, `#arms`, `#timing`, `#spacing`, `#energy`, `#other`) to set the tag explicitly instead of letting the words decide; an explicit tag also re-tags a line that was already copied.
- **Pattern spotting**: a tag seen 3+ times in the last 60 days shows "You've had this note N times" on that dance and on Me, with a **Got it!** that closes the newest open one (badge on the 1st, 5th and 10th).
- **This week's fix**: on Sunday (film-review day) Today offers **Pick one**; it chooses the open correction whose tag repeats most (then the oldest) and shows it on Today all week (`settings.weekFix`). Any other day without a pick shows the same button.

### Stars (what points are for)
Every game pays **1–3 stars** per play depending on the result (`js/stars.js`: Sparkle 500/1000, Oops 7/9 of 10, Comp Day 70/84, Choreo and Trio 74/84, Mirror 120/250, a finished practice day 2), plus **+1 for the first play of each game each day**. Stars add up on Me (`settings.stars`) and unlock looks in the avatar builder — gold leotard at 10, flower at 20, lilac hair at 35, aqua leotard at 50, braids at 70, black leotard at 90, violet eyes at 120 — shown with a 🔒 and the stars still needed. Best scores and badges stay as they were; stars are the everyday reward loop.

### Mirror (Play)
Front camera + on-device pose. The target dancer is as big as the camera view, beside it on a laptop and above it on a phone, mirrored so she can copy directly, swaying so she isn't a statue. One instruction at a time ("Arms up high!"), a match meter that fills while the pose is held (2 s), green skeleton when it matches, a chime and a green flash on success, 3-2-1 between rounds. Rounds: five poses, a 6-second relevé, then "arms up on count 1" to the solo's own track when it's uploaded (click track otherwise). The announcer speaks each instruction and result (🔊 toggles it), and an "I see: arms wide" line shows what the camera is reading so she can adjust. Pose rules are forgiving (a phone propped low foreshortens the arms). Nothing is recorded.

### Dance Along (Play) — learn a routine from a real video
Pick a clip on the phone (a tutorial she saved, a clip of her teacher, a dance she filmed; up to 2 minutes, whole body in view). The app reads the dancer's poses from it on-device at 8 frames a second (`poseFeatures` in `js/posemath.js`: wrists and elbows relative to the shoulders, knee angles — mirror-invariant), keeps the clip in the family space (`choreo` record with `kind: "along"`, in backups) and the features with it. To play: the clip runs with its own music beside the camera, her pose is compared to the clip's every half second with a ±0.4 s timing window, PERFECT / Good / Keep going flash as she dances, a score and stars at the end (3 stars at 80 % in step). The announcer speaks the countdown and the result (🔊 to mute). Nothing is recorded. Clips are the family's own: the app never downloads or redistributes anything.

### Skills, badges, streaks
- `data/skills.json`: a beginner → advanced ladder per style (ballet, jazz, contemporary, acro, hip hop), 10 skills each. States: not yet → learning → clean (Sofia taps on Me) → **teacher-checked** (Grown-ups → Skills & awards, with the teacher's name and date). Rings on Me: learning ⅓, clean ⅔, checked full.
- Badges (`badges` collection): 3- and 7-day streaks; fixes closed 1/5/10; aerial mission ¼ ½ ¾ full; game bests (Sparkle 1,000, Oops 9/10, Comp Day High Gold, Trio Platinum); first film review; first full run at 100%; parent-awarded **No cues** (per dance) and **Clean 5 in a row** (per skill or any trick). A toast fires when one is earned; the case on Me shows earned and locked.
- Streak rule: a day counts when the checklist is ≥60% or a run is logged. Studio days (any day with a class in data/classes.json) and school breaks (events whose type or name contains "break") pause the streak; a missed home or rest day breaks it.

## Layout

```
index.html            markup: five kid tabs, PIN pad, Grown-ups hub + pages, Show me and player overlays
css/app.css           styles
js/app.js             boot: load data → wire views → error guards → Firebase → family gate → live sync → badges/corrections upkeep
js/store.js           in-memory state, SCHEMA_VERSION + MIGRATIONS, storeSet/storeDel, "settled" (server-confirmed) tracking
js/sync.js            Firebase auth/Firestore/Storage, family spaces, media interface (Firebase or Supabase)
js/data.js            loads data/*.json into named exports
js/nav.js             tabs + the page guard the PIN gate uses
js/grownups.js        PIN gate, hub
js/corrections.js     tags, migration of card arrays, patterns, weekly fix   (pure parts tested)
js/streak.js          streak rules                                          (tested)
js/badges.js          badge definitions, evaluation, awarding               (tested)
js/skills.js          skill ladder + states                                  (tested)
js/player.js          practice player                                       (presets tested)
js/cues.js            cue sheets: text form, what shows when                (tested)
js/coach.js           AI coach: frames → worker → review card; Grown-ups → Coach reviews
js/frames.js          frame sampling times + loudest-moment math             (tested)
js/pose.js, js/posemath.js   MediaPipe Pose loader/drawing; angles & readouts (posemath tested)
js/goals.js           goals: presets, check-ins, chart, compare, reminder     (math tested)
js/pmode.js           practice mode                                          (tested)
js/stage.js           full-screen stage for the games
js/games/mirror.js    Mirror game (live pose)
worker/               Cloudflare Worker for the coach (see worker/README.md); worker/src/core.js is tested from tests/
js/showme.js          wrong-vs-fixed avatar pairs per tag
js/reports.js         error capture, per-screen error state, "send a report", Reports page
js/family.js          create / join gate (typed code, QR scan, ?join= link)
js/backup.js          export / import .zip
js/ics.js             calendar export
js/avatar.js          the dancer (SVG) + avatar builder (on Me)
js/games/*.js         one file per game: choreo, oops, trio, compday, sparkle
js/views/*.js         one file per screen: home (Today), dances, practice, play, me, skillcheck, events, schedule, notes, lists, settings
data/*.json           ALL season content — edit these, not the code
seed-data/            what Sofia saved in the Claude-hosted version; imported on first "Create family space"
files/                printable documents added to "My files" on first create
firestore.rules, storage.rules, firebase.json, .firebaserc
sw.js, manifest.json, icons/    PWA
tests/                node --test: migrations, data sanity, .ics, corrections, streak, badges+skills, smoke (every screen renders in Node)
tools/                serve.cjs (local server), seed-manifest.cjs, make-icons.cjs
.github/workflows/pages.yml     deploy on push to main
```

## Editing content (data/*.json)

Everything the app shows out of the box lives in `data/`. Edit the JSON, run `npm test`, push. Both phones get the change on their next open.

| File | What it holds |
|---|---|
| `dances.json` | The built-in dances (song, choreographer, costume, music map, corrections, trick drills, `bpm`, `loops`, `cues`, `story` — one or two kid-facing lines on the cover — and `performance` — face/musicality/presence notes under More ▸). In-app edits are saved *on top of* these by `id`, so changing a built-in dance here changes it for everyone unless that field was edited in the app. `loops` = `[{"n":"Soft half","a":0,"b":48}]` in seconds. |
| `events.json` | Season events (`start`/`end` as `YYYY-MM-DD`, `pack` = which packing list). A type or name containing "break" pauses the streak. |
| `classes.json` | Weekly studio classes: `day` 0=Sun…6=Sat, `t` like `"4:30–5:30"`, `name`, `room`. Any day with a class is a studio day (streak pauses). |
| `home-days.json` | Home-practice days keyed by weekday number. |
| `practice-pool.json`, `exercises.json` | The practice pools (warm-up, core, legs, flexibility, technique, runs; each item has a stable `id`, `secs`, `pose`, `tags`) and the exercise animations for practice mode. Add items freely; don't reuse or rename ids. `practice-items.json` is the old fixed list, kept for the schema-1 migration. |
| `phases.json` | The 15-week plan. |
| `packs.json` | Packing lists (`comp`, `convention`, `rehearsal`). |
| `aerial.json` | Aerial progression steps (stable `id`, `section`, `text`). |
| `skills.json` | Skill ladders per style (stable `id`, `n`). States are stored against the id. |
| `season.json` | Season dates, studio address, timezone (used by the calendar export). |
| `styles.json`, `moves.json` | Choreo Studio styles and moves. A move's keyframes are `{ "arms": "up"\|"second"\|"low"\|"first", ...joint overrides }` on top of `base`. |
| `avatar-options.json` | Avatar builder choices and the default avatar. |
| `oops.json`, `trio.json`, `compday.json`, `sparkle.json` | Game tables: Spot-the-Oops flaws, trio formations/patterns/dancers, Comp Day scenes, Step & Sparkle icons. |

### Add a dance
Either tap **Add** at the bottom of the Dances tab on a phone (it syncs), or add an object to `data/dances.json`:

```json
{"id":"wf-tap","name":"Winter Formal · Tap class dance","song":"","style":"Tap","choreo":"","costume":"","shoes":"Tap shoes","hair":"Pulled back","color":"sun","music":"","map":"","strengths":[],"corrections":[],"notes":"","bpm":"","loops":[]}
```
`color` is one of `coral`, `aqua`, `sun`, `violet`. `id` must be unique and never change.

### Add an event
Grown-ups → Events → **Add**, or add to `data/events.json`:

```json
{"id":"nat","name":"Nationals","start":"2027-07-09","end":"2027-07-12","type":"Competition","dances":"Solo, trio","venue":"","notes":"","cost":"","charge":"","pack":"comp"}
```

## Running locally

```bash
npm run serve        # http://localhost:8080/
npm test             # 89 tests: migrations, data sanity, .ics, corrections, streak, badges+skills, smoke
```
(`node tools/serve.cjs` — no dependencies. The app needs http://, not file://, because of ES modules and the service worker. During development, unregister the service worker and clear caches in the tab to see edits.)

The smoke test (`tests/smoke.test.js`) imports every screen in Node with a small fake DOM (`tests/_env.mjs`) and a stub for the Firebase CDN imports (`tests/_register.mjs` + `tests/_loader.mjs`), renders each screen with an empty space and with sample records, and checks that every element id the code looks up exists in `index.html`. Add a new screen → add its init/render to the lists at the top of that file.

## Deploying (git push → GitHub Pages)

Every push to `main` runs the tests and publishes the folder to GitHub Pages via `.github/workflows/pages.yml`. Phones pick the new version up on their next open (the service worker caches by version).

**Release checklist:** bump `self.APP_VERSION` in `js/version.js` (that's what tells phones there's a new version) → `npm test` → commit → `git push` → check the Actions run is green.

If a first deploy ever fails on "Pages not enabled": GitHub repo → Settings → Pages → Source: **GitHub Actions**, then re-run the workflow.

### What to test after each deploy (on a phone, 390 px wide)
1. Open the app: the "Updated ✨ vX" toast shows, Today renders with today's studio classes or home plan.
2. Dances: tap a chip → Show me opens; **＋ Note** → save a note → it appears as a chip on the card.
3. ▶ Practice on the solo: track loads, 50% is slower and in tune, A–B loops, 8-count shows digits, the cue sheet shows the current move and counts down to the next.
4. Practice: the list is today's plan (grouped), 🔁 swaps a move; **▶ Start practice** walks items one at a time with the dancer performing each; Done saves at once; 100% → confetti; Today shows the streak.
5. 🎬 Coach me on the solo with three photos: skeleton readouts appear, "Ask the coach" returns a card within a minute, "Make it a note" adds the fix; Grown-ups → Coach reviews lists it.
6. Me → 🎯 Goals → a goal → check in with a photo; Today shows the two-week reminder when due. Play → 🪞 Mirror opens the camera.
7. Me → long-press the avatar → PIN → Grown-ups hub; Settings shows "Online · synced".
8. Second phone: the note from step 2, the review from step 5 and the goal from step 6 are there.

## Family space, join code, QR

- First launch: **Create family space** (on the first phone) → shows the code + QR; Sofia's seed data and the four documents are imported. **Join with code** on the second phone: scan the QR (or open the shared link — it contains `?join=CODE`) or type the code.
- Grown-ups → Settings shows the code and QR again, sync status, backup, updates, and **Leave family space**.

### Reset the join code
The code *is* the family space, so resetting means moving to a new one:
1. Settings → **Export backup** (save the .zip somewhere safe).
2. Settings → **Leave family space** (this phone only; cloud data stays).
3. **Create family space** → new code → Settings → **Import backup**.
4. On the other phone: Leave, then Join with the new code.
The old space stays in Firestore/Storage untouched; delete it from the Firebase console if you want it gone.

## Backups
Settings → **Export backup** produces `spotlight-backup-YYYY-MM-DD.zip` (all collections as JSON + every photo/file/music/video). **Import backup** merges by record id — the newer copy of each record wins — and re-uploads media that belonged to a different family space. Do this monthly and after big changes.

## Firebase rules
Rules live in `firestore.rules` and `storage.rules`. Anonymous-authenticated users can read/write only under a valid 24-character `familyId` and only in the known collections; uploads are capped at 60 MB; everything else is denied.

**Version 1.3.0 added `reviews` and `goals` (1.1.0 added `corrections`, `skills`, `badges`, `reports`) — republish `firestore.rules` after each such release or those collections won't sync.** Until then the app still works (notes, skills and badges show on the phone that made them and a "Couldn't save to the cloud" toast appears), but nothing in those four collections reaches the other phone, and the one-time copy of the dance-card corrections waits until the cloud confirms the collection.

Two ways to publish the rules:
- **Console (no CLI):** Firebase console → project `sofia-spotlight` → Firestore Database → Rules → paste the contents of `firestore.rules` → Publish. (Storage rules are unchanged since 1.0.x.)
- **CLI:**
  ```bash
  firebase login          # once, with the Google account that owns the project
  npm run rules           # = firebase deploy --only firestore:rules,storage
  ```
  (`npm i -g firebase-tools` if the `firebase` command is missing.)

### Storage CORS (one-time, needed for backups to include media)
Uploading and viewing photos works out of the box, but reading a file *back* into the browser (which **Export backup** and the practice player do) needs a CORS entry on the bucket. Firebase has no console switch for this; run once in [Google Cloud Shell](https://console.cloud.google.com/?cloudshell=true) (project `sofia-spotlight`):

```bash
echo '[{"origin":["*"],"method":["GET"],"responseHeader":["Content-Type"],"maxAgeSeconds":3600}]' > cors.json
gsutil cors set cors.json gs://sofia-spotlight.firebasestorage.app
```
Until this is done, backups still contain all the data; the zip just carries a `missing-media.json` list instead of the files, and the export toast says so. (Done on 2026-09-27.)

### If Firebase Storage isn't available
`js/sync.js` puts media behind one small interface with two implementations. To use Supabase Storage instead, create a public bucket and set in `js/firebase-config.js`:
```js
export const mediaConfig = { provider: "supabase", url: "https://YOUR-PROJECT.supabase.co", anonKey: "YOUR-ANON-KEY", bucket: "spotlight" };
```

## Data safety
- Every stored record carries `_v` (schema version) and `_at` (write time). `js/store.js` has `SCHEMA_VERSION` (now 14) and a `MIGRATIONS` map; documents are migrated on read and on import, so old phones' data always loads.
- Never rename or drop a stored field without bumping `SCHEMA_VERSION` and adding a migration — `tests/migrations.test.js` loads schema-1 and schema-2 samples and checks they still come through.
- Schema 14 (1.7.1): `settings.nmBest` (What's Next? best score).
- Schema 13 (1.7.0): `practice.quick[]` — quick sessions finished that day (`"strength"` / `"flex"`); a day with one counts for the streak.
- Schema 12 (1.6.3): `dances.steps[]` — the step order of a dance, one short line per step (the solo's comes from Hannah's talk-through; shown and editable on the dance card under More / Edit).
- Schema 11 (1.6.0): `reviews.fixId`.
- Schema 10 (1.5.0): Dance Along routines in `choreo` (`kind`, `url`, `path`, `fps`, `frames`, `best`).
- Schema 9 (1.4.0): `settings.stars`, `settings.starLog`, `settings.mirrorBest`.
- Schema 8 (1.3.6): `settings.demos`, `photos.demo`.
- Schema 7 (1.3.5): `practice.custom` (swap / add / skip for the day).
- Schema 6 (1.3.1): `practice.total`.
- Schema 5 (1.3.0): `reviews` and `goals` collections, `photos.goal`.
- Schema 4 (1.2.0): `dances.cues[]` (cue sheets), normalized on read when present.
- Schema 3 (1.1.0): `practice.runs[]` ("Run it" logs), `settings.pin` / `settings.pinOn` / `settings.weekFix`, `dances.bpm` / `dances.loops` / `dances.countOffset`, and the four new collections. Older records get the defaults on read.
- Collections: `dances, events, notes, todos, packs, practice, photos, files, choreo, settings, corrections, skills, badges, reports, reviews, goals` under `/families/{familyId}/…`. Media under `families/{familyId}/{photos|files|music|videos}/{id}` in Storage.

## Privacy / constraints
No analytics, no accounts, no chat, no third-party requests beyond the pinned CDN libraries (Firebase SDK on gstatic, JSZip and qrcode-generator on cdnjs, jsQR and MediaPipe Tasks Vision on jsDelivr plus its model file from Google's model store — loaded only when used), Google Fonts, and the family's own coach worker (still frames only, never video). Photos stay inside the family space and are only shown inside the app. Voice-to-text for class notes uses the browser's own speech recognition (Web Speech API) where available and is never sent anywhere by the app.

## Monthly cost expectations
- Firebase: free tier (Firestore + Storage stay tiny; no videos are uploaded except goal clips you choose).
- Cloudflare Worker: free plan.
- Anthropic API: about 10 cents per coach review on `claude-opus-5-5` (half on `claude-sonnet-5-5`); two or three reviews a week is under $2 a month. Hard cap: 20 reviews per family per day. Check console.anthropic.com → Usage monthly.

## Rotating the coach API key
Create a new key in the Anthropic console → `cd worker && npx wrangler secret put ANTHROPIC_API_KEY` (or replace the secret in the Cloudflare dashboard) → delete the old key. The app doesn't change.

## Session report — 2026-09-30 and 2026-10-01 (sessions 2A, 2B and the feedback round)

Everything below is live at **1.3.7**. Each item was verified in the desktop browser at a 390 px viewport against a throwaway family space unless noted; "on a phone" items are what Jenya and Sofia confirmed.

### Shipped
| Version | What |
|---|---|
| 1.1.0 | Kid mode (Today · Dances · Practice · Play · Me, PIN-locked Grown-ups), practice player (speed, A–B loop, 8-count, Run it), corrections tracker with Show me, skills/badges/streaks, per-screen error states + reports, SCHEMA 3, Node smoke harness |
| 1.1.1–1.1.4 | Explicit `#tag` on card lines (donut roll → Feet), music picker accepts any file (iOS greyed MP3s out), Stop button on Run it + Escape |
| 1.2.0–1.2.1 | Cue sheets (＋ Cue here, List, Test me, run-screen cues), story line + performance notes from the two study sheets, trio song corrected |
| 1.2.2–1.2.3 | Games play full screen with the buttons under the dancer, Oops timer 10 s; Practice mode (one item at a time, manual/timed, saved on every Done, localStorage safety net) |
| 1.3.0 | AI coach (Cloudflare Worker + Coach me), skeleton view + Mirror game, goals with photos, SCHEMA 5 |
| 1.3.1–1.3.2 | Daily practice plan from pools (rotating core/legs/flex/tech, week's fix drill, correction-tag technique picks, trick drill, aerial mission on home days), animated exercise poses, SCHEMA 6 |
| 1.3.3–1.3.4 | Calypso move + drill + Ms. Brittany's calypso and timing notes; built-in card lines always copied into the tracker |
| 1.3.5 | Swap / add / skip moves per group for the day (SCHEMA 7) |
| 1.3.6 | Photo / clip / link in place of the dancer per move (SCHEMA 8) |
| 1.3.7 | Coach worker deployed and wired in |

### Infrastructure done by Jenya
- Firestore rules republished twice (1.1.0 and 1.3.0 collections) — verified both times: the new collections are server-confirmed and round-trip.
- Cloudflare account + `wrangler login` on this machine; worker `sofia-spotlight-coach` deployed with KV `RATE`; `ANTHROPIC_API_KEY` set as a dashboard secret.
- Two PDFs (solo study sheet, trio guide) and two music files added to the family space.

### Verified
- Coach, end to end with the real key: three stills → skeleton readouts → model → review card (praise, one fix tagged Knees with one-tap note, four-point check, drill). Foreign origins get 403; the no-key state gave a clear 503 message before the key was set. One test review cost about 2 cents.
- Practice plan: 13–14 items on a Thursday with two aerial strength steps and a trick drill; core and leg moves differ day to day; swap and add update the list and the day's total; practice mode animates every pool pose, widens the frame for lying-down moves, and shows a chosen picture instead.
- Player: 50 % speed, A–B loop, 8-count, Run it with Stop, cue sheet current/next with countdown, Test me.
- Reviews and goals: saved, returned from the cloud after reload, listed under Grown-ups → Coach reviews; goal reminder on Today after 14 days.
- Games open in the full-screen stage with results under the dancer.
- 70 Node tests, every deploy green.

### Not verified (needs a phone or real footage)
- A real video review (60 s clip, loudest-moment frames) and the Mirror game's camera rounds.
- Goal check-in with the pose tool measuring a real split photo.
- Voice-to-text for class notes on iOS; Web Audio click track on iOS Safari.

### Known limits
- Saves replace whole records: two phones saving the same card at the same moment → the later save wins. Different records never collide. Field-level merging is a contained change if several adults will edit at once.
- Lyrics are never shipped in the data; type them into the cue sheet on the phone.
- Three throwaway test family spaces exist in Firestore from verification; they are unenumerable and can be deleted from the Firebase console.
