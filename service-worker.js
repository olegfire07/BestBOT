// Service Worker for offline support
const VERSION = '2405';
const CACHE_NAME = `bestbot-pages-${VERSION}`;
const swPath = self.location.pathname.replace(/service-worker\.js.*$/, '');
const BASE_PATH = swPath.endsWith('/') ? swPath : `${swPath}/`;

const urlsToCache = [
    `${BASE_PATH}styles.css?v=${VERSION}`,
    `${BASE_PATH}ux-improvements.js?v=${VERSION}`,
    `${BASE_PATH}app.js?v=${VERSION}`,
    `${BASE_PATH}quiz_questions.json`,
    `${BASE_PATH}fianit-logo.jpg`
];

// Install event - cache resources
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => Promise.all(
                urlsToCache.map((url) => cache.add(url).catch(() => null))
            ))
    );
    self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (
                        cacheName !== CACHE_NAME
                        && (cacheName.startsWith('sklad-bot-') || cacheName.startsWith('bestbot-pages-'))
                    ) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    return self.clients.claim();
});

async function networkFirst(request) {
    try {
        const networkResponse = await fetch(request);
        if (networkResponse && networkResponse.ok && request.method === 'GET') {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        throw error;
    }
}

async function cacheFirst(request) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
        return cachedResponse;
    }
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok && request.method === 'GET') {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, networkResponse.clone());
    }
    return networkResponse;
}

// Fetch event - Network First for HTML/CSS/JS to avoid stale browser versions.
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') {
        return;
    }

    const url = new URL(event.request.url);
    const isSameOrigin = url.origin === self.location.origin;

    if (!isSameOrigin) {
        return;
    }

    if (event.request.mode === 'navigate' || event.request.destination === 'document') {
        event.respondWith(networkFirst(event.request));
        return;
    }

    if (event.request.destination === 'script' || event.request.destination === 'style') {
        event.respondWith(networkFirst(event.request));
        return;
    }

    event.respondWith(cacheFirst(event.request));
});

// Background sync for offline submissions
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-reports') {
        event.waitUntil(syncPendingReports());
    }
});

async function syncPendingReports() {
    const db = await openDB();
    const tx = db.transaction('pending', 'readonly');
    const store = tx.objectStore('pending');
    const pending = await getAllFromStore(store);

    for (const item of pending) {
        try {
            await sendReport(item.data);
            // Remove from pending after successful send
            const deleteTx = db.transaction('pending', 'readwrite');
            deleteTx.objectStore('pending').delete(item.id);

            // Notify all clients
            const clients = await self.clients.matchAll();
            clients.forEach(client => {
                client.postMessage({
                    type: 'SYNC_COMPLETE',
                    id: item.id,
                    timestamp: Date.now()
                });
            });
        } catch (error) {
            console.error('Failed to sync report:', error);
        }
    }
}

async function sendReport(data) {
    const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });

    if (!response.ok) {
        throw new Error('Failed to send report');
    }

    return response;
}

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('ReportsDB', 1);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('pending')) {
                db.createObjectStore('pending', { keyPath: 'id', autoIncrement: true });
            }
        };
    });
}

function getAllFromStore(store) {
    return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Listen for messages from main app
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
