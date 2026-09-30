// A tiny fake browser for the smoke tests: enough window/document/navigator for every view module to import and render
// in Node. Elements remember innerHTML/textContent/value so tests can assert what a render produced. Not a DOM.
export class El {
  constructor(tag = "div", sel = ""){ this.tagName = tag.toUpperCase(); this.sel = sel; this.innerHTML = ""; this.textContent = ""; this.value = ""; this.hidden = false; this.disabled = false; this.checked = false; this.style = {}; this.dataset = {}; this.options = []; this.files = []; this.children = []; this.classList = { _s: new Set(), add: (...c) => c.forEach(x => this.classList._s.add(x)), remove: (...c) => c.forEach(x => this.classList._s.delete(x)), toggle: (c, f) => { const on = f === undefined ? !this.classList._s.has(c) : !!f; on ? this.classList._s.add(c) : this.classList._s.delete(c); return on; }, contains: (c) => this.classList._s.has(c) }; this.listeners = {}; }
  addEventListener(t, fn){ (this.listeners[t] ||= []).push(fn); } removeEventListener(){} dispatchEvent(){ return true; }
  querySelector(){ return null; } querySelectorAll(){ return []; } closest(){ return this; } getBoundingClientRect(){ return { left: 0, top: 0, width: 300, height: 40 }; }
  appendChild(c){ this.children.push(c); return c; } prepend(c){ this.children.unshift(c); return c; } remove(){} focus(){} blur(){} click(){ if (typeof this.onclick === "function") this.onclick({ target: this }); } scrollIntoView(){} setAttribute(k, v){ this[k] = v; } getAttribute(k){ return this[k]; }
  get offsetLeft(){ return 0; }
}
const byId = new Map();
export function el(sel){ if (!byId.has(sel)) byId.set(sel, new El("div", sel)); return byId.get(sel); }
export function resetDom(){ byId.clear(); }
export function installEnv(){
  const storage = () => { const m = new Map(); return { getItem: (k) => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), clear: () => m.clear() }; };
  const win = globalThis;
  win.window = win; win.self = win; win.APP_VERSION = "test";
  win.document = { querySelector: (s) => el(s), querySelectorAll: () => [], getElementById: (id) => el("#" + id), createElement: (t) => new El(t), body: new El("body"), head: new El("head"), activeElement: null, addEventListener(){}, removeEventListener(){}, dispatchEvent(){ return true; }, visibilityState: "visible" };
  Object.defineProperty(win, "navigator", { value: { onLine: true, userAgent: "node-test", language: "en-US" }, configurable: true, writable: true });
  win.localStorage = storage(); win.sessionStorage = storage();
  win.location = { href: "http://localhost/", pathname: "/", search: "", hash: "", origin: "http://localhost" }; win.history = { replaceState(){} };
  win.addEventListener = () => {}; win.removeEventListener = () => {}; win.scrollTo = () => {}; win.innerWidth = 390; win.innerHeight = 844;
  win.requestAnimationFrame = (fn) => setTimeout(fn, 16); win.cancelAnimationFrame = (id) => clearTimeout(id);
  win.CustomEvent = class { constructor(type, init){ this.type = type; this.detail = init && init.detail; } };
  win.Event = win.Event || class { constructor(type){ this.type = type; } };
  win.prompt = () => null; win.confirm = () => false; win.alert = () => {};
  win.speechSynthesis = { cancel(){}, speak(){} }; win.SpeechSynthesisUtterance = class {};
  win.URL = win.URL || class {}; win.URL.createObjectURL = () => "blob:test"; win.URL.revokeObjectURL = () => {};
  win.performance = win.performance || { now: () => Date.now() };
}
