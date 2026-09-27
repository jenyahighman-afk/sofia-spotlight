# Sofia's Spotlight — build it as a real app on her phone

## What's in this folder
- `index.html` — the complete app (Home, Dances, Events, Schedule, Practice, Notes, Play, Lists; avatar builder; 5 games; all of Sofia's season data). COPY THIS IN FROM THE ZIP if it is not here yet.
- `js/firebase-config.js` — your Firebase project config, already filled in.
- `seed-data/` — what Sofia already saved in the Claude version (avatar, best score, one note, two saved dances). Claude Code imports these so nothing is lost.
- `files/` — the printable playbooks, aerial mission and the competition guide spreadsheet (copy from the ZIP), to add to the app's "My files."

## Step 1 — Accounts (done or nearly done)
1. **GitHub** (free): github.com → New repository → name `sofia-spotlight` → Public → Create. Leave it empty.
2. **Firebase**: project `sofia-spotlight` exists. Check under Build that Firestore Database, Authentication (Anonymous enabled) and Storage are all switched on. If any shows "Get started," click it and accept the defaults (production mode; if Storage asks for the Blaze plan, say yes and set a $1 budget alert).
3. **Claude Code**: install from claude.ai/code and sign in.

## Step 2 — This folder
You are in `C:\Users\JenyaHighman\Documents\zPersonal\Projects\sofia-spotlight`. Make sure `index.html` is directly inside it (drag it from the ZIP's `sofia-dance-hq-starter` folder), plus the `files` folder.
Open a terminal here: in File Explorer, click the address bar, type `cmd`, press Enter. Then type `claude` and press Enter.

## Step 3 — Paste this prompt into Claude Code (as one message)

```
You are turning a finished single-file web app into an installable, no-login mobile web app with live sync for a 9-year-old competitive dancer and her mom. The app is index.html in this folder. It is complete and working: keep its look, colors, fonts, copy, tabs, avatar builder, all five games, and all the pre-loaded season data exactly as they are. Do not redesign anything. Your job is infrastructure.

Do all of this, in order, and tell me what you verified at the end:

1. STRUCTURE. Split index.html into a static project with no build step: index.html, css/app.css, js/app.js, js/store.js, js/sync.js, js/avatar.js, js/games/*.js (one per game), js/views/*.js (one per tab). Move the DEFAULT_DANCES, DEFAULT_EVENTS, CLASSES, HOME_DAYS, PRACTICE_ITEMS, PHASES, PACKS, AERIAL, MOVES, STYLES, and the games' scene/flaw tables into data/*.json so content edits are JSON edits.

2. SYNC (replace the claude.use("db") and claude.use("assets") code; the runtime they use does not exist outside Claude):
   - Firebase v10 modular SDK from the pinned gstatic CDN. Anonymous auth only. Enable Firestore offline persistence so the app works with no signal and syncs when back online.
   - "Family space" model: first launch shows "Create family space" or "Join with code." Create generates a 24-character random familyId, stores it in localStorage, and shows it as text and a QR code (small QR library from a pinned CDN). Join enters or scans the code. All data lives under /families/{familyId}/{collection}/{docId}. Keep the same collection names and record shapes the app already uses: dances, events, notes, todos, packs, practice, photos, files, choreo, settings. Use onSnapshot listeners so two phones update each other live.
   - Media: photos resized client-side to 1600px max and uploaded to Firebase Storage at families/{familyId}/photos/{id}; files (PDFs) at families/{familyId}/files/{id}; per-dance music files (audio) at families/{familyId}/music/{id} playable with an <audio> element; optional short video clips up to 50 MB. Cache media with the service worker for offline viewing.
   - Write firestore.rules and storage.rules: anonymous-authenticated users may read/write only under a familyId they name; deny everything else; cap uploads at 60 MB. Deploy the rules with the Firebase CLI (ask me to run `firebase login` when needed).
   - The Firebase config is already in js/firebase-config.js — use it.
   - Fallback: if Firebase Storage is unavailable for my project, use Supabase Storage behind the same interface in sync.js.

3. SEED DATA. On first "Create family space," import everything in seed-data/ (settings/main.json is the avatar and best score; choreo/*.json are saved dances; notes/*.json are notes) so Sofia's existing work carries over. Also upload the documents in files/ into the family's "My files" list.

4. BACKUP. Add a Settings screen with "Export backup" (one .zip of all data and media, saved to the device) and "Import backup" (merge by record id, newer wins), plus "Leave family space" (clears the local code, keeps cloud data).

5. PWA. manifest.json (name "Sofia's Spotlight", short name "Spotlight", theme #FF5C93, background #FFF7FA, display standalone, 192 and 512 icons: draw a pink bow on a cream circle as SVG and rasterize). Service worker: cache-first for app files with a version string so updates arrive on next open; show an "Updated" toast. Keep the games' canvas and SVG working offline.

6. DATA SAFETY. SCHEMA_VERSION in store.js with a migrations map. Never rename or drop a stored field without a migration. Add a Node test under tests/ that loads sample data from an older schema and verifies the migration.

7. EXTRAS (small): a weekly printable view beside the monthly calendar; an "Export .ics" button that writes the studio classes (recurring) and season events to a calendar file.

8. README.md: how to edit data/*.json, how to add a dance or event, how to deploy (git push → GitHub Pages), how to back up, how to reset the join code, how to update the Firebase rules.

9. DEPLOY. Initialize git, add a GitHub Actions workflow that publishes to GitHub Pages on every push to main, commit, and push to origin (ask for the repo URL if it is not set: it is https://github.com/<my-username>/sofia-spotlight). Confirm the live URL when the deploy is green.

Constraints: no analytics, no accounts beyond Firebase, no external requests except pinned CDN libraries and Google Fonts. Test at a 390px-wide viewport. Before you finish: run the app locally, create a family space in one browser and join it from a second private window, add a note and a photo in one and confirm they appear live in the other, play each of the five games once, export and import a backup, then report exactly what you verified.
```

## Step 4 — While Claude Code works
It will ask you to run `firebase login` (a browser window opens; sign in with the Google account that owns the Firebase project) and possibly for the GitHub repo URL. Everything else it does itself. Expect 20–40 minutes.

## Step 5 — Put it on the phones (5 minutes)
1. Claude Code gives you a URL like `https://<username>.github.io/sofia-spotlight/`. Open it on YOUR phone in Safari first.
2. Tap **Create family space**. Write the join code down somewhere safe (it is the only thing protecting the data). Sofia's avatar, saved dances and note will already be there.
3. Tap Share → **Add to Home Screen** → Add. It opens like an app, full screen, with the bow icon.
4. On SOFIA's phone: open the same URL in Safari → tap **Join** → scan the QR from your phone or type the code → Share → Add to Home Screen.
5. Test: add a note on one phone, watch it appear on the other. Done.

## Ongoing
- Sofia wants a change → open Claude Code in this folder → say it in plain words → it pushes → both phones update on next open. If the change touches saved fields, add the words "keep stored data compatible."
- New event, song title, rehearsal time → edit inside the app on either phone (it syncs), or edit data/*.json and push.
- Once a month: Settings → Export backup → save to iCloud Drive or OneDrive.
- Firebase free tier covers this app many times over. The $1 budget alert is your safety net.
- If the join code ever leaks: Settings → Leave family space → Create a new one → Import backup → re-join from Sofia's phone.
