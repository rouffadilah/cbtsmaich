// Beri nama versi cache Anda. Jika ada update aplikasi, ubah ke v2, v3, dst.
const CACHE_NAME = 'cbt-smaich'; 

// Daftar file yang ingin disimpan agar bisa diakses offline
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
  './style.css',
  // Tambahkan file CSS, JS, atau gambar lain yang diperlukan di sini
  // contoh: '/style.css', '/logo.png'
];

// 1. Tahap Instalasi: Menyimpan file-file di atas ke dalam Cache HP pengguna
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache berhasil dibuka');
        return cache.addAll(urlsToCache);
      })
  );
});

// 2. Tahap Fetch: Mengatur bagaimana aplikasi memuat data
self.addEventListener('fetch', event => {
  // ATURAN 1: Biarkan request POST, PUT, DELETE lewat begitu saja
  // (Service Worker hanya bagus untuk menyimpan request GET)
  if (event.request.method !== 'GET') {
    return; 
  }

  // ATURAN 2: Biarkan request ke server luar (Firebase, Google Fonts) lewat begitu saja
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) {
    return; 
  }

  // ATURAN 3: Jika request GET dan dari domain sendiri, gunakan Cache
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Tampilkan dari cache jika ada, jika tidak, ambil dari internet
        return response || fetch(event.request);
      })
  );
});

// 3. Tahap Aktivasi: Membersihkan cache versi lama jika CACHE_NAME diubah
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
