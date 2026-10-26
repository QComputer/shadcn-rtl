import assert from "node:assert/strict";
import { register } from "node:module";
import { test } from "node:test";

register(new URL("./loader.mjs", import.meta.url));

const { getPlatformHttpToHttpsRedirectLocation } = await import("@/lib/custom-domain-routing");

test("redirects production platform requests to the fixed HTTPS origin and preserves path and query", () => {
  const paths = [
    "/fa/login?callbackUrl=%2Ffa%2Fdashboard&tag=a&tag=b",
    "/api/auth/session?return=%2Ffa%2Flogin",
    "/api/public/v1/organizations?query=shoe",
    "/api/health/deep?probe=1",
  ];

  for (const path of paths) {
    assert.equal(getPlatformHttpToHttpsRedirectLocation({
      rawHost: "bazarbaaz.ir",
      forwardedProto: "http",
      requestUrl: `http://bazarbaaz.ir:3000${path}`,
      isProduction: true,
    }), `https://bazarbaaz.ir${path}`);
  }
});

test("normalizes the www platform host to the fixed canonical apex", () => {
  assert.equal(getPlatformHttpToHttpsRedirectLocation({
    rawHost: "www.bazarbaaz.ir",
    forwardedProto: "http",
    requestUrl: "http://www.bazarbaaz.ir/fa?x=1",
    isProduction: true,
  }), "https://bazarbaaz.ir/fa?x=1");
});

test("uses only the first forwarded protocol value", () => {
  const input = {
    rawHost: "bazarbaaz.ir",
    requestUrl: "http://bazarbaaz.ir/fa?x=1",
    isProduction: true,
  };
  assert.equal(getPlatformHttpToHttpsRedirectLocation({ ...input, forwardedProto: "http, https" }), "https://bazarbaaz.ir/fa?x=1");
  assert.equal(getPlatformHttpToHttpsRedirectLocation({ ...input, forwardedProto: "https, http" }), null);
});

test("does not redirect HTTPS, missing-proto health probes, or development requests", () => {
  const input = { rawHost: "bazarbaaz.ir", requestUrl: "https://bazarbaaz.ir/api/health", isProduction: true };
  assert.equal(getPlatformHttpToHttpsRedirectLocation({ ...input, forwardedProto: "https" }), null);
  assert.equal(getPlatformHttpToHttpsRedirectLocation({ ...input, forwardedProto: null }), null);
  assert.equal(getPlatformHttpToHttpsRedirectLocation({ ...input, forwardedProto: undefined }), null);
  assert.equal(getPlatformHttpToHttpsRedirectLocation({ ...input, forwardedProto: "http", isProduction: false }), null);
});

test("does not change localhost, tenant, custom, or untrusted hosts", () => {
  for (const rawHost of ["localhost:3000", "shop.example.ir", "fastfood13.ir", "bazarbaaz.ir.attacker.test", "attacker.test"]) {
    assert.equal(getPlatformHttpToHttpsRedirectLocation({
      rawHost,
      forwardedProto: "http",
      requestUrl: `http://${rawHost}/api/auth/session?x=1`,
      isProduction: true,
    }), null, rawHost);
  }
});

test("never derives the redirect authority from the request URL", () => {
  assert.equal(getPlatformHttpToHttpsRedirectLocation({
    rawHost: "bazarbaaz.ir",
    forwardedProto: "http",
    requestUrl: "http://user:pass@attacker.test:8080/fa/login?next=1#fragment",
    isProduction: true,
  }), "https://bazarbaaz.ir/fa/login?next=1");
});
