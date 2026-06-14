// const CACHE_NAME = 'sm-dynamics-v5';

// // Only cache essential static files
// const STATIC_CACHE = [
//   '/',
//   '/index.html',
//   '/repair.html',
//   '/management.html',
//   '/shop/styles.css'
// ];

// // Install event - cache only essential static files
// self.addEventListener('install', event => {
//   console.log('Service Worker installing...');
//   event.waitUntil(
//     caches.open(CACHE_NAME).then(cache => {
//       return cache.addAll(STATIC_CACHE);
//     }).then(() => self.skipWaiting())
//   );
// });

// // Activate event - clean up old caches
// self.addEventListener('activate', event => {
//   console.log('Service Worker activating...');
//   event.waitUntil(
//     caches.keys().then(keys => {
//       return Promise.all(
//         keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
//       );
//     }).then(() => {
//       console.log('Old caches cleared');
//       return self.clients.claim();
//     })
//   );
// });

// // Fetch event - NETWORK FIRST for everything, cache only as fallback
// self.addEventListener('fetch', event => {
//   const request = event.request;
//   const url = new URL(request.url);
  
//   // NEVER cache API requests
//   if (url.pathname.startsWith('/api/')) {
//     event.respondWith(fetch(request, {
//       cache: 'no-store',
//       headers: { 'Cache-Control': 'no-cache' }
//     }));
//     return;
//   }
  
//   // For all other requests: try network first, fallback to cache
//   event.respondWith(
//     fetch(request, {
//       cache: 'no-store',
//       headers: { 'Cache-Control': 'no-cache' }
//     })
//     .catch(() => {
//       return caches.match(request);
//     })
//   );
// });

// // Handle messages
// self.addEventListener('message', event => {
//   if (event.data?.type === 'SKIP_WAITING') {
//     self.skipWaiting();
//   }
//   if (event.data?.type === 'CLEAR_CACHE') {
//     caches.delete(CACHE_NAME);
//   }
// });
