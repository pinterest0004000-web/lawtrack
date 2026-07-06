import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyB1234567890placeholder",
  authDomain: "lawtrack-app.firebaseapp.com",
  projectId: "lawtrack-app",
  storageBucket: "lawtrack-app.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:0000000000000000",
  measurementId: "G-XXXXXXXXXX"
};

let app = null;
try {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
} catch (e) {
  console.error('Firebase init error:', e);
}

// Firestore for backup sync
export const db = app ? getFirestore(app) : null;

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

// Simple error reporting fallback since Crashlytics requires native SDK
export const reportError = (error: Error, context?: string) => {
  try {
    const msg = `[LawTrack Error${context ? ` - ${context}` : ''}] ${error.message}`;
    console.error(msg, error.stack);
    // Store errors locally for later sync
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