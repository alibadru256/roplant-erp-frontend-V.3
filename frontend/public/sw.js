/**
 * Deliberately minimal. A service worker is required for Chrome/Edge to offer "Install" —
 * but this is a live business app (stock levels, sales, balances), so it does NOT cache API
 * responses or app data. Caching a sale total or a stock count and serving it stale later
 * would be a real correctness bug, not a convenience. This only lets the app open (with an
 * offline notice) if there's genuinely no network — it never pretends old data is current.
 */
const CACHE_NAME = 'roplant-erp-shell-v1';
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_URL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only intercept page navigations (loading the app itself), and only to show an offline
  // notice if the network is genuinely unreachable. Every API call still goes straight to
  // the network, uncached, always — that's what keeps stock/sales/balances truthful.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(OFFLINE_URL))
    );
  }
});
