// Naikkan versi ini setiap kali melakukan update besar pada HTML/JS/CSS
const CACHE_NAME = 'cbt-smaich-v13-preview-return';
const DYNAMIC_CACHE = 'cbt-smaich-dynamic-v1';

const urlsToCache = [
  '/',
  '/manifest.json',
  '/attempt',
  '/attempt.js',
  '/dashboard',
  '/dashboard.js',
  '/firebase-config.js',
  '/index.js',
  '/logo-smaich.png',
  '/registrasi',
  '/registrasi.js',
  '/akun.js',
  '/style.css'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => Promise.all(
      cacheNames.map(cacheName => {
        if (cacheName !== CACHE_NAME && cacheName !== DYNAMIC_CACHE) {
          return caches.delete(cacheName);
        }
      })
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  if (url.origin.includes('firestore') || url.origin.includes('identitytoolkit')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(async networkResponse => {
        // Perbaiki tombol "Kembali ke Dashboard" pada mode preview.
        // attempt.js lama menghasilkan inline onclick dengan kutip yang tidak valid.
        if (url.origin === location.origin && url.pathname === '/attempt.js') {
          const source = await networkResponse.text();
          const previewReturnFix = `\n\n// CBT SMAICH: fallback untuk tombol kembali pada Preview Ujian\n(() => {\n  const fixPreviewReturnButton = () => {\n    const buttons = document.querySelectorAll('button');\n    buttons.forEach((button) => {\n      if (button.textContent && button.textContent.trim().includes('Kembali ke Dashboard')) {\n        button.onclick = (event) => {\n          event.preventDefault();\n          window.location.assign('/dashboard#section-beranda');\n        };\n        button.type = 'button';\n      }\n    });\n  };\n  new MutationObserver(fixPreviewReturnButton).observe(document.documentElement, { childList: true, subtree: true });\n  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fixPreviewReturnButton);\n  else fixPreviewReturnButton();\n})();\n`;
          const headers = new Headers(networkResponse.headers);
          headers.set('Content-Type', 'application/javascript; charset=utf-8');
          return new Response(source + previewReturnFix, {
            status: networkResponse.status,
            statusText: networkResponse.statusText,
            headers
          });
        }

        if (url.origin === location.origin || url.origin === 'https://www.gstatic.com') {
          return caches.open(DYNAMIC_CACHE).then(cache => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        }
        return networkResponse;
      })
      .catch(() => caches.match(event.request))
  );
});
