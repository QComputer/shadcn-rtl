self.__BAZAR_BAZ_PWA_CACHE = {
  version: "p98-offline-shell",
  staticCacheName: "bazar-baz-static-p98",
  offlineUrl: "/offline.html",
  staticAssets: ["/offline.html", "/manifest.webmanifest", "/pwa-icon.svg", "/pwa-maskable-icon.svg"],
  bypassPathPrefixes: [
    "/api/",
    "/uploads/",
  ],
  bypassPathIncludes: [
    "/dashboard",
    "/checkout",
    "/booking",
    "/order/",
    "/payment",
    "/appointment/",
    "/my-appointments",
    "/login",
    "/register",
  ],
};

const PWA_CACHE = self.__BAZAR_BAZ_PWA_CACHE;

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(PWA_CACHE.staticCacheName).then((cache) => cache.addAll(PWA_CACHE.staticAssets)),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => cacheName.startsWith("bazar-baz-") && cacheName !== PWA_CACHE.staticCacheName)
            .map((cacheName) => caches.delete(cacheName)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function shouldBypassCache(url) {
  if (PWA_CACHE.bypassPathPrefixes.some((prefix) => url.pathname.startsWith(prefix))) return true;
  return PWA_CACHE.bypassPathIncludes.some((fragment) => url.pathname.includes(fragment));
}

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    PWA_CACHE.staticAssets.includes(url.pathname) ||
    url.pathname === "/favicon.ico"
  );
}

async function networkFirstNavigation(request) {
  try {
    return await fetch(request);
  } catch {
    return (await caches.match(PWA_CACHE.offlineUrl)) || Response.error();
  }
}

async function cacheFirstStaticAsset(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) return cachedResponse;

  const networkResponse = await fetch(request);
  if (networkResponse.ok) {
    const cache = await caches.open(PWA_CACHE.staticCacheName);
    await cache.put(request, networkResponse.clone());
  }
  return networkResponse;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (shouldBypassCache(url)) return;

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirstStaticAsset(request));
  }
});

self.addEventListener("push", (event) => {
  let payload = {
    title: "Bazar Baz",
    body: "You have a new notification.",
    url: "/",
  };

  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch {
      payload.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || "Bazar Baz", {
      body: payload.body || "",
      icon: "/pwa-icon.svg",
      badge: "/pwa-maskable-icon.svg",
      data: { url: payload.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const matchingClient = clients.find((client) => client.url === targetUrl);
      if (matchingClient) return matchingClient.focus();
      return self.clients.openWindow(targetUrl);
    }),
  );
});
