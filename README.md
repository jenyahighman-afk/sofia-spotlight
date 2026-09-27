# Sofia's Spotlight

Sofia's 2026–27 dance-season app: dances, season events, schedule, home practice, notes & photos, five games, packing lists — installed on two phones and kept in sync live through one shared **family space**. No accounts, no logins: the 24-character family code is the only key.

- **Live site:** https://jenyahighman-afk.github.io/sofia-spotlight/
- **Stack:** static HTML/CSS/JS (ES modules, no build step) · Firebase anonymous auth + Firestore (offline-first) + Firebase Storage · GitHub Pages · service worker (installable, works offline)

## Layout

```
index.html            markup only (looks/copy unchanged from the original single file)
css/app.css           styles
js/app.js             boot: load data → wire views → Firebase → family gate → live sync
js/store.js           in-memory state, SCHEMA_VERSION + MIGRATIONS, storeSet/storeDel
js/sync.js            Firebase auth/Firestore/Storage, family spaces, media interface (Firebase or Supabase)
js/data.js            loads data/*.json into named exports
js/family.js          create / join gate (typed code, QR scan, ?join= link)
js/backup.js          export / import .zip
js/ics.js             calendar export
js/avatar.js          the dancer (SVG) + avatar builder
js/games/*.js         one file per game: choreo, oops, trio, compday, sparkle
js/views/*.js         one file per tab (+ settings)
data/*.json           ALL season content — edit these, not the code
seed-data/            what Sofia saved in the Claude-hosted version; imported on first "Create family space"
files/                printable documents added to "My files" on first create
firestore.rules, storage.rules, firebase.json, .firebaserc
sw.js, manifest.json, icons/    PWA
tests/                node --test (schema migrations, data sanity, .ics)
tools/                serve.cjs (local server), seed-manifest.cjs, make-icons.cjs
.github/workflows/pages.yml     deploy on push to main
```

## Editing content (data/*.json)

Everything the app shows out of the box lives in `data/`. Edit the JSON, run `npm test`, push. Both phones get the change on their next open.

| File | What it holds |
|---|---|
| `dances.json` | The built-in dances (song, choreographer, costume, music map, corrections, trick drills…). In-app edits are saved *on top of* these by `id`, so changing a built-in dance here changes it for everyone unless that field was edited in the app. |
| `events.json` | Season events (`start`/`end` as `YYYY-MM-DD`, `pack` = which packing list). |
| `classes.json` | Weekly studio classes: `day` 0=Sun…6=Sat, `t` like `"4:30–5:30"`, `name`, `room`. |
| `home-days.json` | Home-practice days keyed by weekday number. |
| `practice-items.json` | The daily checklist. Each item needs a **stable `id`** — check-offs are stored against it. Add items freely; don't reuse or rename ids. |
| `phases.json` | The 15-week plan. |
| `packs.json` | Packing lists (`comp`, `convention`, `rehearsal`). |
| `aerial.json` | Aerial progression steps (stable `id`, `section`, `text`). |
| `season.json` | Season dates, studio address, timezone (used by the calendar export). |
| `styles.json`, `moves.json` | Choreo Studio styles and moves. A move's keyframes are `{ "arms": "up"\|"second"\|"low"\|"first", ...joint overrides }` on top of `base`. |
| `avatar-options.json` | Avatar builder choices and the default avatar. |
| `oops.json`, `trio.json`, `compday.json`, `sparkle.json` | Game tables: Spot-the-Oops flaws, trio formations/patterns/dancers, Comp Day scenes, Step & Sparkle icons. |

### Add a dance
Either tap **Add** at the bottom of the Dances tab on a phone (it syncs), or add an object to `data/dances.json`:

```json
{"id":"wf-tap","name":"Winter Formal · Tap class dance","song":"","style":"Tap","choreo":"","costume":"","shoes":"Tap shoes","hair":"Pulled back","color":"sun","music":"","map":"","strengths":[],"corrections":[],"notes":""}
```
`color` is one of `coral`, `aqua`, `sun`, `violet`. `id` must be unique and never change.

### Add an event
Tap **Add** on the Events tab, or add to `data/events.json`:

```json
{"id":"nat","name":"Nationals","start":"2027-07-09","end":"2027-07-12","type":"Competition","dances":"Solo, trio","venue":"","notes":"","cost":"","charge":"","pack":"comp"}
```

## Running locally

```bash
npm run serve        # http://localhost:8080/
npm test             # migrations, data sanity, .ics
```
(`node tools/serve.cjs` — no dependencies. The app needs http://, not file://, because of ES modules and the service worker.)

## Deploying (git push → GitHub Pages)

Every push to `main` runs the tests and publishes the folder to GitHub Pages via `.github/workflows/pages.yml`. Phones pick the new version up on their next open (the service worker caches by version).

**Release checklist:** bump `self.APP_VERSION` in `js/version.js` (that's what tells phones there's a new version) → `npm test` → commit → `git push`.

If a first deploy ever fails on "Pages not enabled": GitHub repo → Settings → Pages → Source: **GitHub Actions**, then re-run the workflow.

## Family space, join code, QR

- First launch: **Create family space** (on the first phone) → shows the code + QR; Sofia's seed data and the four documents are imported. **Join with code** on the second phone: scan the QR (or open the shared link — it contains `?join=CODE`) or type the code.
- Settings (⚙️ in the header) shows the code and QR again, sync status, backup, updates, and **Leave family space**.

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
Rules live in `firestore.rules` and `storage.rules`. Anonymous-authenticated users can read/write only under a valid 24-character `familyId`; uploads are capped at 60 MB; everything else is denied. To change and deploy them:

```bash
firebase login          # once, with the Google account that owns the project
npm run rules           # = firebase deploy --only firestore:rules,storage
```
(`npm i -g firebase-tools` if the `firebase` command is missing.)

### Storage CORS (one-time, needed for backups to include media)
Uploading and viewing photos works out of the box, but reading a file *back* into the browser (which **Export backup** does to pack photos/files/music into the zip) needs a CORS entry on the bucket. Firebase has no console switch for this; run once in [Google Cloud Shell](https://console.cloud.google.com/?cloudshell=true) (project `sofia-spotlight`):

```bash
echo '[{"origin":["*"],"method":["GET"],"responseHeader":["Content-Type"],"maxAgeSeconds":3600}]' > cors.json
gsutil cors set cors.json gs://sofia-spotlight.firebasestorage.app
```
Until this is done, backups still contain all the data; the zip just carries a `missing-media.json` list instead of the files, and the export toast says so.

### If Firebase Storage isn't available
`js/sync.js` puts media behind one small interface with two implementations. To use Supabase Storage instead, create a public bucket and set in `js/firebase-config.js`:
```js
export const mediaConfig = { provider: "supabase", url: "https://YOUR-PROJECT.supabase.co", anonKey: "YOUR-ANON-KEY", bucket: "spotlight" };
```

## Data safety
- Every stored record carries `_v` (schema version) and `_at` (write time). `js/store.js` has `SCHEMA_VERSION` and a `MIGRATIONS` map; documents are migrated on read and on import, so old phones' data always loads.
- Never rename or drop a stored field without bumping `SCHEMA_VERSION` and adding a migration — `tests/migrations.test.js` loads schema-1 samples and checks they still come through.
- Collections: `dances, events, notes, todos, packs, practice, photos, files, choreo, settings` under `/families/{familyId}/…`. Media under `families/{familyId}/{photos|files|music|videos}/{id}` in Storage.

## Privacy / constraints
No analytics, no accounts, no third-party requests beyond the pinned CDN libraries (Firebase SDK on gstatic, JSZip and qrcode-generator on cdnjs, jsQR on jsDelivr — loaded only when scanning) and Google Fonts.
