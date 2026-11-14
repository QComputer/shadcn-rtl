import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { HotelOperationalReservationService } from "../../lib/hotel/services/hotel-operational-reservation.service";
import { HotelStayRequestService } from "../../lib/hotel/services/hotel-stay-request.service";
import { createHotelOfflinePaymentService } from "../../lib/hotel/offline-payments/service";
import { createPrismaHotelOfflinePaymentRepository } from "../../lib/hotel/offline-payments/prisma-repository";

const enabled = process.env.HOTEL_OPERATIONAL_RESERVATION_ACCEPTANCE === "1";
const day = (value: string) => new Date(`${value}T00:00:00.000Z`);
const stay = { checkIn: "2027-12-10", checkOut: "2027-12-12", adults: 1, childAges: [] as number[] };
type OperationalResult = {
  simulated?: boolean;
  confirmationPolicy?: { manualConfirmationPolicy?: string; allowedOfflinePaymentMethods?: string[]; minimumVerifiedDepositAmount?: string | null };
  quote?: { id: string };
  hold?: { id: string };
  reservation?: { id: string; status: string; paymentMethod?: string | null; paidAmount?: string; confirmedAt?: string | Date | null };
  reservations?: Array<{ id: string; paymentMethod?: string | null }>;
  history?: Array<{ resultJson?: { actorUserId?: string; reservation?: { id: string } } }>;
};

function guardedConnection() {
  assert.notEqual(process.env.NODE_ENV, "production");
  assert.notEqual(process.env.VERCEL_ENV, "production");
  assert.ok(!process.env.VERCEL, "hosted execution is forbidden");
  assert.equal(process.env.HOTEL_GUEST_PORTAL_ENABLED, "1");
  assert.equal(process.env.DATABASE_RUNTIME_ADAPTER, "postgresql");
  assert.equal(process.env.LOCAL_PRISMA_EXPECTED_PORT, "55439");
  assert.equal(process.env.RETAIL_HERO_EXPECTED_DATABASE, "retail_hero_test");
  const url = new URL(process.env.DATABASE_URL ?? "https://missing.invalid");
  assert.ok(["postgres:", "postgresql:"].includes(url.protocol));
  assert.equal(url.hostname, "127.0.0.1"); assert.equal(url.port, "55439");
  assert.equal(url.pathname, "/retail_hero_test");
  assert.equal(decodeURIComponent(url.username), "hero_test");
  assert.equal(decodeURIComponent(url.password), "local_admin_fixture_only");
  assert.equal(url.search, ""); assert.equal(url.hash, "");
  assert.equal(process.env.DIRECT_URL, url.toString());
  return url;
}

test("operational reservations enforce tenant ownership, atomic inventory claims and reception lifecycle", {
  skip: !enabled, concurrency: false,
}, async () => {
  const connection = guardedConnection();
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: connection.toString(), max: 8 }), log: [] });
  const token = randomUUID().replaceAll("-", "").slice(0, 14);
  const orgs: string[] = [], users: string[] = [], properties: string[] = [], policies: string[] = [], roomTypes: string[] = [], rates: string[] = [], quotes: string[] = [];
  const originalOperational = process.env.HOTEL_OPERATIONAL_RESERVATIONS_ENABLED;
  const originalPortal = process.env.HOTEL_GUEST_PORTAL_ENABLED;
  let passed = false;
  let clock = new Date("2027-11-01T12:00:00.000Z");
  const now = () => new Date(clock);
  try {
    const identity = await db.$queryRaw<Array<{ database: string; role: string; port: number }>>`SELECT current_database()::text AS database, current_user::text AS role, inet_server_port() AS port`;
    assert.deepEqual(identity, [{ database: "retail_hero_test", role: "hero_test", port: 5432 }]);
    const [a, b] = await Promise.all(["a", "b"].map(suffix => db.organization.create({ data: {
      type: "SHOP", vertical: "HOTEL", name: `Operational ${suffix} ${token}`, slug: `hotel-operational-${suffix}-${token}`,
    } })));
    orgs.push(a.id, b.id);
    await db.organizationCapability.createMany({ data: [a, b].map(o => ({ organizationId: o.id, key: "HOTEL_BOOKING", status: "ACTIVE", enabledAt: now() })) });
    const customer = await db.user.create({ data: { name: `operational-customer-${token}`, password: "fixture-only", role: "CUSTOMER", isTeamMember: false } }); users.push(customer.id);
    const other = await db.user.create({ data: { name: `operational-other-${token}`, password: "fixture-only", role: "CUSTOMER", isTeamMember: false } }); users.push(other.id);
    const staff = await db.user.create({ data: { name: `operational-staff-${token}`, password: "fixture-only", role: "ADMIN", isTeamMember: true } }); users.push(staff.id);
    const foreignStaff = await db.user.create({ data: { name: `operational-foreign-${token}`, password: "fixture-only", role: "ADMIN", isTeamMember: true } }); users.push(foreignStaff.id);
    await db.customerClubMembership.createMany({ data: [a, b].map(o => ({ organizationId: o.id, customerId: customer.id, status: "ACTIVE", source: "PUBLIC_SHOP" })) });
    await db.customerClubMembership.create({ data: { organizationId: a.id, customerId: other.id, status: "ACTIVE", source: "PUBLIC_SHOP" } });
    await db.organizationMember.createMany({ data: [
      { organizationId: a.id, organizationSlug: a.slug, userId: staff.id, role: "ADMIN", isActive: true },
      { organizationId: b.id, organizationSlug: b.slug, userId: foreignStaff.id, role: "ADMIN", isActive: true },
    ] });
    const [pa, pb] = await Promise.all([a, b].map((o, i) => db.hotelProperty.create({ data: {
      organizationId: o.id, organizationSlug: o.slug, slug: `property-${i}-${token}`, name: `Operational ${i} ${token}`, timezone: "UTC",
    } }))); properties.push(pa.id, pb.id);
    const [policyA, policyB] = await Promise.all([pa, pb].map((p, i) => db.hotelCancellationPolicy.create({ data: {
      organizationId: i ? b.id : a.id, propertyId: p.id, key: `policy-${token}`, name: "Flexible", freeCancellationCutoffHours: 24, version: 1,
    } }))); policies.push(policyA.id, policyB.id);
    const [roomA, roomB] = await Promise.all([pa, pb].map((p, i) => db.hotelRoomType.create({ data: {
      organizationId: i ? b.id : a.id, propertyId: p.id, slug: `room-${token}`, name: "Room", maxAdults: 2, maxChildren: 1,
      maxOccupancy: 3, beds: [{ kind: "queen", count: 1 }], totalAllotment: 1,
    } }))); roomTypes.push(roomA.id, roomB.id);
    const [rateA, rateB] = await Promise.all([roomA, roomB].map((r, i) => db.hotelRatePlan.create({ data: {
      organizationId: i ? b.id : a.id, propertyId: i ? pb.id : pa.id, roomTypeId: r.id, code: `FLEX-${i}-${token}`, name: "Flexible",
      baseNightlyRate: BigInt(i ? 175000 : 125000), cancellationPolicyId: i ? policyB.id : policyA.id,
    } }))); rates.push(rateA.id, rateB.id);
    await db.hotelInventory.createMany({ data: ["2027-12-10", "2027-12-11"].map(date => ({
      organizationId: a.id, propertyId: pa.id, roomTypeId: roomA.id, date: day(date), allotment: 1,
    })).concat(["2027-12-10", "2027-12-11"].map(date => ({ organizationId: b.id, propertyId: pb.id, roomTypeId: roomB.id, date: day(date), allotment: 1 }))) });
    const service = new HotelOperationalReservationService(db, now);
    const guestA = { userId: customer.id, role: "CUSTOMER", organizationId: a.id, customerContextVerified: true } as const;
    const guestB = { ...guestA, organizationId: b.id } as const;
    const otherGuest = { userId: other.id, role: "CUSTOMER", organizationId: a.id, customerContextVerified: true } as const;
    const receptionist = { userId: staff.id, role: "ADMIN", organizationId: a.id } as const;
    const foreignReceptionist = { userId: foreignStaff.id, role: "ADMIN", organizationId: b.id } as const;
    await assert.rejects(() => service.configure(guestA, a.id, pa.id, { mode: "RESERVATION" }), /administrator|forbidden/i);
    await service.configure(receptionist, a.id, pa.id, { mode: "RESERVATION" });
    await service.configure(foreignReceptionist, b.id, pb.id, { mode: "RESERVATION" });
    process.env.HOTEL_OPERATIONAL_RESERVATIONS_ENABLED = "1"; process.env.HOTEL_GUEST_PORTAL_ENABLED = "1";
    assert.equal((await service.get(guestA, a.id, pa.id) as OperationalResult).confirmationPolicy?.manualConfirmationPolicy, "DISABLED", "manual confirmation is disabled by default");
    await assert.rejects(() => service.configure(receptionist, a.id, pa.id, { mode: "RESERVATION", manualConfirmationPolicy: "CASH_ON_ARRIVAL", allowedOfflinePaymentMethods: ["BANK_TRANSFER"], minimumVerifiedDepositAmount: null }), /cash-on-arrival/i);
    await assert.rejects(() => service.configure(receptionist, a.id, pa.id, { mode: "RESERVATION", manualConfirmationPolicy: "MINIMUM_VERIFIED_DEPOSIT", allowedOfflinePaymentMethods: ["BANK_TRANSFER"], minimumVerifiedDepositAmount: 0 }), /minimum deposit.*range/i);
    await assert.rejects(() => service.configure(receptionist, a.id, pa.id, { mode: "RESERVATION", manualConfirmationPolicy: "MINIMUM_VERIFIED_DEPOSIT", allowedOfflinePaymentMethods: ["BANK_TRANSFER"], minimumVerifiedDepositAmount: Number.MAX_SAFE_INTEGER + 1 }), /safe integer|number/i);
    const quote = async (actor: typeof guestA, org: string, property: string, roomTypeId: string, ratePlanId: string, key: string) => {
      const result = await service.execute(actor, org, property, { action: "quote", roomTypeId, ratePlanId, ...stay }, key) as OperationalResult;
      assert.equal(result.simulated, false); assert.ok(result.quote?.id); quotes.push(result.quote.id); return result.quote;
    };
    const q = await quote(guestA, a.id, pa.id, roomA.id, rateA.id, `quote-${token}-a`);
    await service.configure(receptionist, a.id, pa.id, { mode: "REQUEST_ONLY" });
    const beforeRequestOnly = await db.hotelInventoryIdempotency.count({ where: { organizationId: a.id, operationScope: "HOTEL_OPERATIONAL_ACTION" } });
    await assert.rejects(() => service.execute(guestA, a.id, pa.id, { action: "quote", roomTypeId: roomA.id, ratePlanId: rateA.id, ...stay }, `request-only-${token}`), /disabled/i);
    assert.equal(await db.hotelInventoryIdempotency.count({ where: { organizationId: a.id, operationScope: "HOTEL_OPERATIONAL_ACTION" } }), beforeRequestOnly);
    await service.configure(receptionist, a.id, pa.id, { mode: "RESERVATION" });
    process.env.HOTEL_OPERATIONAL_RESERVATIONS_ENABLED = "0";
    const beforeFlagOff = await db.hotelStayQuote.count({ where: { organizationId: a.id } });
    await assert.rejects(() => service.execute(guestA, a.id, pa.id, { action: "quote", roomTypeId: roomA.id, ratePlanId: rateA.id, ...stay }, `flag-off-${token}`), /disabled/i);
    assert.equal(await db.hotelStayQuote.count({ where: { organizationId: a.id } }), beforeFlagOff);
    process.env.HOTEL_OPERATIONAL_RESERVATIONS_ENABLED = "1";
    await assert.rejects(() => service.execute(otherGuest, a.id, pa.id, { action: "hold", quoteId: q.id }, `foreign-${token}-1`), /not found|forbidden/i);
    await assert.rejects(() => service.execute(guestB, b.id, pb.id, { action: "hold", quoteId: q.id }, `foreign-${token}-2`), /not found/i);
    const stalePriceQuote = await quote(guestA, a.id, pa.id, roomA.id, rateA.id, `quote-${token}-stale-price`);
    await db.hotelRatePlan.update({ where: { id: rateA.id }, data: { baseNightlyRate: BigInt(126000) } });
    await assert.rejects(() => service.execute(guestA, a.id, pa.id, { action: "hold", quoteId: stalePriceQuote.id }, `stale-price-${token}`), /quote changed/i);
    await db.hotelRatePlan.update({ where: { id: rateA.id }, data: { baseNightlyRate: BigInt(125000) } });
    const stalePolicyQuote = await quote(guestA, a.id, pa.id, roomA.id, rateA.id, `quote-${token}-stale-policy`);
    await db.hotelCancellationPolicy.update({ where: { id: policyA.id }, data: { version: { increment: 1 } } });
    await assert.rejects(() => service.execute(guestA, a.id, pa.id, { action: "hold", quoteId: stalePolicyQuote.id }, `stale-policy-${token}`), /quote changed/i);
    await db.hotelCancellationPolicy.update({ where: { id: policyA.id }, data: { version: 1 } });
    const competitors = await Promise.allSettled([q, await quote(guestA, a.id, pa.id, roomA.id, rateA.id, `quote-${token}-b`)].map((item, i) =>
      service.execute(guestA, a.id, pa.id, { action: "hold", quoteId: item.id }, `hold-${token}-${i}`)));
    assert.equal(competitors.filter(r => r.status === "fulfilled").length, 1,
      `only one quote can claim the last room on every night: ${competitors.map(r => r.status === "rejected" ? String(r.reason) : "fulfilled").join(" | ")}`);
    // A second inventory unit isolates the lifecycle/replay assertions from the contention assertion.
    await db.hotelInventory.updateMany({ where: { organizationId: a.id, roomTypeId: roomA.id, date: { in: [day("2027-12-10"), day("2027-12-11")] } }, data: { allotment: 2 } });
    const lifecycleQuote = await quote(guestA, a.id, pa.id, roomA.id, rateA.id, `quote-${token}-life`);
    const holdResult = await service.execute(guestA, a.id, pa.id, { action: "hold", quoteId: lifecycleQuote.id }, `hold-${token}-life`) as OperationalResult;
    assert.ok(holdResult.hold?.id); assert.equal(holdResult.simulated, false);
    const guests = [{ fullName: `Primary ${token}`, isPrimary: true }];
    const reserve = await service.execute(guestA, a.id, pa.id, { action: "reserve", quoteId: lifecycleQuote.id, holdId: holdResult.hold.id, guests }, `reserve-${token}-life`) as OperationalResult;
    assert.equal(reserve.reservation?.status, "PENDING_PAYMENT"); assert.equal(reserve.simulated, false);
    const replay = await service.execute(guestA, a.id, pa.id, { action: "reserve", quoteId: lifecycleQuote.id, holdId: holdResult.hold.id, guests }, `reserve-${token}-replay`) as OperationalResult;
    assert.equal(replay.reservation.id, reserve.reservation.id, "repeat reserve command resolves to the same reservation");
    const guestView = await service.get(guestA, a.id, pa.id) as OperationalResult;
    assert.ok(guestView.reservations?.some(row => row.id === reserve.reservation!.id));
    assert.equal(guestView.reservations?.find(row => row.id === reserve.reservation!.id)?.paymentMethod, null);
    assert.ok(guestView.history?.length, "guest sees their own operational history");
    assert.ok(guestView.history?.every(row => row.resultJson?.actorUserId === customer.id), "guest history excludes other actors");
    const staffView = await service.get(receptionist, a.id, pa.id) as OperationalResult;
    assert.ok(staffView.history?.some(row => row.resultJson?.reservation?.id === reserve.reservation!.id));
    await assert.rejects(() => service.execute(receptionist, a.id, pa.id, { action: "confirm-reservation", reservationId: reserve.reservation.id }, `confirm-disabled-${token}`), /disabled|select an enabled/i);
    await service.configure(receptionist, a.id, pa.id, { mode: "RESERVATION", manualConfirmationPolicy: "CASH_ON_ARRIVAL", allowedOfflinePaymentMethods: ["CASH", "BANK_TRANSFER"], minimumVerifiedDepositAmount: null });
    await assert.rejects(() => service.execute(otherGuest, a.id, pa.id, { action: "select-payment-method", reservationId: reserve.reservation.id, method: "CASH" }, `other-select-${token}`), /not found/i);
    const selectedTransferWithoutPayment = await service.execute(guestA, a.id, pa.id, { action: "select-payment-method", reservationId: reserve.reservation.id, method: "BANK_TRANSFER" }, `select-transfer-unpaid-${token}`) as OperationalResult;
    assert.equal(selectedTransferWithoutPayment.reservation?.paymentMethod, "BANK_TRANSFER");
    await assert.rejects(() => service.execute(receptionist, a.id, pa.id, { action: "confirm-reservation", reservationId: reserve.reservation.id }, `confirm-transfer-unpaid-${token}`), /full payment/i);
    const selectedCash = await service.execute(guestA, a.id, pa.id, { action: "select-payment-method", reservationId: reserve.reservation.id, method: "CASH" }, `select-cash-${token}`) as OperationalResult;
    assert.equal(selectedCash.reservation?.paymentMethod, "CASH");
    assert.deepEqual(await service.execute(guestA, a.id, pa.id, { action: "select-payment-method", reservationId: reserve.reservation.id, method: "CASH" }, `select-cash-${token}`), selectedCash, "payment selection is replayable from the existing audit history");
    const confirmationRace = await Promise.allSettled([
      service.execute(receptionist, a.id, pa.id, { action: "confirm-reservation", reservationId: reserve.reservation.id }, `confirm-cash-a-${token}`),
      service.execute(receptionist, a.id, pa.id, { action: "confirm-reservation", reservationId: reserve.reservation.id }, `confirm-cash-b-${token}`),
    ]);
    assert.equal(confirmationRace.filter(result => result.status === "fulfilled").length, 1, "only one concurrent confirmation wins the pending-state CAS");
    const zeroDepositConfirmation = (confirmationRace.find(result => result.status === "fulfilled") as PromiseFulfilledResult<OperationalResult>).value;
    assert.equal(zeroDepositConfirmation.reservation?.status, "CONFIRMED", "cash-on-arrival permits confirmation without a deposit");
    assert.equal((await db.hotelReservation.findUniqueOrThrow({ where: { id: reserve.reservation.id } })).paidAmount, BigInt(0), "confirmation does not change the payment balance");
    await assert.rejects(() => service.execute(foreignReceptionist, a.id, pa.id, { action: "cancel", reservationId: reserve.reservation.id }, `foreign-cancel-${token}`), /forbidden|not found/i);
    const cancelled = await service.execute(guestA, a.id, pa.id, { action: "cancel", reservationId: reserve.reservation.id }, `cancel-${token}`) as OperationalResult;
    assert.equal(cancelled.reservation.status, "CANCELLED");
    const stock = await db.hotelInventory.findMany({ where: { organizationId: a.id, roomTypeId: roomA.id }, orderBy: { date: "asc" } });
    assert.ok(stock.every(row => row.booked === 0 && row.held === 1), "cancellation releases its claim while the competing hold remains active");

    await db.hotelInventory.updateMany({ where: { organizationId: a.id, roomTypeId: roomA.id }, data: { allotment: 4 } });
    const fullTransferQuote = await quote(guestA, a.id, pa.id, roomA.id, rateA.id, `quote-${token}-full-transfer`);
    const fullTransferHold = await service.execute(guestA, a.id, pa.id, { action: "hold", quoteId: fullTransferQuote.id }, `hold-${token}-full-transfer`) as OperationalResult;
    const fullTransferReservation = await service.execute(guestA, a.id, pa.id, { action: "reserve", quoteId: fullTransferQuote.id, holdId: fullTransferHold.hold!.id, guests }, `reserve-${token}-full-transfer`) as OperationalResult;
    await service.execute(guestA, a.id, pa.id, { action: "select-payment-method", reservationId: fullTransferReservation.reservation!.id, method: "BANK_TRANSFER" }, `select-transfer-full-${token}`);
    const fullAmount = (await db.hotelReservation.findUniqueOrThrow({ where: { id: fullTransferReservation.reservation!.id } })).totalAmount;
    await db.hotelOfflinePayment.create({ data: { id: `verified-full-${token}`, organizationId: a.id, reservationId: fullTransferReservation.reservation!.id, method: "BANK_TRANSFER", status: "VERIFIED", amountToman: fullAmount, recordedByUserId: customer.id, verifiedByUserId: staff.id, verifiedAt: now(), bankReference: `verified-full-${token}` } });
    await db.hotelReservation.update({ where: { id: fullTransferReservation.reservation!.id }, data: { paidAmount: fullAmount } });
    const fullTransferConfirmation = await service.execute(receptionist, a.id, pa.id, { action: "confirm-reservation", reservationId: fullTransferReservation.reservation!.id }, `confirm-transfer-full-${token}`) as OperationalResult;
    assert.equal(fullTransferConfirmation.reservation?.status, "CONFIRMED", "cash-on-arrival policy also allows bank transfer after verified full payment");
    await service.execute(guestA, a.id, pa.id, { action: "cancel", reservationId: fullTransferReservation.reservation!.id }, `cancel-full-transfer-${token}`);

    await db.hotelInventory.updateMany({ where: { organizationId: a.id, roomTypeId: roomA.id }, data: { allotment: 4 } });
    const expiringQuote = await quote(guestA, a.id, pa.id, roomA.id, rateA.id, `quote-${token}-expiring-hold`);
    const activeHold = await service.execute(guestA, a.id, pa.id, { action: "hold", quoteId: expiringQuote.id }, `hold-${token}-expiring`) as OperationalResult;
    const pendingQuote = await quote(guestA, a.id, pa.id, roomA.id, rateA.id, `quote-${token}-expiring-reservation`);
    const pendingHold = await service.execute(guestA, a.id, pa.id, { action: "hold", quoteId: pendingQuote.id }, `hold-${token}-pending`) as OperationalResult;
    const pending = await service.execute(guestA, a.id, pa.id, { action: "reserve", quoteId: pendingQuote.id, holdId: pendingHold.hold!.id, guests }, `reserve-${token}-pending`) as OperationalResult;
    const expiryKey = `expire:${pending.reservation!.id}`;
    await quote(guestA, a.id, pa.id, roomA.id, rateA.id, expiryKey);
    assert.ok(await db.hotelInventoryIdempotency.findUnique({ where: { organizationId_operationScope_idempotencyKey: {
      organizationId: a.id, operationScope: "HOTEL_OPERATIONAL_ACTION", idempotencyKey: expiryKey,
    } } }), "a customer can own the former system-expiry key in the client action namespace");
    clock = new Date(clock.getTime() + 11 * 60_000);
    await service.get(guestA, a.id, pa.id); // request-driven expiry sweep
    const [releasedHold, consumedHold, expiredReservation] = await Promise.all([
      db.hotelBookingHold.findUniqueOrThrow({ where: { id: activeHold.hold!.id } }),
      db.hotelBookingHold.findUniqueOrThrow({ where: { id: pendingHold.hold!.id } }),
      db.hotelReservation.findUniqueOrThrow({ where: { id: pending.reservation!.id } }),
    ]);
    assert.equal(releasedHold.status, "EXPIRED", "expired active hold is released by the request sweep");
    assert.equal(consumedHold.status, "CONSUMED");
    assert.equal(expiredReservation.status, "EXPIRED", "expired pending reservation is atomically cancelled");
    await assert.rejects(() => service.execute(guestA, a.id, pa.id, { action: "select-payment-method", reservationId: pending.reservation!.id, method: "CASH" }, `select-expired-${token}`), /not found|pending/i);
    await assert.rejects(() => service.execute(receptionist, a.id, pa.id, { action: "confirm-reservation", reservationId: pending.reservation!.id }, `confirm-expired-${token}`), /not found|pending/i);
    const finalStock = await db.hotelInventory.findMany({ where: { organizationId: a.id, roomTypeId: roomA.id } });
    assert.ok(finalStock.every(row => row.booked === 0 && row.held === 0), "both expiry paths release every night claim");

    await db.hotelInventory.updateMany({ where: { organizationId: a.id, roomTypeId: roomA.id }, data: { allotment: 4 } });
    await service.configure(receptionist, a.id, pa.id, { mode: "RESERVATION", manualConfirmationPolicy: "MINIMUM_VERIFIED_DEPOSIT", allowedOfflinePaymentMethods: ["BANK_TRANSFER", "CASH"], minimumVerifiedDepositAmount: 50_000 });
    const depositQuote = await quote(guestA, a.id, pa.id, roomA.id, rateA.id, `quote-${token}-minimum-deposit`);
    const depositHold = await service.execute(guestA, a.id, pa.id, { action: "hold", quoteId: depositQuote.id }, `hold-${token}-minimum-deposit`) as OperationalResult;
    const depositReservation = await service.execute(guestA, a.id, pa.id, { action: "reserve", quoteId: depositQuote.id, holdId: depositHold.hold!.id, guests }, `reserve-${token}-minimum-deposit`) as OperationalResult;
    await service.execute(guestA, a.id, pa.id, { action: "select-payment-method", reservationId: depositReservation.reservation!.id, method: "BANK_TRANSFER" }, `select-transfer-${token}`);
    const payments = createHotelOfflinePaymentService({ repository: createPrismaHotelOfflinePaymentRepository(db), now });
    const transfer = await payments.submitBankTransfer({ actor: { organizationId: a.id, userId: customer.id, permissions: ["hotel:offline-payment:submit-transfer"] }, reservationId: depositReservation.reservation!.id, amountToman: BigInt(50_000), bankReference: `unverified-${token}`, idempotencyKey: `submit-deposit-${token}` });
    assert.equal(transfer.outcome, "APPLIED");
    if (transfer.outcome !== "APPLIED") throw new Error("Transfer fixture was not submitted");
    await assert.rejects(() => service.execute(receptionist, a.id, pa.id, { action: "confirm-reservation", reservationId: depositReservation.reservation!.id }, `confirm-unverified-${token}`), /minimum verified deposit/i);
    const verification = await payments.verifyBankTransfer({ actor: { organizationId: a.id, userId: staff.id, permissions: ["hotel:offline-payment:verify-transfer"] }, reservationId: depositReservation.reservation!.id, ledgerEntryId: transfer.entry.id, idempotencyKey: `verify-deposit-${token}` });
    assert.equal(verification.outcome, "APPLIED");
    const depositedConfirmation = await service.execute(receptionist, a.id, pa.id, { action: "confirm-reservation", reservationId: depositReservation.reservation!.id }, `confirm-verified-${token}`) as OperationalResult;
    assert.equal(depositedConfirmation.reservation?.status, "CONFIRMED", "only the verified reservation balance satisfies minimum deposit policy");

    // Synthetic confirmation is test-only fixture setup; no gateway or payment request is involved.
    await db.hotelInventory.updateMany({ where: { organizationId: a.id, roomTypeId: roomA.id }, data: { allotment: 4 } });
    const [roomOne, roomTwo] = await Promise.all(["101", "102"].map(code => db.hotelRoom.create({ data: {
      organizationId: a.id, propertyId: pa.id, roomTypeId: roomA.id, code,
    } })));
    const makeConfirmedReservation = async (suffix: string) => {
      const reservationQuote = await quote(guestA, a.id, pa.id, roomA.id, rateA.id, `quote-${token}-${suffix}`);
      const reservationHold = await service.execute(guestA, a.id, pa.id, { action: "hold", quoteId: reservationQuote.id }, `hold-${token}-${suffix}`) as OperationalResult;
      const created = await service.execute(guestA, a.id, pa.id, { action: "reserve", quoteId: reservationQuote.id, holdId: reservationHold.hold!.id, guests }, `reserve-${token}-${suffix}`) as OperationalResult;
      const persisted = await db.hotelReservation.update({ where: { id: created.reservation!.id }, data: {
        status: "CONFIRMED", paidAmount: BigInt(created.reservation!.status === "PENDING_PAYMENT" ? "250000" : "0"), confirmedAt: now(),
      } });
      return persisted;
    };
    const confirmedOne = await makeConfirmedReservation("reception-one");
    const confirmedTwo = await makeConfirmedReservation("reception-two");
    await assert.rejects(() => service.execute(guestA, a.id, pa.id, { action: "assign-room", reservationId: confirmedOne.id, roomId: roomOne.id }, `guest-assign-${token}`), /reception|forbidden/i);
    await assert.rejects(() => service.execute(receptionist, a.id, pa.id, { action: "check-in", reservationId: confirmedOne.id }, `missing-room-${token}`), /assign a room/i);
    await assert.rejects(() => service.execute(receptionist, a.id, pa.id, { action: "check-out", reservationId: confirmedOne.id }, `early-checkout-${token}`), /invalid reception transition/i);
    const assigned = await service.execute(receptionist, a.id, pa.id, { action: "assign-room", reservationId: confirmedOne.id, roomId: roomOne.id }, `assign-room-one-${token}`) as OperationalResult;
    assert.equal(assigned.reservation?.id, confirmedOne.id);
    await assert.rejects(() => service.execute(receptionist, a.id, pa.id, { action: "assign-room", reservationId: confirmedTwo.id, roomId: roomOne.id }, `assign-overlap-${token}`), /already assigned/i);
    await service.execute(receptionist, a.id, pa.id, { action: "assign-room", reservationId: confirmedTwo.id, roomId: roomTwo.id }, `assign-room-two-${token}`);
    const checkedIn = await service.execute(receptionist, a.id, pa.id, { action: "check-in", reservationId: confirmedOne.id }, `check-in-${token}`) as OperationalResult;
    assert.equal(checkedIn.reservation?.status, "CHECKED_IN");
    await assert.rejects(() => service.execute(guestA, a.id, pa.id, { action: "check-out", reservationId: confirmedOne.id }, `guest-checkout-${token}`), /reception|forbidden/i);
    const checkedOut = await service.execute(receptionist, a.id, pa.id, { action: "check-out", reservationId: confirmedOne.id }, `check-out-${token}`) as OperationalResult;
    assert.equal(checkedOut.reservation?.status, "CHECKED_OUT");

    const stayRequests = new HotelStayRequestService(db, now);
    await stayRequests.configure(receptionist, a.id, pa.id, { mode: "REQUEST_ONLY" });
    const enquiryQuote = await stayRequests.execute(guestA, a.id, pa.id, { action: "quote", roomTypeId: roomA.id, ratePlanId: rateA.id, ...stay }, `enquiry-quote-${token}`);
    assert.ok(enquiryQuote.quote?.id);
    const enquiry = await stayRequests.execute(guestA, a.id, pa.id, { action: "request", quoteId: enquiryQuote.quote!.id, guestName: `Enquirer ${token}` }, `enquiry-request-${token}`);
    assert.ok(enquiry.request?.id);
    await service.configure(receptionist, a.id, pa.id, { mode: "RESERVATION" });
    const convertedQuote = await service.execute(guestA, a.id, pa.id, { action: "quote-request", requestId: enquiry.request!.id }, `convert-request-${token}`) as OperationalResult;
    assert.ok(convertedQuote.quote?.id);
    assert.equal(convertedQuote.simulated, false);
    await assert.rejects(() => service.execute(otherGuest, a.id, pa.id, { action: "quote-request", requestId: enquiry.request!.id }, `foreign-request-${token}`), /request not found/i);
    await assert.rejects(() => service.execute(guestB, b.id, pb.id, { action: "quote-request", requestId: enquiry.request!.id }, `cross-tenant-request-${token}`), /request not found/i);
    passed = true;
  } finally {
    process.env.HOTEL_OPERATIONAL_RESERVATIONS_ENABLED = originalOperational;
    process.env.HOTEL_GUEST_PORTAL_ENABLED = originalPortal;
    try {
      if (orgs.length) {
        await db.hotelInventoryIdempotency.deleteMany({ where: { organizationId: { in: orgs } } });
        await db.hotelStayRequest.deleteMany({ where: { organizationId: { in: orgs } } });
        await db.hotelOfflinePaymentCommandIdempotency.deleteMany({ where: { organizationId: { in: orgs } } });
        await db.hotelOfflinePayment.deleteMany({ where: { organizationId: { in: orgs } } });
        await db.hotelReservation.deleteMany({ where: { organizationId: { in: orgs } } });
        await db.hotelBookingHold.deleteMany({ where: { organizationId: { in: orgs } } });
        await db.hotelStayQuote.deleteMany({ where: { organizationId: { in: orgs } } });
        await db.hotelInventory.deleteMany({ where: { organizationId: { in: orgs } } });
        await db.hotelRatePlan.deleteMany({ where: { id: { in: rates } } });
        await db.hotelCancellationPolicy.deleteMany({ where: { id: { in: policies } } });
        await db.hotelRoom.deleteMany({ where: { organizationId: { in: orgs } } });
        await db.hotelRoomType.deleteMany({ where: { id: { in: roomTypes } } });
        await db.hotelProperty.deleteMany({ where: { id: { in: properties } } });
        await db.customerClubMembership.deleteMany({ where: { organizationId: { in: orgs }, customerId: { in: users } } });
        await db.organizationMember.deleteMany({ where: { organizationId: { in: orgs }, userId: { in: users } } });
        await db.organizationCapability.deleteMany({ where: { organizationId: { in: orgs } } });
        await db.organization.deleteMany({ where: { id: { in: orgs } } }); await db.user.deleteMany({ where: { id: { in: users } } });
        assert.equal(await db.hotelInventoryIdempotency.count({ where: { organizationId: { in: orgs } } }), 0);
        assert.equal(await db.hotelReservation.count({ where: { organizationId: { in: orgs } } }), 0);
        assert.equal(await db.hotelBookingHold.count({ where: { organizationId: { in: orgs } } }), 0);
        assert.equal(await db.hotelStayQuote.count({ where: { organizationId: { in: orgs } } }), 0);
        assert.equal(await db.organization.count({ where: { id: { in: orgs } } }), 0);
        assert.equal(await db.user.count({ where: { id: { in: users } } }), 0);
      }
      if (passed) console.log("HOTEL_OPERATIONAL_RESERVATION_CLEANUP=PASSED");
      await db.$disconnect();
    } catch (error) { await db.$disconnect(); throw error; }
  }
});
