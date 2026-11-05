import test from "node:test";
import assert from "node:assert/strict";
import {
  isCanonicalCustomerUssdDialPath,
  parseCustomerUssdEnrollmentRequest,
  processCustomerUssdEnrollmentRequest,
  type CustomerUssdEnrollmentDependencies,
  type CustomerUssdEnrollmentRoute,
} from "../../lib/customer-auth/ussd.server";
import { customerAuthDigest } from "../../lib/customer-auth/crypto";

const secret = "test-only-customer-auth-secret-32-bytes-minimum";
const route: CustomerUssdEnrollmentRoute = {
  id: "route-a",
  organizationId: "org-a",
  publicId: "b5d4d41e-0c91-4fc1-9a47-73c0437ff48d",
  dialPath: "6655*771122*30",
  enabled: true,
};
const validQuery = () => new URLSearchParams({
  mobile: "+98 912-345-6789",
  sessionid: "۱۲۳۴۵۶۷۸۹",
  call: "*۶۶۵۵*۷۷۱۱۲۲*۳۰#",
});

function dependencies(overrides: Partial<CustomerUssdEnrollmentDependencies> = {}) {
  const calls: Array<Record<string, unknown>> = [];
  const deps: CustomerUssdEnrollmentDependencies = {
    findEnabledRoute: async () => route,
    resolveDestination: async (organizationId) => ({ organizationId, origin: "https://tenant.example", homePath: "/fa/shop", baseUrl: "https://tenant.example" }),
    available: () => true,
    request: async (input) => { calls.push(input); return { accepted: true }; },
    secret,
    ...overrides,
  };
  return { deps, calls };
}

test("accepts only canonical 6655 digit paths and normalizes USSD phone/session values", () => {
  assert.equal(isCanonicalCustomerUssdDialPath("6655*771122*30"), true);
  assert.equal(isCanonicalCustomerUssdDialPath("*6655*771122*30#"), false);
  assert.equal(isCanonicalCustomerUssdDialPath("6655*771122*30*2"), true);
  assert.equal(isCanonicalCustomerUssdDialPath("6655*771122*30*2*3*4*5"), false);
  assert.deepEqual(parseCustomerUssdEnrollmentRequest(validQuery(), route.dialPath), {
    mobile: "09123456789",
    sessionId: "123456789",
    call: route.dialPath,
  });
});

test("rejects duplicate aliases, malformed sessions, non-exact paths, and payment callback fields", () => {
  const duplicate = validQuery();
  duplicate.append("SessionID", "987654321");
  assert.equal(parseCustomerUssdEnrollmentRequest(duplicate, route.dialPath), null);

  const invalidSession = validQuery();
  invalidSession.set("sessionid", "session-1");
  assert.equal(parseCustomerUssdEnrollmentRequest(invalidSession, route.dialPath), null);

  const extraPathSegment = validQuery();
  extraPathSegment.set("call", "*6655*771122*30*1#");
  assert.equal(parseCustomerUssdEnrollmentRequest(extraPathSegment, route.dialPath), null);

  const paymentCallback = validQuery();
  paymentCallback.set("RRN", "test-ref");
  assert.equal(parseCustomerUssdEnrollmentRequest(paymentCallback, route.dialPath), null);
});

test("routes one tenant request with hashed idempotency and no personal values in the key", async () => {
  const { deps, calls } = dependencies();
  const result = await processCustomerUssdEnrollmentRequest({ publicId: route.publicId, searchParams: validQuery(), ip: "192.0.2.10" }, deps);
  assert.equal(result, "درخواست ثبت شد؛ در صورت امکان پیوند ورود ارسال می‌شود");
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    phone: "09123456789",
    organizationId: "org-a",
    origin: "https://tenant.example",
    ip: "192.0.2.10",
    source: "USSD",
    idempotencyKey: customerAuthDigest(`USSD:${route.id}:123456789:09123456789`, secret),
  });
  assert.equal(String(calls[0]?.idempotencyKey).includes("09123456789"), false);
});

test("fails closed without a reviewed sender, a tenant destination, or an enabled route", async () => {
  const disabledSender = dependencies({ available: () => false });
  assert.equal(await processCustomerUssdEnrollmentRequest({ publicId: route.publicId, searchParams: validQuery(), ip: "192.0.2.10" }, disabledSender.deps), "این سرویس اکنون فعال نیست");
  assert.equal(disabledSender.calls.length, 0);

  const missingDestination = dependencies({ resolveDestination: async () => null });
  assert.equal(await processCustomerUssdEnrollmentRequest({ publicId: route.publicId, searchParams: validQuery(), ip: "192.0.2.10" }, missingDestination.deps), "این سرویس در دسترس نیست");
  assert.equal(missingDestination.calls.length, 0);

  const disabledRoute = dependencies({ findEnabledRoute: async () => ({ ...route, enabled: false }) });
  assert.equal(await processCustomerUssdEnrollmentRequest({ publicId: route.publicId, searchParams: validQuery(), ip: "192.0.2.10" }, disabledRoute.deps), "این سرویس در دسترس نیست");
  assert.equal(disabledRoute.calls.length, 0);
});

test("rejects invalid public IDs and destination tenant mismatches before requesting", async () => {
  const { deps, calls } = dependencies({ resolveDestination: async () => ({ organizationId: "org-b", origin: "https://tenant.example", homePath: "/fa/shop", baseUrl: "https://tenant.example" }) });
  assert.equal(await processCustomerUssdEnrollmentRequest({ publicId: "not-a-uuid", searchParams: validQuery(), ip: "192.0.2.10" }, deps), "درخواست نامعتبر است");
  assert.equal(await processCustomerUssdEnrollmentRequest({ publicId: route.publicId, searchParams: validQuery(), ip: "192.0.2.10" }, deps), "این سرویس در دسترس نیست");
  assert.equal(calls.length, 0);
});
