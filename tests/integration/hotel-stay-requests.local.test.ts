import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { HotelStayRequestService } from "../../lib/hotel/services/hotel-stay-request.service";

const enabled = process.env.HOTEL_STAY_REQUEST_ACCEPTANCE === "1";
const day = (value: string) => new Date(`${value}T00:00:00.000Z`);
const stay = { checkIn: "2027-12-10", checkOut: "2027-12-12", adults: 1, childAges: [] as number[] };

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

test("Hotel stay requests price from server data and never mutate booking inventory or payment state", {
  skip: !enabled,
  concurrency: false,
}, async () => {
  const connection = guardedConnection();
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: connection.toString(), max: 8 }), log: [] });
  const token = randomUUID().replaceAll("-", "").slice(0, 14);
  const organizationIds: string[] = [];
  const userIds: string[] = [];
  const propertyIds: string[] = [];
  const policyIds: string[] = [];
  const roomTypeIds: string[] = [];
  const ratePlanIds: string[] = [];
  const quoteIds: string[] = [];
  const requestIds: string[] = [];
  let passed = false;
  const originalPortalFlag = process.env.HOTEL_GUEST_PORTAL_ENABLED;

  try {
    const identity = await db.$queryRaw<Array<{ database: string; role: string; port: number }>>`
      SELECT current_database()::text AS database, current_user::text AS role, inet_server_port() AS port`;
    assert.deepEqual(identity, [{ database: "retail_hero_test", role: "hero_test", port: 5432 }]);

    const organizationA = await db.organization.create({ data: {
      type: "SHOP", vertical: "HOTEL", name: `Stay request A ${token}`, slug: `stay-request-a-${token}`,
    } });
    organizationIds.push(organizationA.id);
    const organizationB = await db.organization.create({ data: {
      type: "SHOP", vertical: "HOTEL", name: `Stay request B ${token}`, slug: `stay-request-b-${token}`,
    } });
    organizationIds.push(organizationB.id);
    await db.organizationCapability.createMany({ data: [organizationA, organizationB].map(organization => ({
      organizationId: organization.id, key: "HOTEL_BOOKING", status: "ACTIVE", enabledAt: new Date(),
    })) });

    const customer = await db.user.create({ data: {
      name: `stay-request-customer-${token}`, password: "fixture-only", role: "CUSTOMER", isTeamMember: false,
    } });
    userIds.push(customer.id);
    const otherCustomer = await db.user.create({ data: {
      name: `stay-request-other-${token}`, password: "fixture-only", role: "CUSTOMER", isTeamMember: false,
    } });
    userIds.push(otherCustomer.id);
    const adminA = await db.user.create({ data: {
      name: `stay-request-admin-a-${token}`, password: "fixture-only", role: "ADMIN", isTeamMember: true,
    } });
    userIds.push(adminA.id);
    const adminB = await db.user.create({ data: {
      name: `stay-request-admin-b-${token}`, password: "fixture-only", role: "ADMIN", isTeamMember: true,
    } });
    userIds.push(adminB.id);

    await db.customerClubMembership.createMany({ data: [organizationA, organizationB].map(organization => ({
      organizationId: organization.id, customerId: customer.id, status: "ACTIVE", source: "PUBLIC_SHOP",
    })) });
    await db.customerClubMembership.create({ data: {
      organizationId: organizationA.id, customerId: otherCustomer.id, status: "ACTIVE", source: "PUBLIC_SHOP",
    } });
    await db.organizationMember.createMany({ data: [
      { organizationId: organizationA.id, organizationSlug: organizationA.slug, userId: adminA.id, role: "ADMIN", isActive: true },
      { organizationId: organizationB.id, organizationSlug: organizationB.slug, userId: adminB.id, role: "ADMIN", isActive: true },
    ] });

    const propertyA = await db.hotelProperty.create({ data: {
      organizationId: organizationA.id, organizationSlug: organizationA.slug, slug: `property-a-${token}`,
      name: `Request only A ${token}`, operationalMode: "REQUEST_ONLY",
    } });
    propertyIds.push(propertyA.id);
    const propertyB = await db.hotelProperty.create({ data: {
      organizationId: organizationB.id, organizationSlug: organizationB.slug, slug: `property-b-${token}`,
      name: `Request only B ${token}`, operationalMode: "REQUEST_ONLY",
    } });
    propertyIds.push(propertyB.id);
    const disabledProperty = await db.hotelProperty.create({ data: {
      organizationId: organizationA.id, organizationSlug: organizationA.slug, slug: `property-disabled-${token}`,
      name: `Disabled property ${token}`,
    } });
    propertyIds.push(disabledProperty.id);

    const policyA = await db.hotelCancellationPolicy.create({ data: {
      organizationId: organizationA.id, propertyId: propertyA.id, key: `flex-a-${token}`, name: "Fixture flexible",
      freeCancellationCutoffHours: 24, fullCancellationRetention: 0, version: 4,
    } });
    policyIds.push(policyA.id);
    const policyB = await db.hotelCancellationPolicy.create({ data: {
      organizationId: organizationB.id, propertyId: propertyB.id, key: `flex-b-${token}`, name: "Fixture flexible",
      freeCancellationCutoffHours: 24, fullCancellationRetention: 0, version: 2,
    } });
    policyIds.push(policyB.id);
    const roomTypeA = await db.hotelRoomType.create({ data: {
      organizationId: organizationA.id, propertyId: propertyA.id, slug: `room-a-${token}`, name: "Request room A",
      maxAdults: 2, maxChildren: 1, maxOccupancy: 3, beds: [{ kind: "queen", count: 1 }], totalAllotment: 4,
    } });
    roomTypeIds.push(roomTypeA.id);
    const roomTypeB = await db.hotelRoomType.create({ data: {
      organizationId: organizationB.id, propertyId: propertyB.id, slug: `room-b-${token}`, name: "Request room B",
      maxAdults: 2, maxChildren: 1, maxOccupancy: 3, beds: [{ kind: "queen", count: 1 }], totalAllotment: 4,
    } });
    roomTypeIds.push(roomTypeB.id);
    const ratePlanA = await db.hotelRatePlan.create({ data: {
      organizationId: organizationA.id, propertyId: propertyA.id, roomTypeId: roomTypeA.id, code: `FLEX-A-${token}`,
      name: "Flexible A", baseNightlyRate: BigInt(125000), cancellationPolicyId: policyA.id,
    } });
    ratePlanIds.push(ratePlanA.id);
    const ratePlanB = await db.hotelRatePlan.create({ data: {
      organizationId: organizationB.id, propertyId: propertyB.id, roomTypeId: roomTypeB.id, code: `FLEX-B-${token}`,
      name: "Flexible B", baseNightlyRate: BigInt(175000), cancellationPolicyId: policyB.id,
    } });
    ratePlanIds.push(ratePlanB.id);
    const inventoryBefore = await Promise.all([organizationA, organizationB].map(organization => db.hotelInventory.createMany({
      data: ["2027-12-10", "2027-12-11"].map(date => ({
        organizationId: organization.id,
        propertyId: organization.id === organizationA.id ? propertyA.id : propertyB.id,
        roomTypeId: organization.id === organizationA.id ? roomTypeA.id : roomTypeB.id,
        date: day(date), allotment: 4,
      })),
    })));
    assert.deepEqual(inventoryBefore.map(row => row.count), [2, 2]);

    const service = new HotelStayRequestService(db);
    const customerA = { userId: customer.id, role: "CUSTOMER", organizationId: organizationA.id, customerContextVerified: true } as const;
    const customerB = { userId: customer.id, role: "CUSTOMER", organizationId: organizationB.id, customerContextVerified: true } as const;
    const otherActorA = { userId: otherCustomer.id, role: "CUSTOMER", organizationId: organizationA.id, customerContextVerified: true } as const;
    const adminActorA = { userId: adminA.id, role: "ADMIN", organizationId: organizationA.id } as const;
    const adminActorB = { userId: adminB.id, role: "ADMIN", organizationId: organizationB.id } as const;
    const quoteCommand = (roomTypeId: string, ratePlanId: string) => ({ action: "quote", roomTypeId, ratePlanId, ...stay });
    const quoteAResult = await service.execute(customerA, organizationA.id, propertyA.id, quoteCommand(roomTypeA.id, ratePlanA.id), `quote-a-${token}`);
    assert.ok(quoteAResult.quote?.id);
    const quoteA = quoteAResult.quote as { id: string; totalAmount: string; nightlyRates: number[]; policyVersion: number; policy: Record<string, unknown>; expiresAt: string };
    quoteIds.push(quoteA.id);
    assert.equal(quoteA.totalAmount, "250000");
    assert.deepEqual(quoteA.nightlyRates, [125000, 125000]);
    assert.equal(quoteA.policyVersion, 4);

    const requestKey = `request-shared-${token}`;
    const requestCommand = { action: "request", quoteId: quoteA.id, guestName: `Primary guest ${token}`, message: `Please contact me ${token}` };
    const beforeCounts = await readOperationalCounts(db, organizationIds);
    await db.hotelRatePlan.update({ where: { id: ratePlanA.id }, data: { baseNightlyRate: BigInt(900000) } });
    await db.hotelCancellationPolicy.update({ where: { id: policyA.id }, data: { fullCancellationRetention: 5000, version: { increment: 1 } } });

    // Same-key and distinct-key races against one quote both converge on one
    // durable request; the quote's unique relation is the final deduplication guard.
    const concurrent = await Promise.all([
      service.execute(customerA, organizationA.id, propertyA.id, requestCommand, requestKey),
      service.execute(customerA, organizationA.id, propertyA.id, requestCommand, requestKey),
    ]);
    assert.deepEqual(concurrent[0], concurrent[1]);
    assert.ok(concurrent[0].request?.id);
    const requestA = concurrent[0].request as { id: string; quoteId: string; status: string; snapshot: Record<string, unknown>; guestName: string; message: string | null };
    requestIds.push(requestA.id);
    assert.equal(requestA.status, "NEW");
    assert.equal(requestA.quoteId, quoteA.id);
    assert.equal(requestA.guestName, requestCommand.guestName);
    assert.equal(requestA.message, requestCommand.message);
    assert.deepEqual(requestA.snapshot, quoteA);

    const differentKeyReplay = await service.execute(customerA, organizationA.id, propertyA.id, requestCommand, `request-distinct-${token}`);
    assert.equal(differentKeyReplay.request?.id, requestA.id, "same quote and identical request payload return its existing request");
    await assert.rejects(() => service.execute(customerA, organizationA.id, propertyA.id,
      { ...requestCommand, guestName: `Changed guest ${token}` }, requestKey), /Idempotency-Key conflict/i);
    await assert.rejects(() => service.execute(customerA, organizationA.id, propertyA.id,
      { ...requestCommand, message: `Changed message ${token}` }, `request-payload-conflict-${token}`), /conflict|already submitted|request exists/i);
    await db.hotelStayQuote.update({ where: { id: quoteA.id }, data: { expiresAt: new Date(Date.now() - 60_000) } });
    const expiredQuoteReplay = await service.execute(customerA, organizationA.id, propertyA.id, requestCommand, `request-expired-replay-${token}`);
    assert.equal(expiredQuoteReplay.request?.id, requestA.id, "existing request replay remains available after its source quote expires");

    const storedQuote = await db.hotelStayQuote.findUniqueOrThrow({ where: { id: quoteA.id } });
    const storedRequest = await db.hotelStayRequest.findUniqueOrThrow({ where: { id: requestA.id } });
    assert.equal(storedQuote.userId, customer.id);
    assert.equal(storedQuote.organizationId, organizationA.id);
    assert.equal(storedQuote.propertyId, propertyA.id);
    assert.deepEqual(storedRequest.snapshot, storedQuote.snapshot, "request retains the original server-priced quote snapshot");
    assert.equal((storedRequest.snapshot as { totalAmount?: string }).totalAmount, "250000");
    assert.equal((storedRequest.snapshot as { policyVersion?: number }).policyVersion, 4);

    // The tenant-scoped authenticated identity and each resource boundary are
    // enforced even when the same account is an active member of both clubs.
    await assert.rejects(() => service.execute(customerB, organizationA.id, propertyA.id, requestCommand, `foreign-context-${token}`), /forbidden|tenant|organization/i);
    await assert.rejects(() => service.execute(otherActorA, organizationA.id, propertyA.id, requestCommand, `foreign-customer-${token}`), /quote not found|forbidden|owner/i);
    await assert.rejects(() => service.execute(customerB, organizationB.id, propertyB.id,
      { action: "request", quoteId: quoteA.id, guestName: `Foreign ${token}` }, `foreign-resource-${token}`), /quote not found|forbidden|property/i);
    await assert.rejects(() => service.execute(adminActorB, organizationB.id, propertyB.id,
      { action: "review-request", requestId: requestA.id, status: "CONTACTED" }, `foreign-review-${token}`), /not found|forbidden|tenant/i);
    await assert.rejects(() => service.execute(customerA, organizationA.id, propertyA.id,
      { action: "review-request", requestId: requestA.id, status: "CONTACTED" }, `customer-review-${token}`), /forbidden|staff|role/i);

    const viewA = await service.get(customerA, organizationA.id, propertyA.id);
    assert.equal(viewA.enabled, true);
    assert.equal(viewA.mode, "REQUEST_ONLY");
    assert.ok(viewA.requests.some((row: { id: string }) => row.id === requestA.id));
    const viewAsOtherCustomer = await service.get(otherActorA, organizationA.id, propertyA.id);
    assert.equal(viewAsOtherCustomer.requests.some((row: { id: string }) => row.id === requestA.id), false);
    const viewB = await service.get(customerB, organizationB.id, propertyB.id);
    assert.deepEqual(viewB.requests, []);

    const contactedResult = await service.execute(adminActorA, organizationA.id, propertyA.id,
      { action: "review-request", requestId: requestA.id, status: "CONTACTED" }, `review-contacted-${token}`);
    assert.equal(contactedResult.request?.status, "CONTACTED");
    const contactedCancellation = await service.execute(customerA, organizationA.id, propertyA.id,
      { action: "cancel-request", requestId: requestA.id }, `cancel-contacted-${token}`);
    assert.equal(contactedCancellation.request?.status, "CANCELLED", "a contacted enquiry remains cancellable until confirmed or declined");

    const declinedQuoteResult = await service.execute(customerA, organizationA.id, propertyA.id, quoteCommand(roomTypeA.id, ratePlanA.id), `quote-declined-${token}`);
    assert.ok(declinedQuoteResult.quote?.id);
    const declinedQuoteId = declinedQuoteResult.quote.id;
    quoteIds.push(declinedQuoteId);
    const declinedRequest = await service.execute(customerA, organizationA.id, propertyA.id,
      { action: "request", quoteId: declinedQuoteId, guestName: `Declined guest ${token}`, message: "A second enquiry" }, `request-declined-${token}`);
    assert.ok(declinedRequest.request?.id);
    requestIds.push(declinedRequest.request.id);
    const declinedResult = await service.execute(adminActorA, organizationA.id, propertyA.id,
      { action: "review-request", requestId: declinedRequest.request.id, status: "DECLINED" }, `review-declined-${token}`);
    assert.equal(declinedResult.request?.status, "DECLINED");
    await assert.rejects(() => service.execute(customerA, organizationA.id, propertyA.id,
      { action: "cancel-request", requestId: declinedRequest.request!.id }, `cancel-declined-${token}`), (error: unknown) => error instanceof Error && "status" in error && error.status === 409);

    const cancelQuoteResult = await service.execute(customerA, organizationA.id, propertyA.id, quoteCommand(roomTypeA.id, ratePlanA.id), `quote-cancel-${token}`);
    assert.ok(cancelQuoteResult.quote?.id);
    const cancelQuoteId = cancelQuoteResult.quote.id;
    quoteIds.push(cancelQuoteId);
    const cancelRequestResult = await service.execute(customerA, organizationA.id, propertyA.id,
      { action: "request", quoteId: cancelQuoteId, guestName: `Cancelled guest ${token}` }, `request-cancel-${token}`);
    assert.ok(cancelRequestResult.request?.id);
    const cancelledRequestId = cancelRequestResult.request.id;
    requestIds.push(cancelledRequestId);
    const cancelled = await service.execute(customerA, organizationA.id, propertyA.id,
      { action: "cancel-request", requestId: cancelledRequestId }, `cancel-request-${token}`);
    assert.equal(cancelled.request?.status, "CANCELLED");
    await assert.rejects(() => service.execute(adminActorA, organizationA.id, propertyA.id,
      { action: "review-request", requestId: cancelledRequestId, status: "CONTACTED" }, `review-cancelled-${token}`), (error: unknown) => error instanceof Error && "status" in error && error.status === 409);
    const cancelReplay = await service.execute(customerA, organizationA.id, propertyA.id,
      { action: "cancel-request", requestId: cancelledRequestId }, `cancel-terminal-${token}`);
    assert.deepEqual(cancelReplay, cancelled, "repeating the terminal cancel is idempotent");

    // Request-only commands have strict schemas. No reservation/payment action
    // can be smuggled into this service surface.
    for (const command of [
      { action: "hold", quoteId: quoteA.id },
      { action: "reserve", quoteId: quoteA.id, holdId: "fake-hold", guests: [{ fullName: "Fake", isPrimary: true }] },
      { action: "pay", reservationId: "fake-reservation", outcome: "SUCCESS" },
    ]) {
      await assert.rejects(() => service.execute(customerA, organizationA.id, propertyA.id, command, `unsupported-${randomUUID()}`));
    }

    await assert.rejects(() => service.configure(customerA, organizationA.id, propertyA.id, { mode: "DISABLED" }), (error: unknown) => error instanceof Error && "status" in error && error.status === 403);
    await assert.rejects(() => service.configure(adminActorB, organizationA.id, propertyA.id, { mode: "DISABLED" }));
    await service.configure(adminActorA, organizationA.id, propertyA.id, { mode: "DISABLED" });
    await assert.rejects(() => service.get(customerA, organizationA.id, propertyA.id), /disabled/i);
    await service.configure(adminActorA, organizationA.id, propertyA.id, { mode: "REQUEST_ONLY" });
    assert.equal((await service.get(customerA, organizationA.id, propertyA.id)).enabled, true);
    await assert.rejects(() => service.get(customerA, organizationA.id, disabledProperty.id), /disabled|not available|forbidden/i);
    await assert.rejects(() => service.execute(customerA, organizationA.id, disabledProperty.id,
      quoteCommand(roomTypeA.id, ratePlanA.id), `property-disabled-${token}`), /disabled|not available|forbidden/i);
    delete process.env.HOTEL_GUEST_PORTAL_ENABLED;
    await assert.rejects(() => service.get(customerA, organizationA.id, propertyA.id), /disabled|not enabled|forbidden/i);
    await assert.rejects(() => service.execute(customerA, organizationA.id, propertyA.id,
      quoteCommand(roomTypeA.id, ratePlanA.id), `flag-disabled-${token}`), /disabled|not enabled|forbidden/i);
    process.env.HOTEL_GUEST_PORTAL_ENABLED = originalPortalFlag;

    const afterCounts = await readOperationalCounts(db, organizationIds);
    assert.deepEqual(afterCounts, beforeCounts, "quote and enquiry flows leave inventory, holds, reservations, and payment records unchanged");
    assert.equal(await db.hotelStayRequest.count({ where: { organizationId: { in: organizationIds }, quoteId: { in: quoteIds } } }), 3);
    assert.equal(await db.hotelStayRequest.count({ where: { organizationId: organizationA.id, quoteId: quoteA.id } }), 1, "the quote's unique relation prevents duplicate requests");
    assert.equal(new Set(requestIds).size, 3, "each fixture quote owns one distinct request");
    passed = true;
  } catch (error) {
    const failure = error instanceof Error ? error : new Error(String(error));
    console.error(`HOTEL_STAY_REQUEST_FAILURE=${failure.name}: ${failure.message}`);
    throw error;
  } finally {
    process.env.HOTEL_GUEST_PORTAL_ENABLED = originalPortalFlag;
    try {
      if (organizationIds.length) {
        await db.hotelStayRequest.deleteMany({ where: { organizationId: { in: organizationIds } } });
        await db.hotelStayQuote.deleteMany({ where: { organizationId: { in: organizationIds } } });
        await db.hotelInventory.deleteMany({ where: { organizationId: { in: organizationIds } } });
        await db.hotelNightlyRate.deleteMany({ where: { organizationId: { in: organizationIds } } });
        await db.hotelRatePlan.deleteMany({ where: { id: { in: ratePlanIds } } });
        await db.hotelCancellationPolicy.deleteMany({ where: { id: { in: policyIds } } });
        await db.hotelRoom.deleteMany({ where: { organizationId: { in: organizationIds } } });
        await db.hotelRoomType.deleteMany({ where: { id: { in: roomTypeIds } } });
        await db.hotelProperty.deleteMany({ where: { id: { in: propertyIds } } });
        await db.customerClubMembership.deleteMany({ where: { organizationId: { in: organizationIds }, customerId: { in: userIds } } });
        await db.organizationMember.deleteMany({ where: { organizationId: { in: organizationIds }, userId: { in: userIds } } });
        await db.organizationCapability.deleteMany({ where: { organizationId: { in: organizationIds } } });
        await db.organization.deleteMany({ where: { id: { in: organizationIds } } });
        await db.user.deleteMany({ where: { id: { in: userIds } } });
        assert.equal(await db.hotelStayRequest.count({ where: { organizationId: { in: organizationIds } } }), 0);
        assert.equal(await db.hotelStayQuote.count({ where: { organizationId: { in: organizationIds } } }), 0);
        assert.equal(await db.organization.count({ where: { id: { in: organizationIds } } }), 0);
        assert.equal(await db.user.count({ where: { id: { in: userIds } } }), 0);
      }
      if (passed) console.log("HOTEL_STAY_REQUEST_CLEANUP=PASSED");
    } finally {
      await db.$disconnect();
    }
  }
});

async function readOperationalCounts(db: PrismaClient, organizationIds: string[]) {
  const [inventory, adjustments, holds, reservations, payments, allocations, paymentRequests] = await Promise.all([
    db.hotelInventory.count({ where: { organizationId: { in: organizationIds } } }),
    db.hotelInventoryAdjustment.count({ where: { organizationId: { in: organizationIds } } }),
    db.hotelBookingHold.count({ where: { organizationId: { in: organizationIds } } }),
    db.hotelReservation.count({ where: { organizationId: { in: organizationIds } } }),
    db.hotelInventoryIdempotency.count({ where: { organizationId: { in: organizationIds }, operationScope: { in: ["HOTEL_SANDBOX_PAYMENT", "HOTEL_SANDBOX_ACTION"] } } }),
    db.hotelPaymentAllocation.count({ where: { organizationId: { in: organizationIds } } }),
    db.paymentRequest.count({ where: { organizationId: { in: organizationIds } } }),
  ]);
  return { inventory, adjustments, holds, reservations, payments, allocations, paymentRequests };
}
