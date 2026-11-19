import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaClient } from "@prisma/client";
import { HotelStayRequestService } from "../../lib/hotel/services/hotel-stay-request.service";

const baseProperty = { id: "prop-1", organizationId: "org-1", organizationSlug: "damoon", slug: "damoon", name: "Damoon", description: null, localizedContent: null, timezone: "Asia/Tehran", currency: "IRR", checkInTime: "14:00", checkOutTime: "12:00", minStayNights: 1, maxStayNights: 30, addressLine1: null, city: null, latitude: null, longitude: null, isActive: true, createdAt: new Date(), updatedAt: new Date(), deletedAt: null };

function makeDb(opts: { orgAdminMembership?: boolean; orgMembershipRole?: "ADMIN" | "MANAGER" | "STAFF" | null }) {
  let updated: unknown = null;
  const db = {
    user: { findFirst: async () => ({ id: "u-admin" }) },
    hotelProperty: {
      findFirst: async () => baseProperty,
      update: async (arg: unknown) => { updated = arg; return { id: "prop-1" }; },
    },
    organizationMember: {
      findFirst: async ({ where }: { where: { role?: string | { in: string[] } } }) => {
        if (where.role === "ADMIN") return opts.orgAdminMembership ? { id: "m-admin" } : null;
        if (typeof where.role === "object" && "in" in where.role) return opts.orgMembershipRole ? { id: "m-any", role: opts.orgMembershipRole } : null;
        return opts.orgMembershipRole ? { id: "m-any", role: opts.orgMembershipRole } : null;
      },
    },
    $queryRaw: async () => [{ ready: true }],
  } as unknown as PrismaClient;
  return { db, get updated() { return updated; } };
}

test("stay-request configure denies global ADMIN with only STAFF org membership", async () => {
  const ctx = makeDb({ orgMembershipRole: "STAFF", orgAdminMembership: false });
  const service = new HotelStayRequestService(ctx.db);
  await assert.rejects(() => service.configure({ userId: "u-admin", role: "ADMIN", organizationId: "org-1" }, "org-1", "prop-1", { mode: "REQUEST_ONLY" }), (error: unknown) => {
    assert.equal((error as { status?: number }).status, 403);
    assert.match((error as Error).message, /Organization administrator required/);
    return true;
  });
  assert.equal(ctx.updated, null);
});

test("stay-request configure denies global ADMIN with only MANAGER org membership", async () => {
  const ctx = makeDb({ orgMembershipRole: "MANAGER", orgAdminMembership: false });
  const service = new HotelStayRequestService(ctx.db);
  await assert.rejects(() => service.configure({ userId: "u-admin", role: "ADMIN", organizationId: "org-1" }, "org-1", "prop-1", { mode: "REQUEST_ONLY" }), (error: unknown) => {
    assert.equal((error as { status?: number }).status, 403);
    return true;
  });
  assert.equal(ctx.updated, null);
});

test("stay-request configure allows global ADMIN with active org ADMIN membership", async () => {
  const ctx = makeDb({ orgMembershipRole: "ADMIN", orgAdminMembership: true });
  const service = new HotelStayRequestService(ctx.db);
  const result = await service.configure({ userId: "u-admin", role: "ADMIN", organizationId: "org-1" }, "org-1", "prop-1", { mode: "REQUEST_ONLY" });
  assert.deepEqual(result, { mode: "REQUEST_ONLY" });
  assert.deepEqual(ctx.updated, { where: { id: "prop-1", organizationId: "org-1" }, data: { operationalMode: "REQUEST_ONLY" } });
});

test("stay-request configure allows SUPER_ADMIN per existing explicit policy", async () => {
  const ctx = makeDb({ orgMembershipRole: null, orgAdminMembership: false });
  const service = new HotelStayRequestService(ctx.db);
  const result = await service.configure({ userId: "u-super", role: "SUPER_ADMIN", organizationId: "org-1" }, "org-1", "prop-1", { mode: "DISABLED" });
  assert.deepEqual(result, { mode: "DISABLED" });
  assert.deepEqual(ctx.updated, { where: { id: "prop-1", organizationId: "org-1" }, data: { operationalMode: "DISABLED" } });
});

test("stay-request configure denies cross-tenant actor context", async () => {
  const ctx = makeDb({ orgMembershipRole: "ADMIN", orgAdminMembership: true });
  const service = new HotelStayRequestService(ctx.db);
  await assert.rejects(() => service.configure({ userId: "u-admin", role: "ADMIN", organizationId: "org-other" }, "org-1", "prop-1", { mode: "REQUEST_ONLY" }), (error: unknown) => {
    assert.equal((error as { status?: number }).status, 403);
    return true;
  });
  assert.equal(ctx.updated, null);
});
