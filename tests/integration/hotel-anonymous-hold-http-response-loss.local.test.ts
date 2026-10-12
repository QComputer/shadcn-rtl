import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db-runtime";
import { resourceRevision, approveHotelPublication } from "@/lib/hotel/services/hotel-publication.service";
import { searchPublishedHotelAvailability } from "@/lib/hotel/services/public-availability.service";
import { POST } from "@/app/api/hotel/v1/holds/route";

const EXPECTED_DB = "bazarbaaz_h3d3p1_tx_verify";
const host = "h3d3p1-http.local";
const checkIn = "2027-10-10";
const checkOut = "2027-10-12";
let organizationId = "";
let propertyId = "";
let roomTypeId = "";
let ratePlanId = "";
let policyId = "";
let adminId = "";
const key = `http-response-loss-${Date.now()}`;
const payload = { property: "approved-hotel", roomType: "standard", ratePlan: "flex", checkIn, checkOut, occupancy: { adults: 2, children: 0 }, guests: [{ fullName: "Synthetic Guest", isPrimary: true }], contact: { fullName: "Synthetic Guest", phone: "09120000000" }, acceptedCancellationPolicyKey: "flex" };
const request = () => new NextRequest(`https://${host}/api/hotel/v1/holds`, { method: "POST", headers: { host, "content-type": "application/json", "idempotency-key": key }, body: JSON.stringify(payload) });

before(async () => {
  process.env.AI_MEDIA_APPLICATION_STORAGE_ADAPTER = "local-test";
  process.env.HOTEL_ANONYMOUS_HOLD_OPERATIONAL_ENABLED = "1";
  const identity = await prisma.$queryRaw<Array<{ db: string }>>`SELECT current_database() AS db`;
  assert.equal(identity[0]?.db, EXPECTED_DB);
  const organization = await prisma.organization.create({ data: { name: `H3D3P1 HTTP ${Date.now()}`, slug: `h3d3p1-http-${Date.now()}`, type: "SHOP", vertical: "HOTEL" } }); organizationId = organization.id;
  const admin = await prisma.user.create({ data: { name: `h3d3p1-http-admin-${Date.now()}`, password: "synthetic", role: "ADMIN" } }); adminId = admin.id;
  await prisma.organizationMember.create({ data: { organizationId, organizationSlug: organization.slug, userId: adminId, role: "ADMIN" } });
  await prisma.organizationCapability.create({ data: { organizationId, key: "HOTEL_BOOKING", status: "ACTIVE", enabledAt: new Date() } });
  await prisma.organizationDomain.create({ data: { organizationId, domain: host, normalizedDomain: host, status: "ACTIVE", providerVerified: true, dnsConfigured: true, sslReady: true } });
  const property = await prisma.hotelProperty.create({ data: { organizationId, organizationSlug: organization.slug, slug: "approved-hotel", name: "Approved Hotel" } }); propertyId = property.id;
  const room = await prisma.hotelRoomType.create({ data: { organizationId, propertyId, slug: "standard", name: "Standard", maxAdults: 2, maxChildren: 1, maxOccupancy: 3, beds: [{ kind: "queen", count: 1 }] } }); roomTypeId = room.id;
  const policy = await prisma.hotelCancellationPolicy.create({ data: { organizationId, propertyId, key: "flex", name: "Flexible", freeCancellationCutoffHours: 24 } }); policyId = policy.id;
  const plan = await prisma.hotelRatePlan.create({ data: { organizationId, propertyId, roomTypeId, code: "flex", name: "Flexible", baseNightlyRate: BigInt(125000), cancellationPolicyId: policyId } }); ratePlanId = plan.id;
  await prisma.hotelNightlyRate.create({ data: { organizationId, propertyId, ratePlanId, from: new Date(`${checkIn}T00:00:00Z`), to: new Date(`${checkOut}T00:00:00Z`), nightlyRate: BigInt(130000) } });
  await prisma.hotelInventory.createMany({ data: [checkIn, "2027-10-11"].map((date) => ({ organizationId, propertyId, roomTypeId, date: new Date(`${date}T00:00:00Z`), allotment: 1 })) });
  const scope = { availability: true, quote: true, policies: true };
  for (const item of [["PROPERTY", propertyId], ["ROOM_TYPE", roomTypeId], ["RATE_PLAN", ratePlanId], ["CANCELLATION_POLICY", policyId]] as const) await approveHotelPublication({ organizationId, propertyId, resourceType: item[0] as "PROPERTY" | "ROOM_TYPE" | "RATE_PLAN" | "CANCELLATION_POLICY", resourceId: item[1], scope, userId: adminId, role: "ADMIN" });
  for (const item of [["PROPERTY", propertyId], ["ROOM_TYPE", roomTypeId], ["RATE_PLAN", ratePlanId], ["CANCELLATION_POLICY", policyId]] as const) assert.ok(await resourceRevision(prisma, { organizationId, propertyId, resourceType: item[0] as "PROPERTY" | "ROOM_TYPE" | "RATE_PLAN" | "CANCELLATION_POLICY", resourceId: item[1] }));
});

after(async () => {
  if (!organizationId) return;
  await prisma.$executeRaw`DELETE FROM "HotelBookingHoldIdempotency" WHERE "organizationId"=${organizationId}`;
  await prisma.hotelBookingHold.deleteMany({ where: { organizationId } }); await prisma.hotelInventory.deleteMany({ where: { organizationId } }); await prisma.hotelNightlyRate.deleteMany({ where: { organizationId } }); await prisma.hotelRatePlan.deleteMany({ where: { organizationId } }); await prisma.hotelCancellationPolicy.deleteMany({ where: { organizationId } }); await prisma.hotelRoomType.deleteMany({ where: { organizationId } }); await prisma.hotelProperty.deleteMany({ where: { organizationId } }); await prisma.organizationDomain.deleteMany({ where: { organizationId } }); await prisma.organizationCapability.deleteMany({ where: { organizationId } }); await prisma.organizationMember.deleteMany({ where: { organizationId } }); await prisma.user.deleteMany({ where: { id: adminId } }); await prisma.organization.delete({ where: { id: organizationId } }); delete process.env.HOTEL_ANONYMOUS_HOLD_OPERATIONAL_ENABLED; await prisma.$disconnect();
});

test("recovers a committed hold through the real HTTP handler after response loss", async () => {
  const first = await POST(request());
  if (first.status !== 201) {
    const diagnostic = await searchPublishedHotelAvailability(host, { property: "approved-hotel", checkIn, checkOut, occupancy: { adults: 2, children: 0 }, roomTypes: ["standard"], ratePlan: "flex" }, undefined, prisma);
    throw new Error(`first HTTP hold failed: ${await first.text()} property=${diagnostic?.property.id ?? "none"} options=${diagnostic?.options.length ?? -1} rejected=${JSON.stringify(diagnostic?.rejected ?? [])}`);
  }
  const firstBody = await first.json() as { holdId: string; reference: string; expiresAt: string; totalRate: string };
  const second = await POST(request());
  assert.equal(second.status, 200);
  const secondBody = await second.json() as typeof firstBody;
  assert.deepEqual(secondBody, firstBody);
  assert.equal(await prisma.hotelBookingHold.count({ where: { organizationId } }), 1);
  assert.equal(await prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*)::bigint AS count FROM "HotelBookingHoldIdempotency" WHERE "organizationId"=${organizationId} AND "operationScope"='ANONYMOUS_HOLD' AND "idempotencyKey"=${key} AND "status"='COMPLETED'`.then((rows) => Number(rows[0].count)), 1);
  const inventory = await prisma.hotelInventory.findMany({ where: { organizationId, propertyId, roomTypeId }, orderBy: { date: "asc" } });
  assert.deepEqual(inventory.map((row) => row.held), [1, 1]);
  assert.equal(await prisma.hotelReservation.count({ where: { organizationId } }), 0);
});
