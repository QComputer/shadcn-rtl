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

function json(rel) {
  return JSON.parse(read(rel));
}

const publicImagePath = "components/public/public-image.tsx";
add("public image fallback component exists", exists(publicImagePath));
if (exists(publicImagePath)) {
  const publicImage = read(publicImagePath);
  add("public image fallback handles broken images", /onError=\{\(\) => setFailed\(true\)\}/.test(publicImage));
  add("public image fallback exposes accessible fallback", /role=\{decorative \? undefined : "img"\}/.test(publicImage));
}

const publicSurfaces = [
  "app/[locale]/page.tsx",
  "components/home/home-hero.tsx",
  "app/[locale]/[slug]/appointment/page.tsx",
  "app/[locale]/[slug]/shop/page.tsx",
];

for (const rel of publicSurfaces) {
  const source = read(rel);
  add(`${rel} uses PublicImage`, /PublicImage/.test(source));
  add(`${rel} has no raw img tags`, !/<img\b/.test(source));
}

const orgLayout = read("app/[locale]/[slug]/appointment/layout.tsx");
add("appointment public layout has visible nav", /const navItems = \[/.test(orgLayout) && /navigation\.profile/.test(orgLayout) && (/organizations\/\$\{organization\?\.slug/.test(orgLayout) || /baseOrganizationPath/.test(orgLayout)));
add("appointment public layout uses explicit safe select", /select:\s*{[\s\S]*id:\s*true[\s\S]*name:\s*true[\s\S]*slug:\s*true/.test(orgLayout));

const shopLayout = read("app/[locale]/[slug]/shop/layout.tsx");
add("shop public layout has visible nav", /const navItems = \[/.test(shopLayout) && /navigation\.products/.test(shopLayout) && /navigation\.checkout/.test(shopLayout));
add("shop public layout remains active/deleted filtered", /isActive:\s*true/.test(shopLayout) && /deletedAt:\s*null/.test(shopLayout));

for (const locale of ["fa", "en", "ar"]) {
  const dict = json(`dictionaries/${locale}.json`);
  add(`${locale} navigation.checkout exists`, typeof dict.navigation?.checkout === "string" && dict.navigation.checkout.length > 0);
  add(`${locale} organization.bookNow exists`, typeof dict.organization?.bookNow === "string" && dict.organization.bookNow.length > 0);
}

add("P29 documentation exists", exists("docs/PHASE_29_PUBLIC_EXPERIENCE_COMPLETION.md"));

console.table(results);
const failed = results.filter((result) => !result.ok);
if (failed.length) {
  console.error(`Public experience validation failed with ${failed.length} issue(s).`, failed);
  process.exit(1);
}

console.log("Public experience validation passed.");
