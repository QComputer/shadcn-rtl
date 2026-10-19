self.__BAZAR_BAZ_BASE_PATH = new URL(self.registration.scope).pathname.replace(/\/$/, "");
const cacheScope = encodeURIComponent(self.__BAZAR_BAZ_BASE_PATH || "root");
const staticCachePrefix = `bazar-baz-static-${cacheScope}-`;
const legacyStaticCacheName = `bazar-baz-static-p99${self.__BAZAR_BAZ_BASE_PATH || "-root"}`;
const withBasePath = (path) => self.__BAZAR_BAZ_BASE_PATH && !path.startsWith(`${self.__BAZAR_BAZ_BASE_PATH}/`)
  ? `${self.__BAZAR_BAZ_BASE_PATH}${path}`
  : path;
const withoutBasePath = (path) => self.__BAZAR_BAZ_BASE_PATH && path.startsWith(`${self.__BAZAR_BAZ_BASE_PATH}/`)
  ? path.slice(self.__BAZAR_BAZ_BASE_PATH.length)
  : path;

self.__BAZAR_BAZ_PWA_CACHE = {
  version: "p101-tenant-safe-offline",
  staticCacheName: `${staticCachePrefix}p101`,
  offlineUrl: withBasePath("/offline.html"),
  staticAssets: [
    "/offline.html",
  ].map(withBasePath),
  manifestUrl: withBasePath("/manifest.webmanifest"),
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
            .filter((cacheName) =>
              (cacheName.startsWith(staticCachePrefix) || cacheName === legacyStaticCacheName) &&
              cacheName !== PWA_CACHE.staticCacheName,
            )
            .map((cacheName) => caches.delete(cacheName)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function shouldBypassCache(url) {
  const pathname = withoutBasePath(url.pathname);
  if (PWA_CACHE.bypassPathPrefixes.some((prefix) => pathname.startsWith(prefix))) return true;
  return PWA_CACHE.bypassPathIncludes.some((fragment) => pathname.includes(fragment));
}

function isStaticAsset(url) {
  return (
    withoutBasePath(url.pathname).startsWith("/_next/static/") ||
    PWA_CACHE.staticAssets.includes(url.pathname)
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
  const cache = await caches.open(PWA_CACHE.staticCacheName);
  const cachedResponse = await cache.match(request);
  if (cachedResponse) return cachedResponse;

  const networkResponse = await fetch(request);
  if (networkResponse.ok) {
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

// Derive notification identity from its same-origin tenant destination. Never
// accept a payload-supplied organization ID or manifest URL.
function notificationManifestUrl(destination) {
  try {
    const target = new URL(destination || "/", self.location.origin);
    if (target.origin !== self.location.origin) return null;
    const parts = withoutBasePath(target.pathname).split("/").filter(Boolean);
    if (["fa", "en", "ar"].includes(parts[0])) {
      const slug = parts[1] === "retail" ? parts[2] : parts[2] === "shop" ? parts[1] : null;
      if (slug) {
        const decoded = decodeURIComponent(slug);
        if (!decoded || decoded === "." || decoded === ".." || /[\\/?#\u0000-\u001f]/.test(decoded)) return null;
        return withBasePath("/api/public/v1/organizations/" + encodeURIComponent(decoded) + "/pwa-manifest") + "?locale=" + parts[0] + "&entry=shop";
      }
    }
    return PWA_CACHE.manifestUrl;
  } catch { return null; }
}

self.addEventListener("push", (event) => {
  let payload = {
    title: "",
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
    Promise.resolve(notificationManifestUrl(payload.url))
      .then((manifestUrl) => manifestUrl ? fetch(manifestUrl, { cache: "no-store" }) : null)
      .then((response) => response?.ok ? response.json() : null)
      .catch(() => null)
      .then((manifest) => {
        const icons = Array.isArray(manifest?.icons) ? manifest.icons : [];
        const regular = icons.find((candidate) => typeof candidate?.src === "string" && String(candidate.purpose || "any").includes("any"));
        const maskable = icons.find((candidate) => typeof candidate?.src === "string" && String(candidate.purpose || "").includes("maskable"));
        const iconUrl = regular?.src ? new URL(regular.src, self.location.origin).href : undefined;
        const badgeUrl = maskable?.src ? new URL(maskable.src, self.location.origin).href : iconUrl;
        return self.registration.showNotification(payload.title || manifest?.short_name || manifest?.name || "Notification", {
          body: payload.body || "",
          ...(iconUrl ? { icon: iconUrl } : {}),
          ...(badgeUrl ? { badge: badgeUrl } : {}),
          data: { url: withBasePath(payload.url || "/") },
        });
      }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  let targetUrl = "/";
  try {
    const candidate = new URL(event.notification.data?.url || "/", self.location.origin);
    if (candidate.origin === self.location.origin) {
      targetUrl = withBasePath(`${candidate.pathname}${candidate.search}${candidate.hash}`);
    }
  } catch {
    targetUrl = withBasePath("/");
  }

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const absoluteTargetUrl = new URL(targetUrl, self.location.origin).href;
      const matchingClient = clients.find((client) => client.url === absoluteTargetUrl);
      if (matchingClient) return matchingClient.focus();
      return self.clients.openWindow(targetUrl);
    }),
  );
});
