// No-op stand-ins for the Firebase SDK exports js/sync.js imports. The smoke tests never touch the network.
const noop = () => {};
const fn = () => ({});
export const initializeApp = fn, getAuth = fn, signInAnonymously = async () => ({}), onAuthStateChanged = () => noop;
export const initializeFirestore = fn, persistentLocalCache = fn, persistentMultipleTabManager = fn, collection = fn, doc = fn;
export const setDoc = async () => {}, deleteDoc = async () => {}, getDoc = async () => ({ exists: () => true }), onSnapshot = () => noop, terminate = async () => {}, clearIndexedDbPersistence = async () => {};
export const getStorage = fn, ref = fn, uploadBytesResumable = () => ({ on: noop }), getDownloadURL = async () => "", deleteObject = async () => {}, getBlob = async () => new Blob([]);
