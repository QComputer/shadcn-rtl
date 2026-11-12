import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { HotelOperationalPaymentService } from "@/lib/hotel/services/hotel-operational-payment.service";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

test("hotel operational payment service fails closed while its runtime gates are off", async () => {
  const previousReservations = process.env.HOTEL_OPERATIONAL_RESERVATIONS_ENABLED;
  const previousGuestPortal = process.env.HOTEL_GUEST_PORTAL_ENABLED;
  delete process.env.HOTEL_OPERATIONAL_RESERVATIONS_ENABLED;
  delete process.env.HOTEL_GUEST_PORTAL_ENABLED;
  try {
    const service = new HotelOperationalPaymentService({} as never);
    await assert.rejects(service.execute(
      { userId: "test-user", role: "CUSTOMER", organizationId: "test-org", customerContextVerified: true },
      "test-org",
      "test-property",
      { action: "create-payment", reservationId: "test-reservation", integrationId: "test-integration" },
      "local-test-key-001",
    ), /disabled/i);
  } finally {
    if (previousReservations === undefined) delete process.env.HOTEL_OPERATIONAL_RESERVATIONS_ENABLED;
    else process.env.HOTEL_OPERATIONAL_RESERVATIONS_ENABLED = previousReservations;
    if (previousGuestPortal === undefined) delete process.env.HOTEL_GUEST_PORTAL_ENABLED;
    else process.env.HOTEL_GUEST_PORTAL_ENABLED = previousGuestPortal;
  }
});

async function setupPaymentFixtures(db: PrismaClient, token: string) {
  const now = new Date("2027-11-01T12:00:00.000Z");
  const orgIds: string[] = [], userIds: string[] = [], propertyIds: string[] = [], roomTypeIds: string[] = [], policyIds: string[] = [], rateIds: string[] = [], guestIds: string[] = [];
  const org = await db.organization.create({ data: { type: "SHOP", vertical: "HOTEL", name: `Payment ${token}`, slug: `hotel-operational-payment-${token}` } }); orgIds.push(org.id);
  await db.organizationCapability.create({ data: { organizationId: org.id, key: "HOTEL_BOOKING", status: "ACTIVE", enabledAt: now } });
  const guestUser = await db.user.create({ data: { name: `payment-guest-${token}`, password: "fixture-only", role: "CUSTOMER", isTeamMember: false } }); userIds.push(guestUser.id);
  await db.customerClubMembership.create({ data: { organizationId: org.id, customerId: guestUser.id, status: "ACTIVE", source: "PUBLIC_SHOP" } });
  const staffUser = await db.user.create({ data: { name: `payment-staff-${token}`, password: "fixture-only", role: "STAFF", isTeamMember: true } }); userIds.push(staffUser.id);
  await db.organizationMember.create({ data: { organizationId: org.id, organizationSlug: org.slug, userId: staffUser.id, role: "STAFF", isActive: true } });
  const property = await db.hotelProperty.create({ data: { organizationId: org.id, organizationSlug: org.slug, slug: `property-${token}`, name: `Payment property ${token}`, timezone: "UTC", operationalMode: "RESERVATION", checkInTime: "14:00" } }); propertyIds.push(property.id);
  const policy = await db.hotelCancellationPolicy.create({ data: { organizationId: org.id, propertyId: property.id, key: `policy-${token}`, name: "Flexible", freeCancellationCutoffHours: 24, version: 1 } }); policyIds.push(policy.id);
  const room = await db.hotelRoomType.create({ data: { organizationId: org.id, propertyId: property.id, slug: `room-${token}`, name: "Room", maxAdults: 2, maxChildren: 1, maxOccupancy: 3, beds: [{ kind: "queen", count: 1 }], totalAllotment: 1 } }); roomTypeIds.push(room.id);
  const rate = await db.hotelRatePlan.create({ data: { organizationId: org.id, propertyId: property.id, roomTypeId: room.id, code: `RATE-${token}`, name: "Flexible", baseNightlyRate: BigInt(125000), cancellationPolicyId: policy.id } }); rateIds.push(rate.id);
  const guest = await db.guestCustomer.create({ data: { sessionId: `hotel-operational-payment:${org.id}:${token}`, name: `Guest ${token}` } }); guestIds.push(guest.id);
  await db.customerIdentity.create({ data: { organizationId: org.id, userId: guestUser.id, guestCustomerId: guest.id } });
  const integration = await db.organizationIntegration.create({ data: { organizationId: org.id, provider: "INOTI_USSD", type: "USSD", status: "ACTIVE", codeName: `hotel-${token}`, credentialProfileKey: `fixture-${token}`, configuration: { paymentEnabled: true } } });
  const reservation = await db.hotelReservation.create({ data: {
    organizationId: org.id, propertyId: property.id, roomTypeId: room.id, ratePlanId: rate.id, reference: `HP-${token}`, status: "PENDING_PAYMENT",
    checkIn: new Date("2027-12-10T00:00:00.000Z"), checkOut: new Date("2027-12-12T00:00:00.000Z"), totalAmount: BigInt(250000), currency: "TOMAN",
    cancellationPolicyKey: policy.key, cancellationPolicySnapshot: { key: policy.key, freeCancellationCutoffHours: 24, fullCancellationRetention: 0 }, guestCustomerId: guest.id, idempotencyKey: `payment-reservation-${token}`,
    guests: { create: [{ fullName: `Primary ${token}`, isPrimary: true }] },
    nights: { create: ["2027-12-10", "2027-12-11"].map(date => ({ date: new Date(`${date}T00:00:00.000Z`), roomTypeId: room.id, rate: BigInt(125000) })) },
  } });
  const actor = { userId: guestUser.id, role: "CUSTOMER", organizationId: org.id, customerContextVerified: true };
  const staffActor = { userId: staffUser.id, role: "STAFF", organizationId: org.id };
  const adapter = {
    available: () => true,
    async start() {
      return { provider: "INOTI_USSD" as const, providerReference: `request-${token}`, binding: { merchantAccountKey: `LEGACY_INTEGRATION:${integration.id}`, credentialProfileKey: `fixture-${token}`, merchantCodeName: `hotel-${token}` } };
    },
    async verify() { return { status: "VERIFIED" as const, paidAt: now, providerReference: `ref-${token}`, evidence: {} }; },
    async refund() { return { status: "VERIFIED" as const, providerReference: `refund-ref-${token}`, evidence: {} }; },
    async verifyRefund() { return { status: "VERIFIED" as const, providerReference: `refund-ref-${token}`, evidence: {} }; },
  };
  return { db, org, property, reservation, integration, guest, guestUser, actor, staffActor, adapter, now, cleanupIds: { orgIds, userIds, propertyIds, roomTypeIds, policyIds, rateIds, guestIds } };
}

async function setupConsumedHold(db: PrismaClient, orgId: string, propertyId: string, roomTypeId: string, ratePlanId: string, checkIn: Date, checkOut: Date, expiresAt: Date) {
  const holdId = randomUUID();
  const reference = `HOLD-${holdId}`;
  await db.hotelBookingHold.create({
    data: {
      id: holdId, organizationId: orgId, propertyId, roomTypeId, reference, quantity: 1,
      checkIn, checkOut, expiresAt, status: "CONSUMED", ratePlanId, currency: "TOMAN",
      totalAmount: BigInt(250000), nightlyRates: [{ date: "2027-12-10", amountToman: 125000 }, { date: "2027-12-11", amountToman: 125000 }],
      cancellationPolicySnapshot: { key: "fixture", freeCancellationCutoffHours: 24, fullCancellationRetention: 0 },
    },
  });
  for (const date of ["2027-12-10", "2027-12-11"]) await db.hotelInventory.create({
    data: { organizationId: orgId, propertyId, roomTypeId, date: new Date(`${date}T00:00:00.000Z`), allotment: 10, booked: 1, held: 0, outOfService: 0 },
  });
  return holdId;
}

async function cleanupPaymentFixtures(db: PrismaClient, ids: Awaited<ReturnType<typeof setupPaymentFixtures>>["cleanupIds"], passed: boolean) {
  try {
    if (ids.orgIds.length) {
      await db.hotelInventoryIdempotency.deleteMany({ where: { organizationId: { in: ids.orgIds }, operationScope: "HOTEL_OPERATIONAL_PAYMENT_ACTION" } });
      await db.paymentProviderAttempt.deleteMany({ where: { organizationId: { in: ids.orgIds } } });
      await db.paymentRequest.deleteMany({ where: { organizationId: { in: ids.orgIds } } });
      await db.hotelPaymentAllocation.deleteMany({ where: { organizationId: { in: ids.orgIds } } });
      await db.hotelReservationRoom.deleteMany({ where: { organizationId: { in: ids.orgIds } } });
      await db.hotelReservationGuest.deleteMany({ where: { organizationId: { in: ids.orgIds } } });
      await db.customerIdentity.deleteMany({ where: { organizationId: { in: ids.orgIds } } });
      await db.hotelReservation.deleteMany({ where: { organizationId: { in: ids.orgIds } } });
      await db.hotelBookingHold.deleteMany({ where: { organizationId: { in: ids.orgIds } } });
      await db.hotelInventory.deleteMany({ where: { organizationId: { in: ids.orgIds } } });
      await db.guestCustomer.deleteMany({ where: { id: { in: ids.guestIds } } });
      await db.hotelRatePlan.deleteMany({ where: { id: { in: ids.rateIds } } });
      await db.hotelCancellationPolicy.deleteMany({ where: { id: { in: ids.policyIds } } });
      await db.hotelRoomType.deleteMany({ where: { id: { in: ids.roomTypeIds } } });
      await db.hotelProperty.deleteMany({ where: { id: { in: ids.propertyIds } } });
      await db.organizationCapability.deleteMany({ where: { organizationId: { in: ids.orgIds } } });
      await db.organization.deleteMany({ where: { id: { in: ids.orgIds } } });
      await db.user.deleteMany({ where: { id: { in: ids.userIds } } });
      await db.customerIdentity.deleteMany({ where: { organizationId: { in: ids.orgIds } } });
      assert.equal(await db.paymentRequest.count({ where: { organizationId: { in: ids.orgIds } } }), 0);
    }
    if (passed) console.log("HOTEL_OPERATIONAL_PAYMENT_CLEANUP=PASSED");
    await db.$disconnect();
  } catch (error) { await db.$disconnect(); throw error; }
}

async function setupIsolatedDb() {
  const url = new URL(process.env.DATABASE_URL ?? "https://missing.invalid");
  if (url.hostname !== "127.0.0.1" || url.port !== "55439" || url.pathname !== "/retail_hero_test" || process.env.RETAIL_HERO_EXPECTED_DATABASE !== "retail_hero_test") throw new Error("Hotel payment tests require the isolated loopback PostgreSQL fixture");
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString(), max: 8 }), log: [] });
  const identity = await db.$queryRaw<Array<{ database: string; role: string }>>`SELECT current_database()::text AS database,current_user::text AS role`;
  if (identity[0]?.database !== "retail_hero_test" || identity[0]?.role !== "hero_test") { await db.$disconnect(); throw new Error("Unexpected database identity for Hotel payment tests"); }
  return db;
}

test("durable payment recovery: provider timeout after committed intent, reconcile recovers without second start", {
  skip: process.env.HOTEL_OPERATIONAL_PAYMENT_ACCEPTANCE !== "1",
  concurrency: false,
}, async () => {
  assert.equal(process.env.DATABASE_RUNTIME_ADAPTER, "postgresql");
  const url = new URL(process.env.DATABASE_URL ?? "https://missing.invalid");
  assert.equal(url.hostname, "127.0.0.1"); assert.equal(url.port, "55439"); assert.equal(url.pathname, "/retail_hero_test");
  const db = await setupIsolatedDb();
  const token = randomUUID().replaceAll("-", "").slice(0, 14);
  const priorOperational = process.env.HOTEL_OPERATIONAL_RESERVATIONS_ENABLED;
  const priorPortal = process.env.HOTEL_GUEST_PORTAL_ENABLED;
  let passed = false;
  let fx: Awaited<ReturnType<typeof setupPaymentFixtures>> | null = null;
  let releaseProviderStart = () => {};
  try {
    const identity = await db.$queryRaw<Array<{ database: string; role: string }>>`SELECT current_database()::text AS database,current_user::text AS role`;
    assert.deepEqual(identity, [{ database: "retail_hero_test", role: "hero_test" }]);
    fx = await setupPaymentFixtures(db, token);
    const holdId = await setupConsumedHold(db, fx.org.id, fx.property.id, fx.reservation.roomTypeId, fx.reservation.ratePlanId, fx.reservation.checkIn, fx.reservation.checkOut, new Date("2027-12-10T00:00:00.000Z"));
    await db.hotelReservation.update({ where: { id: fx.reservation.id }, data: { holdId } });
    process.env.HOTEL_OPERATIONAL_RESERVATIONS_ENABLED = "1"; process.env.HOTEL_GUEST_PORTAL_ENABLED = "1";
    let providerStarts = 0;
    let providerVerifyCalls = 0;
    let markProviderStart = () => {};
    const providerStartObserved = new Promise<void>(resolve => { markProviderStart = resolve; });
    const providerStartBlocked = new Promise<void>(resolve => { releaseProviderStart = resolve; });
    const flakyAdapter = {
      available: () => true,
      async start() {
        providerStarts++;
        markProviderStart();
        await providerStartBlocked;
        // Simulate provider receiving request but network cut before response.
        // The intent (PaymentRequest + Attempt + binding) is already committed.
        throw new Error("provider timeout: connection cut before response");
      },
      async verify() {
        providerVerifyCalls++;
        return { status: "VERIFIED" as const, paidAt: fx.now, providerReference: `ref-${token}`, evidence: {} };
      },
      async refund() { return { status: "VERIFIED" as const, providerReference: `refund-ref-${token}`, evidence: {} }; },
    };
    const paymentService = new HotelOperationalPaymentService(fx.db, () => fx.now, flakyAdapter);
    const command = { action: "create-payment" as const, reservationId: fx.reservation.id, integrationId: fx.integration.id };
    // 1. Durable intent committed before provider.start throws.
    const providerCall = paymentService.execute(fx.actor, fx.org.id, fx.property.id, command, `payment-durable-${token}`);
    await providerStartObserved;
    const attempt = await db.paymentProviderAttempt.findFirst({ where: { organizationId: fx.org.id, idempotencyKey: `payment-durable-${token}` } });
    assert.ok(attempt, "attempt must be durably recorded");
    const request = await db.paymentRequest.findFirst({ where: { organizationId: fx.org.id, purpose: "RESERVATION_BALANCE", metadata: { path: ["hotelReservationId"], equals: fx.reservation.id } } });
    assert.ok(request, "payment request must be durably recorded");
    assert.equal(request!.merchantAccountKey, `LEGACY_INTEGRATION:${fx.integration.id}`, "binding must be committed before provider.start");
    assert.equal(request!.status, "CREATED", "request must be CREATED, not settled");
    assert.equal(providerStarts, 1, "provider.start called exactly once");
    // 2. A concurrent retry with the same key reuses the durable attempt and never starts a second charge.
    const replay = await paymentService.execute(fx.actor, fx.org.id, fx.property.id, command, `payment-durable-${token}`);
    assert.equal((replay as { paymentRequestPublicId: string }).paymentRequestPublicId, request!.publicId);
    assert.equal(providerStarts, 1, "retry must not call provider.start again");
    releaseProviderStart();
    await assert.rejects(providerCall, /provider timeout/);
    // 3. Reconcile recovers state without manual DB edits.
    await assert.rejects(paymentService.execute(fx.actor, fx.org.id, fx.property.id, { action: "reconcile-payment" as const, reservationId: fx.reservation.id, paymentRequestPublicId: request!.publicId }, `payment-durable-customer-reconcile-${token}`), /Reception access/);
    const reconciled = await paymentService.execute(fx.staffActor, fx.org.id, fx.property.id, { action: "reconcile-payment" as const, reservationId: fx.reservation.id, paymentRequestPublicId: request!.publicId }, `payment-durable-reconcile-${token}`);
    assert.equal((reconciled as { status: string }).status, "PAID");
    assert.equal(providerVerifyCalls, 1, "verify called exactly once");
    const updated = await db.hotelReservation.findUniqueOrThrow({ where: { id: fx.reservation.id } });
    assert.equal(updated.status, "CONFIRMED");
    assert.equal(updated.paidAmount, fx.reservation.totalAmount);
    assert.equal(providerStarts, 1, "no second provider start after recovery");
    passed = true;
  } finally {
    releaseProviderStart();
    process.env.HOTEL_OPERATIONAL_RESERVATIONS_ENABLED = priorOperational;
    process.env.HOTEL_GUEST_PORTAL_ENABLED = priorPortal;
    try { if (fx) await cleanupPaymentFixtures(db, fx.cleanupIds, passed); else { await db.$disconnect(); } } catch { /* cleanup already disconnects */ }
  }
});

test("durable refund recovery: provider timeout after committed refund intent, reconcile-refund recovers without second refund call", {
  skip: process.env.HOTEL_OPERATIONAL_PAYMENT_ACCEPTANCE !== "1",
  concurrency: false,
}, async () => {
  assert.equal(process.env.DATABASE_RUNTIME_ADAPTER, "postgresql");
  const db = await setupIsolatedDb();
  const token = randomUUID().replaceAll("-", "").slice(0, 14);
  const priorOperational = process.env.HOTEL_OPERATIONAL_RESERVATIONS_ENABLED;
  const priorPortal = process.env.HOTEL_GUEST_PORTAL_ENABLED;
  let passed = false;
  let fx: Awaited<ReturnType<typeof setupPaymentFixtures>> | null = null;
  try {
    fx = await setupPaymentFixtures(db, token);
    const holdId = await setupConsumedHold(db, fx.org.id, fx.property.id, fx.reservation.roomTypeId, fx.reservation.ratePlanId, fx.reservation.checkIn, fx.reservation.checkOut, new Date("2027-12-10T00:00:00.000Z"));
    await db.hotelReservation.update({ where: { id: fx.reservation.id }, data: { holdId } });
    process.env.HOTEL_OPERATIONAL_RESERVATIONS_ENABLED = "1"; process.env.HOTEL_GUEST_PORTAL_ENABLED = "1";
    let providerRefundCalls = 0;
    let providerRefundStatusQueries = 0;
    let simulateRefundStatusEvidence = true;
    const flakyAdapter = {
      available: () => true,
      async start() {
        return { provider: "INOTI_USSD" as const, providerReference: `request-${token}`, binding: { merchantAccountKey: `LEGACY_INTEGRATION:${fx.integration.id}`, credentialProfileKey: `fixture-${token}`, merchantCodeName: `hotel-${token}` } };
      },
      async verify() { return { status: "VERIFIED" as const, paidAt: fx.now, providerReference: `ref-${token}`, evidence: {} }; },
      async refund() {
        providerRefundCalls++;
        throw new Error("refund provider timeout after external effect");
      },
      async verifyRefund() { providerRefundStatusQueries++; return { status: "VERIFIED" as const, providerReference: `refund-ref-${token}`, evidence: { providerStatusQuery: true, ...(simulateRefundStatusEvidence ? { simulated: true } : {}) } }; },
    };
    const paymentService = new HotelOperationalPaymentService(fx.db, () => fx.now, flakyAdapter);
    const command = { action: "create-payment" as const, reservationId: fx.reservation.id, integrationId: fx.integration.id };
    const created = await paymentService.execute(fx.actor, fx.org.id, fx.property.id, command, `payment-refund-durable-${token}`);
    const publicId = (created as { paymentRequestPublicId: string }).paymentRequestPublicId;
    await paymentService.execute(fx.staffActor, fx.org.id, fx.property.id, { action: "reconcile-payment" as const, reservationId: fx.reservation.id, paymentRequestPublicId: publicId }, `payment-refund-durable-reconcile-${token}`);
    await db.hotelReservation.update({ where: { id: fx.reservation.id }, data: { status: "CANCELLED", cancelledAt: new Date("2027-11-01T06:00:00.000Z") } });
    const balanceAllocation = await db.hotelPaymentAllocation.findUniqueOrThrow({ where: { paymentRequestPublicId: publicId } });
    await db.hotelPaymentAllocation.update({ where: { paymentRequestPublicId: publicId }, data: { kind: "DEPOSIT" } });
    await assert.rejects(paymentService.execute(fx.staffActor, fx.org.id, fx.property.id, { action: "request-refund" as const, reservationId: fx.reservation.id, paymentRequestPublicId: publicId }, `payment-refund-invalid-allocation-${token}`), /Original verified balance allocation/);
    await db.hotelPaymentAllocation.update({ where: { paymentRequestPublicId: publicId }, data: { kind: balanceAllocation.kind } });
    await assert.rejects(paymentService.execute(fx.staffActor, fx.org.id, fx.property.id, { action: "request-refund" as const, reservationId: fx.reservation.id, paymentRequestPublicId: publicId }, `payment-refund-durable-refund-${token}`), /refund provider timeout/);
    const refundAttempt = await db.paymentProviderAttempt.findFirst({ where: { organizationId: fx.org.id, idempotencyKey: `payment-refund-durable-refund-${token}` } });
    assert.ok(refundAttempt, "refund attempt must be durably recorded");
    const refundRequest = await db.paymentRequest.findFirst({ where: { organizationId: fx.org.id, purpose: "RESERVATION_REFUND" } });
    assert.ok(refundRequest, "refund payment request must be durably recorded");
    assert.equal(providerRefundCalls, 1, "provider.refund called exactly once");
    await assert.rejects(paymentService.execute(fx.staffActor, fx.org.id, fx.property.id, { action: "reconcile-refund" as const, reservationId: fx.reservation.id, paymentRequestPublicId: refundRequest!.publicId }, `payment-refund-durable-reconcile-simulated-${token}`), /Simulated refund evidence/);
    assert.equal(await db.hotelPaymentAllocation.count({ where: { organizationId: fx.org.id, hotelReservationId: fx.reservation.id, kind: "REFUND" } }), 0, "simulated refund verification must not create a financial allocation");
    simulateRefundStatusEvidence = false;
    const reconciled = await paymentService.execute(fx.staffActor, fx.org.id, fx.property.id, { action: "reconcile-refund" as const, reservationId: fx.reservation.id, paymentRequestPublicId: refundRequest!.publicId }, `payment-refund-durable-reconcile-refund-${token}`);
    assert.equal((reconciled as { status: string }).status, "PAID");
    assert.equal(providerRefundCalls, 1, "reconciliation must never initiate a second refund");
    assert.equal(providerRefundStatusQueries, 2, "reconciliation must query the existing provider attempt without initiating another refund");
    const allocations = await db.hotelPaymentAllocation.count({ where: { organizationId: fx.org.id, hotelReservationId: fx.reservation.id, kind: "REFUND" } });
    assert.equal(allocations, 1, "exactly one refund allocation");
    const replayedRefund = await paymentService.execute(fx.staffActor, fx.org.id, fx.property.id, { action: "reconcile-refund" as const, reservationId: fx.reservation.id, paymentRequestPublicId: refundRequest!.publicId }, `payment-refund-durable-replay-${token}`);
    assert.equal((replayedRefund as { isIdempotentReplay?: boolean }).isIdempotentReplay, true);
    assert.equal(providerRefundCalls, 1, "replay must not initiate another refund");
    passed = true;
  } finally {
    process.env.HOTEL_OPERATIONAL_RESERVATIONS_ENABLED = priorOperational;
    process.env.HOTEL_GUEST_PORTAL_ENABLED = priorPortal;
    try { if (fx) await cleanupPaymentFixtures(db, fx.cleanupIds, passed); else { await db.$disconnect(); } } catch { /* cleanup already disconnects */ }
  }
});
