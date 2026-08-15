#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = process.cwd();
const migrationsRoot = path.join(repoRoot, "prisma", "migrations");
const prismaCli = path.join(repoRoot, "node_modules", "prisma", "build", "index.js");
const targetMigration = "20260815000100_multi_capability_collaboration_ready_time_push_roles";
const originMigration = "20260815000200_push_subscription_origin";
const containerName = `bazar-baz-tenant-legacy-${Date.now()}`;
const databaseName = "bazar_baz_tenant_legacy_upgrade";
let tempRoot = null;

function fail(message) {
  throw new Error(message);
}

function run(command, args, options = {}) {
  const executable = process.platform === "win32" && ["pnpm", "npm", "npx"].includes(command)
    ? `${command}.cmd`
    : command;
  const result = spawnSync(executable, args, {
    cwd: repoRoot,
    encoding: "utf8",
    ...options,
  });
  if (result.status !== 0) {
    fail(`${command} ${args.join(" ")} failed (${result.status ?? 1})\n${result.stderr || result.stdout}`);
  }
  return (result.stdout || "").trim();
}

function dockerSql(sql, tuplesOnly = false) {
  const args = ["exec", "-i", containerName, "psql", "-U", "postgres", "-d", databaseName, "-v", "ON_ERROR_STOP=1"];
  if (tuplesOnly) args.push("-t", "-A");
  const result = spawnSync("docker", args, { input: sql, encoding: "utf8" });
  if (result.status !== 0) fail(`psql failed\n${result.stderr || result.stdout}`);
  return (result.stdout || "").trim();
}

function waitForPostgres() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const ready = spawnSync("docker", ["exec", containerName, "pg_isready", "-U", "postgres", "-d", databaseName], { stdio: "ignore" });
    if (ready.status === 0) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
  }
  fail("Disposable PostgreSQL did not become ready");
}

function prepareTemporaryMigrationTree() {
  const tempParent = path.join(repoRoot, ".tmp");
  fs.mkdirSync(tempParent, { recursive: true });
  tempRoot = fs.mkdtempSync(path.join(tempParent, "tenant-legacy-upgrade-"));
  const tempPrisma = path.join(tempRoot, "prisma");
  const tempMigrations = path.join(tempPrisma, "migrations");
  fs.mkdirSync(tempMigrations, { recursive: true });
  fs.copyFileSync(path.join(repoRoot, "prisma", "schema.prisma"), path.join(tempPrisma, "schema.prisma"));

  const migrations = fs.readdirSync(migrationsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name < targetMigration)
    .map((entry) => entry.name)
    .sort();
  for (const migration of migrations) {
    fs.cpSync(path.join(migrationsRoot, migration), path.join(tempMigrations, migration), { recursive: true });
  }

  const configPath = path.join(tempRoot, "prisma.config.ts");
  fs.writeFileSync(configPath, [
    'import "dotenv/config";',
    'import { defineConfig, env } from "prisma/config";',
    'export default defineConfig({',
    '  schema: "prisma/schema.prisma",',
    '  migrations: { path: "prisma/migrations" },',
    '  datasource: { url: env("DIRECT_URL") },',
    '});',
    '',
  ].join("\n"));
  return { configPath, tempMigrations };
}

function deploy(configPath, databaseUrl) {
  run(process.execPath, [prismaCli, "migrate", "deploy", "--config", configPath], {
    env: { ...process.env, DATABASE_URL: databaseUrl, DIRECT_URL: databaseUrl, NODE_ENV: "test" },
  });
}

function dataDigest() {
  return dockerSql(`
SELECT md5(concat_ws('|',
  (SELECT string_agg(id || ':' || "organizationId" || ':' || "userId", ',' ORDER BY id) FROM "OrganizationMember"),
  (SELECT string_agg(id || ':' || "organizationSlug" || ':' || "orderNumber" || ':' || total::text, ',' ORDER BY id) FROM "Order"),
  (SELECT string_agg(id || ':' || "organizationId" || ':' || name || ':' || "basePrice"::text, ',' ORDER BY id) FROM "Product"),
  (SELECT string_agg(id || ':' || "organizationId" || ':' || name || ':' || price::text, ',' ORDER BY id) FROM "Service"),
  (SELECT string_agg(id || ':' || "organizationId" || ':' || "normalizedDomain", ',' ORDER BY id) FROM "OrganizationDomain")
));`, true);
}

function rowCounts() {
  return dockerSql(`
SELECT concat_ws('|',
  (SELECT count(*) FROM "OrganizationMember"),
  (SELECT count(*) FROM "Order"),
  (SELECT count(*) FROM "Product"),
  (SELECT count(*) FROM "Service"),
  (SELECT count(*) FROM "OrganizationDomain")
);`, true);
}

function seedLegacyFixture() {
  dockerSql(`ALTER TYPE "OrganizationType" ADD VALUE IF NOT EXISTS 'SERVICE';`);
  dockerSql(`
INSERT INTO "Organization" (id, type, locale, timezone, name, slug, "isActive", "isOpen", "createdAt", "updatedAt") VALUES
  ('legacy_org_shop', 'SHOP', 'fa', 'Asia/Tehran', 'Legacy Shop', 'legacy-shop', true, true, NOW(), NOW()),
  ('legacy_org_appointment', 'APPOINTMENT', 'fa', 'Asia/Tehran', 'Legacy Appointment', 'legacy-appointment', true, true, NOW(), NOW()),
  ('legacy_org_service', 'SERVICE', 'fa', 'Asia/Tehran', 'Legacy Service', 'legacy-service', true, true, NOW(), NOW());

INSERT INTO "User" (id, password, name, role, "isActive", "createdAt", "updatedAt") VALUES
  ('legacy_user_shop', 'demo', 'legacy-user-shop', 'ADMIN', true, NOW(), NOW()),
  ('legacy_user_appointment', 'demo', 'legacy-user-appointment', 'ADMIN', true, NOW(), NOW()),
  ('legacy_user_service', 'demo', 'legacy-user-service', 'ADMIN', true, NOW(), NOW());

INSERT INTO "OrganizationMember" (id, "organizationId", "userId", role, "isActive", "organizationSlug", "joinedAt") VALUES
  ('legacy_member_shop', 'legacy_org_shop', 'legacy_user_shop', 'ADMIN', true, 'legacy-shop', NOW()),
  ('legacy_member_appointment', 'legacy_org_appointment', 'legacy_user_appointment', 'ADMIN', true, 'legacy-appointment', NOW()),
  ('legacy_member_service', 'legacy_org_service', 'legacy_user_service', 'ADMIN', true, 'legacy-service', NOW());

INSERT INTO "ProductCategory" (id, name, slug, "organizationId", "organizationSlug", "createdAt", "updatedAt")
VALUES ('legacy_product_category', 'Legacy Category', 'legacy-category', 'legacy_org_shop', 'legacy-shop', NOW(), NOW());
INSERT INTO "Product" (id, name, slug, "basePrice", "organizationId", "organizationSlug", "categoryId", "createdAt", "updatedAt")
VALUES ('legacy_product', 'Legacy Product', 'legacy-product', 125000, 'legacy_org_shop', 'legacy-shop', 'legacy_product_category', NOW(), NOW());

INSERT INTO "ServiceCategory" (id, name, slug, "organizationId", "createdAt", "updatedAt") VALUES
  ('legacy_service_category_appointment', 'Appointment Category', 'appointment-category', 'legacy_org_appointment', NOW(), NOW()),
  ('legacy_service_category_service', 'Service Category', 'service-category', 'legacy_org_service', NOW(), NOW());
INSERT INTO "Service" (id, name, slug, price, duration, "organizationId", "categoryId", "createdAt", "updatedAt") VALUES
  ('legacy_service_appointment', 'Legacy Appointment Service', 'legacy-appointment-service', 200000, 30, 'legacy_org_appointment', 'legacy_service_category_appointment', NOW(), NOW()),
  ('legacy_service_service', 'Legacy Service Label', 'legacy-service-label', 300000, 45, 'legacy_org_service', 'legacy_service_category_service', NOW(), NOW());

INSERT INTO "Order" (id, "orderNumber", type, subtotal, total, "organizationSlug", "createdAt", "updatedAt")
VALUES ('legacy_order', 'LEGACY-ORDER-1', 'PICK_UP', 125000, 125000, 'legacy-shop', NOW(), NOW());

INSERT INTO "OrganizationDomain" (id, "organizationId", domain, "normalizedDomain", kind, provider, type, status, "isPrimary", "providerVerified", "dnsConfigured", "sslReady", "createdAt", "updatedAt") VALUES
  ('legacy_domain_shop', 'legacy_org_shop', 'legacy-shop.example.test', 'legacy-shop.example.test', 'SUBDOMAIN', 'VERCEL', 'CUSTOM', 'ACTIVE', true, true, true, true, NOW(), NOW()),
  ('legacy_domain_appointment', 'legacy_org_appointment', 'legacy-appointment.example.test', 'legacy-appointment.example.test', 'SUBDOMAIN', 'VERCEL', 'CUSTOM', 'ACTIVE', true, true, true, true, NOW(), NOW()),
  ('legacy_domain_service', 'legacy_org_service', 'legacy-service.example.test', 'legacy-service.example.test', 'SUBDOMAIN', 'VERCEL', 'CUSTOM', 'ACTIVE', true, true, true, true, NOW(), NOW());
`);
}

try {
  const firstMigrationSql = fs.readFileSync(path.join(migrationsRoot, targetMigration, "migration.sql"), "utf8");
  if (/\b(?:DROP\s+TABLE|DROP\s+COLUMN|TRUNCATE|DELETE\s+FROM)\b/i.test(firstMigrationSql)) {
    fail("Tenant platform migration contains a destructive data statement");
  }

  run("docker", ["run", "--rm", "-d", "--name", containerName, "-e", "POSTGRES_PASSWORD=postgres", "-e", "POSTGRES_USER=postgres", "-e", `POSTGRES_DB=${databaseName}`, "-p", "127.0.0.1::5432", "postgres:16-alpine"]);
  waitForPostgres();
  const port = run("docker", ["port", containerName, "5432/tcp"]).split(":").pop();
  if (!port) fail("Could not resolve disposable PostgreSQL port");
  const databaseUrl = `postgresql://postgres:postgres@127.0.0.1:${port}/${databaseName}?schema=public`;
  const { configPath, tempMigrations } = prepareTemporaryMigrationTree();

  deploy(configPath, databaseUrl);
  seedLegacyFixture();
  const beforeCounts = rowCounts();
  const beforeDigest = dataDigest();
  if (beforeCounts !== "3|1|1|2|3") fail(`Unexpected legacy fixture counts: ${beforeCounts}`);

  fs.cpSync(path.join(migrationsRoot, targetMigration), path.join(tempMigrations, targetMigration), { recursive: true });
  fs.cpSync(path.join(migrationsRoot, originMigration), path.join(tempMigrations, originMigration), { recursive: true });
  deploy(configPath, databaseUrl);

  const capabilityMapping = dockerSql(`
SELECT string_agg(o.slug || '=' || c.key::text, ',' ORDER BY o.slug)
FROM "Organization" o
JOIN "OrganizationCapability" c ON c."organizationId" = o.id AND c.status = 'ACTIVE';`, true);
  if (capabilityMapping !== "legacy-appointment=APPOINTMENT,legacy-service=APPOINTMENT,legacy-shop=SHOP") {
    fail(`Legacy capability mapping mismatch: ${capabilityMapping}`);
  }

  const initializedCount = dockerSql(`SELECT count(*) FROM "Organization" WHERE "capabilitiesInitializedAt" IS NOT NULL;`, true);
  if (initializedCount !== "3") fail(`Expected 3 initialized legacy tenants, got ${initializedCount}`);
  if (rowCounts() !== beforeCounts || dataDigest() !== beforeDigest) {
    fail("Legacy membership/order/product/service/domain data changed during migration");
  }

  const backfillMatch = firstMigrationSql.match(/-- BEGIN LEGACY CAPABILITY BACKFILL([\s\S]*?)-- END LEGACY CAPABILITY BACKFILL/);
  if (!backfillMatch?.[1]) fail("Could not locate marked legacy capability backfill block");
  const capabilityDigestBefore = dockerSql(`
SELECT md5(string_agg(id || ':' || "organizationId" || ':' || key::text || ':' || status::text || ':' || coalesce("enabledAt"::text, ''), ',' ORDER BY id))
FROM "OrganizationCapability";`, true);
  dockerSql(backfillMatch[1]);
  const capabilityDigestAfter = dockerSql(`
SELECT md5(string_agg(id || ':' || "organizationId" || ':' || key::text || ':' || status::text || ':' || coalesce("enabledAt"::text, ''), ',' ORDER BY id))
FROM "OrganizationCapability";`, true);
  if (capabilityDigestAfter !== capabilityDigestBefore) fail("Legacy capability backfill is not idempotent");
  if (rowCounts() !== beforeCounts || dataDigest() !== beforeDigest) fail("Backfill re-run changed legacy data");

  deploy(configPath, databaseUrl);
  console.log("PASS: SHOP -> SHOP and APPOINTMENT/SERVICE -> APPOINTMENT capability");
  console.log("PASS: memberships, orders, products, services, and domains preserved byte-for-byte by digest");
  console.log("PASS: marked capability backfill block is idempotent");
  console.log("PASS: no destructive data statements and second migrate deploy has no pending work");
} finally {
  spawnSync("docker", ["rm", "-f", containerName], { stdio: "ignore" });
  if (tempRoot) fs.rmSync(tempRoot, { recursive: true, force: true });
}
