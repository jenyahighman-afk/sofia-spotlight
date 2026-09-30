// Registered with `node --import ./tests/_register.mjs`: routes the Firebase CDN imports in js/sync.js to a local stub so
// the view modules can be imported in Node for the smoke tests. Everything else resolves normally.
import { register } from "node:module";
register("./_loader.mjs", import.meta.url);
