#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const results = [];

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function add(name, ok, detail = "") {
  results.push({ name, ok, detail });
}

function includes(rel, needle, label = `${rel} includes ${needle}`) {
  add(label, exists(rel) && read(rel).includes(needle), needle);
}

for (const rel of [
  "lib/custom-domain-routing.ts",
  "lib/custom-domain-seo.ts",
  "app/api/internal/domain-resolver/route.ts",
  "app/api/organizations/[id]/domains/route.ts",
  "app/api/organizations/[id]/domains/[domainId]/route.ts",
  "app/[locale]/domain-not-configured/page.tsx",
  "prisma/migrations/20260627000300_shop_custom_domains/migration.sql",
  "docs/PHASE_59_SHOP_CUSTOM_DOMAINS.md",
]) {
  add(`${rel} exists`, exists(rel), rel);
}

includes("prisma/schema.prisma", "model OrganizationDomain", "OrganizationDomain model exists");
add(
  "Organization has domain relation",
  /domains\s+OrganizationDomain\[\]/.test(read("prisma/schema.prisma")),
  "domains OrganizationDomain[]",
);
includes("prisma/schema.prisma", "enum DomainStatus", "DomainStatus enum exists");
includes("proxy.ts", "resolveTenantForCustomDomain", "proxy resolves custom-domain tenant");
includes("proxy.ts", "buildShopPlatformPath", "proxy rewrites clean custom domain paths");
includes("proxy.ts", "getShopSubPathFromPlatformPath", "proxy redirects leaked /shop slug paths back to clean domain paths");
includes("app/api/internal/domain-resolver/route.ts", "CUSTOM_DOMAIN_RESOLVER_SECRET", "resolver uses internal secret");
includes("lib/domains/domain-resolver.server.ts", "organizationType: domain.organization.type", "resolver returns tenant organization type");
includes("proxy.ts", "tenant.capabilities.includes(\"SHOP\")", "proxy restricts shop rewrites to SHOP-capable tenants");
includes("app/[locale]/[slug]/shop/layout.tsx", "getShopTenantSeoContext", "shop layout uses custom-domain SEO context");
includes("app/[locale]/[slug]/shop/product/[productId]/layout.tsx", "getShopTenantSeoContext", "product detail uses custom-domain SEO context");
includes("app/[locale]/[slug]/shop/category/[categoryId]/page.tsx", "getShopTenantSeoContext", "category page uses custom-domain SEO context");
includes("app/[locale]/[slug]/shop/fanpage/page.tsx", "getShopTenantSeoContext", "fanpage uses custom-domain SEO context");
includes("lib/seo.ts", "baseUrl?: string | URL", "SEO helpers accept tenant base URL");
includes(".env.example", "CUSTOM_DOMAIN_RESOLVER_SECRET", "env template documents resolver secret");

const packageJson = JSON.parse(read("package.json"));
add(
  "package.json exposes quality:shop-custom-domains",
  packageJson.scripts?.["quality:shop-custom-domains"] === "node scripts/quality/validate-shop-custom-domains.mjs",
);

console.table(results);
const failed = results.filter((result) => !result.ok);
if (failed.length) {
  console.error(`Shop custom-domain validation failed with ${failed.length} issue(s).`);
  process.exit(1);
}

console.log("Shop custom-domain validation passed.");
