// Service Worker ASIST UP - Estrategia Network-First para forzar actualizaciones inmediatas en dispositivos instalados
const CACHE_NAME = 'asist-up-v3.6.0-cache';
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  // Forzar activación inmediata del nuevo Service Worker sin esperar a que se cierren las pestañas
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
      // Reclamar control de todos los clientes de forma inmediata
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;

  // No interceptar peticiones que no sean GET ni peticiones externas (Firestore WebChannel / APIs) para evitar intermitencias
  if (req.method !== 'GET' || !req.url.startsWith(self.location.origin)) {
    return;
  }

  // 1. Peticiones de navegación (cargar el HTML del sistema /index.html):
  // Usar NETWORK-FIRST para que todo dispositivo con conexión descargue siempre la última versión desplegada
  // Si no hay conexión (offline), recurrir a la copia en caché para permitir funcionamiento en desconexión
  if (req.mode === 'navigate' || (req.method === 'GET' && req.headers.get('accept')?.includes('text/html'))) {
    event.respondWith(
      fetch(req)
        .then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(req).then(async cached =>
            cached || await caches.match('/index.html') || await caches.match('/') ||
            new Response('Sin conexión', { status: 503 })
          );
        })
    );
    return;
  }

  // 2. Recursos estáticos con hash (/assets/):
  // Si ya están en caché se sirven al instante; si no, se obtienen de la red y se guardan
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

  // 3. Otras peticiones de recursos
  event.respondWith(
    caches.match(req).then(cached => {
      return cached || fetch(req).then(networkResponse => {
        return networkResponse;
      }).catch(() => {
        if (req.mode === 'navigate') {
          return caches.match('/');
        }
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
