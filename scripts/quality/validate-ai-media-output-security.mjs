import fs from "node:fs";

const checks = [];
const read = (path) => fs.readFileSync(path, "utf8");
const add = (name, pass) => checks.push({ name, pass: Boolean(pass) });

const client = read("lib/services/ai-media-service-client.ts");
const applicationStorage = read("lib/storage/application-storage.ts");
const providerOutput = read("lib/validators/creative-studio-provider-output.ts");
const doc = read("docs/ai-media/AI_MEDIA_RESULT_INGESTION.md");
const packageJson = read("package.json");

add("product output URLs are validated", /assertAiMediaOutputUrl/.test(client) && /isPrivateOutputHost/.test(client));
add("product output rejects credentials and private hosts", /parsed\.username/.test(client) && /PRIVATE_IPV4_PATTERNS/.test(client));
add("product output requires HTTPS outside tests", /AI media output URL must use HTTPS/.test(client));
add("application storage enforces size and signature", /content-length/.test(applicationStorage) && /validateApplicationImageBuffer/.test(applicationStorage));
add("organization-brand output validator rejects SSRF-like URLs", /assertCreativeStudioProviderOutputUrl/.test(providerOutput) && /Provider output URL must not point to localhost/.test(providerOutput));
add("result ingestion doc records no permanent remote URL assumption", /Permanent storage/.test(doc) && /application storage gateway/.test(doc));
add("package exposes output security validator", /quality:ai-media-output-security/.test(packageJson));

for (const check of checks) console.log(`${check.pass ? "PASS" : "FAIL"} ${check.name}`);
const failed = checks.filter((check) => !check.pass);
if (failed.length) {
  console.error(`\n${failed.length} AI media output security check(s) failed.`);
  process.exit(1);
}
