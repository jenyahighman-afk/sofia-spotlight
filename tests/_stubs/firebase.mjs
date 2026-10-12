// No-op stand-ins for the Firebase SDK exports js/sync.js imports. The smoke tests never touch the network.
const noop = () => {};
const fn = () => ({});
export const initializeApp = fn, getAuth = fn, signInAnonymously = async () => ({}), onAuthStateChanged = () => noop;
export const initializeFirestore = fn, persistentLocalCache = fn, persistentMultipleTabManager = fn, collection = fn, doc = fn;
export const setDoc = async () => {}, deleteDoc = async () => {}, getDoc = async () => ({ exists: () => true }), onSnapshot = () => noop, terminate = async () => {}, clearIndexedDbPersistence = async () => {};
// Storage: an upload finishes at once; ref() keeps its path so a test can see which stored files were removed.
export const removedPaths = [];
export const getStorage = fn, ref = (_s, path) => ({ path }), uploadBytesResumable = () => ({ on: (_ev, _progress, _fail, done) => done && done() }), getDownloadURL = async (r) => "https://stub.test/" + r.path, deleteObject = async (r) => { removedPaths.push(r.path); }, getBlob = async () => new Blob([]);
