import assert from "node:assert/strict";
import { before, mock, test } from "node:test";
import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
class TestApiError extends Error { constructor(readonly status: number, message: string) { super(message); } }
const guestCookie = "appointment-01111111-1111-4111-8111-111111111111";
const otherCookie = "appointment-02222222-2222-4222-8222-222222222222";
let principal: "guest" | "customer" | "other-customer" | "wrong-tenant" | "staff" = "guest";
let tenant: "platform" | "tenant" | "unknown" = "tenant";
let reads = 0;
const row = { id: "apt-a", bookingReference: "ABC12345", startTime: new Date("2026-12-10T10:00:00Z"), endTime: new Date("2026-12-10T11:00:00Z"), status: "CONFIRMED", service: { id: "svc-a", name: "Service", duration: 60, price: "100000", organization: { name: "Org", slug: "org-a", timezone: "Asia/Tehran", address: null, phone: null }, serviceProvider: null } };
function rows(where: Prisma.AppointmentWhereInput, select: Prisma.AppointmentSelect) {
  reads++;
  assert.equal(where.deletedAt, null);
  assert.deepEqual(where.service, { organizationId: "org-a", organization: { isActive: true, deletedAt: null } });
  for (const field of ["customer", "guestCustomer", "customerId", "guestCustomerId", "customerPhoneAtBooking", "customerEmailAtBooking", "notes", "paymentRequests"]) assert.equal(Object.hasOwn(select, field), false);
  assert.equal(Object.hasOwn(select, "service"), true);
  const owner = where.customerId === "customer-a" || (where.customerId === null && JSON.stringify(where.guestCustomer) === JSON.stringify({ sessionId: guestCookie }));
  return owner && (!where.id || where.id === row.id) && (!where.bookingReference || where.bookingReference === row.bookingReference) ? [row] : [];
}
mock.module("@/lib/db", { namedExports: { prisma: { appointment: {
  findMany: async ({ where, select, take }: { where: Prisma.AppointmentWhereInput; select: Prisma.AppointmentSelect; take: number }) => { assert.equal(take, 51); return rows(where, select); },
  findFirst: async ({ where, select }: { where: Prisma.AppointmentWhereInput; select: Prisma.AppointmentSelect }) => rows(where, select)[0] ?? null,
} } } });
mock.module("@/lib/api-guards", { namedExports: {
  ApiError: TestApiError,
  requireSameOriginMutation: (request: Request) => { if (request.headers.get("origin") !== new URL(request.url).origin) throw new TestApiError(403, "origin"); },
  requireAuthSession: async () => { if (principal === "guest") throw new TestApiError(401, "guest"); return { user: { id: principal === "other-customer" ? "customer-b" : "customer-a", role: principal === "staff" ? "STAFF" : "CUSTOMER" } }; },
  requireCustomerRequestContext: async () => ({ organizationId: principal === "wrong-tenant" ? "org-b" : "org-a" }),
} });
mock.module("@/lib/tenant-pwa-context.server", { namedExports: { resolveTenantPwaRequestContext: async () => tenant === "tenant" ? { kind: tenant, organizationId: "org-a" } : { kind: tenant } } });
mock.module("@/lib/organization-capabilities.server", { namedExports: { requireActiveOrganizationCapability: async (input: { organizationSlug: string; organizationId?: string; capability: string }) => {
  assert.equal(input.capability, "APPOINTMENT"); if (input.organizationSlug !== "org-a" || input.organizationId && input.organizationId !== "org-a") throw new TestApiError(404, "wrong tenant"); return { id: "org-a", slug: "org-a" };
} } });
let lookup: typeof import("../../app/api/public/appointments/lookup/route").POST;
let detail: typeof import("../../app/api/public/appointments/[id]/route").GET;
before(async () => { process.env.SESSION_COOKIE_NAME = "guest_session_id_local"; ({ POST: lookup } = await import("../../app/api/public/appointments/lookup/route")); ({ GET: detail } = await import("../../app/api/public/appointments/[id]/route")); });
function request(body: unknown, cookie?: string, origin = "https://tenant.example") { return new NextRequest("https://tenant.example/api/public/appointments/lookup", { method: "POST", headers: { origin, "content-type": "application/json", ...(cookie ? { cookie: `guest_session_id_local=${cookie}` } : {}) }, body: JSON.stringify(body) }); }
function get(query: string, cookie?: string, id = "apt-a") { return detail(new NextRequest(`https://tenant.example/api/public/appointments/${id}?${query}`, { headers: cookie ? { cookie: `guest_session_id_local=${cookie}` } : {} }), { params: Promise.resolve({ id }) }); }
const body = { organizationSlug: "org-a" };
test("phone/ref/OTP never grants guest access or invokes a record read", async () => {
  const count = reads;
  for (const input of [{ ...body, phone: "09123456789" }, { ...body, phone: "09123456789", otpCode: "1234", bookingReference: "ABC12345" }]) assert.equal((await lookup(request(input))).status, 400);
  assert.equal((await lookup(request({ ...body, bookingReference: "ABC12345" }))).status, 403);
  assert.equal((await get("organizationSlug=org-a&phone=09123456789")).status, 400);
  assert.equal((await get("organizationSlug=org-a&ref=ABC12345")).status, 400);
  assert.equal((await get("organizationSlug=org-a")).status, 403);
  assert.equal(reads, count);
});
test("same-browser guest sees only owned appointments, no PII, no-store", async () => {
  const response = await lookup(request(body, guestCookie));
  assert.equal(response.status, 200); assert.equal(response.headers.get("cache-control"), "private, no-store");
  const data = await response.json(); assert.equal(data.appointments.length, 1); assert.equal(data.appointments[0].id, row.id); assert.equal(data.appointments[0].service.price, 100000);
  assert.equal((await get("organizationSlug=org-a", guestCookie)).status, 200);
  assert.equal((await get("organizationSlug=org-a", guestCookie, "unknown-id")).status, 404);
});
test("wrong or malformed cookie cannot access another guest booking", async () => {
  assert.deepEqual((await (await lookup(request(body, otherCookie))).json()).appointments, []);
  assert.equal((await get("organizationSlug=org-a", otherCookie)).status, 404);
  const count = reads; assert.equal((await lookup(request(body, "123"))).status, 403); assert.equal(reads, count);
});
test("reference filters only within the owner's existing scope", async () => {
  assert.equal((await (await lookup(request({ ...body, bookingReference: "abc12345" }, guestCookie))).json()).appointments.length, 1);
  assert.deepEqual((await (await lookup(request({ ...body, bookingReference: "MISSING" }, guestCookie))).json()).appointments, []);
});
test("unknown host, wrong tenant and cross-origin requests fail before record read", async () => {
  const count = reads;
  assert.equal((await lookup(request({ organizationSlug: "org-b" }, guestCookie))).status, 404);
  assert.equal((await lookup(request(body, guestCookie, "https://other.example"))).status, 403);
  tenant = "unknown"; try { assert.equal((await get("organizationSlug=org-a", guestCookie)).status, 404); } finally { tenant = "tenant"; }
  assert.equal(reads, count);
});
test("platform-host guest lookup is still scoped to the chosen organization", async () => {
  tenant = "platform"; try { assert.equal((await lookup(request(body, guestCookie))).status, 200); } finally { tenant = "tenant"; }
});
test("customer session must be bound to the target tenant; staff is not a guest override", async () => {
  try {
    principal = "customer"; assert.equal((await get("organizationSlug=org-a")).status, 200);
    principal = "other-customer"; assert.equal((await get("organizationSlug=org-a", guestCookie)).status, 404);
    principal = "wrong-tenant"; assert.equal((await lookup(request(body, guestCookie))).status, 403);
    principal = "staff"; assert.equal((await get("organizationSlug=org-a", guestCookie)).status, 403);
  } finally { principal = "guest"; }
});
test("bounded input and missing organization rejected before DB read", async () => {
  const count = reads;
  assert.equal((await lookup(request({ organizationSlug: "x".repeat(3000) }, guestCookie))).status, 413);
  assert.equal((await lookup(request({}, guestCookie))).status, 400);
  assert.equal((await get("", guestCookie)).status, 400);
  assert.equal(reads, count);
});
