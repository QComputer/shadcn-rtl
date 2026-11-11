import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { HotelBookingSandboxService } from "../../lib/hotel/sandbox/booking-sandbox.service";

const enabled = process.env.HOTEL_BOOKING_SANDBOX_ACCEPTANCE === "1";
const day = (value: string) => new Date(`${value}T00:00:00.000Z`);
const stay = { checkIn: "2027-12-10", checkOut: "2027-12-12", adults: 1, childAges: [] as number[] };

function guardedConnection() {
  assert.notEqual(process.env.NODE_ENV, "production");
  assert.notEqual(process.env.VERCEL_ENV, "production");
  assert.ok(!process.env.VERCEL, "hosted execution is forbidden");
  assert.equal(process.env.DATABASE_RUNTIME_ADAPTER, "postgresql");
  assert.equal(process.env.LOCAL_PRISMA_EXPECTED_PORT, "55439");
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

test("Hotel booking sandbox persists isolated quotes, reservations and simulated payment outcomes", {
  skip: !enabled,
  concurrency: false,
}, async () => {
  const connection = guardedConnection();
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: connection.toString(), max: 8 }), log: [] });
  const token = randomUUID().replaceAll("-", "").slice(0, 12);
  const orgIds: string[] = [];
  const userIds: string[] = [];
  const propertyIds: string[] = [];
  const roomTypeIds: string[] = [];
  const ratePlanIds: string[] = [];
  const policyIds: string[] = [];
  let passed = false;
  try {
    const identity = await db.$queryRaw<Array<{ database: string; role: string; port: number }>>`
      SELECT current_database()::text AS database, current_user::text AS role, inet_server_port() AS port`;
    assert.deepEqual(identity, [{ database: "retail_hero_test", role: "hero_test", port: 5432 }]);
    process.env.HOTEL_BOOKING_SANDBOX_ENABLED = "1";

    const makeTenant = async (label: string) => {
      const org = await db.organization.create({ data: { type: "SHOP", vertical: "HOTEL", name: `Sandbox ${label} ${token}`, slug: `hotel-sandbox-${label}-${token}` } });
      orgIds.push(org.id);
      await db.organizationCapability.create({ data: { organizationId: org.id, key: "HOTEL_BOOKING", status: "ACTIVE", enabledAt: new Date() } });
      const adminUser = await db.user.create({ data: { name: `hotel-sandbox-admin-${label}-${token}`, password: "synthetic-only", role: "ADMIN" } });
      userIds.push(adminUser.id);
      const staffUser = await db.user.create({ data: { name: `hotel-sandbox-staff-${label}-${token}`, password: "synthetic-only", role: "STAFF" } });
      userIds.push(staffUser.id);
      const customerUser = await db.user.create({ data: { name: `hotel-sandbox-customer-${label}-${token}`, password: "synthetic-only", role: "CUSTOMER" } });
      userIds.push(customerUser.id);
      const secondCustomerUser = await db.user.create({ data: { name: `hotel-sandbox-other-customer-${label}-${token}`, password: "synthetic-only", role: "CUSTOMER" } });
      userIds.push(secondCustomerUser.id);
      for (const [userId, role] of [[adminUser.id, "ADMIN"], [staffUser.id, "STAFF"], [customerUser.id, "CUSTOMER"], [secondCustomerUser.id, "CUSTOMER"]] as const) {
        await db.organizationMember.create({ data: { organizationId: org.id, organizationSlug: org.slug, userId, role } });
      }
      await db.customerClubMembership.create({ data: { organizationId: org.id, customerId: customerUser.id, status: "ACTIVE" } });
      await db.customerClubMembership.create({ data: { organizationId: org.id, customerId: secondCustomerUser.id, status: "ACTIVE" } });
      const property = await db.hotelProperty.create({ data: { organizationId: org.id, organizationSlug: org.slug, slug: `property-${label}-${token}`, name: `Synthetic ${label} hotel` } });
      propertyIds.push(property.id);
      const policy = await db.hotelCancellationPolicy.create({ data: { organizationId: org.id, propertyId: property.id, key: `policy-${token}`, name: "Synthetic flexible", freeCancellationCutoffHours: 24, fullCancellationRetention: 0, version: 1 } });
      policyIds.push(policy.id);
      const roomType = await db.hotelRoomType.create({ data: { organizationId: org.id, propertyId: property.id, slug: `room-${label}-${token}`, name: "Synthetic room", maxAdults: 2, maxChildren: 2, maxOccupancy: 4, beds: [{ kind: "queen", count: 1 }], totalAllotment: 8 } });
      roomTypeIds.push(roomType.id);
      const ratePlan = await db.hotelRatePlan.create({ data: { organizationId: org.id, propertyId: property.id, roomTypeId: roomType.id, code: `flex-${label}-${token}`, name: "Synthetic flexible", baseNightlyRate: BigInt(125000), cancellationPolicyId: policy.id } });
      ratePlanIds.push(ratePlan.id);
      const physicalRoom = await db.hotelRoom.create({ data: { organizationId: org.id, propertyId: property.id, roomTypeId: roomType.id, code: `101-${label}-${token}` } });
      const concurrentRoom = await db.hotelRoom.create({ data: { organizationId: org.id, propertyId: property.id, roomTypeId: roomType.id, code: `102-${label}-${token}` } });
      const outOfServiceRoom = await db.hotelRoom.create({ data: { organizationId: org.id, propertyId: property.id, roomTypeId: roomType.id, code: `103-${label}-${token}`, isOutOfService: true } });
      const inactiveRoom = await db.hotelRoom.create({ data: { organizationId: org.id, propertyId: property.id, roomTypeId: roomType.id, code: `104-${label}-${token}`, isActive: false } });
      await db.hotelInventory.createMany({ data: ["2027-12-10", "2027-12-11", "2027-12-12", "2027-12-13"].map((date) => ({ organizationId: org.id, propertyId: property.id, roomTypeId: roomType.id, date: day(date), allotment: 8 })) });
      return {
        orgId: org.id,
        propertyId: property.id,
        roomTypeId: roomType.id,
        ratePlanId: ratePlan.id,
        physicalRoomId: physicalRoom.id,
        concurrentRoomId: concurrentRoom.id,
        outOfServiceRoomId: outOfServiceRoom.id,
        inactiveRoomId: inactiveRoom.id,
        policyId: policy.id,
        admin: { userId: adminUser.id, role: "ADMIN" as const, organizationId: org.id },
        staff: { userId: staffUser.id, role: "STAFF" as const, organizationId: org.id },
        customer: { userId: customerUser.id, role: "CUSTOMER" as const, organizationId: org.id, customerContextVerified: true as const },
        otherCustomer: { userId: secondCustomerUser.id, role: "CUSTOMER" as const, organizationId: org.id, customerContextVerified: true as const },
      };
    };

    const tenantA = await makeTenant("a");
    const tenantB = await makeTenant("b");
    const service = new HotelBookingSandboxService(db);
    const quoteFor = async (tenant: typeof tenantA, actor = tenant.customer, window = stay) => {
      const result = await service.execute(actor, tenant.orgId, tenant.propertyId, { action: "quote", roomTypeId: tenant.roomTypeId, ratePlanId: tenant.ratePlanId, ...window }, `quote-${randomUUID()}`);
      assert.ok(result.quote?.id);
      return result.quote as { id: string; totalAmount: string; currency: string; policyVersion: number; expiresAt: string };
    };
    const confirmedBooking = async (label: string, window = stay) => {
      const quote = await quoteFor(tenantA, tenantA.customer, window);
      const hold = await service.execute(tenantA.customer, tenantA.orgId, tenantA.propertyId, { action: "hold", quoteId: quote.id }, `hold-${label}-${token}`);
      assert.ok(hold.hold?.id);
      const reservation = await service.execute(tenantA.customer, tenantA.orgId, tenantA.propertyId, { action: "reserve", quoteId: quote.id, holdId: hold.hold.id, guests: [{ fullName: `Room guest ${label} ${token}`, isPrimary: true }] }, `reserve-${label}-${token}`);
      assert.ok(reservation.reservation?.id);
      const id = reservation.reservation.id;
      const payment = await service.execute(tenantA.customer, tenantA.orgId, tenantA.propertyId, { action: "pay", reservationId: id, outcome: "SUCCESS" }, `pay-${label}-${token}`);
      assert.equal(payment.payment?.status, "SUCCESS");
      return id;
    };
    const quote = await quoteFor(tenantA);
    assert.equal(quote.currency, "TOMAN");
    assert.equal(quote.totalAmount, "250000");
    const changedKey = `changed-payload-${token}`;
    await service.execute(tenantA.customer, tenantA.orgId, tenantA.propertyId, { action: "search", roomTypeId: tenantA.roomTypeId, ratePlanId: tenantA.ratePlanId, ...stay }, changedKey);
    await assert.rejects(() => service.execute(tenantA.customer, tenantA.orgId, tenantA.propertyId, { action: "search", roomTypeId: tenantA.roomTypeId, ratePlanId: tenantA.ratePlanId, ...stay, adults: 2 }, changedKey), /Idempotency-Key conflict/);
    await assert.rejects(() => service.execute({ ...tenantA.customer, customerContextVerified: false }, tenantA.orgId, tenantA.propertyId, { action: "search", roomTypeId: tenantA.roomTypeId, ratePlanId: tenantA.ratePlanId, ...stay }, `unverified-${token}`), /Customer context required/);
    await assert.rejects(() => service.execute(tenantA.customer, tenantA.orgId, tenantA.propertyId, { action: "quote", roomTypeId: tenantA.roomTypeId, ratePlanId: tenantA.ratePlanId, ...stay, organizationId: tenantA.orgId, totalAmount: "1" }, `unknown-fields-${token}`));

    // A later rate edit must not rewrite the durable quote or the reservation snapshot.
    await db.hotelRatePlan.update({ where: { id: tenantA.ratePlanId }, data: { baseNightlyRate: BigInt(900000) } });
    const holdResult = await service.execute(tenantA.customer, tenantA.orgId, tenantA.propertyId, { action: "hold", quoteId: quote.id }, `hold-${token}`);
    assert.ok(holdResult.hold?.id);
    const reserveCommand = { action: "reserve", quoteId: quote.id, holdId: holdResult.hold.id, guests: [{ fullName: `Guest ${token}`, isPrimary: true }] };
    await assert.rejects(() => service.execute(tenantA.otherCustomer, tenantA.orgId, tenantA.propertyId, reserveCommand, `other-owner-${token}`), /Quote not found/);
    const distinctKeyResults = await Promise.all([
      service.execute(tenantA.customer, tenantA.orgId, tenantA.propertyId, reserveCommand, `reserve-distinct-a-${token}`),
      service.execute(tenantA.customer, tenantA.orgId, tenantA.propertyId, reserveCommand, `reserve-distinct-b-${token}`),
    ]);
    assert.equal(distinctKeyResults[0]?.reservation?.id, distinctKeyResults[1]?.reservation?.id, "distinct client keys cannot create two reservations for one quote");
    const reserveKey = `reserve-${token}`;
    const [reservationFirst, reservationReplay] = await Promise.all([
      service.execute(tenantA.customer, tenantA.orgId, tenantA.propertyId, reserveCommand, reserveKey),
      service.execute(tenantA.customer, tenantA.orgId, tenantA.propertyId, reserveCommand, reserveKey),
    ]);
    assert.deepEqual(reservationReplay, reservationFirst, "concurrent same-key reservation returns one stable result");
    assert.ok(reservationFirst.reservation?.id);
    const reservationId = reservationFirst.reservation.id as string;
    const reservation = await db.hotelReservation.findFirstOrThrow({ where: { id: reservationId, organizationId: tenantA.orgId }, include: { guests: true } });
    assert.equal(reservation.totalAmount, BigInt(250000));
    assert.equal(reservation.cancellationPolicyKey, `policy-${token}`);
    assert.equal((reservation.cancellationPolicySnapshot as { version?: number }).version, quote.policyVersion);
    assert.ok(reservation.guestCustomerId, "authenticated customer reservation binds to a server-derived guest identity");
    const boundGuest = await db.guestCustomer.findUniqueOrThrow({ where: { id: reservation.guestCustomerId! } });
    assert.equal(boundGuest.sessionId, `hotel-sandbox:${tenantA.orgId}:${tenantA.customer.userId}`);
    const boundIdentity = await db.customerIdentity.findFirstOrThrow({ where: { organizationId: tenantA.orgId, userId: tenantA.customer.userId, guestCustomerId: boundGuest.id } });
    assert.equal(reservation.guests.length, 1);
    assert.equal(reservation.guests[0]?.fullName, `Guest ${token}`);
    assert.equal(await db.hotelReservation.count({ where: { organizationId: tenantA.orgId } }), 1);

    const successKey = `payment-success-${token}`;
    const [success, successReplay] = await Promise.all([
      service.execute(tenantA.customer, tenantA.orgId, tenantA.propertyId, { action: "pay", reservationId, outcome: "SUCCESS" }, successKey),
      service.execute(tenantA.customer, tenantA.orgId, tenantA.propertyId, { action: "pay", reservationId, outcome: "SUCCESS" }, successKey),
    ]);
    assert.deepEqual(successReplay, success, "simulated payment callback replay is idempotent");
    assert.equal(success.payment?.simulated, true);
    assert.equal(success.payment?.status, "SUCCESS");
    assert.equal((await db.hotelReservation.findUniqueOrThrow({ where: { id: reservationId } })).status, "CONFIRMED");
    const differentKeyReplay = await service.execute(tenantA.customer, tenantA.orgId, tenantA.propertyId, { action: "pay", reservationId, outcome: "FAILED" }, `payment-alternate-${token}`);
    assert.equal(differentKeyReplay.payment?.status, "SUCCESS", "later conflicting callback cannot replace the first simulated outcome");
    assert.equal(differentKeyReplay.reservation?.status, "CONFIRMED");
    assert.equal(await db.paymentRequest.count({ where: { organizationId: tenantA.orgId, customerIdentityId: boundIdentity.id } }), 0, "sandbox must not create a real payment request");

    const stayInventoryWhere = { organizationId: tenantA.orgId, roomTypeId: tenantA.roomTypeId, date: { in: [day(stay.checkIn), day("2027-12-11")] } };
    const inventoryBeforeCancel = await db.hotelInventory.findMany({ where: stayInventoryWhere, orderBy: { date: "asc" } });
    const cancelled = await service.execute(tenantA.admin, tenantA.orgId, tenantA.propertyId, { action: "cancel", reservationId }, `cancel-${token}`);
    assert.ok(cancelled.cancellation);
    assert.equal(cancelled.reservation?.status, "CANCELLED");
    assert.equal(cancelled.cancellation?.refundableAmount, 250000);
    assert.equal(cancelled.cancellation?.retainedAmount, 0);
    const cancelReplay = await service.execute(tenantA.admin, tenantA.orgId, tenantA.propertyId, { action: "cancel", reservationId }, `cancel-${token}`);
    assert.deepEqual(cancelReplay, cancelled);
    const inventoryAfterCancel = await db.hotelInventory.findMany({ where: stayInventoryWhere, orderBy: { date: "asc" } });
    assert.deepEqual(inventoryAfterCancel.map((row) => row.booked), inventoryBeforeCancel.map((row) => row.booked - 1), "cancellation atomically releases the confirmed reservation capacity");

    const staffView = await service.get(tenantA.staff, tenantA.orgId, tenantA.propertyId);
    assert.ok(staffView.reservations.some((row: { id: string }) => row.id === reservationId), "staff reception view lists the tenant reservation");
    await assert.rejects(() => service.execute(tenantA.customer, tenantA.orgId, tenantA.propertyId, { action: "check-in", reservationId }, `checkin-customer-${token}`));
    const receptionQuote = await quoteFor(tenantA);
    const receptionHold = await service.execute(tenantA.customer, tenantA.orgId, tenantA.propertyId, { action: "hold", quoteId: receptionQuote.id }, `hold-reception-${token}`);
    assert.ok(receptionHold.hold?.id);
    const receptionReservation = await service.execute(tenantA.customer, tenantA.orgId, tenantA.propertyId, { action: "reserve", quoteId: receptionQuote.id, holdId: receptionHold.hold.id, guests: [{ fullName: `Reception guest ${token}`, isPrimary: true }] }, `reserve-reception-${token}`);
    assert.ok(receptionReservation.reservation?.id);
    const receptionReservationId = receptionReservation.reservation.id as string;
    const receptionPay = await service.execute(tenantA.customer, tenantA.orgId, tenantA.propertyId, { action: "pay", reservationId: receptionReservationId, outcome: "SUCCESS" }, `pay-reception-${token}`);
    assert.equal(receptionPay.payment?.simulated, true);
    await assert.rejects(() => service.execute(tenantA.staff, tenantA.orgId, tenantA.propertyId, { action: "check-in", reservationId: receptionReservationId }, `checkin-unassigned-${token}`), /room|assignment/i);
    const receptionDesk = await service.get(tenantA.staff, tenantA.orgId, tenantA.propertyId) as typeof staffView & { rooms: Array<{ id: string }> };
    assert.ok(receptionDesk.rooms.some((room) => room.id === tenantA.physicalRoomId), "reception view lists active physical rooms");
    const customerDesk = await service.get(tenantA.customer, tenantA.orgId, tenantA.propertyId) as { rooms?: unknown[] };
    assert.deepEqual(customerDesk.rooms ?? [], [], "customer view does not expose staff physical-room inventory");
    await assert.rejects(() => service.execute(tenantA.customer, tenantA.orgId, tenantA.propertyId, { action: "assign-room", reservationId: receptionReservationId, roomId: tenantA.physicalRoomId }, `assign-customer-${token}`), (error: unknown) => error instanceof Error && "status" in error && error.status === 403);
    await assert.rejects(() => service.execute(tenantA.staff, tenantA.orgId, tenantA.propertyId, { action: "assign-room", reservationId: receptionReservationId, roomId: tenantB.physicalRoomId }, `assign-foreign-room-${token}`));
    await assert.rejects(() => service.execute(tenantA.staff, tenantA.orgId, tenantA.propertyId, { action: "assign-room", reservationId: receptionReservationId, roomId: tenantA.outOfServiceRoomId }, `assign-oos-room-${token}`));
    await assert.rejects(() => service.execute(tenantA.staff, tenantA.orgId, tenantA.propertyId, { action: "assign-room", reservationId: receptionReservationId, roomId: tenantA.inactiveRoomId }, `assign-inactive-room-${token}`));
    const assignKey = `assign-reception-${token}`;
    const assignment = await service.execute(tenantA.staff, tenantA.orgId, tenantA.propertyId, { action: "assign-room", reservationId: receptionReservationId, roomId: tenantA.physicalRoomId }, assignKey);
    const assignmentReplay = await service.execute(tenantA.staff, tenantA.orgId, tenantA.propertyId, { action: "assign-room", reservationId: receptionReservationId, roomId: tenantA.physicalRoomId }, assignKey);
    assert.deepEqual(assignmentReplay, assignment, "physical room assignment is idempotent");
    const assignedNights = await db.hotelReservationRoom.findMany({ where: { organizationId: tenantA.orgId, reservationId: receptionReservationId }, orderBy: { date: "asc" } });
    assert.deepEqual(assignedNights.map((night) => [night.date.toISOString().slice(0, 10), night.roomId]), [["2027-12-10", tenantA.physicalRoomId], ["2027-12-11", tenantA.physicalRoomId]], "assignment covers every occupied night");

    const overlapReservationId = await confirmedBooking("overlap");
    await assert.rejects(() => service.execute(tenantA.staff, tenantA.orgId, tenantA.propertyId, { action: "assign-room", reservationId: overlapReservationId, roomId: tenantA.physicalRoomId }, `assign-overlap-${token}`), /overlap|occupied|available|room/i);
    const assignedPrices = assignedNights.map((night) => night.rate);
    await service.execute(tenantA.admin, tenantA.orgId, tenantA.propertyId, { action: "cancel", reservationId: receptionReservationId }, `cancel-assigned-${token}`);
    const cancelledNights = await db.hotelReservationRoom.findMany({ where: { organizationId: tenantA.orgId, reservationId: receptionReservationId }, orderBy: { date: "asc" } });
    assert.deepEqual(cancelledNights.map((night) => night.roomId), [null, null], "cancellation clears physical allocations");
    assert.deepEqual(cancelledNights.map((night) => night.rate), assignedPrices, "cancellation retains immutable nightly price snapshots");
    const reused = await service.execute(tenantA.staff, tenantA.orgId, tenantA.propertyId, { action: "assign-room", reservationId: overlapReservationId, roomId: tenantA.physicalRoomId }, `assign-reuse-${token}`);
    assert.equal(reused.reservation?.id, overlapReservationId);
    const adjacentReservationId = await confirmedBooking("adjacent", { checkIn: "2027-12-12", checkOut: "2027-12-14", adults: 1, childAges: [] });
    const adjacentAssignment = await service.execute(tenantA.staff, tenantA.orgId, tenantA.propertyId, { action: "assign-room", reservationId: adjacentReservationId, roomId: tenantA.physicalRoomId }, `assign-adjacent-${token}`);
    assert.equal(adjacentAssignment.reservation?.id, adjacentReservationId, "checkout/check-in boundary is not an occupied-night overlap");
    const adjacentNights = await db.hotelReservationRoom.findMany({ where: { organizationId: tenantA.orgId, reservationId: adjacentReservationId }, orderBy: { date: "asc" } });
    assert.deepEqual(adjacentNights.map((night) => night.date.toISOString().slice(0, 10)), ["2027-12-12", "2027-12-13"]);

    const racedReservationIds = await Promise.all([confirmedBooking("room-race-a"), confirmedBooking("room-race-b")]);
    const physicalRoomRace = await Promise.allSettled(racedReservationIds.map((id, index) => service.execute(tenantA.staff, tenantA.orgId, tenantA.propertyId, { action: "assign-room", reservationId: id, roomId: tenantA.concurrentRoomId }, `assign-room-race-${index}-${token}`)));
    assert.equal(physicalRoomRace.filter((result) => result.status === "fulfilled").length, 1, "only one concurrent reservation can claim the physical room");
    assert.equal(physicalRoomRace.filter((result) => result.status === "rejected").length, 1);
    const raceAllocations = await db.hotelReservationRoom.findMany({ where: { organizationId: tenantA.orgId, roomId: tenantA.concurrentRoomId }, orderBy: [{ date: "asc" }, { reservationId: "asc" }] });
    assert.equal(raceAllocations.length, 2, "the winning assignment contains every occupied night");
    assert.equal(new Set(raceAllocations.map((night) => night.reservationId)).size, 1, "a losing concurrent assignment leaves no partial night allocations");

    const checkedIn = await service.execute(tenantA.staff, tenantA.orgId, tenantA.propertyId, { action: "check-in", reservationId: overlapReservationId }, `checkin-${token}`);
    assert.equal(checkedIn.reservation?.status, "CHECKED_IN");
    const checkedOut = await service.execute(tenantA.staff, tenantA.orgId, tenantA.propertyId, { action: "check-out", reservationId: overlapReservationId }, `checkout-${token}`);
    assert.equal(checkedOut.reservation?.status, "CHECKED_OUT");

    const foreignView = await service.get(tenantB.admin, tenantB.orgId, tenantB.propertyId);
    assert.equal(foreignView.reservations.some((row: { id: string }) => row.id === reservationId), false);
    await assert.rejects(() => service.execute(tenantB.admin, tenantB.orgId, tenantB.propertyId, { action: "pay", reservationId, outcome: "SUCCESS" }, `foreign-pay-${token}`));
    await assert.rejects(() => service.execute(tenantB.customer, tenantB.orgId, tenantB.propertyId, { action: "reserve", quoteId: quote.id, holdId: holdResult.hold.id, guests: [{ fullName: "Foreign replay", isPrimary: true }] }, `foreign-reserve-${token}`));

    // Independent failure and expiry outcomes have their own durable idempotency records and release held inventory.
    for (const outcome of ["FAILED", "EXPIRED"] as const) {
      const outcomeQuote = await quoteFor(tenantA);
      const outcomeHold = await service.execute(tenantA.customer, tenantA.orgId, tenantA.propertyId, { action: "hold", quoteId: outcomeQuote.id }, `hold-${outcome.toLowerCase()}-${token}`);
      assert.ok(outcomeHold.hold?.id);
      const outcomeReservation = await service.execute(tenantA.customer, tenantA.orgId, tenantA.propertyId, { action: "reserve", quoteId: outcomeQuote.id, holdId: outcomeHold.hold.id, guests: [{ fullName: `${outcome} guest ${token}`, isPrimary: true }] }, `reserve-${outcome.toLowerCase()}-${token}`);
      assert.ok(outcomeReservation.reservation?.id);
      const id = outcomeReservation.reservation.id as string;
      const key = `payment-${outcome.toLowerCase()}-${token}`;
      const payment = await service.execute(tenantA.customer, tenantA.orgId, tenantA.propertyId, { action: "pay", reservationId: id, outcome }, key);
      const replay = await service.execute(tenantA.customer, tenantA.orgId, tenantA.propertyId, { action: "pay", reservationId: id, outcome }, key);
      assert.deepEqual(replay, payment);
      assert.equal(payment.payment?.simulated, true);
      const conflictingReplay = await service.execute(tenantA.customer, tenantA.orgId, tenantA.propertyId, { action: "pay", reservationId: id, outcome: outcome === "FAILED" ? "SUCCESS" : "FAILED" }, `payment-conflicting-${outcome.toLowerCase()}-${token}`);
      assert.equal(conflictingReplay.payment?.status, outcome, "a later new-key callback cannot replace the first sandbox outcome");
      assert.equal((await db.hotelReservation.findUniqueOrThrow({ where: { id } })).status, outcome === "FAILED" ? "CANCELLED" : "EXPIRED");
    }

    // Payment and cancellation contend on the same reservation row. Either the
    // cancellation wins before payment or it refunds the confirmed payment.
    const raceQuote = await quoteFor(tenantA);
    const raceHold = await service.execute(tenantA.customer, tenantA.orgId, tenantA.propertyId, { action: "hold", quoteId: raceQuote.id }, `hold-race-${token}`);
    assert.ok(raceHold.hold?.id);
    const inventoryBeforeRace = await db.hotelInventory.findMany({ where: stayInventoryWhere, orderBy: { date: "asc" } });
    const raceReservationResult = await service.execute(tenantA.customer, tenantA.orgId, tenantA.propertyId, { action: "reserve", quoteId: raceQuote.id, holdId: raceHold.hold.id, guests: [{ fullName: `Race guest ${token}`, isPrimary: true }] }, `reserve-race-${token}`);
    assert.ok(raceReservationResult.reservation?.id);
    const raceReservationId = raceReservationResult.reservation.id;
    const raceOutcomes = await Promise.allSettled([
      service.execute(tenantA.customer, tenantA.orgId, tenantA.propertyId, { action: "pay", reservationId: raceReservationId, outcome: "SUCCESS" }, `pay-race-${token}`),
      service.execute(tenantA.admin, tenantA.orgId, tenantA.propertyId, { action: "cancel", reservationId: raceReservationId }, `cancel-race-${token}`),
    ]);
    assert.equal(raceOutcomes[1]?.status, "fulfilled", "cancellation must win or follow settlement");
    const raceReservation = await db.hotelReservation.findUniqueOrThrow({ where: { id: raceReservationId } });
    assert.equal(raceReservation.status, "CANCELLED");
    assert.equal(raceReservation.refundedAmount, raceReservation.paidAmount, "any settled amount is fully refunded under the fixture's free-cancellation window");
    if (raceReservation.paidAmount > BigInt(0)) assert.equal(raceReservation.paidAmount, raceReservation.totalAmount);
    const inventoryAfterRace = await db.hotelInventory.findMany({ where: stayInventoryWhere, orderBy: { date: "asc" } });
    assert.deepEqual(inventoryAfterRace.map((row) => row.booked), inventoryBeforeRace.map((row) => row.booked), "the race leaves no booked inventory after cancellation");

    // Searching/quoting is the request-driven hold expiry trigger. Repeating
    // the request must not decrement inventory a second time.
    const sweepQuote = await quoteFor(tenantA);
    const sweepHold = await service.execute(tenantA.customer, tenantA.orgId, tenantA.propertyId, { action: "hold", quoteId: sweepQuote.id }, `hold-sweep-${token}`);
    assert.ok(sweepHold.hold?.id);
    await db.hotelBookingHold.update({ where: { id: sweepHold.hold.id }, data: { expiresAt: new Date(Date.now() - 60_000) } });
    const searchCommand = { action: "search", roomTypeId: tenantA.roomTypeId, ratePlanId: tenantA.ratePlanId, ...stay };
    const firstSweep = await service.execute(tenantA.customer, tenantA.orgId, tenantA.propertyId, searchCommand, `search-sweep-a-${token}`);
    assert.equal(firstSweep.available, true);
    assert.equal((await db.hotelBookingHold.findUniqueOrThrow({ where: { id: sweepHold.hold.id } })).status, "EXPIRED");
    const afterFirstSweep = await db.hotelInventory.findMany({ where: stayInventoryWhere, orderBy: { date: "asc" } });
    assert.deepEqual(afterFirstSweep.map((row) => row.held), [0, 0]);
    await service.execute(tenantA.customer, tenantA.orgId, tenantA.propertyId, searchCommand, `search-sweep-b-${token}`);
    assert.deepEqual((await db.hotelInventory.findMany({ where: stayInventoryWhere, orderBy: { date: "asc" } })).map((row) => row.held), [0, 0], "repeated sweep releases the hold exactly once");

    // An already-created reservation cannot be settled after its source hold expires.
    const delayedQuote = await quoteFor(tenantA);
    const delayedHold = await service.execute(tenantA.customer, tenantA.orgId, tenantA.propertyId, { action: "hold", quoteId: delayedQuote.id }, `hold-delayed-${token}`);
    assert.ok(delayedHold.hold?.id);
    const delayedReservation = await service.execute(tenantA.customer, tenantA.orgId, tenantA.propertyId, { action: "reserve", quoteId: delayedQuote.id, holdId: delayedHold.hold.id, guests: [{ fullName: `Delayed guest ${token}`, isPrimary: true }] }, `reserve-delayed-${token}`);
    assert.ok(delayedReservation.reservation?.id);
    await db.hotelBookingHold.update({ where: { id: delayedHold.hold.id }, data: { expiresAt: new Date(Date.now() - 60_000) } });
    const delayedPayment = await service.execute(tenantA.customer, tenantA.orgId, tenantA.propertyId, { action: "pay", reservationId: delayedReservation.reservation.id, outcome: "SUCCESS" }, `pay-delayed-${token}`);
    assert.equal(delayedPayment.payment?.status, "EXPIRED", "requested success cannot override an expired source hold");
    assert.equal(delayedPayment.reservation?.status, "EXPIRED");

    // A quote has a fixed ten-minute life. Expired quotes cannot acquire stock.
    const staleQuote = await quoteFor(tenantA);
    const staleQuoteRow = await db.hotelInventoryIdempotency.findUniqueOrThrow({ where: { id: staleQuote.id } });
    const staleQuoteResult = staleQuoteRow.resultJson as Record<string, unknown>;
    await db.hotelInventoryIdempotency.update({ where: { id: staleQuote.id }, data: { resultJson: { ...staleQuoteResult, expiresAt: new Date(Date.now() - 60_000).toISOString() } } });
    const heldBeforeStaleAttempt = await db.hotelInventory.aggregate({ where: { organizationId: tenantA.orgId, roomTypeId: tenantA.roomTypeId }, _sum: { held: true } });
    await assert.rejects(() => service.execute(tenantA.customer, tenantA.orgId, tenantA.propertyId, { action: "hold", quoteId: staleQuote.id }, `hold-stale-${token}`), /Quote expired/);
    const heldAfterStaleAttempt = await db.hotelInventory.aggregate({ where: { organizationId: tenantA.orgId, roomTypeId: tenantA.roomTypeId }, _sum: { held: true } });
    assert.equal(heldAfterStaleAttempt._sum.held, heldBeforeStaleAttempt._sum.held);

    // Invalid persisted policy and bed JSON fail closed at quote/search time.
    await db.hotelCancellationPolicy.update({ where: { id: tenantA.policyId }, data: { cancellationTiers: { malformed: true } } });
    await assert.rejects(() => quoteFor(tenantA), /Invalid cancellation policy/);
    await db.hotelCancellationPolicy.update({ where: { id: tenantA.policyId }, data: { cancellationTiers: Prisma.DbNull } });
    await db.hotelRoomType.update({ where: { id: tenantA.roomTypeId }, data: { beds: [{ kind: "not-a-bed", count: 1 }] } });
    await assert.rejects(() => service.execute(tenantA.customer, tenantA.orgId, tenantA.propertyId, searchCommand, `bad-beds-${token}`), /Room bed configuration is invalid/);
    await db.hotelRoomType.update({ where: { id: tenantA.roomTypeId }, data: { beds: [{ kind: "queen", count: 1 }] } });

    // A paid booking keeps the cancellation policy captured by its quote even
    // after the live policy is edited. The frozen clock places cancellation
    // inside the captured policy's full-retention window.
    const oldPolicy = await db.hotelCancellationPolicy.update({ where: { id: tenantA.policyId }, data: { fullCancellationRetention: 10000, version: { increment: 1 } } });
    const frozenService = new HotelBookingSandboxService(db, () => new Date("2027-12-09T20:00:00.000Z"));
    const childQuoteResult = await frozenService.execute(tenantA.customer, tenantA.orgId, tenantA.propertyId, { action: "quote", roomTypeId: tenantA.roomTypeId, ratePlanId: tenantA.ratePlanId, ...stay, childAges: [7] }, `quote-policy-lock-${token}`);
    assert.ok(childQuoteResult.quote?.id);
    assert.equal(childQuoteResult.quote.policyVersion, oldPolicy.version);
    const lockedQuote = childQuoteResult.quote;
    const lockedTotal = Number(lockedQuote.totalAmount);
    const lockedHold = await frozenService.execute(tenantA.customer, tenantA.orgId, tenantA.propertyId, { action: "hold", quoteId: lockedQuote.id }, `hold-policy-lock-${token}`);
    assert.ok(lockedHold.hold?.id);
    const lockedReservation = await frozenService.execute(tenantA.customer, tenantA.orgId, tenantA.propertyId, { action: "reserve", quoteId: lockedQuote.id, holdId: lockedHold.hold.id, guests: [
      { fullName: `Parent ${token}`, isPrimary: true }, { fullName: `Child ${token}`, isPrimary: false, isChild: true, age: 7 },
    ] }, `reserve-policy-lock-${token}`);
    assert.ok(lockedReservation.reservation?.id);
    const lockedReservationId = lockedReservation.reservation.id;
    await db.hotelCancellationPolicy.update({ where: { id: tenantA.policyId }, data: { fullCancellationRetention: 0, version: { increment: 1 } } });
    await frozenService.execute(tenantA.customer, tenantA.orgId, tenantA.propertyId, { action: "pay", reservationId: lockedReservationId, outcome: "SUCCESS" }, `pay-policy-lock-${token}`);
    const lockedCancel = await frozenService.execute(tenantA.admin, tenantA.orgId, tenantA.propertyId, { action: "cancel", reservationId: lockedReservationId }, `cancel-policy-lock-${token}`);
    assert.equal(lockedCancel.cancellation?.refundableAmount, 0);
    assert.equal(lockedCancel.cancellation?.retainedAmount, lockedTotal);
    const lockedReservationRow = await db.hotelReservation.findUniqueOrThrow({ where: { id: lockedReservationId } });
    assert.equal(lockedReservationRow.cancellationPolicySnapshot && (lockedReservationRow.cancellationPolicySnapshot as { version?: number }).version, oldPolicy.version);
    assert.equal(lockedReservationRow.paidAmount, BigInt(lockedTotal));
    assert.equal(lockedReservationRow.refundedAmount, BigInt(0));

    const sandboxRows = await db.hotelInventoryIdempotency.findMany({ where: { organizationId: tenantA.orgId, operationScope: { in: ["HOTEL_SANDBOX_QUOTE", "HOTEL_SANDBOX_ACTION", "HOTEL_SANDBOX_PAYMENT"] } } });
    assert.ok(sandboxRows.some((row) => row.operationScope === "HOTEL_SANDBOX_QUOTE"));
    assert.ok(sandboxRows.some((row) => row.operationScope === "HOTEL_SANDBOX_ACTION"));
    assert.ok(sandboxRows.some((row) => row.operationScope === "HOTEL_SANDBOX_PAYMENT"));
    assert.ok(sandboxRows.every((row) => row.status === "COMPLETED" && row.resultJson !== null));
    assert.equal(await db.hotelPaymentAllocation.count({ where: { organizationId: tenantA.orgId } }), 0, "sandbox outcomes do not allocate real payment requests");
    passed = true;
  } catch (error) {
    const failure = error instanceof Error ? error : new Error(String(error));
    console.error(`HOTEL_BOOKING_SANDBOX_FAILURE=${failure.name}: ${failure.message}`);
    throw error;
  } finally {
    try {
      if (orgIds.length) {
        await db.hotelInventoryIdempotency.deleteMany({ where: { organizationId: { in: orgIds }, operationScope: { in: ["HOTEL_SANDBOX_QUOTE", "HOTEL_SANDBOX_ACTION", "HOTEL_SANDBOX_PAYMENT"] } } });
        await db.hotelReservationGuest.deleteMany({ where: { reservation: { organizationId: { in: orgIds } } } });
        await db.hotelReservationRoom.deleteMany({ where: { reservation: { organizationId: { in: orgIds } } } });
        await db.hotelPaymentAllocation.deleteMany({ where: { organizationId: { in: orgIds } } });
        await db.hotelReservation.deleteMany({ where: { organizationId: { in: orgIds } } });
        await db.hotelBookingHold.deleteMany({ where: { organizationId: { in: orgIds } } });
        await db.hotelInventory.deleteMany({ where: { organizationId: { in: orgIds } } });
        await db.hotelNightlyRate.deleteMany({ where: { organizationId: { in: orgIds } } });
        await db.hotelRatePlan.deleteMany({ where: { id: { in: ratePlanIds } } });
        await db.hotelCancellationPolicy.deleteMany({ where: { id: { in: policyIds } } });
        await db.hotelRoom.deleteMany({ where: { organizationId: { in: orgIds } } });
        await db.hotelRoomType.deleteMany({ where: { id: { in: roomTypeIds } } });
        await db.hotelProperty.deleteMany({ where: { id: { in: propertyIds } } });
        await db.paymentRequest.deleteMany({ where: { organizationId: { in: orgIds } } });
        await db.customerIdentity.deleteMany({ where: { organizationId: { in: orgIds } } });
        await db.guestCustomer.deleteMany({ where: { sessionId: { in: orgIds.flatMap(orgId => userIds.map(userId => `hotel-sandbox:${orgId}:${userId}`)) } } });
        await db.customerClubMembership.deleteMany({ where: { organizationId: { in: orgIds } } });
        await db.organizationMember.deleteMany({ where: { organizationId: { in: orgIds } } });
        await db.organizationCapability.deleteMany({ where: { organizationId: { in: orgIds } } });
        await db.user.deleteMany({ where: { id: { in: userIds } } });
        await db.organization.deleteMany({ where: { id: { in: orgIds } } });
        assert.equal(await db.organization.count({ where: { id: { in: orgIds } } }), 0);
        assert.equal(await db.hotelReservation.count({ where: { organizationId: { in: orgIds } } }), 0);
      }
      if (passed) console.log("HOTEL_BOOKING_SANDBOX_CLEANUP=PASSED");
    } finally {
      delete process.env.HOTEL_BOOKING_SANDBOX_ENABLED;
      await db.$disconnect();
    }
  }
});
