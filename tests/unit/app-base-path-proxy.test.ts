import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { NextRequest } from "next/server";
import { config, proxy, sanitizedProxyBoundaryHeaders } from "../../proxy";

const originalAppBasePath = process.env.APP_BASE_PATH;
const originalPublicAppBasePath = process.env.NEXT_PUBLIC_APP_BASE_PATH;
const originalVercelUrl = process.env.VERCEL_URL;

function restore(name: "APP_BASE_PATH" | "NEXT_PUBLIC_APP_BASE_PATH", value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

function platformRequest(pathname: string) {
  return new NextRequest(`https://bazarbaaz-app.vercel.app${pathname}`, {
    headers: { host: "bazarbaaz-app.vercel.app" },
  });
}

function locationPath(response: Response) {
  const location = response.headers.get("location");
  assert.ok(location, "expected a redirect Location header");
  return new URL(location, "https://bazarbaaz-app.vercel.app").pathname;
}

afterEach(() => {
  restore("APP_BASE_PATH", originalAppBasePath);
  restore("NEXT_PUBLIC_APP_BASE_PATH", originalPublicAppBasePath);
  if (originalVercelUrl === undefined) delete process.env.VERCEL_URL;
  else process.env.VERCEL_URL = originalVercelUrl;
});

describe("APP_PATH browser-visible redirects", () => {
  it("keeps root, shop, and login locale redirects under /app", async () => {
    process.env.VERCEL_URL = "bazarbaaz-app.vercel.app";
    process.env.APP_BASE_PATH = "/app";
    process.env.NEXT_PUBLIC_APP_BASE_PATH = "/app";

    assert.equal(locationPath(await proxy(platformRequest("/"))), "/app/fa");
    assert.equal(locationPath(await proxy(platformRequest("/shop"))), "/app/fa/shop");
    assert.equal(locationPath(await proxy(platformRequest("/login"))), "/app/fa/login");
  });

  it("does not add /app in a normal root deployment", async () => {
    process.env.VERCEL_URL = "bazarbaaz-app.vercel.app";
    delete process.env.APP_BASE_PATH;
    delete process.env.NEXT_PUBLIC_APP_BASE_PATH;

    assert.equal(locationPath(await proxy(platformRequest("/shop"))), "/fa/shop");
    assert.equal(locationPath(await proxy(platformRequest("/login"))), "/fa/login");
  });

  it("runs proxy sanitization for the manifest route without redirecting it", async () => {
    process.env.VERCEL_URL = "bazarbaaz-app.vercel.app";
    assert.ok(config.matcher.includes("/manifest.webmanifest"));
    const response = await proxy(platformRequest("/manifest.webmanifest"));
    assert.equal(response.headers.get("location"), null);
  });

  it("strips the proxy credential and spoofable tenant trust headers", () => {
    const request = new NextRequest("https://bazarbaaz-app.vercel.app/manifest.webmanifest", {
      headers: {
        "x-bazarbaaz-proxy-token": "secret-that-must-not-reach-the-app",
        "x-bazar-forwarded-app": "true",
        "x-bazar-tenant-organization-id": "spoofed-tenant",
        "x-forwarded-host": "spoofed.example",
      },
    });
    const sanitized = sanitizedProxyBoundaryHeaders(request);
    assert.equal(sanitized.get("x-bazarbaaz-proxy-token"), null);
    assert.equal(sanitized.get("x-bazar-forwarded-app"), null);
    assert.equal(sanitized.get("x-bazar-tenant-organization-id"), null);
    assert.equal(sanitized.get("x-forwarded-host"), null);
  });
});
