import assert from "node:assert/strict";
import { before, mock, test } from "node:test";
import { NextRequest } from "next/server";

type Session = { user: { id: string; role: string; organizationId: string | null }; customerContext?: { organizationId: string } } | null;
let session: Session = null;
let payment: { id: string; method: string; status: string; receiptKey: string | null; reservation: { guestCustomerId: string | null } } | null = null;
let guestIdentityActive = true;
let staffActive = true;
let updateCount = 1;
let storageError: Error | null = null;
let receiptBytes = Buffer.from("private image");
let receiptType = "image/png";
const calls: Array<{ name: string; args: unknown[] }> = [];
class TestApiError extends Error { constructor(public status: number, message: string) { super(message); } }

const prisma = {
  hotelOfflinePayment: {
    findFirst: async (args: unknown) => { calls.push({ name: "payment.findFirst", args: [args] }); return payment; },
    updateMany: async (args: unknown) => { calls.push({ name: "payment.updateMany", args: [args] }); return { count: updateCount }; },
  },
  customerIdentity: {
    findFirst: async (args: unknown) => { calls.push({ name: "identity.findFirst", args: [args] }); return guestIdentityActive ? { id: "identity-1" } : null; },
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
  authorizeHotelBookingActor: async (_db: unknown, actor: { userId: string; role: string; customerContextVerified?: boolean }, organizationId: string, propertyId: string) => {
    calls.push({ name: "authorizeHotelBookingActor", args: [actor, organizationId, propertyId] });
    if (organizationId !== "org-1" || propertyId !== "property-1" || (actor.role === "CUSTOMER" && !actor.customerContextVerified) || (actor.role !== "CUSTOMER" && !staffActive)) {
      throw new TestApiError(403, "Hotel access denied");
    }
  },
} });
mock.module("@/lib/hotel/offline-payments/receipt-storage.server", { namedExports: {
  storeHotelPaymentReceipt: async (organizationId: string, buffer: Buffer, contentType: string) => {
    calls.push({ name: "storeReceipt", args: [organizationId, buffer, contentType] });
    if (storageError) throw storageError;
    return "11111111-1111-4111-8111-111111111111.png";
  },
  readHotelPaymentReceipt: async (organizationId: string, key: string) => {
    calls.push({ name: "readReceipt", args: [organizationId, key] });
    if (storageError) throw storageError;
    return { buffer: receiptBytes, contentType: receiptType };
  },
  removeHotelPaymentReceipt: async (organizationId: string, key: string) => { calls.push({ name: "removeReceipt", args: [organizationId, key] }); },
} });

let GET: typeof import("../../app/api/organizations/[id]/hotels/[propertyId]/reservations/[reservationId]/offline-payments/[paymentId]/receipt/route").GET;
let POST: typeof import("../../app/api/organizations/[id]/hotels/[propertyId]/reservations/[reservationId]/offline-payments/[paymentId]/receipt/route").POST;
before(async () => {
  process.env.HOTEL_OPERATIONAL_RESERVATIONS_ENABLED = "1";
  process.env.HOTEL_OFFLINE_PAYMENT_OPERATIONAL_ENABLED = "1";
  ({ GET, POST } = await import("../../app/api/organizations/[id]/hotels/[propertyId]/reservations/[reservationId]/offline-payments/[paymentId]/receipt/route"));
});

const params = { params: Promise.resolve({ id: "org-1", propertyId: "property-1", reservationId: "reservation-1", paymentId: "payment-1" }) };
function reset() {
  process.env.HOTEL_OPERATIONAL_RESERVATIONS_ENABLED = "1";
  process.env.HOTEL_OFFLINE_PAYMENT_OPERATIONAL_ENABLED = "1";
  session = { user: { id: "guest-1", role: "CUSTOMER", organizationId: "org-1" }, customerContext: { organizationId: "org-1" } };
  payment = { id: "payment-1", method: "BANK_TRANSFER", status: "SUBMITTED", receiptKey: null, reservation: { guestCustomerId: "guest-1" } };
  guestIdentityActive = true;
  staffActive = true;
  updateCount = 1;
  storageError = null;
  receiptBytes = Buffer.from("private image");
  receiptType = "image/png";
  calls.length = 0;
}
function uploadRequest(options: { origin?: string; type?: string; size?: number; fields?: Array<[string, string]> } = {}) {
  const body = new FormData();
  for (const [name, value] of options.fields ?? []) body.append(name, value);
  body.append("receipt", new File([new Uint8Array(options.size ?? 8)], "receipt.png", { type: options.type ?? "image/png" }));
  return new NextRequest("https://app.example/api/receipt", {
    method: "POST",
    headers: { origin: options.origin ?? "https://app.example" },
    body,
  });
}
test("runtime gates, authentication, and same-origin guard fail closed", async () => {
  reset();
  delete process.env.HOTEL_OFFLINE_PAYMENT_OPERATIONAL_ENABLED;
  assert.equal((await GET(new NextRequest("https://app.example/api/receipt"), params)).status, 503);
  process.env.HOTEL_OFFLINE_PAYMENT_OPERATIONAL_ENABLED = "1";
  session = null;
  assert.equal((await GET(new NextRequest("https://app.example/api/receipt"), params)).status, 401);
  session = { user: { id: "guest-1", role: "CUSTOMER", organizationId: "org-1" }, customerContext: { organizationId: "org-1" } };
  assert.equal((await POST(uploadRequest({ origin: "https://attacker.example" }), params)).status, 403);
  assert.equal(calls.some((call) => call.name === "storeReceipt"), false);
});

test("guest upload requires request-bound tenant context and ownership", async () => {
  reset();
  session = { user: { id: "guest-1", role: "CUSTOMER", organizationId: "org-1" }, customerContext: { organizationId: "org-2" } };
  assert.equal((await POST(uploadRequest(), params)).status, 403);
  reset();
  guestIdentityActive = false;
  assert.equal((await POST(uploadRequest(), params)).status, 404);
  assert.equal(calls.some((call) => call.name === "storeReceipt"), false);
});

test("only an owned submitted bank transfer can receive a private receipt", async () => {
  reset();
  const response = await POST(uploadRequest(), params);
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { attached: true });
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(calls.find((call) => call.name === "payment.updateMany")?.args[0] && JSON.stringify(calls.find((call) => call.name === "payment.updateMany")!.args[0]).includes("receiptKey"), true);

  for (const invalid of [
    { ...payment!, status: "VERIFIED" },
    { ...payment!, method: "CASH" },
    { ...payment!, reservation: { guestCustomerId: "someone-else" } },
  ]) {
    reset();
    payment = invalid;
    guestIdentityActive = invalid.reservation.guestCustomerId === "guest-1";
    const denied = await POST(uploadRequest(), params);
    assert.ok([404, 409].includes(denied.status));
    assert.equal(calls.some((call) => call.name === "storeReceipt"), false);
  }
});

test("staff may download for the authorized property but cannot upload guest receipts", async () => {
  reset();
  payment = { ...payment!, receiptKey: "11111111-1111-4111-8111-111111111111.png" };
  session = { user: { id: "staff-1", role: "STAFF", organizationId: "org-1" } };
  const downloaded = await GET(new NextRequest("https://app.example/api/receipt"), params);
  assert.equal(downloaded.status, 200);
  assert.equal(downloaded.headers.get("content-type"), "image/png");
  assert.equal(downloaded.headers.get("cache-control"), "private, no-store");
  assert.equal(downloaded.headers.get("x-content-type-options"), "nosniff");
  assert.equal(downloaded.headers.get("location"), null);
  assert.equal(await downloaded.text(), "private image");
  assert.equal((await POST(uploadRequest(), params)).status, 403);
  staffActive = false;
  assert.equal((await GET(new NextRequest("https://app.example/api/receipt"), params)).status, 403);
});

test("multipart and image size/type limits reject before private storage", async () => {
  reset();
  assert.equal((await POST(uploadRequest({ size: 5 * 1024 * 1024 + 1 }), params)).status, 413);
  assert.equal((await POST(uploadRequest({ type: "image/gif" }), params)).status, 415);
  assert.equal((await POST(uploadRequest({ fields: [["extra", "no"]] }), params)).status, 400);
  assert.equal(calls.some((call) => call.name === "storeReceipt"), false);
});

test("storage or concurrent database failure returns a sanitized failure without payment state changes", async () => {
  reset();
  storageError = new Error("persistent storage internal path secret");
  const failed = await POST(uploadRequest(), params);
  assert.equal(failed.status, 500);
  const failedBody = await failed.text();
  assert.doesNotMatch(failedBody, /internal path|secret/i);
  assert.equal(calls.some((call) => call.name === "payment.updateMany"), false);

  reset();
  updateCount = 0;
  const conflict = await POST(uploadRequest(), params);
  assert.equal(conflict.status, 409);
  assert.equal(calls.some((call) => call.name === "payment.updateMany"), true);
  assert.equal(calls.some((call) => call.name === "removeReceipt"), true);
});

test("customer download requires ownership and private storage errors do not reveal keys", async () => {
  reset();
  payment = { ...payment!, receiptKey: "11111111-1111-4111-8111-111111111111.png" };
  guestIdentityActive = false;
  assert.equal((await GET(new NextRequest("https://app.example/api/receipt"), params)).status, 404);
  assert.equal(calls.some((call) => call.name === "readReceipt"), false);

  reset();
  payment = { ...payment!, receiptKey: "11111111-1111-4111-8111-111111111111.png" };
  storageError = new Error("private key path secret");
  const failed = await GET(new NextRequest("https://app.example/api/receipt"), params);
  assert.equal(failed.status, 500);
  const body = await failed.text();
  assert.doesNotMatch(body, /private key|secret|11111111/i);
});
