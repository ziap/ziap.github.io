const PRECACHE = 'precache'
const PRECACHE_URLS = [
    'index.html',
    './', // Alias for index.html
    'style.css',
    'script.js',
    'img/magnifying-glass-solid.svg'
]

self.addEventListener('install', event => {
    event.waitUntil(
        caches
            .open(PRECACHE)
            .then(cache => cache.addAll(PRECACHE_URLS))
            .then(self.skipWaiting())
    )
})

self.addEventListener('fetch', event => {
    // Cache-first for images
    if (event.request.destination == 'image')
        event.respondWith(
            caches
                .match(event.request)
                .then(
                    cachedResponse =>
                        cachedResponse ||
                        caches
                            .open(PRECACHE)
                            .then(cache =>
                                fetch(event.request).then(response =>
                                    cache.put(event.request, response.clone()).then(() => response)
                                )
                            )
                )
        )
    // Online-first for other requests
    else
        event.respondWith(
            caches.open(PRECACHE).then(cache =>
                fetch(event.request)
                    .then(response => cache.put(event.request, response.clone()).then(() => response))
                    .catch(() => caches.match(event.request).then(cachedResponse => cachedResponse))
            )
        )

    // TODO: Add 404 page
})
