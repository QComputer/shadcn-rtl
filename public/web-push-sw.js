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
      icon: "/favicon.ico",
      badge: "/favicon.ico",
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
