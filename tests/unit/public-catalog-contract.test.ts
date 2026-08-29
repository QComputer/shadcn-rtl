import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NextRequest } from "next/server";
import {
  PUBLIC_CATALOG_MAX_PAGE_SIZE,
  PUBLIC_CATALOG_PRIVATE_FIELD_DENYLIST,
  publicCatalogListQuerySchema,
} from "@/lib/public-catalog/contracts";
import { publicCatalogResponse } from "@/lib/public-catalog/http";
import { serializePublicCatalogProduct } from "@/lib/public-catalog/serializers";

const productInput = {
  id: "product-stable-id",
  slug: "mutable-presentation-slug",
  name: "Public product",
  description: "Description",
  image: "https://cdn.example/legacy.webp",
  basePrice: "220000",
  discountType: "percentage",
  discountValue: "10",
  trackInventory: true,
  category: { id: "category-id", slug: "category", name: "Category" },
  variants: [
    { id: "available", name: "Available", price: null, inventory: 2, allowBackOrder: false },
    { id: "unavailable", name: "Unavailable", price: "250000", inventory: 0, allowBackOrder: false },
  ],
};

describe("Public Catalog API v1 contract", () => {
  it("serializes a stable public-safe product contract with Toman prices", () => {
    const product = serializePublicCatalogProduct(productInput);
    assert.equal(product.id, "product-stable-id");
    assert.equal(product.slug, "mutable-presentation-slug");
    assert.deepEqual(product.price, { amount: 198000, currency: "TOMAN" });
    assert.deepEqual(product.listPrice, { amount: 220000, currency: "TOMAN" });
    assert.deepEqual(product.media, { card: productInput.image, detail: productInput.image, alt: productInput.name });
    assert.equal(product.orderable, true);
    assert.equal(product.variants[1].orderable, false);
    const serialized = JSON.stringify(product);
    for (const field of PUBLIC_CATALOG_PRIVATE_FIELD_DENYLIST) assert.equal(serialized.includes(`"${field}"`), false, field);
    assert.doesNotMatch(serialized, /inventory|reservedQuantity|trackInventory|allowBackOrder/);
  });

  it("supports zero prices without converting Toman values to IRR", () => {
    const product = serializePublicCatalogProduct({ ...productInput, basePrice: 0, discountType: "none", discountValue: 0 });
    assert.deepEqual(product.price, { amount: 0, currency: "TOMAN" });
  });

  it("keeps the media boundary compatible with legacy images", () => {
    const product = serializePublicCatalogProduct({ ...productInput, image: null });
    assert.deepEqual(product.media, { card: null, detail: null, alt: productInput.name });
    assert.equal("storageKey" in product.media, false);
    assert.equal("provider" in product.media, false);
  });

  it("enforces bounded explicit pagination and query limits", () => {
    assert.deepEqual(publicCatalogListQuerySchema.parse({}), { page: 1, limit: 20 });
    assert.equal(publicCatalogListQuerySchema.parse({ limit: String(PUBLIC_CATALOG_MAX_PAGE_SIZE) }).limit, 50);
    assert.throws(() => publicCatalogListQuerySchema.parse({ page: "0" }));
    assert.throws(() => publicCatalogListQuerySchema.parse({ limit: "51" }));
    assert.throws(() => publicCatalogListQuerySchema.parse({ q: "x".repeat(101) }));
  });

  it("emits public non-credentialed CORS, cache headers, ETag, HEAD, and 304", async () => {
    const request = new NextRequest("https://bazarbaaz.ir/api/public/v1/organizations/example/catalog");
    const first = publicCatalogResponse(request, { ok: true });
    assert.equal(first.headers.get("access-control-allow-origin"), "*");
    assert.equal(first.headers.get("access-control-allow-credentials"), null);
    assert.match(first.headers.get("cache-control") ?? "", /s-maxage=300/);
    const etag = first.headers.get("etag");
    assert.ok(etag);

    const conditional = publicCatalogResponse(new NextRequest(request.url, { headers: { "If-None-Match": etag! } }), { ok: true });
    assert.equal(conditional.status, 304);
    assert.equal(await conditional.text(), "");

    const head = publicCatalogResponse(request, { ok: true }, { head: true });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), "");
    assert.equal(head.headers.get("etag"), etag);
  });
});
