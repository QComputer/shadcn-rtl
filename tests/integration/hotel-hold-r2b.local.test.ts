import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db-runtime";
import { POST } from "@/app/api/hotel/v1/holds/route";
import { approveHotelPublication, resourceRevision } from "@/lib/hotel/services/hotel-publication.service";
import { PrismaHotelRepositories } from "@/lib/hotel/persistence/prisma-hotel-repositories";

const EXPECTED_DB = process.env.HOTEL_TEST_DATABASE_NAME ?? "bazarbaaz_h3d3p1_r2b_verify";
const dates = { checkIn: "2027-11-10", checkOut: "2027-11-12" };
const scope = { availability: true, quote: true, policies: true };
const organizations: Record<"a" | "b", { id: string; propertyIds: Record<string, string>; roomIds: Record<string, string>; planIds: Record<string, string>; policyIds: Record<string, string>; domain: string; adminId: string }> = { a: { id: "", propertyIds: {}, roomIds: {}, planIds: {}, policyIds: {}, domain: "r2b-a.local", adminId: "" }, b: { id: "", propertyIds: {}, roomIds: {}, planIds: {}, policyIds: {}, domain: "r2b-b.local", adminId: "" } };
let inactiveDomainId = "";

function body(property: string, roomType = "standard", ratePlan = "flex") {
  return { property, roomType, ratePlan, ...dates, occupancy: { adults: 2, children: 0 }, guests: [{ fullName: "Synthetic Guest", isPrimary: true }], contact: { fullName: "Synthetic Guest", phone: "09120000000" }, acceptedCancellationPolicyKey: "flex" };
}

function request(host: string, key: string, input: ReturnType<typeof body>) {
  return new NextRequest(`https://${host}/api/hotel/v1/holds`, { method: "POST", headers: { host, "content-type": "application/json", "idempotency-key": key }, body: JSON.stringify(input) });
}

async function send(host: string, key: string, input: ReturnType<typeof body>) {
  const response = await POST(request(host, key, input));
  let parsed: unknown = null;
  try { parsed = await response.clone().json(); } catch { /* safe error may be empty */ }
  return { response, parsed: parsed as Record<string, unknown> | null };
}

async function approveResources(org: typeof organizations.a, propertyId: string, roomId: string, planId: string, policyId: string) {
  for (const [resourceType, resourceId] of [["PROPERTY", propertyId], ["ROOM_TYPE", roomId], ["RATE_PLAN", planId], ["CANCELLATION_POLICY", policyId]] as const) {
    await approveHotelPublication({ organizationId: org.id, propertyId, resourceType, resourceId, scope, userId: org.adminId, role: "ADMIN" });
    assert.ok(await resourceRevision(prisma, { organizationId: org.id, propertyId, resourceType, resourceId }));
  }
}

before(async () => {
  process.env.AI_MEDIA_APPLICATION_STORAGE_ADAPTER = "local-test";
  process.env.HOTEL_ANONYMOUS_HOLD_OPERATIONAL_ENABLED = "1";
  const identity = await prisma.$queryRaw<Array<{ db: string }>>`SELECT current_database() AS db`;
  assert.equal(identity[0]?.db, EXPECTED_DB);
  for (const key of ["a", "b"] as const) {
    const org = await prisma.organization.create({ data: { name: `R2-B ${key}`, slug: `r2b-${key}-${Date.now()}`, type: "SHOP", vertical: "HOTEL" } });
    const admin = await prisma.user.create({ data: { name: `r2b-admin-${key}-${Date.now()}`, password: "synthetic", role: "ADMIN" } });
    organizations[key].id = org.id; organizations[key].adminId = admin.id;
    await prisma.organizationMember.create({ data: { organizationId: org.id, organizationSlug: org.slug, userId: admin.id, role: "ADMIN" } });
    await prisma.organizationCapability.create({ data: { organizationId: org.id, key: "HOTEL_BOOKING", status: "ACTIVE", enabledAt: new Date() } });
    await prisma.organizationDomain.create({ data: { organizationId: org.id, domain: organizations[key].domain, normalizedDomain: organizations[key].domain, status: "ACTIVE", providerVerified: true, dnsConfigured: true, sslReady: true } });
    for (const propertySlug of key === "a" ? ["a1", "a2"] : ["b1"]) {
      const property = await prisma.hotelProperty.create({ data: { organizationId: org.id, organizationSlug: org.slug, slug: propertySlug, name: `R2-B ${propertySlug}` } });
      organizations[key].propertyIds[propertySlug] = property.id;
      const room = await prisma.hotelRoomType.create({ data: { organizationId: org.id, propertyId: property.id, slug: "standard", name: "Standard", maxAdults: 2, maxChildren: 1, maxOccupancy: 3, beds: [{ kind: "queen", count: 1 }] } });
      organizations[key].roomIds[propertySlug] = room.id;
      const policy = await prisma.hotelCancellationPolicy.create({ data: { organizationId: org.id, propertyId: property.id, key: "flex", name: "Flexible", freeCancellationCutoffHours: 24 } });
      organizations[key].policyIds[propertySlug] = policy.id;
      const plan = await prisma.hotelRatePlan.create({ data: { organizationId: org.id, propertyId: property.id, roomTypeId: room.id, code: "flex", name: "Flexible", baseNightlyRate: BigInt(120000), cancellationPolicyId: policy.id } });
      organizations[key].planIds[propertySlug] = plan.id;
      await prisma.hotelNightlyRate.create({ data: { organizationId: org.id, propertyId: property.id, ratePlanId: plan.id, from: new Date(`${dates.checkIn}T00:00:00Z`), to: new Date(`${dates.checkOut}T00:00:00Z`), nightlyRate: BigInt(125000) } });
      await prisma.hotelInventory.createMany({ data: [dates.checkIn, "2027-11-11"].map((date) => ({ organizationId: org.id, propertyId: property.id, roomTypeId: room.id, date: new Date(`${date}T00:00:00Z`), allotment: 2 })) });
      await approveResources(organizations[key], property.id, room.id, plan.id, policy.id);
    }
    const inactive = await prisma.organizationDomain.create({ data: { organizationId: org.id, domain: `inactive-${key}.local`, normalizedDomain: `inactive-${key}.local`, status: "DISABLED", providerVerified: true, dnsConfigured: true, sslReady: true } });
    if (key === "a") inactiveDomainId = inactive.id;
  }
});

after(async () => {
  for (const key of ["a", "b"] as const) {
    const id = organizations[key].id;
    if (!id) continue;
    await prisma.$executeRaw`DELETE FROM "HotelBookingHoldIdempotency" WHERE "organizationId"=${id}`;
    await prisma.hotelBookingHold.deleteMany({ where: { organizationId: id } });
    await prisma.hotelInventory.deleteMany({ where: { organizationId: id } });
    await prisma.hotelNightlyRate.deleteMany({ where: { organizationId: id } });
    await prisma.hotelRatePlan.deleteMany({ where: { organizationId: id } });
    await prisma.hotelCancellationPolicy.deleteMany({ where: { organizationId: id } });
    await prisma.hotelRoomType.deleteMany({ where: { organizationId: id } });
    await prisma.hotelProperty.deleteMany({ where: { organizationId: id } });
    await prisma.organizationDomain.deleteMany({ where: { organizationId: id } });
    await prisma.organizationCapability.deleteMany({ where: { organizationId: id } });
    await prisma.organizationMember.deleteMany({ where: { organizationId: id } });
    await prisma.user.deleteMany({ where: { id: organizations[key].adminId } });
    await prisma.organization.delete({ where: { id } });
  }
  delete process.env.HOTEL_ANONYMOUS_HOLD_OPERATIONAL_ENABLED;
  await prisma.$disconnect();
});

test("valid A1, A2 and B1 requests are isolated and succeed", async () => {
  for (const [key, properties] of [["a", ["a1", "a2"]], ["b", ["b1"]]] as const) for (const property of properties) {
    const result = await send(organizations[key].domain, `r2b-valid-${key}-${property}`, body(property));
    assert.equal(result.response.status, 201);
    assert.equal(result.parsed?.inventoryReserved, true);
  }
  assert.equal(await prisma.hotelBookingHold.count({ where: { organizationId: organizations.a.id, propertyId: organizations.a.propertyIds.a1 } }), 1);
  assert.equal(await prisma.hotelBookingHold.count({ where: { organizationId: organizations.a.id, propertyId: organizations.a.propertyIds.a2 } }), 1);
  assert.equal(await prisma.hotelBookingHold.count({ where: { organizationId: organizations.b.id, propertyId: organizations.b.propertyIds.b1 } }), 1);
});

test("cross-organization and foreign-property requests fail closed without mutation", async () => {
  const cases = [[organizations.b.domain, "a1"], [organizations.a.domain, "b1"]] as const;
  for (const [host, property] of cases) { const result = await send(host, `r2b-foreign-${property}`, body(property)); assert.notEqual(result.response.status, 201); assert.notEqual(result.response.status, 200); assert.equal(result.parsed?.holdId, undefined); }
  assert.equal(await prisma.hotelBookingHold.count({ where: { organizationId: organizations.a.id, propertyId: organizations.a.propertyIds.a1 } }), 1);
  assert.equal(await prisma.hotelBookingHold.count({ where: { organizationId: organizations.b.id, propertyId: organizations.b.propertyIds.b1 } }), 1);
});

test("sibling properties reject substituted resources and protect completed results", async () => {
  const roomMismatch = await send(organizations.a.domain, "r2b-room-mismatch", body("a2", "a1-only"));
  const rateMismatch = await send(organizations.a.domain, "r2b-rate-mismatch", body("a2", "standard", "a1-only"));
  assert.notEqual(roomMismatch.response.status, 201); assert.notEqual(rateMismatch.response.status, 201);
  const replayMismatch = await send(organizations.a.domain, "r2b-valid-a-a1", body("a2"));
  assert.equal(replayMismatch.response.status, 409);
  assert.equal(replayMismatch.parsed?.holdId, undefined);
});

test("foreign keys cannot retrieve a stored result and idempotency is organization scoped", async () => {
  const foreign = await send(organizations.b.domain, "r2b-valid-a-a1", body("b1"));
  assert.equal(foreign.response.status, 201);
  assert.notEqual(foreign.parsed?.holdId, undefined);
  assert.equal(await prisma.hotelBookingHold.count({ where: { organizationId: organizations.b.id, propertyId: organizations.b.propertyIds.b1 } }), 2);
});

test("unknown and inactive domains fail closed", async () => {
  const unknown = await send("unknown-r2b.local", "r2b-unknown-domain", body("a1"));
  const inactive = await send("inactive-a.local", "r2b-inactive-domain", body("a1"));
  assert.equal(unknown.response.status, 404); assert.equal(inactive.response.status, 404);
  assert.equal(unknown.parsed?.holdId, undefined); assert.equal(inactive.parsed?.holdId, undefined);
  assert.equal(inactiveDomainId.length > 0, true);
});

test("disabling HOTEL_BOOKING prevents new holds", async () => {
  await prisma.organizationCapability.updateMany({ where: { organizationId: organizations.a.id, key: "HOTEL_BOOKING" }, data: { status: "INACTIVE", disabledAt: new Date(), enabledAt: null } });
  const result = await send(organizations.a.domain, "r2b-capability-disabled", body("a1"));
  assert.equal(result.response.status, 404); assert.equal(result.parsed?.holdId, undefined);
  await prisma.organizationCapability.updateMany({ where: { organizationId: organizations.a.id, key: "HOTEL_BOOKING" }, data: { status: "ACTIVE", disabledAt: null, enabledAt: new Date() } });
});

test("same-tenant replay preserves the result and fingerprint mismatch is rejected", async () => {
  const key = "r2b-replay-a1";
  const first = await send(organizations.a.domain, key, body("a1"));
  assert.equal(first.response.status, 201);
  const replay = await send(organizations.a.domain, key, body("a1"));
  assert.equal(replay.response.status, 200);
  assert.equal(replay.parsed?.holdId, first.parsed?.holdId);
  const changed = await send(organizations.a.domain, key, body("a2"));
  assert.equal(changed.response.status, 409);
  assert.equal(changed.parsed?.holdId, undefined);
});

test("expired and released holds cannot be replayed as active", async () => {
  const expiredKey = "r2b-expired-replay";
  const expired = await send(organizations.a.domain, expiredKey, body("a2"));
  assert.equal(expired.response.status, 201);
  const expiredHoldId = String(expired.parsed?.holdId);
  await prisma.hotelBookingHold.update({ where: { id: expiredHoldId }, data: { status: "EXPIRED" } });
  assert.equal((await prisma.hotelBookingHold.findUnique({ where: { id: expiredHoldId }, select: { status: true } }))?.status, "EXPIRED");
  const expiredReplay = await send(organizations.a.domain, expiredKey, body("a2"));
  assert.equal(expiredReplay.response.status, 409);
  assert.equal(expiredReplay.parsed?.holdId, undefined);
  await prisma.hotelInventory.updateMany({ where: { organizationId: organizations.a.id, propertyId: organizations.a.propertyIds.a2 }, data: { held: 0 } });

  const releasedKey = "r2b-released-replay";
  const released = await send(organizations.a.domain, releasedKey, body("a2"));
  assert.equal(released.response.status, 201);
  await new PrismaHotelRepositories(prisma).releaseHold({ organizationId: organizations.a.id }, String(released.parsed?.holdId), new Date("2027-11-01T00:00:00Z"));
  const releasedReplay = await send(organizations.a.domain, releasedKey, body("a2"));
  assert.equal(releasedReplay.response.status, 409);
  assert.equal(releasedReplay.parsed?.holdId, undefined);
});

test("rejected responses disclose no foreign snapshot or guest data", async () => {
  const result = await send(organizations.b.domain, "r2b-disclosure-check", body("a1"));
  const text = JSON.stringify(result.parsed ?? {});
  assert.equal(result.parsed?.cancellationPolicy, undefined);
  assert.equal(text.includes("Synthetic Guest"), false);
  assert.equal(text.includes("125000"), false);
});
