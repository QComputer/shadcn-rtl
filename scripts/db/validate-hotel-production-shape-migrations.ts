import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DATABASE_NAME = "damoon_migration_gap_rehearsal";
const SHAPE_SCHEMA = "damoon_production_shape_rehearsal";
const BASELINE_MIGRATION = "20261114120000_production_shape_fixture_baseline";
const MIGRATIONS = [
  "20261114130000_hotel_operational_modes_and_stay_requests",
  "20261114140000_hotel_offline_payments",
  "20261114150000_hotel_reservation_payment_policy",
  "20261114160000_hotel_pending_payment_deadline",
  "20261114170000_hotel_offline_payment_audit",
] as const;

function loopbackDatabaseUrl(): URL {
  const raw = process.env.DATABASE_URL;
  assert.ok(raw, "DATABASE_URL must target the disposable PostgreSQL service");
  const url = new URL(raw);
  assert.ok(["localhost", "127.0.0.1", "::1"].includes(url.hostname), "DATABASE_URL must use loopback");
  assert.equal(decodeURIComponent(url.pathname.slice(1)), DATABASE_NAME, "Database name must match the disposable CI database");
  return url;
}

function runPrisma(schemaPath: string, scopedUrl: string, args: string[]): void {
  const prismaCli = path.join(REPO_ROOT, "node_modules", "prisma", "build", "index.js");
  const result = spawnSync(process.execPath, [prismaCli, ...args, `--schema=${schemaPath}`], {
    cwd: path.dirname(schemaPath),
    env: { ...process.env, DATABASE_URL: scopedUrl, DIRECT_URL: scopedUrl, NODE_ENV: "test" },
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `Prisma ${args.join(" ")} failed against the disposable Production-shape schema`);
}

async function applyProductionShapeFixture(db: PrismaClient): Promise<void> {
  // Names, pre-gap columns, composite tenant keys and legacy values were checked
  // against a read-only Runflare catalog snapshot. This is an affected-table
  // shape fixture, not a copy of Production data or its divergent full lineage.
  const statements = [
    `CREATE TABLE "Organization" ("id" TEXT PRIMARY KEY)`,
    `CREATE TABLE "HotelProperty" (
      "id" TEXT NOT NULL PRIMARY KEY, "organizationId" TEXT NOT NULL, "organizationSlug" TEXT NOT NULL,
      "slug" TEXT NOT NULL, "name" TEXT NOT NULL, "description" TEXT, "localizedContent" JSONB,
      "timezone" TEXT NOT NULL DEFAULT 'Asia/Tehran', "currency" TEXT NOT NULL DEFAULT 'TOMAN',
      "checkInTime" TEXT NOT NULL DEFAULT '14:00', "checkOutTime" TEXT NOT NULL DEFAULT '11:00',
      "minStayNights" INTEGER NOT NULL DEFAULT 1, "maxStayNights" INTEGER NOT NULL DEFAULT 30,
      "addressLine1" TEXT, "city" TEXT, "latitude" DECIMAL(9,6), "longitude" DECIMAL(9,6),
      "isActive" BOOLEAN NOT NULL DEFAULT TRUE, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "deletedAt" TIMESTAMP(3),
      UNIQUE ("organizationId", "slug"), UNIQUE ("id", "organizationId")
    )`,
    `CREATE TABLE "HotelRoomType" (
      "id" TEXT NOT NULL PRIMARY KEY, "propertyId" TEXT NOT NULL, UNIQUE ("id", "propertyId")
    )`,
    `CREATE TABLE "HotelBookingHold" ("id" TEXT NOT NULL PRIMARY KEY)`,
    `CREATE TABLE "HotelReservation" (
      "id" TEXT NOT NULL PRIMARY KEY, "organizationId" TEXT NOT NULL, "propertyId" TEXT NOT NULL,
      "roomTypeId" TEXT NOT NULL, "ratePlanId" TEXT NOT NULL, "reference" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'PENDING_PAYMENT', "checkIn" DATE NOT NULL, "checkOut" DATE NOT NULL,
      "currency" TEXT NOT NULL DEFAULT 'TOMAN', "totalAmount" BIGINT NOT NULL,
      "paidAmount" BIGINT NOT NULL DEFAULT 0, "refundedAmount" BIGINT NOT NULL DEFAULT 0,
      "cancellationPolicyKey" TEXT NOT NULL, "cancellationPolicySnapshot" JSONB NOT NULL,
      "guestCustomerId" TEXT, "holdId" TEXT UNIQUE, "idempotencyKey" TEXT NOT NULL,
      "confirmedAt" TIMESTAMP(3), "checkedInAt" TIMESTAMP(3), "checkedOutAt" TIMESTAMP(3),
      "cancelledAt" TIMESTAMP(3), "cancellationReason" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "version" INTEGER NOT NULL DEFAULT 0,
      UNIQUE ("organizationId", "reference"), UNIQUE ("organizationId", "idempotencyKey"),
      UNIQUE ("id", "organizationId"), CHECK ("checkOut" > "checkIn"),
      CHECK ("totalAmount" > 0 AND "paidAmount" >= 0 AND "refundedAmount" >= 0),
      FOREIGN KEY ("propertyId", "organizationId") REFERENCES "HotelProperty"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
      FOREIGN KEY ("roomTypeId", "propertyId") REFERENCES "HotelRoomType"("id", "propertyId") ON DELETE RESTRICT ON UPDATE CASCADE,
      FOREIGN KEY ("holdId") REFERENCES "HotelBookingHold"("id") ON DELETE SET NULL ON UPDATE CASCADE
    )`,
  ];
  for (const statement of statements) await db.$executeRawUnsafe(statement);

  await db.$executeRawUnsafe(`INSERT INTO "Organization" ("id") VALUES ('shape-damoon'), ('shape-other')`);
  await db.$executeRawUnsafe(
    `INSERT INTO "HotelProperty" ("id", "organizationId", "organizationSlug", "slug", "name", "description", "checkInTime", "checkOutTime")
     VALUES ('shape-property-a', 'shape-damoon', 'damoon-hotel', 'shape-a', 'Damoon existing property', 'preserve-a', '14:00', '11:00'),
            ('shape-property-b', 'shape-other', 'other-hotel', 'shape-b', 'Other existing property', 'preserve-b', '15:00', '10:00')`,
  );
  await db.$executeRawUnsafe(
    `INSERT INTO "HotelRoomType" ("id", "propertyId") VALUES ('shape-room-a', 'shape-property-a'), ('shape-room-b', 'shape-property-b')`,
  );
  await db.$executeRawUnsafe(
    `INSERT INTO "HotelReservation" ("id", "organizationId", "propertyId", "roomTypeId", "ratePlanId", "reference", "status", "checkIn", "checkOut", "totalAmount", "cancellationPolicyKey", "cancellationPolicySnapshot", "idempotencyKey")
     VALUES ('shape-reservation-a', 'shape-damoon', 'shape-property-a', 'shape-room-a', 'legacy-plan', 'legacy-reference-a', 'CONFIRMED', DATE '2026-12-01', DATE '2026-12-03', 2400000, 'legacy-policy', '{"source":"existing"}'::jsonb, 'legacy-key-a'),
            ('shape-reservation-b', 'shape-other', 'shape-property-b', 'shape-room-b', 'legacy-plan-b', 'legacy-reference-b', 'PENDING_PAYMENT', DATE '2026-12-01', DATE '2026-12-02', 900000, 'legacy-policy-b', '{"source":"existing"}'::jsonb, 'legacy-key-b')`,
  );
}

async function assertForeignKeyRejects(run: () => Promise<unknown>, label: string): Promise<void> {
  try {
    await run();
  } catch (error) {
    assert.match(String(error), /foreign key|P2003|constraint/i, `${label} must fail at the tenant-scoped FK`);
    return;
  }
  assert.fail(`${label} unexpectedly crossed the tenant boundary`);
}

async function main(): Promise<void> {
  const baseUrl = loopbackDatabaseUrl();
  const scopedUrl = new URL(baseUrl);
  scopedUrl.searchParams.set("schema", SHAPE_SCHEMA);
  const url = scopedUrl.toString();
  const publicDb = new PrismaClient({ datasourceUrl: baseUrl.toString() });
  let db: PrismaClient | undefined;
  let tempRoot: string | undefined;
  let schemaCreated = false;
  try {
    const identity = await publicDb.$queryRawUnsafe<Array<{ database: string }>>(
      `SELECT current_database() AS database`,
    );
    assert.equal(identity[0]?.database, DATABASE_NAME);
    const existing = await publicDb.$queryRawUnsafe<Array<{ name: string | null }>>(
      `SELECT schema_name AS name FROM information_schema.schemata WHERE schema_name = $1`, SHAPE_SCHEMA,
    );
    assert.equal(existing.length, 0, "The isolated shape schema must not already exist");
    await publicDb.$executeRawUnsafe(`CREATE SCHEMA "${SHAPE_SCHEMA}"`);
    schemaCreated = true;

    db = new PrismaClient({ datasourceUrl: url });
    await applyProductionShapeFixture(db);
    const propertyBefore = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT "id", "organizationId", "name", "description", "checkInTime", "checkOutTime", "minStayNights", "maxStayNights", "isActive" FROM "HotelProperty" ORDER BY "id"`,
    );
    const reservationBefore = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT "id", "organizationId", "propertyId", "roomTypeId", "reference", "status", "checkIn", "checkOut", "currency", "totalAmount", "paidAmount", "refundedAmount", "cancellationPolicyKey", "cancellationPolicySnapshot", "idempotencyKey", "version" FROM "HotelReservation" ORDER BY "id"`,
    );

    tempRoot = await mkdtemp(path.join(os.tmpdir(), "damoon-production-shape-"));
    const prismaDir = path.join(tempRoot, "prisma");
    const migrationsDir = path.join(prismaDir, "migrations");
    await mkdir(migrationsDir, { recursive: true });
    await copyFile(path.join(REPO_ROOT, "prisma", "schema.prisma"), path.join(prismaDir, "schema.prisma"));
    await copyFile(path.join(REPO_ROOT, "prisma", "migrations", "migration_lock.toml"), path.join(migrationsDir, "migration_lock.toml"));
    for (const name of MIGRATIONS) {
      const source = path.join(REPO_ROOT, "prisma", "migrations", name);
      const destination = path.join(migrationsDir, name);
      await mkdir(destination);
      await copyFile(path.join(source, "migration.sql"), path.join(destination, "migration.sql"));
    }
    const baselineDirectory = path.join(migrationsDir, BASELINE_MIGRATION);
    await mkdir(baselineDirectory);
    await writeFile(path.join(baselineDirectory, "migration.sql"), "-- Test-only marker for the pre-gap Production table-shape fixture.\n");
    const actualMigrationDirectories = (await readdir(migrationsDir, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
    assert.deepEqual(actualMigrationDirectories, [BASELINE_MIGRATION, ...MIGRATIONS], "Only the test-only baseline marker and five reviewed migrations may run in this shape rehearsal");

    const temporarySchemaPath = path.join(prismaDir, "schema.prisma");
    console.log("Marking the populated disposable Production-shape schema at the pre-gap checkpoint, then applying exactly the five pending Hotel migrations.");
    runPrisma(temporarySchemaPath, url, ["migrate", "resolve", "--applied", BASELINE_MIGRATION]);
    runPrisma(temporarySchemaPath, url, ["migrate", "deploy"]);

    db = new PrismaClient({ datasourceUrl: url });
    const completed = await db.$queryRawUnsafe<Array<{ migration_name: string; finished: boolean; rolledBack: boolean }>>(
      `SELECT migration_name, finished_at IS NOT NULL AS finished, rolled_back_at IS NOT NULL AS "rolledBack" FROM "_prisma_migrations" ORDER BY migration_name`,
    );
    assert.deepEqual(completed.map((row) => row.migration_name), [BASELINE_MIGRATION, ...MIGRATIONS]);
    assert.ok(completed.every((row) => row.finished && !row.rolledBack));

    const propertyAfter = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT "id", "organizationId", "name", "description", "checkInTime", "checkOutTime", "minStayNights", "maxStayNights", "isActive" FROM "HotelProperty" ORDER BY "id"`,
    );
    const reservationAfter = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT "id", "organizationId", "propertyId", "roomTypeId", "reference", "status", "checkIn", "checkOut", "currency", "totalAmount", "paidAmount", "refundedAmount", "cancellationPolicyKey", "cancellationPolicySnapshot", "idempotencyKey", "version", "paymentMethod" FROM "HotelReservation" ORDER BY "id"`,
    );
    assert.deepEqual(propertyAfter, propertyBefore, "Existing property configuration and checkout values must be unchanged");
    assert.deepEqual(reservationAfter.map(({ paymentMethod: _method, ...row }) => row), reservationBefore, "Existing booking records must remain unchanged");
    assert.ok(reservationAfter.every((row) => row.paymentMethod === null), "The additive paymentMethod column must default NULL for legacy bookings");

    const policyDefaults = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT "id", "operationalMode"::text AS "operationalMode", "manualConfirmationPolicy"::text AS "manualConfirmationPolicy", cardinality("allowedOfflinePaymentMethods") AS "methodCount", "minimumVerifiedDepositAmount", "pendingPaymentMinutes" FROM "HotelProperty" ORDER BY "id"`,
    );
    assert.equal(policyDefaults.length, 2);
    assert.ok(policyDefaults.every((row) => row.operationalMode === "DISABLED" && row.manualConfirmationPolicy === "DISABLED" && row.methodCount === 0 && row.minimumVerifiedDepositAmount === null && row.pendingPaymentMinutes === 15));

    await db.$executeRawUnsafe(
      `INSERT INTO "HotelStayQuote" ("id", "organizationId", "propertyId", "userId", "snapshot", "expiresAt") VALUES ('quote-a', 'shape-damoon', 'shape-property-a', 'test-user-a', '{}'::jsonb, NOW() + INTERVAL '1 hour')`,
    );
    await assertForeignKeyRejects(
      () => db!.$executeRawUnsafe(`INSERT INTO "HotelStayQuote" ("id", "organizationId", "propertyId", "userId", "snapshot", "expiresAt") VALUES ('quote-cross', 'shape-damoon', 'shape-property-b', 'test-user-a', '{}'::jsonb, NOW() + INTERVAL '1 hour')`),
      "A quote referencing another tenant's property",
    );
    await assertForeignKeyRejects(
      () => db!.$executeRawUnsafe(`INSERT INTO "HotelOfflinePayment" ("id", "organizationId", "reservationId", "method", "status", "amountToman", "recordedByUserId") VALUES ('payment-cross', 'shape-other', 'shape-reservation-a', 'BANK_TRANSFER', 'SUBMITTED', 100, 'test-user-b')`),
      "A payment referencing another tenant's reservation",
    );
    console.log("PASS: exactly five ordered migrations apply to the disposable Production-shaped affected tables.");
    console.log("PASS: legacy property and reservation data persist; existing bookings receive only a NULL paymentMethod; public/manual modes stay DISABLED.");
    console.log("PASS: same-tenant quote succeeds; cross-tenant property quote and reservation payment are rejected by composite foreign keys.");
  } finally {
    if (db) await db.$disconnect();
    if (schemaCreated) await publicDb.$executeRawUnsafe(`DROP SCHEMA "${SHAPE_SCHEMA}" CASCADE`);
    await publicDb.$disconnect();
    if (tempRoot) await rm(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
