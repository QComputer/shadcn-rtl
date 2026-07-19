import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));

function read(relativePath: string) {
  const file = `${root}${relativePath.startsWith("/") ? "" : "/"}${relativePath}`;
  return existsSync(file) ? readFileSync(file, "utf8") : "";
}

function report(name: string, ok: boolean) {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
  return ok;
}

const schema = read("prisma/schema.prisma");
const migration = read("prisma/migrations/20260719010000_add_ai_media_entity_attachments/migration.sql");
const service = read("lib/services/ai-media-entity-attachment-service.ts");
const helper = read("lib/ai-media/entity-primary-media.ts");
const productRoute = read("app/api/dashboard/products/[productId]/ai-media-asset/route.ts");
const serviceRoute = read("app/api/dashboard/services/[serviceId]/ai-media-asset/route.ts");
const publicProductRoute = read("app/api/public/products/[productId]/media/route.ts");
const publicServiceRoute = read("app/api/public/services/[serviceId]/media/route.ts");
const publicProductDetailRoute = read("app/api/public/products/[id]/route.ts");
const publicShopRoute = read("app/api/public/organizations/[slug]/shop/route.ts");
const publicServicesRoute = read("app/api/public/organizations/[slug]/services/route.ts");
const publicServiceDetailRoute = read("app/api/public/organizations/[slug]/services/[serviceId]/route.ts");
const picker = read("components/ai-media/ai-media-asset-picker.tsx");
const productEdit = read("app/[locale]/dashboard/products/[id]/page.tsx");
const serviceEdit = read("app/[locale]/dashboard/services/[id]/page.tsx");
const productPublic = read("app/[locale]/shop/[slug]/page.tsx");
const productDetail = read("app/[locale]/shop/[slug]/product/[productId]/page.tsx");
const productCategoryPage = read("app/[locale]/shop/[slug]/category/[categoryId]/page.tsx");
const servicePublic = read("app/[locale]/appointment/[slug]/services/page.tsx");
const serviceDetail = read("app/[locale]/appointment/[slug]/services/[serviceId]/page.tsx");
const serviceCategoryPage = read("app/[locale]/appointment/[slug]/services/category/[categoryId]/page.tsx");
const unitTests = read("tests/unit/ai-media-product-service-attachment.test.ts");
const e2e = read("scripts/e2e/ai-media-local-docker-product-service-attachment.mjs");
const packageJson = read("package.json");
const docs = read("docs/ai-media/AI_MEDIA_PRODUCT_SERVICE_ATTACHMENT.md");

const routes = `${productRoute}\n${serviceRoute}\n${publicProductRoute}\n${publicServiceRoute}`;
const featureCode = `${service}\n${routes}\n${picker}\n${helper}`;

const checks: Array<[string, boolean]> = [
  ["schema adds nullable product attachment FK", /model Product[\s\S]*aiPrimaryMediaAssetId\s+String\?/.test(schema) && /ProductAiPrimaryMediaAsset/.test(schema)],
  ["schema adds nullable service attachment FK", /model Service[\s\S]*aiPrimaryMediaAssetId\s+String\?/.test(schema) && /ServiceAiPrimaryMediaAsset/.test(schema)],
  ["migration is forward-only nullable", /ADD COLUMN IF NOT EXISTS "aiPrimaryMediaAssetId" TEXT/.test(migration) && /ON DELETE SET NULL/.test(migration) && !/DROP TABLE|DROP COLUMN|DELETE FROM|UPDATE "AiMediaAsset"/i.test(migration)],
  ["attachment service is server-only", /import "server-only"/.test(service)],
  ["attachment service reuses imported asset validator", /validateAiMediaAssetForSelection/.test(service)],
  ["attachment service enforces product and service permissions", /product:update/.test(service) && /service:update/.test(service)],
  ["attachment service updates only entity attachment columns", /aiPrimaryMediaAssetId: asset\.id/.test(service) && /aiPrimaryMediaAssetId: null/.test(service)],
  ["attachment service does not delete assets on replacement", !/aiMediaAsset\.delete|removeCreativeStudioAsset|compensateFailedAssetImport/.test(service)],
  ["safe API accepts asset id only", /aiMediaAssetId/.test(productRoute) && /aiMediaAssetId/.test(serviceRoute)],
  ["dashboard routes are authenticated and entity-guarded", /requireAuthSession/.test(productRoute) && /requireProductAccess/.test(productRoute) && /requireServiceAccess/.test(serviceRoute)],
  ["routes do not accept provider URL or storage key", !/resultUrl|providerUrl|storageKey|BLOB_READ_WRITE_TOKEN|NEXT_PUBLIC/.test(routes)],
  ["public API attachment reads are feature-gated", [publicProductDetailRoute, publicShopRoute, publicServicesRoute, publicServiceDetailRoute].every((file) => /canReadAiMediaEntityAttachmentColumns/.test(file) && /includeAiMediaAttachment \? \{ aiPrimaryMediaAssetId: true \} : \{\}/.test(file))],
  ["public category attachment reads are feature-gated", [productCategoryPage, serviceCategoryPage].every((file) => /canReadAiMediaEntityAttachmentColumns/.test(file) && /includeAiMediaAttachment \? \{ aiPrimaryMediaAssetId: true \} : \{\}/.test(file))],
  ["public routes are entity-scoped", /streamPublicProductAiMedia/.test(publicProductRoute) && /streamPublicServiceAiMedia/.test(publicServiceRoute)],
  ["public stream derives active entity and organization server-side", /isActive: true/.test(service) && /organization/.test(service)],
  ["public stream sets nosniff", /X-Content-Type-Options/.test(publicProductRoute) && /X-Content-Type-Options/.test(publicServiceRoute)],
  ["public image helper exists", /getProductPrimaryMediaUrl/.test(helper) && /getServicePrimaryMediaUrl/.test(helper)],
  ["public product pages use AI attachment helper", /getProductPrimaryMediaUrl/.test(productPublic) && /getProductPrimaryMediaUrl/.test(productDetail)],
  ["public service pages use AI attachment helper", /getServicePrimaryMediaUrl/.test(servicePublic) && /getServicePrimaryMediaUrl/.test(serviceDetail)],
  ["dashboard product edit has picker", /AiMediaAssetPicker/.test(productEdit) && /\/api\/dashboard\/products\/\$/.test(productEdit)],
  ["dashboard service edit has picker", /AiMediaAssetPicker/.test(serviceEdit) && /\/api\/dashboard\/services\/\$/.test(serviceEdit)],
  ["dashboard attachment does not overwrite manual image field", !/setImage\(publicMediaUrl\)|image:\s*publicMediaUrl/.test(`${productEdit}\n${serviceEdit}`)],
  ["picker lists only safe dashboard assets", /\/api\/dashboard\/ai-media\/assets/.test(picker) && !/BLOB_READ_WRITE_TOKEN|NEXT_PUBLIC.*SECRET|storageKey/.test(picker)],
  ["Persian copy is primary in picker", /انتخاب رسانه AI/.test(picker) && /رسانه‌های آماده/.test(picker)],
  ["unit test script registered", /test:ai-media:product-service-attachment/.test(packageJson)],
  ["quality script registered", /quality:ai-media-product-service-attachment/.test(packageJson)],
  ["local Docker E2E script registered", /e2e:ai-media:local-docker-product-service-attachment/.test(packageJson)],
  ["unit tests cover product and service", /attaches an imported asset to a product/.test(unitTests) && /attaches and detaches a service asset/.test(unitTests)],
  ["unit tests cover tenant and permission denial", /another organization/.test(unitTests) && /insufficient product role/.test(unitTests)],
  ["E2E script exists", /LOCAL_DOCKER_MOCK_E2E/.test(e2e)],
  ["docs exist", /Product primary image/.test(docs) && /Service primary image/.test(docs)],
  ["feature code avoids direct Blob SDK", !/@vercel\/blob/.test(featureCode)],
  ["feature code avoids Render writes", !/AI_MEDIA_SERVICE_URL|bazar-baz-ai-media-service|\/v1\/product-images/.test(featureCode)],
  ["no browser secret exposure", !/NEXT_PUBLIC.*(RENDER|BLOB|TOKEN|SECRET|KEY)/.test(featureCode)],
  ["no wallet or generation mutation", !/wallet|ledger|real generation|REAL_GENERATION/.test(featureCode)],
  ["attachment public URL never embeds storage key", !/publicMediaUrl:[\s\S]*storageKey/.test(service)],
];

const failed = checks.filter(([name, ok]) => !report(name, ok));

if (failed.length > 0) {
  console.error(`AI media product/service attachment validation failed with ${failed.length} issue(s).`);
  process.exitCode = 1;
} else {
  console.log("AI media product/service attachment validation passed.");
}
