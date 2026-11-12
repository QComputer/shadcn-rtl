import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { HotelOperationalPaymentService } from "@/lib/hotel/services/hotel-operational-payment.service";
import { HotelOperationalReservationService } from "@/lib/hotel/services/hotel-operational-reservation.service";
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

test("hotel payment intent creation is PostgreSQL-idempotent and tenant-bound", {
  skip: process.env.HOTEL_OPERATIONAL_PAYMENT_ACCEPTANCE !== "1",
  concurrency: false,
}, async () => {
  assert.notEqual(process.env.NODE_ENV, "production");
  assert.notEqual(process.env.VERCEL_ENV, "production");
  assert.ok(!process.env.VERCEL, "hosted execution is forbidden");
  assert.equal(process.env.DATABASE_RUNTIME_ADAPTER, "postgresql");
  assert.equal(process.env.LOCAL_PRISMA_EXPECTED_PORT, "55439");
  assert.equal(process.env.RETAIL_HERO_EXPECTED_DATABASE, "retail_hero_test");
  const url = new URL(process.env.DATABASE_URL ?? "https://missing.invalid");
  assert.equal(url.hostname, "127.0.0.1"); assert.equal(url.port, "55439"); assert.equal(url.pathname, "/retail_hero_test");
  assert.equal(decodeURIComponent(url.username), "hero_test"); assert.equal(url.search, ""); assert.equal(url.hash, "");
  assert.equal(process.env.DIRECT_URL, url.toString());
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString(), max: 8 }), log: [] });
  const token = randomUUID().replaceAll("-", "").slice(0, 14);
  const orgIds: string[] = [], userIds: string[] = [], propertyIds: string[] = [], roomTypeIds: string[] = [], policyIds: string[] = [], rateIds: string[] = [];
  const priorOperational = process.env.HOTEL_OPERATIONAL_RESERVATIONS_ENABLED;
  const priorPortal = process.env.HOTEL_GUEST_PORTAL_ENABLED;
  let passed = false;
  const now = new Date("2027-11-01T12:00:00.000Z");
  try {
    const identity = await db.$queryRaw<Array<{ database: string; role: string }>>`SELECT current_database()::text AS database,current_user::text AS role`;
    assert.deepEqual(identity, [{ database: "retail_hero_test", role: "hero_test" }]);
    const org = await db.organization.create({ data: { type: "SHOP", vertical: "HOTEL", name: `Payment ${token}`, slug: `hotel-operational-payment-${token}` } }); orgIds.push(org.id);
    await db.organizationCapability.create({ data: { organizationId: org.id, key: "HOTEL_BOOKING", status: "ACTIVE", enabledAt: now } });
    const guestUser = await db.user.create({ data: { name: `payment-guest-${token}`, password: "fixture-only", role: "CUSTOMER", isTeamMember: false } }); userIds.push(guestUser.id);
    await db.customerClubMembership.create({ data: { organizationId: org.id, customerId: guestUser.id, status: "ACTIVE", source: "PUBLIC_SHOP" } });
    const property = await db.hotelProperty.create({ data: { organizationId: org.id, organizationSlug: org.slug, slug: `property-${token}`, name: `Payment property ${token}`, timezone: "UTC", operationalMode: "RESERVATION" } }); propertyIds.push(property.id);
    const policy = await db.hotelCancellationPolicy.create({ data: { organizationId: org.id, propertyId: property.id, key: `policy-${token}`, name: "Flexible", freeCancellationCutoffHours: 24, version: 1 } }); policyIds.push(policy.id);
    const room = await db.hotelRoomType.create({ data: { organizationId: org.id, propertyId: property.id, slug: `room-${token}`, name: "Room", maxAdults: 2, maxChildren: 1, maxOccupancy: 3, beds: [{ kind: "queen", count: 1 }], totalAllotment: 1 } }); roomTypeIds.push(room.id);
    const rate = await db.hotelRatePlan.create({ data: { organizationId: org.id, propertyId: property.id, roomTypeId: room.id, code: `RATE-${token}`, name: "Flexible", baseNightlyRate: BigInt(125000), cancellationPolicyId: policy.id } }); rateIds.push(rate.id);
    const guest = await db.guestCustomer.create({ data: { sessionId: `hotel-operational-payment:${org.id}:${token}`, name: `Guest ${token}` } });
    await db.customerIdentity.create({ data: { organizationId: org.id, userId: guestUser.id, guestCustomerId: guest.id } });
    const integration = await db.organizationIntegration.create({ data: { organizationId: org.id, provider: "INOTI_USSD", type: "USSD", status: "ACTIVE", codeName: `hotel-${token}`, credentialProfileKey: `fixture-${token}`, configuration: { paymentEnabled: true } } });
    const reservation = await db.hotelReservation.create({ data: {
      organizationId: org.id, propertyId: property.id, roomTypeId: room.id, ratePlanId: rate.id, reference: `HP-${token}`, status: "PENDING_PAYMENT",
      checkIn: new Date("2027-12-10T00:00:00.000Z"), checkOut: new Date("2027-12-12T00:00:00.000Z"), totalAmount: BigInt(250000), currency: "TOMAN",
      cancellationPolicyKey: policy.key, cancellationPolicySnapshot: { key: policy.key, freeCancellationCutoffHours: 24, fullCancellationRetention: 0 }, guestCustomerId: guest.id, idempotencyKey: `payment-reservation-${token}`,
      guests: { create: [{ fullName: `Primary ${token}`, isPrimary: true }] },
      nights: { create: ["2027-12-10", "2027-12-11"].map(date => ({ date: new Date(`${date}T00:00:00.000Z`), roomTypeId: room.id, rate: BigInt(125000) })) },
    } });
    process.env.HOTEL_OPERATIONAL_RESERVATIONS_ENABLED = "1"; process.env.HOTEL_GUEST_PORTAL_ENABLED = "1";
    let providerStarts = 0;
    const adapter = {
      available: () => true,
      async start(input: { organizationId: string; integrationId: string; amountToman: bigint; paymentRequestId: string; idempotencyKey: string }) {
        providerStarts++;
        assert.equal(input.amountToman, BigInt(250000));
        return { provider: "INOTI_USSD" as const, providerReference: `request-${token}`, binding: { merchantAccountKey: `LEGACY_INTEGRATION:${integration.id}`, credentialProfileKey: `fixture-${token}`, merchantCodeName: `hotel-${token}` } };
      },
      async verify() { throw new Error("test never supplies a payment outcome"); },
      async refund() { throw new Error("test never supplies a refund outcome"); },
    };
    const paymentService = new HotelOperationalPaymentService(db, () => now, adapter);
    const actor = { userId: guestUser.id, role: "CUSTOMER", organizationId: org.id, customerContextVerified: true };
    const command = { action: "create-payment", reservationId: reservation.id, integrationId: integration.id };
    const [first, replay] = await Promise.all([
      paymentService.execute(actor, org.id, property.id, command, `payment-intent-${token}`),
      paymentService.execute(actor, org.id, property.id, command, `payment-intent-${token}`),
    ]);
    assert.deepEqual(replay, first);
    assert.equal(providerStarts, 1, "idempotent replay must not start provider twice");
    const publicId = (first as { paymentRequestPublicId: string }).paymentRequestPublicId;
    const request = await db.paymentRequest.findUniqueOrThrow({ where: { publicId } });
    assert.equal(request.organizationId, org.id); assert.equal(request.guestCustomerId, guest.id); assert.equal(request.customerIdentityId !== null, true);
    assert.equal(request.amountToman, BigInt(250000)); assert.equal(request.currency, "TOMAN"); assert.equal(request.purpose, "RESERVATION_BALANCE");
    assert.deepEqual(request.metadata, { hotelReservationId: reservation.id, hotelPropertyId: property.id });
    assert.equal(request.merchantAccountKey, `LEGACY_INTEGRATION:${integration.id}`);
    assert.equal(await db.paymentRequest.count({ where: { organizationId: org.id, purpose: "RESERVATION_BALANCE" } }), 1);
    assert.equal(await db.paymentProviderAttempt.count({ where: { organizationId: org.id, paymentRequestId: request.id } }), 1);
    assert.equal((await db.hotelReservation.findUniqueOrThrow({ where: { id: reservation.id } })).status, "PENDING_PAYMENT", "an intent must not settle or confirm a reservation");
    await assert.rejects(paymentService.execute(actor, org.id, property.id, command, `payment-intent-other-${token}`), /already has a payment request/i);
    passed = true;
  } finally {
    process.env.HOTEL_OPERATIONAL_RESERVATIONS_ENABLED = priorOperational;
    process.env.HOTEL_GUEST_PORTAL_ENABLED = priorPortal;
    try {
      if (orgIds.length) {
        await db.hotelInventoryIdempotency.deleteMany({ where: { organizationId: { in: orgIds }, operationScope: "HOTEL_OPERATIONAL_PAYMENT_ACTION" } });
        await db.paymentProviderAttempt.deleteMany({ where: { organizationId: { in: orgIds } } });
        await db.paymentRequest.deleteMany({ where: { organizationId: { in: orgIds } } });
        await db.hotelPaymentAllocation.deleteMany({ where: { organizationId: { in: orgIds } } });
        await db.hotelReservationRoom.deleteMany({ where: { organizationId: { in: orgIds } } });
        await db.hotelReservationGuest.deleteMany({ where: { organizationId: { in: orgIds } } });
        await db.customerIdentity.deleteMany({ where: { organizationId: { in: orgIds } } });
        await db.hotelReservation.deleteMany({ where: { organizationId: { in: orgIds } } });
        await db.guestCustomer.deleteMany({ where: { sessionId: { startsWith: "hotel-operational-payment:" } } });
        await db.hotelRatePlan.deleteMany({ where: { id: { in: rateIds } } });
        await db.hotelCancellationPolicy.deleteMany({ where: { id: { in: policyIds } } });
        await db.hotelRoomType.deleteMany({ where: { id: { in: roomTypeIds } } });
        await db.hotelProperty.deleteMany({ where: { id: { in: propertyIds } } });
        await db.organizationCapability.deleteMany({ where: { organizationId: { in: orgIds } } });
        await db.organization.deleteMany({ where: { id: { in: orgIds } } });
        await db.user.deleteMany({ where: { id: { in: userIds } } });
        await db.customerIdentity.deleteMany({ where: { organizationId: { in: orgIds } } });
        assert.equal(await db.paymentRequest.count({ where: { organizationId: { in: orgIds } } }), 0);
      }
      if (passed) console.log("HOTEL_OPERATIONAL_PAYMENT_CLEANUP=PASSED");
      await db.$disconnect();
    } catch (error) { await db.$disconnect(); throw error; }
  }
});
