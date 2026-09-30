// Single source of truth for the app version. Bump it on every release: the service worker (sw.js) uses it to name its
// cache, so a new number is what makes phones pick up new files on their next open. Loaded as a classic script by both
// index.html and sw.js (importScripts), which is why it sets a global instead of using export.
self.APP_VERSION = "1.2.0";
