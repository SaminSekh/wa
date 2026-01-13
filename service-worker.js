const CACHE_NAME = 'whatsapp-plus-v2';
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './manifest.json'
];

// Install event - cache all assets
self.addEventListener('install', (e) => {
    console.log('[Service Worker] Installing...');
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Service Worker] Caching app assets');
            return cache.addAll(ASSETS);
        }).then(() => {
            return self.skipWaiting();
        })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (e) => {
    console.log('[Service Worker] Activating...');
    e.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[Service Worker] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            return self.clients.claim();
        })
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then((response) => {
            // Return cached version or fetch from network
            return response || fetch(e.request).then((fetchResponse) => {
                // Cache new resources
                return caches.open(CACHE_NAME).then((cache) => {
                    cache.put(e.request, fetchResponse.clone());
                    return fetchResponse;
                });
            }).catch(() => {
                // If both cache and network fail, return offline page
                console.log('[Service Worker] Offline - serving from cache');
            });
        })
    );
});
