import assert from "node:assert/strict";
import { describe, it, afterEach } from "node:test";
import {
  extractProxyCredential,
  resolveTrustedForwardedAppTenant,
} from "@/lib/forwarded-app-resolver.server";

const VALID_TOKEN = "a".repeat(32);
const VALID_TOKEN_B = "b".repeat(32);

describe("forwarded app resolver proxy credential extraction", () => {
  it("extracts the proxy token from X-Bazarbaaz-Proxy-Token header", () => {
    const req = { headers: { get: (name: string) => (name === "x-bazarbaaz-proxy-token" ? VALID_TOKEN : null) } };
    assert.equal(extractProxyCredential(req), VALID_TOKEN);
  });

  it("returns null when header is missing", () => {
    const req = { headers: { get: () => null } };
    assert.equal(extractProxyCredential(req), null);
  });

  it("returns null when header is empty", () => {
    const req = { headers: { get: () => "   " } };
    assert.equal(extractProxyCredential(req), null);
  });
});

describe("forwarded app resolver security", () => {
  const originalToken = process.env.BAZARBAAZ_APP_PROXY_TOKEN;

  afterEach(() => {
    if (originalToken === undefined) {
      delete process.env.BAZARBAAZ_APP_PROXY_TOKEN;
    } else {
      process.env.BAZARBAAZ_APP_PROXY_TOKEN = originalToken;
    }
  });

  it("rejects when proxy token is not configured (trusted proxy disabled)", async () => {
    delete process.env.BAZARBAAZ_APP_PROXY_TOKEN;
    const result = await resolveTrustedForwardedAppTenant({
      forwardedHost: "iran.cafeleo.vip",
      proxyCredential: VALID_TOKEN,
      appBasePath: "/app",
      pathname: "/app/",
    });
    assert.equal(result.status, "unauthorized");
  });

  it("rejects when proxy token is too short", async () => {
    process.env.BAZARBAAZ_APP_PROXY_TOKEN = "short";
    const result = await resolveTrustedForwardedAppTenant({
      forwardedHost: "iran.cafeleo.vip",
      proxyCredential: "short",
      appBasePath: "/app",
      pathname: "/app/",
    });
    assert.equal(result.status, "unauthorized");
  });

  it("rejects when proxy token does not match", async () => {
    process.env.BAZARBAAZ_APP_PROXY_TOKEN = VALID_TOKEN;
    const result = await resolveTrustedForwardedAppTenant({
      forwardedHost: "iran.cafeleo.vip",
      proxyCredential: VALID_TOKEN_B,
      appBasePath: "/app",
      pathname: "/app/",
    });
    assert.equal(result.status, "unauthorized");
  });

  it("rejects when proxy credential is empty", async () => {
    process.env.BAZARBAAZ_APP_PROXY_TOKEN = VALID_TOKEN;
    const result = await resolveTrustedForwardedAppTenant({
      forwardedHost: "iran.cafeleo.vip",
      proxyCredential: "",
      appBasePath: "/app",
      pathname: "/app/",
    });
    assert.equal(result.status, "unauthorized");
  });

  it("returns no-tenant for unknown forwarded host", async () => {
    process.env.BAZARBAAZ_APP_PROXY_TOKEN = VALID_TOKEN;
    const result = await resolveTrustedForwardedAppTenant({
      forwardedHost: "unknown.example.com",
      proxyCredential: VALID_TOKEN,
      appBasePath: "/app",
      pathname: "/app/",
    });
    assert.equal(result.status, "no-tenant");
  });

  it("returns no-tenant when path is outside APP prefix", async () => {
    process.env.BAZARBAAZ_APP_PROXY_TOKEN = VALID_TOKEN;
    const result = await resolveTrustedForwardedAppTenant({
      forwardedHost: "iran.cafeleo.vip",
      proxyCredential: VALID_TOKEN,
      appBasePath: "/app",
      pathname: "/",
    });
    assert.equal(result.status, "no-tenant");
  });

  it("rejects malformed forwarded host", async () => {
    process.env.BAZARBAAZ_APP_PROXY_TOKEN = VALID_TOKEN;
    const result = await resolveTrustedForwardedAppTenant({
      forwardedHost: "",
      proxyCredential: VALID_TOKEN,
      appBasePath: "/app",
      pathname: "/app/",
    });
    assert.equal(result.status, "no-tenant");
  });
});
