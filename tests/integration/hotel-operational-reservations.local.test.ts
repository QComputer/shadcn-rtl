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
function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
async function waitForPostgresLockWait(db: PrismaClient, queryIncludes: string) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const rows = await db.$queryRaw<Array<{ query: string }>>`SELECT query FROM pg_stat_activity WHERE datname=current_database() AND pid <> pg_backend_pid() AND wait_event_type='Lock'`;
    if (rows.some((row) => row.query.includes(queryIncludes))) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Timed out waiting for a verified PostgreSQL lock wait: ${queryIncludes}`);
}
async function waitForAdvisoryBarrierWait(db: PrismaClient, key: string) {
  const keyValue = BigInt(key);
  const classId = keyValue >> BigInt(32);
  const objectId = keyValue & BigInt("4294967295");
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const rows = await db.$queryRaw<Array<{ waiting: boolean }>>`SELECT EXISTS (
      SELECT 1 FROM pg_locks WHERE locktype='advisory' AND NOT granted
        AND classid=${classId}::oid AND objid=${objectId}::oid AND objsubid=1
    ) AS waiting`;
    if (rows[0]?.waiting) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("Timed out waiting for the test trigger to reach its PostgreSQL advisory barrier.");
}
type OperationalResult = {
  simulated?: boolean;
  confirmationPolicy?: { manualConfirmationPolicy?: string; allowedOfflinePaymentMethods?: string[]; minimumVerifiedDepositAmount?: string | null; pendingPaymentMinutes?: number };
  quote?: { id: string };
  hold?: { id: string };
  reservation?: { id: string; status: string; paymentMethod?: string | null; paidAmount?: string; confirmedAt?: string | Date | null };
  reservations?: Array<{ id: string; paymentMethod?: string | null }>;
  history?: Array<{ resultJson?: { actorUserId?: string; reservation?: { id: string } } }>;
};
type ManualResult = { reservationId: string; reference: string; status: string; totalAmount: string; currency: string; source: string; paymentStatus: string };

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
  const originalManual = process.env.HOTEL_MANUAL_ROOM_MANAGEMENT_ENABLED;
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
    assert.equal((await service.get(guestA, a.id, pa.id) as OperationalResult).confirmationPolicy?.pendingPaymentMinutes, 15, "pending payment deadline defaults to 15 minutes");
    await assert.rejects(() => service.configure(receptionist, a.id, pa.id, { mode: "RESERVATION", manualConfirmationPolicy: "CASH_ON_ARRIVAL", allowedOfflinePaymentMethods: ["BANK_TRANSFER"], minimumVerifiedDepositAmount: null }), /cash-on-arrival/i);
    await assert.rejects(() => service.configure(receptionist, a.id, pa.id, { mode: "RESERVATION", manualConfirmationPolicy: "MINIMUM_VERIFIED_DEPOSIT", allowedOfflinePaymentMethods: ["BANK_TRANSFER"], minimumVerifiedDepositAmount: 0 }), /minimum deposit.*range/i);
    await assert.rejects(() => service.configure(receptionist, a.id, pa.id, { mode: "RESERVATION", manualConfirmationPolicy: "MINIMUM_VERIFIED_DEPOSIT", allowedOfflinePaymentMethods: ["BANK_TRANSFER"], minimumVerifiedDepositAmount: Number.MAX_SAFE_INTEGER + 1 }), /safe integer|number/i);
    await assert.rejects(() => service.configure(receptionist, a.id, pa.id, { mode: "RESERVATION", pendingPaymentMinutes: 4 }), /too small|pendingPaymentMinutes/i);
    await assert.rejects(() => service.configure(receptionist, a.id, pa.id, { mode: "RESERVATION", pendingPaymentMinutes: 10081 }), /too big|pendingPaymentMinutes/i);
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
    assert.equal((await db.hotelBookingHold.findUniqueOrThrow({ where: { id: holdResult.hold.id } })).expiresAt.getTime(), clock.getTime() + 15 * 60_000, "conversion extends the consumed hold to the default payment deadline");
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
    const pendingPolicy = await service.configure(receptionist, a.id, pa.id, { mode: "RESERVATION", pendingPaymentMinutes: 5 });
    assert.equal(pendingPolicy.pendingPaymentMinutes, 5);
    assert.equal((await service.get(guestA, a.id, pa.id) as OperationalResult).confirmationPolicy?.pendingPaymentMinutes, 5, "configured deadline is returned after reloading policy");
    const pendingQuote = await quote(guestA, a.id, pa.id, roomA.id, rateA.id, `quote-${token}-expiring-reservation`);
    const pendingHold = await service.execute(guestA, a.id, pa.id, { action: "hold", quoteId: pendingQuote.id }, `hold-${token}-pending`) as OperationalResult;
    const pending = await service.execute(guestA, a.id, pa.id, { action: "reserve", quoteId: pendingQuote.id, holdId: pendingHold.hold!.id, guests }, `reserve-${token}-pending`) as OperationalResult;
    const pendingExpiry = (await db.hotelBookingHold.findUniqueOrThrow({ where: { id: pendingHold.hold!.id } })).expiresAt;
    assert.equal(pendingExpiry.getTime(), clock.getTime() + 5 * 60_000, "consumed hold receives the configured pending deadline atomically");
    const expiryKey = `expire:${pending.reservation!.id}`;
    await quote(guestA, a.id, pa.id, roomA.id, rateA.id, expiryKey);
    assert.ok(await db.hotelInventoryIdempotency.findUnique({ where: { organizationId_operationScope_idempotencyKey: {
      organizationId: a.id, operationScope: "HOTEL_OPERATIONAL_ACTION", idempotencyKey: expiryKey,
    } } }), "a customer can own the former system-expiry key in the client action namespace");
    clock = new Date(clock.getTime() + 6 * 60_000);
    const replayAfterDeadline = await service.execute(guestA, a.id, pa.id, { action: "reserve", quoteId: pendingQuote.id, holdId: pendingHold.hold!.id, guests }, `reserve-${token}-pending-replay-after-deadline`) as OperationalResult;
    assert.equal(replayAfterDeadline.reservation?.id, pending.reservation?.id, "reservation replay keeps the original result");
    assert.equal((await db.hotelBookingHold.findUniqueOrThrow({ where: { id: pendingHold.hold!.id } })).expiresAt.getTime(), pendingExpiry.getTime(), "replay never extends or resurrects an expired payment deadline");
    await assert.rejects(() => service.execute(guestA, a.id, pa.id, { action: "select-payment-method", reservationId: pending.reservation!.id, method: "CASH" }, `select-before-expiry-sweep-${token}`), /reservation hold expired/i);
    await assert.rejects(() => service.execute(receptionist, a.id, pa.id, { action: "confirm-reservation", reservationId: pending.reservation!.id }, `confirm-before-expiry-sweep-${token}`), /reservation hold expired/i);
    clock = new Date(clock.getTime() + 5 * 60_000);
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

    const createRaceFixture = async (suffix: string) => {
      const q = await quote(guestA, a.id, pa.id, roomA.id, rateA.id, `quote-${token}-${suffix}`);
      const h = await service.execute(guestA, a.id, pa.id, { action: "hold", quoteId: q.id }, `hold-${token}-${suffix}`) as OperationalResult;
      const created = await service.execute(guestA, a.id, pa.id, { action: "reserve", quoteId: q.id, holdId: h.hold!.id, guests }, `reserve-${token}-${suffix}`) as OperationalResult;
      const id = created.reservation!.id;
      await service.execute(guestA, a.id, pa.id, { action: "select-payment-method", reservationId: id, method: "BANK_TRANSFER" }, `select-${token}-${suffix}`);
      const submitted = await payments.submitBankTransfer({ actor: { organizationId: a.id, userId: customer.id, permissions: ["hotel:offline-payment:submit-transfer"] }, reservationId: id, amountToman: BigInt(10_000), bankReference: `race-${token}-${suffix}`, idempotencyKey: `submit-${token}-${suffix}` });
      assert.equal(submitted.outcome, "APPLIED");
      if (submitted.outcome !== "APPLIED") throw new Error("Race transfer fixture was not submitted");
      return { id, entryId: submitted.entry.id };
    };
    const installBarrierTrigger = async (table: "HotelReservation" | "HotelOfflinePayment", rowId: string, field: "status", value: string, key: string) => {
      const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
      const fn = `hotel_race_barrier_fn_${suffix}`;
      const trigger = `hotel_race_barrier_${suffix}`;
      await db.$executeRawUnsafe(`CREATE FUNCTION public."${fn}"() RETURNS trigger LANGUAGE plpgsql AS $body$ BEGIN IF NEW."id" = '${rowId}' AND NEW."${field}"::text = '${value}' THEN PERFORM pg_advisory_xact_lock(${key}); END IF; RETURN NEW; END $body$`);
      try { await db.$executeRawUnsafe(`CREATE TRIGGER "${trigger}" BEFORE UPDATE ON public."${table}" FOR EACH ROW EXECUTE FUNCTION public."${fn}"()`); }
      catch (error) { await db.$executeRawUnsafe(`DROP FUNCTION IF EXISTS public."${fn}"()`); throw error; }
      return async () => { await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${trigger}" ON public."${table}"`); await db.$executeRawUnsafe(`DROP FUNCTION IF EXISTS public."${fn}"()`); };
    };
    const acquireBarrier = async (key: string) => {
      const held = deferred();
      const release = deferred();
      const transaction = db.$transaction(async (tx) => {
        await tx.$queryRawUnsafe(`SELECT pg_advisory_xact_lock(${key}) IS NULL AS acquired`);
        held.resolve();
        await release.promise;
      }, { maxWait: 5_000, timeout: 25_000 });
      await held.promise;
      return async () => { release.resolve(); await transaction; };
    };
    const verifyActor = { organizationId: a.id, userId: staff.id, permissions: ["hotel:offline-payment:verify-transfer"] as const };
    const inventoryForStay = () => db.hotelInventory.findMany({ where: { organizationId: a.id, propertyId: pa.id, roomTypeId: roomA.id, date: { gte: day(stay.checkIn), lt: day(stay.checkOut) } }, orderBy: { date: "asc" } });

    // Ordering A: cancellation owns the reservation lock before verification starts.
    const cancelFirst = await createRaceFixture("cancel-lock-first");
    const cancelFirstBefore = await inventoryForStay();
    const cancelLockKey = BigInt(`0x${randomUUID().replaceAll("-", "").slice(0, 12)}`).toString();
    const removeCancelBarrier = await installBarrierTrigger("HotelReservation", cancelFirst.id, "status", "CANCELLED", cancelLockKey);
    const releaseCancelBarrier = await acquireBarrier(cancelLockKey);
    let cancelFirstTask!: Promise<unknown>;
    let verifyAfterCancelTask!: ReturnType<typeof payments.verifyBankTransfer>;
    try {
      cancelFirstTask = service.execute(guestA, a.id, pa.id, { action: "cancel", reservationId: cancelFirst.id }, `cancel-${token}-lock-first`);
      await waitForAdvisoryBarrierWait(db, cancelLockKey);
      verifyAfterCancelTask = payments.verifyBankTransfer({ actor: verifyActor, reservationId: cancelFirst.id, ledgerEntryId: cancelFirst.entryId, idempotencyKey: `verify-${token}-cancel-first` });
      await waitForPostgresLockWait(db, 'FROM "HotelReservation"');
    } finally { await releaseCancelBarrier(); await removeCancelBarrier(); }
    const cancelFirstResult = await cancelFirstTask as OperationalResult;
    const verifyAfterCancel = await verifyAfterCancelTask!;
    assert.equal(cancelFirstResult.reservation?.status, "CANCELLED");
    assert.equal(verifyAfterCancel.outcome, "PAYMENT_NOT_PENDING");
    const cancelFirstRow = await db.hotelReservation.findUniqueOrThrow({ where: { id: cancelFirst.id } });
    const cancelFirstEntry = await db.hotelOfflinePayment.findUniqueOrThrow({ where: { id: cancelFirst.entryId } });
    assert.equal(cancelFirstRow.status, "CANCELLED"); assert.equal(cancelFirstRow.paidAmount, BigInt(0));
    assert.equal(cancelFirstEntry.status, "SUBMITTED"); assert.equal(cancelFirstEntry.verifiedAt, null);
    assert.equal(await db.hotelOfflinePaymentAuditEvent.count({ where: { organizationId: a.id, ledgerEntryId: cancelFirst.entryId, eventType: "BANK_TRANSFER_VERIFIED" } }), 0);
    assert.equal(await db.hotelOfflinePaymentAuditEvent.count({ where: { organizationId: a.id, ledgerEntryId: cancelFirst.entryId, eventType: "BANK_TRANSFER_SUBMITTED" } }), 1);
    assert.ok(cancelFirstRow.holdId);
    assert.equal((await db.hotelBookingHold.findUniqueOrThrow({ where: { id: cancelFirstRow.holdId } })).status, "CONSUMED", "the consumed hold remains historical; booked inventory is released exactly once");
    const cancelAudit = await db.hotelInventoryIdempotency.findUnique({ where: { organizationId_operationScope_idempotencyKey: { organizationId: a.id, operationScope: "HOTEL_OPERATIONAL_ACTION", idempotencyKey: `cancel-${token}-lock-first` } } });
    assert.equal(cancelAudit?.status, "COMPLETED", "completed cancellation is retained in the operation audit/idempotency record");
    const cancelFirstAfter = await inventoryForStay();
    assert.deepEqual(cancelFirstAfter.map((row) => row.booked), cancelFirstBefore.map((row) => row.booked - 1));
    const cancelReplay = await service.execute(guestA, a.id, pa.id, { action: "cancel", reservationId: cancelFirst.id }, `cancel-${token}-lock-first`) as OperationalResult;
    const verifyReplay = await payments.verifyBankTransfer({ actor: verifyActor, reservationId: cancelFirst.id, ledgerEntryId: cancelFirst.entryId, idempotencyKey: `verify-${token}-cancel-first` });
    assert.equal(cancelReplay.reservation?.status, "CANCELLED"); assert.equal(verifyReplay.outcome, "PAYMENT_NOT_PENDING");

    // Ordering B: verification owns the reservation lock before cancellation starts.
    const verifyFirst = await createRaceFixture("verify-lock-first");
    const verifyFirstBefore = await inventoryForStay();
    const verifyLockKey = BigInt(`0x${randomUUID().replaceAll("-", "").slice(0, 12)}`).toString();
    const removeVerifyBarrier = await installBarrierTrigger("HotelOfflinePayment", verifyFirst.entryId, "status", "VERIFIED", verifyLockKey);
    const releaseVerifyBarrier = await acquireBarrier(verifyLockKey);
    let verifyFirstTask!: ReturnType<typeof payments.verifyBankTransfer>;
    let cancelAfterVerifyTask!: Promise<unknown>;
    try {
      verifyFirstTask = payments.verifyBankTransfer({ actor: verifyActor, reservationId: verifyFirst.id, ledgerEntryId: verifyFirst.entryId, idempotencyKey: `verify-${token}-verify-first` });
      await waitForAdvisoryBarrierWait(db, verifyLockKey);
      cancelAfterVerifyTask = service.execute(guestA, a.id, pa.id, { action: "cancel", reservationId: verifyFirst.id }, `cancel-${token}-verify-first`);
      await waitForPostgresLockWait(db, 'FROM "HotelReservation"');
    } finally { await releaseVerifyBarrier(); await removeVerifyBarrier(); }
    const verifyBeforeCancel = await verifyFirstTask!;
    const cancelAfterVerify = await cancelAfterVerifyTask as OperationalResult;
    assert.equal(verifyBeforeCancel.outcome, "APPLIED"); assert.equal(cancelAfterVerify.reservation?.status, "CANCELLED");
    const verifyFirstRow = await db.hotelReservation.findUniqueOrThrow({ where: { id: verifyFirst.id } });
    const verifyFirstEntry = await db.hotelOfflinePayment.findUniqueOrThrow({ where: { id: verifyFirst.entryId } });
    assert.equal(verifyFirstRow.status, "CANCELLED"); assert.equal(verifyFirstRow.paidAmount, BigInt(10_000));
    assert.equal(verifyFirstEntry.status, "VERIFIED");
    assert.equal(await db.hotelOfflinePaymentAuditEvent.count({ where: { organizationId: a.id, ledgerEntryId: verifyFirst.entryId, eventType: "BANK_TRANSFER_VERIFIED" } }), 1);
    assert.equal(await db.hotelOfflinePaymentAuditEvent.count({ where: { organizationId: a.id, ledgerEntryId: verifyFirst.entryId, eventType: "BANK_TRANSFER_SUBMITTED" } }), 1);
    assert.ok(verifyFirstRow.holdId);
    assert.equal((await db.hotelBookingHold.findUniqueOrThrow({ where: { id: verifyFirstRow.holdId } })).status, "CONSUMED", "cancellation preserves the consumed hold record after releasing inventory");
    const verifyFirstAfter = await inventoryForStay();
    assert.deepEqual(verifyFirstAfter.map((row) => row.booked), verifyFirstBefore.map((row) => row.booked - 1));
    assert.equal(await db.hotelOfflinePaymentAuditEvent.count({ where: { organizationId: a.id, ledgerEntryId: verifyFirst.entryId } }), 2, "submission and verification are recorded once; cancellation does not invent a refund/reversal");
    const verifyFirstCancelAudit = await db.hotelInventoryIdempotency.findUnique({ where: { organizationId_operationScope_idempotencyKey: { organizationId: a.id, operationScope: "HOTEL_OPERATIONAL_ACTION", idempotencyKey: `cancel-${token}-verify-first` } } });
    assert.equal(verifyFirstCancelAudit?.status, "COMPLETED");
    const verifyFirstReplay = await payments.verifyBankTransfer({ actor: verifyActor, reservationId: verifyFirst.id, ledgerEntryId: verifyFirst.entryId, idempotencyKey: `verify-${token}-verify-first` });
    const cancelFirstReplay = await service.execute(guestA, a.id, pa.id, { action: "cancel", reservationId: verifyFirst.id }, `cancel-${token}-verify-first`) as OperationalResult;
    assert.equal(verifyFirstReplay.outcome, "REPLAY"); assert.equal(cancelFirstReplay.reservation?.status, "CANCELLED");

    // Synthetic confirmation is test-only fixture setup; no gateway or payment request is involved.
    await db.hotelInventory.updateMany({ where: { organizationId: a.id, roomTypeId: roomA.id }, data: { allotment: 4 } });
    const receptionRooms = await Promise.all(["101", "102", "103", "104"].map(code => db.hotelRoom.create({ data: {
      organizationId: a.id, propertyId: pa.id, roomTypeId: roomA.id, code,
    } })));
    const [roomOne, roomTwo] = receptionRooms;
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

    // Reception manual entry stays available with public reservation and guest portal gates off.
    process.env.HOTEL_MANUAL_ROOM_MANAGEMENT_ENABLED = "1";
    process.env.HOTEL_OPERATIONAL_RESERVATIONS_ENABLED = "0";
    process.env.HOTEL_GUEST_PORTAL_ENABLED = "0";
    const manualCommand = { roomId: receptionRooms[2].id, roomTypeId: roomA.id, ratePlanId: rateA.id, ...stay, source: "WALK_IN" as const, guests };
    await assert.rejects(() => service.createManual(guestA, a.id, pa.id, manualCommand, `manual-customer-${token}`), /reception role required/i);
    await assert.rejects(() => service.createManual(foreignReceptionist, a.id, pa.id, manualCommand, `manual-foreign-${token}`), /forbidden/i);
    const maintenanceBlock = await db.hotelRoomMaintenanceBlock.create({ data: { organizationId: a.id, propertyId: pa.id, roomId: receptionRooms[2].id, from: day(stay.checkIn), to: day(stay.checkOut), reason: "Synthetic manual reservation overlap", idempotencyKey: `manual-maintenance-${token}`, requestFingerprint: `manual-maintenance-${token}`, createdBy: staff.id } });
    await assert.rejects(() => service.createManual(receptionist, a.id, pa.id, manualCommand, `manual-blocked-${token}`), /scheduled maintenance/i);
    await db.hotelRoomMaintenanceBlock.update({ where: { id: maintenanceBlock.id }, data: { releasedBy: staff.id, releasedAt: now() } });
    const concurrentManual = await Promise.allSettled([
      service.createManual(receptionist, a.id, pa.id, manualCommand, `manual-a-${token}`),
      service.createManual(receptionist, a.id, pa.id, manualCommand, `manual-b-${token}`),
    ]);
    const successfulManual = concurrentManual.flatMap(outcome => outcome.status === "fulfilled" ? [outcome.value] : []);
    assert.equal(successfulManual.length, 1, "only one concurrent manual booking may claim the same physical room nights");
    const manualKey = concurrentManual[0].status === "fulfilled" ? `manual-a-${token}` : `manual-b-${token}`;
    const manualCreated = successfulManual[0] as ManualResult;
    assert.equal(manualCreated.status, "CONFIRMED"); assert.equal(manualCreated.paymentStatus, "UNPAID"); assert.equal(manualCreated.source, "WALK_IN");
    const manualReplay = await service.createManual(receptionist, a.id, pa.id, manualCommand, manualKey) as ManualResult;
    assert.equal(manualReplay.reservationId, manualCreated.reservationId, "manual create is idempotent");
    const manualStored = await db.hotelReservation.findFirstOrThrow({ where: { id: manualCreated.reservationId, organizationId: a.id, propertyId: pa.id }, include: { nights: true, guests: true } });
    assert.equal(manualStored.status, "CONFIRMED"); assert.equal(manualStored.paidAmount, BigInt(0));
    assert.ok(manualStored.nights.every(night => night.roomId === manualCommand.roomId));
    assert.ok(manualStored.guests[0]?.phoneHash === null, "guest phone is not required for walk-in entry");
    const manualView = await service.get(receptionist, a.id, pa.id) as { mode: string; reservations: Array<{ id: string; source: string | null }> };
    assert.equal(manualView.mode, "MANUAL");
    assert.equal(manualView.reservations.find(row => row.id === manualCreated.reservationId)?.source, "WALK_IN");
    const manualCancelled = await service.execute(receptionist, a.id, pa.id, { action: "cancel", reservationId: manualCreated.reservationId }, `manual-cancel-${token}`) as OperationalResult;
    assert.equal(manualCancelled.reservation?.status, "CANCELLED");
    const secondManual = await service.createManual(receptionist, a.id, pa.id, { ...manualCommand, source: "PHONE" }, `manual-after-cancel-${token}`) as ManualResult;
    assert.equal(secondManual.status, "CONFIRMED", "cancellation releases the shared inventory claim");
    await service.execute(receptionist, a.id, pa.id, { action: "assign-room", reservationId: secondManual.reservationId, roomId: receptionRooms[3].id }, `manual-reassign-${token}`);
    const manualCheckIn = await service.execute(receptionist, a.id, pa.id, { action: "check-in", reservationId: secondManual.reservationId }, `manual-check-in-${token}`) as OperationalResult;
    assert.equal(manualCheckIn.reservation?.status, "CHECKED_IN");
    const manualCheckOut = await service.execute(receptionist, a.id, pa.id, { action: "check-out", reservationId: secondManual.reservationId }, `manual-check-out-${token}`) as OperationalResult;
    assert.equal(manualCheckOut.reservation?.status, "CHECKED_OUT");
    process.env.HOTEL_OPERATIONAL_RESERVATIONS_ENABLED = "1"; process.env.HOTEL_GUEST_PORTAL_ENABLED = "1";

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
    if (originalManual === undefined) delete process.env.HOTEL_MANUAL_ROOM_MANAGEMENT_ENABLED; else process.env.HOTEL_MANUAL_ROOM_MANAGEMENT_ENABLED = originalManual;
    try {
      if (orgs.length) {
        await db.hotelInventoryIdempotency.deleteMany({ where: { organizationId: { in: orgs } } });
        await db.hotelStayRequest.deleteMany({ where: { organizationId: { in: orgs } } });
        await db.hotelOfflinePaymentAuditEvent.deleteMany({ where: { organizationId: { in: orgs } } });
        await db.hotelOfflinePaymentCommandIdempotency.deleteMany({ where: { organizationId: { in: orgs } } });
        await db.hotelOfflinePayment.deleteMany({ where: { organizationId: { in: orgs } } });
        await db.hotelReservation.deleteMany({ where: { organizationId: { in: orgs } } });
        await db.hotelBookingHold.deleteMany({ where: { organizationId: { in: orgs } } });
        await db.hotelStayQuote.deleteMany({ where: { organizationId: { in: orgs } } });
        await db.hotelInventory.deleteMany({ where: { organizationId: { in: orgs } } });
        await db.hotelRatePlan.deleteMany({ where: { id: { in: rates } } });
        await db.hotelCancellationPolicy.deleteMany({ where: { id: { in: policies } } });
        await db.hotelRoomMaintenanceBlock.deleteMany({ where: { organizationId: { in: orgs } } });
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
        assert.equal(await db.hotelRoomMaintenanceBlock.count({ where: { organizationId: { in: orgs } } }), 0);
        assert.equal(await db.organization.count({ where: { id: { in: orgs } } }), 0);
        assert.equal(await db.user.count({ where: { id: { in: users } } }), 0);
      }
      if (passed) console.log("HOTEL_OPERATIONAL_RESERVATION_CLEANUP=PASSED");
      await db.$disconnect();
    } catch (error) { await db.$disconnect(); throw error; }
  }
});
