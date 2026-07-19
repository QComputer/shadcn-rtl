import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";
import { before, describe, it } from "node:test";

register(new URL("./loader.mjs", import.meta.url));

let service: typeof import("@/lib/services/ai-media-entity-attachment-service");

before(async () => {
  (process.env as Record<string, string | undefined>).NODE_ENV = "test";
  service = await import("@/lib/services/ai-media-entity-attachment-service");
});

function buildAsset(overrides: Record<string, unknown> = {}) {
  return {
    id: "asset-1",
    organizationId: "org-1",
    requestId: "req-1",
    mirrorId: "mirror-1",
    importId: "import-1",
    requestedByUserId: "user-1",
    visibilityScope: "OWNER_ONLY",
    mimeType: "image/png",
    width: 100,
    height: 100,
    storageProvider: "local-test",
    storageKey: "creative-studio/org-1/test/asset.png",
    storageKeyFingerprint: "fingerprint-1",
    checksumSha256: "checksum-1",
    byteSize: 100,
    safeMetadata: { provider: "MOCK" },
    acceptedAt: new Date("2026-01-01"),
    deletedAt: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    import: {
      id: "import-1",
      organizationId: "org-1",
      requestId: "req-1",
      mirrorId: "mirror-1",
      status: "IMPORTED",
      outputIndex: 0,
      resultFingerprint: "result-1",
      acceptedAssetId: "asset-1",
      validationRisk: "NONE",
      validationErrors: [],
      errorCode: null,
      errorMessage: null,
      plannedAt: new Date("2026-01-01"),
      importedAt: new Date("2026-01-01"),
      rolledBackAt: null,
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    },
    ...overrides,
  } as any;
}

function buildMockDb() {
  const assets = [buildAsset(), buildAsset({ id: "asset-2", checksumSha256: "checksum-2" })];
  const products = [{
    id: "product-1",
    image: "https://example.com/manual-product.jpg",
    slug: "product-one",
    organizationId: "org-1",
    organizationSlug: "shop-one",
    aiPrimaryMediaAssetId: null,
    isActive: true,
    deletedAt: null,
    organization: { isActive: true, deletedAt: null },
  }];
  const services = [{
    id: "service-1",
    image: "https://example.com/manual-service.jpg",
    slug: "service-one",
    organizationId: "org-1",
    aiPrimaryMediaAssetId: null,
    isActive: true,
    deletedAt: null,
    organization: { slug: "appointment-one", isActive: true, deletedAt: null },
  }];

  return {
    product: {
      findFirst: async (q: any) => {
        const product = products.find((p) => p.id === q?.where?.id && p.deletedAt === null) ?? null;
        if (!product) return null;
        if (q?.where?.organizationId && product.organizationId !== q.where.organizationId) return null;
        return q?.include?.aiPrimaryMediaAsset
          ? { ...product, aiPrimaryMediaAsset: assets.find((a) => a.id === product.aiPrimaryMediaAssetId) ?? null }
          : { ...product };
      },
      updateMany: async (q: any) => {
        const product = products.find((p) => p.id === q?.where?.id && p.organizationId === q.where.organizationId && p.deletedAt === null);
        if (!product) return { count: 0 };
        product.aiPrimaryMediaAssetId = q.data.aiPrimaryMediaAssetId;
        return { count: 1 };
      },
    },
    service: {
      findFirst: async (q: any) => {
        const item = services.find((s) => s.id === q?.where?.id && s.deletedAt === null) ?? null;
        if (!item) return null;
        if (q?.where?.organizationId && item.organizationId !== q.where.organizationId) return null;
        return q?.include?.aiPrimaryMediaAsset
          ? { ...item, aiPrimaryMediaAsset: assets.find((a) => a.id === item.aiPrimaryMediaAssetId) ?? null }
          : { ...item };
      },
      updateMany: async (q: any) => {
        const item = services.find((s) => s.id === q?.where?.id && s.organizationId === q.where.organizationId && s.deletedAt === null);
        if (!item) return { count: 0 };
        item.aiPrimaryMediaAssetId = q.data.aiPrimaryMediaAssetId;
        return { count: 1 };
      },
    },
    aiMediaAsset: {
      findFirst: async (q: any) => {
        const asset = assets.find((a) => a.id === q?.where?.id) ?? null;
        if (!asset) return null;
        if (q?.where?.organizationId && asset.organizationId !== q.where.organizationId) return null;
        if (q?.where?.deletedAt !== undefined && asset.deletedAt !== null) return null;
        return { ...asset };
      },
    },
    __state: { products, services, assets },
  } as any;
}

describe("AI media product/service attachment", () => {
  it("attaches an imported asset to a product without exposing storage keys", async () => {
    const db = buildMockDb();
    const result = await service.attachAiMediaAssetToProduct({
      productId: "product-1",
      aiMediaAssetId: "asset-1",
      actorRole: "ADMIN",
      db,
    });

    assert.equal(result.attached, true);
    assert.equal(result.publicMediaUrl, "/api/public/products/product-1/media");
    assert.equal(db.__state.products[0].aiPrimaryMediaAssetId, "asset-1");
    assert.equal(JSON.stringify(result).includes("storageKey"), false);
  });

  it("product attachment is idempotent for the same asset", async () => {
    const db = buildMockDb();
    await service.attachAiMediaAssetToProduct({ productId: "product-1", aiMediaAssetId: "asset-1", actorRole: "ADMIN", db });
    const result = await service.attachAiMediaAssetToProduct({ productId: "product-1", aiMediaAssetId: "asset-1", actorRole: "ADMIN", db });
    assert.equal(result.aiMediaAsset?.id, "asset-1");
  });

  it("replaces a product attachment without deleting the old asset", async () => {
    const db = buildMockDb();
    await service.attachAiMediaAssetToProduct({ productId: "product-1", aiMediaAssetId: "asset-1", actorRole: "ADMIN", db });
    await service.attachAiMediaAssetToProduct({ productId: "product-1", aiMediaAssetId: "asset-2", actorRole: "ADMIN", db });
    assert.equal(db.__state.products[0].aiPrimaryMediaAssetId, "asset-2");
    assert.equal(db.__state.assets.length, 2);
  });

  it("detaches a product attachment idempotently", async () => {
    const db = buildMockDb();
    await service.attachAiMediaAssetToProduct({ productId: "product-1", aiMediaAssetId: "asset-1", actorRole: "ADMIN", db });
    const result = await service.detachAiMediaAssetFromProduct({ productId: "product-1", actorRole: "ADMIN", db });
    assert.equal(result.attached, false);
    assert.equal(db.__state.products[0].aiPrimaryMediaAssetId, null);
  });

  it("rejects a product attachment when asset belongs to another organization", async () => {
    const db = buildMockDb();
    db.__state.assets[0].organizationId = "org-2";
    await assert.rejects(
      service.attachAiMediaAssetToProduct({ productId: "product-1", aiMediaAssetId: "asset-1", actorRole: "ADMIN", db }),
      /not found/i,
    );
  });

  it("rejects insufficient product role", async () => {
    const db = buildMockDb();
    await assert.rejects(
      service.attachAiMediaAssetToProduct({ productId: "product-1", aiMediaAssetId: "asset-1", actorRole: "CUSTOMER", db }),
      /Forbidden/,
    );
  });

  it("attaches and detaches a service asset", async () => {
    const db = buildMockDb();
    const attached = await service.attachAiMediaAssetToService({
      serviceId: "service-1",
      aiMediaAssetId: "asset-1",
      actorRole: "MANAGER",
      db,
    });
    assert.equal(attached.publicMediaUrl, "/api/public/services/service-1/media");
    const detached = await service.detachAiMediaAssetFromService({ serviceId: "service-1", actorRole: "MANAGER", db });
    assert.equal(detached.attached, false);
  });
});

describe("AI media product/service attachment source safety", () => {
  it("routes never accept provider URLs or storage keys", () => {
    const productRoute = readFileSync("app/api/dashboard/products/[productId]/ai-media-asset/route.ts", "utf8");
    const serviceRoute = readFileSync("app/api/dashboard/services/[serviceId]/ai-media-asset/route.ts", "utf8");
    const source = `${productRoute}\n${serviceRoute}`;
    assert.equal(/resultUrl|providerUrl|storageKey|BLOB_READ_WRITE_TOKEN|NEXT_PUBLIC/.test(source), false);
    assert.equal(/aiMediaAssetId/.test(source), true);
  });

  it("public media routes derive entity ownership server-side", () => {
    const source = readFileSync("lib/services/ai-media-entity-attachment-service.ts", "utf8");
    assert.equal(/streamPublicProductAiMedia/.test(source), true);
    assert.equal(/streamPublicServiceAiMedia/.test(source), true);
    assert.equal(/isActive: true/.test(source), true);
    assert.equal(/where:\s*\{[^}]*organizationId:\s*input\.organizationId/.test(source), false);
  });
});
