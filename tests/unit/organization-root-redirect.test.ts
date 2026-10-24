import assert from "node:assert/strict";
import { before, mock, test } from "node:test";
import { NextRequest } from "next/server";

mock.module("@/lib/forwarded-app-resolver.server", { namedExports: {
  extractProxyCredential: () => null,
  resolveTrustedForwardedAppTenant: async () => ({ status: "unresolved" }),
} });
let runProxy: typeof import("../../proxy").proxy;
const originalFetch = global.fetch;
let primaryDomain: string | null = "fastfood.example";
let responseSlug = "tenant";
const calls: string[] = [];
before(async () => { ({ proxy: runProxy } = await import("../../proxy")); });

async function request(path: string, host = "bazarbaaz.ir") {
  global.fetch = async input => {
    const url = new URL(String(input));
    calls.push(url.pathname);
    if (url.pathname === "/api/internal/organization-primary-domain") {
      return Response.json(primaryDomain ? { domain: primaryDomain, slug: responseSlug } : {}, { status: primaryDomain ? 200 : 404 });
    }
    if (url.pathname === "/api/internal/shop-primary-domain") return Response.json({ domain: "shop.example" });
    if (url.pathname === "/api/internal/domain-resolver") return Response.json({
      slug: "tenant", organizationId: "org", organizationType: "SHOP", locale: "fa", capabilities: ["SHOP"],
      publicHome: { kind: "capability", capability: "SHOP" },
    });
    throw new Error(`Unexpected resolver ${url.pathname}`);
  };
  try { return await runProxy(new NextRequest(`https://${host}${path}`, { headers: { host } })); }
  finally { global.fetch = originalFetch; }
}

test("platform organization root redirects permanently, preserving query and each locale", async () => {
  for (const [locale, path] of [["fa", "/"], ["en", "/en"], ["ar", "/ar"]]) {
    const result = await request(`/${locale}/tenant?campaign=x%20y&tag=1&tag=2`);
    assert.equal(result.status, 308);
    assert.equal(result.headers.get("location"), `https://fastfood.example${path}?campaign=x%20y&tag=1&tag=2`);
  }
});
test("custom tenant roots load through the existing rewrite without redirect loops", async () => {
  for (const path of ["/", "/en", "/ar"]) {
    const result = await request(path, "www.fastfood.example");
    assert.equal(result.headers.get("location"), null);
    assert.ok(result.headers.get("x-middleware-rewrite")?.includes("/tenant"));
  }
});
test("organizations without an active primary domain keep platform access", async () => {
  primaryDomain = null;
  assert.equal((await request("/fa/tenant")).headers.get("location"), null);
  primaryDomain = "fastfood.example";
});
test("platform pages, transactional paths and locale landing pages never invoke the root resolver", async () => {
  for (const path of ["/fa", "/en", "/ar", "/fa/login", "/fa/pricing", "/ar/dashboard", "/fa/tenant/shop/cart", "/fa/tenant/shop/checkout"]) {
    calls.length = 0;
    const result = await request(path);
    assert.equal(result.headers.get("location"), null, path);
    assert.ok(!calls.includes("/api/internal/organization-primary-domain"), path);
  }
});
test("existing shop redirect path remains unchanged", async () => {
  const result = await request("/en/tenant/shop/product/example?ref=shop");
  assert.equal(result.status, 308);
  assert.equal(result.headers.get("location"), "https://shop.example/en/shop/product/example?ref=shop");
});
test("untrusted resolver destinations and wrong-tenant responses cannot redirect", async () => {
  for (const invalid of ["https://evil.example", "evil.example/path", "evil.example@trusted.example", "evil.example:443", "bazarbaaz.ir", "127.0.0.1", "evil.example?x=1"]) {
    primaryDomain = invalid;
    assert.equal((await request("/fa/tenant")).headers.get("location"), null, invalid);
  }
  primaryDomain = "fastfood.example";
  responseSlug = "another-tenant";
  assert.equal((await request("/fa/tenant")).headers.get("location"), null);
  responseSlug = "tenant";
});
