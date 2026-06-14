const CACHE_NAME = 'sm-dynamics-v4';  // ← CHANGED VERSION NUMBER to force update

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
  console.log('🔧 Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      // Delete old cached files first
      const keys = await caches.keys();
      for (const key of keys) {
        if (key !== CACHE_NAME) {
          await caches.delete(key);
          console.log('🗑️ Deleted old cache:', key);
        }
      }
      
      // Cache new files
      const cachePromises = [...APP_SHELL, ...STATIC_ASSETS].map(async url => {
        try {
          // Add cache-busting parameter to avoid stale responses
          const cacheBustUrl = url + (url.includes('?') ? '&' : '?') + '_=' + Date.now();
          const response = await fetch(cacheBustUrl, { 
            credentials: 'same-origin', 
            cache: 'no-cache',
            headers: { 'Cache-Control': 'no-cache' }
          });
          if (response.ok) {
            await cache.put(url, response);
            console.log('✅ Cached:', url);
          } else {
            console.warn('⚠️ Failed to cache:', url, response.status);
          }
        } catch (err) {
          console.warn('❌ Error caching:', url, err.message);
        }
      });
      
      await Promise.allSettled(cachePromises);
      console.log('✅ Service Worker installed with new cache');
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  console.log('🔧 Service Worker activating...');
  event.waitUntil(
    caches.keys().then(async keys => {
      // Delete all old caches
      const deletePromises = keys.map(async key => {
        if (key !== CACHE_NAME) {
          await caches.delete(key);
          console.log('🗑️ Deleted old cache during activate:', key);
        }
      });
      await Promise.all(deletePromises);
      console.log('✅ Service Worker activated, old caches removed');
      
      // Take control of all clients immediately
      await self.clients.claim();
      
      // Reload all tabs to ensure they get fresh content
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach(client => {
        client.postMessage({ type: 'FORCE_RELOAD' });
      });
    })
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;
  
  // IMPORTANT: Skip ALL API requests - never cache them
  if (url.pathname.startsWith('/api/')) {
    console.log('📡 API request (skip cache):', url.pathname);
    return;
  }

  const isAppShell = APP_SHELL.some(path => url.pathname === path);
  const isStaticAsset = STATIC_ASSETS.some(path => url.pathname === path);

  // For HTML and JS files - NETWORK FIRST (always get latest)
  if (isAppShell || url.pathname.endsWith('.html') || url.pathname.endsWith('.js')) {
    event.respondWith(
      fetch(request, { 
        credentials: 'same-origin', 
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      })
      .then(response => {
        if (response && response.ok) {
          // Update cache with new version
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          console.log('🌐 Network (cached for offline):', url.pathname);
        }
        return response;
      })
      .catch(async () => {
        // Offline fallback - serve from cache
        const cached = await caches.match(request);
        if (cached) {
          console.log('📦 Offline fallback (cache):', url.pathname);
          return cached;
        }
        // Ultimate fallback - serve index.html
        console.log('🏠 Offline fallback (index):', url.pathname);
        return caches.match('/index.html');
      })
    );
    return;
  }

  // For images and static assets - CACHE FIRST with network update
  if (isStaticAsset || url.pathname.match(/\.(jpg|jpeg|png|gif|webp|ico|svg)$/i)) {
    event.respondWith(
      caches.match(request).then(cached => {
        const networkFetch = fetch(request, { credentials: 'same-origin' })
          .then(response => {
            if (response && response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
            }
            return response;
          })
          .catch(() => null);
        
        if (cached) {
          // Return cached immediately, then update in background
          event.waitUntil(networkFetch);
          return cached;
        }
        return networkFetch;
      })
    );
    return;
  }

  // Default: network first for everything else
  event.respondWith(
    fetch(request, { credentials: 'same-origin' })
      .catch(async () => {
        const cached = await caches.match(request);
        return cached || caches.match('/index.html');
      })
  );
});

self.addEventListener('message', event => {
  console.log('📨 Message received:', event.data);
  
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data?.type === 'BUST_PRODUCTS_CACHE') {
    caches.open(CACHE_NAME).then(cache => {
      cache.delete('/api/products');
      console.log('🗑️ Products cache busted');
    });
  }
  
  if (event.data?.type === 'CLEAR_ALL_CACHE') {
    caches.keys().then(async keys => {
      for (const key of keys) {
        await caches.delete(key);
        console.log('🗑️ Deleted cache:', key);
      }
      event.ports[0].postMessage({ success: true });
    });
  }
  
  if (event.data?.type === 'FORCE_RELOAD') {
    window.location.reload();
  }
});

// Log when service worker is installed/activated
console.log('🚀 Service Worker loaded');
