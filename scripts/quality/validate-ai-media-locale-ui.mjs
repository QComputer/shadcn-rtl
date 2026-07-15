#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const checks = [];
const add = (name, pass, detail = "") => checks.push({ name, pass: Boolean(pass), detail });
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

const page = read("app/[locale]/dashboard/creative-studio/page.tsx");
const layout = read("app/[locale]/layout.tsx");
const providerState = read("components/dashboard/ai-media-provider-state.tsx");

add("locale layout sets html lang and dir", /<html[^>]+lang=\{locale\}[^>]+dir=\{config\.dir\}/.test(layout));
add("Creative Studio page is localized for Persian English Arabic", /const copyByLocale/.test(page) && /fa: \{/.test(page) && /en: \{/.test(page) && /ar: \{/.test(page));
add("Persian is the fallback Creative Studio locale", /copyByLocale\[locale\] \?\? copyByLocale\.fa/.test(page));
add("Persian and Arabic use RTL-aware formatting", /locale === "fa" \|\| locale === "ar"/.test(page) && /toPersianDigits/.test(page));
add("provider state banner is locale-direction aware", /dir=\{locale === "fa" \|\| locale === "ar" \? "rtl" : "ltr"\}/.test(providerState));
add("product-image workflow includes queued processing completed failed canceled states", /QUEUED:/.test(page) && /PROCESSING:/.test(page) && /COMPLETED:/.test(page) && /FAILED:/.test(page) && /CANCELED:/.test(page));
add("product-image form prevents duplicate submit while loading", /disabled=\{[^}]*generationSubmitting/.test(page) || /generationSubmitting \|\|/.test(page));
const fetchTargets = Array.from(page.matchAll(/fetch\(([^,\n)]+)/g)).map((match) => match[1]);
add("Creative Studio browser only calls Bazar Baz API routes", fetchTargets.every((target) => /^["'`]\/api\//.test(target) || /^`\$?\{?`?$/.test(target)) && !/AI_MEDIA_SERVICE_URL|AI_MEDIA_SERVICE_INTERNAL_KEY|BLOB_READ_WRITE_TOKEN|@vercel\/blob/.test(page), fetchTargets.join(", "));
add("logo and cover execution remains fail-closed in UI copy", /brandGenerationDisabled/.test(page) && /Logo and cover provider execution is still disabled/.test(page) && /تولید لوگو/.test(page) && /تولید کاور/.test(page));
add("mock/test provider state is visible to sellers", /mock: \{/.test(providerState) && /MOCK/.test(page));

for (const check of checks) console.log(`${check.pass ? "PASS" : "FAIL"} ${check.name}${check.detail ? ` (${check.detail})` : ""}`);
const failed = checks.filter((check) => !check.pass);
if (failed.length) {
  console.error(`AI media locale UI validation failed with ${failed.length} issue(s).`);
  process.exit(1);
}

console.log("AI media locale UI validation passed.");
