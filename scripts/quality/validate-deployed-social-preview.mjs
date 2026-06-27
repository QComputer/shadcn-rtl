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

function expectIncludes(rel, needle, label) {
  if (!exists(rel)) {
    add(label, false, `${rel} is missing`);
    return;
  }
  add(label, read(rel).includes(needle), needle);
}

for (const rel of [
  "scripts/e2e/deployed-social-preview.mjs",
  "scripts/quality/validate-deployed-social-preview.mjs",
  "docs/PHASE_57_DEPLOYED_SOCIAL_PREVIEW_VERIFICATION.md",
  "docs/PHASE_57_OVERLAY_MANIFEST.md",
  "public/fonts/Vazirmatn-Regular.ttf",
  "public/fonts/Vazirmatn-Bold.ttf",
  "public/fonts/Vazirmatn-Black.ttf",
]) {
  expectFile(rel);
}

expectIncludes("scripts/e2e/deployed-social-preview.mjs", "sitemap.xml", "deployed social preview script reads sitemap");
expectIncludes("scripts/e2e/deployed-social-preview.mjs", "extractOgImage", "deployed social preview script extracts og:image");
expectIncludes("scripts/e2e/deployed-social-preview.mjs", "isGeneratedOgImage", "deployed social preview script identifies generated OG images");
expectIncludes("scripts/e2e/deployed-social-preview.mjs", "content-type", "deployed social preview script checks image content type");
expectIncludes("scripts/e2e/deployed-social-preview.mjs", "fs.writeFileSync(file, bytes)", "deployed social preview script captures image bytes");
expectIncludes("scripts/e2e/deployed-social-preview.mjs", "manifest.json", "deployed social preview script writes capture manifest");
expectIncludes("scripts/e2e/deployed-social-preview.mjs", "DEPLOYED_SOCIAL_PREVIEW_ALLOW_EMPTY", "deployed social preview script has explicit allow-empty mode");
expectIncludes("scripts/e2e/deployed-social-preview.mjs", "DEPLOYED_SOCIAL_PREVIEW_REQUIRE_CATEGORY", "deployed social preview script can enforce category samples");
expectIncludes("scripts/e2e/deployed-social-preview.mjs", "DEPLOYED_SOCIAL_PREVIEW_SCAN_LIMIT_PER_KIND", "deployed social preview script scans beyond first stale candidates");
expectIncludes("scripts/e2e/deployed-social-preview.mjs", "stale sitemap candidate skipped", "deployed social preview script skips stale sitemap candidates");
expectIncludes("scripts/e2e/deployed-social-preview.mjs", "has reachable social preview sample", "deployed social preview script requires reachable samples");
expectIncludes("scripts/e2e/deployed-social-preview.mjs", "generated-og-card", "deployed social preview script captures generated card directly");
expectIncludes("scripts/e2e/deployed-social-preview.mjs", "locale=fa", "deployed social preview generated card defaults to Persian");
expectIncludes("scripts/e2e/deployed-social-preview.mjs", "%D9%BE%DB%8C%D8%B4", "deployed social preview generated card uses Persian title text");
expectIncludes("scripts/e2e/deployed-social-preview.mjs", "uploaded-image social preview candidate", "deployed social preview script requires uploaded-image candidate");
expectIncludes("scripts/e2e/deployed-social-preview.mjs", "entry.capture && entry.ogImage && !isGeneratedOgImage(entry.ogImage)", "deployed social preview script requires captured uploaded-image candidate");
expectIncludes("scripts/e2e/deployed-social-preview.mjs", "shop organization", "deployed social preview script samples shop organization pages");
expectIncludes("scripts/e2e/deployed-social-preview.mjs", "appointment organization", "deployed social preview script samples appointment organization pages");
expectIncludes("scripts/e2e/deployed-social-preview.mjs", "product detail", "deployed social preview script samples product detail pages");
expectIncludes("scripts/e2e/deployed-social-preview.mjs", "service detail", "deployed social preview script samples service detail pages");
expectIncludes("app/og-image/route.tsx", "Vazirmatn", "generated OG route uses Persian-capable font");
expectIncludes("app/og-image/route.tsx", "public/fonts/Vazirmatn-Regular.ttf", "generated OG route loads regular Persian font");
expectIncludes("app/og-image/route.tsx", "direction: isRtl", "generated OG route renders RTL locales with RTL direction");
expectIncludes("app/og-image/route.tsx", "fonts: await loadFonts()", "generated OG route passes bundled fonts to ImageResponse");

const packageJson = JSON.parse(read("package.json"));
add(
  "package.json exposes e2e:deployed:social-preview",
  packageJson.scripts?.["e2e:deployed:social-preview"] === "node scripts/e2e/deployed-social-preview.mjs",
);
add(
  "package.json exposes smoke:deployed:social-preview",
  packageJson.scripts?.["smoke:deployed:social-preview"] === "node scripts/e2e/deployed-social-preview.mjs",
);
add(
  "package.json exposes quality:deployed-social-preview",
  packageJson.scripts?.["quality:deployed-social-preview"] === "node scripts/quality/validate-deployed-social-preview.mjs",
);

console.table(results);
const failed = results.filter((result) => !result.ok);
if (failed.length) {
  console.error(`P57 deployed social preview validation failed with ${failed.length} issue(s).`);
  process.exit(1);
}

console.log("P57 deployed social preview validation passed.");
