import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { mock, test } from "node:test";
import { NextRequest } from "next/server";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const enabled = process.env.HOTEL_OFFLINE_RECEIPT_PG_ACCEPTANCE === "1";
let actorId = "";
let organizationId = "";
class TestApiError extends Error { constructor(public status: number, message: string) { super(message); } }

// Only the session boundary is replaced. Tenant/property/guest authorization,
// upload route, storage adapter, and PostgreSQL writes remain real.
mock.module("@/lib/api-guards", { namedExports: {
  ApiError: TestApiError,
  jsonError: (error: unknown) => Response.json({ error: error instanceof TestApiError ? error.message : "Internal server error" }, { status: error instanceof TestApiError ? error.status : 500 }),
  requireAuthSession: async () => ({ user: { id: actorId, role: "CUSTOMER", organizationId }, customerContext: { organizationId } }),
  requireOrgAccess: async () => { throw new TestApiError(403, "Denied"); },
  requireRole: () => { throw new TestApiError(403, "Denied"); },
  requireSameOriginMutation: (request: Request) => { if (request.headers.get("origin") !== new URL(request.url).origin) throw new TestApiError(403, "Cross-origin request rejected"); },
} });

function guardedConnection() {
  assert.equal(process.env.CI, "true");
  assert.equal(process.env.GITHUB_ACTIONS, "true");
  assert.notEqual(process.env.NODE_ENV, "production");
  assert.notEqual(process.env.VERCEL_ENV, "production");
  assert.ok(!process.env.VERCEL);
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

test("receipt upload keeps a post-write database failure private and unattached", { skip: !enabled, concurrency: false }, async () => {
  const url = guardedConnection();
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString(), max: 8 }), log: [] });
  const token = randomUUID().replaceAll("-", "").slice(0, 14);
  const triggerName = `receipt_attach_fail_${token}`;
  const functionName = `receipt_attach_fail_fn_${token}`;
  const mediaRoot = await mkdtemp(path.join(os.tmpdir(), `hotel-receipt-fail-${token}-`));
  const oldRoot = process.env.MEDIA_STORAGE_ROOT;
  const oldAdapter = process.env.APPLICATION_STORAGE_ADAPTER;
  const oldHotelGate = process.env.HOTEL_OPERATIONAL_RESERVATIONS_ENABLED;
  const oldPaymentGate = process.env.HOTEL_OFFLINE_PAYMENT_OPERATIONAL_ENABLED;
  let triggerInstalled = false;
  let organizationIdOwned: string | undefined;
  let propertyId: string | undefined;
  let roomTypeId: string | undefined;
  let ratePlanId: string | undefined;
  let reservationId: string | undefined;
  let guestCustomerId: string | undefined;
  let userId: string | undefined;
  let storage;
  let POST: typeof import("../../app/api/organizations/[id]/hotels/[propertyId]/reservations/[reservationId]/offline-payments/[paymentId]/receipt/route").POST;
  let GET: typeof import("../../app/api/organizations/[id]/hotels/[propertyId]/reservations/[reservationId]/offline-payments/[paymentId]/receipt/route").GET;
  let mediaGET: typeof import("../../app/api/media/[organizationId]/[...key]/route").GET;
  try {
    process.env.MEDIA_STORAGE_ROOT = mediaRoot;
    process.env.APPLICATION_STORAGE_ADAPTER = "persistent-disk";
    process.env.HOTEL_OPERATIONAL_RESERVATIONS_ENABLED = "1";
    process.env.HOTEL_OFFLINE_PAYMENT_OPERATIONAL_ENABLED = "1";
    ({ POST, GET } = await import("../../app/api/organizations/[id]/hotels/[propertyId]/reservations/[reservationId]/offline-payments/[paymentId]/receipt/route"));
    ({ GET: mediaGET } = await import("../../app/api/media/[organizationId]/[...key]/route"));
    storage = await import("../../lib/hotel/offline-payments/receipt-storage.server");

    const identity = await db.$queryRaw<Array<{ database: string; role: string; port: number }>>`SELECT current_database()::text AS database, current_user::text AS role, inet_server_port() AS port`;
    assert.deepEqual(identity, [{ database: "retail_hero_test", role: "hero_test", port: 5432 }]);
    const org = await db.organization.create({ data: { type: "SHOP", vertical: "HOTEL", name: `Receipt failure ${token}`, slug: `receipt-failure-${token}` } });
    organizationIdOwned = organizationId = org.id;
    await db.organizationCapability.create({ data: { organizationId: org.id, key: "HOTEL_BOOKING", status: "ACTIVE", enabledAt: new Date() } });
    const user = await db.user.create({ data: { name: `receipt-guest-${token}`, password: "fixture-only", role: "CUSTOMER", isTeamMember: false } });
    userId = actorId = user.id;
    const guest = await db.guestCustomer.create({ data: { name: `Receipt guest ${token}`, sessionId: `receipt-${token}` } });
    guestCustomerId = guest.id;
    await db.customerIdentity.create({ data: { organizationId: org.id, userId: user.id, guestCustomerId: guest.id, status: "ACTIVE" } });
    await db.customerClubMembership.create({ data: { organizationId: org.id, customerId: user.id, status: "ACTIVE" } });
    const property = await db.hotelProperty.create({ data: { organizationId: org.id, organizationSlug: org.slug, slug: `receipt-property-${token}`, name: `Receipt property ${token}` } });
    propertyId = property.id;
    const room = await db.hotelRoomType.create({ data: { organizationId: org.id, propertyId, slug: `receipt-room-${token}`, name: "Receipt room", maxAdults: 2, maxChildren: 0, maxOccupancy: 2, beds: [] } });
    roomTypeId = room.id;
    const rate = await db.hotelRatePlan.create({ data: { organizationId: org.id, propertyId, roomTypeId, code: `receipt-rate-${token}`, name: "Receipt rate", baseNightlyRate: BigInt(100_000) } });
    ratePlanId = rate.id;
    const reservation = await db.hotelReservation.create({ data: {
      id: `receipt-${token}`, organizationId: org.id, propertyId, roomTypeId, ratePlanId,
      reference: `receipt-ref-${token}`, status: "PENDING_PAYMENT", checkIn: new Date("2027-12-10T00:00:00Z"),
      checkOut: new Date("2027-12-11T00:00:00Z"), currency: "TOMAN", totalAmount: BigInt(100_000),
      cancellationPolicyKey: "receipt-test", cancellationPolicySnapshot: { key: "receipt-test" }, guestCustomerId: guest.id,
      idempotencyKey: `receipt-res-${token}`,
    } });
    reservationId = reservation.id;
    const payment = await db.hotelOfflinePayment.create({ data: {
      organizationId: org.id, reservationId, method: "BANK_TRANSFER", status: "SUBMITTED", amountToman: BigInt(50_000),
      recordedByUserId: user.id, bankReference: `receipt-bank-${token}`,
    } });

    await db.$executeRawUnsafe(`CREATE FUNCTION public."${functionName}"() RETURNS trigger LANGUAGE plpgsql AS $body$ BEGIN IF NEW."id" = '${payment.id}' AND NEW."receiptKey" IS DISTINCT FROM OLD."receiptKey" THEN RAISE EXCEPTION 'injected receipt attachment failure' USING ERRCODE = 'P0001'; END IF; RETURN NEW; END $body$`);
    triggerInstalled = true;
    await db.$executeRawUnsafe(`CREATE TRIGGER "${triggerName}" BEFORE UPDATE ON public."HotelOfflinePayment" FOR EACH ROW EXECUTE FUNCTION public."${functionName}"()`);

    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p2sAAAAASUVORK5CYII=", "base64");
    const form = new FormData();
    form.append("receipt", new File([png], "receipt.png", { type: "image/png" }));
    const routeParams = { params: Promise.resolve({ id: org.id, propertyId: property.id, reservationId: reservation.id, paymentId: payment.id }) };
    const upload = await POST(new NextRequest(`http://localhost/api/organizations/${org.id}/hotels/${property.id}/reservations/${reservation.id}/offline-payments/${payment.id}/receipt`, {
      method: "POST", headers: { origin: "http://localhost" }, body: form,
    }), routeParams);
    assert.equal(upload.status, 500, "database error after file write must be surfaced as a failed upload");
    const persistedPayment = await db.hotelOfflinePayment.findUniqueOrThrow({ where: { id: payment.id } });
    assert.equal(persistedPayment.receiptKey, null, "failure cannot falsely mark the receipt attached");
    assert.equal(persistedPayment.status, "SUBMITTED");

    const files = await readdir(path.join(mediaRoot, "hotel-payment", org.id));
    assert.equal(files.length, 0, "confirmed rollback removes only this upload's private orphan");

    const receiptRead = await GET(new NextRequest(`http://localhost/api/organizations/${org.id}/hotels/${property.id}/reservations/${reservation.id}/offline-payments/${payment.id}/receipt`), routeParams);
    assert.equal(receiptRead.status, 404, "receipt endpoint cannot serve an unattached private object");

    // Simulate a lost response after a genuine PostgreSQL commit. Reconciliation must
    // observe the association and retain the private object rather than deleting it.
    await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${triggerName}" ON public."HotelOfflinePayment"`);
    await db.$executeRawUnsafe(`DROP FUNCTION IF EXISTS public."${functionName}"()`);
    triggerInstalled = false;
    const retryForm = new FormData();
    retryForm.append("receipt", new File([png], "receipt-retry.png", { type: "image/png" }));
    const retry = await POST(new NextRequest(`http://localhost/api/organizations/${org.id}/hotels/${property.id}/reservations/${reservation.id}/offline-payments/${payment.id}/receipt`, {
      method: "POST", headers: { origin: "http://localhost" }, body: retryForm,
    }), routeParams);
    assert.equal(retry.status, 201, "a later retry attaches successfully after confirmed cleanup of the failed attempt");
    const retriedPayment = await db.hotelOfflinePayment.findUniqueOrThrow({ where: { id: payment.id } });
    assert.ok(retriedPayment.receiptKey);
    assert.deepEqual((await storage.readHotelPaymentReceipt(org.id, retriedPayment.receiptKey!)).buffer, png);

    const committedPayment = await db.hotelOfflinePayment.create({ data: {
      organizationId: org.id, reservationId, method: "BANK_TRANSFER", status: "SUBMITTED", amountToman: BigInt(25_000),
      recordedByUserId: user.id, bankReference: `receipt-ambiguous-${token}`,
    } });
    const { prisma: applicationPrisma } = await import("../../lib/db-runtime");
    const delegate = applicationPrisma.hotelOfflinePayment;
    const originalUpdateMany = delegate.updateMany.bind(delegate);
    let loseResponse = true;
    delegate.updateMany = (async (...args: Parameters<typeof delegate.updateMany>) => {
      const result = await originalUpdateMany(...args);
      if (loseResponse) { loseResponse = false; throw new Error("injected lost database response after commit"); }
      return result;
    }) as unknown as typeof delegate.updateMany;
    try {
      const committedParams = { params: Promise.resolve({ id: org.id, propertyId: property.id, reservationId: reservation.id, paymentId: committedPayment.id }) };
      const committedForm = new FormData();
      committedForm.append("receipt", new File([png], "receipt.png", { type: "image/png" }));
      const committedUpload = await POST(new NextRequest(`http://localhost/api/organizations/${org.id}/hotels/${property.id}/reservations/${reservation.id}/offline-payments/${committedPayment.id}/receipt`, {
        method: "POST", headers: { origin: "http://localhost" }, body: committedForm,
      }), committedParams);
      assert.equal(committedUpload.status, 201, "a confirmed committed attachment is recovered as success");
      const attached = await db.hotelOfflinePayment.findUniqueOrThrow({ where: { id: committedPayment.id } });
      assert.ok(attached.receiptKey);
      assert.deepEqual((await storage.readHotelPaymentReceipt(org.id, attached.receiptKey!)).buffer, png);
      const publicMedia = await mediaGET(new Request(`http://localhost/api/media/${org.id}/hotel-payment/${org.id}/${attached.receiptKey}`), {
        params: Promise.resolve({ organizationId: org.id, key: ["hotel-payment", org.id, attached.receiptKey!] }),
      });
      assert.equal(publicMedia.status, 404, "generic media route never exposes a committed private receipt");
    } finally {
      delegate.updateMany = originalUpdateMany;
    }
  } finally {
    if (triggerInstalled) {
      await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${triggerName}" ON public."HotelOfflinePayment"`);
      await db.$executeRawUnsafe(`DROP FUNCTION IF EXISTS public."${functionName}"()`);
    }
    if (organizationIdOwned) {
      await db.hotelOfflinePaymentAuditEvent.deleteMany({ where: { organizationId: organizationIdOwned } });
      await db.hotelOfflinePaymentCommandIdempotency.deleteMany({ where: { organizationId: organizationIdOwned } });
      await db.hotelOfflinePayment.deleteMany({ where: { organizationId: organizationIdOwned } });
      if (reservationId) await db.hotelReservation.deleteMany({ where: { id: reservationId } });
      await db.customerIdentity.deleteMany({ where: { organizationId: organizationIdOwned } });
      await db.customerClubMembership.deleteMany({ where: { organizationId: organizationIdOwned } });
      await db.hotelRatePlan.deleteMany({ where: { organizationId: organizationIdOwned } });
      await db.hotelRoomType.deleteMany({ where: { organizationId: organizationIdOwned } });
      await db.hotelProperty.deleteMany({ where: { organizationId: organizationIdOwned } });
      await db.organizationCapability.deleteMany({ where: { organizationId: organizationIdOwned } });
      await db.guestCustomer.deleteMany({ where: { id: guestCustomerId ?? "" } });
      await db.organization.deleteMany({ where: { id: organizationIdOwned } });
      await db.user.deleteMany({ where: { id: userId ?? "" } });
    }
    if (oldRoot === undefined) delete process.env.MEDIA_STORAGE_ROOT; else process.env.MEDIA_STORAGE_ROOT = oldRoot;
    if (oldAdapter === undefined) delete process.env.APPLICATION_STORAGE_ADAPTER; else process.env.APPLICATION_STORAGE_ADAPTER = oldAdapter;
    if (oldHotelGate === undefined) delete process.env.HOTEL_OPERATIONAL_RESERVATIONS_ENABLED; else process.env.HOTEL_OPERATIONAL_RESERVATIONS_ENABLED = oldHotelGate;
    if (oldPaymentGate === undefined) delete process.env.HOTEL_OFFLINE_PAYMENT_OPERATIONAL_ENABLED; else process.env.HOTEL_OFFLINE_PAYMENT_OPERATIONAL_ENABLED = oldPaymentGate;
    await db.$disconnect();
    await rm(mediaRoot, { recursive: true, force: true });
  }
});
