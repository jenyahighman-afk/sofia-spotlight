// Cloud sync: Firebase anonymous auth + Firestore with offline persistence + media storage.
// Media goes through one small interface (upload / remove / download) with two implementations:
// Firebase Storage (default) and Supabase Storage (set mediaConfig.provider = "supabase" in firebase-config.js).
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, collection, doc, setDoc, deleteDoc, getDoc, onSnapshot, terminate, clearIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject, getBlob } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";
import { firebaseConfig, mediaConfig } from "./firebase-config.js";
import { COLLECTIONS, SCHEMA_VERSION, setBackend, receive } from "./store.js";
import { toast } from "./util.js";

export const FAMILY_KEY = "spotlight:family";
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I — the code gets typed by hand
export const FAMILY_RE = /^[A-Z2-9]{24}$/;

export const sync = { app:null, auth:null, db:null, storage:null, user:null, familyId:null, unsubs:[], online:navigator.onLine, pending:false, fromCache:true, error:null, lastSync:0 };
const statusListeners = new Set();
export function onStatus(fn){ statusListeners.add(fn); return () => statusListeners.delete(fn); }
function emitStatus(){ statusListeners.forEach(fn => { try { fn(sync); } catch (e) { console.error(e); } }); }
window.addEventListener("online", () => { sync.online = true; emitStatus(); });
window.addEventListener("offline", () => { sync.online = false; emitStatus(); });

export const getFamilyId = () => { const v = localStorage.getItem(FAMILY_KEY) || ""; return FAMILY_RE.test(v) ? v : null; };
export const normalizeFamilyId = (s) => String(s || "").toUpperCase().replace(/[^A-Z2-9]/g, "");
export const isValidFamilyId = (s) => FAMILY_RE.test(normalizeFamilyId(s));
export function newFamilyId(){ const a = new Uint8Array(24); crypto.getRandomValues(a); return [...a].map(b => ALPHABET[b % 32]).join(""); }

const withTimeout = (p, ms, msg) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(msg || "Timed out")), ms))]);

// Human-readable messages for the errors a family is likely to hit.
export function friendlyError(e){
  const code = (e && e.code) || "";
  if (code === "auth/admin-restricted-operation" || code === "auth/operation-not-allowed") return "Anonymous sign-in is switched off in Firebase (Authentication → Sign-in method).";
  if (code === "auth/network-request-failed" || code === "unavailable") return "No connection. Try again when you're online.";
  if (code === "permission-denied" || code === "storage/unauthorized") return "The cloud said no — the Firebase rules may not be deployed yet.";
  if (code === "storage/unknown" || code === "storage/bucket-not-found" || code === "storage/project-not-found") return "Firebase Storage isn't set up for this project.";
  if (code === "storage/retry-limit-exceeded" || code === "storage/canceled") return "Upload didn't finish — check the connection and try again.";
  if (code === "storage/quota-exceeded") return "Storage is full.";
  return (e && e.message) || String(e);
}

export async function initFirebase(){
  sync.app = initializeApp(firebaseConfig);
  sync.db = initializeFirestore(sync.app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
  sync.auth = getAuth(sync.app);
  sync.storage = getStorage(sync.app);
  sync.user = await new Promise((res, rej) => {
    let tried = false;
    const off = onAuthStateChanged(sync.auth, u => { if (u) { off(); res(u); } else if (!tried) { tried = true; signInAnonymously(sync.auth).catch(e => { off(); rej(e); }); } }, rej);
  });
  setBackend(backend);
  return sync.user;
}

const famDoc = (id) => doc(sync.db, "families", id);
const docRef = (col, id) => doc(sync.db, "families", sync.familyId, col, id);

// Writes are applied to the local cache instantly (and queued while offline); we don't wait for the server so the UI never hangs offline.
const backend = {
  set: (col, id, data) => { setDoc(docRef(col, id), data).catch(e => { console.warn("write failed", col, id, e); sync.error = e.code || e.message; emitStatus(); toast("Couldn't save to the cloud: " + friendlyError(e), 3000); }); return Promise.resolve(); },
  del: (col, id) => { deleteDoc(docRef(col, id)).catch(e => { console.warn("delete failed", col, id, e); sync.error = e.code || e.message; emitStatus(); toast("Couldn't delete in the cloud: " + friendlyError(e), 3000); }); return Promise.resolve(); },
};

export function startWatching(familyId){
  stopWatching(); sync.familyId = familyId; sync.error = null;
  for (const col of COLLECTIONS) {
    const unsub = onSnapshot(collection(sync.db, "families", familyId, col), { includeMetadataChanges: true }, snap => {
      const docs = {}; snap.forEach(d => { docs[d.id] = d.data(); });
      receive(col, docs);
      sync.pending = snap.metadata.hasPendingWrites; sync.fromCache = snap.metadata.fromCache; if (!snap.metadata.fromCache) sync.lastSync = Date.now(); sync.error = null; emitStatus();
    }, err => { console.warn("sync listener failed", col, err); sync.error = err.code || err.message; emitStatus(); });
    sync.unsubs.push(unsub);
  }
}
export function stopWatching(){ sync.unsubs.forEach(u => { try { u(); } catch (e) {} }); sync.unsubs = []; }

export async function createFamily(){
  if (!sync.online) throw new Error("You need to be online to create a family space.");
  const id = newFamilyId();
  await withTimeout(setDoc(famDoc(id), { createdAt: Date.now(), schema: SCHEMA_VERSION, app: "sofia-spotlight" }), 20000, "Couldn't reach the cloud. Check the connection and try again.");
  localStorage.setItem(FAMILY_KEY, id);
  return id;
}
export async function markSeeded(id){ try { await setDoc(famDoc(id), { seededAt: Date.now() }, { merge: true }); } catch (e) { console.warn(e); } }

export async function joinFamily(code){
  const id = normalizeFamilyId(code);
  if (!FAMILY_RE.test(id)) throw new Error("A join code is 24 letters and numbers.");
  try {
    const snap = await withTimeout(getDoc(famDoc(id)), 12000, "offline");
    if (!snap.exists()) throw Object.assign(new Error("No family space has that code. Check it and try again."), { code: "no-family" });
  } catch (e) {
    if (e.code === "no-family" || e.code === "permission-denied") throw e;
    console.warn("join: couldn't verify the code now, joining anyway", e); // offline: the data arrives once we're back online
  }
  localStorage.setItem(FAMILY_KEY, id);
  return id;
}

// Forget the code on this device and drop the local cache. Cloud data stays where it is.
export async function leaveFamily(){
  stopWatching(); localStorage.removeItem(FAMILY_KEY);
  try { await terminate(sync.db); await clearIndexedDbPersistence(sync.db); } catch (e) { console.warn("could not clear local cache", e); }
  location.replace(location.pathname);
}

// ---------- MEDIA ----------
const mediaPath = (kind, id) => `families/${sync.familyId}/${kind}/${id}`;

const firebaseMedia = {
  name: "firebase",
  async upload(kind, id, blob, meta = {}){
    const path = mediaPath(kind, id); const r = ref(sync.storage, path);
    const metadata = { contentType: meta.contentType || blob.type || "application/octet-stream", cacheControl: "public, max-age=31536000, immutable" };
    if (meta.name) metadata.customMetadata = { name: String(meta.name).slice(0, 200) };
    await new Promise((res, rej) => { const task = uploadBytesResumable(r, blob, metadata); task.on("state_changed", s => meta.onProgress && meta.onProgress(s.bytesTransferred / Math.max(1, s.totalBytes)), rej, res); });
    return { path, url: await getDownloadURL(r) };
  },
  async remove(path){ await deleteObject(ref(sync.storage, path)); },
  // Reading a file back (backup export) needs the bucket's CORS config (see README → "Storage CORS"). Without it the
  // browser refuses instantly, so fetch the stored download URL first and fail fast instead of letting the SDK retry for minutes.
  async download(path, url){
    if (url) { const res = await withTimeout(fetch(url), 20000, "download timed out"); if (!res.ok) throw new Error("download failed: " + res.status); return res.blob(); }
    return withTimeout(getBlob(ref(sync.storage, path)), 20000, "download timed out");
  },
};

const supabaseMedia = {
  name: "supabase",
  cfg(){ const { url, anonKey, bucket = "spotlight" } = mediaConfig; if (!url || !anonKey) throw new Error("Supabase URL and anon key are missing in js/firebase-config.js"); return { url: url.replace(/\/$/, ""), anonKey, bucket }; },
  async upload(kind, id, blob, meta = {}){
    const { url, anonKey, bucket } = this.cfg(); const path = mediaPath(kind, id);
    const res = await fetch(`${url}/storage/v1/object/${bucket}/${path}`, { method: "POST", headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, "Content-Type": meta.contentType || blob.type || "application/octet-stream", "x-upsert": "true", "cache-control": "31536000" }, body: blob });
    if (!res.ok) throw new Error("Supabase upload failed: " + res.status + " " + (await res.text()).slice(0, 200));
    return { path, url: `${url}/storage/v1/object/public/${bucket}/${path}` };
  },
  async remove(path){ const { url, anonKey, bucket } = this.cfg(); const res = await fetch(`${url}/storage/v1/object/${bucket}/${path}`, { method: "DELETE", headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } }); if (!res.ok && res.status !== 404) throw new Error("Supabase delete failed: " + res.status); },
  async download(path, url){ const cfg = this.cfg(); const res = await withTimeout(fetch(url || `${cfg.url}/storage/v1/object/public/${cfg.bucket}/${path}`), 20000, "download timed out"); if (!res.ok) throw new Error("Download failed: " + res.status); return res.blob(); },
};

export const media = (mediaConfig && mediaConfig.provider === "supabase") ? supabaseMedia : firebaseMedia;
