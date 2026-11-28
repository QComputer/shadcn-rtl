import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import {
  HotelManagementAuthorizationError,
  HotelManagementService,
} from "../../lib/hotel/management/hotel-management.service";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DATABASE_NAME = "damoon_migration_gap_rehearsal";
const TARGET_ORGANIZATION_ID = "org_schema_gap_damoon";
const OTHER_ORGANIZATION_ID = "org_schema_gap_other";
const TARGET_PROPERTY_ID = "property_schema_gap_damoon";
const OTHER_PROPERTY_ID = "property_schema_gap_other";
const ADMIN_USER_ID = "user_schema_gap_admin";
const PENDING_MIGRATIONS = [
  "20261114130000_hotel_operational_modes_and_stay_requests",
  "20261114140000_hotel_offline_payments",
  "20261114150000_hotel_reservation_payment_policy",
  "20261114160000_hotel_pending_payment_deadline",
  "20261114170000_hotel_offline_payment_audit",
  "20261120160000_hotel_reservation_occupancy",
] as const;
// Later migrations are excluded from the historical checkpoint but applied by
// the final deployment, so their ordering and compatibility are rehearsed too.
const LATER_MIGRATIONS = [
  "20261121120000_hotel_draft_accommodations",
  "20261121130000_hotel_guest_request_preferred_category",
  "20261121140000_hotel_draft_accommodation_promotion",
  "20261122110000_hotel_room_maintenance_blocks",
  "20261126170000_hotel_guest_profiles",
  "20261126180000_hotel_reception_waitlist",
  "20261127130000_hotel_guest_reservation_proof",
  "20261127150000_hotel_reservation_ownership",
  "20261128120000_hotel_guest_recovery",
  "20261128130000_hotel_damoon_data_import",
  "20261128140000_snapppay_installments",
] as const;

function assertDisposableDatabase(): string {
  const databaseUrl = process.env.DATABASE_URL;
  const directUrl = process.env.DIRECT_URL;
  assert.ok(databaseUrl && directUrl, "DATABASE_URL and DIRECT_URL must be set to disposable CI PostgreSQL");
  for (const [label, value] of [["DATABASE_URL", databaseUrl], ["DIRECT_URL", directUrl]] as const) {
    const parsed = new URL(value);
    assert.ok(["localhost", "127.0.0.1", "::1"].includes(parsed.hostname), `${label} must use loopback`);
    assert.equal(decodeURIComponent(parsed.pathname.slice(1)), DATABASE_NAME, `${label} database name must match the disposable fixture`);
  }
  return databaseUrl;
}

function runPrismaMigrateDeploy(schemaPath: string): void {
  const prismaCli = path.join(REPO_ROOT, "node_modules", "prisma", "build", "index.js");
  const result = spawnSync(process.execPath, [prismaCli, "migrate", "deploy", `--schema=${schemaPath}`], {
    cwd: path.dirname(schemaPath),
    env: { ...process.env, NODE_ENV: "test" },
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, "Prisma migrate deploy failed against the disposable rehearsal database");
}

async function makeTemporaryPreGapSchema(): Promise<{ directory: string; schemaPath: string; migrationNames: string[]; testedMigrationNames: string[] }> {
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "damoon-migration-gap-"));
  const sourcePrisma = path.join(REPO_ROOT, "prisma");
  const schemaPath = path.join(temporaryDirectory, "schema.prisma");
  const migrationsPath = path.join(temporaryDirectory, "migrations");
  await cp(path.join(sourcePrisma, "schema.prisma"), schemaPath);
  await cp(path.join(sourcePrisma, "migrations"), migrationsPath, { recursive: true });

  const migrationNames = (await readdir(migrationsPath, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const presentLaterMigrations = LATER_MIGRATIONS.filter((name) => migrationNames.includes(name));
  const testedMigrationNames = [...PENDING_MIGRATIONS, ...presentLaterMigrations];
  assert.deepEqual(migrationNames.slice(-testedMigrationNames.length), testedMigrationNames,
    "The tested checkpoint and currently available later migrations must remain in chronological order");

  for (const name of testedMigrationNames) {
    assert.ok(migrationNames.includes(name), `Expected pending migration ${name} is missing from source`);
    await rm(path.join(migrationsPath, name), { recursive: true, force: true });
  }
  return { directory: temporaryDirectory, schemaPath, migrationNames, testedMigrationNames };
}

async function seedExistingPropertyRows(db: PrismaClient): Promise<void> {
  await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `INSERT INTO "Organization" ("id", "type", "locale", "timezone", "name", "slug", "isActive", "isOpen", "isPlatformOwner", "createdAt", "updatedAt", "vertical")
       VALUES ($1, 'SHOP', 'fa', 'Asia/Tehran', 'Schema rehearsal Damoon', 'schema-gap-damoon', true, true, false, NOW(), NOW(), 'HOTEL')`,
      TARGET_ORGANIZATION_ID,
    );
    await tx.$executeRawUnsafe(
      `INSERT INTO "Organization" ("id", "type", "locale", "timezone", "name", "slug", "isActive", "isOpen", "isPlatformOwner", "createdAt", "updatedAt", "vertical")
       VALUES ($1, 'SHOP', 'fa', 'Asia/Tehran', 'Schema rehearsal other tenant', 'schema-gap-other', true, true, false, NOW(), NOW(), 'HOTEL')`,
      OTHER_ORGANIZATION_ID,
    );

    await tx.$executeRawUnsafe(
      `INSERT INTO "HotelProperty" ("id", "organizationId", "organizationSlug", "slug", "name", "description", "localizedContent", "timezone", "currency", "checkInTime", "checkOutTime", "minStayNights", "maxStayNights", "isActive", "createdAt", "updatedAt")
       VALUES ($1, $2, 'schema-gap-damoon', 'damoon-test-property', 'Damoon rehearsal property', 'preserve-description', '{"fa":"preserve-localized-content"}'::jsonb, 'Asia/Tehran', 'TOMAN', '14:00', '11:00', 1, 30, true, NOW(), NOW())`,
      TARGET_PROPERTY_ID,
      TARGET_ORGANIZATION_ID,
    );
    await tx.$executeRawUnsafe(
      `INSERT INTO "HotelProperty" ("id", "organizationId", "organizationSlug", "slug", "name", "description", "localizedContent", "timezone", "currency", "checkInTime", "checkOutTime", "minStayNights", "maxStayNights", "isActive", "createdAt", "updatedAt")
       VALUES ($1, $2, 'schema-gap-other', 'other-tenant-property', 'Other tenant property', 'other-description', '{"fa":"other-localized-content"}'::jsonb, 'Asia/Tehran', 'TOMAN', '15:30', '10:30', 2, 21, true, NOW(), NOW())`,
      OTHER_PROPERTY_ID,
      OTHER_ORGANIZATION_ID,
    );
  });
}

async function verifyAndExercisePropertyService(db: PrismaClient): Promise<void> {
  await db.user.create({
    data: {
      id: ADMIN_USER_ID,
      name: "hotel-schema-gap-rehearsal-admin",
      password: "disposable-test-value-only",
      role: "ADMIN",
    },
  });
  await db.organizationMember.create({
    data: {
      organizationId: TARGET_ORGANIZATION_ID,
      organizationSlug: "schema-gap-damoon",
      userId: ADMIN_USER_ID,
      role: "ADMIN",
      isActive: true,
    },
  });
  await db.organizationCapability.create({
    data: {
      organizationId: TARGET_ORGANIZATION_ID,
      key: "HOTEL_BOOKING",
      status: "ACTIVE",
      enabledAt: new Date(),
    },
  });

  const fields = {
    id: true,
    name: true,
    description: true,
    localizedContent: true,
    timezone: true,
    currency: true,
    checkInTime: true,
    checkOutTime: true,
    minStayNights: true,
    maxStayNights: true,
    operationalMode: true,
    manualConfirmationPolicy: true,
    allowedOfflinePaymentMethods: true,
    minimumVerifiedDepositAmount: true,
    pendingPaymentMinutes: true,
    isActive: true,
  } as const;
  const before = await db.hotelProperty.findUniqueOrThrow({ where: { id: TARGET_PROPERTY_ID }, select: fields });
  const otherBefore = await db.hotelProperty.findUniqueOrThrow({ where: { id: OTHER_PROPERTY_ID }, select: fields });
  assert.equal(before.checkInTime, "14:00");
  assert.equal(before.checkOutTime, "11:00");

  const management = new HotelManagementService(db);
  await management.updateProperty(
    { userId: ADMIN_USER_ID, role: "ADMIN", organizationId: TARGET_ORGANIZATION_ID },
    { organizationId: TARGET_ORGANIZATION_ID },
    TARGET_PROPERTY_ID,
    { checkOutTime: "12:00" },
  );

  const after = await db.hotelProperty.findUniqueOrThrow({ where: { id: TARGET_PROPERTY_ID }, select: fields });
  assert.deepEqual(after, { ...before, checkOutTime: "12:00" });
  assert.equal(after.operationalMode, "DISABLED");
  assert.equal(after.manualConfirmationPolicy, "DISABLED");
  assert.deepEqual(after.allowedOfflinePaymentMethods, []);
  assert.equal(after.minimumVerifiedDepositAmount, null);
  assert.equal(after.pendingPaymentMinutes, 15);
  const otherAfter = await db.hotelProperty.findUniqueOrThrow({ where: { id: OTHER_PROPERTY_ID }, select: fields });
  assert.deepEqual(otherAfter, otherBefore, "A different tenant's property must remain unchanged");

  await assert.rejects(
    management.updateProperty(
      { userId: ADMIN_USER_ID, role: "ADMIN", organizationId: TARGET_ORGANIZATION_ID },
      { organizationId: TARGET_ORGANIZATION_ID },
      OTHER_PROPERTY_ID,
      { checkOutTime: "12:00" },
    ),
    HotelManagementAuthorizationError,
  );
  const otherAfterDeniedAttempt = await db.hotelProperty.findUniqueOrThrow({ where: { id: OTHER_PROPERTY_ID }, select: fields });
  assert.deepEqual(otherAfterDeniedAttempt, otherBefore, "Cross-tenant denial must not mutate the foreign property");
}

async function main(): Promise<void> {
  assertDisposableDatabase();
  const temporary = await makeTemporaryPreGapSchema();
  let db: PrismaClient | undefined;
  try {
    console.log("Rehearsing the exact pre-20261114130000 migration checkpoint on disposable PostgreSQL only.");
    runPrismaMigrateDeploy(temporary.schemaPath);

    db = new PrismaClient();
    const beforeGapCount = await db.$queryRawUnsafe<Array<{ count: number }>>(
      `SELECT count(DISTINCT migration_name)::int AS count FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`,
    );
    assert.equal(beforeGapCount[0]?.count, temporary.migrationNames.length - temporary.testedMigrationNames.length);
    await seedExistingPropertyRows(db);
    await db.$disconnect();
    db = undefined;

    console.log("Applying the six pending Hotel migrations with standard prisma migrate deploy.");
    runPrismaMigrateDeploy(path.join(REPO_ROOT, "prisma", "schema.prisma"));

    db = new PrismaClient();
    const finalMigrations = await db.$queryRawUnsafe<Array<{ migration_name: string; finished: boolean; rolledBack: boolean }>>(
      `SELECT migration_name, finished_at IS NOT NULL AS finished, rolled_back_at IS NOT NULL AS "rolledBack" FROM "_prisma_migrations"`,
    );
    const completed = new Set(finalMigrations.filter((row) => row.finished && !row.rolledBack).map((row) => row.migration_name));
    for (const name of temporary.testedMigrationNames) assert.ok(completed.has(name), `${name} was not recorded as completed`);
    assert.equal(completed.size, temporary.migrationNames.length, "Every source migration must be completed exactly once in the fresh rehearsal ledger");

    const targetAfterMigrations = await db.hotelProperty.findUniqueOrThrow({ where: { id: TARGET_PROPERTY_ID } });
    const otherAfterMigrations = await db.hotelProperty.findUniqueOrThrow({ where: { id: OTHER_PROPERTY_ID } });
    assert.equal(targetAfterMigrations.checkInTime, "14:00");
    assert.equal(targetAfterMigrations.checkOutTime, "11:00", "The schema migrations must not apply the owner setting implicitly");
    assert.equal(targetAfterMigrations.operationalMode, "DISABLED");
    assert.equal(targetAfterMigrations.manualConfirmationPolicy, "DISABLED");
    assert.deepEqual(targetAfterMigrations.allowedOfflinePaymentMethods, []);
    assert.equal(targetAfterMigrations.minimumVerifiedDepositAmount, null);
    assert.equal(targetAfterMigrations.pendingPaymentMinutes, 15);
    assert.equal(otherAfterMigrations.checkInTime, "15:30");
    assert.equal(otherAfterMigrations.checkOutTime, "10:30");

    await verifyAndExercisePropertyService(db);
    console.log("PASS: six pending migrations apply to an existing-data checkpoint without losing tenant/property settings.");
    console.log("PASS: the authorized HotelManagementService changes only the target property's checkOutTime to 12:00.");
    console.log("PASS: cross-tenant property update is denied without changing the foreign property.");
  } finally {
    if (db) await db.$disconnect();
    await rm(temporary.directory, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
