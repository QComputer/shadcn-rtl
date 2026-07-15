import assert from "node:assert";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const mockPort = process.env.AI_MEDIA_CONTRACT_MOCK_PORT || "4766";
const mockUrl = `http://127.0.0.1:${mockPort}`;
const localStorageRoot = path.join(process.cwd(), ".tmp", "ai-media-acceptance", "storage-concurrency");

const orgA = {
  organizationId: "ai-media-concurrency-org-a",
  organizationSlug: "ai-media-concurrency-org-a",
  userId: "ai-media-concurrency-user-a",
  categoryId: "ai-media-concurrency-category-a",
  productId: "ai-media-concurrency-product-a",
};
const orgB = {
  organizationId: "ai-media-concurrency-org-b",
  organizationSlug: "ai-media-concurrency-org-b",
  userId: "ai-media-concurrency-user-b",
  categoryId: "ai-media-concurrency-category-b",
  productId: "ai-media-concurrency-product-b",
};

function assertHermeticEnv() {
  const databaseUrl = process.env.DATABASE_URL || "";
  assert.ok(/127\.0\.0\.1|localhost/.test(databaseUrl), "DATABASE_URL must be local");
  assert.ok(!/neon/i.test(databaseUrl), "DATABASE_URL must not point to Neon");
  assert.equal(process.env.AI_MEDIA_APPLICATION_STORAGE_ADAPTER, "local-test");
  assert.notEqual(process.env.VERCEL_ENV, "production");
}

function providerIdempotencyKey(organizationId: string, idempotencyKey: string) {
  return createHash("sha256").update(JSON.stringify({
    scope: "ai-media-provider-idempotency",
    organizationId,
    idempotencyKey,
  })).digest("hex");
}

async function waitForMock() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${mockUrl}/health`);
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

async function mockJson(pathname: string, init: RequestInit = {}) {
  const response = await fetch(`${mockUrl}${pathname}`, init);
  if (!response.ok) throw new Error(`Mock request failed: ${pathname} ${response.status}`);
  return response.json() as Promise<Record<string, unknown>>;
}

async function resetMock() {
  await mockJson("/test/reset");
}

async function mockStats() {
  return mockJson("/test/stats");
}

async function cleanup(prisma: any) {
  const organizationIds = [orgA.organizationId, orgB.organizationId];
  const productIds = [orgA.productId, orgB.productId];
  const categoryIds = [orgA.categoryId, orgB.categoryId];
  const userIds = [orgA.userId, orgB.userId];
  await prisma.creativeStudioUsageEvent.deleteMany({ where: { organizationId: { in: organizationIds } } });
  await prisma.creativeStudioAsset.deleteMany({ where: { organizationId: { in: organizationIds } } });
  await prisma.creativeStudioJob.deleteMany({ where: { organizationId: { in: organizationIds } } });
  await prisma.aiMediaUsageEvent.deleteMany({ where: { organizationId: { in: organizationIds } } });
  await prisma.aiMediaJob.deleteMany({ where: { organizationId: { in: organizationIds } } });
  await prisma.auditLog.deleteMany({ where: { organizationId: { in: organizationIds } } });
  await prisma.product.deleteMany({ where: { id: { in: productIds } } });
  await prisma.productCategory.deleteMany({ where: { id: { in: categoryIds } } });
  await prisma.organizationMember.deleteMany({ where: { organizationId: { in: organizationIds } } });
  await prisma.organization.deleteMany({ where: { id: { in: organizationIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await fs.rm(localStorageRoot, { recursive: true, force: true });
}

async function createFixture(prisma: any, fixture: typeof orgA) {
  await prisma.user.create({
    data: {
      id: fixture.userId,
      name: fixture.userId,
      password: "local-only",
      role: "ADMIN",
      isActive: true,
      email: `${fixture.userId}@example.invalid`,
    },
  });
  await prisma.organization.create({
    data: {
      id: fixture.organizationId,
      name: `AI Media ${fixture.organizationSlug}`,
      slug: fixture.organizationSlug,
      type: "SHOP",
      isActive: true,
    },
  });
  await prisma.organizationMember.create({
    data: {
      organizationId: fixture.organizationId,
      organizationSlug: fixture.organizationSlug,
      userId: fixture.userId,
      role: "ADMIN",
    },
  });
  await prisma.productCategory.create({
    data: {
      id: fixture.categoryId,
      name: "Hermetic Category",
      organizationId: fixture.organizationId,
      organizationSlug: fixture.organizationSlug,
    },
  });
  await prisma.product.create({
    data: {
      id: fixture.productId,
      name: `Hermetic Product ${fixture.organizationSlug}`,
      basePrice: 1000,
      organizationId: fixture.organizationId,
      organizationSlug: fixture.organizationSlug,
      categoryId: fixture.categoryId,
    },
  });
}

async function createFixtures(prisma: any) {
  await createFixture(prisma, orgA);
  await createFixture(prisma, orgB);
}

async function countStoragePngs() {
  try {
    const entries = await fs.readdir(localStorageRoot, { recursive: true });
    return entries.filter((entry) => String(entry).endsWith(".png")).length;
  } catch {
    return 0;
  }
}

async function resetScenario(prisma: any) {
  await cleanup(prisma);
  await createFixtures(prisma);
  await resetMock();
}

async function main() {
  process.env.AI_MEDIA_SERVICE_ENABLED = "true";
  process.env.AI_MEDIA_SERVICE_URL = mockUrl;
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
  const { setApplicationStorageAdapterForTesting } = await import("@/lib/storage/application-storage");
  const { createLocalTestApplicationStorage } = await import("@/lib/storage/local-test-storage");
  setApplicationStorageAdapterForTesting(createLocalTestApplicationStorage());
  const { aiMediaService } = await import("@/lib/services/ai-media.service");

  const create = (fixture: typeof orgA, idempotencyKey: string, sellerPrompt: string) => aiMediaService.createJob(
    fixture.productId,
    fixture.organizationId,
    fixture.userId,
    "ADMIN",
    {
      count: 1,
      seller_prompt: sellerPrompt,
      idempotencyKey,
    },
  );

  try {
    await resetScenario(prisma);
    const duplicate10 = await Promise.all(Array.from({ length: 10 }, () =>
      create(orgA, "concurrent-same-key", "Same tenant and same payload"),
    ));
    assert.equal(new Set(duplicate10.map((result) => result.localJobId)).size, 1);
    assert.equal(new Set(duplicate10.map((result) => result.job.job_id)).size, 1);
    assert.equal(await prisma.aiMediaJob.count({ where: { organizationId: orgA.organizationId } }), 1);
    assert.equal((await mockStats()).jobs, 1);

    await resetScenario(prisma);
    const conflict = await Promise.allSettled([
      create(orgA, "concurrent-conflict-key", "First payload"),
      create(orgA, "concurrent-conflict-key", "Different payload"),
    ]);
    assert.equal(conflict.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(conflict.filter((result) => result.status === "rejected").length, 1);
    assert.equal(await prisma.aiMediaJob.count({ where: { organizationId: orgA.organizationId } }), 1);
    assert.equal((await mockStats()).jobs, 1);

    await resetScenario(prisma);
    const crossTenant = await Promise.all([
      create(orgA, "shared-cross-tenant-key", "Tenant scoped payload"),
      create(orgB, "shared-cross-tenant-key", "Tenant scoped payload"),
    ]);
    assert.equal(new Set(crossTenant.map((result) => result.localJobId)).size, 2);
    assert.equal(await prisma.aiMediaJob.count({ where: { organizationId: { in: [orgA.organizationId, orgB.organizationId] } } }), 2);
    assert.equal((await mockStats()).jobs, 2);

    await resetScenario(prisma);
    const lostResponseKey = "provider-accepted-response-lost";
    await mockJson("/test/fail-after-accept-once", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-bazarbaz-ai-key": process.env.AI_MEDIA_SERVICE_INTERNAL_KEY!,
      },
      body: JSON.stringify({ idempotency_key: providerIdempotencyKey(orgA.organizationId, lostResponseKey) }),
    });
    const firstLost = await Promise.allSettled([create(orgA, lostResponseKey, "Lost response payload")]);
    assert.equal(firstLost[0].status, "rejected");
    const recovered = await create(orgA, lostResponseKey, "Lost response payload");
    assert.equal(await prisma.aiMediaJob.count({ where: { organizationId: orgA.organizationId } }), 1);
    assert.equal((await mockStats()).jobs, 1);
    assert.equal(recovered.job.provider, "MOCK");

    await resetScenario(prisma);
    const ingestionJob = await create(orgA, "concurrent-ingestion-key", "Concurrent ingestion payload");
    assert.equal(ingestionJob.job.outputs?.length, 1);
    const selected = await Promise.all(Array.from({ length: 10 }, () => aiMediaService.selectImage(
      orgA.organizationId,
      orgA.productId,
      ingestionJob.job.job_id,
      ingestionJob.job.outputs![0].url,
      0,
    )));
    assert.equal(new Set(selected.map((result) => result.imageUrl)).size, 1);
    assert.equal(await countStoragePngs(), 1);
    assert.equal(await prisma.aiMediaUsageEvent.count({
      where: {
        organizationId: orgA.organizationId,
        productId: orgA.productId,
        jobId: ingestionJob.job.job_id,
        action: "IMAGE_SELECTED",
      },
    }), 1);

    console.log(JSON.stringify({
      ok: true,
      sameTenantDuplicate10: "one-job",
      payloadConflict: "409",
      crossTenantSameKey: "distinct-jobs",
      providerAcceptedResponseLost: "recovered-without-duplicate-provider-work",
      concurrentIngestion: "one-storage-object",
      providerJobs: (await mockStats()).jobs,
      storageObjectsCreated: await countStoragePngs(),
      productionBlobCalls: 0,
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
