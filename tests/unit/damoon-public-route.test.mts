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
    "/attractions",
    "/fa/attractions",
    "/en/attractions",
    "/ar/attractions",
    ...["museum-archaeology", "grand-mosque", "atabakan-mosque", "do-khatun-shrine", "mellat-park", "chaleshtar-castle", "gerdab-ben", "zaman-khan-bridge"].flatMap((slug) => [
      `/attractions/${slug}`,
      `/fa/attractions/${slug}`,
      `/en/attractions/${slug}`,
      `/ar/attractions/${slug}`,
    ]),
    "/rooms",
    "/fa/rooms/",
    "/rooms/single",
    "/rooms/double",
    "/rooms/suite",
    "/fa/rooms/suite",
    "/en/rooms/suite",
    "/ar/rooms/suite",
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
    "/hotel-reservations/start",
    "/fa/hotel-reservations/start",
    "/en/hotel-reservations/start",
    "/ar/hotel-reservations/start",
  ];

  for (const hostHeader of ["damoon-hotel.ir", "WWW.DAMOON-HOTEL.IR."]) {
    for (const pathname of paths) {
      for (const method of ["GET", "HEAD"]) {
        assert.deepEqual(resolveDamoonPublicRoute({ hostHeader, pathname, method }), {
          kind: "rewrite",
          pathname: "/damoon-front/index.html",
        }, `${hostHeader} ${method} ${pathname}`);
      }
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

test("serves the exact extensionless Leaflet LICENSE asset on Damoon host only", () => {
  for (const hostHeader of ["damoon-hotel.ir", "www.damoon-hotel.ir", "WWW.DAMOON-HOTEL.IR.:443"]) {
    for (const method of ["GET", "HEAD"]) {
      assert.deepEqual(
        resolveDamoonPublicRoute({ hostHeader, pathname: "/damoon-front/vendor/leaflet/LICENSE", method }),
        { kind: "asset", pathname: "/damoon-front/vendor/leaflet/LICENSE" },
        `${hostHeader} ${method}`,
      );
    }
  }
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
    "/attractions/unknown",
    "/attractions/museum-archaeology/extra",
    "/rooms/single/extra",
    "/fa/api/health",
    "/de/rooms",
    "/ar/api/health",
    "/en/rooms/unknown",
    "/%2frooms",
    "/en/damoon-front/vendor/leaflet/LICENSE",
    "/ar/damoon-front/vendor/leaflet/LICENSE",
  ]) {
    assert.equal(resolveDamoonPublicRoute({ hostHeader: "damoon-hotel.ir", pathname, method: "GET" }), null, pathname);
  }

  for (const method of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS"]) {
    assert.equal(resolveDamoonPublicRoute({ hostHeader: "damoon-hotel.ir", pathname: "/", method }), null, method);
    assert.equal(resolveDamoonPublicRoute({ hostHeader: "damoon-hotel.ir", pathname: "/damoon-front/vendor/leaflet/LICENSE", method }), null, `LICENSE ${method}`);
  }
});
