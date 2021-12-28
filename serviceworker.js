
const PRECACHE = 'precache';
// A list of local resources we always want to be cached.
const PRECACHE_URLS = [
    'index.html',
    './', // Alias for index.html
    'style.css',
    'script.js',
    'img/magnifying-glass-solid.svg'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(PRECACHE)
            .then(cache => cache.addAll(PRECACHE_URLS))
            .then(self.skipWaiting())
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            return cachedResponse || caches.open(PRECACHE).then(cache => {
                // Cache-first for images
                if (event.request.destination === 'image') return fetch(event.request).then(response => cache.put(event.request, response.clone()).then(() => response))

                // TODO: implement online-first cache strategy for API
                return fetch(event.request)
            })
        })
    )
})
