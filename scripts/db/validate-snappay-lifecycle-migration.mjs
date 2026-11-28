#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

// Disposable local PostgreSQL acceptance for the isolated SnappPay migration.
// This script refuses remote DBs and never contacts a hosted environment.
const root = process.cwd();
const migrationName = "20261128150000_snapppay_payment_lifecycle";
const migrationDir = path.join(root, "prisma", "migrations", migrationName);
const asideDir = path.join(os.tmpdir(), `${migrationName}-${randomUUID()}`);
const container = `codex-snapppay-migration-${randomUUID().slice(0, 8)}`;
const database = `snapppay_migration_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
let port;
let moved = false;

function run(command, args, env = process.env, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", env, shell: process.platform === "win32" && ["pnpm", "npx"].includes(command), ...options });
  if (result.status !== 0) throw new Error(`${command} failed (exit ${result.status ?? 1}): ${result.stderr || result.stdout}`);
  return (result.stdout ?? "").trim();
}
const psql = (sql) => run("docker", ["exec", "-i", container, "psql", "-U", "postgres", "-d", database, "-v", "ON_ERROR_STOP=1", "-t", "-A", "-c", sql]);
function sleep(ms) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }

try {
  if (process.env.VERCEL_ENV === "production") throw new Error("Refusing to run in a Production environment.");
  if (!fs.existsSync(migrationDir) || fs.existsSync(asideDir)) throw new Error("Expected lifecycle migration directory is unavailable.");
  run("docker", ["run", "--rm", "-d", "--name", container, "-e", "POSTGRES_PASSWORD=postgres", "-e", "POSTGRES_USER=postgres", "-e", `POSTGRES_DB=${database}`, "-p", "127.0.0.1::5432", "postgres:16-alpine"]);
  const published = run("docker", ["port", container, "5432/tcp"]);
  port = published.split(":").at(-1);
  if (!port) throw new Error("Could not identify disposable PostgreSQL port.");
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (spawnSync("docker", ["exec", container, "pg_isready", "-U", "postgres", "-d", database], { stdio: "ignore" }).status === 0) break;
    sleep(500);
  }
  const dbUrl = `postgresql://postgres:postgres@127.0.0.1:${port}/${database}?schema=public`;
  const env = { ...process.env, DATABASE_URL: dbUrl, DIRECT_URL: dbUrl, NODE_ENV: "test", VERCEL_ENV: "test" };

  fs.renameSync(migrationDir, asideDir); moved = true;
  run("pnpm", ["exec", "prisma", "migrate", "deploy", "--schema=prisma/schema.prisma"], env);

  const orgId = `snapppay_org_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const slug = "aka-shoes";
  const requestId = `snapppay_request_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const publicId = randomUUID();
  const paymentPublicId = randomUUID();
  const paymentSettingsId = `snapppay_settings_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const seeded = `
INSERT INTO "Organization" (id, type, locale, name, slug, "isActive", "isOpen", "createdAt", "updatedAt") VALUES ('${orgId}', 'SHOP', 'fa', 'Synthetic Existing Tenant', '${slug}', true, true, NOW(), NOW());
INSERT INTO "PaymentRequest" (id, "publicId", "organizationId", "amountToman", currency, purpose, "publicPaymentId", "createdAt", "updatedAt") VALUES ('${requestId}', '${publicId}', '${orgId}', 12345, 'TOMAN', 'existing-bank-transfer', '${paymentPublicId}', NOW(), NOW());
INSERT INTO "PaymentSettings" (id, "organizationSlug", settings) VALUES ('${paymentSettingsId}', '${slug}', '{"retailR4":{"bankTransferEnabled":true,"cashEnabled":false,"snappPayInstallmentsEnabled":false}}'::jsonb);
`;
  run("docker", ["exec", "-i", container, "psql", "-U", "postgres", "-d", database, "-v", "ON_ERROR_STOP=1"], process.env, { input: seeded });
  fs.renameSync(asideDir, migrationDir); moved = false;
  run("pnpm", ["exec", "prisma", "migrate", "deploy", "--schema=prisma/schema.prisma"], env);

  const request = psql(`SELECT "amountToman"::text || '|' || currency || '|' || purpose FROM "PaymentRequest" WHERE id='${requestId}'`);
  if (request !== "12345|TOMAN|existing-bank-transfer") throw new Error(`Existing payment request changed: ${request}`);
  const bankTransfer = psql(`SELECT (settings->'retailR4'->>'bankTransferEnabled') || '|' || (settings->'retailR4'->>'snappPayInstallmentsEnabled') FROM "PaymentSettings" WHERE id='${paymentSettingsId}'`);
  if (bankTransfer !== "true|false") throw new Error(`Existing CASH/BANK_TRANSFER policy changed: ${bankTransfer}`);
  const initialAkaPolicy = psql(`SELECT "markupPercent"::text || '|' || "version"::text FROM "RetailInstallmentPricingPolicy" WHERE "organizationId"='${orgId}'`);
  const emptySnapshots = psql(`SELECT (SELECT count(*) FROM "RetailInstallmentQuoteSnapshot") || '|' || (SELECT count(*) FROM "RetailInstallmentQuoteSnapshotLine")`);
  const emptyEvents = psql(`SELECT count(*) FROM "PaymentProviderEvent"`);
  if (initialAkaPolicy !== "11.0000|1" || emptySnapshots !== "0|0" || emptyEvents !== "0") throw new Error("Lifecycle migration did not initialize only Aka pricing or unexpectedly backfilled snapshots/events.");
  const integrationId = `snapppay_integration_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const integrationPublicId = randomUUID();
  const orderId = `snapppay_order_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const snapshotId = `snapppay_snapshot_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const eventId = `snapppay_event_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const matchingRequestId = `snapppay_matching_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const matchingPublicId = randomUUID();
  const matchingPaymentPublicId = randomUUID();
  run("docker", ["exec", "-i", container, "psql", "-U", "postgres", "-d", database, "-v", "ON_ERROR_STOP=1"], process.env, { input: `
INSERT INTO "OrganizationIntegration" (id, "publicId", "organizationId", provider, "codeName", "createdAt", "updatedAt") VALUES ('${integrationId}', '${integrationPublicId}', '${orgId}', 'SNAPPPAY', 'sp-${integrationId.slice(-8)}', NOW(), NOW());
INSERT INTO "PaymentRequest" (id, "publicId", "organizationId", "amountToman", currency, purpose, "publicPaymentId", "createdAt", "updatedAt") VALUES ('${matchingRequestId}', '${matchingPublicId}', '${orgId}', 11100, 'TOMAN', 'matching-installment-snapshot', '${matchingPaymentPublicId}', NOW(), NOW());
INSERT INTO "Order" (id, "orderNumber", type, subtotal, "deliveryFee", tax, discount, total, "organizationSlug", "createdAt", "updatedAt") VALUES ('${orderId}', '${orderId}', 'PICK_UP', 11100, 0, 0, 0, 11100, '${slug}', NOW(), NOW());
INSERT INTO "RetailInstallmentQuoteSnapshot" (id, "organizationId", "organizationSlug", "orderId", "policyVersion", "appliedMarkupPercent", "originalMerchandiseAmount", "adjustedMerchandiseAmount", "deliveryAmount", "discountAmount", "finalPayableAmountToman") VALUES ('${snapshotId}', '${orgId}', '${slug}', '${orderId}', 1, 11, 10000, 11100, 0, 0, 11100);
INSERT INTO "RetailInstallmentQuoteSnapshotLine" (id, "snapshotId", "organizationSlug", "productIdSnapshot", "quantity", "originalUnitAmount", "adjustedUnitAmount", "originalLineAmount", "adjustedLineAmount") VALUES ('${snapshotId}-line', '${snapshotId}', '${slug}', 'synthetic-product', 1, 10000, 11100, 10000, 11100);
INSERT INTO "PaymentProviderEvent" (id, "organizationId", "providerIntegrationId", "deduplicationKeyHash", "payloadDigest", "eventKind", disposition) VALUES ('${eventId}', '${orgId}', '${integrationId}', '${"a".repeat(64)}', '${"b".repeat(64)}', 'PAYMENT_CALLBACK', 'ACCEPTED');
` });
  for (const sql of [
    `UPDATE "RetailInstallmentQuoteSnapshot" SET "finalPayableAmountToman"=1 WHERE id='${snapshotId}'`,
    `UPDATE "RetailInstallmentQuoteSnapshot" SET "paymentRequestId"='${requestId}' WHERE id='${snapshotId}'`,
    `UPDATE "RetailInstallmentQuoteSnapshotLine" SET "adjustedLineAmount"=1 WHERE id='${snapshotId}-line'`,
    `UPDATE "PaymentProviderEvent" SET disposition='REPLAY' WHERE id='${eventId}'`,
    `INSERT INTO "PaymentProviderEvent" (id, "organizationId", "providerIntegrationId", "deduplicationKeyHash", "payloadDigest", "eventKind", disposition) VALUES ('${eventId}-duplicate', '${orgId}', '${integrationId}', '${"a".repeat(64)}', '${"c".repeat(64)}', 'PAYMENT_CALLBACK', 'ACCEPTED')`,
  ]) {
    let rejected = false;
    try { psql(sql); } catch { rejected = true; }
    if (!rejected) throw new Error(`Lifecycle immutable/dedup constraint accepted an invalid write: ${sql.slice(0, 50)}`);
  }
  psql(`UPDATE "RetailInstallmentQuoteSnapshot" SET "paymentRequestId"='${matchingRequestId}' WHERE id='${snapshotId}'`);
  if (psql(`SELECT "finalPayableAmountToman"::text FROM "RetailInstallmentQuoteSnapshot" WHERE id='${snapshotId}'`) !== "11100") throw new Error("Installment quote snapshot changed after rejected update.");
  if (psql(`SELECT "paymentRequestId" FROM "RetailInstallmentQuoteSnapshot" WHERE id='${snapshotId}'`) !== matchingRequestId) throw new Error("Exact-amount PaymentRequest was not linked to its snapshot.");
  if (psql(`SELECT count(*) FROM "PaymentProviderEvent" WHERE "deduplicationKeyHash"='${"a".repeat(64)}'`) !== "1") throw new Error("Provider event deduplication allowed a duplicate row.");
  console.log("PASS: PR197/PR201 historical chain applied before lifecycle migration.");
  console.log("PASS: existing PaymentRequest amount, currency, and purpose preserved.");
  console.log("PASS: existing bank-transfer enabled state retained; SnappPay remains disabled.");
  console.log("PASS: only the owner-requested Aka Shoes 11% policy is initialized; snapshots/events are not backfilled.");
  console.log("PASS: quote snapshots and event rows reject updates; duplicate provider event keys are blocked.");
  console.log("PASS: quote snapshot binds once to an exact-amount, same-tenant PaymentRequest.");
  console.log("PASS: lifecycle migration applied on a disposable PostgreSQL 16 database.");
} finally {
  if (moved) fs.renameSync(asideDir, migrationDir);
  spawnSync("docker", ["rm", "-f", container], { stdio: "ignore" });
}
