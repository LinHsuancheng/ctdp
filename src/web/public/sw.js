// Service worker of the CTDP phone app: offline start-up and push reminders.
// Pages and assets are fetched from the network first and cached, so the app
// opens offline with the last version it saw. The API is never cached.
const CACHE = "ctdp-v1";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
      } catch (err) {
        const cached = (await cache.match(request)) ?? (request.mode === "navigate" ? await cache.match("/") : undefined);
        if (cached) return cached;
        throw err;
      }
    })(),
  );
});

self.addEventListener("push", (event) => {
  let payload = { title: "CTDP", body: "" };
  try {
    payload = { ...payload, ...event.data.json() };
  } catch {
    // Not JSON: show the default title.
  }
  event.waitUntil(self.registration.showNotification(payload.title, { body: payload.body, icon: "/icons/icon-192.png", tag: payload.title }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      if (windows.length) return windows[0].focus();
      return self.clients.openWindow("/");
    })(),
  );
});
