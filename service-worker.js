const CACHE_NAME = 'sm-dynamics-cache-v3';
const ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/shop/styles.css',
  '/shop/app.js',
  '/shop/pwa.js',
  '/shop/hero-phone.jpg',
  '/shop/headphones.jpg',
  '/shop/laptop.jpg',
  '/shop/tablet.jpg',
  '/shop/console.jpg',
  '/shop/earbuds.jpg',
  '/shop/drone.jpg',
  '/shop/speaker.jpg',
  '/shop/brand logo.png'
];

// Requests that should always try network first so management/repair pages,
// their admin scripts, and product/spare-parts API responses load fresh content.
const NETWORK_FIRST = [
  '/management.html',
  '/repair.html',
  '/shop/management.js',
  '/shop/repair.js',
  '/api/products',
  '/api/spare-parts'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(key => key !== CACHE_NAME ? caches.delete(key) : null)
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const requestURL = new URL(event.request.url);
  if (requestURL.origin !== location.origin) return;

  // Network-first for navigations and specific admin pages/scripts/API routes
  const pathname = requestURL.pathname;
  const isNetworkFirst = event.request.mode === 'navigate' ||
    NETWORK_FIRST.some(p => pathname === p || pathname.startsWith(p + '/') || pathname.startsWith(p + '?'));
  if (isNetworkFirst) {
    event.respondWith(
      fetch(event.request).then(response => {
        try { caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone())); } catch (e) {}
        return response;
      }).catch(() => caches.match(event.request).then(cached => cached || caches.match('/offline.html')))
    );
    return;
  }

  // Default: cache-first with network fallback (for images, styles, etc.)
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') return response;
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return response;
      }).catch(() => {
        if (event.request.destination === 'image') return caches.match('/shop/hero-phone.jpg');
      });
    })
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('push', event => {
  const payload = event.data?.json() || {
    title: 'SM Dynamics Electronics',
    body: 'New arrivals and special promotions are available now.',
    url: '/'
  };
  const options = {
    body: payload.body,
    icon: '/shop/brand logo.png',
    badge: '/shop/brand logo.png',
    vibrate: [100, 50, 100],
    data: {
      url: payload.url
    }
  };
  event.waitUntil(self.registration.showNotification(payload.title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      const url = event.notification.data?.url || '/';
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
