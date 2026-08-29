import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildProductPurchaseHandoff, purchaseAttributionSchema } from "@/lib/purchase-intent";
import { resolveOrganizationAppEndpoint } from "@/lib/organization-endpoints";
import { publicCatalogResponse } from "@/lib/public-catalog/http";
import { NextRequest } from "next/server";

const organizationId = "org-a";
const endpoint = (origin: string, pathPrefix?: string) => resolveOrganizationAppEndpoint({
  organizationId,
  settings: { organizationEndpoints: [{ role: "APP", origin, pathPrefix }] },
});

describe("stateless purchase intent", () => {
  it("builds an APP subdomain handoff from immutable product identity", () => {
    const result = buildProductPurchaseHandoff({
      organizationIdentifier: "tenant",
      productId: "product-stable-id",
      appEndpoint: endpoint("https://app.tenant.example"),
      attribution: { source: "website", campaign: "summer-2026" },
    });
    assert.deepEqual(result, {
      href: "https://app.tenant.example/fa/tenant/purchase/product/product-stable-id?source=website&campaign=summer-2026",
      productId: "product-stable-id",
    });
  });

  it("preserves an /app prefix exactly once", () => {
    const result = buildProductPurchaseHandoff({
      organizationIdentifier: "tenant",
      productId: "product-id",
      appEndpoint: endpoint("https://tenant.example", "/app/"),
    });
    assert.equal(result?.href, "https://tenant.example/app/fa/tenant/purchase/product/product-id");
    assert.doesNotMatch(result!.href, /\/app\/app\//);
  });

  it("returns null without APP and has no PUBLIC fallback", () => {
    assert.equal(buildProductPurchaseHandoff({ organizationIdentifier: "tenant", productId: "product-id", appEndpoint: null }), null);
  });

  it("rejects unsafe attribution, identifiers, and non-APP endpoints", () => {
    assert.throws(() => purchaseAttributionSchema.parse({ source: "https://evil.example" }));
    assert.throws(() => purchaseAttributionSchema.parse({ source: "x".repeat(81) }));
    assert.throws(() => buildProductPurchaseHandoff({ organizationIdentifier: "../other", productId: "id", appEndpoint: endpoint("https://app.tenant.example") }));
    const publicEndpoint = { ...endpoint("https://app.tenant.example")!, role: "PUBLIC" as const };
    assert.throws(() => buildProductPurchaseHandoff({ organizationIdentifier: "tenant", productId: "id", appEndpoint: publicEndpoint }), /APP endpoint/);
  });

  it("never accepts commerce or redirect authority", () => {
    assert.throws(() => purchaseAttributionSchema.parse({ source: "website", price: "1" }));
    assert.throws(() => purchaseAttributionSchema.parse({ redirectUrl: "https://evil.example" }));
  });

  it("changes the public representation ETag when the APP target changes", () => {
    const request = new NextRequest("https://hostile.example/api/public/v1/organizations/tenant/products/id");
    const first = publicCatalogResponse(request, { purchase: { href: "https://app.tenant.example/fa/tenant/purchase/product/id", productId: "id" } });
    const second = publicCatalogResponse(request, { purchase: { href: "https://tenant.example/app/fa/tenant/purchase/product/id", productId: "id" } });
    assert.notEqual(first.headers.get("etag"), second.headers.get("etag"));
  });

  it("inherits malformed endpoint rejection from the BB-3B resolver", () => {
    assert.throws(() => endpoint("http://app.tenant.example"), /HTTPS/);
    assert.throws(() => endpoint("https://app.tenant.example/path"), /must not contain/);
  });
});
