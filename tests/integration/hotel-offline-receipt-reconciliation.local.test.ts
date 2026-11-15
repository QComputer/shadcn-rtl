import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm, utimes } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const enabled = process.env.HOTEL_RECEIPT_RECONCILIATION_PG_ACCEPTANCE === "1";
const execFileAsync = promisify(execFile);
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p2sAAAAASUVORK5CYII=", "base64");

function guardedConnection() {
  assert.equal(process.env.CI, "true");
  assert.equal(process.env.GITHUB_ACTIONS, "true");
  assert.notEqual(process.env.NODE_ENV, "production");
  assert.equal(process.env.DATABASE_RUNTIME_ADAPTER, "postgresql");
  assert.equal(process.env.LOCAL_PRISMA_EXPECTED_PORT, "55439");
  assert.equal(process.env.RETAIL_HERO_EXPECTED_DATABASE, "retail_hero_test");
  const url = new URL(process.env.DATABASE_URL ?? "https://missing.invalid");
  assert.equal(url.protocol, "postgresql:");
  assert.equal(url.hostname, "127.0.0.1");
  assert.equal(url.port, "55439");
  assert.equal(url.pathname, "/retail_hero_test");
  assert.equal(decodeURIComponent(url.username), "hero_test");
  assert.equal(process.env.DIRECT_URL, url.toString());
  return url;
}

test("private receipt reconciliation preserves exact DB keys and deletes only aged tenant-local orphans", { skip: !enabled, concurrency: false }, async () => {
  const url = guardedConnection();
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString(), max: 8 }), log: [] });
  const token = randomUUID().replaceAll("-", "").slice(0, 14);
  const mediaRoot = await mkdtemp(path.join(os.tmpdir(), `hotel-reconcile-${token}-`));
  const oldRoot = process.env.MEDIA_STORAGE_ROOT;
  const oldAdapter = process.env.APPLICATION_STORAGE_ADAPTER;
  const oldGate = process.env.HOTEL_RECEIPT_ORPHAN_RECONCILE_ENABLED;
  const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const organizationIds: string[] = [];
  const userIds: string[] = [];
  const propertyIds: string[] = [];
  const roomTypeIds: string[] = [];
  const ratePlanIds: string[] = [];
  const reservationIds: string[] = [];
  let referencedKey = "";
  let orphanKey = "";
  let recentKey = "";
  let foreignKey = "";
  const assetPath = (orgId: string, key: string) => path.join(mediaRoot, "hotel-payment", orgId, key);
  const ageAsset = async (orgId: string, key: string) => {
    const file = assetPath(orgId, key);
    const old = new Date(oldDate);
    await utimes(file, old, old);
    await utimes(`${file}.meta.json`, old, old);
  };
  try {
    process.env.MEDIA_STORAGE_ROOT = mediaRoot;
    process.env.APPLICATION_STORAGE_ADAPTER = "persistent-disk";
    process.env.HOTEL_RECEIPT_ORPHAN_RECONCILE_ENABLED = "1";
    const identity = await db.$queryRaw<Array<{ database: string; role: string; host: string }>>`SELECT current_database()::text AS database, current_user::text AS role, COALESCE(inet_server_addr()::text, 'local-socket') AS host`;
    assert.equal(identity.length, 1);
    const orgA = await db.organization.create({ data: { type: "SHOP", vertical: "HOTEL", name: `Receipt reconcile A ${token}`, slug: `receipt-reconcile-a-${token}` } }); organizationIds.push(orgA.id);
    const orgB = await db.organization.create({ data: { type: "SHOP", vertical: "HOTEL", name: `Receipt reconcile B ${token}`, slug: `receipt-reconcile-b-${token}` } }); organizationIds.push(orgB.id);
    const user = await db.user.create({ data: { name: `receipt-reconcile-${token}`, password: "fixture-only", role: "ADMIN", isTeamMember: true } }); userIds.push(user.id);
    const createReservation = async (org: typeof orgA, label: string) => {
      const property = await db.hotelProperty.create({ data: { organizationId: org.id, organizationSlug: org.slug, slug: `receipt-reconcile-${label}-${token}`, name: `Receipt reconcile ${label}` } }); propertyIds.push(property.id);
      const room = await db.hotelRoomType.create({ data: { organizationId: org.id, propertyId: property.id, slug: `receipt-room-${label}-${token}`, name: "Fixture room", maxAdults: 2, maxChildren: 0, maxOccupancy: 2, beds: [] } }); roomTypeIds.push(room.id);
      const rate = await db.hotelRatePlan.create({ data: { organizationId: org.id, propertyId: property.id, roomTypeId: room.id, code: `receipt-rate-${label}-${token}`, name: "Fixture rate", baseNightlyRate: BigInt(100_000) } }); ratePlanIds.push(rate.id);
      const reservation = await db.hotelReservation.create({ data: {
        id: `receipt-reconcile-${label}-${token}`, organizationId: org.id, propertyId: property.id, roomTypeId: room.id, ratePlanId: rate.id,
        reference: `receipt-reconcile-ref-${label}-${token}`, status: "PENDING_PAYMENT", checkIn: new Date("2027-12-10T00:00:00Z"), checkOut: new Date("2027-12-11T00:00:00Z"),
        currency: "TOMAN", totalAmount: BigInt(100_000), cancellationPolicyKey: "reconcile-test", cancellationPolicySnapshot: { key: "reconcile-test" }, idempotencyKey: `receipt-reconcile-res-${label}-${token}`,
      } }); reservationIds.push(reservation.id);
      return reservation;
    };
    const reservationA = await createReservation(orgA, "a");
    const reservationB = await createReservation(orgB, "b");
    const storage = await import("../../lib/hotel/offline-payments/receipt-storage.server");
    referencedKey = await storage.storeHotelPaymentReceipt(orgA.id, png, "image/png");
    orphanKey = await storage.storeHotelPaymentReceipt(orgA.id, png, "image/png");
    recentKey = await storage.storeHotelPaymentReceipt(orgA.id, png, "image/png");
    foreignKey = await storage.storeHotelPaymentReceipt(orgB.id, png, "image/png");
    await ageAsset(orgA.id, referencedKey);
    await ageAsset(orgA.id, orphanKey);
    await ageAsset(orgB.id, foreignKey);
    await db.hotelOfflinePayment.create({ data: { organizationId: orgA.id, reservationId: reservationA.id, method: "BANK_TRANSFER", status: "SUBMITTED", amountToman: BigInt(50_000), recordedByUserId: user.id, bankReference: `receipt-reference-${token}`, receiptKey: referencedKey } });
    await db.hotelOfflinePayment.create({ data: { organizationId: orgB.id, reservationId: reservationB.id, method: "BANK_TRANSFER", status: "SUBMITTED", amountToman: BigInt(50_000), recordedByUserId: user.id, bankReference: `receipt-reference-b-${token}`, receiptKey: foreignKey } });

    const args = [`--organization-id=${orgA.id}`, "--older-than-hours=24", "--limit=100"];
    const run = async (apply: boolean, breakDatabaseConnection = false) => execFileAsync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "--require=./scripts/e2e/register-server-only.cjs", "scripts/hotel/reconcile-orphaned-payment-receipts.mts", ...args, ...(apply ? ["--apply"] : [])], {
      cwd: process.cwd(), env: {
        ...process.env,
        ...(breakDatabaseConnection ? { DATABASE_URL: url.toString().replace(":55439/", ":1/"), DIRECT_URL: url.toString().replace(":55439/", ":1/") } : {}),
        HOTEL_RECEIPT_RECONCILE_EXPECTED_DATABASE: identity[0].database,
        HOTEL_RECEIPT_RECONCILE_EXPECTED_ROLE: identity[0].role,
        HOTEL_RECEIPT_RECONCILE_EXPECTED_HOST: identity[0].host,
      },
    });
    const dry = await run(false);
    assert.match(dry.stdout, /"action":"PRESERVE_REFERENCED"/);
    assert.match(dry.stdout, /"action":"DRY_RUN_ELIGIBLE"/);
    assert.equal((await readFile(assetPath(orgA.id, referencedKey))).length, png.length, "dry-run never deletes a referenced receipt");
    assert.equal((await readFile(assetPath(orgA.id, orphanKey))).length, png.length, "dry-run never deletes an orphan");

    const applied = await run(true);
    assert.match(applied.stdout, /"deletedCount":1/);
    assert.equal((await readFile(assetPath(orgA.id, referencedKey))).length, png.length, "exact canonical key including extension protects DB-referenced receipt");
    await assert.rejects(readFile(assetPath(orgA.id, orphanKey)), { code: "ENOENT" }, "only the genuinely unreferenced aged receipt is removed");
    assert.equal((await readFile(assetPath(orgA.id, recentKey))).length, png.length, "recent receipt is outside stale candidates");
    assert.equal((await readFile(assetPath(orgB.id, foreignKey))).length, png.length, "another tenant's receipt is untouched");

    await storage.storeHotelPaymentReceipt(orgA.id, png, "image/png").then(async (key) => { orphanKey = key; await ageAsset(orgA.id, key); });
    await assert.rejects(run(true, true), () => true, "database connection failure aborts reconciliation");
    assert.equal((await readFile(assetPath(orgA.id, orphanKey))).length, png.length, "ambiguous database failure fails closed without deleting files");
  } finally {
    if (organizationIds.length) {
      await db.hotelOfflinePaymentAuditEvent.deleteMany({ where: { organizationId: { in: organizationIds } } });
      await db.hotelOfflinePaymentCommandIdempotency.deleteMany({ where: { organizationId: { in: organizationIds } } });
      await db.hotelOfflinePayment.deleteMany({ where: { organizationId: { in: organizationIds } } });
      await db.hotelReservation.deleteMany({ where: { id: { in: reservationIds } } });
      await db.hotelRatePlan.deleteMany({ where: { id: { in: ratePlanIds } } });
      await db.hotelRoomType.deleteMany({ where: { id: { in: roomTypeIds } } });
      await db.hotelProperty.deleteMany({ where: { id: { in: propertyIds } } });
      await db.organization.deleteMany({ where: { id: { in: organizationIds } } });
    }
    if (userIds.length) await db.user.deleteMany({ where: { id: { in: userIds } } });
    if (oldRoot === undefined) delete process.env.MEDIA_STORAGE_ROOT; else process.env.MEDIA_STORAGE_ROOT = oldRoot;
    if (oldAdapter === undefined) delete process.env.APPLICATION_STORAGE_ADAPTER; else process.env.APPLICATION_STORAGE_ADAPTER = oldAdapter;
    if (oldGate === undefined) delete process.env.HOTEL_RECEIPT_ORPHAN_RECONCILE_ENABLED; else process.env.HOTEL_RECEIPT_ORPHAN_RECONCILE_ENABLED = oldGate;
    await db.$disconnect();
    await rm(mediaRoot, { recursive: true, force: true });
  }
});
