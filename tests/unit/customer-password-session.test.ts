import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaClient } from "@prisma/client";
import { CustomerPhoneAuthError, createCustomerPasswordSession } from "../../lib/customer-auth/core.server";

const asDb = (value: unknown) => value as PrismaClient;

test("password customer session requires active customer, organization, and club membership", async () => {
  const queries: Array<{ model: string; query?: Record<string, unknown> }> = [];
  const tx = {
    user: { findFirst: async (query: Record<string, unknown>) => { queries.push({ model: "user", query }); return { id: "customer-a" }; } },
    organization: { findFirst: async (query: Record<string, unknown>) => { queries.push({ model: "organization", query }); return { id: "org-a" }; } },
    customerClubMembership: { findUnique: async (query: Record<string, unknown>) => { queries.push({ model: "membership", query }); return { status: "ACTIVE" }; } },
    customerPhoneSession: { create: async ({ data, select }: { data: Record<string, unknown>; select: Record<string, unknown> }) => {
      queries.push({ model: "session", query: { data, select } });
      return { id: "persisted-session-a" };
    } },
  };
  const db = asDb({ $transaction: async (callback: (value: typeof tx) => unknown, options: unknown) => {
    assert.deepEqual(options, { maxWait: 5000, timeout: 10_000 });
    return callback(tx);
  } });

  assert.equal(await createCustomerPasswordSession("customer-a", "org-a", db), "persisted-session-a");
  assert.deepEqual(queries[0], { model: "user", query: { where: {
    id: "customer-a", role: "CUSTOMER", isActive: true, isTeamMember: false, deletedAt: null,
    memberOf: { none: { isActive: true, role: { in: ["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF", "DRIVER"] } } },
  }, select: { id: true } } });
  assert.deepEqual(queries[2], { model: "membership", query: { where: { organizationId_customerId: { organizationId: "org-a", customerId: "customer-a" } }, select: { status: true } } });
  const sessionData = queries[3].query?.data as { userId: string; organizationId: string; expiresAt: Date };
  assert.equal(sessionData.userId, "customer-a");
  assert.equal(sessionData.organizationId, "org-a");
  assert.ok(sessionData.expiresAt.getTime() > Date.now());
});

test("password customer session rejects missing or inactive tenant membership", async () => {
  for (const fixture of [
    { user: null, organization: { id: "org-a" }, membership: { status: "ACTIVE" } },
    { user: { id: "customer-a" }, organization: null, membership: { status: "ACTIVE" } },
    { user: { id: "customer-a" }, organization: { id: "org-a" }, membership: { status: "LEFT" } },
  ]) {
    let created = false;
    const tx = {
      user: { findFirst: async () => fixture.user },
      organization: { findFirst: async () => fixture.organization },
      customerClubMembership: { findUnique: async () => fixture.membership },
      customerPhoneSession: { create: async () => { created = true; return { id: "should-not-exist" }; } },
    };
    const db = asDb({ $transaction: async (callback: (value: typeof tx) => unknown) => callback(tx) });
    await assert.rejects(createCustomerPasswordSession("customer-a", "org-a", db), CustomerPhoneAuthError);
    assert.equal(created, false);
  }
});
