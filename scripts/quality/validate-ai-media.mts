import assert from "node:assert";
import { describe, it, before } from "node:test";
import { prisma } from "@/lib/db";

process.env.AI_MEDIA_APPLICATION_STORAGE_ADAPTER = "local-test";
process.env.AI_MEDIA_LOCAL_STORAGE_ROOT = ".tmp/ai-media-quality-storage";

const originalFetch = globalThis.fetch;
const tinyPng = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
  0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
  0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82,
]);

globalThis.fetch = async (input, init) => {
  const url = input instanceof URL ? input.href : typeof input === "string" ? input : input.url;
  if (url.startsWith("https://example.com/")) {
    return new Response(tinyPng, {
      status: 200,
      headers: {
        "content-type": "image/png",
        "content-length": String(tinyPng.byteLength),
      },
    });
  }
  return originalFetch(input, init);
};

before(async () => {
  const { createLocalTestApplicationStorage } = await import("@/lib/storage/local-test-storage");
  const { setApplicationStorageAdapterForTesting } = await import("@/lib/storage/application-storage");
  setApplicationStorageAdapterForTesting(createLocalTestApplicationStorage());
});

async function createTestJob(overrides: { status?: string; outputs?: Array<{ url: string }> } = {}) {
  return prisma.aiMediaJob.create({
    data: {
      jobId: "test-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
      organizationId: "test-org",
      productId: "test-product",
      requestedByUserId: "test-user",
      status: overrides.status ?? "PENDING",
      provider: "MOCK",
      inputs: {},
      outputs: overrides.outputs ?? null,
    },
  });
}

async function ensureTestProduct() {
  const existing = await prisma.product.findFirst({
    where: { id: "test-product", deletedAt: null },
    select: { id: true },
  });
  if (existing) return;

  await prisma.organization.upsert({
    where: { id: "test-org" },
    update: {},
    create: { id: "test-org", name: "Test Org", slug: "test-org", type: "SHOP" },
  });

  await prisma.productCategory.upsert({
    where: { id: "test-category" },
    update: {},
    create: {
      id: "test-category",
      name: "Test Category",
      organizationId: "test-org",
      organizationSlug: "test-org",
    },
  });

  await prisma.product.create({
    data: {
      id: "test-product",
      name: "Test Product",
      basePrice: 1000,
      organizationId: "test-org",
      organizationSlug: "test-org",
      categoryId: "test-category",
    },
  });
}

describe("BazarBaz AI Media Integration", () => {
  it("should have server-only import at top of client module", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const clientPath = path.join(process.cwd(), "lib/services/ai-media-service-client.ts");
    const content = fs.readFileSync(clientPath, "utf8");
    assert.ok(content.includes('import "server-only"'), "client must import server-only");
  });

  it("should have required exports from ai-media service", async () => {
    const { aiMediaService } = await import("@/lib/services/ai-media.service");
    assert.strictEqual(typeof aiMediaService.createJob, "function");
    assert.strictEqual(typeof aiMediaService.getJobById, "function");
    assert.strictEqual(typeof aiMediaService.selectImage, "function");
    assert.strictEqual(typeof aiMediaService.getLocalJob, "function");
  });

  it("should have required exports from ai-media client", async () => {
    const client = await import("@/lib/services/ai-media-service-client");
    assert.strictEqual(typeof client.createAiMediaJob, "function");
    assert.strictEqual(typeof client.getAiMediaJob, "function");
    assert.strictEqual(typeof client.cancelAiMediaJob, "function");
    assert.strictEqual(typeof client.AiMediaServiceError, "function");
  });
});

describe("AiMediaService selectImage", () => {
  it("should reject selection when job is not COMPLETED", async () => {
    const { aiMediaService } = await import("@/lib/services/ai-media.service");
    const pendingJob = await createTestJob({ status: "QUEUED" });

    try {
      await aiMediaService.selectImage("test-org", "test-product", pendingJob.jobId, "https://example.com/x.png", 0);
      assert.fail("should have thrown");
    } catch (error) {
      assert.strictEqual(error.status, 400, `expected 400, got ${error.status}: ${error.message}`);
      assert.ok(error.message.includes("Only completed"), `unexpected message: ${error.message}`);
    } finally {
      await prisma.aiMediaJob.delete({ where: { id: pendingJob.id } });
    }
  });

  it("should reject selection when image does not match outputs", async () => {
    const { aiMediaService } = await import("@/lib/services/ai-media.service");
    await ensureTestProduct();

    const completedJob = await createTestJob({
      status: "COMPLETED",
      outputs: [{ url: "https://example.com/real.png" }],
    });

    try {
      await aiMediaService.selectImage("test-org", "test-product", completedJob.jobId, "https://example.com/wrong.png", 0);
      assert.fail("should have thrown");
    } catch (error) {
      assert.strictEqual(error.status, 400, `expected 400, got ${error.status}: ${error.message}`);
      assert.ok(error.message.includes("must match"), `unexpected message: ${error.message}`);
    } finally {
      await prisma.aiMediaJob.delete({ where: { id: completedJob.id } });
    }
  });

  it("should fallback to latest completed job when jobId is omitted", async () => {
    const { aiMediaService } = await import("@/lib/services/ai-media.service");
    await ensureTestProduct();

    const oldJob = await createTestJob({
      status: "COMPLETED",
      outputs: [{ url: "https://example.com/old.png" }],
    });

    const newJob = await createTestJob({
      status: "COMPLETED",
      outputs: [{ url: "https://example.com/new.png" }],
    });

    try {
      const result = await aiMediaService.selectImage("test-org", "test-product", undefined, "https://example.com/new.png", 0);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.storedDurably, true);
      assert.ok(result.imageUrl.startsWith("/uploads/creative-studio/test-org/ai-media-product-test-product/"));
    } finally {
      await prisma.aiMediaJob.delete({ where: { id: oldJob.id } });
      await prisma.aiMediaJob.delete({ where: { id: newJob.id } });
    }
  });

  it("should return 404 for unknown organization", async () => {
    const { aiMediaService } = await import("@/lib/services/ai-media.service");
    await ensureTestProduct();

    const completedJob = await createTestJob({
      status: "COMPLETED",
      outputs: [{ url: "https://example.com/x.png" }],
    });

    try {
      await aiMediaService.selectImage("wrong-org", "test-product", completedJob.jobId, "https://example.com/x.png", 0);
      assert.fail("should have thrown");
    } catch (error) {
      assert.strictEqual(error.status, 404, `expected 404, got ${error.status}: ${error.message}`);
    } finally {
      await prisma.aiMediaJob.delete({ where: { id: completedJob.id } });
    }
  });
});
