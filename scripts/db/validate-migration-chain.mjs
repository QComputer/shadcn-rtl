#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

// BAZAR-BAZ-DATABASE-MIGRATION-CHAIN-RECOVERY-01
// Disposable-environment migration chain validator.
// Reproduces the CUSTOMERS enum conflict, proves fresh + upgrade + failed-state recovery.
// NEVER runs against Production / hosted Preview. Local Docker Postgres only.

const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
}

function ok(message) {
  console.log(`PASS: ${message}`);
}

function run(name, args, env = process.env) {
  const result = spawnSync(name, args, { stdio: "inherit", env, shell: process.platform === "win32" });
  if (result.error) throw new Error(result.error.message);
  if (result.status !== 0) throw new Error(`${name} ${args.join(" ")} failed (exit ${result.status ?? 1})`);
}

function capture(name, args, opts = {}) {
  const result = spawnSync(name, args, { encoding: "utf8", ...opts });
  if (result.status !== 0) throw new Error(`${name} ${args.join(" ")} failed: ${result.stderr || result.stdout}`);
  return result.stdout.trim();
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// --- Database URL safety guards ---
function classifyDatabaseUrl(value) {
  if (!value) return "MISSING";
  const lower = value.toLowerCase();
  if (lower.includes("neon.tech") || lower.includes("neon") || lower.includes("ep-") || lower.includes("aws.neon.tech")) return "PRODUCTION_LIKE";
  if (lower.includes("render.com") || lower.includes("onrender")) return "PRODUCTION_LIKE";
  const host = (() => { try { return new URL(value).hostname.toLowerCase(); } catch { return ""; } })();
  if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host.startsWith("127.")) return "LOCAL_DISPOSABLE";
  return "UNKNOWN";
}

function assertLocalDisposable(url, label) {
  const cls = classifyDatabaseUrl(url);
  if (cls !== "LOCAL_DISPOSABLE") {
    throw new Error(`Refusing to run migration-chain recovery against non-local database (${label}: ${cls}). URL not printed.`);
  }
  if (process.env.VERCEL_ENV === "production") {
    throw new Error("Refusing to run migration-chain recovery under VERCEL_ENV=production.");
  }
}

function createDockerDatabase(prefix) {
  const containerName = `${prefix}-${stamp}`;
  const databaseName = `bazar_baz_mig_${prefix}_${stamp}`;
  capture("docker", ["run", "--rm", "-d", "--name", containerName, "-e", "POSTGRES_PASSWORD=postgres", "-e", "POSTGRES_USER=postgres", "-e", `POSTGRES_DB=${databaseName}`, "-p", "127.0.0.1::5432", "postgres:16-alpine"]);
  let portLine = "";
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try { portLine = capture("docker", ["port", containerName, "5432/tcp"]); if (portLine) break; } catch { /* retry */ }
    sleep(500);
  }
  const port = portLine.split(":").pop();
  if (!port) throw new Error("Unable to determine disposable Postgres port");
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const ready = spawnSync("docker", ["exec", containerName, "pg_isready", "-U", "postgres", "-d", databaseName], { stdio: "ignore" });
    if (ready.status === 0) return { containerName, databaseName, port, url: `postgresql://postgres:postgres@127.0.0.1:${port}/${databaseName}?schema=public` };
    sleep(500);
  }
  throw new Error("Disposable Postgres did not become ready");
}

function removeDockerDatabase(containerName) {
  if (containerName) spawnSync("docker", ["rm", "-f", containerName], { stdio: "ignore" });
}

const CONFLICTING = "20260707000200_export_hub_extend_data_types";
const PREVIOUS = "20260707000100_request_demo_lead_storage";
const STORAGE_KEY = "20260717200000_add_ai_media_asset_storage_key";
const MIGRATIONS_ROOT = path.join(process.cwd(), "prisma", "migrations");
const TOTAL_MIGRATION_FOLDERS = fs.readdirSync(MIGRATIONS_ROOT, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .length;
const NON_CONFLICTING_MIGRATION_FOLDERS = TOTAL_MIGRATION_FOLDERS - 1;

const FIXED_SQL = `-- BB-B2B-P10-FIX1: extend ExportDataType to match existing export-hub implementation.
-- Adds CUSTOMERS and FANPAGE_POSTS to the ExportDataType enum.
-- No table data changes; existingExportJob rows are unaffected.
-- Made idempotent: 20260628000300_export_hub_foundation already created the
-- enum with these labels, so guard against "already exists" (42710) on a clean
-- migrate deploy.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'ExportDataType' AND e.enumlabel = 'CUSTOMERS'
  ) THEN
    ALTER TYPE "ExportDataType" ADD VALUE 'CUSTOMERS';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'ExportDataType' AND e.enumlabel = 'FANPAGE_POSTS'
  ) THEN
    ALTER TYPE "ExportDataType" ADD VALUE 'FANPAGE_POSTS';
  END IF;
END $$;
`;

const ORIGINAL_FAILING_SQL = `ALTER TYPE "ExportDataType" ADD VALUE 'CUSTOMERS';
ALTER TYPE "ExportDataType" ADD VALUE 'FANPAGE_POSTS';
`;

const baseEnv = { ...process.env };

function conflictingPath(migrationsRoot) {
  return path.join(migrationsRoot, CONFLICTING, "migration.sql");
}

// Move the conflicting migration folder entirely OUT of prisma/migrations so that
// `prisma migrate deploy` never sees it (Prisma treats any subfolder with
// migration.sql as a migration, even with a `.disabled` suffix).
function moveConflictingAside(migrationsRoot) {
  const target = path.join(migrationsRoot, "..", `.migration-aside-${CONFLICTING}`);
  if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true });
  fs.renameSync(path.join(migrationsRoot, CONFLICTING), target);
  return target;
}

function restoreConflictingAside(migrationsRoot, asideTarget) {
  if (asideTarget && fs.existsSync(asideTarget)) {
    const dest = path.join(migrationsRoot, CONFLICTING);
    if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true });
    fs.renameSync(asideTarget, dest);
  }
}

function restoreFixedSql(migrationsRoot) {
  fs.writeFileSync(conflictingPath(migrationsRoot), FIXED_SQL, "utf8");
}

function installFailingSql(migrationsRoot) {
  fs.writeFileSync(conflictingPath(migrationsRoot), ORIGINAL_FAILING_SQL, "utf8");
}

// ---------------------------------------------------------------
// Path 1: FRESH database — full migrate deploy from scratch
// ---------------------------------------------------------------
async function freshPath() {
  console.log("\n=== FRESH DATABASE PATH ===");
  const db = createDockerDatabase("fresh");
  assertLocalDisposable(db.url, "fresh");
  const env = { ...baseEnv, DATABASE_URL: db.url, DIRECT_URL: db.url, NODE_ENV: "test" };
  try {
    run("npx", ["prisma", "migrate", "deploy", "--schema=prisma/schema.prisma"], env);
    const applied = capture("docker", ["exec", db.containerName, "psql", "-U", "postgres", "-d", db.databaseName, "-t", "-A", "-c", `SELECT count(DISTINCT migration_name) FROM _prisma_migrations WHERE finished_at IS NOT NULL;`], { input: "" });
    const failed = capture("docker", ["exec", db.containerName, "psql", "-U", "postgres", "-d", db.databaseName, "-t", "-A", "-c", `SELECT count(*) FROM (SELECT DISTINCT migration_name FROM _prisma_migrations WHERE finished_at IS NULL) AS u;`], { input: "" });
    if (applied !== String(TOTAL_MIGRATION_FOLDERS)) fail(`Fresh path: expected ${TOTAL_MIGRATION_FOLDERS} applied migrations, got ${applied}`);
    if (failed !== "0") fail(`Fresh path: expected 0 failed migrations, got ${failed}`);
    else ok(`Fresh path: ${TOTAL_MIGRATION_FOLDERS} migrations applied, 0 failed`);

    const enumVals = capture("docker", ["exec", db.containerName, "psql", "-U", "postgres", "-d", db.databaseName, "-t", "-A", "-c", `SELECT string_agg(enumlabel, ',' ORDER BY enumsortorder) FROM pg_enum WHERE enumtypid=(SELECT oid FROM pg_type WHERE typname='ExportDataType');`], { input: "" });
    if (enumVals !== "PRODUCTS,PRODUCT_CATEGORIES,ORDERS,CUSTOMERS,FANPAGE_POSTS") fail(`Fresh path: ExportDataType enum unexpected: ${enumVals}`);
    else ok("Fresh path: ExportDataType enum has all 5 values, no duplicate");

    const sk = capture("docker", ["exec", db.containerName, "psql", "-U", "postgres", "-d", db.databaseName, "-t", "-A", "-c", `SELECT column_name || '|' || is_nullable FROM information_schema.columns WHERE table_name='AiMediaAsset' AND column_name='storageKey';`], { input: "" });
    if (sk !== "storageKey|YES") fail(`Fresh path: storageKey column unexpected: ${sk}`);
    else ok("Fresh path: AiMediaAsset.storageKey exists, nullable");

    const idx = capture("docker", ["exec", db.containerName, "psql", "-U", "postgres", "-d", db.databaseName, "-t", "-A", "-c", `SELECT indexname FROM pg_indexes WHERE tablename='AiMediaAsset' AND indexname='AiMediaAsset_storageKey_idx';`], { input: "" });
    if (idx !== "AiMediaAsset_storageKey_idx") fail(`Fresh path: storageKey index missing`);
    else ok("Fresh path: AiMediaAsset_storageKey_idx exists");

    const tables = capture("docker", ["exec", db.containerName, "psql", "-U", "postgres", "-d", db.databaseName, "-t", "-A", "-c", `SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('Organization','User','Product','Service','AiMediaAsset','ExportJob','Campaign');`], { input: "" });
    if (tables !== "7") fail(`Fresh path: core tables missing (got ${tables})`);
    else ok("Fresh path: core tables present");
  } finally {
    removeDockerDatabase(db.containerName);
  }
}

// ---------------------------------------------------------------
// Path 2: UPGRADE database — existing data, then apply fixed chain
// ---------------------------------------------------------------
async function upgradePath() {
  console.log("\n=== UPGRADE DATABASE PATH (existing data) ===");
  const db = createDockerDatabase("upgrade");
  assertLocalDisposable(db.url, "upgrade");
  const env = { ...baseEnv, DATABASE_URL: db.url, DIRECT_URL: db.url, NODE_ENV: "test" };
  const migrationsRoot = path.join(process.cwd(), "prisma", "migrations");
  let asideTarget = null;
  try {
    // Apply all migrations EXCEPT the conflicting one, to simulate an existing installation
    // that has the enum already populated (from 20260628000300).
    // Prisma CLI here does not support --migrations-dir, so we move the conflicting
    // migration folder entirely OUT of prisma/migrations and restore it before the real deploy.
    asideTarget = moveConflictingAside(migrationsRoot);
    run("npx", ["prisma", "migrate", "deploy", "--schema=prisma/schema.prisma"], env);
    restoreConflictingAside(migrationsRoot, asideTarget);
    asideTarget = null;

    // Insert representative existing data, including a legacy AiMediaAsset WITHOUT storageKey.
    const orgId = `org_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
    const userId = `user_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
    const reqId = `req_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
    const mirrorId = `mir_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
    const importId = `imp_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
    const legacyAssetId = `asset_legacy_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
    const newAssetId = `asset_new_${randomUUID().replace(/-/g, "").slice(0, 12)}`;

    const seedSql = `
INSERT INTO "Organization" (id, type, locale, name, slug, "isActive", "isOpen", "createdAt", "updatedAt") VALUES ('${orgId}', 'SHOP', 'fa', 'Upgrade Org', 'upgrade-org-${stamp}', true, true, NOW(), NOW()) ON CONFLICT DO NOTHING;
INSERT INTO "User" (id, password, name, "isActive", "createdAt", "updatedAt") VALUES ('${userId}', 'x', 'upgrade-user', true, NOW(), NOW()) ON CONFLICT DO NOTHING;
INSERT INTO "AiMediaRequest" (id, "organizationId", "requestedByUserId", "targetType", status, "visibilityScope", locale, "idempotencyKey", "payloadHash", "createdAt", "updatedAt") VALUES ('${reqId}', '${orgId}', '${userId}', 'PRODUCT_IMAGE', 'DRAFT', 'OWNER_ONLY', 'fa', 'idem-upgrade', 'hash-upgrade', NOW(), NOW());
INSERT INTO "AiMediaJobMirror" (id, "requestId", "organizationId", "requestedByUserId", state, provider, "correlationId", "idempotencyKey", "payloadHash", "createdAt", "updatedAt") VALUES ('${mirrorId}', '${reqId}', '${orgId}', '${userId}', 'DRAFT', 'MOCK', 'corr-upgrade', 'idem-mirror-upgrade', 'hash-mirror-upgrade', NOW(), NOW());
INSERT INTO "AiMediaImport" (id, "organizationId", "requestId", "mirrorId", status, "outputIndex", "resultFingerprint", "plannedAt", "createdAt", "updatedAt") VALUES ('${importId}', '${orgId}', '${reqId}', '${mirrorId}', 'IMPORTED', 0, 'fp-upgrade', NOW(), NOW(), NOW());
INSERT INTO "AiMediaAsset" (id, "organizationId", "requestId", "mirrorId", "importId", "requestedByUserId", "visibilityScope", "mimeType", "storageProvider", "storageKeyFingerprint", "checksumSha256", "byteSize", "acceptedAt", "createdAt", "updatedAt") VALUES ('${legacyAssetId}', '${orgId}', '${reqId}', '${mirrorId}', '${importId}', '${userId}', 'OWNER_ONLY', 'image/png', 'legacy-provider', 'legacy-fingerprint', 'legacy-checksum', 1024, NOW(), NOW(), NOW());
`;
    capture("docker", ["exec", "-i", db.containerName, "psql", "-U", "postgres", "-d", db.databaseName, "-v", "ON_ERROR_STOP=1"], { input: seedSql });
    ok("Upgrade path: seeded org/user/request/mirror/import/legacy asset");

    // Now run the FULL migration chain (with the fixed conflicting migration).
    run("npx", ["prisma", "migrate", "deploy", "--schema=prisma/schema.prisma"], env);

    const conflictFinished = capture("docker", ["exec", db.containerName, "psql", "-U", "postgres", "-d", db.databaseName, "-t", "-A", "-c", `SELECT bool_or(finished_at IS NOT NULL) FROM _prisma_migrations WHERE migration_name='${CONFLICTING}';`], { input: "" });
    if (conflictFinished !== "t") fail(`Upgrade path: ${CONFLICTING} not finished`);
    else ok(`Upgrade path: ${CONFLICTING} applied successfully (idempotent)`);

    const legacyExists = capture("docker", ["exec", db.containerName, "psql", "-U", "postgres", "-d", db.databaseName, "-t", "-A", "-c", `SELECT "storageKey" IS NULL FROM "AiMediaAsset" WHERE id='${legacyAssetId}';`], { input: "" });
    if (legacyExists !== "t") fail(`Upgrade path: legacy asset storageKey should remain NULL (got '${legacyExists}')`);
    else ok("Upgrade path: legacy AiMediaAsset.storageKey remains NULL (not consumable)");

    const enumVals = capture("docker", ["exec", db.containerName, "psql", "-U", "postgres", "-d", db.databaseName, "-t", "-A", "-c", `SELECT string_agg(enumlabel, ',' ORDER BY enumsortorder) FROM pg_enum WHERE enumtypid=(SELECT oid FROM pg_type WHERE typname='ExportDataType');`], { input: "" });
    if (enumVals !== "PRODUCTS,PRODUCT_CATEGORIES,ORDERS,CUSTOMERS,FANPAGE_POSTS") fail(`Upgrade path: enum drift (${enumVals})`);
    else ok("Upgrade path: ExportDataType enum intact, no duplicates");

    const newAssetSql = `
INSERT INTO "AiMediaAsset" (id, "organizationId", "requestId", "mirrorId", "importId", "requestedByUserId", "visibilityScope", "mimeType", "storageProvider", "storageKey", "storageKeyFingerprint", "checksumSha256", "byteSize", "acceptedAt", "createdAt", "updatedAt") VALUES ('${newAssetId}', '${orgId}', '${reqId}', '${mirrorId}', '${importId}', '${userId}', 'OWNER_ONLY', 'image/png', 'vercel-blob', 'creative-studio/${orgId}/ai-media-import/${newAssetId}.png', 'new-fingerprint', 'new-checksum', 2048, NOW(), NOW(), NOW());
`;
    capture("docker", ["exec", "-i", db.containerName, "psql", "-U", "postgres", "-d", db.databaseName, "-v", "ON_ERROR_STOP=1"], { input: newAssetSql });
    const newSk = capture("docker", ["exec", db.containerName, "psql", "-U", "postgres", "-d", db.databaseName, "-t", "-A", "-c", `SELECT "storageKey" FROM "AiMediaAsset" WHERE id='${newAssetId}';`], { input: "" });
    if (!newSk.includes("creative-studio/")) fail(`Upgrade path: new asset storageKey missing`);
    else ok("Upgrade path: new imported asset receives real storageKey (consumable)");

    // Re-run migrate deploy: should report no pending migrations.
    run("npx", ["prisma", "migrate", "deploy", "--schema=prisma/schema.prisma"], env);
    const pending = capture("docker", ["exec", db.containerName, "psql", "-U", "postgres", "-d", db.databaseName, "-t", "-A", "-c", `SELECT count(*) FROM (SELECT DISTINCT migration_name FROM _prisma_migrations WHERE finished_at IS NULL) AS u;`], { input: "" });
    if (pending !== "0") fail(`Upgrade path: expected 0 pending after second deploy, got ${pending}`);
    else ok("Upgrade path: second migrate deploy reports no pending migrations");

    const totalApplied = capture("docker", ["exec", db.containerName, "psql", "-U", "postgres", "-d", db.databaseName, "-t", "-A", "-c", `SELECT count(DISTINCT migration_name) FROM _prisma_migrations WHERE finished_at IS NOT NULL AND migration_name NOT LIKE '%.disabled';`], { input: "" });
    if (totalApplied !== String(TOTAL_MIGRATION_FOLDERS)) fail(`Upgrade path: expected ${TOTAL_MIGRATION_FOLDERS} applied migrations total, got ${totalApplied}`);
    else ok(`Upgrade path: all ${TOTAL_MIGRATION_FOLDERS} migrations applied after full chain`);
  } finally {
    removeDockerDatabase(db.containerName);
    if (asideTarget) restoreConflictingAside(migrationsRoot, asideTarget);
    restoreFixedSql(migrationsRoot);
  }
}

// ---------------------------------------------------------------
// Path 3: FAILED-STATE recovery — AUTHENTIC Prisma-generated failed record
// ---------------------------------------------------------------
async function failedStatePath() {
  console.log("\n=== FAILED-STATE RECOVERY PATH (authentic Prisma failure) ===");
  const db = createDockerDatabase("failed");
  assertLocalDisposable(db.url, "failed");
  const env = { ...baseEnv, DATABASE_URL: db.url, DIRECT_URL: db.url, NODE_ENV: "test" };
  const migrationsRoot = path.join(process.cwd(), "prisma", "migrations");
  let asideTarget = null;
  let fixedRestored = false;
  try {
    // 1. Build baseline with EVERYTHING EXCEPT the conflicting migration present.
    //    Prisma CLI here has no --migrations-dir, so move the folder entirely out of
    //    prisma/migrations (any subfolder with migration.sql is treated as a migration).
    asideTarget = moveConflictingAside(migrationsRoot);
    try {
      run("npx", ["prisma", "migrate", "deploy", "--schema=prisma/schema.prisma"], env);

      // 2. Restore the folder into prisma/migrations, but with the ORIGINAL FAILING SQL.
      restoreConflictingAside(migrationsRoot, asideTarget);
      asideTarget = null;
      installFailingSql(migrationsRoot);

      // 3. Run normal migrate deploy. Prisma now sees the conflicting migration as the
      //    next pending migration, executes the failing SQL, hits 42710, and records it
      //    as failed (started_at set, finished_at NULL).
      let authenticFailure = false;
      try {
        run("npx", ["prisma", "migrate", "deploy", "--schema=prisma/schema.prisma"], env);
      } catch {
        authenticFailure = true;
      }
      if (!authenticFailure) fail("Failed-state: expected prisma migrate deploy to fail on the original SQL");

      // Immediately restore the fixed guarded SQL (cleanup safety, even on failure).
      restoreFixedSql(migrationsRoot);
      fixedRestored = true;

      // 4. Inspect the Prisma-recorded failed row (no credentials printed).
      const failedRow = capture("docker", ["exec", db.containerName, "psql", "-U", "postgres", "-d", db.databaseName, "-t", "-A", "-c", `SELECT migration_name, started_at IS NOT NULL, finished_at IS NULL, applied_steps_count FROM _prisma_migrations WHERE migration_name='${CONFLICTING}';`], { input: "" });
      if (!failedRow.includes(CONFLICTING) || !failedRow.includes("t")) fail(`Failed-state: Prisma did not record authentic failed row (${failedRow})`);
      else ok("Failed-state: Prisma authentically recorded the migration as failed (started_at set, finished_at NULL)");

      // 5. Prisma-supported recovery: mark the failed migration as rolled-back.
      run("npx", ["prisma", "migrate", "resolve", "--rolled-back", CONFLICTING, "--schema=prisma/schema.prisma"], env);
      ok(`Failed-state: marked ${CONFLICTING} as rolled-back via prisma migrate resolve (supported recovery)`);

      // Inspect the row state after --rolled-back for diagnostics (no secret exposure).
      const afterResolve = capture("docker", ["exec", db.containerName, "psql", "-U", "postgres", "-d", db.databaseName, "-t", "-A", "-c", `SELECT migration_name, finished_at IS NULL, rolled_back_at IS NOT NULL FROM _prisma_migrations WHERE migration_name='${CONFLICTING}';`], { input: "" });
      ok(`Failed-state: row state after --rolled-back -> ${afterResolve.replace(/\|/g, " | ")}`);

      // 6. Re-deploy with the fixed SQL. In this Prisma version `--rolled-back` keeps the
      //    row, and `migrate deploy` will attempt to re-apply. Verify it succeeds.
      let redeployClean = false;
      try {
        run("npx", ["prisma", "migrate", "deploy", "--schema=prisma/schema.prisma"], env);
        redeployClean = true;
      } catch (err) {
        // Diagnostic: capture safe migration-history state without exposing credentials.
        const diag = capture("docker", ["exec", db.containerName, "psql", "-U", "postgres", "-d", db.databaseName, "-t", "-A", "-c", `SELECT migration_name, started_at, finished_at, rolled_back_at, applied_steps_count FROM _prisma_migrations WHERE migration_name='${CONFLICTING}';`], { input: "" });
        console.error(`Failed-state diagnostic (_prisma_migrations, no credentials): ${diag}`);
        fail(`Failed-state: re-deploy failed after supported recovery: ${err.message}`);
      }
      if (!redeployClean) return;
      ok("Failed-state: re-deploy with fixed idempotent SQL succeeded (no manual row deletion required)");

      const conflictFinished = capture("docker", ["exec", db.containerName, "psql", "-U", "postgres", "-d", db.databaseName, "-t", "-A", "-c", `SELECT bool_or(finished_at IS NOT NULL) FROM _prisma_migrations WHERE migration_name='${CONFLICTING}';`], { input: "" });
      if (conflictFinished !== "t") fail(`Failed-state: ${CONFLICTING} not recovered`);
      else ok(`Failed-state: ${CONFLICTING} recovered via fixed idempotent SQL`);

      // Active-failed = finished_at NULL AND NOT rolled_back. This is the true health signal.
      const activeFailed = capture("docker", ["exec", db.containerName, "psql", "-U", "postgres", "-d", db.databaseName, "-t", "-A", "-c", `SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL;`], { input: "" });
      if (activeFailed !== "0") {
        const detail = capture("docker", ["exec", db.containerName, "psql", "-U", "postgres", "-d", db.databaseName, "-t", "-A", "-c", `SELECT migration_name, finished_at IS NOT NULL, rolled_back_at IS NOT NULL, applied_steps_count FROM _prisma_migrations ORDER BY migration_name;`], { input: "" });
        console.error(`Failed-state diagnostic (migration history, no credentials):\n${detail}`);
        fail(`Failed-state: expected 0 active-failed migrations, got ${activeFailed}`);
      } else ok("Failed-state: no active-failed migrations after recovery (rolled-back history retained, no manual deletion)");

      // All non-conflicting migration folders must have at least one finished (applied) row.
      const appliedNames = capture("docker", ["exec", db.containerName, "psql", "-U", "postgres", "-d", db.databaseName, "-t", "-A", "-c", `SELECT count(DISTINCT migration_name) FROM _prisma_migrations WHERE finished_at IS NOT NULL AND migration_name NOT LIKE '%.disabled' AND migration_name <> '${CONFLICTING}';`], { input: "" });
      const expectedApplied = NON_CONFLICTING_MIGRATION_FOLDERS; // all folders except the recovered conflicting one
      if (appliedNames !== String(expectedApplied)) {
        const detail = capture("docker", ["exec", db.containerName, "psql", "-U", "postgres", "-d", db.databaseName, "-t", "-A", "-c", `SELECT migration_name, finished_at IS NOT NULL, rolled_back_at IS NOT NULL FROM _prisma_migrations ORDER BY migration_name;`], { input: "" });
        console.error(`Failed-state diagnostic (migration history, no credentials):\n${detail}`);
        fail(`Failed-state: expected ${expectedApplied} non-conflicting applied migration names, got ${appliedNames}`);
      } else ok(`Failed-state: all ${expectedApplied} non-conflicting migrations applied`);

      // No stray `.disabled` migration rows (test-environment cleanliness guard).
      const stray = capture("docker", ["exec", db.containerName, "psql", "-U", "postgres", "-d", db.databaseName, "-t", "-A", "-c", `SELECT count(*) FROM _prisma_migrations WHERE migration_name LIKE '%.disabled';`], { input: "" });
      if (stray !== "0") fail(`Failed-state: stray .disabled migration rows present (${stray}) — test cleanup error`);
      else ok("Failed-state: no stray .disabled migration rows");

      const enumVals = capture("docker", ["exec", db.containerName, "psql", "-U", "postgres", "-d", db.databaseName, "-t", "-A", "-c", `SELECT string_agg(enumlabel, ',' ORDER BY enumsortorder) FROM pg_enum WHERE enumtypid=(SELECT oid FROM pg_type WHERE typname='ExportDataType');`], { input: "" });
      if (enumVals !== "PRODUCTS,PRODUCT_CATEGORIES,ORDERS,CUSTOMERS,FANPAGE_POSTS") fail(`Failed-state: enum drift (${enumVals})`);
      else ok("Failed-state: ExportDataType enum intact, no duplicates");
    } finally {
      // Always restore the migration folder/file before removing the container.
      if (asideTarget) restoreConflictingAside(migrationsRoot, asideTarget);
      if (!fixedRestored) {
        try { restoreFixedSql(migrationsRoot); } catch { /* ignore */ }
      }
    }
  } finally {
    removeDockerDatabase(db.containerName);
  }
}

const mode = process.argv[2] || "all";

// Defensive pre-flight: ensure a prior interrupted run did not leave the working
// tree in a moved-aside or broken state. Restore the fixed migration file and the
// conflicting folder if unexpectedly displaced.
function ensureCleanWorkingTree() {
  const migrationsRoot = path.join(process.cwd(), "prisma", "migrations");
  const asideTarget = path.join(migrationsRoot, "..", `.migration-aside-${CONFLICTING}`);
  if (fs.existsSync(asideTarget)) {
    const dest = path.join(migrationsRoot, CONFLICTING);
    if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true });
    fs.renameSync(asideTarget, dest);
  }
  const disabled = path.join(migrationsRoot, `${CONFLICTING}.disabled`);
  if (fs.existsSync(disabled)) {
    fs.renameSync(disabled, path.join(migrationsRoot, CONFLICTING));
  }
  if (fs.existsSync(conflictingPath(migrationsRoot))) {
    restoreFixedSql(migrationsRoot);
  } else {
    throw new Error(`Conflicting migration folder missing: ${CONFLICTING}`);
  }
}

try {
  ensureCleanWorkingTree();
  if (mode === "fresh" || mode === "all") await freshPath();
  if (mode === "upgrade" || mode === "all") await upgradePath();
  if (mode === "failed" || mode === "all") await failedStatePath();
  if (process.exitCode === 1) {
    console.error("\nMigration chain recovery validation FAILED.");
  } else {
    console.log("\n✅ Migration chain recovery validation passed (fresh + upgrade + failed-state).");
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
