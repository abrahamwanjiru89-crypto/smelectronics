const CACHE_NAME = 'sm-dynamics-v2';

const urlsToCache = [
  '/',
  '/index.html',
  '/repair.html',
  '/management.html',
  '/shop/app.js',
  '/shop/repair.js',
  '/shop/pwa.js',
  '/shop/management.js',
  '/shop/styles.css',
  '/service-worker.js',
  '/shop/brand%20logo.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(
        urlsToCache.map(url =>
          fetch(url, { credentials: 'same-origin', cache: 'no-cache' })
            .then(response => {
              if (!response.ok) throw new Error(`HTTP ${response.status}`);
              return cache.put(url, response);
            })
            .catch(err => console.warn('Failed to cache:', url, err.message))
        )
      )
    )
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  // Skip non-GET and API requests — always go to network for those
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('/api/')) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request, { credentials: 'same-origin' })
        .then(response => {
          if (!response || !response.ok || response.type === 'opaque') return response;
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match('/index.html')); // fallback for offline
    })
  );
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'BUST_PRODUCTS_CACHE') {
    caches.open(CACHE_NAME).then(cache => cache.delete('/api/products'));
  }
});
