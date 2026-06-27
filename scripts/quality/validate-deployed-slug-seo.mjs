#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const results = [];

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function add(name, ok, detail = "") {
  results.push({ name, ok, detail });
}

function expectFile(rel) {
  add(`${rel} exists`, exists(rel), rel);
}

function expectIncludes(rel, needle, label = `${rel} includes ${needle}`) {
  if (!exists(rel)) {
    add(label, false, `${rel} is missing`);
    return;
  }
  add(label, read(rel).includes(needle), needle);
}

for (const rel of [
  "scripts/e2e/deployed-slug-seo.mjs",
  "docs/PHASE_53_DEPLOYED_SLUG_SEO_VERIFICATION.md",
  "docs/PHASE_53_OVERLAY_MANIFEST.md",
]) {
  expectFile(rel);
}

expectIncludes("scripts/e2e/deployed-slug-seo.mjs", "sitemap.xml", "deployed slug script checks sitemap");
expectIncludes("scripts/e2e/deployed-slug-seo.mjs", "robots.txt", "deployed slug script checks robots");
expectIncludes("scripts/e2e/deployed-slug-seo.mjs", "sitemap URLs use configured base URL", "deployed slug script checks sitemap host");
expectIncludes("scripts/e2e/deployed-slug-seo.mjs", "rel=[\"']canonical", "deployed slug script checks canonical links");
expectIncludes("scripts/e2e/deployed-slug-seo.mjs", "application\\/ld\\+json", "deployed slug script checks JSON-LD");
expectIncludes("scripts/e2e/deployed-slug-seo.mjs", "og:image", "deployed slug script checks social image metadata");
expectIncludes("scripts/e2e/deployed-slug-seo.mjs", "id URL redirects to slug URL", "deployed slug script checks detail redirects");
expectIncludes("scripts/e2e/deployed-slug-seo.mjs", "DEPLOYED_SLUG_SEO_ALLOW_EMPTY", "deployed slug script supports explicit empty-data override");
expectIncludes("lib/seo.ts", "LEGACY_PRODUCTION_HOSTS", "SEO helper guards against legacy production host");

const packageJson = JSON.parse(read("package.json"));
add(
  "package.json exposes e2e:deployed:slug-seo",
  packageJson.scripts?.["e2e:deployed:slug-seo"] === "node scripts/e2e/deployed-slug-seo.mjs",
);
add(
  "package.json exposes smoke:deployed:slug-seo",
  packageJson.scripts?.["smoke:deployed:slug-seo"] === "node scripts/e2e/deployed-slug-seo.mjs",
);
add(
  "package.json exposes quality:deployed-slug-seo",
  packageJson.scripts?.["quality:deployed-slug-seo"] === "node scripts/quality/validate-deployed-slug-seo.mjs",
);

console.table(results);
const failed = results.filter((result) => !result.ok);
if (failed.length) {
  console.error(`P53 deployed slug SEO validation failed with ${failed.length} issue(s).`);
  process.exit(1);
}

console.log("P53 deployed slug SEO validation passed.");
