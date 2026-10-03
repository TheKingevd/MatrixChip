// Service worker do Matrix Online.
// Mantém o cache das bandeiras e recebe Web Push mesmo com o app fechado.
const FLAG_CACHE = "flags-v1";
const APP_CACHE = "matrix-pwa-v2";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => ![FLAG_CACHE, APP_CACHE].includes(key))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.hostname !== "flagcdn.com") return;

  event.respondWith(
    caches.open(FLAG_CACHE).then(async (cache) => {
      const cached = await cache.match(event.request);
      if (cached) return cached;
      try {
        const response = await fetch(event.request);
        if (response.ok) cache.put(event.request, response.clone());
        return response;
      } catch (err) {
        throw err;
      }
    }),
  );
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {
      title: "Matrix Online",
      body: event.data?.text() || "Você tem uma nova atualização.",
    };
  }

  const title = payload.title || "Matrix Online";
  const options = {
    body: payload.body || "Você tem uma nova atualização.",
    icon: "/icon-192.svg",
    badge: "/icon-192.svg",
    tag: payload.tag || "matrix-online",
    renotify: true,
    data: {
      url: payload.url || "/admin",
    },
  };

  event.waitUntil(
    self.registration.showNotification(title, options).then(() => {
      if ("setAppBadge" in navigator) {
        return navigator.setAppBadge?.(1);
      }
      return undefined;
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || "/admin";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      const target = new URL(targetUrl, self.location.origin);

      for (const client of clientList) {
        const clientUrl = new URL(client.url);
        if (clientUrl.origin === target.origin && "focus" in client) {
          if ("navigate" in client && clientUrl.pathname !== target.pathname) {
            return client.navigate(target.href).then(() => client.focus());
          }
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(target.href);
      }

      return undefined;
    }),
  );
});
