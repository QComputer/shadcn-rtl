import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { runInNewContext } from "node:vm";

const source = readFileSync("public/web-push-sw.js", "utf8");

describe("tenant-branded PWA service worker", () => {
  it("does not cache manifests or tenant favicon identity", () => {
    assert.match(source, /version: "p101-tenant-safe-offline"/);
    assert.match(source, /manifestUrl: withBasePath\("\/manifest\.webmanifest"\)/);
    assert.doesNotMatch(source, /"\/manifest\.webmanifest",/);
    assert.doesNotMatch(source, /withoutBasePath\(url\.pathname\) === "\/favicon\.ico"/);
    assert.doesNotMatch(source, /staticAssets:[\s\S]*?\/icons\/icon-/);
  });

  it("activates one app scope without deleting another scope's offline cache", async () => {
    const names = new Set([
      "bazar-baz-static-root-p100",
      "bazar-baz-static-%2Fapp-p100",
      "bazar-baz-static-p99-root",
      "bazar-baz-static-p99/app",
    ]);
    const listeners = new Map<string, (event: { waitUntil: (promise: Promise<unknown>) => void }) => void>();
    const worker = {
      registration: { scope: "https://example.test/" },
      location: { origin: "https://example.test" },
      clients: { claim: async () => undefined },
      skipWaiting: () => undefined,
      addEventListener: (name: string, callback: (event: { waitUntil: (promise: Promise<unknown>) => void }) => void) => listeners.set(name, callback),
    };
    const caches = {
      keys: async () => [...names],
      delete: async (name: string) => names.delete(name),
    };
    runInNewContext(source, { self: worker, caches, URL, fetch });
    let completion: Promise<unknown> | undefined;
    listeners.get("activate")?.({ waitUntil: (promise) => { completion = promise; } });
    assert.ok(completion);
    await completion;
    assert.equal(names.has("bazar-baz-static-p99-root"), false);
    assert.equal(names.has("bazar-baz-static-%2Fapp-p100"), true);
    assert.equal(names.has("bazar-baz-static-p99/app"), true);
  });

  it("uses the current origin manifest for notification identity", () => {
    assert.match(source, /notificationManifestUrl\(payload\.url\)/);
    assert.match(source, /manifest\?\.short_name \|\| manifest\?\.name/);
    assert.match(source, /\.\.\.\(iconUrl \? \{ icon: iconUrl \} : \{\}\)/);
    assert.doesNotMatch(source, /icon: withBasePath\("\/icons\/icon-192x192\.png"\)/);
  });
});


describe("path tenant notification identity", () => {
  type NotificationOptions = Record<string, unknown>;
  type PushEvent = {
    data: { json: () => Record<string, unknown>; text: () => string };
    waitUntil: (promise: Promise<unknown>) => void;
  };

  async function dispatchPush(input: {
    destination: string;
    payloadTitle?: string;
    response?: { ok: boolean; json: () => Promise<Record<string, unknown>> };
  }) {
    const listeners = new Map<string, (event: PushEvent) => void>();
    const requests: Array<{ url: string; cache?: RequestCache }> = [];
    const notifications: Array<{ title: string; options: NotificationOptions }> = [];
    const worker = {
      registration: {
        scope: "https://platform.test/",
        showNotification: async (title: string, options: NotificationOptions) => { notifications.push({ title, options }); },
      },
      location: { origin: "https://platform.test" },
      addEventListener: (name: string, callback: (event: PushEvent) => void) => listeners.set(name, callback),
    };
    runInNewContext(source, {
      self: worker,
      URL,
      fetch: async (url: string, init?: { cache?: RequestCache }) => {
        requests.push({ url, cache: init?.cache });
        return input.response ?? { ok: false, json: async () => ({}) };
      },
    });

    const handler = listeners.get("push");
    assert.ok(handler, "push handler is registered");
    let completion: Promise<unknown> | undefined;
    handler({
      data: { json: () => ({ url: input.destination, ...(input.payloadTitle ? { title: input.payloadTitle } : {}) }), text: () => "" },
      waitUntil: (promise) => { completion = promise; },
    });
    assert.ok(completion, "push work is kept alive");
    await completion;
    assert.equal(notifications.length, 1);
    return { requests, notification: notifications[0] };
  }

  it("uses the destination tenant manifest for path-based shop and Retail pushes", async () => {
    for (const destination of ["/fa/aka-test/shop/order/42", "/fa/retail/electronics-test/account"]) {
      const { requests, notification } = await dispatchPush({
        destination,
        payloadTitle: "Order update",
        response: {
          ok: true,
          json: async () => ({
            name: "Tenant storefront",
            short_name: "Tenant",
            icons: [
              { src: "/brand/tenant/icon-192.png", sizes: "192x192", purpose: "any" },
              { src: "/brand/tenant/maskable-192.png", sizes: "192x192", purpose: "maskable" },
            ],
          }),
        },
      });
      assert.equal(requests.length, 1);
      assert.equal(requests[0].url, "/api/public/v1/organizations/" + (destination.includes("/retail/") ? "electronics-test" : "aka-test") + "/pwa-manifest?locale=fa&entry=shop");
      assert.equal(requests[0].cache, "no-store");
      assert.equal(notification.title, "Order update", "legitimate payload title is preserved");
      assert.equal(notification.options.icon, "https://platform.test/brand/tenant/icon-192.png");
      assert.equal(notification.options.badge, "https://platform.test/brand/tenant/maskable-192.png");
    }
  });

  it("uses the tenant short name when payload title is absent", async () => {
    const { notification } = await dispatchPush({
      destination: "/fa/aka-test/shop",
      response: { ok: true, json: async () => ({ short_name: "Aka", icons: [] }) },
    });
    assert.equal(notification.title, "Aka");
  });

  it("does not fall back to the platform manifest when a tenant manifest is missing", async () => {
    const { requests, notification } = await dispatchPush({ destination: "/fa/aka-test/shop", response: { ok: false, json: async () => ({}) } });
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, "/api/public/v1/organizations/aka-test/pwa-manifest?locale=fa&entry=shop");
    assert.equal(notification.title, "Notification");
    assert.equal("icon" in notification.options, false);
    assert.equal("badge" in notification.options, false);
  });

  for (const prefix of ["", "/app"]) {
    it("resolves tenant destinations without platform fallback at " + (prefix || "/"), () => {
      const context = { self: { registration: { scope: "https://platform.test" + prefix + "/" }, location: { origin: "https://platform.test" }, addEventListener: () => undefined }, URL };
      const resolveManifest = runInNewContext(source + ";notificationManifestUrl", context) as (url: string) => string | null;
      assert.equal(resolveManifest(prefix + "/fa/aka-test/shop/profile"), prefix + "/api/public/v1/organizations/aka-test/pwa-manifest?locale=fa&entry=shop");
      assert.equal(resolveManifest(prefix + "/fa/retail/electronics-test/account"), prefix + "/api/public/v1/organizations/electronics-test/pwa-manifest?locale=fa&entry=shop");
      assert.equal(resolveManifest("https://foreign.test/fa/aka-test/shop"), null);
      assert.equal(resolveManifest(prefix + "/fa/bad%2Fslug/shop"), null);
      assert.equal(resolveManifest(prefix + "/fa/dashboard"), prefix + "/manifest.webmanifest");
    });
  }
});
