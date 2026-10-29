/* Service worker: cache-first app shell keyed by APP_VERSION, runtime caches for the pinned CDN libraries, fonts and family media.
   A new version installs in the background and takes over on the next open (no mid-session swaps). */
importScripts("js/version.js");
const VERSION = self.APP_VERSION;
const APP_CACHE = "spotlight-app-" + VERSION;
const LIB_CACHE = "spotlight-libs";    // pinned CDN URLs never change, so this survives app updates
const MEDIA_CACHE = "spotlight-media"; // photos, files, music, videos from the family space

const APP_FILES = [
  "./", "./index.html", "./manifest.json", "./css/app.css",
  "./js/version.js", "./js/app.js", "./js/util.js", "./js/data.js", "./js/store.js", "./js/nav.js", "./js/sync.js", "./js/firebase-config.js",
  "./js/media.js", "./js/push-config.js", "./js/remind.js", "./js/ics.js", "./js/seed.js", "./js/backup.js", "./js/family.js", "./js/avatar.js",
  "./js/corrections.js", "./js/seasons.js", "./icons/season/halloween/web.svg", "./icons/season/halloween/web-light.svg", "./icons/season/halloween/web-hero.svg", "./icons/season/halloween/spider.svg", "./icons/season/halloween/spider-light.svg", "./icons/season/halloween/bat.svg", "./icons/season/halloween/bat-light.svg", "./icons/season/halloween/hat.svg", "./icons/season/halloween/witch.svg", "./icons/season/halloween/strand.svg", "./icons/season/halloween/night.svg", "./icons/season/halloween/pattern.svg", "./js/streak.js", "./js/badges.js", "./js/skills.js", "./js/reports.js", "./js/grownups.js", "./js/showme.js", "./js/player.js", "./js/cues.js", "./js/stage.js", "./js/pmode.js", "./js/quick.js", "./js/plan.js", "./js/planToday.js", "./js/demos.js", "./js/drills.js", "./js/pet.js", "./js/advent.js", "./js/dares.js", "./js/news.js", "./js/buddy.js", "./js/voice.js", "./js/who.js", "./js/memo.js", "./js/workouts.js", "./js/workouts-core.js", "./js/dayplan.js", "./js/stars.js", "./js/coach.js", "./js/mode.js", "./js/teacher.js", "./js/bites.js", "./js/mind.js", "./js/prompter.js", "./js/palette.js", "./js/runcheck.js", "./js/coachhub.js", "./js/goals.js", "./js/frames.js", "./js/videoframes.js", "./js/pose.js", "./js/posemath.js", "./js/games/mirror.js", "./js/games/along.js", "./js/cards.js",
  "./js/costume.js",
  "./js/glow.js", "./js/lineup.js",
  "./js/track.js", "./js/cuecards.js", "./js/cuecheck.js", "./js/memorize.js", "./js/season15.js", "./js/studio.js", "./js/daykind.js","./js/howto.js", "./js/trickdrill.js", "./js/dancer.js", "./js/habit.js", "./js/moments.js",
  "./js/ready.js", "./js/pass.js", "./js/sunday.js", "./js/momweek.js",
  "./js/games/choreo.js", "./js/games/oops.js", "./js/games/nextmove.js", "./js/games/quest.js", "./js/games/trio.js", "./js/games/compday.js", "./js/games/sparkle.js",
  "./js/games/teach.js", "./js/games/count.js",
  "./js/views/home.js", "./js/views/dances.js", "./js/views/events.js", "./js/views/schedule.js", "./js/views/practice.js", "./js/views/notes.js", "./js/views/play.js", "./js/views/lists.js", "./js/views/settings.js", "./js/views/me.js", "./js/views/skillcheck.js",
  "./data/dances.json", "./data/events.json", "./data/classes.json", "./data/home-days.json", "./data/practice-items.json", "./data/phases.json", "./data/packs.json", "./data/aerial.json", "./data/season.json",
  "./data/styles.json", "./data/moves.json", "./data/avatar-options.json", "./data/daily.json", "./data/mind.json", "./data/oops.json", "./data/trio.json", "./data/compday.json", "./data/sparkle.json", "./data/skills.json", "./data/practice-pool.json", "./data/exercises.json", "./data/plan10.json", "./data/workout-presets.json", "./data/pet.json", "./data/advent.json", "./data/dares.json", "./data/news.json", "./data/buddy.json", "./data/costumes.json", "./data/plan15.json", "./data/plan-spring.json", "./data/howto.json", "./data/pass.json",
  "./icons/icon.svg", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/icon-180.png", "./icons/icon-512-maskable.png"
];
const LIB_HOSTS = ["www.gstatic.com", "cdnjs.cloudflare.com", "cdn.jsdelivr.net", "fonts.googleapis.com", "fonts.gstatic.com", "storage.googleapis.com"]; // storage.googleapis.com = the MediaPipe pose model
const isMedia = (url) => url.hostname === "firebasestorage.googleapis.com" || url.pathname.includes("/storage/v1/object/");

// Install: every app file is fetched fresh, past the browser's HTTP cache (cache: "reload") and past GitHub's edge cache
// (the query names the version, so the CDN can't answer with a copy from before the deploy), then stored under its plain URL.
// Without this an install in the first ~10 minutes after a deploy could cache last version's files under the new version's name.
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(APP_CACHE).then((c) => Promise.all(APP_FILES.map(async (u) => {
    const res = await fetch(new Request(u + "?v=" + encodeURIComponent(VERSION), { cache: "reload" }));
    if (!res.ok) throw new Error("install: " + u + " → " + res.status);
    await c.put(u, res);
  }))));
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith("spotlight-app-") && k !== APP_CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (e) => { if (e.data && e.data.type === "SKIP_WAITING") self.skipWaiting(); });

// Daily reminder (web push from the worker): show it; tapping it opens or focuses the app.
self.addEventListener("push", (e) => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "Sofia's Spotlight", { body: d.body || "Dance bite time ✨", icon: "icons/icon-192.png", badge: "icons/icon-192.png", tag: d.tag || "dance-bite", data: { url: d.url || "./" } }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close(); const target = new URL((e.notification.data && e.notification.data.url) || "./", self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(cs => { const c = cs.find(x => x.url.startsWith(self.registration.scope)); return c ? c.focus() : self.clients.openWindow(target); }));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // App shell: cache first, then network (and remember what we fetched, e.g. seed data and the printable files).
  if (url.origin === self.location.origin) {
    e.respondWith((async () => {
      const cache = await caches.open(APP_CACHE);
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      try { const res = await fetch(req); if (res.ok) cache.put(req, res.clone()); return res; }
      catch (err) { if (req.mode === "navigate") { const shell = await cache.match("./index.html"); if (shell) return shell; } throw err; }
    })());
    return;
  }

  // Pinned libraries and fonts: cache first, forever.
  if (LIB_HOSTS.includes(url.hostname)) {
    e.respondWith((async () => {
      const cache = await caches.open(LIB_CACHE);
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req); if (res.ok || res.type === "opaque") cache.put(req, res.clone()); return res;
    })());
    return;
  }

  // Family media: cache first so photos, files and music open offline. Range requests (audio/video scrubbing) pass straight through.
  // An <img> stores an opaque copy; a script that needs to read the bytes (backup export) must not be served that copy.
  if (isMedia(url) && !req.headers.has("range")) {
    e.respondWith((async () => {
      const cache = await caches.open(MEDIA_CACHE);
      const hit = await cache.match(req);
      if (hit && (req.mode === "no-cors" || hit.type !== "opaque")) return hit;
      const res = await fetch(req); if (res.ok || (res.type === "opaque" && !hit)) cache.put(req, res.clone()); return res;
    })());
    return;
  }
  // Everything else (Firestore, auth) goes straight to the network.
});
