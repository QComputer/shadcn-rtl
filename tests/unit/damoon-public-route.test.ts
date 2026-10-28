import assert from "node:assert/strict";
import { register } from "node:module";
import { test } from "node:test";

register(new URL("./loader.mjs", import.meta.url));

const { damoonPublicHomeUrl, resolveDamoonPublicRoute } = await import("@/lib/damoon-public-route");

test("legacy redirects use public HTTPS without the internal port and retain the query", () => {
  for (const host of ["www.damoon-hotel.ir", "www.damoon-hotel.ir:3000", "damoon-hotel.ir:80"]) {
    const target = damoonPublicHomeUrl(host, "?from=legacy");
    assert.equal(target.protocol, "https:");
    assert.equal(target.port, "");
    assert.equal(target.pathname, "/");
    assert.equal(target.search, "?from=legacy");
    assert.equal(target.hostname, host.split(":")[0]);
  }
  assert.throws(() => damoonPublicHomeUrl("attacker.test"));
});

test("serves only the Damoon host and its explicit read-only public routes", () => {
  const paths = [
    "/",
    "/fa",
    "/en",
    "/ar",
    "/en/rooms",
    "/ar/contact",
    "/rooms",
    "/fa/rooms/",
    "/rooms/single",
    "/rooms/double",
    "/rooms/suite-3-bed",
    "/rooms/suite-4-5-bed",
    "/restaurant",
    "/cafe",
    "/facilities",
    "/gallery",
    "/about",
    "/contact",
    "/policies",
    "/virtual-tour",
  ];

  for (const hostHeader of ["damoon-hotel.ir", "WWW.DAMOON-HOTEL.IR."]) {
    for (const pathname of paths) {
      assert.deepEqual(resolveDamoonPublicRoute({ hostHeader, pathname, method: "GET" }), {
        kind: "rewrite",
        pathname: "/damoon-front/index.html",
      }, `${hostHeader} ${pathname}`);
    }
  }
});

test("redirects the legacy localized Damoon path and returns the special crawler/icon responses", () => {
  const hostHeader = "damoon-hotel.ir";
  assert.deepEqual(resolveDamoonPublicRoute({ hostHeader, pathname: "/fa/damoon-hotel", method: "GET" }), {
    kind: "redirect",
    pathname: "/",
  });
  assert.deepEqual(resolveDamoonPublicRoute({ hostHeader, pathname: "/robots.txt", method: "GET" }), {
    kind: "robots",
    body: "User-agent: *\nDisallow: /\n",
  });
  assert.deepEqual(resolveDamoonPublicRoute({ hostHeader, pathname: "/sitemap.xml", method: "GET" }), { kind: "not-found" });
  assert.deepEqual(resolveDamoonPublicRoute({ hostHeader, pathname: "/favicon.ico", method: "HEAD" }), { kind: "no-content" });
});

test("leaves spoofed, unrelated, API, unknown, and mutating requests to existing routing", () => {
  for (const hostHeader of [
    null,
    "bazarbaaz.ir",
    "damoon-hotel.ir.attacker.test",
    "attacker.test/damoon-hotel.ir",
    "user@damoon-hotel.ir",
    "damoon-hotel.ir:99999",
  ]) {
    assert.equal(resolveDamoonPublicRoute({ hostHeader, pathname: "/", method: "GET" }), null, String(hostHeader));
  }

  for (const pathname of [
    "/api/health",
    "/api/auth/session",
    "/dashboard",
    "/rooms/unknown",
    "/rooms/single/extra",
    "/fa/api/health",
    "/de/rooms",
    "/ar/api/health",
    "/en/rooms/unknown",
    "/%2frooms",
  ]) {
    assert.equal(resolveDamoonPublicRoute({ hostHeader: "damoon-hotel.ir", pathname, method: "GET" }), null, pathname);
  }

  for (const method of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS"]) {
    assert.equal(resolveDamoonPublicRoute({ hostHeader: "damoon-hotel.ir", pathname: "/", method }), null, method);
  }
});
