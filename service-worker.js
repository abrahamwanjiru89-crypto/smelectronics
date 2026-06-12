const CACHE_NAME = 'sm-dynamics-v1';

// Only cache files that are guaranteed to exist
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/shop/app.js',
  '/shop/pwa.js',
  '/shop/repair.js',
  '/shop/management.js',
];

// Install: cache static assets, skip on failure
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(
        urlsToCache.map(url =>
          cache.add(url).catch(err => console.warn('Failed to cache:', url, err))
        )
      )
    )
  );
})

// Activate: remove old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: network first, fall back to cache
self.addEventListener('fetch', event => {
  // Skip non-GET and cross-origin requests
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith(self.location.origin)) return;

  // For API calls: network only, no caching
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache successful responses
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// Handle SKIP_WAITING message from pwa.js
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
