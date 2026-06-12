const CACHE_NAME = 'sm-dynamics-v1';

// ✅ Define this array — list all files your app needs offline:
const urlsToCache = [
  '/',
  '/index.html',
  '/repair.html',
  '/app.js',
  '/repair.js',
  '/pwa.js',
  '/style.css',
  '/shop/brand%20logo.png'
  // add any other assets
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      // Use allSettled so one bad URL doesn't break everything
      Promise.allSettled(
        urlsToCache.map(url =>
          cache.add(url).catch(err => console.warn('Failed to cache:', url, err))
        )
      )
    )
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
})
