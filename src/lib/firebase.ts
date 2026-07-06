import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { getFirestore } from 'firebase/firestore';

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

// Firestore for cloud backup
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

// Error reporting — sends to Sentry + stores locally as fallback
export const reportError = (error: Error, context?: string) => {
  try {
    const msg = `[LawTrack Error${context ? ` - ${context}` : ''}] ${error.message}`;
    console.error(msg, error.stack);

    // Send to Sentry (if configured)
    if (typeof window !== 'undefined') {
      try {
        // Dynamic import to avoid SSR issues
        import('@sentry/browser').then(Sentry => {
          Sentry.captureException(error, { tags: { context: context || 'unknown' } });
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