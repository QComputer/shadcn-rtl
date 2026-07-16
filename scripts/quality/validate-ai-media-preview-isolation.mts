import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { validateAiMediaPreviewIsolation, getAiMediaEnvironmentSummary } from "@/lib/ai-media/env-isolation";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));

function read(path: string): string {
  const resolved = path.startsWith("/") || /^[A-Za-z]:\\/.test(path)
    ? path
    : `${projectRoot}${path.startsWith("/") ? "" : "/"}${path}`;
  if (!existsSync(resolved)) return "";
  return readFileSync(resolved, "utf8");
}

function add(name: string, ok: boolean, detail = "") {
  const status = ok ? "OK" : "FAIL";
  const suffix = detail ? ` — ${detail}` : "";
  console.log(`${status} ${name}${suffix}`);
  return ok;
}

const envExample = read(".env.example");
const packageJson = read("package.json");
const docs = read("docs/ai-media/AI_MEDIA_PREVIEW_ISOLATION.md");

const fakeEnv: Record<string, string | undefined> = {
  NODE_ENV: "preview",
  VERCEL_ENV: "preview",
  DATABASE_URL: "postgresql://user:pass@127.0.0.1:5432/bazar_baz_preview",
  BLOB_READ_WRITE_TOKEN: "",
  AI_MEDIA_SERVICE_URL: "https://preview-ai-media-service.onrender.com",
  AI_MEDIA_SERVICE_INTERNAL_KEY: "preview-internal-key",
};

const productionEnv: Record<string, string | undefined> = {
  NODE_ENV: "production",
  VERCEL_ENV: "production",
  DATABASE_URL: "postgresql://user:pass@ep-little-river-aifwxtf7.c-4.us-east-1.aws.neon.tech/bazar_baz_prod",
  BLOB_READ_WRITE_TOKEN: "vercel_blob_prod_token",
  AI_MEDIA_SERVICE_URL: "https://bazar-baz-ai-media-service.onrender.com",
  AI_MEDIA_SERVICE_INTERNAL_KEY: "prod-internal-key",
};

const previewWithProdSecrets: Record<string, string | undefined> = {
  ...fakeEnv,
  NEXT_PUBLIC_AI_MEDIA_SERVICE_INTERNAL_KEY: "leaked",
};

const previewWithProductionDb: Record<string, string | undefined> = {
  ...fakeEnv,
  DATABASE_URL: "postgresql://user:pass@ep-little-river-aifwxtf7.c-4.us-east-1.aws.neon.tech/bazar_baz_prod",
};

const previewWithProductionBlob: Record<string, string | undefined> = {
  ...fakeEnv,
  BLOB_READ_WRITE_TOKEN: "vercel_blob_prod_token",
};

const previewWithProductionAiUrl: Record<string, string | undefined> = {
  ...fakeEnv,
  AI_MEDIA_SERVICE_URL: "https://bazar-baz-ai-media-service.onrender.com",
};

let passed = 0;
let failed = 0;

function check(name: string, ok: boolean) {
  if (ok) passed += 1;
  else failed += 1;
  add(name, ok);
}

const summary = validateAiMediaPreviewIsolation(fakeEnv);
check("preview env isolation returns ok for safe preview env", summary.ok === true);
check("preview env isolation classifies environment as preview", summary.environment === "preview");
check("preview env isolation has no blockers for safe preview env", summary.blockers.length === 0);
check("preview env safeSummary has no public secret", summary.safeSummary.hasPublicAiMediaSecret === false);
check("preview env safeSummary does not leak raw internal key", !summary.safeSummary.aiMediaServiceInternalKeyRedacted.includes("preview-internal-key"));
check("preview env safeSummary does not leak raw URL", !summary.safeSummary.aiMediaServiceUrlRedacted.includes("onrender.com"));

const publicSecretSummary = getAiMediaEnvironmentSummary(previewWithProdSecrets);
check("public NEXT_PUBLIC AI media secret is detected", publicSecretSummary.safeSummary.hasPublicAiMediaSecret === true);

const prodSummary = validateAiMediaPreviewIsolation(productionEnv);
check("production env does not fail on preview isolation rules", prodSummary.ok === true);

const previewProdDbSummary = validateAiMediaPreviewIsolation(previewWithProductionDb);
check("preview with production DB URL fails isolation", previewProdDbSummary.ok === false);
check("preview with production DB URL reports blocker", previewProdDbSummary.blockers.some((b) => /database/i.test(b)));
check("preview with production DB URL marks safeSummary match", previewProdDbSummary.safeSummary.previewAndProdDatabaseMatch === true);

const previewProdBlobSummary = validateAiMediaPreviewIsolation(previewWithProductionBlob);
check("preview with production Blob token fails isolation", previewProdBlobSummary.ok === false);
check("preview with production Blob token reports blocker", previewProdBlobSummary.blockers.some((b) => /blob|storage/i.test(b)));
check("preview with production Blob token marks safeSummary match", previewProdBlobSummary.safeSummary.previewAndProdStorageMatch === true);

const previewProdAiSummary = validateAiMediaPreviewIsolation(previewWithProductionAiUrl);
check("preview with production AI service URL fails isolation", previewProdAiSummary.ok === false);
check("preview with production AI service URL reports blocker", previewProdAiSummary.blockers.some((b) => /ai media service identity/i.test(b)));
check("preview with production AI service URL marks safeSummary match", previewProdAiSummary.safeSummary.previewAndProdAiServiceMatch === true);

const missingEnvSummary = getAiMediaEnvironmentSummary({});
check("missing env produces safe warnings not crash", missingEnvSummary.ok === true);
check("missing env classifies as unknown", missingEnvSummary.environment === "unknown");

const strictProdMix = validateAiMediaPreviewIsolation({ ...previewWithProductionAiUrl, NODE_ENV: "preview", VERCEL_ENV: "preview" });
check("strict preview isolation fails closed on production identity mix", strictProdMix.ok === false);

check(".env.example has safe AI media placeholders", /^AI_MEDIA_SERVICE_INTERNAL_KEY=$/m.test(envExample));
check(".env.example has no NEXT_PUBLIC AI media secret", !/NEXT_PUBLIC.*AI_MEDIA_SERVICE_INTERNAL_KEY/m.test(envExample));
check(".env.example has no NEXT_PUBLIC Render secret", !/NEXT_PUBLIC.*RENDER/m.test(envExample));
check("docs mention preview isolation", /preview isolation/i.test(docs));
check("package.json exposes preview isolation scripts", /quality:ai-media-preview-isolation/.test(packageJson) && /test:ai-media:preview-isolation/.test(packageJson));

console.log(`\nresults: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exitCode = 1;
}
