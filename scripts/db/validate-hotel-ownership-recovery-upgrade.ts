import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { validateLineage } from "./hotel-migration-lineage.mjs";
import { validateProofRehearsalEnvironment } from "./hotel-proof-rehearsal-guard.mjs";

const root = process.cwd();
const source = path.join(root, "prisma");
const base = validateProofRehearsalEnvironment(process.env);
const database = "damoon_recovery_upgrade_fixture";
const scoped = new URL(base); scoped.pathname = `/${database}`; scoped.searchParams.delete("schema");
const db = new PrismaClient({ datasourceUrl: scoped.toString() });
const admin = new PrismaClient({ datasourceUrl: base.toString() });
let temp: string | undefined, created = false;
let createdOid: number | undefined;
function deploy(schemaPath: string) {
  const result = spawnSync(process.execPath, [path.join(root, "node_modules/prisma/build/index.js"), "migrate", "deploy", `--schema=${schemaPath}`], { cwd: path.dirname(schemaPath), env: { ...process.env, DATABASE_URL: scoped.toString(), DIRECT_URL: scoped.toString() }, encoding: "utf8" });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `migration deploy failed: ${result.stderr}`);
  return result.stdout;
}
async function ledger(expected: string[]) {
  const rows = await db.$queryRawUnsafe<Array<{ migration_name: string; finished: boolean; rolledback: boolean }>>(`SELECT migration_name, finished_at IS NOT NULL AS finished, rolled_back_at IS NOT NULL AS rolledback FROM "_prisma_migrations" ORDER BY migration_name`);
  assert.deepEqual(rows.map(r => r.migration_name), expected);
  assert.ok(rows.every(r => r.finished && !r.rolledback));
}
async function main() {
  const names = (await readdir(path.join(source, "migrations"), { withFileTypes: true })).filter(e => e.isDirectory()).map(e => e.name).sort();
  const lineage = validateLineage(names);
  const proofMigration = lineage.afterPr192[0]!;
  const proofLineage = [...lineage.pr192, proofMigration];
  const ownershipMigration = "20261127150000_hotel_reservation_ownership";
  assert.equal(lineage.afterPr192[1], ownershipMigration);
  const ownershipLineage = [...proofLineage, ownershipMigration];
  const identity = await admin.$queryRawUnsafe<Array<{ db: string; role: string; port: number }>>(`SELECT current_database()::text AS db, current_user::text AS role, inet_server_port() AS port`);
  assert.deepEqual(identity, [{ db: "damoon_migration_gap_rehearsal", role: "hotel_gap_test", port: 5432 }]);
  const existing = await admin.$queryRawUnsafe<Array<{ count: bigint }>>(`SELECT count(*)::bigint AS count FROM pg_database WHERE datname = $1`, database);
  assert.equal(existing[0]?.count, BigInt(0));
  try {
    await admin.$executeRawUnsafe(`CREATE DATABASE "${database}"`); created = true;
    const owned = await admin.$queryRawUnsafe<Array<{ oid: number; owner: string }>>(`SELECT oid::int AS oid, pg_get_userbyid(datdba)::text AS owner FROM pg_database WHERE datname = $1`, database);
    assert.equal(owned.length, 1); assert.equal(owned[0]?.owner, "hotel_gap_test"); createdOid = owned[0]?.oid;
    temp = await mkdtemp(path.join(os.tmpdir(), "damoon-recovery-upgrade-"));
    await cp(source, temp, { recursive: true });
    for (const n of lineage.afterPr192.slice(2)) await rm(path.join(temp, "migrations", n), { recursive: true });
    deploy(path.join(temp, "schema.prisma"));
    await ledger(ownershipLineage);
    for (const suffix of ["a", "b"]) {
      const org = `proof-org-${suffix}`, property = `proof-property-${suffix}`, room = `proof-room-${suffix}`, reservation = `proof-reservation-${suffix}`, slug = `proof-org-${suffix}`;
      await db.$executeRawUnsafe(`INSERT INTO "Organization" ("id", "name", "slug", "type", "vertical", "updatedAt") VALUES ($1, $2, $3, 'SHOP', 'HOTEL', NOW())`, org, `Synthetic ${suffix}`, slug);
      await db.$executeRawUnsafe(`INSERT INTO "HotelProperty" ("id", "organizationId", "organizationSlug", "slug", "name", "updatedAt") VALUES ($1,$2,$3,$4,$5,NOW())`, property, org, slug, `property-${suffix}`, `Property ${suffix}`);
      await db.$executeRawUnsafe(`INSERT INTO "HotelRoomType" ("id", "organizationId", "propertyId", "slug", "name", "maxAdults", "maxChildren", "maxOccupancy", "beds", "updatedAt") VALUES ($1,$2,$3,$4,'Room',2,0,2,'[]'::jsonb,NOW())`, room, org, property, `room-${suffix}`);
      await db.$executeRawUnsafe(`INSERT INTO "HotelReservation" ("id", "organizationId", "propertyId", "roomTypeId", "ratePlanId", "reference", "checkIn", "checkOut", "totalAmount", "cancellationPolicyKey", "cancellationPolicySnapshot", "idempotencyKey", "updatedAt") VALUES ($1,$2,$3,$4,'synthetic-plan',$5,DATE '2027-10-10',DATE '2027-10-12',200,'fixture','{"policy":"preserve"}'::jsonb,$6,NOW())`, reservation, org, property, room, `ref-${suffix}`, `key-${suffix}`);
    }
    const snapshot = async () => ({
      organizations: await db.$queryRawUnsafe(`SELECT "id", "name", "slug", "type", "vertical", "createdAt", "updatedAt" FROM "Organization" ORDER BY "id"`),
      properties: await db.$queryRawUnsafe(`SELECT "id", "organizationId", "organizationSlug", "slug", "name", "description", "checkInTime", "checkOutTime", "createdAt", "updatedAt" FROM "HotelProperty" ORDER BY "id"`),
      reservations: await db.$queryRawUnsafe(`SELECT "id", "organizationId", "propertyId", "roomTypeId", "ratePlanId", "reference", "status", "checkIn", "checkOut", "totalAmount", "paidAmount", "refundedAmount", "cancellationPolicyKey", "cancellationPolicySnapshot", "idempotencyKey", "createdAt", "updatedAt", "version" FROM "HotelReservation" ORDER BY "id"`),
    });
    await db.$executeRawUnsafe(`INSERT INTO "HotelGuestReservationProof" ("reservationId", "organizationId", "propertyId", "origin", "browserDigest", "contactDigest", "expiresAt") VALUES ('proof-reservation-a','proof-org-a','proof-property-a','https://fixture.invalid',$1,$2,NOW() + INTERVAL '1 day')`, "a".repeat(64), "b".repeat(64));
    await db.$executeRawUnsafe(`INSERT INTO "User" ("id", "name", "password", "role", "updatedAt") VALUES ('proof-owner', 'proof-owner', 'fixture', 'CUSTOMER', NOW())`);
    await db.$executeRawUnsafe(`INSERT INTO "HotelReservationOwnership" ("reservationId","organizationId","propertyId","userId") VALUES ('proof-reservation-a','proof-org-a','proof-property-a','proof-owner')`);
    const before = await snapshot();
    const proofsBefore = await db.$queryRawUnsafe(`SELECT * FROM "HotelGuestReservationProof" ORDER BY "reservationId"`);
    const ownershipBefore = await db.$queryRawUnsafe(`SELECT * FROM "HotelReservationOwnership" ORDER BY "reservationId"`);
    const recoveryMigration = "20261128120000_hotel_guest_recovery";
    assert.equal(lineage.afterPr192[2], recoveryMigration);
    await cp(path.join(source, "migrations", recoveryMigration), path.join(temp, "migrations", recoveryMigration), { recursive: true });
    deploy(path.join(temp, "schema.prisma"));
    await ledger([...ownershipLineage, recoveryMigration]);
    assert.deepEqual(await snapshot(), before);
    assert.deepEqual(await db.$queryRawUnsafe(`SELECT * FROM "HotelGuestReservationProof" ORDER BY "reservationId"`), proofsBefore);
    assert.deepEqual(await db.$queryRawUnsafe(`SELECT * FROM "HotelReservationOwnership" ORDER BY "reservationId"`), ownershipBefore);
    const rows = await db.$queryRawUnsafe<Array<{count:bigint}>>(`SELECT count(*)::bigint AS count FROM "HotelGuestRecoveryCredential"`);
    assert.equal(rows[0]?.count, BigInt(0), "no historical backfill");
    await assert.rejects(() => db.$executeRawUnsafe(`INSERT INTO "HotelGuestRecoveryCredential" ("reservationId","organizationId","propertyId","origin","secretDigest","contactDigest","createdAt","expiresAt") VALUES ('proof-reservation-a','proof-org-b','proof-property-b','https://fixture.invalid',$1,$2,NOW(),NOW()+INTERVAL '1 day')`, "a".repeat(64), "b".repeat(64)), /foreign key|P2003|P2010/i);
    assert.match(deploy(path.join(temp, "schema.prisma")), /No pending migrations to apply/i);
    await ledger([...ownershipLineage, recoveryMigration]);
    assert.deepEqual(await snapshot(), before);
    assert.deepEqual(await db.$queryRawUnsafe(`SELECT * FROM "HotelReservationOwnership" ORDER BY "reservationId"`), ownershipBefore);
    console.log("PASS: PR194 upgraded to recovery; existing data and ownership preserved; no backfill; tenant FK and no-op rerun verified.");

  } finally {
    await db.$disconnect();
    if (created && createdOid !== undefined) {
      const owned = await admin.$queryRawUnsafe<Array<{ oid: number; owner: string }>>(`SELECT oid::int AS oid, pg_get_userbyid(datdba)::text AS owner FROM pg_database WHERE datname = $1`, database);
      assert.deepEqual(owned, [{ oid: createdOid, owner: "hotel_gap_test" }], "refusing cleanup: created database identity changed");
      await admin.$executeRawUnsafe(`DROP DATABASE "${database}"`);
    }
    await admin.$disconnect();
    if (temp) await rm(temp, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
