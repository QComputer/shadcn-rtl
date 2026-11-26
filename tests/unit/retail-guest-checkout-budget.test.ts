import assert from "node:assert/strict";
import { before, mock, test } from "node:test";
import type { Prisma } from "@prisma/client";
class TestApiError extends Error { constructor(readonly status: number, message: string) { super(message); } }
mock.module("@/lib/api-guards", { namedExports: { ApiError: TestApiError } });
mock.module("@/lib/retail/checkout-owner.server", { namedExports: { checkoutOrderOwner: (owner: { guestSessionId: string }, slug: string) => ({ customerId: null, guestCustomer: { is: { sessionId: { startsWith: `${slug}:${owner.guestSessionId}` } } } }) } });
let helpers: typeof import("../../lib/retail/guest-checkout-budget.server");
before(async () => { helpers = await import("../../lib/retail/guest-checkout-budget.server"); });
const now = new Date("2026-11-26T12:00:00Z");
function fixture(counts: number[]) {
  const queries: Prisma.OrderWhereInput[] = [];
  const db = { order: { count: async ({ where }: { where: Prisma.OrderWhereInput }) => { queries.push(where); return counts[queries.length - 1]!; } } } as unknown as Pick<Prisma.TransactionClient, "order">;
  return { db, queries };
}
test("budget scopes recent committed orders to tenant, normalized contact and browser; cancelled rows still count", async () => {
  const { db, queries } = fixture([0, 0, 0]);
  assert.equal(await helpers.assertGuestCheckoutBudget(db, "a", { guestSessionId: "cookie" }, "+98 9120000000", now), "09120000000");
  assert.equal(queries.length, 3);
  for (const where of queries) {
    assert.equal(where.organizationSlug, "a"); assert.equal(where.customerId, null); assert.equal(Object.hasOwn(where, "deletedAt"), false); assert.equal(Object.hasOwn(where, "status"), false);
    assert.deepEqual(where.createdAt, { gte: new Date(now.getTime() - 900_000) });
  }
  assert.deepEqual(queries[2]?.guestCustomer, { is: { phone: "09120000000" } });
});
test("browser, contact and tenant caps each fail closed; cookie rotation cannot reset contact cap", async () => {
  for (const counts of [[60,0,0],[0,3,0],[0,0,3]]) {
    const { db } = fixture(counts);
    await assert.rejects(helpers.assertGuestCheckoutBudget(db, "a", { guestSessionId: "rotated" }, "09120000000", now), error => error instanceof TestApiError && error.status === 429);
  }
  const { db, queries } = fixture([0,0,0]);
  await assert.rejects(helpers.assertGuestCheckoutBudget(db, "a", { guestSessionId: "cookie" }, "invalid", now), error => error instanceof TestApiError && error.status === 400);
  assert.equal(queries.length, 0);
});
