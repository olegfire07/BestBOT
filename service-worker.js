const VERSION = '6000';
const CACHE_NAME = `bestbot-pages-${VERSION}`;
const swPath = self.location.pathname.replace(/service-worker\.js.*$/, '');
const BASE_PATH = swPath.endsWith('/') ? swPath : `${swPath}/`;

const urlsToCache = [
    `${BASE_PATH}styles.css?v=${VERSION}`,
    `${BASE_PATH}ux-improvements.js?v=${VERSION}`,
    `${BASE_PATH}app.js?v=${VERSION}`,
    `${BASE_PATH}quiz_questions.json`,
    `${BASE_PATH}fianit-logo.jpg?v=${VERSION}`
];

const NO_STORE_FILES = ['index.html', 'styles.css', 'app.js', 'ux-improvements.js', 'service-worker.js'];

// Install - cache core assets cleanly without blocking new releases
self.addEventListener('install', (event) => {
    console.log(`[SW v${VERSION}] Installing...`);
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return Promise.allSettled(
                urlsToCache.map((url) =>
                    fetch(new Request(url, { cache: 'reload' })).then((resp) => {
                        if (resp && resp.ok) {
                            return cache.put(url, resp);
                        }
                        return null;
                    }).catch(() => null)
                )
            );
        })
    );
});

// Activate - remove older cache buckets and notify open pages
self.addEventListener('activate', (event) => {
    console.log(`[SW v${VERSION}] Activating...`);
    event.waitUntil(
        caches.keys()
            .then((cacheNames) =>
                Promise.all(
                    cacheNames
                        .filter(
                            (name) =>
                                (name.startsWith('bestbot-pages-') || name.startsWith('sklad-bot-')) &&
                                name !== CACHE_NAME
                        )
                        .map((name) => caches.delete(name))
                )
            )
            .then(() => self.clients.claim())
            .then(() =>
                self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
                    clients.forEach((client) => {
                        client.postMessage({ type: 'SW_UPDATED', version: VERSION });
                    });
                })
            )
    );
});

// Network-first for HTML/CSS/JS; cache-first for static images & quiz JSON
self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return;
    if (url.pathname.includes('/api/')) return;

    const isFreshCritical =
        req.mode === 'navigate' ||
        req.destination === 'document' ||
        req.destination === 'script' ||
        req.destination === 'style' ||
        NO_STORE_FILES.some((f) => url.pathname.endsWith(f) || url.pathname === BASE_PATH);

    if (isFreshCritical) {
        event.respondWith(
            fetch(new Request(req, { cache: 'no-store' }))
                .then((networkResp) => {
                    if (networkResp && networkResp.ok) {
                        const clone = networkResp.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
                    }
                    return networkResp;
                })
                .catch(async () => {
                    const cached = await caches.match(req, { ignoreSearch: true });
                    if (cached) return cached;
                    if (req.mode === 'navigate') {
                        return (
                            (await caches.match(`${BASE_PATH}index.html`, { ignoreSearch: true })) ||
                            (await caches.match(BASE_PATH, { ignoreSearch: true }))
                        );
                    }
                    return new Response('Offline', { status: 503, statusText: 'Offline' });
                })
        );
        return;
    }

    event.respondWith(
        caches.match(req).then((cached) => {
            if (cached) return cached;
            return fetch(req).then((networkResp) => {
                if (networkResp && networkResp.ok) {
                    const clone = networkResp.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
                }
                return networkResp;
            });
        })
    );
});

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
