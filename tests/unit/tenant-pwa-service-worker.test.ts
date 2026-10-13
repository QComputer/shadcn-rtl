import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { runInNewContext } from "node:vm";

const source = readFileSync("public/web-push-sw.js", "utf8");

describe("tenant-branded PWA service worker", () => {
  it("does not cache manifests or tenant favicon identity", () => {
    assert.match(source, /version: "p100-tenant-branded-pwa"/);
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
    assert.match(source, /fetch\(PWA_CACHE\.manifestUrl, \{ cache: "no-store" \}\)/);
    assert.match(source, /manifest\?\.short_name \|\| manifest\?\.name/);
    assert.match(source, /\.\.\.\(iconUrl \? \{ icon: iconUrl \} : \{\}\)/);
    assert.doesNotMatch(source, /icon: withBasePath\("\/icons\/icon-192x192\.png"\)/);
  });
});
