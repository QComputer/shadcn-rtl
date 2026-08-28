import { existsSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));

function read(relativePath: string) {
  const path = `${root}${relativePath.startsWith("/") ? "" : "/"}${relativePath}`;
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function report(name: string, ok: boolean) {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
  return ok;
}

const localeLayout = read("app/[locale]/layout.tsx");
const shopLayout = read("app/[locale]/[slug]/shop/layout.tsx");
const serviceLayout = read("app/[locale]/[slug]/appointment/layout.tsx");
const dashboardLayout = read("app/[locale]/dashboard/layout.tsx");
const proxy = read("proxy.ts");
const footerContext = read("lib/public-footer-context.ts");
const platformFooter = read("components/public/platform-footer.tsx");
const tenantFooter = read("components/public/tenant-footer.tsx");
const shopPaths = read("lib/shop-public-paths.ts");
const tests = read("tests/unit/public-footer-context.test.ts");
const e2e = read("scripts/e2e/public-footer-local-docker.mjs");
const docs = read("docs/public/CONTEXT_AWARE_PUBLIC_FOOTER.md");
const packageJson = JSON.parse(read("package.json") || "{}");
const allFooterCode = `${localeLayout}\n${shopLayout}\n${serviceLayout}\n${proxy}\n${footerContext}\n${platformFooter}\n${tenantFooter}`;

let changedFiles = "";
try {
  changedFiles = execSync("git diff --name-only --diff-filter=ACMRT", { cwd: root, encoding: "utf8" });
} catch {
  changedFiles = "";
}

const scripts = packageJson.scripts || {};
const checks: Array<[string, boolean]> = [
  ["platform footer component exists", /export function PlatformFooter/.test(platformFooter)],
  ["tenant footer component exists", /export function TenantFooter/.test(tenantFooter) && /TenantFooterViewModel/.test(tenantFooter)],
  ["locale layout reads explicit footer context", /x-bazar-public-footer-context/.test(localeLayout) && /showPlatformFooter/.test(localeLayout)],
  ["locale layout delegates platform footer", /<PlatformFooter/.test(localeLayout) && !/<footer className="bg-muted\/50 py-12 mt-12">/.test(localeLayout)],
  ["proxy sets custom-domain shop footer context", /tenant\.organizationType === "SHOP" \? "shop" : "service"/.test(proxy)],
  ["proxy sets footer context for normal requests", /getPublicFooterContextForPathname\(pathname\)/.test(proxy)],
  ["footer context maps shop routes", /firstSegment === "shop"/.test(footerContext)],
  ["footer context maps service routes", /firstSegment === "appointment"/.test(footerContext)],
  ["footer context suppresses app shells", /firstSegment === "dashboard"/.test(footerContext) && /firstSegment === "login"/.test(footerContext)],
  ["shop layout renders tenant footer", /<TenantFooter/.test(shopLayout) && /kind: "shop"/.test(shopLayout)],
  ["service layout renders tenant footer", /<TenantFooter/.test(serviceLayout) && /kind: "service"/.test(serviceLayout)],
  ["dashboard layout remains dashboard shell only", /DashboardShell/.test(dashboardLayout) && !/TenantFooter|PlatformFooter/.test(dashboardLayout)],
  ["shop footer uses public-safe projection", /select:\s*\{ id: true, name: true, slug: true, type: true, lat: true, lng: true, description: true, address: true, phone: true, email: true, logo: true, coverImage: true \}/.test(shopLayout)],
  ["service footer uses public-safe projection", /select:\s*\{[\s\S]*name: true[\s\S]*slug: true[\s\S]*description: true[\s\S]*address: true[\s\S]*phone: true[\s\S]*email: true[\s\S]*logo: true/.test(serviceLayout)],
  ["tenant footer omits optional empty values", /cleanOptional/.test(tenantFooter) && /address \?/.test(tenantFooter) && /phone && phoneHref/.test(tenantFooter) && /email && emailHref/.test(tenantFooter)],
  ["tenant footer normalizes phone and email links", /telHref/.test(tenantFooter) && /mailHref/.test(tenantFooter)],
  ["external attribution is safe", /rel="noopener noreferrer"/.test(platformFooter) && /Powered by Bazar Baz/.test(tenantFooter)],
  ["shop layout reuses shop public path helper", /buildShopPublicPath/.test(shopLayout) && /isCustomDomain: seoContext\.isCustomDomain/.test(shopLayout)],
  ["shop public path helper supports custom-domain root links", /isCustomDomain/.test(shopPaths) && /return locale === DEFAULT_LOCALE \? subPath/.test(shopPaths)],
  ["no client-only pathname hiding hack", !/usePathname|window\.location|document\.location/.test(allFooterCode)],
  ["no CSS-only footer suppression", !/display:\s*none|hidden.*footer|footer.*hidden/i.test(allFooterCode)],
  ["no hardcoded Cafe Chakmeh tenant", !/cafechakme|chakme|چکمه/i.test(allFooterCode)],
  ["no private member relation exposure", !/members:\s*\{|owner|password|hashedPassword/.test(allFooterCode)],
  ["unit tests exist", /describe\("context-aware public footer"/.test(tests)],
  ["unit tests cover platform/shop/service/none", /platform footer/.test(tests) && /shop footer/.test(tests) && /service/.test(tests) && /suppresses public footers/.test(tests)],
  ["unit tests cover path policy", /tenant-root relative/.test(tests) && /locale and slug scoped/.test(tests)],
  ["Docker E2E exists", /disposable PostgreSQL|public footer/i.test(e2e)],
  ["docs exist", /CONTEXT-AWARE PUBLIC FOOTER|footer contexts/i.test(docs)],
  ["package test script registered", scripts["test:public-footer:context"] === "npx tsx --require=./scripts/e2e/register-server-only.cjs --test tests/unit/public-footer-context.test.ts"],
  ["package quality script registered", scripts["quality:public-footer:context"] === "npx tsx --require=./scripts/e2e/register-server-only.cjs scripts/quality/validate-context-aware-public-footer.mts"],
  ["package Docker E2E script registered", scripts["e2e:public-footer:local-docker"] === "node scripts/e2e/public-footer-local-docker.mjs"],
  ["no Prisma migration added for footer", !changedFiles.split(/\r?\n/).some((file) => /^prisma\/migrations\//.test(file))],
  ["AI media guards remain referenced", /canReadAiMediaEntityAttachmentColumns/.test(read("app/api/public/organizations/[slug]/shop/route.ts"))],
];

const passed = checks.map(([name, ok]) => report(name, ok)).filter(Boolean).length;
const failed = checks.length - passed;

if (failed > 0) {
  console.error(`Context-aware public footer validation failed: ${failed} check(s) failed.`);
  process.exit(1);
}

console.log(`Context-aware public footer validation passed: ${passed}/${checks.length} checks.`);
