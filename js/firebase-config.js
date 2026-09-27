export const firebaseConfig = {
  apiKey: "AIzaSyBTuYAo-gRHFogdXWm09HwC4WR6OsdjH3I",
  authDomain: "sofia-spotlight.firebaseapp.com",
  projectId: "sofia-spotlight",
  storageBucket: "sofia-spotlight.firebasestorage.app",
  messagingSenderId: "431480017419",
  appId: "1:431480017419:web:6217da8b993670189ded0e"
};

// Where photos, files, music and video clips are stored.
// Default: Firebase Storage. If Storage isn't available for the project, switch to Supabase Storage (a public bucket):
//   export const mediaConfig = { provider: "supabase", url: "https://YOUR-PROJECT.supabase.co", anonKey: "YOUR-ANON-KEY", bucket: "spotlight" };
export const mediaConfig = { provider: "firebase" };
