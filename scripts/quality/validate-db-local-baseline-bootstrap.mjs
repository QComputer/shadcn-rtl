#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const checks = [];
const add = (name, pass, detail = "") => checks.push({ name, pass: Boolean(pass), detail });
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const exists = (rel) => fs.existsSync(path.join(root, rel));

const bootstrap = read("scripts/db/local-baseline-bootstrap.mjs");
const hermetic = read("scripts/e2e/ai-media-hermetic-acceptance.mjs");
const packageJson = read("package.json");

add("local baseline bootstrap script exists", exists("scripts/db/local-baseline-bootstrap.mjs"));
add("bootstrap refuses missing/nonlocal database URLs", /DATABASE_URL is local disposable/.test(bootstrap) && /DIRECT_URL is local disposable/.test(bootstrap));
add("bootstrap rejects Neon and Production endpoint fingerprints", /neon\.tech/.test(bootstrap) && /ep-little-river-aifwxtf7/.test(bootstrap) && /neonauth\.c-4\.us-east-1\.aws\.neon\.tech/.test(bootstrap));
add("bootstrap requires explicit disposable flag", /LOCAL_BASELINE_BOOTSTRAP_DISPOSABLE/.test(bootstrap));
add("bootstrap blocks production runtime", /VERCEL_ENV/.test(bootstrap) && /NODE_ENV/.test(bootstrap));
add("legacy bootstrap uses local schema baseline then local resolve", /prisma", "db", "push"/.test(bootstrap) && /migrate", "resolve"/.test(bootstrap));
add("legacy bootstrap does not use migrate deploy", !/migrate", "deploy"|migrate deploy/.test(bootstrap));
add("bootstrap does not print database URLs", !/DATABASE_URL.*console|DIRECT_URL.*console/.test(bootstrap));
add("hermetic acceptance uses migrate deploy after schema parity", /migrate", "deploy"/.test(hermetic) && /prisma-migrate-deploy/.test(hermetic));
add("hermetic acceptance provisions disposable Docker Postgres", /docker/.test(hermetic) && /postgres:16-alpine/.test(hermetic));
add("package exposes DB validators", /quality:db-legacy-migration-immutability/.test(packageJson) && /quality:db-local-baseline-bootstrap/.test(packageJson));
add("legacy strategy documentation exists", exists("docs/db/LEGACY_MIGRATION_BASELINE_STRATEGY.md"));

const guard = spawnSync(process.execPath, ["scripts/db/local-baseline-bootstrap.mjs"], {
  cwd: root,
  env: {
    ...process.env,
    DATABASE_URL: "postgresql://user:pass@ep-little-river-aifwxtf7.c-4.us-east-1.aws.neon.tech/db",
    DIRECT_URL: "postgresql://user:pass@ep-little-river-aifwxtf7.c-4.us-east-1.aws.neon.tech/db",
    LOCAL_BASELINE_BOOTSTRAP_DISPOSABLE: "true",
    AI_MEDIA_APPLICATION_STORAGE_ADAPTER: "local-test",
    SMS_DRY_RUN: "true",
    EMAIL_DRY_RUN: "true",
    WEB_PUSH_REAL_SEND_ENABLED: "false",
    DOMAIN_PROVIDER_MUTATION_ENABLED: "false",
    TENANT_PROVISIONING_EXECUTION_ENABLED: "false",
  },
  encoding: "utf8",
});
add("bootstrap refuses Production-like URL at runtime", guard.status !== 0 && /PRODUCTION_LIKE/.test(`${guard.stdout}\n${guard.stderr}`));

for (const check of checks) console.log(`${check.pass ? "PASS" : "FAIL"} ${check.name}${check.detail ? ` (${check.detail})` : ""}`);
const failed = checks.filter((check) => !check.pass);
if (failed.length) {
  console.error(`DB local baseline bootstrap validation failed with ${failed.length} issue(s).`);
  process.exit(1);
}
console.log("DB local baseline bootstrap validation passed.");
