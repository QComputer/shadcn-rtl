import assert from "node:assert/strict";
import { test } from "node:test";
import { Prisma } from "@prisma/client";
import { checkHotelGuestRequestRateLimit } from "@/lib/hotel/guest-request-rate-limit.server";

function fakeDatabase(initialCount: number) {
  const now = new Date("2026-11-14T10:00:00.000Z");
  const startedAt = new Date(now.getTime() - 1000);
  const calls: Prisma.Sql[] = [];
  return {
    calls,
    db: { $queryRaw: async (sql: Prisma.Sql) => { calls.push(sql); return [{ count: initialCount, windowStartedAt: startedAt, dbNow: now }]; } },
  };
}

test("guest limiter executes a tenant-scoped database upsert and enforces create budget in test mode", async () => {
  const fixture = fakeDatabase(61);
  const rate = await checkHotelGuestRequestRateLimit({ organizationId: "verified-org", endpoint: "create", db: fixture.db });
  assert.equal(rate.allowed, false);
  assert.equal(rate.remaining, 0);
  assert.equal(rate.retryAfterSeconds, 59);
  assert.equal(fixture.calls.length, 1);
  assert.deepEqual(fixture.calls[0].values.slice(0, 2), ["verified-org", "create"]);
  assert.match(fixture.calls[0].sql, /ON CONFLICT/);
  assert.match(fixture.calls[0].sql, /CURRENT_TIMESTAMP/);
});

test("guest limiter uses separate endpoint budgets", async () => {
  const create = fakeDatabase(60);
  const status = fakeDatabase(240);
  assert.equal((await checkHotelGuestRequestRateLimit({ organizationId: "org", endpoint: "create", db: create.db })).allowed, true);
  assert.equal((await checkHotelGuestRequestRateLimit({ organizationId: "org", endpoint: "status", db: status.db })).allowed, true);
  assert.ok(create.calls[0].values.includes(61));
  assert.ok(create.calls[0].values.includes(60_000));
  assert.ok(status.calls[0].values.includes(241));
  assert.ok(status.calls[0].values.includes(60_000));
});

test("guest limiter fails closed when shared storage is unavailable", async () => {
  const rate = await checkHotelGuestRequestRateLimit({ organizationId: "org", endpoint: "create", db: { $queryRaw: async () => { throw new Error("db down"); } } });
  assert.equal(rate.allowed, false);
  assert.equal(rate.storeUnavailable, true);
});
