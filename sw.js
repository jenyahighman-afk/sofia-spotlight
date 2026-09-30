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
  "./js/media.js", "./js/ics.js", "./js/seed.js", "./js/backup.js", "./js/family.js", "./js/avatar.js",
  "./js/corrections.js", "./js/streak.js", "./js/badges.js", "./js/skills.js", "./js/reports.js", "./js/grownups.js", "./js/showme.js", "./js/player.js",
  "./js/games/choreo.js", "./js/games/oops.js", "./js/games/trio.js", "./js/games/compday.js", "./js/games/sparkle.js",
  "./js/views/home.js", "./js/views/dances.js", "./js/views/events.js", "./js/views/schedule.js", "./js/views/practice.js", "./js/views/notes.js", "./js/views/play.js", "./js/views/lists.js", "./js/views/settings.js", "./js/views/me.js", "./js/views/skillcheck.js",
  "./data/dances.json", "./data/events.json", "./data/classes.json", "./data/home-days.json", "./data/practice-items.json", "./data/phases.json", "./data/packs.json", "./data/aerial.json", "./data/season.json",
  "./data/styles.json", "./data/moves.json", "./data/avatar-options.json", "./data/oops.json", "./data/trio.json", "./data/compday.json", "./data/sparkle.json", "./data/skills.json",
  "./icons/icon.svg", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/icon-180.png", "./icons/icon-512-maskable.png"
];
const LIB_HOSTS = ["www.gstatic.com", "cdnjs.cloudflare.com", "cdn.jsdelivr.net", "fonts.googleapis.com", "fonts.gstatic.com"];
const isMedia = (url) => url.hostname === "firebasestorage.googleapis.com" || url.pathname.includes("/storage/v1/object/");

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(APP_CACHE).then((c) => c.addAll(APP_FILES)));
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith("spotlight-app-") && k !== APP_CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (e) => { if (e.data && e.data.type === "SKIP_WAITING") self.skipWaiting(); });

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
