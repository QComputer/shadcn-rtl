#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

// BAZAR-BAZ-DATABASE-SCHEMA-DRIFT-NORMALIZATION-01
// Disposable-environment schema-parity validator.
// Proves raw `prisma migrate deploy` applies the full chain (including the new
// normalization migration) and that `prisma migrate diff` reports zero unexpected
// drift against prisma/schema.prisma.
// NEVER runs against Production / hosted Preview. Local Docker Postgres only.

const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
const NEW_MIGRATION = "20260719000000_normalize_schema_drift";
const driftReportDir = path.join(process.cwd(), ".tmp", "schema-drift");

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
}

function ok(message) {
  console.log(`PASS: ${message}`);
}

function commandFor(name) {
  if (process.platform !== "win32") return name;
  if (name === "pnpm") return "pnpm.cmd";
  if (name === "npx") return "npx.cmd";
  return name;
}

function shellFor(name) {
  return process.platform === "win32" && (name === "pnpm" || name === "npx");
}

function sanitizeOutput(value) {
  return String(value || "")
    .replace(/postgresql:\/\/[^\s"']+/gi, "postgresql://<redacted-local-url>")
    .replace(/POSTGRES_PASSWORD=[^\s"']+/gi, "POSTGRES_PASSWORD=<redacted>");
}

function run(name, args, env = process.env) {
  const result = spawnSync(commandFor(name), args, { stdio: "inherit", env, shell: shellFor(name) });
  if (result.error) throw new Error(result.error.message);
  if (result.status !== 0) throw new Error(`${name} command failed (exit ${result.status ?? 1})`);
}

function capture(name, args, opts = {}) {
  const result = spawnSync(commandFor(name), args, { encoding: "utf8", shell: shellFor(name), ...opts });
  if (result.error) throw new Error(result.error.message);
  if (result.status !== 0) throw new Error(`${name} command failed: ${sanitizeOutput(result.stderr || result.stdout || `exit ${result.status ?? 1}`)}`);
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
    throw new Error(`Refusing to run schema-drift normalization against non-local database (${label}: ${cls}). URL not printed.`);
  }
  if (process.env.VERCEL_ENV === "production") {
    throw new Error("Refusing to run schema-drift normalization under VERCEL_ENV=production.");
  }
}

function createDockerDatabase(prefix) {
  const containerName = `driftnorm-${prefix}-${stamp}`;
  const databaseName = `bazar_baz_driftnorm_${prefix}_${stamp}`;
  const password = `local_${randomUUID().replace(/-/g, "")}`;
  capture("docker", ["run", "--rm", "-d", "--name", containerName, "-e", `POSTGRES_PASSWORD=${password}`, "-e", "POSTGRES_USER=postgres", "-e", `POSTGRES_DB=${databaseName}`, "-p", "127.0.0.1::5432", "postgres:16-alpine"]);
  let portLine = "";
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try { portLine = capture("docker", ["port", containerName, "5432/tcp"]); if (portLine) break; } catch { /* retry */ }
    sleep(500);
  }
  const port = portLine.split(":").pop();
  if (!port) throw new Error("Unable to determine disposable Postgres port");
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const ready = spawnSync("docker", ["exec", containerName, "pg_isready", "-U", "postgres", "-d", databaseName], { stdio: "ignore" });
    if (ready.status === 0) return { containerName, databaseName, port, url: `postgresql://postgres:${password}@127.0.0.1:${port}/${databaseName}?schema=public` };
    sleep(500);
  }
  throw new Error("Disposable Postgres did not become ready");
}

function removeDockerDatabase(containerName) {
  if (containerName) spawnSync("docker", ["rm", "-f", containerName], { stdio: "ignore" });
}

function prisma(args, env) {
  return run("pnpm", ["exec", "prisma", ...args], env);
}

// Move the new normalization migration entirely OUT of prisma/migrations so it is
// excluded from a baseline deploy that simulates "state before the normalization".
function moveNewMigrationAside(migrationsRoot) {
  const target = path.join(migrationsRoot, "..", `.aside-${NEW_MIGRATION}`);
  if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true });
  const src = path.join(migrationsRoot, NEW_MIGRATION);
  if (fs.existsSync(src)) fs.renameSync(src, target);
  return target;
}

function restoreNewMigration(migrationsRoot, asideTarget) {
  if (asideTarget && fs.existsSync(asideTarget)) {
    const dest = path.join(migrationsRoot, NEW_MIGRATION);
    if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true });
    fs.renameSync(asideTarget, dest);
  }
}

// Run `prisma migrate diff` between the migrated DB and the canonical schema.
// Returns the raw --script output. Non-empty SQL => unexpected drift.
function diffScript(url) {
  return capture("pnpm", ["exec", "prisma", "migrate", "diff", "--from-url", url, "--to-schema-datamodel", "prisma/schema.prisma", "--script"], { env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url, NODE_ENV: "test" } });
}

function writeDriftReport(name, contents) {
  fs.mkdirSync(driftReportDir, { recursive: true });
  const reportPath = path.join(driftReportDir, `${name}-${stamp}.sql`);
  fs.writeFileSync(reportPath, sanitizeOutput(contents), "utf8");
  console.log(`Report: ${path.relative(process.cwd(), reportPath)}`);
}

// An empty diff from Prisma prints the marker comment only (no ALTER/CREATE/DROP).
function assertZeroUnexpectedDrift(url, label) {
  const out = diffScript(url);
  const hasSql = /(^|\n)\s*(ALTER|CREATE|DROP|INSERT|UPDATE|DELETE|RENAME|COMMENT ON)\b/i.test(out);
  if (hasSql) {
    fail(`${label}: unexpected Prisma drift remains:\n${out}`);
  } else {
    ok(`${label}: zero unexpected drift (empty Prisma migrate diff)`);
  }
  return out;
}

function psql(db, sql) {
  return capture("docker", ["exec", "-i", db.containerName, "psql", "-U", "postgres", "-d", db.databaseName, "-v", "ON_ERROR_STOP=1"], { input: sql });
}

function countApplied(db) {
  return capture("docker", ["exec", db.containerName, "psql", "-U", "postgres", "-d", db.databaseName, "-t", "-A", "-c", `SELECT count(DISTINCT migration_name) FROM _prisma_migrations WHERE finished_at IS NOT NULL;`], { input: "" });
}

function countActiveFailed(db) {
  return capture("docker", ["exec", db.containerName, "psql", "-U", "postgres", "-d", db.databaseName, "-t", "-A", "-c", `SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL;`], { input: "" });
}

function domainStatusValues(db) {
  return capture("docker", ["exec", db.containerName, "psql", "-U", "postgres", "-d", db.databaseName, "-t", "-A", "-c", `SELECT string_agg(enumlabel, ',' ORDER BY enumsortorder) FROM pg_enum WHERE enumtypid=(SELECT oid FROM pg_type WHERE typname='DomainStatus');`], { input: "" });
}

function imageAccessValues(db) {
  return capture("docker", ["exec", db.containerName, "psql", "-U", "postgres", "-d", db.databaseName, "-t", "-A", "-c", `SELECT string_agg(enumlabel, ',' ORDER BY enumsortorder) FROM pg_enum WHERE enumtypid=(SELECT oid FROM pg_type WHERE typname='ImageAccess');`], { input: "" });
}

// ---------------------------------------------------------------------------
async function freshPath() {
  console.log("\n=== FRESH DATABASE PATH (raw migrate deploy from empty) ===");
  const db = createDockerDatabase("fresh");
  assertLocalDisposable(db.url, "fresh");
  const env = { ...process.env, DATABASE_URL: db.url, DIRECT_URL: db.url, NODE_ENV: "test" };
  try {
    prisma(["migrate", "deploy", "--schema=prisma/schema.prisma"], env);

    const applied = countApplied(db);
    if (!/^\d+$/.test(applied) || Number(applied) < 53) fail(`Fresh path: expected >= 53 applied migrations, got ${applied}`);
    else ok(`Fresh path: ${applied} migrations applied (includes normalization)`);

    const activeFailed = countActiveFailed(db);
    if (activeFailed !== "0") fail(`Fresh path: expected 0 active-failed migrations, got ${activeFailed}`);
    else ok("Fresh path: 0 active-failed migrations");

    if (imageAccessValues(db) !== "PUBLIC,PRIVATE") fail(`Fresh path: ImageAccess unexpected: ${imageAccessValues(db)}`);
    else ok("Fresh path: ImageAccess enum = PUBLIC,PRIVATE");

    if (domainStatusValues(db) !== "REQUESTED,PROVIDER_PENDING,DNS_REQUIRED,VERIFYING,ACTIVE,ERROR,DISABLED,REMOVAL_PENDING,REMOVED") fail(`Fresh path: DomainStatus unexpected: ${domainStatusValues(db)}`);
    else ok("Fresh path: DomainStatus = 9 canonical values (no PENDING/FAILED)");

    const sk = capture("docker", ["exec", db.containerName, "psql", "-U", "postgres", "-d", db.databaseName, "-t", "-A", "-c", `SELECT column_name || '|' || is_nullable FROM information_schema.columns WHERE table_name='Image' AND column_name='access';`], { input: "" });
    if (sk !== "access|NO") fail(`Fresh path: Image.access unexpected: ${sk}`);
    else ok("Fresh path: Image.access exists, NOT NULL");

    const skIdx = capture("docker", ["exec", db.containerName, "psql", "-U", "postgres", "-d", db.databaseName, "-t", "-A", "-c", `SELECT indexname FROM pg_indexes WHERE tablename='Image' AND indexname='Image_access_idx';`], { input: "" });
    if (skIdx !== "Image_access_idx") fail("Fresh path: Image_access_idx missing");
    else ok("Fresh path: Image_access_idx exists");

    // No duplicate enum error, no stale enum labels.
    assertZeroUnexpectedDrift(db.url, "Fresh path");
  } finally {
    removeDockerDatabase(db.containerName);
  }
}

// ---------------------------------------------------------------------------
async function upgradePath() {
  console.log("\n=== UPGRADE DATABASE PATH (existing data, then normalization) ===");
  const db = createDockerDatabase("upgrade");
  assertLocalDisposable(db.url, "upgrade");
  const env = { ...process.env, DATABASE_URL: db.url, DIRECT_URL: db.url, NODE_ENV: "test" };
  const migrationsRoot = path.join(process.cwd(), "prisma", "migrations");
  let asideTarget = null;
  try {
    // Baseline: deploy everything EXCEPT the new normalization migration.
    asideTarget = moveNewMigrationAside(migrationsRoot);
    prisma(["migrate", "deploy", "--schema=prisma/schema.prisma"], env);
    restoreNewMigration(migrationsRoot, asideTarget);
    asideTarget = null;

    // Seed representative rows covering affected areas.
    const orgId = `org_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
    const userId = `user_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
    const domainId = `dom_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
    const imgId = `img_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
    const legacyAssetId = `asset_legacy_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
    const newAssetId = `asset_new_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
    const reqId = `req_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
    const mirrorId = `mir_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
    const importId = `imp_${randomUUID().replace(/-/g, "").slice(0, 12)}`;

    psql(db, `
INSERT INTO "Organization" (id, type, locale, name, slug, "isActive", "isOpen", "createdAt", "updatedAt") VALUES ('${orgId}', 'SHOP', 'fa', 'Drift Org', 'drift-org-${stamp}', true, true, NOW(), NOW()) ON CONFLICT DO NOTHING;
INSERT INTO "User" (id, password, name, "isActive", "createdAt", "updatedAt") VALUES ('${userId}', 'x', 'drift-user', true, NOW(), NOW()) ON CONFLICT DO NOTHING;
INSERT INTO "OrganizationDomain" (id, "organizationId", domain, "normalizedDomain", kind, provider, type, status, "isPrimary", "verificationToken", "verificationType", "verificationDomain", "verificationValue", "createdById", "updatedById", "reviewedById", "createdAt", "updatedAt")
  VALUES ('${domainId}', '${orgId}', 'shop.example.com', 'shop.example.com', 'SUBDOMAIN', 'VERCEL', 'CUSTOM', 'ACTIVE', false, 'tok', 'TXT', '_acme-challenge.shop.example.com', 'abc123', '${userId}', '${userId}', '${userId}', NOW(), NOW());
INSERT INTO "Image" (id, url, "uploadedByUserId", "organizationId", "createdAt") VALUES ('${imgId}', 'https://example.com/x.png', '${userId}', '${orgId}', NOW());
INSERT INTO "SmsDelivery" (id, "organizationId", "customerId", "phoneMasked", purpose, message, "createdAt", "updatedAt") VALUES ('sms_${stamp}', '${orgId}', '${userId}', 'masked', 'ORDER', 'synthetic drift proof', NOW(), NOW());
INSERT INTO "AiMediaRequest" (id, "organizationId", "requestedByUserId", "targetType", status, "visibilityScope", locale, "idempotencyKey", "payloadHash", "createdAt", "updatedAt") VALUES ('${reqId}', '${orgId}', '${userId}', 'PRODUCT_IMAGE', 'DRAFT', 'OWNER_ONLY', 'fa', 'idem-drift', 'hash-drift', NOW(), NOW());
INSERT INTO "AiMediaJobMirror" (id, "requestId", "organizationId", "requestedByUserId", state, provider, "correlationId", "idempotencyKey", "payloadHash", "createdAt", "updatedAt") VALUES ('${mirrorId}', '${reqId}', '${orgId}', '${userId}', 'DRAFT', 'MOCK', 'corr-drift', 'idem-mirror-drift', 'hash-mirror-drift', NOW(), NOW());
INSERT INTO "AiMediaImport" (id, "organizationId", "requestId", "mirrorId", status, "outputIndex", "resultFingerprint", "plannedAt", "createdAt", "updatedAt") VALUES ('${importId}', '${orgId}', '${reqId}', '${mirrorId}', 'IMPORTED', 0, 'fp-drift', NOW(), NOW(), NOW());
INSERT INTO "AiMediaAsset" (id, "organizationId", "requestId", "mirrorId", "importId", "requestedByUserId", "visibilityScope", "mimeType", "storageProvider", "storageKeyFingerprint", "checksumSha256", "byteSize", "acceptedAt", "createdAt", "updatedAt") VALUES ('${legacyAssetId}', '${orgId}', '${reqId}', '${mirrorId}', '${importId}', '${userId}', 'OWNER_ONLY', 'image/png', 'legacy-provider', 'legacy-fingerprint', 'legacy-checksum', 1024, NOW(), NOW(), NOW());
`);
    ok("Upgrade path: seeded org/user/domain/image/sms/ai-media rows");

    // Now apply the normalization migration.
    prisma(["migrate", "deploy", "--schema=prisma/schema.prisma"], env);

    const applied = countApplied(db);
    if (!/^\d+$/.test(applied) || Number(applied) < 53) fail(`Upgrade path: expected >= 53 applied migrations, got ${applied}`);
    else ok(`Upgrade path: ${applied} migrations applied after normalization`);

    // Existing data preserved.
    const domainRow = capture("docker", ["exec", db.containerName, "psql", "-U", "postgres", "-d", db.databaseName, "-t", "-A", "-c", `SELECT "verificationToken","verificationType","verificationDomain","verificationValue","status","createdById" FROM "OrganizationDomain" WHERE id='${domainId}';`], { input: "" });
    if (!domainRow.includes("tok") || !domainRow.includes("TXT") || !domainRow.includes("ACTIVE") || !domainRow.includes(userId)) fail(`Upgrade path: OrganizationDomain data not preserved (${domainRow})`);
    else ok("Upgrade path: OrganizationDomain row preserved (verification fields, status, ownership FKs)");

    const imgAccess = capture("docker", ["exec", db.containerName, "psql", "-U", "postgres", "-d", db.databaseName, "-t", "-A", "-c", `SELECT "access" FROM "Image" WHERE id='${imgId}';`], { input: "" });
    if (imgAccess !== "PUBLIC") fail(`Upgrade path: Image.access default unexpected (${imgAccess})`);
    else ok("Upgrade path: Image.access default applied (PUBLIC) to pre-existing row");

    // Legacy AI asset hidden; new asset consumable.
    const legacySk = capture("docker", ["exec", db.containerName, "psql", "-U", "postgres", "-d", db.databaseName, "-t", "-A", "-c", `SELECT "storageKey" IS NULL FROM "AiMediaAsset" WHERE id='${legacyAssetId}';`], { input: "" });
    if (legacySk !== "t") fail(`Upgrade path: legacy asset storageKey should remain NULL (${legacySk})`);
    else ok("Upgrade path: legacy AiMediaAsset.storageKey remains NULL (not consumable)");

    const newAssetSql = `INSERT INTO "AiMediaAsset" (id, "organizationId", "requestId", "mirrorId", "importId", "requestedByUserId", "visibilityScope", "mimeType", "storageProvider", "storageKey", "storageKeyFingerprint", "checksumSha256", "byteSize", "acceptedAt", "createdAt", "updatedAt") VALUES ('${newAssetId}', '${orgId}', '${reqId}', '${mirrorId}', '${importId}', '${userId}', 'OWNER_ONLY', 'image/png', 'vercel-blob', 'creative-studio/${orgId}/ai-media-import/${newAssetId}.png', 'new-fingerprint', 'new-checksum', 2048, NOW(), NOW(), NOW());`;
    psql(db, newAssetSql);
    const newSk = capture("docker", ["exec", db.containerName, "psql", "-U", "postgres", "-d", db.databaseName, "-t", "-A", "-c", `SELECT "storageKey" FROM "AiMediaAsset" WHERE id='${newAssetId}';`], { input: "" });
    if (!newSk.includes("creative-studio/")) fail("Upgrade path: new asset storageKey missing");
    else ok("Upgrade path: new imported asset receives real storageKey (consumable)");

    // DomainStatus: legacy PENDING/FAILED gone, canonical 9 values present.
    const ds = domainStatusValues(db);
    if (ds !== "REQUESTED,PROVIDER_PENDING,DNS_REQUIRED,VERIFYING,ACTIVE,ERROR,DISABLED,REMOVAL_PENDING,REMOVED") fail(`Upgrade path: DomainStatus unexpected after normalization: ${ds}`);
    else ok("Upgrade path: DomainStatus normalized to 9 canonical values");

    const activeFailed = countActiveFailed(db);
    if (activeFailed !== "0") fail(`Upgrade path: expected 0 active-failed, got ${activeFailed}`);
    else ok("Upgrade path: 0 active-failed migrations");

    // Repeat deploy -> no pending.
    prisma(["migrate", "deploy", "--schema=prisma/schema.prisma"], env);
    const pending = countActiveFailed(db);
    if (pending !== "0") fail(`Upgrade path: expected 0 pending after second deploy, got ${pending}`);
    else ok("Upgrade path: second migrate deploy reports no pending migrations");

    assertZeroUnexpectedDrift(db.url, "Upgrade path");
  } finally {
    removeDockerDatabase(db.containerName);
    if (asideTarget) restoreNewMigration(migrationsRoot, asideTarget);
  }
}

// ---------------------------------------------------------------------------
async function repeatPath() {
  console.log("\n=== REPEAT DEPLOY PATH (idempotency) ===");
  const db = createDockerDatabase("repeat");
  assertLocalDisposable(db.url, "repeat");
  const env = { ...process.env, DATABASE_URL: db.url, DIRECT_URL: db.url, NODE_ENV: "test" };
  try {
    prisma(["migrate", "deploy", "--schema=prisma/schema.prisma"], env);
    prisma(["migrate", "deploy", "--schema=prisma/schema.prisma"], env);
    const applied = countApplied(db);
    const activeFailed = countActiveFailed(db);
    if (activeFailed !== "0") fail(`Repeat path: expected 0 active-failed after re-deploy, got ${activeFailed}`);
    else ok("Repeat path: re-deploy clean, 0 active-failed");
    if (!/^\d+$/.test(applied) || Number(applied) < 53) fail(`Repeat path: unexpected applied count ${applied}`);
    else ok(`Repeat path: ${applied} migrations still applied (no migration re-added)`);
    assertZeroUnexpectedDrift(db.url, "Repeat path");
  } finally {
    removeDockerDatabase(db.containerName);
  }
}

// ---------------------------------------------------------------------------
async function inventoryPath() {
  console.log("\n=== INVENTORY PATH (current drift vs canonical schema) ===");
  const db = createDockerDatabase("inventory");
  assertLocalDisposable(db.url, "inventory");
  const env = { ...process.env, DATABASE_URL: db.url, DIRECT_URL: db.url, NODE_ENV: "test" };
  try {
    prisma(["migrate", "deploy", "--schema=prisma/schema.prisma"], env);
    const out = diffScript(db.url);
    const lines = out.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const sqlLines = lines.filter((l) => /^(--\s*)?(ALTER|CREATE|DROP|RENAME|INSERT|UPDATE|DELETE|COMMENT ON)\b/i.test(l) && !/^--/.test(l));
    if (sqlLines.length === 0) {
      ok("Inventory: zero unexpected drift (empty Prisma migrate diff)");
    } else {
      console.log("Inventory: remaining drift SQL (expected empty after normalization):");
      sqlLines.forEach((l) => console.log(`  ${l}`));
      fail(`Inventory: ${sqlLines.length} unexpected drift line(s) remain`);
    }
    console.log(`Inventory: ${sqlLines.length} actionable drift line(s).`);
  } finally {
    removeDockerDatabase(db.containerName);
  }
}

// ---------------------------------------------------------------------------
async function inspectPath() {
  console.log("\n=== INSPECT PATH (original drift before normalization) ===");
  const db = createDockerDatabase("inspect");
  assertLocalDisposable(db.url, "inspect");
  const env = { ...process.env, DATABASE_URL: db.url, DIRECT_URL: db.url, NODE_ENV: "test" };
  const migrationsRoot = path.join(process.cwd(), "prisma", "migrations");
  let asideTarget = null;
  try {
    asideTarget = moveNewMigrationAside(migrationsRoot);
    prisma(["migrate", "deploy", "--schema=prisma/schema.prisma"], env);
    const out = diffScript(db.url);
    writeDriftReport("original-drift", out);
    const sqlLines = out.split(/\r?\n/).map((l) => l.trim()).filter((l) => /^(ALTER|CREATE|DROP|COMMENT ON)\b/i.test(l));
    if (sqlLines.length === 0) {
      fail("Inspect path: expected original drift before normalization, got empty diff");
    } else {
      ok(`Inspect path: reproduced ${sqlLines.length} original drift SQL line(s) before normalization`);
      for (const line of sqlLines) console.log(`DRIFT ${line}`);
    }
  } finally {
    removeDockerDatabase(db.containerName);
    if (asideTarget) restoreNewMigration(migrationsRoot, asideTarget);
  }
}

const mode = process.argv[2] || "all";

try {
  if (mode === "inspect" || mode === "all") await inspectPath();
  if (mode === "inventory" || mode === "all") await inventoryPath();
  if (mode === "fresh" || mode === "all") await freshPath();
  if (mode === "upgrade" || mode === "all") await upgradePath();
  if (mode === "repeat" || mode === "all") await repeatPath();
  if (process.exitCode === 1) {
    console.error("\nSchema-drift normalization validation FAILED.");
  } else {
    console.log(`\nSchema-drift normalization validation passed (${mode}).`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
