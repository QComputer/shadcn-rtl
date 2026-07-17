/* eslint-disable @typescript-eslint/no-require-imports */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db-runtime";
import { submitPreviewMockAiMediaJob } from "@/lib/services/ai-media-preview-mock-write-service";
import { syncPreviewMockAiMediaJobStatus } from "@/lib/services/ai-media-preview-mock-write-service";
import { importResultReadyOutput } from "@/lib/services/ai-media-result-import-service";
import { createLocalTestApplicationStorage } from "@/lib/storage/local-test-storage";
import { setApplicationStorageAdapterForTesting } from "@/lib/storage/application-storage";

const DATABASE_URL = process.env.DATABASE_URL as string;
const DIRECT_URL = process.env.DIRECT_URL as string;
if (!/127\.0\.0\.1|localhost/.test(DATABASE_URL) || /neon/i.test(DATABASE_URL)) {
  throw new Error("Refusing to run against a non-local database.");
}
if (!process.env.AI_MEDIA_SERVICE_INTERNAL_KEY) {
  throw new Error("AI_MEDIA_SERVICE_INTERNAL_KEY is not configured server-side.");
}

function assertNoSecretLeak(text: string) {
  if (/AI_MEDIA_SERVICE_INTERNAL_KEY|BLOB_READ_WRITE_TOKEN|DATABASE_URL|DIRECT_URL|Bearer\s+[A-Za-z0-9_.-]+/i.test(text)) {
    throw new Error("Response contained secret-like text.");
  }
}

async function storageKeyExists(key: string) {
  const adapter = createLocalTestApplicationStorage();
  return adapter.verify ? adapter.verify({ organizationId: "*", key }) : true;
}

async function main() {
  const baseAdapter = createLocalTestApplicationStorage();
  let lastStoredKey = "";
  const adapter: typeof baseAdapter = {
    provider: baseAdapter.provider,
    store: async (input) => {
      const stored = await baseAdapter.store(input);
      lastStoredKey = stored.key;
      return stored;
    },
    remove: (input) => baseAdapter.remove(input),
    verify: async (input) => baseAdapter.verify?.(input) ?? true,
  };
  setApplicationStorageAdapterForTesting(adapter);

  const org = await prisma.organization.create({
    data: {
      name: `AI Media Import E2E Org ${Date.now()}`,
      slug: `ai-media-import-e2e-${Date.now()}`,
      type: "SHOP",
      locale: "fa",
      timezone: "Asia/Tehran",
      isActive: true,
      isOpen: true,
    },
  });
  const user = await prisma.user.create({
    data: {
      email: `ai-media-import-e2e-${Date.now()}@example.com`,
      name: `AI Media Import E2E Admin ${Date.now()}`,
      role: "SUPER_ADMIN",
      password: "disabled-e2e-fixture",
      locale: "fa",
      theme: "system",
      isActive: true,
      isTeamMember: false,
      failedLoginAttempts: 0,
    },
  });
  await prisma.organizationMember.create({
    data: { organization: { connect: { id: org.id } }, user: { connect: { id: user.id } }, role: "ADMIN", isActive: true },
  });

  const idempotencyKey = `local-docker-import-e2e-${Date.now()}`;
  const targetId = `preview-product-${Date.now()}`;

  const submitted = await submitPreviewMockAiMediaJob({
    organizationId: org.id,
    requestedByUserId: user.id,
    targetType: "PRODUCT_IMAGE",
    targetId,
    idempotencyKey,
    payload: { prompt: "Local Docker import E2E", productTitle: "Preview product", category: "preview" },
    productTitle: "Preview product",
    category: "preview",
  });

  let mirror = await prisma.aiMediaJobMirror.findUniqueOrThrow({ where: { id: submitted.mirror.id } });
  assertNoSecretLeak(JSON.stringify(submitted));

  // Step 1: synchronize to RESULT_READY.
  let syncState = mirror.state;
  if (mirror.providerJobId) {
    const sync = await syncPreviewMockAiMediaJobStatus({ mirrorId: mirror.id, organizationId: org.id, actorUserId: user.id });
    syncState = (sync as any)?.state ?? mirror.state;
    assertNoSecretLeak(JSON.stringify(sync));
  }
  mirror = await prisma.aiMediaJobMirror.findUniqueOrThrow({ where: { id: submitted.mirror.id } });

  if (mirror.state !== "RESULT_READY") {
    throw new Error(`Mirror did not reach RESULT_READY (state=${mirror.state}).`);
  }

  // Step 2: app-managed import through storage gateway + local-test adapter.
  const result = await importResultReadyOutput({
    organizationId: org.id,
    requestId: submitted.request.id,
    mirrorId: mirror.id,
    requestedByUserId: user.id,
    idempotencyKey: `import-${idempotencyKey}`,
    syntheticBuffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
  });

  assertNoSecretLeak(JSON.stringify(result));

  const importedMirror = await prisma.aiMediaJobMirror.findUniqueOrThrow({ where: { id: mirror.id } });
  const importedRequest = await prisma.aiMediaRequest.findUniqueOrThrow({ where: { id: submitted.request.id } });
  const asset = await prisma.aiMediaAsset.findUniqueOrThrow({ where: { id: result.assetId } });
  const importRecord = await prisma.aiMediaImport.findUniqueOrThrow({ where: { id: result.importId } });
  const storageExists = lastStoredKey ? await storageKeyExists(lastStoredKey) : false;

  // Step 3: idempotency — repeat import returns canonical asset.
  const repeat = await importResultReadyOutput({
    organizationId: org.id,
    requestId: submitted.request.id,
    mirrorId: mirror.id,
    requestedByUserId: user.id,
    idempotencyKey: `import-${idempotencyKey}`,
  });

  const output = {
    ok: true,
    database: "LOCAL_DISPOSABLE",
    provider: submitted.providerJob.provider,
    syncState,
    mirrorStateAfterImport: importedMirror.state,
    requestStatusAfterImport: importedRequest.status,
    importStatus: importRecord.status,
    assetCreated: Boolean(asset.id),
    storageKeyPresent: Boolean(asset.storageKeyFingerprint || lastStoredKey),
    storageObjectExists: storageExists,
    providerJobIdStored: Boolean(importedMirror.providerJobId),
    idempotentReuse: repeat.reused,
    canonicalAssetMatches: repeat.assetId === asset.id,
    blobWrite: false,
    realGeneration: false,
    walletSettlement: false,
    renderInternalKeyExposed: false,
  };

  // cleanup synthetic fixtures (test-only disposable DB)
  await prisma.aiMediaJobEvent.deleteMany({ where: { mirrorId: mirror.id } });
  await prisma.aiMediaAsset.deleteMany({ where: { id: asset.id } });
  await prisma.aiMediaImport.deleteMany({ where: { id: importRecord.id } });
  await prisma.aiMediaJobMirror.deleteMany({ where: { id: mirror.id } });
  await prisma.aiMediaRequest.deleteMany({ where: { id: submitted.request.id } });
  await prisma.organizationMember.deleteMany({ where: { organizationId: org.id } });
  await prisma.user.deleteMany({ where: { id: user.id } });
  await prisma.organization.deleteMany({ where: { id: org.id } });

  console.log(JSON.stringify(output, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
