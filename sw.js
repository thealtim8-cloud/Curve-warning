/* Curve Guide offline shell cache — prototype */
const CACHE = 'curveguide-shell-v721-preview';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './assets/curveguide-logo.png',
  './assets/favicon.png',
  './assets/adeniyi-logo.png',
  './assets/welcome-poster.jpg',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/icon-512-maskable.png',
  './assets/apple-touch-icon.png',
  'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js',
  'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css'
];
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()).catch(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Never cache payments, auth or the verify server: always go to the network.
  if (/(^|\.)paystack\.(co|com)$/i.test(url.hostname) || /googleapis\.com$|firebaseapp\.com$|workers\.dev$/i.test(url.hostname)) return;
  if (/\.mp4($|\?)/i.test(url.pathname)) {
    event.respondWith(fetch(req).catch(() => caches.match(req)));
    return;
  }
  event.respondWith(
    caches.match(req).then((cached) => {
      const net = fetch(req).then((res) => {
        try {
          if (res.ok && (url.origin === self.location.origin || /unpkg\.com/.test(url.host)) && !/\.mp4/i.test(url.pathname)) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
        } catch (e) {}
        return res;
      }).catch(() => cached || caches.match('./index.html'));
      return cached || net;
    })
  );
});
