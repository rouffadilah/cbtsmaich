// Nama cache diperbarui ke v2 untuk memaksa pembaruan di HP siswa
const CACHE_NAME = 'cbt-smaich-v2'; 

const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './attempt.html',
  './attempt.js',
  './dashboard.html',
  './dashboard.js',
  './firebase-config.js',
  './index.js',
  './logo-smaich.png',
  './registrasi.html',
  './registrasi.js',
  './style.css'
];

self.addEventListener('install', event => {
  self.skipWaiting(); // Memaksa HP untuk langsung menggunakan versi terbaru
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return; 
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return; 

  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request).then(fetchRes => {
          return caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, fetchRes.clone());
              return fetchRes;
          });
      });
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName); // Hapus cache versi lama
          }
        })
      );
    })
  );
  self.clients.claim();
});
