/* eslint-disable @typescript-eslint/no-require-imports */
import "dotenv/config";
import { prisma } from "@/lib/db-runtime";
import { submitPreviewMockAiMediaJob } from "@/lib/services/ai-media-preview-mock-write-service";
import { syncPreviewMockAiMediaJobStatus } from "@/lib/services/ai-media-preview-mock-write-service";

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

async function main() {
  const org = await prisma.organization.create({
    data: {
      name: `AI Media CreateSync E2E Org ${Date.now()}`,
      slug: `ai-media-createsync-e2e-${Date.now()}`,
      type: "SHOP",
      locale: "fa",
      timezone: "Asia/Tehran",
      isActive: true,
      isOpen: true,
    },
  });
  const user = await prisma.user.create({
    data: {
      email: `ai-media-createsync-e2e-${Date.now()}@example.com`,
      name: `AI Media CreateSync E2E Admin ${Date.now()}`,
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

  const idempotencyKey = `local-docker-createsync-e2e-${Date.now()}`;
  const targetId = `preview-product-${Date.now()}`;

  // Step 1: create (submission) against the local contract MOCK.
  const submitted = await submitPreviewMockAiMediaJob({
    organizationId: org.id,
    requestedByUserId: user.id,
    targetType: "PRODUCT_IMAGE",
    targetId,
    idempotencyKey,
    payload: { prompt: "Local Docker create/status-sync E2E", productTitle: "Preview product", category: "preview" },
    productTitle: "Preview product",
    category: "preview",
  });
  assertNoSecretLeak(JSON.stringify(submitted));

  const createMirror = await prisma.aiMediaJobMirror.findUniqueOrThrow({ where: { id: submitted.mirror.id } });
  if (!createMirror.providerJobId) {
    throw new Error("Create did not store a provider job id (provider not reached).");
  }
  if (createMirror.provider !== "MOCK") {
    throw new Error(`Create used non-MOCK provider: ${createMirror.provider}.`);
  }

  // Step 2: explicit status sync (the path blocked by the Render HTTP 500).
  const sync = await syncPreviewMockAiMediaJobStatus({ mirrorId: createMirror.id, organizationId: org.id, actorUserId: user.id });
  assertNoSecretLeak(JSON.stringify(sync));

  const syncedMirror = await prisma.aiMediaJobMirror.findUniqueOrThrow({ where: { id: createMirror.id } });

  if (syncedMirror.state !== "RESULT_READY") {
    throw new Error(`Mirror did not reach RESULT_READY after status sync (state=${syncedMirror.state}).`);
  }

  // Step 3: idempotent reuse — same idempotency key returns the same mirror/provider job.
  const repeated = await submitPreviewMockAiMediaJob({
    organizationId: org.id,
    requestedByUserId: user.id,
    targetType: "PRODUCT_IMAGE",
    targetId,
    idempotencyKey,
    payload: { prompt: "Local Docker create/status-sync E2E repeat", productTitle: "Preview product", category: "preview" },
    productTitle: "Preview product",
    category: "preview",
  });
  if (!repeated.reused) {
    throw new Error("Repeated create with same idempotency key was not recognized as reused.");
  }
  if (repeated.mirror.id !== createMirror.id || repeated.providerJob.job_id !== createMirror.providerJobId) {
    throw new Error("Repeated create returned a different mirror/provider job than the original.");
  }

  const output = {
    ok: true,
    database: "LOCAL_DISPOSABLE",
    provider: submitted.providerJob.provider,
    createState: createMirror.state,
    syncState: syncedMirror.state,
    providerJobIdStored: Boolean(syncedMirror.providerJobId),
    appOwnedMirrorCreated: Boolean(syncedMirror.id),
    idempotentReuse: repeated.reused,
    blobWrite: false,
    realGeneration: false,
    walletSettlement: false,
    renderInternalKeyExposed: false,
  };

  // cleanup synthetic fixtures (test-only disposable DB)
  await prisma.aiMediaJobEvent.deleteMany({ where: { mirrorId: syncedMirror.id } });
  await prisma.aiMediaJobMirror.deleteMany({ where: { id: syncedMirror.id } });
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
