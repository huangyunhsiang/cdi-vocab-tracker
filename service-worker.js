/**
 * service-worker.js — cache-first 靜態資源快取
 *
 * 策略：安裝時預先快取核心靜態資源；之後對這些資源一律 cache-first，
 * 快取沒有才 fallback 到網路。CDN 資源（Chart.js、Firebase、字型）不強制快取，
 * 交給瀏覽器 HTTP 快取處理，避免版本更新問題。
 */

const CACHE_NAME = 'cdi-vocab-tracker-v1';

const CORE_ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/store.js',
  './js/analytics.js',
  './js/categories.js',
  './js/wordlist-loader.js',
  './manifest.webmanifest',
  './icons/icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).catch((e) => {
      console.warn('Service worker 預快取部分失敗', e);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 只處理同源請求，CDN 請求交給瀏覽器原生處理
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);
    })
  );
});
