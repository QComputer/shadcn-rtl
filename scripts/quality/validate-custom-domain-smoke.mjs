#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const checks = [];

function addCheck(name, ok, detail = "") {
  checks.push({ name, ok, detail });
}

function read(path) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function has(path) {
  return existsSync(resolve(process.cwd(), path));
}

const smokePath = "scripts/e2e/custom-domain-smoke.mjs";
const setupPath = "scripts/setup-register-custom-domain-smoke-package-scripts.mjs";
const docsPath = "docs/PHASE_66_CUSTOM_DOMAIN_SMOKE.md";
const overlayDocPath = "OVERLAY_PHASE66_CUSTOM_DOMAIN_SMOKE.md";
const packagePath = "package.json";

addCheck(`${smokePath} exists`, has(smokePath));
addCheck(`${setupPath} exists`, has(setupPath));
addCheck(`${docsPath} exists`, has(docsPath));
addCheck(`${overlayDocPath} exists`, has(overlayDocPath));
addCheck("package.json exists", has(packagePath));

if (has(smokePath)) {
  const smoke = read(smokePath);
  addCheck("smoke runner requires custom-domain base URL", smoke.includes("CUSTOM_DOMAIN_SMOKE_BASE_URL"));
  addCheck("smoke runner requires platform URL", smoke.includes("CUSTOM_DOMAIN_SMOKE_PLATFORM_URL"));
  addCheck("smoke runner requires shop slug", smoke.includes("CUSTOM_DOMAIN_SMOKE_SHOP_SLUG"));
  addCheck("smoke runner checks Persian-first default locale", smoke.includes("looksPersianFirst") && smoke.includes("Expected default locale"));
  addCheck("smoke runner checks explicit EN route", smoke.includes('testExplicitLocale(baseUrl, "en")'));
  addCheck("smoke runner checks explicit AR route", smoke.includes('testExplicitLocale(baseUrl, "ar")'));
  addCheck("smoke runner checks robots.txt", smoke.includes("/robots.txt") && smoke.includes("User-agent"));
  addCheck("smoke runner checks sitemap.xml", smoke.includes("/sitemap.xml") && smoke.includes("<urlset"));
  addCheck("smoke runner checks platform redirect", smoke.includes("testPlatformShopRedirect"));
  addCheck("smoke runner checks protected dashboard API", smoke.includes("/api/dashboard/shop-domains"));
  addCheck("smoke runner uses manual redirects for redirect assertions", smoke.includes('redirect: "manual"'));
}

if (has(setupPath)) {
  const setup = read(setupPath);
  addCheck("setup registers quality script", setup.includes("quality:custom-domain-smoke"));
  addCheck("setup registers e2e script", setup.includes("e2e:custom-domain-smoke"));
  addCheck("setup registers deployed e2e alias", setup.includes("e2e:deployed:custom-domain-smoke"));
}

if (has(packagePath)) {
  const packageJson = JSON.parse(read(packagePath));
  const scripts = packageJson.scripts || {};
  addCheck("package has quality:custom-domain-smoke script", scripts["quality:custom-domain-smoke"] === "node scripts/quality/validate-custom-domain-smoke.mjs");
  addCheck("package has e2e:custom-domain-smoke script", scripts["e2e:custom-domain-smoke"] === "node scripts/e2e/custom-domain-smoke.mjs");
  addCheck("package has e2e:deployed:custom-domain-smoke script", scripts["e2e:deployed:custom-domain-smoke"] === "node scripts/e2e/custom-domain-smoke.mjs");
}

if (has(docsPath)) {
  const docs = read(docsPath);
  addCheck("docs include smoke env vars", docs.includes("CUSTOM_DOMAIN_SMOKE_BASE_URL") && docs.includes("CUSTOM_DOMAIN_SMOKE_SHOP_SLUG"));
  addCheck("docs include khalae/ahmad example", docs.includes("khalae.ir") && docs.includes("ahmad"));
}

const failed = checks.filter((check) => !check.ok);

if (failed.length) {
  console.error("Custom-domain smoke validation failed:");
  for (const check of failed) {
    console.error(`- ${check.name}${check.detail ? `: ${check.detail}` : ""}`);
  }
  process.exit(1);
}

console.log("Custom-domain smoke validation passed.");
