// ACSM Portal — service worker (makes the portal installable as an app on phones and computers)
// The page is always taken fresh from the internet first, so every update reaches the students at once.
// Only when there is no internet the last saved copy opens (the data itself still needs the internet).
// Firebase / Google / other websites are never touched by this file.
const CACHE = 'acsm-shell-v7';
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
  const net = (fresh ? fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }) : fetch(req)).then(function (res) {
    if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
    return res;
  });
  const saved = function () { return caches.match(req).then(function (hit) { return hit || (req.mode === 'navigate' ? caches.match('./index.html') : undefined); }); };
  if (req.mode !== 'navigate') {
    e.respondWith(net.catch(saved));
    return;
  }
  // ⚡ opening the app: the internet gets 4 seconds; on a slow connection the saved copy opens at once
  // (the new copy still arrives in the background, and "🔄 Update now" shows if it is newer)
  e.respondWith(new Promise(function (resolve) {
    let done = false;
    const give = function (r) { if (!done && r) { done = true; resolve(r); } };
    const timer = setTimeout(function () { saved().then(give); }, 4000);
    net.then(function (r) { clearTimeout(timer); give(r); }).catch(function () {
      clearTimeout(timer);
      saved().then(function (r) { if (r) give(r); else { done = true; resolve(Response.error()); } });
    });
  }));
});

// 🔔 a notification sent while the app is CLOSED (Firebase Cloud Messaging → this phone): shown on the screen
self.addEventListener('push', function (e) {
  let j = {};
  try { j = e.data ? e.data.json() : {}; } catch (err) { j = { data: { body: e.data ? e.data.text() : '' } }; }
  const d = j.data || {}, n = j.notification || {};
  const title = d.title || n.title || 'ACSM- Sudipta Sir';
  e.waitUntil(self.registration.showNotification(title, {
    body: d.body || n.body || '',
    icon: 'icons/icon-192.png?v=3',
    badge: 'icons/favicon-64.png?v=3',
    tag: d.tag || 'acsm',
    renotify: true,
    vibrate: [200, 100, 200],
    data: { tab: d.tab || '' }
  }));
});

// 🔔 tapping a notification: the open app comes to the front (or the app opens)
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (const c of list) { if ('focus' in c) return c.focus(); }
    return self.clients.openWindow('./');
  }));
});
