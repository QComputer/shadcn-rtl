import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));

function read(relativePath) {
  const path = `${projectRoot}${relativePath.startsWith("/") ? "" : "/"}${relativePath}`;
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function report(name, ok) {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
  return ok;
}

const assetService = read("lib/services/ai-media-asset-service.ts");
const selectionService = read("lib/services/ai-media-asset-selection-service.ts");
const assetVisibility = read("lib/ai-media/asset-visibility.ts");
const storageGateway = read("lib/storage/application-storage.ts");
const localTestStorage = read("lib/storage/local-test-storage.ts");
const listRoute = read("app/api/dashboard/ai-media/assets/route.ts");
const detailRoute = read("app/api/dashboard/ai-media/assets/[id]/route.ts");
const contentRoute = read("app/api/dashboard/ai-media/assets/[id]/content/route.ts");
const dashboardPage = read("app/[locale]/dashboard/ai-media/assets/page.tsx");
const importService = read("lib/services/ai-media-result-import-service.ts");
const tests = read("tests/unit/ai-media-asset-consumption.test.ts");
const docs = read("docs/ai-media/AI_MEDIA_IMPORTED_ASSET_CONSUMPTION.md");
const handoff = `${read("docs/AI_HANDOFF_CURRENT_STATE.md")}\n${read("docs/AI_HANDOFF_NEXT_PROMPT.md")}\n${read("docs/AI_HANDOFF_VALIDATION.md")}`;
const packageJson = read("package.json");

const runtimeSource = `${assetService}\n${selectionService}\n${listRoute}\n${detailRoute}\n${contentRoute}`;

const checks = [
  ["asset service exists and is server-only", /import "server-only"/.test(assetService) && /export async function listAvailableAiMediaAssets/.test(assetService)],
  ["selection service exists and is server-only", /import "server-only"/.test(selectionService) && /export async function validateAiMediaAssetForSelection/.test(selectionService)],
  ["asset visibility rule is reusable and pure", /export function isAiMediaAssetUsable/.test(assetVisibility) && !/fetch\(|prisma\.|await /.test(assetVisibility)],
  ["asset service enforces imported-only rule", /IMPORTED/.test(assetService) && /isAiMediaAssetUsable/.test(assetService)],
  ["asset service scopes by organization", /organizationId/.test(assetService) && /deletedAt: null/.test(assetService)],
  ["asset service supports pagination with bounds", /MAX_PAGE_SIZE/.test(assetService) && /pageSize/.test(assetService)],
  ["asset service excludes provider URLs from projection", /providerUrl/.test(assetService) === false && /rawProviderPayload/.test(assetService) === false],
  ["asset service excludes storage credentials from projection", /BLOB_READ_WRITE_TOKEN/.test(assetService) === false && /rawStorageKey/.test(assetService) === false],
  ["asset service returns safe preview route", /previewUrl/.test(assetService) && /\/api\/dashboard\/ai-media\/assets\//.test(assetService)],
  ["asset service derives safe source type metadata", /sourceType/.test(assetService) && /deriveSourceType/.test(assetService)],
  ["list route is authenticated and org-scoped", /requireAuthSession/.test(listRoute) && /requireCurrentOrganizationId/.test(listRoute)],
  ["detail route is authenticated and org-scoped", /requireAuthSession/.test(detailRoute) && /requireCurrentOrganizationId/.test(detailRoute)],
  ["detail route returns safe projection only", /mimeType|width|height|byteSize/.test(assetService) && !/providerUrl|rawProviderPayload/.test(detailRoute)],
  ["content route enforces auth and org access", /requireAuthSession/.test(contentRoute) && /requireCurrentOrganizationId/.test(contentRoute)],
  ["content route enforces MIME allowlist", /ALLOWED_CONTENT_TYPES/.test(contentRoute) && /415/.test(contentRoute)],
  ["content route streams through storage gateway", /streamApplicationAssetContent/.test(contentRoute) || /streamAiMediaAssetContent/.test(contentRoute)],
  ["content route does not accept arbitrary storage keys from client", /storageKeyFingerprint/.test(contentRoute) && !/request\.body/.test(contentRoute)],
  ["content route sets safe headers", /Content-Disposition/.test(contentRoute) && /X-Content-Type-Options/.test(contentRoute) && /nosniff/.test(contentRoute)],
  ["storage gateway adds streamContent boundary", /streamApplicationAssetContent/.test(storageGateway)],
  ["local-test storage blocks Production", /Local test storage cannot run in production/.test(localTestStorage)],
  ["local-test storage implements streamContent", /streamContent/.test(localTestStorage)],
  ["vercel-blob adapter implements streamContent", /streamContent/.test(read("lib/storage/vercel-blob-storage.ts"))],
  ["no browser-to-Render call in asset routes", !/fetch\([^)]*AI_MEDIA_SERVICE|bazar-baz-ai-media-service/.test(runtimeSource)],
  ["no NEXT_PUBLIC secret in asset routes", !/NEXT_PUBLIC.*(BLOB|STORAGE|AI_MEDIA)|BLOB_READ_WRITE_TOKEN/.test(runtimeSource)],
  ["dashboard page is client component", /"use client"/.test(dashboardPage)],
  ["dashboard page has Persian empty state", /هنوز رسانه‌ای/.test(dashboardPage)],
  ["dashboard page uses safe preview route", /\/api\/dashboard\/ai-media\/assets\//.test(assetService) && /previewUrl/.test(dashboardPage)],
  ["selection service rejects non-imported asset", /ASSET_NOT_AVAILABLE/.test(selectionService)],
  ["selection service does not mutate Product or Service", !/prisma\.product|prisma\.service/.test(selectionService)],
  ["no wallet mutation in asset service", !/walletCreditProduced|settle|ledger/.test(assetService)],
  ["no real generation in asset service", !/realGeneration:\s*true|AI_MEDIA_REAL_GENERATION_ENABLED\s*=\s*["']true/.test(assetService)],
  ["feature guard exists and is server-only", /import "server-only"/.test(read("lib/ai-media/asset-consumption-feature-guard.ts")) && /getAiMediaAssetConsumptionFeatureState/.test(read("lib/ai-media/asset-consumption-feature-guard.ts"))],
  ["feature guard disables Production by default", /environment === "production"/.test(read("lib/ai-media/asset-consumption-feature-guard.ts")) && /enabled: false/.test(read("lib/ai-media/asset-consumption-feature-guard.ts"))],
  ["feature guard executes before Prisma in content route", (() => {
    const idxGuard = contentRoute.indexOf("assertAiMediaAssetConsumptionEnabled()");
    const idxQuery = contentRoute.indexOf("aiMediaAsset.findFirst");
    return idxGuard > 0 && idxQuery > 0 && idxGuard < idxQuery;
  })()],
  ["feature guard injected into asset service", /assertAiMediaAssetConsumptionEnabled/.test(assetService)],
  ["feature guard injected into selection service", /assertAiMediaAssetConsumptionEnabled/.test(selectionService)],
  ["feature guard injected into detail route", /assertAiMediaAssetConsumptionEnabled/.test(detailRoute)],
  ["no public feature flag used for guard", !/NEXT_PUBLIC_AI_MEDIA_ASSET_CONSUMPTION/.test(read("lib/ai-media/asset-consumption-feature-guard.ts"))],
  ["tests exist and cover key scenarios", /test:ai-media:asset-consumption/.test(packageJson) && /owning org can list/.test(tests) && /foreign org/.test(tests)],
  ["local Docker asset consumption E2E exists", /e2e:ai-media:local-docker-asset-consumption/.test(packageJson)],
  ["existing create/status gate remains present", /e2e:ai-media:local-docker-create-sync/.test(packageJson)],
  ["existing app-managed import gate remains present", /e2e:ai-media:local-docker-import/.test(packageJson)],
  ["docs updated", /imported asset consumption/i.test(docs) && /imported asset consumption/i.test(handoff)],
];

const failed = checks.filter(([name, ok]) => !report(name, ok));

if (failed.length > 0) {
  console.error(`AI media asset consumption validation failed with ${failed.length} issue(s).`);
  process.exitCode = 1;
} else {
  console.log("AI media asset consumption validation passed.");
}
