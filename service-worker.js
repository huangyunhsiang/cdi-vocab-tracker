/**
 * service-worker.js — network-first（離線可用）
 *
 * 策略：同源請求一律 network-first——優先拿伺服器最新版並更新快取，
 * 只有在離線／網路失敗時才 fallback 到快取。這樣程式碼更新能即時反映，
 * 同時保留 PWA 離線可用性。CDN 資源（Chart.js、Firebase、字型）不攔截，
 * 交給瀏覽器 HTTP 快取處理。
 *
 * 注意：改變快取策略或核心資產時，bump CACHE_NAME 版本號以清掉舊快取。
 */

const CACHE_NAME = 'cdi-vocab-tracker-v2';

const CORE_ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/store.js',
  './js/analytics.js',
  './js/categories.js',
  './js/wordlist-loader.js',
  './js/firebase-config.js',
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

  // 只處理同源 GET；CDN 與非 GET 交給瀏覽器原生處理
  if (url.origin !== self.location.origin || event.request.method !== 'GET') return;

  // network-first：優先網路，成功就更新快取；失敗（離線）才用快取
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
