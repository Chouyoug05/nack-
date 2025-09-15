const VERSION = 'v2';
const STATIC_CACHE = `nack-static-${VERSION}`;
const HTML_CACHE = `nack-html-${VERSION}`;
const IMAGE_CACHE = `nack-img-${VERSION}`;

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.png',
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-128x128.png',
  '/icons/icon-144x144.png',
  '/icons/icon-152x152.png',
  '/icons/icon-192x192.png',
  '/icons/icon-384x384.png',
  '/icons/icon-512x512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((k) => {
          if (![STATIC_CACHE, HTML_CACHE, IMAGE_CACHE].includes(k)) return caches.delete(k);
        })
      );
      await self.clients.claim();
    })()
  );
});

function isNavigationRequest(request) {
  return request.mode === 'navigate' || (request.method === 'GET' && request.headers.get('accept')?.includes('text/html'));
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // NetworkFirst pour HTML/navigation avec fallback cache/offline
  if (isNavigationRequest(request)) {
    event.respondWith(
      (async () => {
        try {
          const net = await fetch(request);
          const cache = await caches.open(HTML_CACHE);
          cache.put(request, net.clone());
          return net;
        } catch (e) {
          const cache = await caches.open(HTML_CACHE);
          const cached = await cache.match(request);
          if (cached) return cached;
          // fallback sur shell
          return caches.match('/index.html');
        }
      })()
    );
    return;
  }

  const url = new URL(request.url);

  // CacheFirst pour images/icônes
  if (request.destination === 'image' || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.open(IMAGE_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const net = await fetch(request);
          cache.put(request, net.clone());
          return net;
        } catch (e) {
          return caches.match('/favicon.png');
        }
      })
    );
    return;
  }

  // StaleWhileRevalidate pour autres statiques (CSS/JS)
  if (request.destination === 'script' || request.destination === 'style' || request.destination === 'font') {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const fetchPromise = fetch(request).then((net) => {
          cache.put(request, net.clone());
          return net;
        }).catch(() => undefined);
        return cached || fetchPromise || fetch(request).catch(() => cached);
      })
    );
    return;
  }

  // Par défaut: network avec fallback cache
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});