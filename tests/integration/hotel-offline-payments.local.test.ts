import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { createHotelOfflinePaymentService, type OfflinePaymentActor } from "../../lib/hotel/offline-payments/service";
import { createPrismaHotelOfflinePaymentRepository } from "../../lib/hotel/offline-payments/prisma-repository";

const enabled = process.env.HOTEL_OFFLINE_PAYMENT_PG_ACCEPTANCE === "1";
const day = (value: string) => new Date(`${value}T00:00:00.000Z`);

function guardedConnection() {
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

test("offline Hotel payments use tenant locks, staff authorization and partial verified balances on isolated PostgreSQL", {
  skip: !enabled,
  concurrency: false,
}, async () => {
  const connection = guardedConnection();
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: connection.toString(), max: 8 }), log: [] });
  const token = randomUUID().replaceAll("-", "").slice(0, 14);
  const orgIds: string[] = [];
  const userIds: string[] = [];
  const propertyIds: string[] = [];
  const roomTypeIds: string[] = [];
  const ratePlanIds: string[] = [];
  const guestIds: string[] = [];
  const reservationIds: string[] = [];
  const service = createHotelOfflinePaymentService({
    repository: createPrismaHotelOfflinePaymentRepository(db),
    now: () => new Date("2027-11-20T12:00:00.000Z"),
  });
  let cancelLockReady!: () => void;
  let releaseCancel!: () => void;
  const cancelReady = new Promise<void>((resolve) => { cancelLockReady = resolve; });
  const cancelGate = new Promise<void>((resolve) => { releaseCancel = resolve; });

  try {
    const identity = await db.$queryRaw<Array<{ database: string; role: string; port: number }>>`
      SELECT current_database()::text AS database, current_user::text AS role, inet_server_port() AS port`;
    assert.deepEqual(identity, [{ database: "retail_hero_test", role: "hero_test", port: 5432 }]);

    const orgA = await db.organization.create({ data: { type: "SHOP", vertical: "HOTEL", name: `Offline Hotel A ${token}`, slug: `offline-hotel-a-${token}` } }); orgIds.push(orgA.id);
    const orgB = await db.organization.create({ data: { type: "SHOP", vertical: "HOTEL", name: `Offline Hotel B ${token}`, slug: `offline-hotel-b-${token}` } }); orgIds.push(orgB.id);
    const staffA = await db.user.create({ data: { name: `offline-staff-a-${token}`, password: "fixture-only", role: "ADMIN", isTeamMember: true } }); userIds.push(staffA.id);
    const staffB = await db.user.create({ data: { name: `offline-staff-b-${token}`, password: "fixture-only", role: "ADMIN", isTeamMember: true } }); userIds.push(staffB.id);
    const guestA = await db.user.create({ data: { name: `offline-guest-a-${token}`, password: "fixture-only", role: "CUSTOMER", isTeamMember: false } }); userIds.push(guestA.id);
    const guestB = await db.user.create({ data: { name: `offline-guest-b-${token}`, password: "fixture-only", role: "CUSTOMER", isTeamMember: false } }); userIds.push(guestB.id);
    await db.organizationMember.createMany({ data: [
      { organizationId: orgA.id, organizationSlug: orgA.slug, userId: staffA.id, role: "ADMIN", isActive: true },
      { organizationId: orgB.id, organizationSlug: orgB.slug, userId: staffB.id, role: "ADMIN", isActive: true },
    ] });
    const guestCustomerA = await db.guestCustomer.create({ data: { name: `Offline guest A ${token}`, sessionId: `offline-a-${token}` } }); guestIds.push(guestCustomerA.id);
    const guestCustomerB = await db.guestCustomer.create({ data: { name: `Offline guest B ${token}`, sessionId: `offline-b-${token}` } }); guestIds.push(guestCustomerB.id);
    await db.customerIdentity.createMany({ data: [
      { organizationId: orgA.id, userId: guestA.id, guestCustomerId: guestCustomerA.id, status: "ACTIVE" },
      { organizationId: orgB.id, userId: guestB.id, guestCustomerId: guestCustomerB.id, status: "ACTIVE" },
    ] });
    const propertyA = await db.hotelProperty.create({ data: { organizationId: orgA.id, organizationSlug: orgA.slug, slug: `property-a-${token}`, name: `Offline property A ${token}` } }); propertyIds.push(propertyA.id);
    const propertyB = await db.hotelProperty.create({ data: { organizationId: orgB.id, organizationSlug: orgB.slug, slug: `property-b-${token}`, name: `Offline property B ${token}` } }); propertyIds.push(propertyB.id);
    const roomA = await db.hotelRoomType.create({ data: { organizationId: orgA.id, propertyId: propertyA.id, slug: `room-a-${token}`, name: "Room A", maxAdults: 2, maxChildren: 0, maxOccupancy: 2, beds: [] } }); roomTypeIds.push(roomA.id);
    const roomB = await db.hotelRoomType.create({ data: { organizationId: orgB.id, propertyId: propertyB.id, slug: `room-b-${token}`, name: "Room B", maxAdults: 2, maxChildren: 0, maxOccupancy: 2, beds: [] } }); roomTypeIds.push(roomB.id);
    const rateA = await db.hotelRatePlan.create({ data: { organizationId: orgA.id, propertyId: propertyA.id, roomTypeId: roomA.id, code: `rate-a-${token}`, name: "Rate A", baseNightlyRate: BigInt(1000000) } }); ratePlanIds.push(rateA.id);
    const rateB = await db.hotelRatePlan.create({ data: { organizationId: orgB.id, propertyId: propertyB.id, roomTypeId: roomB.id, code: `rate-b-${token}`, name: "Rate B", baseNightlyRate: BigInt(1000000) } }); ratePlanIds.push(rateB.id);
    const createReservation = (input: { organizationId: string; propertyId: string; roomTypeId: string; ratePlanId: string; guestCustomerId: string | null; label: string }) => db.hotelReservation.create({ data: {
      id: `offline-${input.label}-${token}`, organizationId: input.organizationId, propertyId: input.propertyId, roomTypeId: input.roomTypeId,
      ratePlanId: input.ratePlanId, reference: `offline-ref-${input.label}-${token}`, status: "PENDING_PAYMENT", checkIn: day("2027-12-10"),
      checkOut: day("2027-12-12"), currency: "TOMAN", totalAmount: BigInt(1000000), cancellationPolicyKey: "offline-test",
      cancellationPolicySnapshot: { key: "offline-test" }, guestCustomerId: input.guestCustomerId,
      idempotencyKey: `offline-res-${input.label}-${token}`,
    } });
    const reservationA = await createReservation({ organizationId: orgA.id, propertyId: propertyA.id, roomTypeId: roomA.id, ratePlanId: rateA.id, guestCustomerId: guestCustomerA.id, label: "primary" }); reservationIds.push(reservationA.id);
    const cancellationReservation = await createReservation({ organizationId: orgA.id, propertyId: propertyA.id, roomTypeId: roomA.id, ratePlanId: rateA.id, guestCustomerId: guestCustomerA.id, label: "cancel-race" }); reservationIds.push(cancellationReservation.id);

    const cashCollector: OfflinePaymentActor = { organizationId: orgA.id, userId: staffA.id, permissions: ["hotel:offline-payment:record-cash"] };
    const verifier: OfflinePaymentActor = { organizationId: orgA.id, userId: staffA.id, permissions: ["hotel:offline-payment:verify-transfer"] };
    const submitter: OfflinePaymentActor = { organizationId: orgA.id, userId: guestA.id, permissions: ["hotel:offline-payment:submit-transfer"] };
    const foreignCollector: OfflinePaymentActor = { organizationId: orgB.id, userId: staffB.id, permissions: ["hotel:offline-payment:record-cash"] };
    const foreignGuest: OfflinePaymentActor = { organizationId: orgA.id, userId: guestB.id, permissions: ["hotel:offline-payment:submit-transfer"] };

    const cash = await service.recordCash({ actor: cashCollector, reservationId: reservationA.id, amountToman: BigInt(200000), idempotencyKey: `cash-${token}` });
    assert.equal(cash.outcome, "APPLIED");
    const cashReplay = await service.recordCash({ actor: cashCollector, reservationId: reservationA.id, amountToman: BigInt(200000), idempotencyKey: `cash-${token}` });
    assert.equal(cashReplay.outcome, "REPLAY");
    const cashConflict = await service.recordCash({ actor: cashCollector, reservationId: reservationA.id, amountToman: BigInt(100000), idempotencyKey: `cash-${token}` });
    assert.equal(cashConflict.outcome, "IDEMPOTENCY_CONFLICT");
    const submitted = await service.submitBankTransfer({ actor: submitter, reservationId: reservationA.id, amountToman: BigInt(300000), idempotencyKey: `transfer-${token}`, bankReference: `synthetic-${token}` });
    assert.equal(submitted.outcome, "APPLIED");
    if (submitted.outcome !== "APPLIED") return;
    assert.equal(submitted.entry.status, "SUBMITTED");
    const receiptFlagConflict = await service.submitBankTransfer({ actor: submitter, reservationId: reservationA.id, amountToman: BigInt(300000), idempotencyKey: `transfer-${token}`, bankReference: `synthetic-${token}`, receiptPending: true });
    assert.equal(receiptFlagConflict.outcome, "IDEMPOTENCY_CONFLICT", "receiptPending participates in the durable request fingerprint");
    assert.equal((await db.hotelReservation.findUniqueOrThrow({ where: { id: reservationA.id } })).paidAmount, BigInt(200000));
    const [referenceRaceA, referenceRaceB] = await Promise.all([
      service.submitBankTransfer({ actor: submitter, reservationId: reservationA.id, amountToman: BigInt(50000), idempotencyKey: `transfer-reference-race-a-${token}`, bankReference: ` concurrent-${token} ` }),
      service.submitBankTransfer({ actor: submitter, reservationId: reservationA.id, amountToman: BigInt(50000), idempotencyKey: `transfer-reference-race-b-${token}`, bankReference: `CONCURRENT-${token.toUpperCase()}` }),
    ]);
    assert.equal([referenceRaceA, referenceRaceB].filter((result) => result.outcome === "APPLIED").length, 1);
    assert.equal([referenceRaceA, referenceRaceB].filter((result) => result.outcome === "PAYMENT_NOT_PENDING").length, 1, "concurrent normalized references cannot both be claimed in one tenant");
    const verified = await service.verifyBankTransfer({ actor: verifier, reservationId: reservationA.id, ledgerEntryId: submitted.entry.id, idempotencyKey: `verify-${token}` });
    assert.equal(verified.outcome, "APPLIED");
    const verifyReplay = await service.verifyBankTransfer({ actor: verifier, reservationId: reservationA.id, ledgerEntryId: submitted.entry.id, idempotencyKey: `verify-${token}` });
    assert.equal(verifyReplay.outcome, "REPLAY");
    assert.equal((await db.hotelReservation.findUniqueOrThrow({ where: { id: reservationA.id } })).paidAmount, BigInt(500000));
    assert.equal((await db.hotelReservation.findUniqueOrThrow({ where: { id: reservationA.id } })).status, "PENDING_PAYMENT");
    const [concurrentA, concurrentB] = await Promise.all([
      service.recordCash({ actor: cashCollector, reservationId: reservationA.id, amountToman: BigInt(400000), idempotencyKey: `partial-a-${token}` }),
      service.recordCash({ actor: cashCollector, reservationId: reservationA.id, amountToman: BigInt(200000), idempotencyKey: `partial-b-${token}` }),
    ]);
    assert.equal([concurrentA, concurrentB].filter((result) => result.outcome === "APPLIED").length, 1);
    assert.equal([concurrentA, concurrentB].filter((result) => result.outcome === "OVERPAYMENT").length, 1);
    const finalReservation = await db.hotelReservation.findUniqueOrThrow({ where: { id: reservationA.id } });
    assert.ok(finalReservation.paidAmount <= finalReservation.totalAmount);
    assert.equal(finalReservation.status, "PENDING_PAYMENT");
    const missingReceiptFlag = await service.submitBankTransfer({ actor: submitter, reservationId: reservationA.id, amountToman: BigInt(50000), idempotencyKey: `receipt-no-flag-${token}`, bankReference: null });
    assert.equal(missingReceiptFlag.outcome, "INVALID_INPUT", "reference-free claims require explicit receiptPending");
    const receiptOnly = await service.submitBankTransfer({ actor: submitter, reservationId: reservationA.id, amountToman: BigInt(50000), idempotencyKey: `receipt-pending-${token}`, bankReference: null, receiptPending: true });
    assert.equal(receiptOnly.outcome, "APPLIED");
    if (receiptOnly.outcome !== "APPLIED") return;
    assert.equal(receiptOnly.entry.status, "SUBMITTED");
    assert.equal(receiptOnly.entry.receiptAttached, false);
    assert.equal((await db.hotelReservation.findUniqueOrThrow({ where: { id: reservationA.id } })).paidAmount, finalReservation.paidAmount, "receipt-only submission never changes paidAmount");
    const verifyWithoutReceipt = await service.verifyBankTransfer({ actor: verifier, reservationId: reservationA.id, ledgerEntryId: receiptOnly.entry.id, idempotencyKey: `verify-receipt-before-${token}` });
    assert.equal(verifyWithoutReceipt.outcome, "PAYMENT_NOT_PENDING");
    const attachedReceipt = await db.hotelOfflinePayment.update({ where: { id: receiptOnly.entry.id }, data: { receiptKey: `hotel-payment/${orgA.id}/${token}.png` } });
    assert.ok(attachedReceipt.receiptKey);
    const verifyWithReceipt = await service.verifyBankTransfer({ actor: verifier, reservationId: reservationA.id, ledgerEntryId: receiptOnly.entry.id, idempotencyKey: `verify-receipt-after-${token}` });
    assert.equal(verifyWithReceipt.outcome, "APPLIED");
    assert.equal(verifyWithReceipt.outcome === "APPLIED" && verifyWithReceipt.entry.receiptAttached, true, "verification can rely on the receipt on that exact ledger row");
    assert.equal((await db.hotelReservation.findUniqueOrThrow({ where: { id: reservationA.id } })).paidAmount, finalReservation.paidAmount + BigInt(50000));
    assert.equal((await service.recordCash({ actor: foreignCollector, reservationId: reservationA.id, amountToman: BigInt(1), idempotencyKey: `foreign-${token}` })).outcome, "NOT_FOUND");
    assert.equal((await service.submitBankTransfer({ actor: foreignGuest, reservationId: reservationA.id, amountToman: BigInt(1), idempotencyKey: `foreign-guest-${token}`, bankReference: `foreign-${token}` })).outcome, "UNAUTHORIZED");

    let cancellationCommitted = false;
    const cancelTx = db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "HotelReservation" WHERE "id"=${cancellationReservation.id} AND "organizationId"=${orgA.id} FOR UPDATE`;
      cancelLockReady();
      await cancelGate;
      await tx.hotelReservation.update({ where: { id: cancellationReservation.id }, data: { status: "CANCELLED", cancelledAt: new Date(), version: { increment: 1 } } });
      cancellationCommitted = true;
    });
    await cancelReady;
    let paymentSettled = false;
    const afterLock = service.recordCash({ actor: cashCollector, reservationId: cancellationReservation.id, amountToman: BigInt(10000), idempotencyKey: `cancel-race-${token}` }).finally(() => { paymentSettled = true; });
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(paymentSettled, false, "payment writer must wait for the cancellation row lock");
    releaseCancel();
    await cancelTx;
    const afterCancelled = await afterLock;
    assert.equal(cancellationCommitted, true);
    assert.equal(afterCancelled.outcome, "PAYMENT_NOT_PENDING");
    assert.equal((await db.hotelReservation.findUniqueOrThrow({ where: { id: cancellationReservation.id } })).paidAmount, BigInt(0));

    const recorded = await db.hotelOfflinePayment.findMany({ where: { organizationId: orgA.id, reservationId: reservationA.id }, orderBy: { createdAt: "asc" } });
    assert.equal(recorded.filter((row) => row.method === "CASH" && row.status === "VERIFIED").length, 2);
    const cashRow = recorded.find((row) => row.method === "CASH")!;
    assert.equal(cashRow.recordedByUserId, staffA.id);
    assert.equal(cashRow.verifiedByUserId, staffA.id);
    assert.ok(cashRow.verifiedAt);
    assert.equal(await db.hotelOfflinePayment.count({ where: { organizationId: orgB.id, reservationId: reservationA.id } }), 0);
  } finally {
    if (cancelLockReady && releaseCancel) releaseCancel();
    if (orgIds.length) {
      await db.hotelOfflinePaymentCommandIdempotency.deleteMany({ where: { organizationId: { in: orgIds } } });
      await db.hotelOfflinePayment.deleteMany({ where: { organizationId: { in: orgIds } } });
      await db.hotelReservation.deleteMany({ where: { id: { in: reservationIds } } });
      await db.customerIdentity.deleteMany({ where: { organizationId: { in: orgIds } } });
      await db.organizationMember.deleteMany({ where: { organizationId: { in: orgIds } } });
      if (guestIds.length) await db.guestCustomer.deleteMany({ where: { id: { in: guestIds } } });
      await db.hotelRatePlan.deleteMany({ where: { id: { in: ratePlanIds } } });
      await db.hotelRoomType.deleteMany({ where: { id: { in: roomTypeIds } } });
      await db.hotelProperty.deleteMany({ where: { id: { in: propertyIds } } });
      await db.organization.deleteMany({ where: { id: { in: orgIds } } });
      await db.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await db.$disconnect();
  }
});
