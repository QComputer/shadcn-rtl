import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db-runtime";
import { approveHotelPublication, HotelPublicationAuthorizationError, isCurrentHotelPublicationApproved, revokeHotelPublication } from "@/lib/hotel/services/hotel-publication.service";
import { searchPublishedHotelAvailability } from "@/lib/hotel/services/public-availability.service";
import { POST as availabilityPOST } from "@/app/api/hotel/v1/availability/search/route";

const EXPECTED_DB = "bazarbaaz_h3d3p_verify";
const date = new Date("2027-09-10T00:00:00.000Z");
let orgId = ""; let otherOrgId = ""; let propertyId = ""; let roomTypeId = ""; let planId = ""; let policyId = ""; let adminId = ""; let managerId = "";
const publicationScope = { availability: true, quote: true, policies: true };

describe("H3-D3-P isolated PostgreSQL acceptance", () => {
  before(async () => {
    const identity = await prisma.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`;
    assert.equal(identity[0]?.db, EXPECTED_DB);
    const org = await prisma.organization.create({ data: { name: `H3D3P ${Date.now()}`, slug: `h3d3p-${Date.now()}`, type: "SHOP", vertical: "HOTEL" } }); orgId = org.id;
    const other = await prisma.organization.create({ data: { name: `H3D3P other ${Date.now()}`, slug: `h3d3p-other-${Date.now()}`, type: "SHOP", vertical: "HOTEL" } }); otherOrgId = other.id;
    const adminUser = await prisma.user.create({ data: { name: `h3d3p-admin-${Date.now()}`, password: "synthetic", role: "ADMIN" } }); adminId = adminUser.id;
    const managerUser = await prisma.user.create({ data: { name: `h3d3p-manager-${Date.now()}`, password: "synthetic", role: "MANAGER" } }); managerId = managerUser.id;
    await prisma.organizationMember.createMany({ data: [{ organizationId: orgId, organizationSlug: org.slug, userId: adminId, role: "ADMIN" }, { organizationId: orgId, organizationSlug: org.slug, userId: managerId, role: "MANAGER" }] });
    await prisma.organizationCapability.create({ data: { organizationId: orgId, key: "HOTEL_BOOKING", status: "ACTIVE", enabledAt: new Date() } });
    await prisma.organizationDomain.create({ data: { organizationId: orgId, domain: "h3d3p.local", normalizedDomain: "h3d3p.local", status: "ACTIVE", providerVerified: true, dnsConfigured: true, sslReady: true } });
    await prisma.organizationDomain.create({ data: { organizationId: otherOrgId, domain: "other.h3d3p.local", normalizedDomain: "other.h3d3p.local", status: "ACTIVE", providerVerified: true, dnsConfigured: true, sslReady: true } });
    const property = await prisma.hotelProperty.create({ data: { organizationId: orgId, organizationSlug: org.slug, slug: "approved-hotel", name: "Approved hotel" } }); propertyId = property.id;
    const room = await prisma.hotelRoomType.create({ data: { organizationId: orgId, propertyId, slug: "standard", name: "Standard", maxAdults: 2, maxChildren: 1, maxOccupancy: 3, beds: [{ kind: "queen", count: 1 }] } }); roomTypeId = room.id;
    const policy = await prisma.hotelCancellationPolicy.create({ data: { organizationId: orgId, propertyId, key: "flex", name: "Flexible", freeCancellationCutoffHours: 24 } }); policyId = policy.id;
    const plan = await prisma.hotelRatePlan.create({ data: { organizationId: orgId, propertyId, roomTypeId, code: "flex", name: "Flexible", baseNightlyRate: BigInt(125000), cancellationPolicyId: policyId } }); planId = plan.id;
    await prisma.hotelNightlyRate.create({ data: { organizationId: orgId, propertyId, ratePlanId: planId, from: date, to: new Date("2027-09-12T00:00:00.000Z"), nightlyRate: BigInt(130000) } });
    await prisma.hotelInventory.createMany({ data: [{ organizationId: orgId, propertyId, roomTypeId, date, allotment: 2 }, { organizationId: orgId, propertyId, roomTypeId, date: new Date("2027-09-11T00:00:00.000Z"), allotment: 2 }] });
  });

  after(async () => {
    if (!orgId) return;
    await prisma.$executeRaw`DELETE FROM "HotelPublicationApproval" WHERE "organizationId" IN (${orgId}, ${otherOrgId})`;
    await prisma.hotelInventory.deleteMany({ where: { organizationId: orgId } }); await prisma.hotelNightlyRate.deleteMany({ where: { organizationId: orgId } }); await prisma.hotelRatePlan.deleteMany({ where: { organizationId: orgId } }); await prisma.hotelCancellationPolicy.deleteMany({ where: { organizationId: orgId } }); await prisma.hotelRoomType.deleteMany({ where: { organizationId: orgId } }); await prisma.hotelProperty.deleteMany({ where: { organizationId: orgId } }); await prisma.organizationDomain.deleteMany({ where: { organizationId: orgId } }); await prisma.organizationCapability.deleteMany({ where: { organizationId: orgId } }); await prisma.organizationMember.deleteMany({ where: { organizationId: orgId } }); await prisma.user.deleteMany({ where: { id: { in: [adminId, managerId] } } }); await prisma.organization.deleteMany({ where: { id: { in: [orgId, otherOrgId] } } }); await prisma.$disconnect();
  });

  it("persists approvals, rejects managers, and supports trusted SUPER_ADMIN", async () => {
    await assert.rejects(() => approveHotelPublication({ organizationId: orgId, propertyId, resourceType: "PROPERTY", resourceId: propertyId, scope: publicationScope, userId: managerId, role: "MANAGER" }), HotelPublicationAuthorizationError);
    await approveHotelPublication({ organizationId: orgId, propertyId, resourceType: "PROPERTY", resourceId: propertyId, scope: publicationScope, userId: adminId, role: "ADMIN" });
    await approveHotelPublication({ organizationId: orgId, propertyId, resourceType: "ROOM_TYPE", resourceId: roomTypeId, scope: publicationScope, userId: "trusted-super", role: "SUPER_ADMIN" });
    await approveHotelPublication({ organizationId: orgId, propertyId, resourceType: "RATE_PLAN", resourceId: planId, scope: publicationScope, userId: adminId, role: "ADMIN" });
    await approveHotelPublication({ organizationId: orgId, propertyId, resourceType: "CANCELLATION_POLICY", resourceId: policyId, scope: publicationScope, userId: adminId, role: "ADMIN" });
    assert.equal(await prisma.$queryRaw<{ count: bigint }[]>`SELECT count(*) FROM "HotelPublicationApproval" WHERE "organizationId"=${orgId} AND "status"='APPROVED'`.then((rows) => Number(rows[0]?.count)), 4);
  });

  it("invalidates pricing approval for nightly changes, additions, removals, and plan terms", async () => {
    assert.equal(await isCurrentHotelPublicationApproved({ organizationId: orgId, propertyId, resourceType: "RATE_PLAN", resourceId: planId, scope: "availability" }), true);
    await prisma.hotelNightlyRate.updateMany({ where: { ratePlanId: planId }, data: { nightlyRate: BigInt(140000) } });
    assert.equal(await isCurrentHotelPublicationApproved({ organizationId: orgId, propertyId, resourceType: "RATE_PLAN", resourceId: planId, scope: "availability" }), false);
    await approveHotelPublication({ organizationId: orgId, propertyId, resourceType: "RATE_PLAN", resourceId: planId, scope: publicationScope, userId: adminId, role: "ADMIN" });
    const added = await prisma.hotelNightlyRate.create({ data: { organizationId: orgId, propertyId, ratePlanId: planId, from: new Date("2027-09-12T00:00:00.000Z"), to: new Date("2027-09-13T00:00:00.000Z"), nightlyRate: BigInt(150000) } });
    assert.equal(await isCurrentHotelPublicationApproved({ organizationId: orgId, propertyId, resourceType: "RATE_PLAN", resourceId: planId, scope: "availability" }), false);
    await approveHotelPublication({ organizationId: orgId, propertyId, resourceType: "RATE_PLAN", resourceId: planId, scope: publicationScope, userId: adminId, role: "ADMIN" });
    await prisma.hotelNightlyRate.delete({ where: { id: added.id } }); assert.equal(await isCurrentHotelPublicationApproved({ organizationId: orgId, propertyId, resourceType: "RATE_PLAN", resourceId: planId, scope: "availability" }), false);
    await approveHotelPublication({ organizationId: orgId, propertyId, resourceType: "RATE_PLAN", resourceId: planId, scope: publicationScope, userId: adminId, role: "ADMIN" });
    await prisma.hotelRatePlan.update({ where: { id: planId }, data: { name: "Changed terms" } }); assert.equal(await isCurrentHotelPublicationApproved({ organizationId: orgId, propertyId, resourceType: "RATE_PLAN", resourceId: planId, scope: "availability" }), false);
  });

  it("revokes publication and serves only approved current resources", async () => {
    await approveHotelPublication({ organizationId: orgId, propertyId, resourceType: "RATE_PLAN", resourceId: planId, scope: publicationScope, userId: adminId, role: "ADMIN" });
    await revokeHotelPublication({ organizationId: orgId, propertyId, resourceType: "RATE_PLAN", resourceId: planId, userId: adminId, role: "ADMIN", reason: "test revoke" });
    assert.equal(await isCurrentHotelPublicationApproved({ organizationId: orgId, propertyId, resourceType: "RATE_PLAN", resourceId: planId, scope: "availability" }), false);
    await approveHotelPublication({ organizationId: orgId, propertyId, resourceType: "RATE_PLAN", resourceId: planId, scope: publicationScope, userId: adminId, role: "ADMIN" });
    process.env.HOTEL_PUBLICATION_OPERATIONAL_ENABLED = "1";
    const request = new NextRequest("https://h3d3p.local/api/hotel/v1/availability/search", { method: "POST", body: JSON.stringify({ property: "approved-hotel", checkIn: "2027-09-10", checkOut: "2027-09-12", occupancy: { adults: 2, children: 0 } }), headers: { host: "h3d3p.local", "content-type": "application/json" } });
    const result = await searchPublishedHotelAvailability("h3d3p.local", { property: "approved-hotel", checkIn: "2027-09-10", checkOut: "2027-09-12", occupancy: { adults: 2, children: 0 } });
    assert.ok(result); assert.equal(result.inventoryReserved, false); assert.equal(result.options.length, 1); assert.deepEqual(result.options[0]?.nightlyRates, [140000, 140000]);
    const response = await availabilityPOST(request);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).inventoryReserved, false);
    assert.equal(await prisma.hotelBookingHold.count({ where: { organizationId: orgId } }), 0); assert.equal(await prisma.hotelReservation.count({ where: { organizationId: orgId } }), 0); assert.equal((await prisma.hotelInventory.findUnique({ where: { roomTypeId_date: { roomTypeId, date } } }))?.allotment, 2);
    delete process.env.HOTEL_PUBLICATION_OPERATIONAL_ENABLED;
  });

  it("does not allow sibling or foreign host access", async () => {
    assert.equal(await searchPublishedHotelAvailability("unknown.h3d3p.local", { property: "approved-hotel", checkIn: "2027-09-10", checkOut: "2027-09-12", occupancy: { adults: 2, children: 0 } }), null);
    assert.equal(await searchPublishedHotelAvailability("other.h3d3p.local", { property: "approved-hotel", checkIn: "2027-09-10", checkOut: "2027-09-12", occupancy: { adults: 2, children: 0 } }), null);
  });

  it("never leaves a stale approved pricing revision after overlapping update and approval", async () => {
    await revokeHotelPublication({ organizationId: orgId, propertyId, resourceType: "RATE_PLAN", resourceId: planId, userId: adminId, role: "ADMIN", reason: "concurrency setup" });
    await Promise.all([
      prisma.hotelRatePlan.update({ where: { id: planId }, data: { name: "Concurrent terms" } }),
      approveHotelPublication({ organizationId: orgId, propertyId, resourceType: "RATE_PLAN", resourceId: planId, scope: publicationScope, userId: adminId, role: "ADMIN" }),
    ]);
    const current = await isCurrentHotelPublicationApproved({ organizationId: orgId, propertyId, resourceType: "RATE_PLAN", resourceId: planId, scope: "availability" });
    const publicResult = await searchPublishedHotelAvailability("h3d3p.local", { property: "approved-hotel", checkIn: "2027-09-10", checkOut: "2027-09-12", occupancy: { adults: 2, children: 0 } });
    if (current) assert.ok(publicResult?.options.some((option) => option.ratePlanId === planId));
    else assert.equal(publicResult?.options.length, 0);
  });
});
