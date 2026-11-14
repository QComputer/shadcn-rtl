import assert from "node:assert/strict";
import { before, mock, test } from "node:test";
import { NextRequest } from "next/server";

type Session = { user: { id: string; role: string; organizationId: string | null }; customerContext?: { organizationId: string } } | null;
let session: Session = { user: { id: "staff-1", role: "STAFF", organizationId: "org-1" } };
let bookingAllowed = true;
let reservationExists = true;
let customerIdentityActive = true;
let rawEntries: Array<Record<string, unknown>> = [];
let rawQueryError: Error | null = null;
let serviceResult: unknown = { outcome: "APPLIED", entry: { id: "entry-1", method: "CASH", status: "VERIFIED", amountToman: 125n } };
const calls: Array<{ name: string; args: unknown[] }> = [];

class TestApiError extends Error { constructor(public status: number, message: string) { super(message); } }

const prisma = {
  hotelReservation: {
    findFirst: async (args: unknown) => { calls.push({ name: "reservation.findFirst", args: [args] }); return reservationExists ? { totalAmount: 500n, paidAmount: 125n, guestCustomerId: "guest-1" } : null; },
  },
  customerIdentity: {
    findFirst: async (args: unknown) => { calls.push({ name: "customerIdentity.findFirst", args: [args] }); return customerIdentityActive ? { id: "identity-1" } : null; },
  },
  $queryRaw: async () => {
    if (rawQueryError) throw rawQueryError;
    return rawEntries;
  },
};

mock.module("@/lib/api-guards", { namedExports: {
  ApiError: TestApiError,
  jsonError: (error: unknown) => Response.json({ error: error instanceof TestApiError ? error.message : "Internal server error" }, { status: error instanceof TestApiError ? error.status : 500 }),
  requireAuthSession: async () => { if (!session) throw new TestApiError(401, "Unauthorized"); return session; },
  requireSameOriginMutation: (request: Request) => { if (request.headers.get("origin") !== new URL(request.url).origin) throw new TestApiError(403, "Cross-origin request rejected"); },
} });
mock.module("@/lib/db-runtime", { namedExports: { prisma } });
mock.module("@/lib/hotel/services/booking-context", { namedExports: {
  authorizeHotelBookingActor: async (...args: unknown[]) => {
    calls.push({ name: "authorizeHotelBookingActor", args });
    const actor = args[1] as { role: string; customerContextVerified?: boolean };
    const organizationId = args[2];
    const propertyId = args[3];
    if (!bookingAllowed || organizationId !== "org-1" || propertyId !== "property-1" || (actor.role === "CUSTOMER" && !actor.customerContextVerified)) {
      throw new TestApiError(403, "Hotel property access denied");
    }
  },
} });
mock.module("@/lib/hotel/offline-payments/service", { namedExports: {
  createHotelOfflinePaymentService: () => ({
    recordCash: async (...args: unknown[]) => { calls.push({ name: "recordCash", args }); return serviceResult; },
    verifyBankTransfer: async (...args: unknown[]) => { calls.push({ name: "verifyBankTransfer", args }); return serviceResult; },
    submitBankTransfer: async (...args: unknown[]) => { calls.push({ name: "submitBankTransfer", args }); return serviceResult; },
  }),
} });
mock.module("@/lib/hotel/offline-payments/prisma-repository", { namedExports: {
  createPrismaHotelOfflinePaymentRepository: (value: unknown) => { calls.push({ name: "createRepository", args: [value] }); return {}; },
} });
mock.module("@/lib/security/bounded-json", { namedExports: {
  readBoundedJson: async (request: Request) => request.json(),
} });

let GET: typeof import("../../app/api/organizations/[id]/hotels/[propertyId]/reservations/[reservationId]/offline-payments/route").GET;
let POST: typeof import("../../app/api/organizations/[id]/hotels/[propertyId]/reservations/[reservationId]/offline-payments/route").POST;
before(async () => {
  process.env.HOTEL_OPERATIONAL_RESERVATIONS_ENABLED = "1";
  process.env.HOTEL_OFFLINE_PAYMENT_OPERATIONAL_ENABLED = "1";
  ({ GET, POST } = await import("../../app/api/organizations/[id]/hotels/[propertyId]/reservations/[reservationId]/offline-payments/route"));
});

const params = { params: Promise.resolve({ id: "org-1", propertyId: "property-1", reservationId: "reservation-1" }) };
function reset() {
  process.env.HOTEL_OPERATIONAL_RESERVATIONS_ENABLED = "1";
  process.env.HOTEL_OFFLINE_PAYMENT_OPERATIONAL_ENABLED = "1";
  session = { user: { id: "staff-1", role: "STAFF", organizationId: "org-1" } };
  bookingAllowed = true;
  reservationExists = true;
  customerIdentityActive = true;
  rawEntries = [];
  rawQueryError = null;
  serviceResult = { outcome: "APPLIED", entry: { id: "entry-1", method: "CASH", status: "VERIFIED", amountToman: 125n } };
  calls.length = 0;
}
function request(body: unknown = { action: "RECORD_CASH", amountToman: "125" }, origin = "https://app.example") {
  return new NextRequest("https://app.example/api/offline-payments", {
    method: "POST",
    headers: { origin, "content-type": "application/json", "idempotency-key": "cash-key-0001" },
    body: JSON.stringify(body),
  });
}

test("disabled operational gates block reads and writes before auth or persistence", async () => {
  reset();
  delete process.env.HOTEL_OPERATIONAL_RESERVATIONS_ENABLED;
  assert.equal((await GET(new NextRequest("https://app.example/api/offline-payments"), params)).status, 503);
  process.env.HOTEL_OPERATIONAL_RESERVATIONS_ENABLED = "1";
  delete process.env.HOTEL_OFFLINE_PAYMENT_OPERATIONAL_ENABLED;
  assert.equal((await POST(request(), params)).status, 503);
  assert.equal(calls.length, 0);
});

test("mutation rejects cross-origin requests before authorization or database access", async () => {
  reset();
  const response = await POST(request(undefined, "https://attacker.example"), params);
  assert.equal(response.status, 403);
  assert.equal(calls.length, 0);
});

test("unauthenticated users and guests without the matching tenant context are denied", async () => {
  reset();
  session = null;
  assert.equal((await GET(new NextRequest("https://app.example/api/offline-payments"), params)).status, 401);
  session = { user: { id: "guest-1", role: "CUSTOMER", organizationId: "org-1" }, customerContext: { organizationId: "org-2" } };
  assert.equal((await POST(request(), params)).status, 403);
  assert.equal(calls.some((call) => call.name === "recordCash"), false);
});

test("wrong property authorization stops the request before reservation lookup", async () => {
  reset();
  const wrongPropertyParams = { params: Promise.resolve({ id: "org-1", propertyId: "property-other", reservationId: "reservation-1" }) };
  const response = await POST(request(), wrongPropertyParams);
  assert.equal(response.status, 403);
  assert.equal(calls.some((call) => call.name === "reservation.findFirst"), false);
});

test("role matrix allows staff cash recording and guest transfer submission but restricts verification", async () => {
  reset();
  const recorded = await POST(request(), params);
  assert.equal(recorded.status, 200);
  assert.equal(calls.find((call) => call.name === "recordCash")?.args[0] && (calls.find((call) => call.name === "recordCash")!.args[0] as { actor: { permissions: string[] } }).actor.permissions[0], "hotel:offline-payment:record-cash");
  calls.length = 0;
  const verification = await POST(request({ action: "VERIFY_BANK_TRANSFER", ledgerEntryId: "ledger-1" }), params);
  assert.equal(verification.status, 403);
  assert.equal(calls.some((call) => call.name === "verifyBankTransfer"), false);

  session = { user: { id: "guest-1", role: "CUSTOMER", organizationId: "org-1" }, customerContext: { organizationId: "org-1" } };
  calls.length = 0;
  const guestTransfer = await POST(request({ action: "SUBMIT_BANK_TRANSFER", amountToman: "125", bankReference: "trace-1" }), params);
  assert.equal(guestTransfer.status, 200);
  assert.equal(calls.some((call) => call.name === "submitBankTransfer"), true);

  session = { user: { id: "admin-1", role: "ADMIN", organizationId: "org-1" } };
  calls.length = 0;
  const verified = await POST(request({ action: "VERIFY_BANK_TRANSFER", ledgerEntryId: "ledger-1" }), params);
  assert.equal(verified.status, 200);
  assert.equal(calls.some((call) => call.name === "verifyBankTransfer"), true);
});

test("GET serializes money and does not expose database failures", async () => {
  reset();
  rawEntries = [{ id: "entry-1", method: "CASH", status: "VERIFIED", amountToman: 125n, createdAt: new Date("2026-11-14T10:00:00.000Z"), verifiedAt: null }];
  const response = await GET(new NextRequest("https://app.example/api/offline-payments"), params);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(await response.json(), {
    totalToman: "500", paidToman: "125", outstandingToman: "375",
    entries: [{ id: "entry-1", method: "CASH", status: "VERIFIED", amountToman: "125", createdAt: "2026-11-14T10:00:00.000Z", verifiedAt: null }],
  });

  session = { user: { id: "other-guest", role: "CUSTOMER", organizationId: "org-1" }, customerContext: { organizationId: "org-1" } };
  customerIdentityActive = false;
  const notOwner = await GET(new NextRequest("https://app.example/api/offline-payments"), params);
  assert.equal(notOwner.status, 404);

  reset();
  rawQueryError = new Error("DATABASE_URL=secret; Prisma stack trace");
  const failed = await GET(new NextRequest("https://app.example/api/offline-payments"), params);
  assert.equal(failed.status, 500);
  const failedBody = await failed.text();
  assert.deepEqual(JSON.parse(failedBody), { error: "Internal server error" });
  assert.doesNotMatch(failedBody, /DATABASE_URL|secret|Prisma|stack trace/i);
});
