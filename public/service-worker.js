const CACHE_NAME = 'pocket-password-pal-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/src/index.css',
  '/src/main.tsx'
];

// Install event - cache assets
self.addEventListener('install', event => {
  console.log('[Service Worker] Install event triggered');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Opened cache and caching assets');
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activate event triggered');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(cacheName => {
          const toDelete = cacheName !== CACHE_NAME;
          if (toDelete) console.log(`[Service Worker] Deleting old cache: ${cacheName}`);
          return toDelete;
        }).map(cacheName => caches.delete(cacheName))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - respond with cache first, then network
self.addEventListener('fetch', event => {
  console.log(`[Service Worker] Fetch event for: ${event.request.url}`);
  
  if (event.request.url.includes('supabase.co')) {
    console.log('[Service Worker] Skipping cache for Supabase API call');
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          console.log('[Service Worker] Cache hit:', event.request.url);
          return response;
        }

        console.log('[Service Worker] Cache miss, fetching:', event.request.url);
        return fetch(event.request).then(response => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            console.log('[Service Worker] Invalid response, not caching');
            return response;
          }

          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
              console.log('[Service Worker] Cached new response:', event.request.url);
            });

          return response;
        });
      })
  );
});

// Background sync event - for offline data syncing
self.addEventListener('sync', event => {
  console.log(`[Service Worker] Sync event triggered: ${event.tag}`);
  if (event.tag === 'sync-passwords') {
    event.waitUntil(syncPasswords());
  }
});

// Function to sync passwords from IndexedDB to Supabase when online
async function syncPasswords() {
  console.log('[Service Worker] Syncing passwords from offline storage');
  // Your IndexedDB + Supabase logic goes here
}

// Push notification event
self.addEventListener('push', event => {
  console.log('[Service Worker] Push event received');
  const data = event.data ? event.data.json() : {};

  const options = {
    body: data.body || 'New notification from Pocket Password Pal',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    data: {
      url: data.url || '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Pocket Password Pal', options)
  );
});

// Notification click event
self.addEventListener('notificationclick', event => {
  console.log('[Service Worker] Notification click event');
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      for (const client of clientList) {
        if (client.url === event.notification.data.url && 'focus' in client) {
          console.log('[Service Worker] Focusing existing window');
          return client.focus();
        }
      }

      if (clients.openWindow) {
        console.log('[Service Worker] Opening new window');
        return clients.openWindow(event.notification.data.url || '/');
      }
    })
  );
});
