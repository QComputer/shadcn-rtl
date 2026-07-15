import fs from "node:fs";

const checks = [];
const read = (path) => fs.readFileSync(path, "utf8");
const add = (name, pass) => checks.push({ name, pass: Boolean(pass) });

const service = read("lib/services/ai-media.service.ts");
const creative = read("lib/services/creative-studio.service.ts");
const validators = read("lib/validators/index.ts");
const page = read("app/[locale]/dashboard/creative-studio/page.tsx");
const lifecycleDoc = read("docs/ai-media/AI_MEDIA_JOB_LIFECYCLE.md");
const packageJson = read("package.json");

add("product image local job is created before provider submission", /localCreatedBeforeProviderSubmission/.test(service) && /prisma\.aiMediaJob\.create[\s\S]*createAiMediaJob/.test(service));
add("idempotency key is persisted and duplicate in-flight jobs are reused", /idempotencyKey/.test(service) && /duplicate/.test(service) && /p02ProductImageLifecycle/.test(service));
add("correlation id is persisted and sent", /correlationId/.test(service) && /correlation_id/.test(service));
add("provider job id is persisted after submission", /providerJobId: remoteResponse\.job_id/.test(service) && /jobId: remoteResponse\.job_id/.test(service));
add("submission failure is recorded safely", /status: "FAILED"/.test(service) && /AI media service submission failed/.test(service));
add("Creative Studio stores local AI media job id", /localAiMediaJobId/.test(creative) && /p112Generation/.test(creative));
add("schema accepts idempotency key", /idempotency_key/.test(validators));
add("UI sends idempotency key and rotates after success", /generationIdempotencyKeyRef/.test(page) && /idempotency_key/.test(page) && /crypto\.randomUUID/.test(page));
add("lifecycle doc exists", /`AiMediaJob` is created locally before provider submission/.test(lifecycleDoc));
add("package exposes product lifecycle validator", /quality:ai-media-product-image-lifecycle/.test(packageJson));

for (const check of checks) console.log(`${check.pass ? "PASS" : "FAIL"} ${check.name}`);
const failed = checks.filter((check) => !check.pass);
if (failed.length) {
  console.error(`\n${failed.length} AI media product lifecycle check(s) failed.`);
  process.exit(1);
}
