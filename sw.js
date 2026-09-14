// Service worker for Kanji Climb (天下の階段).
//
// Purpose: cache the app shell (the page, manifest, icons) so the game
// still opens with no connection at all once it's been loaded once. The
// actual kanji/vocab DATA offline story is separate — handled inside the
// app itself via localStorage (see the "OFFLINE CACHE" comments in its own
// <script>), same pattern as the other apps in this family.
//
// Strategy: stale-while-revalidate for same-origin shell files (serve the
// cached copy instantly, then quietly refresh it in the background for next
// time). Cross-origin requests (the live Google Sheets JSONP pulls) are left
// completely alone — they go straight to the network, exactly as if there
// were no service worker at all.
const CACHE_NAME = 'kanji-climb-pwa-v1';
const SHELL_FILES = [
  'index.html',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-512-maskable.png',
  'icons/apple-touch-icon.png',
  'icons/apple-touch-icon-152.png',
  'icons/apple-touch-icon-167.png',
  'icons/favicon-32.png',
  'icons/favicon-16.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_FILES))
      .catch(() => {}) // don't let one missing file block installation
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // leave Google Sheets pulls untouched

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
