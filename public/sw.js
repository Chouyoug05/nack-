const VERSION = 'v3';
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

  // Filtrer les schémas non supportés (ex: chrome-extension)
  let url;
  try {
    url = new URL(request.url);
  } catch {
    return; // URL invalide, ne pas intercepter
  }
  const protocol = url.protocol;
  if (protocol !== 'http:' && protocol !== 'https:') {
    return; // ne pas intercepter les requêtes non http(s)
  }

  const isSameOrigin = url.origin === self.location.origin;

  // NetworkFirst pour HTML/navigation (même origine uniquement)
  if (isNavigationRequest(request)) {
    if (!isSameOrigin) return;
    event.respondWith(
      (async () => {
        try {
          const net = await fetch(request);
          if (net && net.ok) {
            const cache = await caches.open(HTML_CACHE);
            cache.put(request, net.clone());
          }
          return net;
        } catch (e) {
          const cache = await caches.open(HTML_CACHE);
          const cached = await cache.match(request);
          if (cached) return cached;
          // fallback shell
          return caches.match('/index.html');
        }
      })()
    );
    return;
  }

  // CacheFirst pour images/icônes (même origine uniquement)
  if (request.destination === 'image' || url.pathname.startsWith('/icons/')) {
    if (!isSameOrigin) {
      // laisser passer réseau sans cache pour cross-origin
      event.respondWith(fetch(request));
      return;
    }
    event.respondWith(
      caches.open(IMAGE_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const net = await fetch(request);
          if (net && net.ok) cache.put(request, net.clone());
          return net;
        } catch (e) {
          return caches.match('/favicon.png');
        }
      })
    );
    return;
  }

  // StaleWhileRevalidate pour scripts/styles/fonts (même origine uniquement)
  if (request.destination === 'script' || request.destination === 'style' || request.destination === 'font') {
    if (!isSameOrigin) {
      // cross-origin: pas de cache SW
      event.respondWith(fetch(request));
      return;
    }
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const fetchPromise = fetch(request).then((net) => {
          if (net && net.ok) cache.put(request, net.clone());
          return net;
        }).catch(() => undefined);
        return cached || fetchPromise || fetch(request).catch(() => cached);
      })
    );
    return;
  }

  // Par défaut: réseau avec fallback cache (même origine seulement)
  if (!isSameOrigin) return; // ne pas intercepter cross-origin par défaut
  event.respondWith(
    fetch(request).then(async (net) => {
      return net;
    }).catch(() => caches.match(request))
  );
});