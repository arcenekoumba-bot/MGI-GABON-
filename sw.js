// Service Worker minimal pour MGI Gabon
// Permet à l'app d'être "installable" et de démarrer même en cas de coupure réseau brève.
const CACHE_NAME = 'mgi-gabon-v2';
const CORE_ASSETS = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);
  const isSameOrigin = requestUrl.origin === self.location.origin;

  // Ne jamais intercepter les requêtes vers d'autres domaines (Firebase Auth,
  // reCAPTCHA Enterprise, Firestore, etc.). Elles doivent partir directement
  // au navigateur, sans passer par le cache du service worker.
  if (event.request.method !== 'GET' || !isSameOrigin) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
