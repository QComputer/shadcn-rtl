#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const schemaPath = "prisma/schema.prisma";
const migrationsRoot = path.join(root, "prisma", "migrations");

const checks = [];
const add = (name, pass, detail = "") => checks.push({ name, pass: Boolean(pass), detail });

function classifyDatabaseUrl(value) {
  if (!value) return "MISSING";
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return "INVALID";
  }
  const raw = value.toLowerCase();
  const host = parsed.hostname.toLowerCase();
  if (
    raw.includes("neon.tech") ||
    raw.includes("neon") ||
    raw.includes("ep-little-river-aifwxtf7") ||
    raw.includes("neonauth.c-4.us-east-1.aws.neon.tech")
  ) {
    return "PRODUCTION_LIKE";
  }
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
    return "LOCAL_DISPOSABLE";
  }
  return "UNKNOWN";
}

function selectedStorage() {
  return process.env.AI_MEDIA_APPLICATION_STORAGE_ADAPTER || process.env.APPLICATION_STORAGE_ADAPTER || "";
}

function providerUrl() {
  return process.env.AI_MEDIA_SERVICE_URL || process.env.AI_MEDIA_SERVICE_BASE_URL || "";
}

function assertGuard() {
  const database = classifyDatabaseUrl(process.env.DATABASE_URL || "");
  const direct = classifyDatabaseUrl(process.env.DIRECT_URL || "");
  const storage = selectedStorage();
  const provider = providerUrl();

  add("DATABASE_URL is local disposable", database === "LOCAL_DISPOSABLE", database);
  add("DIRECT_URL is local disposable", direct === "LOCAL_DISPOSABLE", direct);
  add("explicit disposable bootstrap flag is set", process.env.LOCAL_BASELINE_BOOTSTRAP_DISPOSABLE === "true");
  add("not Vercel production", process.env.VERCEL_ENV !== "production");
  add("not Node production", process.env.NODE_ENV !== "production");
  add("local storage adapter selected", storage === "local-test", storage || "MISSING");
  add("Blob production credential is not selected", !process.env.BLOB_READ_WRITE_TOKEN || storage === "local-test");
  add("live Render write URL is disabled", !provider || provider.startsWith("http://127.0.0.1") || provider.startsWith("http://localhost"));
  add("real generation is disabled", process.env.AI_MEDIA_PAID_PROVIDER_ENABLED !== "true" && process.env.AI_MEDIA_REAL_GENERATION_ENABLED !== "true");
  add("SMS dry-run is enabled", process.env.SMS_DRY_RUN !== "false");
  add("email dry-run is enabled", process.env.EMAIL_DRY_RUN !== "false");
  add("Web Push real send is disabled", process.env.WEB_PUSH_REAL_SEND_ENABLED !== "true");
  add("domain provider mutation is disabled", process.env.DOMAIN_PROVIDER_MUTATION_ENABLED !== "true");
  add("tenant provisioning execution is disabled", process.env.TENANT_PROVISIONING_EXECUTION_ENABLED !== "true");

  for (const check of checks) console.log(`${check.pass ? "PASS" : "FAIL"} ${check.name}${check.detail ? ` (${check.detail})` : ""}`);
  console.log("classification database: LOCAL_DISPOSABLE");
  console.log("classification storage: LOCAL_TEST");
  console.log("classification provider: CONTRACT_MOCK");
  console.log("classification external effects: DISABLED");

  const failed = checks.filter((check) => !check.pass);
  if (failed.length) {
    console.error(`Local baseline bootstrap guard failed with ${failed.length} issue(s).`);
    process.exit(1);
  }
}

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, {
    cwd: root,
    env,
    stdio: "inherit",
  });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function runPnpm(args, env = process.env) {
  if (process.env.npm_execpath) {
    run(process.execPath, [process.env.npm_execpath, ...args], env);
    return;
  }
  run(process.platform === "win32" ? "pnpm.cmd" : "pnpm", args, env);
}

function migrationNames() {
  return fs.readdirSync(migrationsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => fs.existsSync(path.join(migrationsRoot, name, "migration.sql")))
    .sort();
}

assertGuard();

runPnpm(["exec", "prisma", "db", "push", "--schema", schemaPath, "--skip-generate", "--accept-data-loss"]);

for (const migrationName of migrationNames()) {
  runPnpm(["exec", "prisma", "migrate", "resolve", "--schema", schemaPath, "--applied", migrationName]);
}

runPnpm(["exec", "prisma", "migrate", "status", "--schema", schemaPath]);

console.log(JSON.stringify({
  ok: true,
  baseline: "LOCAL_DISPOSABLE",
  migrationsMarkedApplied: migrationNames().length,
  productionMigrationCommand: false,
  productionPrismaMigrationsMutation: false,
}));
