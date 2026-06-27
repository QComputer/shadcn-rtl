import { readFileSync, existsSync } from "node:fs";

const checks = [];
function check(condition, message) {
  if (!condition) throw new Error(message);
  checks.push(message);
}
function read(path) {
  check(existsSync(path), `Missing ${path}`);
  return readFileSync(path, "utf8");
}

const routing = read("lib/custom-domain-routing.ts");
check(routing.includes("parseShopPlatformPath"), "custom-domain routing parses platform shop paths");
check(routing.includes("isSeoIndexableShopSubPath"), "custom-domain routing limits SEO redirects to indexable shop paths");
check(routing.includes('pathname === "/robots.txt" || pathname === "/sitemap.xml"'), "custom-domain routing lets robots/sitemap pass through tenant handling");

const proxy = read("proxy.ts");
check(proxy.includes("resolvePrimaryDomainForShop"), "proxy resolves active primary custom domain for shop redirects");
check(proxy.includes("/api/internal/shop-primary-domain"), "proxy uses internal primary-domain resolver");
check(proxy.includes("/api/public/custom-domain/sitemap"), "proxy rewrites custom-domain sitemap.xml to tenant sitemap route");
check(proxy.includes("/api/public/custom-domain/robots"), "proxy rewrites custom-domain robots.txt to tenant robots route");
check(proxy.includes("isSeoIndexableShopSubPath(platformShopPath.subPath)"), "proxy redirects only indexable platform storefront paths");
check(proxy.includes('"/robots.txt"') && proxy.includes('"/sitemap.xml"'), "proxy matcher includes robots.txt and sitemap.xml");

const seo = read("lib/custom-domain-seo.ts");
check(seo.includes("getPrimaryShopDomainBaseUrl"), "shop SEO context can fall back to active primary custom domain");
check(seo.includes("baseUrl: primaryDomainBaseUrl"), "shop metadata can emit custom-domain canonical base URL");
check(seo.includes("buildTenantPublicPath(locale, subPath)"), "shop metadata uses tenant public paths for custom-domain canonicals");

const internalPrimary = read("app/api/internal/shop-primary-domain/route.ts");
check(internalPrimary.includes("CUSTOM_DOMAIN_RESOLVER_SECRET"), "primary-domain resolver is secret protected");
check(internalPrimary.includes('status: "ACTIVE"'), "primary-domain resolver only returns active domains");
check(internalPrimary.includes("isPrimary: true"), "primary-domain resolver only returns primary domains");

const tenantSitemap = read("app/api/public/custom-domain/sitemap/route.ts");
check(tenantSitemap.includes("application/xml"), "tenant sitemap returns XML");
check(tenantSitemap.includes("buildTenantPublicPath"), "tenant sitemap emits clean tenant paths");
check(tenantSitemap.includes("productCategories"), "tenant sitemap includes product categories");
check(tenantSitemap.includes("products"), "tenant sitemap includes products");

const tenantRobots = read("app/api/public/custom-domain/robots/route.ts");
check(tenantRobots.includes("Sitemap:"), "tenant robots points to tenant sitemap");
check(tenantRobots.includes("Disallow: /checkout"), "tenant robots disallows checkout paths");
check(tenantRobots.includes("Disallow: /order/"), "tenant robots disallows order paths");

const platformSitemap = read("app/sitemap.ts");
check(platformSitemap.includes("domains: { none: { status: \"ACTIVE\", isPrimary: true } }"), "platform sitemap excludes products/categories for shops with primary custom domains");
check(platformSitemap.includes("organization.domains.length === 0"), "platform sitemap excludes shop home/profile/fanpage for shops with primary custom domains");

const pkg = read("package.json");
check(pkg.includes('"quality:custom-domain-seo"'), "package.json registers quality:custom-domain-seo");

console.log("Custom-domain SEO hardening validation passed.");
