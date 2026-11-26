import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { before, after, it, mock } from "node:test";

const oldFlag = process.env.RETAIL_GUEST_CHECKOUT_ENABLED;
class FixtureApiError extends Error { constructor(readonly status: number, message: string) { super(message); } }
mock.module("@/lib/api-guards", { namedExports: { ApiError: FixtureApiError } });
mock.module("@/lib/retail/cart-access.server", { namedExports: { cartPrincipal: async () => null, requireCartStore: async () => null, hasGuestCart: async () => false } });
let helpers: typeof import("../../lib/retail/checkout-owner.server");
before(async () => { helpers = await import("../../lib/retail/checkout-owner.server"); });
after(() => { if (oldFlag === undefined) delete process.env.RETAIL_GUEST_CHECKOUT_ENABLED; else process.env.RETAIL_GUEST_CHECKOUT_ENABLED = oldFlag; });
it("scopes guest order ownership by tenant and cookie, without storing the bearer", () => {
  const session = randomUUID(), owner = { guestSessionId: session };
  const scope = helpers.guestOrderScope("store-a", session);
  assert.match(scope, /^retail-order:v1:[a-f0-9]{64}:$/);
  assert.ok(!scope.includes(session));
  assert.notEqual(scope, helpers.guestOrderScope("store-b", session));
  assert.notEqual(scope, helpers.guestOrderScope("store-a", randomUUID()));
  assert.deepEqual(helpers.checkoutOrderOwner(owner, "store-a"), { customerId: null, guestCustomer: { is: { sessionId: { startsWith: scope } } } });
  assert.deepEqual(helpers.checkoutCartOwner(owner, "store-a"), { organizationSlug: "store-a", customerId: null, sessionId: session });
  assert.deepEqual(helpers.checkoutOrderOwner("customer", "store-a"), { customerId: "customer" });
});
it("fails closed by default; requires guest contact/review and rejects account-only payment and coupons", () => {
  const owner = { guestSessionId: randomUUID() };
  delete process.env.RETAIL_GUEST_CHECKOUT_ENABLED;
  assert.equal(helpers.guestCheckoutEnabled(), false);
  assert.throws(() => helpers.requireGuestCheckout(owner, {}), /not enabled/);
  assert.doesNotThrow(() => helpers.requireGuestCheckout("customer", {}));
  process.env.RETAIL_GUEST_CHECKOUT_ENABLED = "1";
  assert.throws(() => helpers.requireGuestCheckout(owner, { paymentMethod: "INOTI_USSD" }), /requires an account/);
  assert.throws(() => helpers.requireGuestCheckout(owner, { couponCode: "ACCOUNT" }), /require an account/);
  assert.throws(() => helpers.requireGuestCheckout(owner, { paymentMethod: "CASH" }, true), /reviewed quote/);
  assert.doesNotThrow(() => helpers.requireGuestCheckout(owner, { paymentMethod: "BANK_TRANSFER", recipientName: "Guest", recipientMobile: "9120000000", reviewToken: "fixture" }, true));
});
