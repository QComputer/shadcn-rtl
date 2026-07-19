import "dotenv/config";
import { prisma } from "@/lib/db-runtime";
import { submitPreviewMockAiMediaJob, syncPreviewMockAiMediaJobStatus } from "@/lib/services/ai-media-preview-mock-write-service";
import { importResultReadyOutput } from "@/lib/services/ai-media-result-import-service";
import {
  attachAiMediaAssetToProduct,
  attachAiMediaAssetToService,
  detachAiMediaAssetFromService,
  streamPublicProductAiMedia,
  streamPublicServiceAiMedia,
} from "@/lib/services/ai-media-entity-attachment-service";
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

async function importAsset(orgId: string, userId: string, suffix: string) {
  const submitted = await submitPreviewMockAiMediaJob({
    organizationId: orgId,
    requestedByUserId: userId,
    targetType: "PRODUCT_IMAGE",
    targetId: `attach-target-${suffix}`,
    idempotencyKey: `local-docker-attach-${suffix}`,
    payload: { prompt: "Local Docker product service attachment", productTitle: "Preview product", category: "preview" },
    productTitle: "Preview product",
    category: "preview",
  });
  assertNoSecretLeak(JSON.stringify(submitted));

  let mirror = await prisma.aiMediaJobMirror.findUniqueOrThrow({ where: { id: submitted.mirror.id } });
  if (mirror.providerJobId) {
    const sync = await syncPreviewMockAiMediaJobStatus({ mirrorId: mirror.id, organizationId: orgId, actorUserId: userId });
    assertNoSecretLeak(JSON.stringify(sync));
  }
  mirror = await prisma.aiMediaJobMirror.findUniqueOrThrow({ where: { id: submitted.mirror.id } });
  if (mirror.state !== "RESULT_READY") throw new Error(`Mirror did not reach RESULT_READY (state=${mirror.state}).`);

  const imported = await importResultReadyOutput({
    organizationId: orgId,
    requestId: submitted.request.id,
    mirrorId: mirror.id,
    requestedByUserId: userId,
    idempotencyKey: `import-local-docker-attach-${suffix}`,
    syntheticBuffer: makeTinyPng(),
  });
  assertNoSecretLeak(JSON.stringify(imported));
  return { submitted, mirror, imported };
}

async function streamToBuffer(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
}

async function main() {
  setApplicationStorageAdapterForTesting(createLocalTestApplicationStorage());
  const now = Date.now();

  const shopOrg = await prisma.organization.create({
    data: { name: `AI Attach Shop ${now}`, slug: `ai-attach-shop-${now}`, type: "SHOP", locale: "fa", timezone: "Asia/Tehran", isActive: true, isOpen: true },
  });
  const appointmentOrg = await prisma.organization.create({
    data: { name: `AI Attach Appointment ${now}`, slug: `ai-attach-appointment-${now}`, type: "APPOINTMENT", locale: "fa", timezone: "Asia/Tehran", isActive: true, isOpen: true },
  });
  const foreignOrg = await prisma.organization.create({
    data: { name: `AI Attach Foreign ${now}`, slug: `ai-attach-foreign-${now}`, type: "SHOP", locale: "fa", timezone: "Asia/Tehran", isActive: true, isOpen: true },
  });
  const user = await prisma.user.create({
    data: { email: `ai-attach-${now}@example.com`, name: "AI Attach Admin", role: "SUPER_ADMIN", password: "disabled-e2e-fixture", locale: "fa", theme: "system", isActive: true, isTeamMember: false, failedLoginAttempts: 0 },
  });
  await prisma.organizationMember.createMany({
    data: [
      { organizationId: shopOrg.id, organizationSlug: shopOrg.slug, userId: user.id, role: "ADMIN", isActive: true },
      { organizationId: appointmentOrg.id, organizationSlug: appointmentOrg.slug, userId: user.id, role: "ADMIN", isActive: true },
      { organizationId: foreignOrg.id, organizationSlug: foreignOrg.slug, userId: user.id, role: "ADMIN", isActive: true },
    ],
  });

  const productCategory = await prisma.productCategory.create({
    data: { name: "AI Attach Products", slug: `ai-products-${now}`, organizationId: shopOrg.id, organizationSlug: shopOrg.slug, isActive: true },
  });
  const product = await prisma.product.create({
    data: { name: "AI Attach Product", slug: `ai-attach-product-${now}`, basePrice: 1000, image: "https://example.com/manual-product.jpg", organizationId: shopOrg.id, organizationSlug: shopOrg.slug, categoryId: productCategory.id, isActive: true },
  });

  const serviceCategory = await prisma.serviceCategory.create({
    data: { name: "AI Attach Services", slug: `ai-services-${now}`, organizationId: appointmentOrg.id, isActive: true },
  });
  const appointmentService = await prisma.service.create({
    data: { name: "AI Attach Service", slug: `ai-attach-service-${now}`, price: 2000, duration: 30, image: "https://example.com/manual-service.jpg", organizationId: appointmentOrg.id, categoryId: serviceCategory.id, isActive: true },
  });

  const first = await importAsset(shopOrg.id, user.id, `${now}-one`);
  const second = await importAsset(shopOrg.id, user.id, `${now}-two`);
  const serviceAsset = await importAsset(appointmentOrg.id, user.id, `${now}-service`);

  const productAttach = await attachAiMediaAssetToProduct({ productId: product.id, aiMediaAssetId: first.imported.assetId, actorRole: "ADMIN" });
  assertNoSecretLeak(JSON.stringify(productAttach));
  if (productAttach.publicMediaUrl !== `/api/public/products/${product.id}/media`) throw new Error("Product public media URL mismatch.");

  await attachAiMediaAssetToProduct({ productId: product.id, aiMediaAssetId: first.imported.assetId, actorRole: "ADMIN" });
  await attachAiMediaAssetToProduct({ productId: product.id, aiMediaAssetId: second.imported.assetId, actorRole: "ADMIN" });
  const productAfterReplace = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
  if (productAfterReplace.aiPrimaryMediaAssetId !== second.imported.assetId) throw new Error("Product replacement did not persist.");

  const productMedia = await streamPublicProductAiMedia({ productId: product.id });
  if (!productMedia) throw new Error("Public product media did not resolve.");
  const productBytes = await streamToBuffer(productMedia.stream);
  if (!productBytes.slice(0, 8).equals(PNG_SIGNATURE)) throw new Error("Product media stream was not PNG.");

  const serviceAttach = await attachAiMediaAssetToService({ serviceId: appointmentService.id, aiMediaAssetId: serviceAsset.imported.assetId, actorRole: "MANAGER" });
  assertNoSecretLeak(JSON.stringify(serviceAttach));
  const serviceMedia = await streamPublicServiceAiMedia({ serviceId: appointmentService.id });
  if (!serviceMedia) throw new Error("Public service media did not resolve.");

  await detachAiMediaAssetFromService({ serviceId: appointmentService.id, actorRole: "MANAGER" });
  const serviceMediaAfterDetach = await streamPublicServiceAiMedia({ serviceId: appointmentService.id });
  if (serviceMediaAfterDetach) throw new Error("Detached service media still resolved.");

  let foreignRejected = false;
  try {
    const foreignProductCategory = await prisma.productCategory.create({
      data: { name: "Foreign Products", slug: `foreign-products-${now}`, organizationId: foreignOrg.id, organizationSlug: foreignOrg.slug, isActive: true },
    });
    const foreignProduct = await prisma.product.create({
      data: { name: "Foreign Product", slug: `foreign-product-${now}`, basePrice: 1000, organizationId: foreignOrg.id, organizationSlug: foreignOrg.slug, categoryId: foreignProductCategory.id, isActive: true },
    });
    await attachAiMediaAssetToProduct({ productId: foreignProduct.id, aiMediaAssetId: second.imported.assetId, actorRole: "ADMIN" });
  } catch {
    foreignRejected = true;
  }
  if (!foreignRejected) throw new Error("Foreign organization attachment should be rejected.");

  const output = {
    ok: true,
    gate: "LOCAL_DOCKER_MOCK_E2E",
    localJobsCreated: 3,
    localAssetsCreated: 3,
    productAttached: true,
    productReplacement: true,
    productPublicMedia: true,
    serviceAttached: true,
    serviceDetached: true,
    foreignTenantRejected: true,
    productionDbWrite: false,
    previewDbWrite: false,
    productionBlobWrite: false,
    realGeneration: false,
  };
  console.log(JSON.stringify(output, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
