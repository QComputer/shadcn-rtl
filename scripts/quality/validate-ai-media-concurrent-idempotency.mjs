#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const checks = [];
const add = (name, pass, detail = "") => checks.push({ name, pass: Boolean(pass), detail });
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

const service = read("lib/services/ai-media.service.ts");
const mock = read("scripts/ai-media/local-contract-mock.mjs");
const concurrency = read("scripts/e2e/ai-media-hermetic-concurrency.mts");
const acceptance = read("scripts/e2e/ai-media-hermetic-acceptance.mjs");

add("AI-media create path uses advisory lock", /pg_advisory_xact_lock/.test(service) && /ai-media-product-image/.test(service));
add("idempotency payload conflict is detected", /payloadHash/.test(service) && /409/.test(service) && /different request payload/.test(service));
add("provider idempotency is tenant scoped", /providerIdempotencyKey/.test(service) && /organizationId/.test(service));
add("image selection ingestion is locked and idempotent", /ai-media-image-selection/.test(service) && /recentSelections/.test(service) && /storageStatus: "application-storage"/.test(service));
add("mock exposes local-only stats and fail-after-accept controls", /\/test\/stats/.test(mock) && /\/test\/fail-after-accept-once/.test(mock) && /failAfterAcceptOnce/.test(mock));
add("concurrency script checks 10-way duplicate submit", /length: 10/.test(concurrency) && /sameTenantDuplicate10/.test(concurrency));
add("concurrency script checks conflict cross-tenant lost-response and ingestion", /payloadConflict/.test(concurrency) && /crossTenantSameKey/.test(concurrency) && /providerAcceptedResponseLost/.test(concurrency) && /concurrentIngestion/.test(concurrency));
add("hermetic acceptance invokes concurrency script", /ai-media-hermetic-concurrency\.mts/.test(acceptance));

for (const check of checks) console.log(`${check.pass ? "PASS" : "FAIL"} ${check.name}${check.detail ? ` (${check.detail})` : ""}`);
const failed = checks.filter((check) => !check.pass);
if (failed.length) {
  console.error(`AI media concurrent idempotency validation failed with ${failed.length} issue(s).`);
  process.exit(1);
}

console.log("AI media concurrent idempotency validation passed.");
