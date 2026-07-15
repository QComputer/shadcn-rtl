#!/usr/bin/env node
const checks = [];
const add = (name, pass, detail = "") => checks.push({ name, pass: Boolean(pass), detail });

function classifyDatabase(value) {
  if (!value) return "MISSING";
  const lower = value.toLowerCase();
  if (lower.includes("neon.tech") || lower.includes("neon")) return "PRODUCTION_LIKE";
  if (lower.includes("localhost") || lower.includes("127.0.0.1")) return "LOCAL";
  return "UNKNOWN";
}

const database = classifyDatabase(process.env.DATABASE_URL || "");
const direct = classifyDatabase(process.env.DIRECT_URL || "");
const storage = process.env.AI_MEDIA_APPLICATION_STORAGE_ADAPTER || process.env.APPLICATION_STORAGE_ADAPTER || "";
const providerUrl = process.env.AI_MEDIA_SERVICE_URL || process.env.AI_MEDIA_SERVICE_BASE_URL || "";

add("database is local", database === "LOCAL", database);
add("direct database is local or absent", direct === "LOCAL" || direct === "MISSING", direct);
add("local storage adapter selected", storage === "local-test", storage || "MISSING");
add("Blob token is not selected for hermetic storage", !process.env.BLOB_READ_WRITE_TOKEN || storage === "local-test");
add("live Render write URL is not selected", !providerUrl || providerUrl.startsWith("http://127.0.0.1") || providerUrl.startsWith("http://localhost"));
add("real generation is disabled", process.env.AI_MEDIA_PAID_PROVIDER_ENABLED !== "true" && process.env.AI_MEDIA_REAL_GENERATION_ENABLED !== "true");
add("external effects disabled", process.env.SMS_DRY_RUN !== "false" && process.env.EMAIL_DRY_RUN !== "false" && process.env.WEB_PUSH_REAL_SEND_ENABLED !== "true" && process.env.DOMAIN_PROVIDER_MUTATION_ENABLED !== "true");
add("tenant provisioning execution disabled", process.env.TENANT_PROVISIONING_EXECUTION_ENABLED !== "true");
add("not running as Vercel production", process.env.VERCEL_ENV !== "production");

for (const check of checks) console.log(`${check.pass ? "PASS" : "FAIL"} ${check.name}${check.detail ? ` (${check.detail})` : ""}`);
const failed = checks.filter((check) => !check.pass);
if (failed.length) {
  console.error(`Hermetic AI media environment guard failed with ${failed.length} issue(s).`);
  process.exit(1);
}
console.log("Hermetic AI media environment guard passed.");
