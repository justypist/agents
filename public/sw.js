const STATIC_CACHE = 'agents-static-v2';
const PRECACHE_URLS = [
  '/manifest.webmanifest',
  '/robots.txt',
  '/api/pwa-icon/180',
  '/api/pwa-icon/192',
  '/api/pwa-icon/512',
];

function isNetworkFirstRequest(request) {
  if (request.method !== 'GET') {
    return false;
  }

  const url = new URL(request.url);

  return url.origin === self.location.origin && url.pathname.startsWith('/_next/static/') && request.destination === 'script';
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== STATIC_CACHE)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

function shouldCache(request) {
  if (request.method !== 'GET') {
    return false;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return false;
  }

  if (url.pathname.startsWith('/_next/static/')) {
    return true;
  }

  if (url.pathname.startsWith('/api/pwa-icon/')) {
    return true;
  }

  if (url.pathname === '/manifest.webmanifest' || url.pathname === '/robots.txt') {
    return true;
  }

  return ['style', 'font', 'image'].includes(request.destination);
}

self.addEventListener('fetch', event => {
  if (isNetworkFirstRequest(event.request)) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.ok) {
            event.waitUntil(
              caches.open(STATIC_CACHE).then(cache => cache.put(event.request, response.clone()))
            );
          }

          return response;
        })
        .catch(async () => {
          const cache = await caches.open(STATIC_CACHE);

          return cache.match(event.request);
        })
    );

    return;
  }

  if (!shouldCache(event.request)) {
    return;
  }

  event.respondWith(
    caches.open(STATIC_CACHE).then(async cache => {
      const cachedResponse = await cache.match(event.request);

      const networkResponsePromise = fetch(event.request)
        .then(response => {
          if (response.ok) {
            void cache.put(event.request, response.clone());
          }

          return response;
        })
        .catch(() => cachedResponse);

      return cachedResponse ?? networkResponsePromise;
    })
  );
});
