import assert from "node:assert";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const mockPort = process.env.AI_MEDIA_CONTRACT_MOCK_PORT || "4765";
const localStorageRoot = path.join(process.cwd(), ".tmp", "ai-media-acceptance", "storage");
const testIds = {
  organizationId: "ai-media-hermetic-org-a",
  organizationSlug: "ai-media-hermetic-org-a",
  userId: "ai-media-hermetic-user-a",
  categoryId: "ai-media-hermetic-category-a",
  productId: "ai-media-hermetic-product-a",
};

function assertHermeticEnv() {
  const databaseUrl = process.env.DATABASE_URL || "";
  assert.ok(/127\.0\.0\.1|localhost/.test(databaseUrl), "DATABASE_URL must be local");
  assert.ok(!/neon/i.test(databaseUrl), "DATABASE_URL must not point to Neon");
  assert.equal(process.env.AI_MEDIA_APPLICATION_STORAGE_ADAPTER, "local-test");
  assert.notEqual(process.env.VERCEL_ENV, "production");
}

async function waitForMock() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${mockPort}/health`);
      if (response.ok) return;
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Local AI media contract mock did not become ready");
}

function startMock(): ChildProcessWithoutNullStreams {
  const child = spawn(process.execPath, ["scripts/ai-media/local-contract-mock.mjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      AI_MEDIA_CONTRACT_MOCK_PORT: mockPort,
      AI_MEDIA_SERVICE_INTERNAL_KEY: process.env.AI_MEDIA_SERVICE_INTERNAL_KEY || "local-ai-media-test-key",
    },
    stdio: "pipe",
  });
  child.stderr.on("data", (data) => process.stderr.write(data));
  return child;
}

async function cleanup(prisma: any) {
  await prisma.creativeStudioUsageEvent.deleteMany({ where: { organizationId: testIds.organizationId } });
  await prisma.creativeStudioAsset.deleteMany({ where: { organizationId: testIds.organizationId } });
  await prisma.creativeStudioJob.deleteMany({ where: { organizationId: testIds.organizationId } });
  await prisma.aiMediaUsageEvent.deleteMany({ where: { organizationId: testIds.organizationId } });
  await prisma.aiMediaJob.deleteMany({ where: { organizationId: testIds.organizationId } });
  await prisma.auditLog.deleteMany({ where: { organizationId: testIds.organizationId } });
  await prisma.product.deleteMany({ where: { id: testIds.productId } });
  await prisma.productCategory.deleteMany({ where: { id: testIds.categoryId } });
  await prisma.organizationMember.deleteMany({ where: { organizationId: testIds.organizationId } });
  await prisma.organization.deleteMany({ where: { id: testIds.organizationId } });
  await prisma.user.deleteMany({ where: { id: testIds.userId } });
  await fs.rm(localStorageRoot, { recursive: true, force: true });
}

async function createFixtures(prisma: any) {
  await prisma.user.create({
    data: {
      id: testIds.userId,
      name: "ai-media-hermetic-user-a",
      password: "local-only",
      role: "ADMIN",
      isActive: true,
      email: "ai-media-hermetic-a@example.invalid",
    },
  });
  await prisma.organization.create({
    data: {
      id: testIds.organizationId,
      name: "AI Media Hermetic Org A",
      slug: testIds.organizationSlug,
      type: "SHOP",
      isActive: true,
    },
  });
  await prisma.organizationMember.create({
    data: {
      organizationId: testIds.organizationId,
      organizationSlug: testIds.organizationSlug,
      userId: testIds.userId,
      role: "ADMIN",
    },
  });
  await prisma.productCategory.create({
    data: {
      id: testIds.categoryId,
      name: "Hermetic Category",
      organizationId: testIds.organizationId,
      organizationSlug: testIds.organizationSlug,
    },
  });
  await prisma.product.create({
    data: {
      id: testIds.productId,
      name: "Hermetic Product",
      basePrice: 1000,
      organizationId: testIds.organizationId,
      organizationSlug: testIds.organizationSlug,
      categoryId: testIds.categoryId,
    },
  });
}

async function main() {
  process.env.AI_MEDIA_SERVICE_ENABLED = "true";
  process.env.AI_MEDIA_SERVICE_URL = `http://127.0.0.1:${mockPort}`;
  process.env.AI_MEDIA_SERVICE_INTERNAL_KEY = process.env.AI_MEDIA_SERVICE_INTERNAL_KEY || "local-ai-media-test-key";
  process.env.AI_MEDIA_APPLICATION_STORAGE_ADAPTER = "local-test";
  process.env.AI_MEDIA_LOCAL_STORAGE_ROOT = localStorageRoot;
  process.env.SMS_DRY_RUN = "true";
  process.env.EMAIL_DRY_RUN = "true";
  process.env.WEB_PUSH_REAL_SEND_ENABLED = "false";
  process.env.DOMAIN_PROVIDER_MUTATION_ENABLED = "false";
  process.env.TENANT_PROVISIONING_EXECUTION_ENABLED = "false";
  assertHermeticEnv();

  const mock = startMock();
  await waitForMock();

  const { prisma } = await import("@/lib/db");
  const { aiMediaService } = await import("@/lib/services/ai-media.service");
  const { creativeStudioService } = await import("@/lib/services/creative-studio.service");

  try {
    await cleanup(prisma);
    await createFixtures(prisma);

    const aiResult = await aiMediaService.createJob(
      testIds.productId,
      testIds.organizationId,
      testIds.userId,
      "ADMIN",
      {
        count: 1,
        seller_prompt: "Simple generic product box on a neutral studio background",
        idempotencyKey: "ai-media-hermetic-idempotency-a",
      },
    );
    assert.equal(aiResult.job.provider, "MOCK");
    assert.equal(aiResult.job.status, "COMPLETED");
    assert.equal(aiResult.job.outputs?.length, 1);

    const selected = await aiMediaService.selectImage(
      testIds.organizationId,
      testIds.productId,
      aiResult.job.job_id,
      aiResult.job.outputs![0].url,
      0,
    );
    assert.equal(selected.storedDurably, true);
    assert.equal(selected.storageStatus, "application-storage");
    assert.ok(selected.imageUrl.startsWith("/uploads/creative-studio/"));

    const creative = await creativeStudioService.createJob(
      testIds.organizationId,
      testIds.userId,
      "ADMIN",
      {
        targetType: "PRODUCT",
        targetId: testIds.productId,
        assetType: "PRODUCT_IMAGE",
        prompt: "Simple generic product box on a neutral studio background",
        count: 1,
        aspect_ratio: "1:1",
        style_preset: "LIGHT_MENU_PHOTO",
        idempotency_key: "ai-media-hermetic-creative-idempotency-a",
      },
    );
    const assets = await prisma.creativeStudioAsset.findMany({
      where: { organizationId: testIds.organizationId, jobId: creative.job.id },
      orderBy: { createdAt: "desc" },
    });
    assert.equal(assets.length, 1);
    assert.equal(assets[0].assetType, "PRODUCT_IMAGE");
    assert.ok(assets[0].storedUrl?.startsWith("/uploads/creative-studio/"));
    assert.ok(JSON.stringify(assets[0].sourceMetadata).includes("p04aApplicationStorage"));

    const storageFiles = await fs.readdir(localStorageRoot, { recursive: true });
    assert.ok(storageFiles.length >= 1);

    console.log(JSON.stringify({
      ok: true,
      localJobsCreated: 2,
      localAssetsCreated: assets.length,
      storageObjectsCreated: storageFiles.filter((entry) => String(entry).endsWith(".png")).length,
      provider: "MOCK",
      storage: "LOCAL_TEST",
      realGpuOperation: false,
    }));
  } finally {
    await cleanup(prisma);
    await prisma.$disconnect();
    mock.kill();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
