import assert from "node:assert/strict";
import { test } from "node:test";
import { approveHotelPublication, HotelPublicationAuthorizationError, revokeHotelPublication, resolveHotelTenantForHost } from "@/lib/hotel/services/hotel-publication.service";

function db() {
  const calls: string[] = [];
  return {
    calls,
    organizationMember: { findFirst: async () => ({ id: "membership-1" }) },
    hotelProperty: { findFirst: async () => ({ id: "property-1", propertyId: undefined, updatedAt: new Date("2027-01-01T00:00:00Z"), isActive: true, deletedAt: null }) },
    hotelNightlyRate: { findMany: async () => [] },
    $executeRaw: async () => { calls.push("write"); return 1; },
    $queryRaw: async () => [{ id: "approval-1" }],
    organizationDomain: { findUnique: async () => ({ status: "ACTIVE", organization: { id: "org-1", isActive: true, deletedAt: null, vertical: "HOTEL", capabilities: [{ key: "HOTEL_BOOKING", status: "ACTIVE" }] } }) },
  } as never;
}

test("only an active administrator can approve the current resource revision", async () => {
  const fake = db() as unknown as { calls: string[] };
  await assert.rejects(() => approveHotelPublication({ organizationId: "org-1", propertyId: "property-1", resourceType: "PROPERTY", resourceId: "property-1", scope: { availability: true, quote: true, policies: false }, userId: "manager-1", role: "MANAGER" }, fake as never), HotelPublicationAuthorizationError);
  const approval = await approveHotelPublication({ organizationId: "org-1", propertyId: "property-1", resourceType: "PROPERTY", resourceId: "property-1", scope: { availability: true, quote: true, policies: false }, userId: "admin-1", role: "ADMIN" }, fake as never);
  assert.equal(approval.resourceRevision, "2027-01-01T00:00:00.000Z");
  assert.equal(fake.calls.length, 2);
});

test("revocation is an auditable write and host resolution is capability and vertical scoped", async () => {
  const fake = db() as unknown as { calls: string[]; organizationDomain: { findUnique: (args: unknown) => Promise<unknown> } };
  await revokeHotelPublication({ organizationId: "org-1", propertyId: "property-1", resourceType: "PROPERTY", resourceId: "property-1", userId: "admin-1", role: "ADMIN", reason: "owner revoked" }, fake as never);
  assert.equal(fake.calls.length, 1);
  assert.deepEqual(await resolveHotelTenantForHost("Damoon-Hotel.ir:443", fake as never), { organizationId: "org-1" });
});

test("unknown hosts fail closed", async () => {
  const fake = db() as unknown as { organizationDomain: { findUnique: (args: unknown) => Promise<null> } };
  fake.organizationDomain.findUnique = async () => null;
  assert.equal(await resolveHotelTenantForHost("unknown.example", fake as never), null);
});

test("inactive domains, organizations, non-HOTEL verticals, and disabled capability fail closed", async () => {
  const cases = [
    { status: "PENDING", organization: { id: "org-1", isActive: true, deletedAt: null, vertical: "HOTEL", capabilities: [{ key: "HOTEL_BOOKING", status: "ACTIVE" }] } },
    { status: "ACTIVE", organization: { id: "org-1", isActive: false, deletedAt: null, vertical: "HOTEL", capabilities: [{ key: "HOTEL_BOOKING", status: "ACTIVE" }] } },
    { status: "ACTIVE", organization: { id: "org-1", isActive: true, deletedAt: new Date(), vertical: "HOTEL", capabilities: [{ key: "HOTEL_BOOKING", status: "ACTIVE" }] } },
    { status: "ACTIVE", organization: { id: "org-1", isActive: true, deletedAt: null, vertical: "SHOP", capabilities: [{ key: "HOTEL_BOOKING", status: "ACTIVE" }] } },
    { status: "ACTIVE", organization: { id: "org-1", isActive: true, deletedAt: null, vertical: "HOTEL", capabilities: [{ key: "HOTEL_BOOKING", status: "SUSPENDED" }] } },
    { status: "ACTIVE", organization: { id: "org-1", isActive: true, deletedAt: null, vertical: "HOTEL", capabilities: [] } },
  ];
  for (const domain of cases) {
    const fake = db() as unknown as { organizationDomain: { findUnique: (args: unknown) => Promise<unknown> } };
    fake.organizationDomain.findUnique = async () => domain;
    assert.equal(await resolveHotelTenantForHost("hotel.example", fake as never), null);
  }
});
