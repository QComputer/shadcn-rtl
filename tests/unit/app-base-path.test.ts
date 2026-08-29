import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { appCookiePath, appFetch, appPath, appResourceUrl, resolveAppBasePath, stripAppBasePath } from "@/lib/app-base-path";
import { isResolvedOperationalAppHost } from "@/lib/custom-domain-routing";

describe("operational app base path", () => {
  it("supports only root and /app build modes", () => {
    assert.equal(resolveAppBasePath(""), "");
    assert.equal(resolveAppBasePath("   "), "");
    assert.equal(resolveAppBasePath("/app"), "/app");
    for (const invalid of [
      "app",
      "/app/",
      "//app",
      "/../app",
      "\\app",
      "https://tenant.example/app",
      "/app?mode=tenant",
      "/app#install",
    ]) {
      assert.throws(() => resolveAppBasePath(invalid), /Unsupported APP_BASE_PATH/);
    }
  });

  it("prefixes same-origin paths once and rejects unsafe paths", () => {
    assert.equal(appPath("/fa/shop", ""), "/fa/shop");
    assert.equal(appPath("/fa/shop", "/app"), "/app/fa/shop");
    assert.equal(appPath("/app/fa/shop", "/app"), "/app/fa/shop");
    assert.equal(appPath("/", "/app"), "/app/");
    assert.equal(stripAppBasePath("/app/fa/shop", "/app"), "/fa/shop");
    assert.equal(stripAppBasePath("/app", "/app"), "/");
    assert.equal(stripAppBasePath("/fa/shop", "/app"), "/fa/shop");
    assert.throws(() => appPath("https://evil.example", "/app"));
    assert.throws(() => appPath("//evil.example", "/app"));
    assert.throws(() => appPath("/bad\\path", "/app"));
    assert.equal(appResourceUrl("/favicon.ico", "/app"), "/app/favicon.ico");
    assert.equal(appResourceUrl("https://cdn.example/icon.png", "/app"), "https://cdn.example/icon.png");
  });

  it("scopes application cookies to the mounted application", () => {
    assert.equal(appCookiePath(""), "/");
    assert.equal(appCookiePath("/app"), "/app/");
  });

  it("requires exact APP host and build-prefix ownership", () => {
    const rootEndpoint = { appEndpoint: { origin: "https://app.tenant.example", pathPrefix: "" } };
    const pathEndpoint = { appEndpoint: { origin: "https://tenant.example", pathPrefix: "/app" } };
    assert.equal(isResolvedOperationalAppHost(rootEndpoint, "APP.TENANT.EXAMPLE.", ""), true);
    assert.equal(isResolvedOperationalAppHost(rootEndpoint, "tenant.example", ""), false);
    assert.equal(isResolvedOperationalAppHost(pathEndpoint, "tenant.example", "/app"), true);
    assert.equal(isResolvedOperationalAppHost(pathEndpoint, "tenant.example", ""), false);
    assert.equal(isResolvedOperationalAppHost({ appEndpoint: null }, "tenant.example", ""), false);
  });

  it("prefixes application fetches without rewriting external requests", async () => {
    const originalFetch = globalThis.fetch;
    const calls: unknown[] = [];
    process.env.APP_BASE_PATH = "/app";
    globalThis.fetch = ((input: unknown) => {
      calls.push(input);
      return Promise.resolve(new Response(null, { status: 204 }));
    }) as typeof fetch;
    try {
      await appFetch("/api/health");
      await appFetch("https://catalog.example/v1");
      assert.deepEqual(calls, ["/app/api/health", "https://catalog.example/v1"]);
    } finally {
      globalThis.fetch = originalFetch;
      delete process.env.APP_BASE_PATH;
    }
  });
});
