import { existsSync, readFileSync } from "node:fs";

const checks = [];
function check(condition, message) {
  if (!condition) throw new Error(message);
  checks.push(message);
}
function read(path) {
  check(existsSync(path), `Missing ${path}`);
  return readFileSync(path, "utf8");
}

const proxy = read("proxy.ts");

check(
  proxy.includes("Tenant custom domains must be Persian-first"),
  "proxy documents Persian-first custom-domain locale policy",
);
check(
  proxy.includes("const tenantPathLocale = splitLocalePrefix(pathname).locale;") &&
    proxy.includes("const localeForTenant = tenantPathLocale || defaultLocale;"),
  "proxy uses explicit custom-domain locale prefix or defaultLocale for tenant robots/sitemap",
);
check(
  proxy.includes("const locale = splitPath.locale || defaultLocale;"),
  "proxy uses explicit custom-domain locale prefix or defaultLocale for storefront rewrites",
);
check(
  proxy.includes("notConfiguredUrl.pathname = `/${defaultLocale}/domain-not-configured`;"),
  "unconfigured custom domains default to Persian not-configured page",
);
check(
  proxy.includes('response.cookies.set("locale", locale'),
  "custom-domain rewrites set the locale cookie to the resolved tenant locale",
);
check(
  !proxy.includes("const locale = splitPath.locale || getLocale(request) || shop.locale;"),
  "custom-domain storefront rewrite no longer derives default locale from Accept-Language or organization locale",
);
check(
  !proxy.includes("const localeForTenant = getLocale(request) || shop.locale;"),
  "custom-domain robots/sitemap no longer derive default locale from Accept-Language or organization locale",
);

const setup = read("scripts/setup-register-custom-domain-default-locale-package-scripts.mjs");
check(
  setup.includes('"quality:custom-domain-default-locale"'),
  "setup script registers quality:custom-domain-default-locale",
);

console.log("Custom-domain default locale validation passed.");
