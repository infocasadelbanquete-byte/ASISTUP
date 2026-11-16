// Service Worker ASIST UP - Estrategia Network-First con purga automática de cachés obsoletos en cada despliegue
const CACHE_NAME = 'asist-up-v3.7.0-__SW_BUILD_ID__';
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        PRECACHE_ASSETS.map(url =>
          fetch(url, { cache: 'no-store' }).then(res => {
            if (res && res.ok) {
              return cache.put(url, res);
            }
          })
        )
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Purgando caché obsoleto:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;

  // No interceptar peticiones que no sean GET, sw.js ni peticiones externas (Firestore WebChannel / APIs)
  if (req.method !== 'GET' || !req.url.startsWith(self.location.origin) || req.url.endsWith('/sw.js')) {
    return;
  }

  // 1. Peticiones de navegación (cargar HTML principal): Network-First con cache: no-store
  if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(req, { cache: 'no-store' })
        .then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put('/index.html', copy));
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(req).then(cached => cached || caches.match('/index.html') || caches.match('/'));
        })
    );
    return;
  }

  // 2. Recursos estáticos con hash (/assets/): Cache-First seguro por hash único de Vite
  if (req.url.includes('/assets/')) {
    event.respondWith(
      caches.match(req).then(cached => {
        if (cached) return cached;
        return fetch(req).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // 3. Otras peticiones del mismo origen (manifest, config, etc.): Network-First con cache: no-store
  event.respondWith(
    fetch(req, { cache: 'no-store' })
      .then(networkResponse => {
        if (networkResponse && networkResponse.status === 200) {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(req).then(cached => {
          if (cached) return cached;
          if (req.mode === 'navigate') return caches.match('/');
          return new Response('', { status: 503, statusText: 'Offline' });
        });
      })
  );
});

self.addEventListener('message', event => {
  if (event.data) {
    if (event.data.type === 'SKIP_WAITING') {
      self.skipWaiting();
    }
    if (event.data.type === 'PURGE_CACHE') {
      event.waitUntil(
        caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
      );
    }
  }
});
