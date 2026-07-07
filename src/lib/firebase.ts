import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged, type Auth, type User } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || ""
};

// Lazy initialization — only runs on client side
let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;
let _initAttempted = false;

function initFirebase() {
  if (_initAttempted || typeof window === 'undefined') return;
  _initAttempted = true;

  // Skip if no API key configured
  if (!firebaseConfig.apiKey) {
    console.warn('Firebase: No API key configured. Cloud backup disabled.');
    return;
  }

  try {
    _app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    _auth = getAuth(_app);
    _db = getFirestore(_app);
  } catch (e) {
    console.error('Firebase init error:', e);
  }
}

// Getters that lazily initialize
export function getFirebaseApp(): FirebaseApp | null {
  initFirebase();
  return _app;
}

export function getFirebaseAuth(): Auth | null {
  initFirebase();
  return _auth;
}

export function getFirebaseDb(): Firestore | null {
  initFirebase();
  return _db;
}

// Track Firebase auth state
export let firebaseUser: User | null = null;
if (typeof window !== 'undefined') {
  // Delay listener setup to avoid SSR issues
  if (typeof window !== 'undefined') {
    const checkAuth = () => {
      const a = getFirebaseAuth();
      if (a) {
        onAuthStateChanged(a, (user) => { firebaseUser = user; });
      }
    };
    // Run after page loads
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', checkAuth);
    } else {
      checkAuth();
    }
  }
}

/** Sign in anonymously to Firebase Auth — used after PIN verification */
export async function firebaseAnonSignIn(userId: string): Promise<boolean> {
  const a = getFirebaseAuth();
  if (!a) return false;
  try {
    if (a.currentUser) return true;
    await signInAnonymously(a);
    return true;
  } catch {
    return false;
  }
}

/** Sign out from Firebase Auth */
export async function firebaseSignOut(): Promise<void> {
  const a = getFirebaseAuth();
  if (!a) return;
  try { await a.signOut(); } catch { /* silent */ }
  firebaseUser = null;
}

// Error reporting — sends to Sentry + stores locally as fallback
export const reportError = (error: Error, context?: string) => {
  try {
    const msg = `[INSAF Error${context ? ` - ${context}` : ''}] ${error.message}`;
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