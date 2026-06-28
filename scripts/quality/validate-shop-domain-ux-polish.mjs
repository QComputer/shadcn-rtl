#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const checks = [];

function addCheck(name, ok) {
  checks.push({ name, ok });
}

function read(path) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function has(path) {
  return existsSync(resolve(process.cwd(), path));
}

const componentPath = "components/dashboard/shop-domain-manager.tsx";
const setupPath = "scripts/setup-register-shop-domain-ux-package-scripts.mjs";
const docsPath = "docs/PHASE_67_SHOP_DOMAIN_DASHBOARD_UX.md";
const overlayDocPath = "OVERLAY_PHASE67_SHOP_DOMAIN_DASHBOARD_UX.md";
const packagePath = "package.json";

addCheck(`${componentPath} exists`, has(componentPath));
addCheck(`${setupPath} exists`, has(setupPath));
addCheck(`${docsPath} exists`, has(docsPath));
addCheck(`${overlayDocPath} exists`, has(overlayDocPath));
addCheck("package.json exists", has(packagePath));

if (has(componentPath)) {
  const component = read(componentPath);
  addCheck("dashboard shows Vercel automation configured status", component.includes("automationConfigured") && component.includes("automationMissing"));
  addCheck("dashboard includes clickable storefront links", component.includes("getDomainUrl(domain.normalizedDomain)") && component.includes("target=\"_blank\""));
  addCheck("dashboard includes robots and sitemap quick links", component.includes("/robots.txt") && component.includes("/sitemap.xml"));
  addCheck("dashboard includes DNS record copy actions", component.includes("buildRecordText") && component.includes("navigator.clipboard.writeText"));
  addCheck("dashboard includes apex/www warning", component.includes("getMatchingApexWwwDomain") && component.includes("apexWwwWarning"));
  addCheck("dashboard includes localized status labels", component.includes("statusLabels") && component.includes("copy.statusLabels[domain.status]"));
  addCheck("dashboard includes remove-from-Vercel confirmation", component.includes("confirmRemoveVercel") && component.includes("window.confirm"));
  addCheck("dashboard includes delete confirmation", component.includes("confirmDelete") && component.includes("deleteDomain"));
  addCheck("dashboard includes smoke command block", component.includes("CUSTOM_DOMAIN_SMOKE_BASE_URL") && component.includes("e2e:custom-domain-smoke"));
  addCheck("dashboard avoids shadcn asChild", !component.includes("asChild"));
}

if (has(setupPath)) {
  const setup = read(setupPath);
  addCheck("setup registers quality:shop-domain-ux", setup.includes("quality:shop-domain-ux"));
}

if (has(packagePath)) {
  const packageJson = JSON.parse(read(packagePath));
  const scripts = packageJson.scripts || {};
  addCheck(
    "package has quality:shop-domain-ux script when registered",
    !scripts["quality:shop-domain-ux"] || scripts["quality:shop-domain-ux"] === "node scripts/quality/validate-shop-domain-ux-polish.mjs",
  );
}

if (has(docsPath)) {
  const docs = read(docsPath);
  addCheck("docs mention quick links", docs.includes("robots.txt") && docs.includes("sitemap.xml"));
  addCheck("docs mention apex/www warning", docs.includes("apex") && docs.includes("www"));
  addCheck("docs mention smoke command", docs.includes("e2e:custom-domain-smoke"));
}

const failed = checks.filter((check) => !check.ok);

if (failed.length) {
  console.error("Shop-domain dashboard UX validation failed:");
  for (const check of failed) console.error(`- ${check.name}`);
  process.exit(1);
}

console.log("Shop-domain dashboard UX validation passed.");
