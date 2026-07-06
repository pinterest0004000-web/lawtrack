'use client';

import * as Sentry from '@sentry/browser';

let initialized = false;

export const initSentry = () => {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  Sentry.init({
    dsn: 'https://0dcfdc1193d2305fe838dae0892e0414@o4511690752262144.ingest.us.sentry.io/4511690809344000',
    environment: process.env.NODE_ENV || 'development',
    // Capture 100% of errors in dev, 50% in prod to save quota
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.5 : 1.0,
    // Only send errors, not performance (saves quota)
    enablePerformanceMonitoring: false,
    // Group similar errors
    maxBreadcrumbs: 5,
    // Don't send local dev URLs
    beforeSend(event) {
      if (event.request?.url?.includes('localhost')) {
        event.tags = event.tags || {};
        event.tags.environment = 'local-dev';
      }
      return event;
    },
  });
};

export const captureError = (error: Error, context?: string) => {
  if (typeof window === 'undefined') return;
  initSentry(); // ensure init
  Sentry.captureException(error, {
    tags: {
      app: 'LawTrack',
      context: context || 'unknown',
    },
    extra: {
      url: window.location.href,
      userAgent: navigator.userAgent?.slice(0, 200),
    },
  });
};

export default Sentry;