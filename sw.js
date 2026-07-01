const CACHE_NAME = 'serenifi-cache-v7';
const PRECACHE_ASSETS = [
  './',
  'index.html',
  'style.css',
  'script.js',
  'icon.svg',
  'manifest.json',
  'https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css'
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Pre-caching app shell');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate Event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip caching for audio files (huge files)
  if (url.pathname.endsWith('.mp3') || url.pathname.includes('/audio/')) {
    // Let network handle audio stream (especially needed for Range requests)
    return;
  }

  // Cache-First Strategy for other assets
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(event.request).then((networkResponse) => {
          // Check if we received a valid response
          if (!networkResponse || networkResponse.status !== 200) {
            return networkResponse;
          }

          // Cache only HTTP(S) requests (skip chrome-extension, etc.)
          if (!url.protocol.startsWith('http')) {
            return networkResponse;
          }

          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return networkResponse;
        }).catch(() => {
          // If offline and request fails
        });
      })
  );
});
