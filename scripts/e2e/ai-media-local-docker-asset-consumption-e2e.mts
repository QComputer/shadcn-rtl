/* eslint-disable @typescript-eslint/no-require-imports */
import "dotenv/config";
import { prisma } from "@/lib/db-runtime";
import { submitPreviewMockAiMediaJob } from "@/lib/services/ai-media-preview-mock-write-service";
import { syncPreviewMockAiMediaJobStatus } from "@/lib/services/ai-media-preview-mock-write-service";
import { importResultReadyOutput } from "@/lib/services/ai-media-result-import-service";
import { listAvailableAiMediaAssets } from "@/lib/services/ai-media-asset-service";
import { getAiMediaAssetForUse } from "@/lib/services/ai-media-asset-service";
import { validateAiMediaAssetForSelection } from "@/lib/services/ai-media-asset-selection-service";
import { createLocalTestApplicationStorage } from "@/lib/storage/local-test-storage";
import { setApplicationStorageAdapterForTesting } from "@/lib/storage/application-storage";

const DATABASE_URL = process.env.DATABASE_URL as string;
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

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
function makeTinyPng() {
  const buf = Buffer.alloc(74);
  PNG_SIGNATURE.copy(buf, 0);
  buf.writeUInt32BE(13, 16);
  buf.writeUInt32BE(1, 20);
  return buf;
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
    streamContent: (input) => baseAdapter.streamContent?.(input) ?? null,
  };
  setApplicationStorageAdapterForTesting(adapter);

  const org = await prisma.organization.create({
    data: {
      name: `AI Media Asset E2E Org ${Date.now()}`,
      slug: `ai-media-asset-e2e-${Date.now()}`,
      type: "SHOP",
      locale: "fa",
      timezone: "Asia/Tehran",
      isActive: true,
      isOpen: true,
    },
  });
  const user = await prisma.user.create({
    data: {
      email: `ai-media-asset-e2e-${Date.now()}@example.com`,
      name: `AI Media Asset E2E Admin ${Date.now()}`,
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

  const idempotencyKey = `local-docker-asset-e2e-${Date.now()}`;
  const targetId = `preview-product-${Date.now()}`;

  // Step 1: create + status sync
  const submitted = await submitPreviewMockAiMediaJob({
    organizationId: org.id,
    requestedByUserId: user.id,
    targetType: "PRODUCT_IMAGE",
    targetId,
    idempotencyKey,
    payload: { prompt: "Local Docker asset consumption E2E", productTitle: "Preview product", category: "preview" },
    productTitle: "Preview product",
    category: "preview",
  });
  assertNoSecretLeak(JSON.stringify(submitted));

  let mirror = await prisma.aiMediaJobMirror.findUniqueOrThrow({ where: { id: submitted.mirror.id } });
  if (mirror.providerJobId) {
    const sync = await syncPreviewMockAiMediaJobStatus({ mirrorId: mirror.id, organizationId: org.id, actorUserId: user.id });
    assertNoSecretLeak(JSON.stringify(sync));
  }
  mirror = await prisma.aiMediaJobMirror.findUniqueOrThrow({ where: { id: submitted.mirror.id } });
  if (mirror.state !== "RESULT_READY") {
    throw new Error(`Mirror did not reach RESULT_READY (state=${mirror.state}).`);
  }

  // Step 2: import through app-managed storage
  const importResult = await importResultReadyOutput({
    organizationId: org.id,
    requestId: submitted.request.id,
    mirrorId: mirror.id,
    requestedByUserId: user.id,
    idempotencyKey: `import-${idempotencyKey}`,
    syntheticBuffer: makeTinyPng(),
  });
  assertNoSecretLeak(JSON.stringify(importResult));

  const importedMirror = await prisma.aiMediaJobMirror.findUniqueOrThrow({ where: { id: mirror.id } });
  const importRecord = await prisma.aiMediaImport.findUniqueOrThrow({ where: { id: importResult.importId } });
  const asset = await prisma.aiMediaAsset.findFirst({
    where: { id: importResult.assetId, organizationId: org.id },
    include: { import: true },
  });
  if (!asset) {
    throw new Error("Asset not found after import");
  }

  // Step 3: owning org lists assets
  const listResult = await listAvailableAiMediaAssets({ organizationId: org.id, page: 1, pageSize: 20 });
  assertNoSecretLeak(JSON.stringify(listResult));
  if (listResult.items.length !== 1) {
    throw new Error(`Expected 1 asset in list, got ${listResult.items.length}`);
  }

  // Step 4: owning org reads asset detail
  const detail = await getAiMediaAssetForUse(asset.id, org.id);
  if (!detail) {
    throw new Error("Owning org could not read asset detail");
  }
  assertNoSecretLeak(JSON.stringify(detail));

  // Step 5: content stream
  const { streamAiMediaAssetContent } = await import("@/lib/services/ai-media-asset-service");
  const contentStream = await streamAiMediaAssetContent(asset, org.id);
  if (!contentStream) {
    const storageKey = asset.storageKey || asset.storageKeyFingerprint;
    console.error("DEBUG: contentStream null, storageKey=", storageKey, "storageProvider=", asset.storageProvider, "mimeType=", asset.mimeType);
    const { createLocalTestApplicationStorage } = await import("@/lib/storage/local-test-storage");
    const adapter = createLocalTestApplicationStorage();
    const verifyResult = await adapter.verify?.({ organizationId: org.id, key: storageKey || "" });
    console.error("DEBUG: verifyResult=", verifyResult);
    throw new Error("Content stream was null");
  }
  const chunks: Uint8Array[] = [];
  const reader = contentStream.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const contentBuffer = Buffer.concat(chunks.map((c) => Buffer.from(c)));
  if (!contentBuffer.slice(0, 8).equals(PNG_SIGNATURE.slice(0, 8))) {
    throw new Error("Content stream did not return PNG data");
  }

  // Step 6: selection service accepts canonical asset
  const selectionRef = await validateAiMediaAssetForSelection(asset.id, org.id);
  assertNoSecretLeak(JSON.stringify(selectionRef));
  if (selectionRef.id !== asset.id) {
    throw new Error("Selection ref id mismatch");
  }

  // Step 7: foreign org cannot list/read/fetch
  const foreignOrg = await prisma.organization.create({
    data: {
      name: `AI Media Foreign Org ${Date.now()}`,
      slug: `ai-media-foreign-${Date.now()}`,
      type: "SHOP",
      locale: "fa",
      timezone: "Asia/Tehran",
      isActive: true,
      isOpen: true,
    },
  });
  const foreignUser = await prisma.user.create({
    data: {
      email: `ai-media-foreign-${Date.now()}@example.com`,
      name: `AI Media Foreign Admin ${Date.now()}`,
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
    data: { organization: { connect: { id: foreignOrg.id } }, user: { connect: { id: foreignUser.id } }, role: "ADMIN", isActive: true },
  });

  const foreignList = await listAvailableAiMediaAssets({ organizationId: foreignOrg.id, page: 1, pageSize: 20 });
  if (foreignList.items.length !== 0) {
    throw new Error(`Foreign org should see 0 assets, got ${foreignList.items.length}`);
  }

  const foreignDetail = await getAiMediaAssetForUse(asset.id, foreignOrg.id);
  if (foreignDetail !== null) {
    throw new Error("Foreign org should not read asset detail");
  }

  let foreignSelectionThrew = false;
  try {
    await validateAiMediaAssetForSelection(asset.id, foreignOrg.id);
  } catch {
    foreignSelectionThrew = true;
  }
  if (!foreignSelectionThrew) {
    throw new Error("Selection should reject foreign asset");
  }

  const output = {
    ok: true,
    database: "LOCAL_DISPOSABLE",
    provider: submitted.providerJob.provider,
    createState: mirror.state,
    importState: importRecord.status,
    assetCreated: Boolean(asset.id),
    assetListed: listResult.items.length === 1,
    assetDetailAvailable: detail !== null,
    contentStreamAvailable: contentBuffer.length > 0,
    selectionAccepted: selectionRef.id === asset.id,
    foreignListBlocked: foreignList.items.length === 0,
    foreignDetailBlocked: foreignDetail === null,
    foreignSelectionBlocked: foreignSelectionThrew,
    blobWrite: false,
    realGeneration: false,
    walletSettlement: false,
    renderInternalKeyExposed: false,
    providerUrlExposed: false,
  };

  await prisma.aiMediaJobEvent.deleteMany({ where: { mirrorId: mirror.id } });
  await prisma.aiMediaAsset.deleteMany({ where: { id: asset.id } });
  await prisma.aiMediaImport.deleteMany({ where: { id: importRecord.id } });
  await prisma.aiMediaJobMirror.deleteMany({ where: { id: mirror.id } });
  await prisma.aiMediaRequest.deleteMany({ where: { id: submitted.request.id } });
  await prisma.organizationMember.deleteMany({ where: { organizationId: foreignOrg.id } });
  await prisma.user.deleteMany({ where: { id: foreignUser.id } });
  await prisma.organization.deleteMany({ where: { id: foreignOrg.id } });
  await prisma.organizationMember.deleteMany({ where: { organizationId: org.id } });
  await prisma.user.deleteMany({ where: { id: user.id } });
  await prisma.organization.deleteMany({ where: { id: org.id } });

  console.log(JSON.stringify(output, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
