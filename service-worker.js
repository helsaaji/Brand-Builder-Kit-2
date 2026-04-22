const CACHE_NAME = "pwa-template-v2";
const BASE_URL = self.registration.scope;

const urlsToCache = [
  `${BASE_URL}`,
  `${BASE_URL}index.html`,
  `${BASE_URL}offline.html`,
  `${BASE_URL}assets/style.css`,
  `${BASE_URL}manifest.json`,
  `${BASE_URL}icons/icon-192x192.png`,
  `${BASE_URL}icons/icon-512x512.png`,
];

// Install Service Worker & simpan file ke cache
self.addEventListener("install", event => {
  self.skipWaiting(); // langsung aktif tanpa reload manual
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .catch(err => console.error("Cache gagal dimuat:", err))
  );
});

// Aktivasi dan hapus cache lama
self.addEventListener("activate", event => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log("Menghapus cache lama:", key);
            return caches.delete(key);
          }
        })
      );
      await self.clients.claim(); // langsung klaim kontrol ke halaman
    })()
  );
});

// Fetch event: cache-first untuk file lokal, network-first untuk API
self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);

  // Abaikan permintaan Chrome Extension, analytics, dll.
  if (url.protocol.startsWith("chrome-extension")) return;
  if (request.method !== "GET") return;

  // File lokal (statis)
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then(response => {
        return (
          response ||
          fetch(request).catch(() => caches.match(`${BASE_URL}offline.html`))
        );
      })
    );
  } 
  // Resource eksternal (API, CDN, dsb.)
  else {
    event.respondWith(
      fetch(request)
        .then(networkResponse => {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return networkResponse;
        })
        .catch(() => caches.match(request))
    );
  }
});
// ─── Background Sync ───────────────────────────────────────────────
self.addEventListener("sync", event => {
  if (event.tag === "background-sync") {
    event.waitUntil(
      (async () => {
        try {
          const clients = await self.clients.matchAll();
          clients.forEach(client => {
            client.postMessage({ type: "SYNC_COMPLETE", tag: event.tag });
          });
        } catch (err) {
          console.error("Background sync gagal:", err);
        }
      })()
    );
  }
});

// ─── Periodic Background Sync ──────────────────────────────────────
self.addEventListener("periodicsync", event => {
  if (event.tag === "periodic-refresh") {
    event.waitUntil(
      (async () => {
        try {
          const cache = await caches.open(CACHE_NAME);
          await cache.add(`${BASE_URL}index.html`);
          console.log("Periodic sync: cache diperbarui");
        } catch (err) {
          console.error("Periodic sync gagal:", err);
        }
      })()
    );
  }
});

// ─── Push Notifications ────────────────────────────────────────────
self.addEventListener("push", event => {
  const data = event.data?.json() ?? {
    title: "Brand Builder Kit",
    body: "Ada update baru untuk kamu!",
    icon: "./icons/icon-192x192.png",
    badge: "./icons/icon-192x192.png"
  };

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: data.badge,
      data: { url: data.url || BASE_URL }
    })
  );
});

// ─── Notification Click ────────────────────────────────────────────
self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data?.url || BASE_URL)
  );
});