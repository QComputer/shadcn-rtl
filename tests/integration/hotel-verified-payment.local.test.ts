import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaHotelRepositories } from "../../lib/hotel/persistence/prisma-hotel-repositories";
import type { ReservationRecord } from "../../lib/hotel/persistence/hotel-repositories";
import { reconcileVerifiedPayment } from "../../lib/hotel/services/hotel-booking.service";

const enabled = process.env.HOTEL_VERIFIED_PAYMENT_ACCEPTANCE === "1";
const stayNights = ["2027-12-10", "2027-12-11"] as const;
const day = (value: string) => new Date(`${value}T00:00:00.000Z`);
const amount = BigInt(255000);

function guardedConnection() {
  assert.notEqual(process.env.NODE_ENV, "production");
  assert.equal(process.env.DATABASE_RUNTIME_ADAPTER, "postgresql");
  assert.equal(process.env.LOCAL_PRISMA_EXPECTED_PORT, "55439");
  assert.equal(process.env.RETAIL_HERO_EXPECTED_DATABASE, "retail_hero_test");
  let url: URL;
  try { url = new URL(process.env.DATABASE_URL ?? ""); }
  catch { throw new Error("invalid isolated local database configuration"); }
  assert.ok(["postgres:", "postgresql:"].includes(url.protocol));
  assert.equal(url.hostname, "127.0.0.1");
  assert.equal(url.port, "55439");
  assert.equal(url.pathname, "/retail_hero_test");
  assert.equal(decodeURIComponent(url.username), "hero_test");
  assert.equal(decodeURIComponent(url.password), "local_admin_fixture_only");
  assert.equal(url.search, "");
  assert.equal(url.hash, "");
  assert.equal(process.env.DIRECT_URL, process.env.DATABASE_URL);
  return url;
}

test("verified Hotel balance settlement is tenant-bound, atomic, and idempotent on disposable PostgreSQL", {
  skip: !enabled,
  concurrency: false,
}, async () => {
  const connection = guardedConnection();
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: connection.toString(), max: 8 }), log: [] });
  const token = randomUUID().replaceAll("-", "").slice(0, 12);
  const orgIds: string[] = [];
  const propertyIds: string[] = [];
  const roomTypeIds: string[] = [];
  const ratePlanIds: string[] = [];
  const holdIds: string[] = [];
  const reservationIds: string[] = [];
  const paymentRequestIds: string[] = [];
  const paymentPublicIds: string[] = [];
  const attemptIds: string[] = [];
  const integrationIds: string[] = [];
  const guestIds: string[] = [];
  const repo = new PrismaHotelRepositories(db);

  try {
    const identity = await db.$queryRaw<Array<{ database: string; role: string; port: number }>>`
      SELECT current_database()::text AS database, current_user::text AS role, inet_server_port() AS port`;
    assert.deepEqual(identity, [{ database: "retail_hero_test", role: "hero_test", port: 5432 }]);

    const orgA = await db.organization.create({ data: { type: "SHOP", vertical: "HOTEL", name: `Verified payment A ${token}`, slug: `hotel-vpay-a-${token}` } }); orgIds.push(orgA.id);
    const orgB = await db.organization.create({ data: { type: "SHOP", vertical: "HOTEL", name: `Verified payment B ${token}`, slug: `hotel-vpay-b-${token}` } }); orgIds.push(orgB.id);
    const property = await db.hotelProperty.create({ data: { organizationId: orgA.id, organizationSlug: orgA.slug, slug: `verified-${token}`, name: "Synthetic payment hotel" } }); propertyIds.push(property.id);
    const foreignProperty = await db.hotelProperty.create({ data: { organizationId: orgB.id, organizationSlug: orgB.slug, slug: `foreign-${token}`, name: "Synthetic foreign hotel" } }); propertyIds.push(foreignProperty.id);
    const roomType = await db.hotelRoomType.create({ data: { organizationId: orgA.id, propertyId: property.id, slug: `room-${token}`, name: "Synthetic room", maxAdults: 2, maxChildren: 0, maxOccupancy: 2, beds: [] } }); roomTypeIds.push(roomType.id);
    const foreignRoomType = await db.hotelRoomType.create({ data: { organizationId: orgB.id, propertyId: foreignProperty.id, slug: `foreign-room-${token}`, name: "Synthetic foreign room", maxAdults: 2, maxChildren: 0, maxOccupancy: 2, beds: [] } }); roomTypeIds.push(foreignRoomType.id);
    const ratePlan = await db.hotelRatePlan.create({ data: { organizationId: orgA.id, propertyId: property.id, roomTypeId: roomType.id, code: `BAL-${token}`, name: "Synthetic balance plan", baseNightlyRate: BigInt(125000) } }); ratePlanIds.push(ratePlan.id);
    const foreignPlan = await db.hotelRatePlan.create({ data: { organizationId: orgB.id, propertyId: foreignProperty.id, roomTypeId: foreignRoomType.id, code: `F-BAL-${token}`, name: "Synthetic foreign plan", baseNightlyRate: BigInt(125000) } }); ratePlanIds.push(foreignPlan.id);
    const guest = await db.guestCustomer.create({ data: { name: `Synthetic guest ${token}`, sessionId: `hotel-vpay-${token}` } }); guestIds.push(guest.id);
    const otherGuest = await db.guestCustomer.create({ data: { name: `Synthetic other guest ${token}`, sessionId: `hotel-vpay-other-${token}` } }); guestIds.push(otherGuest.id);
    const integration = await db.organizationIntegration.create({ data: {
      organizationId: orgA.id, provider: "PAYMENT", type: "USSD", status: "ACTIVE",
      codeName: `fixture-payment-${token}`, displayName: "Disposable verified-payment integration",
      credentialProfileKey: `fixture-credential-${token}`, configuration: { fixtureOnly: true },
    } }); integrationIds.push(integration.id);
    const foreignIntegration = await db.organizationIntegration.create({ data: {
      organizationId: orgB.id, provider: "PAYMENT", type: "USSD", status: "ACTIVE",
      codeName: `fixture-foreign-payment-${token}`, displayName: "Disposable foreign integration",
      credentialProfileKey: `fixture-foreign-credential-${token}`, configuration: { fixtureOnly: true },
    } }); integrationIds.push(foreignIntegration.id);

    const now = new Date();
    await db.hotelInventory.createMany({ data: stayNights.map(date => ({ organizationId: orgA.id, propertyId: property.id, roomTypeId: roomType.id, date: day(date), allotment: 10, held: 10, booked: 0 })) });
    const createReservation = async (label: string) => {
      const holdId = `vpay-hold-${label}-${token}`; holdIds.push(holdId);
      await db.hotelBookingHold.create({ data: {
        id: holdId, organizationId: orgA.id, propertyId: property.id, roomTypeId: roomType.id,
        reference: holdId, quantity: 1, checkIn: day(stayNights[0]), checkOut: day("2027-12-12"),
        expiresAt: new Date(now.getTime() + 2 * 60 * 60_000), status: "ACTIVE",
      } });
      const record: ReservationRecord = {
        id: `vpay-res-${label}-${token}`, organizationId: orgA.id, propertyId: property.id,
        reference: holdId, idempotencyKey: `vpay-idem-${label}-${token}`, roomTypeId: roomType.id,
        ratePlanId: ratePlan.id, status: "PENDING_PAYMENT", checkIn: stayNights[0], checkOut: "2027-12-12",
        nights: stayNights, guests: [{ fullName: `Verified guest ${label} ${token}`, isPrimary: true }],
        nightlyRates: [125000, 130000], totalAmount: Number(amount), currency: "TOMAN",
        cancellationPolicySnapshot: null, holdId, createdAt: now, updatedAt: now,
      };
      const result = await repo.createReservation(record);
      reservationIds.push(result.id);
      await db.hotelReservation.update({ where: { id: result.id }, data: { guestCustomerId: guest.id } });
      return result;
    };
    const reservation = await createReservation("primary");

    const makeRequest = async (label: string, overrides: Record<string, unknown> = {}) => {
      const publicId = `hotel-vpay-${label}-${token}`;
      const row = await db.paymentRequest.create({ data: {
        organizationId: orgA.id, guestCustomerId: guest.id, providerIntegrationId: integration.id,
        merchantAccountKey: `fixture-merchant-${token}`, credentialProfileKeySnapshot: `fixture-credential-${token}`,
        amountToman: amount, currency: "TOMAN", purpose: "RESERVATION_BALANCE", status: "PAID",
        paidAt: new Date(now.getTime() - 10_000), expiresAt: new Date(now.getTime() + 60 * 60_000),
        metadata: { hotelReservationId: reservation.id, hotelPropertyId: property.id }, publicId,
        ...overrides,
      } });
      paymentRequestIds.push(row.id); paymentPublicIds.push(row.publicId);
      return row;
    };
    const verify = async (request: { id: string; organizationId: string; amountToman: bigint; providerIntegrationId: string | null; merchantAccountKey: string | null; credentialProfileKeySnapshot: string | null }, label: string, patch: Record<string, unknown> = {}) => {
      const attempt = await db.paymentProviderAttempt.create({ data: {
        organizationId: request.organizationId, paymentRequestId: request.id,
        providerIntegrationId: request.providerIntegrationId,
        merchantAccountKey: request.merchantAccountKey, credentialProfileKeySnapshot: request.credentialProfileKeySnapshot,
        provider: "PAYMENT", status: "VERIFIED", amountToman: request.amountToman,
        merchantFactorId: `fixture-factor-${label}-${token}`, verifiedAt: new Date(now.getTime() - 5_000),
        verificationEvidence: { fixtureOnly: true, providerVerified: true }, callbackEvidence: { fixtureOnly: true },
        ...patch,
      } });
      attemptIds.push(attempt.id);
      return attempt;
    };

    // A wrong tenant cannot resolve even a valid payment's public id.
    const good = await makeRequest("good");
    await verify(good, "good");
    assert.equal(await repo.findByPublicId({ organizationId: orgB.id }, good.publicId), null);
    assert.deepEqual(await repo.listForReservation({ organizationId: orgB.id }, reservation.id), []);
    const deps = { booking: repo, payments: repo, now: () => now };
    const foreignScope = await reconcileVerifiedPayment(deps, {
      scope: { organizationId: orgB.id }, reservationId: reservation.id,
      paymentRequestPublicId: good.publicId, amountToman: amount,
    });
    assert.equal(foreignScope.isApplied, false);
    assert.equal((await db.hotelReservation.findUniqueOrThrow({ where: { id: reservation.id } })).paidAmount, BigInt(0));

    // Simulated evidence and unverified/malformed subjects must never settle.
    const simulated = await makeRequest("simulated-metadata", { metadata: { hotelReservationId: reservation.id, hotelPropertyId: property.id, simulated: true } });
    await verify(simulated, "simulated-metadata");
    const simulatedEvidence = await makeRequest("simulated-evidence");
    await verify(simulatedEvidence, "simulated-evidence", { verificationEvidence: { fixtureOnly: true, simulated: true } });
    const unverified = await makeRequest("unverified");
    await verify(unverified, "unverified", { verifiedAt: null });
    const wrongAmount = await makeRequest("wrong-amount", { amountToman: amount - BigInt(1) });
    await verify(wrongAmount, "wrong-amount");
    const wrongCurrency = await makeRequest("wrong-currency", { currency: "USD" });
    await verify(wrongCurrency, "wrong-currency");
    const expired = await makeRequest("expired", { expiresAt: new Date(now.getTime() - 20_000) });
    await verify(expired, "expired");
    const wrongGuest = await makeRequest("wrong-guest", { guestCustomerId: otherGuest.id });
    await verify(wrongGuest, "wrong-guest");
    const foreignTenantPayment = await db.paymentRequest.create({ data: {
      organizationId: orgB.id, providerIntegrationId: foreignIntegration.id,
      merchantAccountKey: `fixture-foreign-merchant-${token}`, credentialProfileKeySnapshot: `fixture-foreign-credential-${token}`,
      amountToman: amount, currency: "TOMAN", purpose: "RESERVATION_BALANCE", status: "PAID", paidAt: new Date(now.getTime() - 10_000), expiresAt: new Date(now.getTime() + 60 * 60_000),
      metadata: { hotelReservationId: reservation.id, hotelPropertyId: property.id }, publicId: `hotel-vpay-foreign-${token}`,
    } });
    paymentRequestIds.push(foreignTenantPayment.id); paymentPublicIds.push(foreignTenantPayment.publicId);
    await verify(foreignTenantPayment, "foreign-tenant");
    const tryApply = (publicId: string, reservationId = reservation.id, amountToman = amount) => reconcileVerifiedPayment(
      deps,
      { scope: { organizationId: orgA.id }, reservationId, paymentRequestPublicId: publicId, amountToman },
    );
    for (const bad of [simulated, simulatedEvidence, unverified, wrongAmount, wrongCurrency, expired, wrongGuest]) assert.equal((await tryApply(bad.publicId)).isApplied, false, `${bad.publicId} must not settle`);
    assert.equal((await tryApply(foreignTenantPayment.publicId)).isApplied, false, "a foreign tenant payment must not settle");
    assert.equal((await tryApply(good.publicId, `foreign-reservation-${token}`)).isApplied, false, "an unrelated reservation id must not settle");
    assert.equal((await db.hotelReservation.findUniqueOrThrow({ where: { id: reservation.id } })).paidAmount, BigInt(0));
    assert.equal(await db.hotelPaymentAllocation.count({ where: { hotelReservationId: reservation.id } }), 0);

    const wrongProperty = await makeRequest("wrong-property", { metadata: { hotelReservationId: reservation.id, hotelPropertyId: foreignProperty.id } });
    await verify(wrongProperty, "wrong-property");
    assert.equal(await repo.findByPublicId({ organizationId: orgA.id }, wrongProperty.publicId), null);
    assert.equal((await repo.listForReservation({ organizationId: orgA.id }, reservation.id)).some(row => row.paymentRequestPublicId === wrongProperty.publicId), false);
    assert.equal((await tryApply(wrongProperty.publicId)).isApplied, false);

    // Two simultaneous callbacks for one verified request produce one balance allocation.
    const callbackPaidAt = new Date(now.getTime() + 86_400_000); // Deliberately caller-supplied and forged.
    const race = await Promise.all([
      reconcileVerifiedPayment(deps, { scope: { organizationId: orgA.id }, reservationId: reservation.id, paymentRequestPublicId: good.publicId, amountToman: amount, paidAt: callbackPaidAt }),
      reconcileVerifiedPayment(deps, { scope: { organizationId: orgA.id }, reservationId: reservation.id, paymentRequestPublicId: good.publicId, amountToman: amount, paidAt: callbackPaidAt }),
    ]);
    assert.equal(race.filter(result => result.isApplied && !result.isIdempotentReplay).length, 1);
    assert.equal(race.filter(result => result.isApplied && result.isIdempotentReplay).length, 1);
    const settled = await db.hotelReservation.findUniqueOrThrow({ where: { id: reservation.id } });
    assert.equal(settled.status, "CONFIRMED");
    assert.equal(settled.paidAmount, amount);
    const allocations = await db.hotelPaymentAllocation.findMany({ where: { hotelReservationId: reservation.id } });
    assert.equal(allocations.length, 1);
    assert.equal(allocations[0].kind, "BALANCE");
    assert.equal(allocations[0].amountToman, amount);
    const persistedAttempt = await db.paymentProviderAttempt.findFirstOrThrow({ where: { paymentRequestId: good.id, status: "VERIFIED" } });
    const storedRequest = await db.paymentRequest.findUniqueOrThrow({ where: { id: good.id } });
    assert.equal(storedRequest.status, "PAID");
    assert.equal(storedRequest.paidAt?.getTime(), now.getTime() - 10_000, "repository leaves authoritative stored payment time unchanged");
    assert.ok(persistedAttempt.verifiedAt && persistedAttempt.verifiedAt < now, "verified evidence predates reconciliation");
    assert.equal(storedRequest.currency, "TOMAN");
    assert.equal(storedRequest.amountToman, amount);
    assert.equal(storedRequest.orderId, null);
    assert.equal(storedRequest.appointmentId, null);
    assert.equal(storedRequest.providerIntegrationId, integration.id);
    assert.equal(storedRequest.merchantAccountKey, `fixture-merchant-${token}`);
    assert.equal(storedRequest.credentialProfileKeySnapshot, `fixture-credential-${token}`);
    assert.equal(persistedAttempt.providerIntegrationId, storedRequest.providerIntegrationId);
    assert.equal(persistedAttempt.merchantAccountKey, storedRequest.merchantAccountKey);
    assert.equal(persistedAttempt.credentialProfileKeySnapshot, storedRequest.credentialProfileKeySnapshot);
    assert.equal((await tryApply(good.publicId)).isIdempotentReplay, true, "subsequent callback replay does not add money again");

    // A different already-paid request cannot double-settle the same booking.
    const second = await makeRequest("second", { status: "PAID", paidAt: now }); await verify(second, "second");
    assert.equal((await tryApply(second.publicId)).isApplied, false);
    assert.equal(await db.hotelPaymentAllocation.count({ where: { hotelReservationId: reservation.id } }), 1);

    // A cancellation that wins the reservation row lock is never overwritten by payment reconciliation.
    const cancelledReservation = await createReservation("cancel-race");
    const cancellationPayment = await db.paymentRequest.create({ data: {
      organizationId: orgA.id, guestCustomerId: guest.id, providerIntegrationId: integration.id,
      merchantAccountKey: `fixture-merchant-${token}`, credentialProfileKeySnapshot: `fixture-credential-${token}`,
      amountToman: amount, currency: "TOMAN", purpose: "RESERVATION_BALANCE", status: "PAID", paidAt: new Date(now.getTime() - 10_000), expiresAt: new Date(now.getTime() + 60 * 60_000),
      metadata: { hotelReservationId: cancelledReservation.id, hotelPropertyId: property.id }, publicId: `hotel-vpay-cancel-race-${token}`,
    } }); paymentRequestIds.push(cancellationPayment.id); paymentPublicIds.push(cancellationPayment.publicId);
    await verify(cancellationPayment, "cancel-race");
    let releaseCancellationLock!: () => void;
    let signalLockAcquired!: () => void;
    const lockAcquired = new Promise<void>(resolve => { signalLockAcquired = resolve; });
    const cancellationCanCommit = new Promise<void>(resolve => { releaseCancellationLock = resolve; });
    const cancellationTx = db.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "HotelReservation" WHERE "id" = ${cancelledReservation.id} FOR UPDATE`;
      signalLockAcquired();
      await cancellationCanCommit;
      await tx.hotelReservation.update({ where: { id: cancelledReservation.id }, data: { status: "CANCELLED", cancelledAt: now } });
    });
    await lockAcquired;
    const blockedSettlement = tryApply(cancellationPayment.publicId, cancelledReservation.id);
    await new Promise(resolve => setTimeout(resolve, 100));
    releaseCancellationLock();
    await cancellationTx;
    assert.equal((await blockedSettlement).isApplied, false);
    const cancelled = await db.hotelReservation.findUniqueOrThrow({ where: { id: cancelledReservation.id } });
    assert.equal(cancelled.status, "CANCELLED");
    assert.equal(cancelled.paidAmount, BigInt(0));
    assert.equal(await db.hotelPaymentAllocation.count({ where: { hotelReservationId: cancelledReservation.id } }), 0);
  } catch (error) {
    const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    console.error(`HOTEL_VERIFIED_PAYMENT_TEST_FAILURE=${detail.slice(0, 500)}`);
    throw error;
  } finally {
    try {
      if (orgIds.length) {
        await db.hotelPaymentAllocation.deleteMany({ where: { organizationId: { in: orgIds } } });
        await db.hotelReservationGuest.deleteMany({ where: { reservation: { organizationId: { in: orgIds } } } });
        await db.hotelReservationRoom.deleteMany({ where: { reservation: { organizationId: { in: orgIds } } } });
        await db.hotelReservation.deleteMany({ where: { organizationId: { in: orgIds } } });
        await db.hotelBookingHold.deleteMany({ where: { organizationId: { in: orgIds } } });
        await db.hotelInventory.deleteMany({ where: { organizationId: { in: orgIds } } });
        await db.paymentProviderAttempt.deleteMany({ where: { id: { in: attemptIds } } });
        await db.paymentRequest.deleteMany({ where: { id: { in: paymentRequestIds } } });
        await db.organizationIntegrationCapability.deleteMany({ where: { integrationId: { in: integrationIds } } });
        await db.organizationIntegration.deleteMany({ where: { id: { in: integrationIds } } });
        await db.guestCustomer.deleteMany({ where: { id: { in: guestIds } } });
        await db.hotelRatePlan.deleteMany({ where: { id: { in: ratePlanIds } } });
        await db.hotelRoomType.deleteMany({ where: { id: { in: roomTypeIds } } });
        await db.hotelProperty.deleteMany({ where: { id: { in: propertyIds } } });
        await db.organization.deleteMany({ where: { id: { in: orgIds } } });
        assert.equal(await db.hotelReservation.count({ where: { organizationId: { in: orgIds } } }), 0);
        assert.equal(await db.paymentRequest.count({ where: { publicId: { in: paymentPublicIds } } }), 0);
        console.log("HOTEL_VERIFIED_PAYMENT_CLEANUP=PASSED");
      }
    } finally { await db.$disconnect(); }
  }
});

