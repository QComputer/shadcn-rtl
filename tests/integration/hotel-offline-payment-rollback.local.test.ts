import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { createHotelOfflinePaymentService, type OfflinePaymentActor } from "../../lib/hotel/offline-payments/service";
import { createPrismaHotelOfflinePaymentRepository } from "../../lib/hotel/offline-payments/prisma-repository";

const enabled = process.env.HOTEL_OFFLINE_PAYMENT_PG_ACCEPTANCE === "1";
const NOW = new Date("2027-11-20T12:00:00.000Z");

function guardedConnection() {
  assert.equal(process.env.CI, "true", "rollback faults require an ephemeral CI service");
  assert.equal(process.env.GITHUB_ACTIONS, "true", "rollback faults are restricted to GitHub-hosted ephemeral services");
  assert.notEqual(process.env.NODE_ENV, "production");
  assert.notEqual(process.env.VERCEL_ENV, "production");
  assert.ok(!process.env.VERCEL, "hosted execution is forbidden");
  assert.equal(process.env.DATABASE_RUNTIME_ADAPTER, "postgresql");
  assert.equal(process.env.LOCAL_PRISMA_EXPECTED_PORT, "55439");
  assert.equal(process.env.RETAIL_HERO_EXPECTED_DATABASE, "retail_hero_test");
  const url = new URL(process.env.DATABASE_URL ?? "https://missing.invalid");
  assert.ok(["postgres:", "postgresql:"].includes(url.protocol));
  assert.equal(url.hostname, "127.0.0.1");
  assert.equal(url.port, "55439");
  assert.equal(url.pathname, "/retail_hero_test");
  assert.equal(decodeURIComponent(url.username), "hero_test");
  assert.equal(decodeURIComponent(url.password), "local_admin_fixture_only");
  assert.equal(url.search, "");
  assert.equal(url.hash, "");
  assert.equal(process.env.DIRECT_URL, url.toString());
  return url;
}

test("offline payment PostgreSQL mutations roll back ledger, balance, audit and idempotency together", {
  skip: !enabled,
  concurrency: false,
}, async () => {
  const connection = guardedConnection();
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: connection.toString(), max: 8 }), log: [] });
  const token = randomUUID().replaceAll("-", "").slice(0, 14);
  const triggerName = `offline_rollback_${token}`;
  const functionName = `offline_rollback_fn_${token}`;
  let orgId: string | undefined;
  let userId: string | undefined;
  let guestUserId: string | undefined;
  let guestId: string | undefined;
  let propertyId: string | undefined;
  let roomTypeId: string | undefined;
  let ratePlanId: string | undefined;
  let reservationId: string | undefined;
  let triggerInstalled = false;
  const service = createHotelOfflinePaymentService({ repository: createPrismaHotelOfflinePaymentRepository(db), now: () => NOW });

  const installFailure = async (eventType: "CASH_RECORDED" | "BANK_TRANSFER_VERIFIED" | "BANK_TRANSFER_REJECTED" | "CASH_REVERSED") => {
    assert.ok(orgId);
    // The generated names and values are constrained to alphanumerics/hex.
    await db.$executeRawUnsafe(`CREATE FUNCTION public."${functionName}"() RETURNS trigger LANGUAGE plpgsql AS $body$ BEGIN IF NEW."organizationId" = '${orgId}' AND NEW."eventType"::text = '${eventType}' THEN RAISE EXCEPTION 'injected offline payment rollback failure' USING ERRCODE = 'P0001'; END IF; RETURN NEW; END $body$`);
    triggerInstalled = true;
    await db.$executeRawUnsafe(`CREATE TRIGGER "${triggerName}" BEFORE INSERT ON public."HotelOfflinePaymentAuditEvent" FOR EACH ROW EXECUTE FUNCTION public."${functionName}"()`);
  };
  const removeFailure = async () => {
    if (!triggerInstalled) return;
    await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${triggerName}" ON public."HotelOfflinePaymentAuditEvent"`);
    await db.$executeRawUnsafe(`DROP FUNCTION IF EXISTS public."${functionName}"()`);
    triggerInstalled = false;
  };
  const assertFailedAttemptWasAtomic = async (key: string, expectedStatus: string | null, expectedLedgerCount: number, expectedBalance: bigint) => {
    const ledger = await db.hotelOfflinePayment.findMany({ where: { organizationId: orgId, reservationId } });
    assert.equal(ledger.length, expectedLedgerCount);
    if (expectedStatus) assert.ok(ledger.some((row) => row.status === expectedStatus));
    assert.equal(await db.hotelOfflinePaymentAuditEvent.count({ where: { organizationId: orgId, idempotencyKey: key } }), 0);
    assert.equal(await db.hotelOfflinePaymentCommandIdempotency.count({ where: { organizationId: orgId, idempotencyKey: key } }), 0,
      "the failed transaction must release its idempotency claim so the same key can retry");
    const reservation = await db.hotelReservation.findUniqueOrThrow({ where: { id: reservationId! } });
    assert.equal(reservation.paidAmount, expectedBalance);
  };

  try {
    const identity = await db.$queryRaw<Array<{ database: string; role: string; port: number }>>`SELECT current_database()::text AS database, current_user::text AS role, inet_server_port() AS port`;
    assert.deepEqual(identity, [{ database: "retail_hero_test", role: "hero_test", port: 5432 }]);

    const organization = await db.organization.create({ data: { type: "SHOP", vertical: "HOTEL", name: `Rollback Hotel ${token}`, slug: `rollback-hotel-${token}` } });
    orgId = organization.id;
    const user = await db.user.create({ data: { name: `rollback-staff-${token}`, password: "fixture-only", role: "ADMIN", isTeamMember: true } });
    userId = user.id;
    await db.organizationMember.create({ data: { organizationId: orgId, organizationSlug: organization.slug, userId, role: "ADMIN", isActive: true } });
    const guest = await db.guestCustomer.create({ data: { name: `Rollback guest ${token}`, sessionId: `rollback-${token}` } });
    guestId = guest.id;
    const guestUser = await db.user.create({ data: { name: `rollback-guest-user-${token}`, password: "fixture-only", role: "CUSTOMER", isTeamMember: false } });
    guestUserId = guestUser.id;
    // Keep the second user task-owned and clean it alongside the staff user.
    await db.customerIdentity.create({ data: { organizationId: orgId, userId: guestUser.id, guestCustomerId: guestId, status: "ACTIVE" } });
    const property = await db.hotelProperty.create({ data: { organizationId: orgId, organizationSlug: organization.slug, slug: `rollback-property-${token}`, name: `Rollback property ${token}` } });
    propertyId = property.id;
    const room = await db.hotelRoomType.create({ data: { organizationId: orgId, propertyId, slug: `rollback-room-${token}`, name: "Rollback room", maxAdults: 2, maxChildren: 0, maxOccupancy: 2, beds: [] } });
    roomTypeId = room.id;
    const rate = await db.hotelRatePlan.create({ data: { organizationId: orgId, propertyId, roomTypeId, code: `rollback-rate-${token}`, name: "Rollback rate", baseNightlyRate: BigInt(1_000_000) } });
    ratePlanId = rate.id;
    const reservation = await db.hotelReservation.create({ data: {
      id: `rollback-${token}`, organizationId: orgId, propertyId, roomTypeId, ratePlanId,
      reference: `rollback-ref-${token}`, status: "PENDING_PAYMENT", checkIn: new Date("2027-12-10T00:00:00.000Z"),
      checkOut: new Date("2027-12-12T00:00:00.000Z"), currency: "TOMAN", totalAmount: BigInt(1_000_000),
      cancellationPolicyKey: "rollback-test", cancellationPolicySnapshot: { key: "rollback-test" }, guestCustomerId: guestId,
      idempotencyKey: `rollback-res-${token}`,
    } });
    reservationId = reservation.id;

    const collector: OfflinePaymentActor = { organizationId: orgId, userId, permissions: ["hotel:offline-payment:record-cash"] };
    const verifier: OfflinePaymentActor = { organizationId: orgId, userId, permissions: ["hotel:offline-payment:verify-transfer"] };
    const rejector: OfflinePaymentActor = { organizationId: orgId, userId, permissions: ["hotel:offline-payment:reject-transfer"] };
    const reverser: OfflinePaymentActor = { organizationId: orgId, userId, permissions: ["hotel:offline-payment:reverse-cash"] };
    const submitter: OfflinePaymentActor = { organizationId: orgId, userId: (await db.customerIdentity.findFirstOrThrow({ where: { organizationId: orgId } })).userId, permissions: ["hotel:offline-payment:submit-transfer"] };

    const cashKey = `rollback-cash-${token}`;
    await installFailure("CASH_RECORDED");
    await assert.rejects(service.recordCash({ actor: collector, reservationId, amountToman: BigInt(100_000), idempotencyKey: cashKey }), /injected offline payment rollback failure/);
    await removeFailure();
    await assertFailedAttemptWasAtomic(cashKey, null, 0, BigInt(0));
    const cashRetry = await service.recordCash({ actor: collector, reservationId, amountToman: BigInt(100_000), idempotencyKey: cashKey });
    assert.equal(cashRetry.outcome, "APPLIED");
    if (cashRetry.outcome !== "APPLIED") return;
    assert.equal((await service.recordCash({ actor: collector, reservationId, amountToman: BigInt(100_000), idempotencyKey: cashKey })).outcome, "REPLAY");

    const transfer = await service.submitBankTransfer({ actor: submitter, reservationId, amountToman: BigInt(50_000), idempotencyKey: `rollback-transfer-${token}`, bankReference: `rollback-bank-${token}` });
    assert.equal(transfer.outcome, "APPLIED");
    if (transfer.outcome !== "APPLIED") return;
    const verifyKey = `rollback-verify-${token}`;
    await installFailure("BANK_TRANSFER_VERIFIED");
    await assert.rejects(service.verifyBankTransfer({ actor: verifier, reservationId, ledgerEntryId: transfer.entry.id, idempotencyKey: verifyKey }), /injected offline payment rollback failure/);
    await removeFailure();
    await assertFailedAttemptWasAtomic(verifyKey, "SUBMITTED", 2, BigInt(100_000));
    assert.equal((await db.hotelOfflinePayment.findUniqueOrThrow({ where: { id: transfer.entry.id } })).verifiedAt, null);
    const verifyRetry = await service.verifyBankTransfer({ actor: verifier, reservationId, ledgerEntryId: transfer.entry.id, idempotencyKey: verifyKey });
    assert.equal(verifyRetry.outcome, "APPLIED");
    assert.equal((await service.verifyBankTransfer({ actor: verifier, reservationId, ledgerEntryId: transfer.entry.id, idempotencyKey: verifyKey })).outcome, "REPLAY");

    const rejectedTransfer = await service.submitBankTransfer({ actor: submitter, reservationId, amountToman: BigInt(25_000), idempotencyKey: `rollback-reject-source-${token}`, bankReference: `rollback-reject-bank-${token}` });
    assert.equal(rejectedTransfer.outcome, "APPLIED");
    if (rejectedTransfer.outcome !== "APPLIED") return;
    const rejectKey = `rollback-reject-${token}`;
    const paidBeforeReject = (await db.hotelReservation.findUniqueOrThrow({ where: { id: reservationId } })).paidAmount;
    await installFailure("BANK_TRANSFER_REJECTED");
    await assert.rejects(service.rejectBankTransfer({ actor: rejector, reservationId, ledgerEntryId: rejectedTransfer.entry.id, idempotencyKey: rejectKey, reason: "Injected rollback case" }), /injected offline payment rollback failure/);
    await removeFailure();
    assert.equal((await db.hotelOfflinePayment.findUniqueOrThrow({ where: { id: rejectedTransfer.entry.id } })).status, "SUBMITTED");
    assert.equal((await db.hotelReservation.findUniqueOrThrow({ where: { id: reservationId } })).paidAmount, paidBeforeReject);
    assert.equal(await db.hotelOfflinePaymentAuditEvent.count({ where: { organizationId: orgId, ledgerEntryId: rejectedTransfer.entry.id, eventType: "BANK_TRANSFER_REJECTED" } }), 0);
    assert.equal(await db.hotelOfflinePaymentCommandIdempotency.count({ where: { organizationId: orgId, operation: "REJECT_BANK_TRANSFER", idempotencyKey: rejectKey } }), 0);
    const rejectRetry = await service.rejectBankTransfer({ actor: rejector, reservationId, ledgerEntryId: rejectedTransfer.entry.id, idempotencyKey: rejectKey, reason: "Injected rollback case" });
    assert.equal(rejectRetry.outcome, "APPLIED");
    assert.equal((await service.rejectBankTransfer({ actor: rejector, reservationId, ledgerEntryId: rejectedTransfer.entry.id, idempotencyKey: rejectKey, reason: "Injected rollback case" })).outcome, "REPLAY");

    const reversalSource = await service.recordCash({ actor: collector, reservationId, amountToman: BigInt(30_000), idempotencyKey: `rollback-reverse-source-${token}` });
    assert.equal(reversalSource.outcome, "APPLIED");
    if (reversalSource.outcome !== "APPLIED") return;
    const reverseKey = `rollback-reverse-${token}`;
    const paidBeforeReverse = (await db.hotelReservation.findUniqueOrThrow({ where: { id: reservationId } })).paidAmount;
    await installFailure("CASH_REVERSED");
    await assert.rejects(service.reverseCash({ actor: reverser, reservationId, ledgerEntryId: reversalSource.entry.id, idempotencyKey: reverseKey, reason: "Injected rollback case" }), /injected offline payment rollback failure/);
    await removeFailure();
    assert.equal((await db.hotelOfflinePayment.findUniqueOrThrow({ where: { id: reversalSource.entry.id } })).status, "VERIFIED");
    assert.equal((await db.hotelReservation.findUniqueOrThrow({ where: { id: reservationId } })).paidAmount, paidBeforeReverse);
    assert.equal(await db.hotelOfflinePaymentAuditEvent.count({ where: { organizationId: orgId, ledgerEntryId: reversalSource.entry.id, eventType: "CASH_REVERSED" } }), 0);
    assert.equal(await db.hotelOfflinePaymentCommandIdempotency.count({ where: { organizationId: orgId, operation: "REVERSE_CASH", idempotencyKey: reverseKey } }), 0);
    const reverseRetry = await service.reverseCash({ actor: reverser, reservationId, ledgerEntryId: reversalSource.entry.id, idempotencyKey: reverseKey, reason: "Injected rollback case" });
    assert.equal(reverseRetry.outcome, "APPLIED");
    assert.equal((await service.reverseCash({ actor: reverser, reservationId, ledgerEntryId: reversalSource.entry.id, idempotencyKey: reverseKey, reason: "Injected rollback case" })).outcome, "REPLAY");
  } finally {
    await removeFailure();
    if (orgId) {
      await db.hotelOfflinePaymentAuditEvent.deleteMany({ where: { organizationId: orgId } });
      await db.hotelOfflinePaymentCommandIdempotency.deleteMany({ where: { organizationId: orgId } });
      await db.hotelOfflinePayment.deleteMany({ where: { organizationId: orgId } });
      if (reservationId) await db.hotelReservation.deleteMany({ where: { id: reservationId } });
      await db.customerIdentity.deleteMany({ where: { organizationId: orgId } });
      await db.organizationMember.deleteMany({ where: { organizationId: orgId } });
      if (guestId) await db.guestCustomer.deleteMany({ where: { id: guestId } });
      if (ratePlanId) await db.hotelRatePlan.deleteMany({ where: { id: ratePlanId } });
      if (roomTypeId) await db.hotelRoomType.deleteMany({ where: { id: roomTypeId } });
      if (propertyId) await db.hotelProperty.deleteMany({ where: { id: propertyId } });
      await db.organization.deleteMany({ where: { id: orgId } });
      await db.user.deleteMany({ where: { id: { in: [userId, guestUserId].filter((id): id is string => Boolean(id)) } } });
    }
    await db.$disconnect();
  }
});
