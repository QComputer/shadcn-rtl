import fs from "node:fs";

const checks = [];
const read = (path) => fs.readFileSync(path, "utf8");
const add = (name, pass) => checks.push({ name, pass: Boolean(pass) });

const registry = read("lib/services/ai-media-capability-registry.ts");
const route = read("app/api/dashboard/ai-media/contract/route.ts");
const readiness = read("lib/services/creative-studio-generation-readiness.ts");
const provider = read("lib/services/creative-studio-organization-brand-provider.ts");
const matrix = read("docs/ai-media/RENDER_CAPABILITY_COMPATIBILITY_MATRIX.md");
const packageJson = read("package.json");

add("registry is server-only", /import "server-only"/.test(registry));
add("product image is available from confirmed endpoint", /capability: "PRODUCT_IMAGE"[\s\S]*status: "AVAILABLE"/.test(registry) && /\/v1\/product-image-suggestions\/jobs/.test(registry));
add("organization logo and cover are unavailable", /ORGANIZATION_LOGO_RECORD[\s\S]*status: "UNAVAILABLE"/.test(registry) && /ORGANIZATION_COVER_RECORD[\s\S]*ORGANIZATION_LOGO_RECORD/.test(registry));
add("general creative remains unknown", /capability: "GENERAL_CREATIVE"[\s\S]*status: "UNKNOWN"/.test(registry));
add("fingerprint is recorded", /AI_MEDIA_CONTRACT_FINGERPRINT/.test(registry) && /ab70c8d0bb1d9ccd/.test(matrix));
add("protected diagnostics include capability summary", /getAiMediaCapabilitySummary/.test(route) && /capabilities/.test(route));
add("readiness exposes capabilities", /capabilities: ReturnType/.test(readiness) && /getAiMediaCapabilitySummary/.test(readiness));
add("organization brand provider fails closed on live contract", /live-contract-unsupported/.test(provider) && /liveContractSupportsBrand/.test(provider));
add("matrix classifies logo and cover unsupported", /Organization logo \| UNSUPPORTED/.test(matrix) && /Organization cover\/banner \| UNSUPPORTED/.test(matrix));
add("package exposes capability registry validator", /quality:ai-media-capability-registry/.test(packageJson));

for (const check of checks) console.log(`${check.pass ? "PASS" : "FAIL"} ${check.name}`);
const failed = checks.filter((check) => !check.pass);
if (failed.length) {
  console.error(`\n${failed.length} AI media capability registry check(s) failed.`);
  process.exit(1);
}
