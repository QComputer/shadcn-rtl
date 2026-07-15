import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const checks = [];
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const exists = (rel) => fs.existsSync(path.join(root, rel));
const add = (name, pass) => checks.push({ name, pass: Boolean(pass) });

function collectSource(dir, out = []) {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) return out;
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dir, entry.name).replaceAll(path.sep, "/");
    if (entry.isDirectory()) collectSource(rel, out);
    else if (/\.(ts|tsx|js|mjs)$/.test(rel)) out.push(rel);
  }
  return out;
}

const client = read("lib/services/ai-media-service-client.ts");
const registry = read("lib/services/ai-media-capability-registry.ts");
const packageJson = read("package.json");
const runtimeFiles = collectSource("app").concat(collectSource("lib"))
  .filter((file) => file !== "lib/services/ai-media-capability-registry.ts");
const legacyPathFindings = runtimeFiles.filter((file) => /\/v1\/organization-brand\/jobs/.test(read(file)));
const clientImportFindings = collectSource("app/[locale]").filter((file) =>
  /ai-media-service-client|ai-media-capability-registry/.test(read(file)),
);

add("canonical client is server-only", /import "server-only"/.test(client));
add("client enforces HTTPS service URL", /AI media service URL must use HTTPS/.test(client) && /CONFIG_INSECURE_URL/.test(client));
add("client attaches credential only server-side", /"X-BazarBaz-AI-Key": config\.internalKey/.test(client) && !/NEXT_PUBLIC.*AI_MEDIA/.test(client));
add("client supports correlation and idempotency headers", /X-BazarBaz-Correlation-Id/.test(client) && /Idempotency-Key/.test(client));
add("client has timeout and bounded retry handling", /AbortController/.test(client) && /retrySafe/.test(client) && /parseRetryAfterMs/.test(client));
add("client redacts provider errors", /sanitizedErrorText/.test(client) && /\[redacted\]/.test(client));
add("client validates provider responses", /validateAiMediaCreateJobResponse/.test(client) && /validateAiMediaJob/.test(client));
add("client rejects unsafe output URLs", /assertAiMediaOutputUrl/.test(client) && /INVALID_OUTPUT_URL/.test(client));
add("historical organization-brand paths are absent from runtime callers", legacyPathFindings.length === 0);
add("absent historical paths are documented only in capability registry", /AI_MEDIA_ABSENT_LEGACY_RENDER_PATHS/.test(registry));
add("client components do not import server AI media boundaries", clientImportFindings.length === 0);
add("package exposes server boundary validator", /quality:ai-media-server-boundary/.test(packageJson));

for (const check of checks) console.log(`${check.pass ? "PASS" : "FAIL"} ${check.name}`);
const failed = checks.filter((check) => !check.pass);
if (failed.length) {
  console.error(`\n${failed.length} AI media server boundary check(s) failed.`);
  process.exit(1);
}
