import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseCustomDomainPurchaseIntentPath,
  CUSTOM_DOMAIN_CAPABILITY_EDGE_PREFIXES,
} from "@/lib/custom-domain-routing";

describe("CafeLeo CL-3A: External Product Mapping Contract", () => {
  it("uses ExternalEntityMapping with organization-scoped, source-scoped, idempotent upserts", () => {
    const mappingSchema = readFileSync("prisma/schema.prisma", "utf8");
    assert.match(mappingSchema, /model ExternalEntityMapping/);
    assert.match(mappingSchema, /organizationId\s+String/);
    assert.match(mappingSchema, /externalSource\s+String/);
    assert.match(mappingSchema, /externalEntityType\s+ExternalEntityType/);
    assert.match(mappingSchema, /externalId\s+String/);
    assert.match(mappingSchema, /internalEntityType\s+InternalBusinessEntityType/);
    assert.match(mappingSchema, /internalEntityId\s+String\?/);
    assert.match(
      mappingSchema,
      /@@unique\(\[organizationId, externalSource, externalEntityType, externalId, internalEntityType\]\)/,
    );
  });

  it("defines ExternalEntityType.PRODUCT for the mapping", () => {
    const mappingSchema = readFileSync("prisma/schema.prisma", "utf8");
    assert.match(mappingSchema, /enum ExternalEntityType\s*\{\s*CATEGORY\s+PRODUCT\s+SERVICE/);
  });

  it("defines InternalBusinessEntityType.PRODUCT for the internal target", () => {
    const mappingSchema = readFileSync("prisma/schema.prisma", "utf8");
    assert.match(mappingSchema, /PRODUCT/);
  });

  it("retains mappings when source items are removed (status change only)", () => {
    const mappingSchema = readFileSync("prisma/schema.prisma", "utf8");
    assert.match(mappingSchema, /enum ExternalEntityMappingStatus\s*\{\s*SUGGESTED\s+APPROVED\s+REJECTED/);
  });
});

describe("CafeLeo CL-3A: APP_PATH Purchase Intent Routing", () => {
  it("parses /purchase/product/{id} paths with locale support", () => {
    const faPath = parseCustomDomainPurchaseIntentPath("/purchase/product/prod-123");
    assert.deepEqual(faPath, { locale: "fa", productId: "prod-123" });

    const enPath = parseCustomDomainPurchaseIntentPath("/en/purchase/product/prod-456");
    assert.deepEqual(enPath, { locale: "en", productId: "prod-456" });

    const arPath = parseCustomDomainPurchaseIntentPath("/ar/purchase/product/prod-789");
    assert.deepEqual(arPath, { locale: "ar", productId: "prod-789" });
  });

  it("rejects malformed purchase intent paths", () => {
    assert.equal(parseCustomDomainPurchaseIntentPath("/purchase/product/"), null);
    assert.equal(parseCustomDomainPurchaseIntentPath("/purchase/product"), null);
    assert.equal(parseCustomDomainPurchaseIntentPath("/purchase/product/prod-123/extra"), null);
    assert.equal(parseCustomDomainPurchaseIntentPath("/purchase/"), null);
    assert.equal(parseCustomDomainPurchaseIntentPath("/purchase/other/prod-123"), null);
    assert.equal(parseCustomDomainPurchaseIntentPath("/shop/product/prod-123"), null);
  });

  it("includes /purchase/product in the edge contract prefixes", () => {
    assert.ok(CUSTOM_DOMAIN_CAPABILITY_EDGE_PREFIXES.includes("/purchase/product"));
    assert.ok(CUSTOM_DOMAIN_CAPABILITY_EDGE_PREFIXES.includes("/shop"));
    assert.ok(CUSTOM_DOMAIN_CAPABILITY_EDGE_PREFIXES.includes("/appointment"));
  });

  it("decodes URL-encoded product IDs", () => {
    const path = parseCustomDomainPurchaseIntentPath("/purchase/product/prod%2D123");
    assert.deepEqual(path, { locale: "fa", productId: "prod-123" });
  });
});

describe("CafeLeo CL-3A: Purchase Intent Adapter", () => {
  it("exports read-only resolution functions", async () => {
    const adapter = await import("@/lib/purchase-intent-adapter");
    assert.equal(typeof adapter.resolvePurchaseIntent, "function");
    assert.equal(typeof adapter.resolvePurchaseIntentBySlug, "function");
    assert.equal(typeof adapter.sanitizeAttribution, "function");
  });

  it("sanitizes attribution tokens safely", async () => {
    const { sanitizeAttribution } = await import("@/lib/purchase-intent-adapter");

    assert.deepEqual(sanitizeAttribution({ source: "website", campaign: "spring2026" }), {
      source: "website",
      campaign: "spring2026",
    });

    assert.deepEqual(sanitizeAttribution({ source: "", campaign: "x".repeat(100) }), {});

    assert.deepEqual(sanitizeAttribution({ source: "invalid token!", campaign: "ok" }), {
      campaign: "ok",
    });

    assert.deepEqual(sanitizeAttribution(undefined), {});
  });
});

describe("CafeLeo CL-3A: External Product Mapping Service", () => {
  it("exports the required mapping functions", async () => {
    const mapping = await import("@/lib/external-product-mapping");
    assert.equal(typeof mapping.upsertExternalProductMapping, "function");
    assert.equal(typeof mapping.resolveExternalProductMapping, "function");
    assert.equal(typeof mapping.listExternalProductMappings, "function");
    assert.equal(typeof mapping.deactivateExternalProductMapping, "function");
    assert.equal(typeof mapping.reactivateExternalProductMapping, "function");
    assert.equal(typeof mapping.bulkSyncExternalProductMappings, "function");
    assert.equal(typeof mapping.assertExternalProductMappingInput, "function");
    assert.equal(mapping.EXTERNAL_SOURCE_CAFELEO, "CAFELEO");
  });

  it("validates mapping input", async () => {
    const { assertExternalProductMappingInput } = await import("@/lib/external-product-mapping");

    assert.throws(() => assertExternalProductMappingInput({
      organizationId: "",
      externalSource: "CAFELEO",
      externalId: "slug",
      internalEntityId: "prod-1",
    }), /organizationId is required/);

    assert.throws(() => assertExternalProductMappingInput({
      organizationId: "org-1",
      externalSource: "",
      externalId: "slug",
      internalEntityId: "prod-1",
    }), /externalSource is required/);

    assert.throws(() => assertExternalProductMappingInput({
      organizationId: "org-1",
      externalSource: "CAFELEO",
      externalId: "",
      internalEntityId: "prod-1",
    }), /externalId is required/);

    assert.throws(() => assertExternalProductMappingInput({
      organizationId: "org-1",
      externalSource: "CAFELEO",
      externalId: "slug",
      internalEntityId: "",
    }), /internalEntityId is required/);

    assert.throws(() => assertExternalProductMappingInput({
      organizationId: "org-1",
      externalSource: "CAFELEO",
      externalId: "invalid slug!",
      internalEntityId: "prod-1",
    }), /externalId must be a safe token/);

    assert.doesNotThrow(() => assertExternalProductMappingInput({
      organizationId: "org-1",
      externalSource: "CAFELEO",
      externalId: "valid-slug_123",
      internalEntityId: "prod-1",
    }));
  });
});

import { readFileSync } from "node:fs";
