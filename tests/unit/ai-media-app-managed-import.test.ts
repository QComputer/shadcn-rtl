import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { register } from "node:module";
import { before, describe, it } from "node:test";

register(new URL("./loader.mjs", import.meta.url));

let validateAiMediaProviderResult: typeof import("@/lib/ai-media/provider-result-validation").validateAiMediaProviderResult;
let importResultReadyOutput: typeof import("@/lib/services/ai-media-result-import-service").importResultReadyOutput;
let createLocalTestApplicationStorage: typeof import("@/lib/storage/local-test-storage").createLocalTestApplicationStorage;
let setApplicationStorageAdapterForTesting: typeof import("@/lib/storage/application-storage").setApplicationStorageAdapterForTesting;
let readFileSync: typeof import("node:fs").readFileSync;

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
function makeTinyPng() {
  const buf = Buffer.alloc(74);
  PNG_SIGNATURE.copy(buf, 0);
  buf.writeUInt32BE(13, 16);
  buf.writeUInt32BE(1, 20);
  return buf;
}

function buildMockDb() {
  const store: Record<string, any> = { assets: [], imports: [], events: [] };
  const mirror = {
    id: "mirror-1",
    organizationId: "org-1",
    requestId: "req-1",
    state: "RESULT_READY",
    provider: "MOCK",
    providerJobId: "imgjob-1",
    requestedByUserId: "user-1",
    request: { id: "req-1", organizationId: "org-1", status: "SUBMITTED" },
  };
  const client: any = {
    aiMediaJobMirror: {
      findFirst: async (q: any) => (q?.where?.id === "mirror-1" ? mirror : null),
      updateMany: async (q: any) => {
        if (q?.data?.state) mirror.state = q.data.state;
        return { count: 1 };
      },
    },
    aiMediaRequest: { updateMany: async () => ({ count: 1 }) },
    aiMediaImport: {
      findUnique: async (q: any) => {
        const rec = store.imports.find(
          (r) => r.mirrorId === q?.where?.mirrorId_outputIndex?.mirrorId && r.outputIndex === q?.where?.mirrorId_outputIndex?.outputIndex,
        );
        if (!rec) return null;
        return rec;
      },
      upsert: async (q: any) => {
        const where = q.where.mirrorId_outputIndex;
        let rec = store.imports.find((r) => r.mirrorId === where.mirrorId && r.outputIndex === where.outputIndex);
        if (!rec) {
          rec = { id: `import-${store.imports.length + 1}`, mirrorId: where.mirrorId, outputIndex: where.outputIndex, status: "NOT_REQUESTED", organizationId: "org-1", requestId: "req-1" };
          store.imports.push(rec);
        }
        if (q.create && rec.status === "NOT_REQUESTED") Object.assign(rec, q.create);
        if (q.update) Object.assign(rec, q.update);
        return rec;
      },
      update: async (q: any) => {
        const rec = store.imports.find((r) => r.id === q?.where?.id);
        if (rec && q.data) Object.assign(rec, q.data);
        return rec;
      },
    },
    aiMediaAsset: {
      create: async (q: any) => {
        const asset = {
          id: `asset-${store.assets.length + 1}`,
          storageKey: q.data?.storageKeyFingerprint ?? `key-${store.assets.length + 1}`,
          ...q.data,
        };
        store.assets.push(asset);
        return asset;
      },
      findUnique: async (q: any) => store.assets.find((a) => a.id === q?.where?.id) ?? null,
    },
    aiMediaJobEvent: {
      upsert: async (q: any) => {
        const ev = { id: `ev-${store.events.length + 1}`, ...(q.create || {}) };
        store.events.push(ev);
        return ev;
      },
    },
  };
  return { store, client, mirror };
}

const fakeProviderJob = {
  job_id: "imgjob-1",
  status: "COMPLETED",
  canonical_status: "RESULT_READY",
  provider: "MOCK",
  outputs: [
    { url: "https://cdn.example.com/out1.png", mime_type: "image/png", width: 512, height: 512 },
  ],
};

before(async () => {
  ({ validateAiMediaProviderResult } = await import("@/lib/ai-media/provider-result-validation"));
  ({ importResultReadyOutput } = await import("@/lib/services/ai-media-result-import-service"));
  ({ createLocalTestApplicationStorage } = await import("@/lib/storage/local-test-storage"));
  ({ setApplicationStorageAdapterForTesting } = await import("@/lib/storage/application-storage"));
  ({ readFileSync } = await import("node:fs"));
  process.env.AI_MEDIA_LOCAL_STORAGE_ROOT = ".tmp/ai-media-app-managed-import";
});

describe("AI media app-managed provider result validation", () => {
  it("requires RESULT_READY state", () => {
    const r = validateAiMediaProviderResult({
      provider: "MOCK", providerJobId: "j1", mirrorProviderJobId: "j1", state: "SUBMITTED_TO_RENDER",
      jobType: "PRODUCT_IMAGE", canonicalStatus: "RESULT_READY", outputs: [{ id: "1", url: "https://x.com/a.png", width: 1, height: 1, mimeType: "image/png" }],
    });
    assert.equal(r.valid, false);
    assert.match(r.blockers.join(","), /RESULT_NOT_READY/);
  });

  it("requires COMPLETED provider status", () => {
    const r = validateAiMediaProviderResult({
      provider: "MOCK", providerJobId: "j1", mirrorProviderJobId: "j1", state: "RESULT_READY",
      jobType: "PRODUCT_IMAGE", canonicalStatus: "PROCESSING", outputs: [{ id: "1", url: "https://x.com/a.png", width: 1, height: 1, mimeType: "image/png" }],
    });
    assert.equal(r.valid, false);
    assert.match(r.blockers.join(","), /PROVIDER_NOT_COMPLETED/);
  });

  it("requires provider job id to match mirror", () => {
    const r = validateAiMediaProviderResult({
      provider: "MOCK", providerJobId: "j2", mirrorProviderJobId: "j1", state: "RESULT_READY",
      jobType: "PRODUCT_IMAGE", canonicalStatus: "RESULT_READY", outputs: [{ id: "1", url: "https://x.com/a.png", width: 1, height: 1, mimeType: "image/png" }],
    });
    assert.equal(r.valid, false);
    assert.match(r.blockers.join(","), /ID_MISMATCH/);
  });

  it("rejects unsupported provider", () => {
    const r = validateAiMediaProviderResult({
      provider: "OPENAI", providerJobId: "j1", mirrorProviderJobId: "j1", state: "RESULT_READY",
      jobType: "PRODUCT_IMAGE", canonicalStatus: "RESULT_READY", outputs: [{ id: "1", url: "https://x.com/a.png", width: 1, height: 1, mimeType: "image/png" }],
    });
    assert.equal(r.valid, false);
    assert.match(r.blockers.join(","), /UNSUPPORTED_PROVIDER/);
  });

  it("rejects invalid MIME", () => {
    const r = validateAiMediaProviderResult({
      provider: "MOCK", providerJobId: "j1", mirrorProviderJobId: "j1", state: "RESULT_READY",
      jobType: "PRODUCT_IMAGE", canonicalStatus: "RESULT_READY", outputs: [{ id: "1", url: "https://x.com/a.svg", width: 1, height: 1, mimeType: "image/svg+xml" }],
    });
    assert.equal(r.valid, false);
    assert.match(r.blockers.join(","), /INVALID_MIME/);
  });

  it("rejects unsafe/private output URL", () => {
    const r = validateAiMediaProviderResult({
      provider: "MOCK", providerJobId: "j1", mirrorProviderJobId: "j1", state: "RESULT_READY",
      jobType: "PRODUCT_IMAGE", canonicalStatus: "RESULT_READY", outputs: [{ id: "1", url: "http://127.0.0.1/secret.png", width: 1, height: 1, mimeType: "image/png" }],
    });
    assert.equal(r.valid, false);
    assert.match(r.blockers.join(","), /UNSAFE_URL/);
  });

  it("rejects missing outputs", () => {
    const r = validateAiMediaProviderResult({
      provider: "MOCK", providerJobId: "j1", mirrorProviderJobId: "j1", state: "RESULT_READY",
      jobType: "PRODUCT_IMAGE", canonicalStatus: "RESULT_READY", outputs: [],
    });
    assert.equal(r.valid, false);
    assert.match(r.blockers.join(","), /NO_OUTPUTS/);
  });

  it("accepts supported MOCK result", () => {
    const r = validateAiMediaProviderResult({
      provider: "MOCK", providerJobId: "j1", mirrorProviderJobId: "j1", state: "RESULT_READY",
      jobType: "PRODUCT_IMAGE", canonicalStatus: "RESULT_READY", outputs: [{ id: "1", url: "https://cdn.example.com/a.png", width: 512, height: 512, mimeType: "image/png" }],
    });
    assert.equal(r.valid, true);
    assert.equal(r.normalized?.resultFingerprint.length, 64);
    assert.equal(r.safeSummary.supportedProvider, true);
    assert.equal(r.safeSummary.completed, true);
  });
});

describe("AI media app-managed import service", () => {
  it("imports through storage gateway and marks IMPORTED", async () => {
    const { store, client, mirror } = buildMockDb();
    const adapter = createLocalTestApplicationStorage();
    setApplicationStorageAdapterForTesting(adapter);
    const synthetic = makeTinyPng();

    const result = await importResultReadyOutput({
      organizationId: "org-1",
      requestId: "req-1",
      mirrorId: "mirror-1",
      requestedByUserId: "user-1",
      idempotencyKey: "idem-1",
      syntheticBuffer: synthetic,
      runtime: {
        getProviderResult: async () => fakeProviderJob as any,
        storeRemote: async () => { throw new Error("should not use remote in this test"); },
        storeBuffer: async (input) => {
          const stored = await adapter.store({ ...input, key: `creative-studio/org-1/ai-media-import/${Date.now()}-${crypto.randomUUID()}.png`, checksumSha256: createHash("sha256").update(input.buffer).digest("hex"), width: 1, height: 1 });
          return stored as any;
        },
      },
    }, client);

    assert.equal(result.state, "IMPORTED");
    assert.equal(result.safety.blobWrite, false);
    assert.equal(result.safety.realGeneration, false);
    assert.equal(result.safety.walletSettlement, false);
    assert.equal(result.safety.rawProviderUrlExposed, false);
    assert.equal(result.reused, false);
    assert.equal(store.assets.length, 1);
    assert.equal(store.imports.length, 1);
    assert.ok(store.imports[0].acceptedAssetId);
  });

  it("does not mark IMPORTED when storage fails", async () => {
    const { store, client, mirror } = buildMockDb();
    setApplicationStorageAdapterForTesting(null);
    let threw = false;
    try {
      await importResultReadyOutput({
        organizationId: "org-1",
        requestId: "req-1",
        mirrorId: "mirror-1",
        requestedByUserId: "user-1",
        idempotencyKey: "idem-2",
        runtime: {
          getProviderResult: async () => fakeProviderJob as any,
          storeRemote: async () => { throw new Error("storage down"); },
          storeBuffer: async () => { throw new Error("storage down"); },
        },
      }, client);
    } catch {
      threw = true;
    }
    assert.equal(threw, true);
    assert.equal(mirror.state, "RESULT_READY");
    assert.equal(store.imports[0]?.status, "FAILED");
  });

  it("returns canonical asset on repeated import (idempotency)", async () => {
    const { store, client, mirror } = buildMockDb();
    const adapter = createLocalTestApplicationStorage();
    setApplicationStorageAdapterForTesting(adapter);
    const synthetic = makeTinyPng();
    const makeRuntime = () => ({
      getProviderResult: async () => fakeProviderJob as any,
      storeRemote: async () => { throw new Error("should not use remote"); },
      storeBuffer: async (input: any) => {
        const stored = await adapter.store({ ...input, key: `creative-studio/org-1/ai-media-import/${Date.now()}-${crypto.randomUUID()}.png`, checksumSha256: createHash("sha256").update(input.buffer).digest("hex"), width: 1, height: 1 });
        return stored as any;
      },
    });
    const first = await importResultReadyOutput({ organizationId: "org-1", requestId: "req-1", mirrorId: "mirror-1", requestedByUserId: "user-1", idempotencyKey: "idem-3", syntheticBuffer: synthetic, runtime: makeRuntime() }, client);
    const second = await importResultReadyOutput({ organizationId: "org-1", requestId: "req-1", mirrorId: "mirror-1", requestedByUserId: "user-1", idempotencyKey: "idem-3", syntheticBuffer: synthetic, runtime: makeRuntime() }, client);
    assert.equal(first.assetId, second.assetId);
    assert.equal(second.reused, true);
    assert.equal(store.assets.length, 1);
  });

  it("blocks import when mirror is not RESULT_READY", async () => {
    const { client } = buildMockDb();
    const adapter = createLocalTestApplicationStorage();
    setApplicationStorageAdapterForTesting(adapter);
    let threw = false;
    try {
      await importResultReadyOutput({
        organizationId: "org-1", requestId: "req-1", mirrorId: "mirror-1", requestedByUserId: "user-1", idempotencyKey: "idem-x",
        runtime: {
          getProviderResult: async () => ({ ...fakeProviderJob, status: "QUEUED" } as any),
          storeRemote: async () => { throw new Error("nope"); },
          storeBuffer: async () => { throw new Error("nope"); },
        },
      }, { ...client, aiMediaJobMirror: { ...client.aiMediaJobMirror, findFirst: async () => ({ ...client.aiMediaJobMirror.findFirst(), state: "SUBMITTED_TO_RENDER" }) } } as any);
    } catch {
      threw = true;
    }
    assert.equal(threw, true);
  });
});

describe("AI media app-managed import route/source safety", () => {
  it("route source is guarded and safe", () => {
    const route = readFileSync(new URL("../../app/api/dashboard/ai-media/preview/jobs/[id]/import/route.ts", import.meta.url), "utf8");
    assert.equal(/requireAuthSession/.test(route), true);
    assert.equal(/evaluateAiMediaPreviewWriteGuard/.test(route), true);
    assert.equal(/evaluateAiMediaPreviewDbIdentityGuard/.test(route), true);
    assert.equal(/importResultReadyOutput/.test(route), true);
    assert.equal(/idempotency key/i.test(route), true);
    assert.equal(/BLOB_READ_WRITE_TOKEN|NEXT_PUBLIC|AI_MEDIA_SERVICE_INTERNAL_KEY/.test(route), false);
  });
});


