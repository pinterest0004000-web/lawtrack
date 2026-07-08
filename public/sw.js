// INSAF - Service Worker for Offline Support
const CACHE_NAME = 'insaf-v4';

// Pre-cache critical assets on install
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/logo.png',
];

// Install - pre-cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch(() => {
        // If pre-cache fails (e.g. / returns non-200 on some hosts), just cache what we can
        return Promise.allSettled(
          PRECACHE_URLS.map((url) =>
            fetch(url).then((res) => {
              if (res.ok) cache.put(url, res);
            }).catch(() => {})
          )
        );
      });
    })
  );
  self.skipWaiting();
});

// Activate - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch - serve from cache when offline
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Skip non-http(s) requests (e.g. chrome-extension, data)
  if (!url.protocol.startsWith('http')) return;

  // Skip external API calls - let them fail naturally
  if (
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('sentry.io') ||
    url.hostname.includes('firebaseapp.com') ||
    url.hostname.includes('google.com') ||
    url.hostname.includes('gstatic.com')
  ) return;

  // === Strategy 1: Next.js static assets (/_next/static/) ===
  // These have content hashes in filenames, so they never change.
  // Use cache-first strategy.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => {
          // Static asset not in cache and offline - return empty/error
          return new Response('Offline', { status: 503 });
        });
      })
    );
    return;
  }

  // === Strategy 2: Navigation requests (HTML pages) ===
  // Network-first, fallback to cached root page
  if (event.request.mode === 'navigate' || url.pathname === '/') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          // Offline - serve cached root page
          return caches.match('/').then((cached) => {
            if (cached) return cached;
            return new Response(
              '<html><body><h1>INSAF</h1><p>App load karne ke liye internet chahiye. Phir try karein.</p></body></html>',
              { headers: { 'Content-Type': 'text/html' }, status: 503 }
            );
          });
        })
    );
    return;
  }

  // === Strategy 3: Everything else (images, fonts, etc.) ===
  // Stale-while-revalidate
  event.respondWith(
    caches.match(event.request).then((cached) => {
      // Always start fetch in background to update cache
      const fetchPromise = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          // Fetch failed (offline) - return cached if available
          return cached;
        });

      // Return cached immediately if available, otherwise wait for fetch
      return cached || fetchPromise;
    })
  );
});