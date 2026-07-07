import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { getFirestore } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged, type User } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyCrpK5HE3a29d84peHoxerpbybeXulKla4",
  authDomain: "lawtrack-29b52.firebaseapp.com",
  projectId: "lawtrack-29b52",
  storageBucket: "lawtrack-29b52.firebasestorage.app",
  messagingSenderId: "707165908591",
  appId: "1:707165908591:web:2b4c8dca81257a71a2679a",
  measurementId: "G-QPY4R89QN3"
};

let app = null;

try {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
} catch (e) {
  console.error('Firebase init error:', e);
}

// Auth
export const auth = app ? getAuth(app) : null;

// Firestore for cloud backup
export const db = app ? getFirestore(app) : null;

// Track Firebase auth state
export let firebaseUser: User | null = null;
if (typeof window !== 'undefined' && auth) {
  onAuthStateChanged(auth, (user) => { firebaseUser = user; });
}

/** Sign in anonymously to Firebase Auth — used after PIN verification */
export async function firebaseAnonSignIn(userId: string): Promise<boolean> {
  if (!auth) return false;
  try {
    // Check if already signed in
    if (auth.currentUser) return true;
    await signInAnonymously(auth);
    return true;
  } catch {
    return false;
  }
}

/** Sign out from Firebase Auth */
export async function firebaseSignOut(): Promise<void> {
  if (!auth) return;
  try { await auth.signOut(); } catch { /* silent */ }
  firebaseUser = null;
}

// Analytics (only if supported)
export const initAnalytics = async () => {
  try {
    if (typeof window === 'undefined' || !app) return null;
    const supported = await isSupported();
    if (supported) return getAnalytics(app);
    return null;
  } catch {
    return null;
  }
};

// Error reporting — sends to Sentry + stores locally as fallback
export const reportError = (error: Error, context?: string) => {
  try {
    const msg = `[LawTrack Error${context ? ` - ${context}` : ''}] ${error.message}`;
    console.error(msg, error.stack);

    // Send to Sentry (client-side only)
    if (typeof window !== 'undefined') {
      try {
        import('./sentry').then(({ captureError }) => {
          captureError(error, context);
        }).catch(() => {});
      } catch { /* Sentry not available */ }
    }

    // Fallback: store errors locally
    if (typeof window !== 'undefined') {
      try {
        const key = 'lw_error_log';
        const existing = localStorage.getItem(key);
        const errors = existing ? JSON.parse(existing) : [];
        errors.push({
          message: error.message,
          stack: error.stack?.slice(0, 500),
          context,
          timestamp: Date.now(),
          url: window.location.href,
          userAgent: navigator.userAgent?.slice(0, 200),
        });
        // Keep only last 50 errors
        if (errors.length > 50) errors.splice(0, errors.length - 50);
        localStorage.setItem(key, JSON.stringify(errors));
      } catch { /* silent */ }
    }
  } catch { /* silent */ }
};

export default app;