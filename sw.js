// ACSM Portal — service worker (makes the portal installable as an app on phones and computers)
// The page is always taken fresh from the internet first, so every update reaches the students at once.
// Only when there is no internet the last saved copy opens (the data itself still needs the internet).
// Firebase / Google / other websites are never touched by this file.
const CACHE = 'acsm-shell-v5';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).catch(function () {}));
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;          // Firebase, Google Drive, YouTube …: straight to the internet
  if (/version\.json$/.test(url.pathname)) return;          // the update check always asks the internet itself
  // the page itself (and the app file): always asked again from the internet ("no-cache" = is there a newer one?),
  // so a new version is never hidden behind a copy the phone kept
  const fresh = req.mode === 'navigate' || /\.(html|webmanifest)$/.test(url.pathname) || /\/$/.test(url.pathname);
  e.respondWith(
    (fresh ? fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }) : fetch(req)).then(function (res) {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
      return res;
    }).catch(function () {
      return caches.match(req).then(function (hit) { return hit || caches.match('./index.html'); });
    })
  );
});

// 🔔 tapping a notification: the open app comes to the front (or the app opens)
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (const c of list) { if ('focus' in c) return c.focus(); }
    return self.clients.openWindow('./');
  }));
});
