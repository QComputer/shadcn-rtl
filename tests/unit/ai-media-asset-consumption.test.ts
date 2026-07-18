import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";
import { before, describe, it } from "node:test";

register(new URL("./loader.mjs", import.meta.url));

let isAiMediaAssetUsable: typeof import("@/lib/ai-media/asset-visibility").isAiMediaAssetUsable;
let buildSafeAiMediaAssetMetadata: typeof import("@/lib/ai-media/asset-visibility").buildSafeAiMediaAssetMetadata;
let listAvailableAiMediaAssets: typeof import("@/lib/services/ai-media-asset-service").listAvailableAiMediaAssets;
let getAiMediaAssetForUse: typeof import("@/lib/services/ai-media-asset-service").getAiMediaAssetForUse;
let validateAiMediaAssetForSelection: typeof import("@/lib/services/ai-media-asset-selection-service").validateAiMediaAssetForSelection;
let AiMediaAssetConsumptionError: typeof import("@/lib/services/ai-media-asset-service").AiMediaAssetConsumptionError;
let getAiMediaAssetConsumptionFeatureState: typeof import("@/lib/ai-media/asset-consumption-feature-guard").getAiMediaAssetConsumptionFeatureState;

before(async () => {
  ({ isAiMediaAssetUsable, buildSafeAiMediaAssetMetadata } = await import("@/lib/ai-media/asset-visibility"));
  ({ listAvailableAiMediaAssets, getAiMediaAssetForUse, AiMediaAssetConsumptionError } = await import("@/lib/services/ai-media-asset-service"));
  ({ validateAiMediaAssetForSelection } = await import("@/lib/services/ai-media-asset-selection-service"));
  ({ getAiMediaAssetConsumptionFeatureState } = await import("@/lib/ai-media/asset-consumption-feature-guard"));
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
    storageKey: "creative-studio/org-1/ai-media-import/test.png",
    storageKeyFingerprint: "key-1",
    checksumSha256: "abc123",
    byteSize: 1024,
    safeMetadata: { provider: "MOCK", providerJobId: "job-1" },
    acceptedAt: new Date("2026-01-01"),
    deletedAt: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    import: null,
    ...overrides,
  } as any;
}

function buildImport(status: "IMPORTED" | "VALIDATING" | "FAILED" | "ROLLED_BACK", acceptedAssetId: string | null = "asset-1") {
  return {
    id: "import-1",
    organizationId: "org-1",
    requestId: "req-1",
    mirrorId: "mirror-1",
    status,
    outputIndex: 0,
    resultFingerprint: "fp-1",
    acceptedAssetId,
    validationRisk: "NONE" as const,
    validationErrors: [] as string[],
    errorCode: null,
    errorMessage: null,
    plannedAt: new Date("2026-01-01"),
    importedAt: status === "IMPORTED" ? new Date("2026-01-01") : null,
    rolledBackAt: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  };
}

describe("AI media asset visibility", () => {
  it("marks a completed import as usable", () => {
    const asset = buildAsset();
    const visibility = isAiMediaAssetUsable(asset, buildImport("IMPORTED"));
    assert.equal(visibility.usable, true);
  });

  it("hides RESULT_READY without completed import", () => {
    const asset = buildAsset({ importId: null });
    const visibility = isAiMediaAssetUsable(asset, null);
    assert.equal(visibility.usable, false);
    assert.equal(visibility.reason, "not-imported");
  });

  it("hides VALIDATING import", () => {
    const asset = buildAsset();
    const visibility = isAiMediaAssetUsable(asset, buildImport("VALIDATING"));
    assert.equal(visibility.usable, false);
  });

  it("hides FAILED import", () => {
    const asset = buildAsset();
    const visibility = isAiMediaAssetUsable(asset, buildImport("FAILED"));
    assert.equal(visibility.usable, false);
    assert.equal(visibility.reason, "not-imported");
  });

  it("hides ROLLED_BACK import", () => {
    const asset = buildAsset();
    const visibility = isAiMediaAssetUsable(asset, buildImport("ROLLED_BACK"));
    assert.equal(visibility.usable, false);
    assert.equal(visibility.reason, "not-imported");
  });

  it("hides soft-deleted asset", () => {
    const asset = buildAsset({ deletedAt: new Date() });
    const visibility = isAiMediaAssetUsable(asset, buildImport("IMPORTED"));
    assert.equal(visibility.usable, false);
    assert.equal(visibility.reason, "deleted");
  });

  it("hides asset without storage reference", () => {
    const asset = buildAsset({ storageKey: null, storageKeyFingerprint: null, storageProvider: null });
    const visibility = isAiMediaAssetUsable(asset, buildImport("IMPORTED"));
    assert.equal(visibility.usable, false);
    assert.equal(visibility.reason, "no-storage-reference");
  });

  it("hides unsupported MIME type", () => {
    const asset = buildAsset({ mimeType: "image/svg+xml" });
    const visibility = isAiMediaAssetUsable(asset, buildImport("IMPORTED"));
    assert.equal(visibility.usable, false);
    assert.equal(visibility.reason, "unsupported-mime");
  });
});

describe("AI media asset safe metadata", () => {
  it("returns safe fields without provider URL or secrets", () => {
    const asset = buildAsset();
    const metadata = buildSafeAiMediaAssetMetadata(asset, buildImport("IMPORTED"));
    assert.equal("providerUrl" in metadata, false);
    assert.equal("rawProviderPayload" in metadata, false);
    assert.equal("storageKey" in metadata, false);
    assert.equal(metadata.id, "asset-1");
    assert.equal(metadata.usable, true);
  });
});

describe("AI media asset service with mock DB", () => {
  function buildMockDb() {
    const assets = [buildAsset()];
    const imports = [buildImport("IMPORTED")];

    function enrichAsset(asset: any) {
      if (asset && !asset.import && asset.importId) {
        const found = imports.find((i) => i.id === asset.importId);
        if (found) asset.import = found;
      }
      return asset;
    }

    const client: any = {
      aiMediaAsset: {
        findFirst: async (q: any) => {
          let result = assets.find((a) => a.id === q?.where?.id) ?? null;
          if (!result) return null;
          if (q?.where?.organizationId && result.organizationId !== q.where.organizationId) return null;
          if (q?.where?.deletedAt !== undefined && result.deletedAt !== null) return null;
          if (q?.include) {
            result = { ...result };
            if (result.importId) {
              const imp = imports.find((i) => i.id === result.importId);
              if (imp) result.import = imp;
            }
          }
          return result;
        },
        findMany: async (q: any) => {
          let results = assets.map((a) => ({ ...a }));
          if (q?.where?.organizationId) results = results.filter((a) => a.organizationId === q.where.organizationId);
          if (q?.where?.deletedAt !== undefined) results = results.filter((a) => a.deletedAt === null);
          if (q?.where?.import) results = results.filter((a) => {
            const imp = imports.find((i) => i.id === a.importId);
            return imp && imp.status === "IMPORTED";
          });
          if (q?.skip) results = results.slice(q.skip, q.skip + q.take);
          return results.map(enrichAsset);
        },
        count: async (q: any) => {
          let results = [...assets];
          if (q?.where?.organizationId) results = results.filter((a) => a.organizationId === q.where.organizationId);
          if (q?.where?.deletedAt !== undefined) results = results.filter((a) => a.deletedAt === null);
          if (q?.where?.import) results = results.filter((a) => {
            const imp = imports.find((i) => i.id === a.importId);
            return imp && imp.status === "IMPORTED";
          });
          return results.length;
        },
      },
      aiMediaImport: {
        findUnique: async (q: any) => {
          return imports.find((i) => i.id === q?.where?.id) ?? null;
        },
      },
    };
    return client;
  }

  it("owning org can list imported asset", async () => {
    const db = buildMockDb() as any;
    const result = await listAvailableAiMediaAssets({ organizationId: "org-1", page: 1, pageSize: 20 }, db);
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].id, "asset-1");
    assert.equal(result.items[0].previewUrl, "/api/dashboard/ai-media/assets/asset-1/content");
  });

  it("foreign org gets empty list", async () => {
    const db = buildMockDb() as any;
    const result = await listAvailableAiMediaAssets({ organizationId: "org-2", page: 1, pageSize: 20 }, db);
    assert.equal(result.items.length, 0);
  });

  it("owning org can read asset detail", async () => {
    const db = buildMockDb() as any;
    const asset = await getAiMediaAssetForUse("asset-1", "org-1", db);
    assert.ok(asset);
    assert.equal(asset.id, "asset-1");
    assert.equal("providerUrl" in asset, false);
    assert.equal("rawProviderPayload" in asset, false);
  });

  it("foreign org gets null on detail", async () => {
    const db = buildMockDb() as any;
    const asset = await getAiMediaAssetForUse("asset-1", "org-2", db);
    assert.equal(asset, null);
  });

  it("selection accepts canonical imported asset", async () => {
    const db = buildMockDb() as any;
    const ref = await validateAiMediaAssetForSelection("asset-1", "org-1", db);
    assert.equal(ref.id, "asset-1");
    assert.equal(ref.storageKeyFingerprint, "key-1");
  });

  it("selection rejects foreign asset", async () => {
    const db = buildMockDb() as any;
    let threw = false;
    try {
      await validateAiMediaAssetForSelection("asset-1", "org-2", db);
    } catch (error) {
      threw = true;
      assert.equal((error as Error).message.includes("not found"), true);
    }
    assert.equal(threw, true);
  });

  it("selection rejects non-imported asset", async () => {
    const nonImported = buildAsset({ importId: null });
    const db = {
      ...buildMockDb(),
      aiMediaAsset: {
        ...buildMockDb().aiMediaAsset,
        findFirst: async () => nonImported,
      },
    } as any;
    let threw = false;
    try {
      await validateAiMediaAssetForSelection("asset-1", "org-1", db);
    } catch (error) {
      threw = true;
      assert.equal((error as Error).message.includes("not available"), true);
    }
    assert.equal(threw, true);
  });
});

describe("AI media asset service source safety", () => {
  it("import service source does not expose provider URL", () => {
    const importService = readFileSync("lib/services/ai-media-result-import-service.ts", "utf8");
    assert.equal(/rawProviderUrlExposed:\s*true/.test(importService), false);
  });

  it("asset service does not call Render directly", () => {
    const assetService = readFileSync("lib/services/ai-media-asset-service.ts", "utf8");
    assert.equal(/fetch\([^)]*AI_MEDIA_SERVICE/.test(assetService), false);
    assert.equal(/bazar-baz-ai-media-service/.test(assetService), false);
  });

  it("local-test storage blocks Production", () => {
    const storage = readFileSync("lib/storage/local-test-storage.ts", "utf8");
    assert.equal(/Local test storage cannot run in production/.test(storage), true);
  });

  it("no NEXT_PUBLIC storage secret in asset routes", () => {
    const route = readFileSync("app/api/dashboard/ai-media/assets/route.ts", "utf8");
    assert.equal(/NEXT_PUBLIC/.test(route), false);
    assert.equal(/BLOB_READ_WRITE_TOKEN/.test(route), false);
  });

  it("content route enforces MIME allowlist", () => {
    const contentRoute = readFileSync("app/api/dashboard/ai-media/assets/[id]/content/route.ts", "utf8");
    assert.equal(/ALLOWED_CONTENT_TYPES/.test(contentRoute), true);
    assert.equal(/415/.test(contentRoute), true);
  });

  it("content route does not accept arbitrary storage keys from client", () => {
    const contentRoute = readFileSync("app/api/dashboard/ai-media/assets/[id]/content/route.ts", "utf8");
    assert.equal(/storageKeyFingerprint/.test(contentRoute), true);
    assert.equal(!/request\.body\.storageKey/.test(contentRoute), true);
  });

  it("content route guard executes before Prisma query", () => {
    const contentRoute = readFileSync("app/api/dashboard/ai-media/assets/[id]/content/route.ts", "utf8");
    const guardIndex = contentRoute.indexOf("assertAiMediaAssetConsumptionEnabled()");
    const queryIndex = contentRoute.indexOf("aiMediaAsset.findFirst");
    assert.ok(guardIndex > 0, "guard must be present");
    assert.ok(queryIndex > 0, "query must be present");
    assert.ok(guardIndex < queryIndex, "guard must execute before Prisma query");
  });
});

describe("AI media asset consumption feature guard", () => {
  const envAny = process.env as Record<string, string | undefined>;

  it("disables Production by default", () => {
    const prev = envAny.VERCEL_ENV;
    envAny.VERCEL_ENV = "production";
    try {
      const state = getAiMediaAssetConsumptionFeatureState();
      assert.equal(state.enabled, false);
      assert.equal(state.storageKeyColumnExpected, false);
    } finally {
      if (prev === undefined) delete envAny.VERCEL_ENV;
      else envAny.VERCEL_ENV = prev;
    }
  });

  it("enables local/test/development by default", () => {
    const prevVercel = envAny.VERCEL_ENV;
    const prevNode = envAny.NODE_ENV;
    delete envAny.VERCEL_ENV;
    envAny.NODE_ENV = "test";
    try {
      const state = getAiMediaAssetConsumptionFeatureState();
      assert.equal(state.enabled, true);
    } finally {
      if (prevVercel === undefined) delete envAny.VERCEL_ENV;
      else envAny.VERCEL_ENV = prevVercel;
      if (prevNode === undefined) delete envAny.NODE_ENV;
      else envAny.NODE_ENV = prevNode;
    }
  });

  it("Preview requires explicit accepted-risk guard", () => {
    const prevVercel = envAny.VERCEL_ENV;
    envAny.VERCEL_ENV = "preview";
    delete envAny.AI_MEDIA_ASSET_CONSUMPTION_PREVIEW_ENABLED;
    delete envAny.AI_MEDIA_PREVIEW_MOCK_WRITES_ENABLED;
    try {
      const disabled = getAiMediaAssetConsumptionFeatureState();
      assert.equal(disabled.enabled, false);
    } finally {
      if (prevVercel === undefined) delete envAny.VERCEL_ENV;
      else envAny.VERCEL_ENV = prevVercel;
      delete envAny.AI_MEDIA_ASSET_CONSUMPTION_PREVIEW_ENABLED;
      delete envAny.AI_MEDIA_PREVIEW_MOCK_WRITES_ENABLED;
    }
  });
});
