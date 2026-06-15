// ============================================================
// SM Dynamics — Service Worker
// Strategy: NETWORK FIRST always. Cache is emergency fallback only.
// API calls are NEVER cached. Edits always reach the server.
// ============================================================

const CACHE_NAME = 'sm-dynamics-v6';

// Only cache static shell files — never API data
const STATIC_SHELL = [
  '/',
  '/index.html',
  '/repair.html',
  '/management.html',
  '/shop/styles.css'
];

// Paths that must NEVER be cached under any circumstances
const NEVER_CACHE = [
  '/api/',
  '/auth/',
  'chrome-extension://',
  'socket.io'
];

function shouldNeverCache(url) {
  return NEVER_CACHE.some(path => url.includes(path));
}

// ── Install: cache static shell only ──────────────────────
self.addEventListener('install', event => {
  console.log('[SW] Installing v6...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_SHELL))
      .then(() => {
        console.log('[SW] Static shell cached');
        return self.skipWaiting(); // Activate immediately
      })
      .catch(err => {
        console.error('[SW] Install failed:', err);
        // Don't block install if a shell file is missing
        return self.skipWaiting();
      })
  );
});

// ── Activate: wipe ALL old caches immediately ──────────────
self.addEventListener('activate', event => {
  console.log('[SW] Activating v6, clearing old caches...');
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      ))
      .then(() => {
        console.log('[SW] All old caches cleared');
        return self.clients.claim(); // Take control of all pages immediately
      })
  );
});

// ── Fetch: network-first, hard bypass for API ─────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = request.url;

  // Skip non-GET and non-http(s)
  if (request.method !== 'GET') return;
  if (!url.startsWith('http')) return;

  // API / auth / socket — always go straight to network, no caching
  if (shouldNeverCache(url)) {
    event.respondWith(
      fetch(request, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache' }
      })
    );
    return;
  }

  // Static shell files — network first, cache as fallback
  event.respondWith(
    fetch(request, { cache: 'no-store' })
      .then(response => {
        // Only cache valid 200 responses for static files
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => {
        // Network failed — serve from cache if we have it
        return caches.match(request).then(cached => {
          if (cached) {
            console.log('[SW] Serving from cache (offline):', url);
            return cached;
          }
          // Nothing in cache — return offline page if it's a navigation
          if (request.mode === 'navigate') {
            return caches.match('/index.html');
          }
          return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
        });
      })
  );
});

// ── Messages from the app ─────────────────────────────────
self.addEventListener('message', event => {
  const type = event.data?.type;

  if (type === 'SKIP_WAITING') {
    console.log('[SW] Skip waiting requested');
    self.skipWaiting();
  }

  if (type === 'CLEAR_CACHE') {
    console.log('[SW] Full cache clear requested');
    caches.delete(CACHE_NAME).then(() => {
      event.source?.postMessage({ type: 'CACHE_CLEARED' });
    });
  }

  // Legacy bust from old management.js — handle gracefully
  if (type === 'BUST_PRODUCTS_CACHE') {
    console.log('[SW] Products cache bust requested (no-op — API never cached)');
    event.source?.postMessage({ type: 'PRODUCTS_CACHE_BUSTED' });
  }
});
