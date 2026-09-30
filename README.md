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
| **Play** | The five games (Choreo Studio, Spot the Oops, Trio Formations, Comp Day, Step & Sparkle). |
| **Me** | Avatar (tap = customize, **long-press = Grown-ups**), streak + personal bests, badge case, skill progress rings per style, "notes that keep coming back", and the **Grown-ups 🔒** link at the bottom. |

**Grown-ups** (PIN, default **2027**; change it or switch it off under Grown-ups → PIN) holds: Events (costs, notes, hotels), Schedule (classes, calendar, print, .ics), Lists (to-dos, packing), Notes (notes, files, photos), Skills & awards (teacher-checked skills, "No cues" / "Clean 5 in a row" badges), Coach reviews (placeholder until session 2B), Reports, Settings & backup. The ⚙️ in the header goes through the same gate. The gate stays open for 20 minutes after the PIN is typed. Nothing was deleted from the old tabs; it moved here.

Every screen has an error state ("This screen hit a snag … Send a report") and a small **Something went wrong? Tap to send a report** link at the bottom. Reports land in the `reports` collection and show under Grown-ups → Reports with the last error that phone captured.

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
| `dances.json` | The built-in dances (song, choreographer, costume, music map, corrections, trick drills, `bpm`, `loops`…). In-app edits are saved *on top of* these by `id`, so changing a built-in dance here changes it for everyone unless that field was edited in the app. `loops` = `[{"n":"Soft half","a":0,"b":48}]` in seconds. |
| `events.json` | Season events (`start`/`end` as `YYYY-MM-DD`, `pack` = which packing list). A type or name containing "break" pauses the streak. |
| `classes.json` | Weekly studio classes: `day` 0=Sun…6=Sat, `t` like `"4:30–5:30"`, `name`, `room`. Any day with a class is a studio day (streak pauses). |
| `home-days.json` | Home-practice days keyed by weekday number. |
| `practice-items.json` | The daily checklist. Each item needs a **stable `id`** — check-offs are stored against it. Add items freely; don't reuse or rename ids. |
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
npm test             # 43 tests: migrations, data sanity, .ics, corrections, streak, badges+skills, smoke
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
3. ▶ Practice on the solo: track loads, 50% is slower and in tune, A–B loops, 8-count shows digits.
4. Practice: tick items → ring moves; 100% → confetti; Today shows the streak.
5. Me → long-press the avatar → PIN → Grown-ups hub; Settings shows "Online · synced".
6. Second phone: the note from step 2 is there.

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

**Version 1.1.0 added four collections — `corrections`, `skills`, `badges`, `reports` — and `firestore.rules` must be republished before they sync.** Until then the app still works (notes, skills and badges show on the phone that made them and a "Couldn't save to the cloud" toast appears), but nothing in those four collections reaches the other phone, and the one-time copy of the dance-card corrections waits until the cloud confirms the collection.

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
- Every stored record carries `_v` (schema version) and `_at` (write time). `js/store.js` has `SCHEMA_VERSION` (now 4) and a `MIGRATIONS` map; documents are migrated on read and on import, so old phones' data always loads.
- Never rename or drop a stored field without bumping `SCHEMA_VERSION` and adding a migration — `tests/migrations.test.js` loads schema-1 and schema-2 samples and checks they still come through.
- Schema 4 (1.2.0): `dances.cues[]` (cue sheets), normalized on read when present.
- Schema 3 (1.1.0): `practice.runs[]` ("Run it" logs), `settings.pin` / `settings.pinOn` / `settings.weekFix`, `dances.bpm` / `dances.loops` / `dances.countOffset`, and the four new collections. Older records get the defaults on read.
- Collections: `dances, events, notes, todos, packs, practice, photos, files, choreo, settings, corrections, skills, badges, reports` under `/families/{familyId}/…`. Media under `families/{familyId}/{photos|files|music|videos}/{id}` in Storage.

## Privacy / constraints
No analytics, no accounts, no chat, no third-party requests beyond the pinned CDN libraries (Firebase SDK on gstatic, JSZip and qrcode-generator on cdnjs, jsQR on jsDelivr — loaded only when scanning) and Google Fonts. Photos stay inside the family space and are only shown inside the app. Voice-to-text for class notes uses the browser's own speech recognition (Web Speech API) where available and is never sent anywhere by the app.
