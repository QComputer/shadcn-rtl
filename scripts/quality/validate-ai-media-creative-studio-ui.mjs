import fs from "node:fs";

const checks = [];
const read = (path) => fs.readFileSync(path, "utf8");
const add = (name, pass) => checks.push({ name, pass: Boolean(pass) });

const page = read("app/[locale]/dashboard/creative-studio/page.tsx");
const readiness = read("lib/services/creative-studio-generation-readiness.ts");
const decision = read("docs/ai-media/ORGANIZATION_BRAND_CAPABILITY_DECISION.md");
const packageJson = read("package.json");

add("product-image UI remains capability-gated", /generationReady/.test(page) && /generationRequestEnabled/.test(page) && /generationUiEnabled/.test(page));
add("product-image UI sends no Render URL or secrets", !/AI_MEDIA_SERVICE_INTERNAL_KEY|X-BazarBaz-AI-Key|bazar-baz-ai-media-service/.test(page));
add("product-image UI has loading processing failure cancel states", /generationSubmitting/.test(page) && /generationInProgress/.test(page) && /generationFailed/.test(page) && /cancelGenerationJob/.test(page));
add("product-image UI sends idempotency key", /idempotency_key/.test(page) && /generationIdempotencyKeyRef/.test(page));
add("logo and cover readiness is unavailable from live contract", /unavailable-live-contract/.test(readiness) && /generationRequestEnabled: false/.test(readiness));
add("brand decision document exists", /Decision: keep organization logo and cover Render execution unavailable/.test(decision));
add("Persian English Arabic copy remains present", /ساخت تصویر محصول/.test(page) && /Product image generation/.test(page) && /توليد صورة المنتج/.test(page));
add("package exposes Creative Studio UI validator", /quality:ai-media-creative-studio-ui/.test(packageJson));

for (const check of checks) console.log(`${check.pass ? "PASS" : "FAIL"} ${check.name}`);
const failed = checks.filter((check) => !check.pass);
if (failed.length) {
  console.error(`\n${failed.length} AI media Creative Studio UI check(s) failed.`);
  process.exit(1);
}
