// Naikkan versi ini (misal v3, v4) setiap kali Anda melakukan update besar pada HTML/JS/CSS
const CACHE_NAME = 'cbt-smaich-v3'; 
const DYNAMIC_CACHE = 'cbt-smaich-dynamic-v1';

// Aset inti yang wajib disimpan di memori HP saat pertama kali aplikasi dibuka
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

// 1. Event Install: Memuat cache statis dan memaksa update
self.addEventListener('install', event => {
  self.skipWaiting(); // Memaksa HP untuk langsung menggunakan service worker terbaru
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
    })
  );
});

// 2. Event Activate: Membersihkan cache versi lama agar memori HP siswa tidak penuh
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME && cacheName !== DYNAMIC_CACHE) {
            console.log('Menghapus cache lama:', cacheName);
            return caches.delete(cacheName); 
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 3. Event Fetch: Strategi "Network First, Fallback to Cache"
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return; 
  
  const url = new URL(event.request.url);

  // Bypass (jangan cache) request ke Firebase API/Firestore agar data hasil ujian selalu real-time
  if (url.origin.includes('firestore') || url.origin.includes('identitytoolkit')) {
      return; 
  }

  event.respondWith(
    // Coba ambil dari internet (Network) terlebih dahulu
    fetch(event.request)
      .then(networkResponse => {
        // Simpan ke dynamic cache jika request dari domain sendiri atau dari server Firebase SDK
        if (url.origin === location.origin || url.origin === 'https://www.gstatic.com') {
            return caches.open(DYNAMIC_CACHE).then(cache => {
                cache.put(event.request, networkResponse.clone());
                return networkResponse;
            });
        }
        return networkResponse;
      })
      .catch(() => {
        // Jika internet terputus (Offline), ambil dari Cache
        return caches.match(event.request).then(cachedResponse => {
            if (cachedResponse) {
                return cachedResponse;
            }
            // Jika sedang offline dan data tidak ada di cache, bisa diarahkan ke halaman fallback offline (opsional)
        });
      })
  );
});
