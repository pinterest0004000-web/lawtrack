/**
 * Sentry Crash Reporting Init
 * Call initSentry() once on app load (client-side only)
 */

let sentryInitialized = false;

export function initSentry(dsn: string) {
  if (sentryInitialized || typeof window === 'undefined') return;
  if (!dsn || dsn.includes('PLACEHOLDER')) return;

  try {
    import('@sentry/browser').then(Sentry => {
      Sentry.init({
        dsn,
        // Performance monitoring — disabled to save credits
        tracesSampleRate: 0,
        // Session replay — disabled
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: 0,
        // Error sampling — capture 100% of errors (free tier: 5000/month)
        sampleRate: 1,
        // Don't send in development
        enabled: process.env.NODE_ENV === 'production',
        // Environment info
        environment: 'production',
        release: 'lawtrack@1.0.0',
      });
      sentryInitialized = true;
      console.log('[Sentry] Initialized');
    }).catch(() => {});
  } catch { /* Sentry not available */ }
}

export function isSentryReady(): boolean {
  return sentryInitialized;
}