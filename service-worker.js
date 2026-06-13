const CACHE_NAME = 'sm-dynamics-v3';

// App shell files: served network-first so updates show up immediately,
// with cache as an offline fallback only.
const APP_SHELL = [
  '/',
  '/index.html',
  '/repair.html',
  '/management.html',
  '/shop/app.js',
  '/shop/repair.js',
  '/shop/pwa.js',
  '/shop/management.js',
  '/shop/styles.css',
  '/service-worker.js'
];

// Static assets that rarely change: safe to cache-first.
const STATIC_ASSETS = [
  '/shop/brand%20logo.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(
        [...APP_SHELL, ...STATIC_ASSETS].map(url =>
          fetch(url, { credentials: 'same-origin', cache: 'no-cache' })
            .then(response => {
              if (!response.ok) throw new Error(`HTTP ${response.status}`);
              return cache.put(url, response);
            })
            .catch(err => console.warn('Failed to cache:', url, err.message))
        )
      )
    ).then(() => self.skipWaiting())
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
  const { request } = event;

  // Skip non-GET and API requests — always go to network for those
  if (request.method !== 'GET') return;
  if (request.url.includes('/api/')) return;

  const url = new URL(request.url);
  const isAppShell = APP_SHELL.some(path => url.pathname === path);

  if (isAppShell) {
    // Network-first: always try to get the latest HTML/JS/CSS so updates
    // are visible immediately. Fall back to cache only if offline.
    event.respondWith(
      fetch(request, { credentials: 'same-origin', cache: 'no-store' })
        .then(response => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request).then(cached => cached || caches.match('/index.html')))
    );
    return;
  }

  // Cache-first for static assets (images, fonts, etc.)
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request, { credentials: 'same-origin' })
        .then(response => {
          if (!response || !response.ok || response.type === 'opaque') return response;
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match('/index.html'));
    })
  );
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'BUST_PRODUCTS_CACHE') {
    caches.open(CACHE_NAME).then(cache => cache.delete('/api/products'));
  }
});
