import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db-runtime";
import { resourceRevision, approveHotelPublication } from "@/lib/hotel/services/hotel-publication.service";
import { POST } from "@/app/api/hotel/v1/holds/route";
import { POST as createReservation } from "@/app/api/hotel/v1/reservations/route";
import { matchesHotelRecoveryEvidence } from "@/lib/hotel/domain/guest-recovery-secret";

const EXPECTED_DB = "retail_hero_test";
const host = "hotel-claim-proof.local";
const origin = `https://${host}`;
const checkIn = "2027-10-10";
const checkOut = "2027-10-12";
let organizationId = "";
let propertyId = "";
let roomTypeId = "";
let ratePlanId = "";
let policyId = "";
let adminId = "";
const payload = { property: "approved-hotel", roomType: "standard", ratePlan: "flex", checkIn, checkOut, occupancy: { adults: 2, children: 0 }, guests: [{ fullName: "Synthetic Guest", isPrimary: true }], contact: { fullName: "Synthetic Guest", phone: "09120000000" }, acceptedCancellationPolicyKey: "flex", acceptedCancellationPolicyVersion: 1, acceptedTotalRate: "260000", acceptedCurrency: "TOMAN" };
const request = (key: string) => new NextRequest(`https://${host}/api/hotel/v1/holds`, { method: "POST", headers: { host, "content-type": "application/json", "idempotency-key": key }, body: JSON.stringify(payload) });

before(async () => {
  process.env.AI_MEDIA_APPLICATION_STORAGE_ADAPTER = "local-test";
  process.env.HOTEL_GUEST_RECOVERY_ISSUANCE_ENABLED = "1";
  process.env.HOTEL_ANONYMOUS_HOLD_OPERATIONAL_ENABLED = "1";
  process.env.HOTEL_ANONYMOUS_RESERVATION_OPERATIONAL_ENABLED = "1";
  const dbUrl = new URL(process.env.DATABASE_URL ?? "");
  assert.equal(dbUrl.hostname, "127.0.0.1"); assert.equal(dbUrl.port, "55439");
  assert.equal(dbUrl.pathname, `/${EXPECTED_DB}`); assert.equal(dbUrl.username, "hero_test");
  assert.equal(dbUrl.search, ""); assert.equal(dbUrl.hash, "");
  const identity = await prisma.$queryRaw<Array<{ db: string; role: string }>>`SELECT current_database()::text AS db, current_user::text AS role`;
  assert.deepEqual(identity, [{ db: EXPECTED_DB, role: "hero_test" }]);
  assert.ok((process.env.NEXTAUTH_SECRET ?? "").length >= 32);
  const organization = await prisma.organization.create({ data: { name: `H3D3P1 HTTP ${Date.now()}`, slug: `h3d3p1-http-${Date.now()}`, type: "SHOP", vertical: "HOTEL" } }); organizationId = organization.id;
  const admin = await prisma.user.create({ data: { name: `h3d3p1-http-admin-${Date.now()}`, password: "synthetic", role: "ADMIN" } }); adminId = admin.id;
  await prisma.organizationMember.create({ data: { organizationId, organizationSlug: organization.slug, userId: adminId, role: "ADMIN" } });
  await prisma.organizationCapability.create({ data: { organizationId, key: "HOTEL_BOOKING", status: "ACTIVE", enabledAt: new Date() } });
  await prisma.organizationDomain.create({ data: { organizationId, domain: host, normalizedDomain: host, status: "ACTIVE", providerVerified: true, dnsConfigured: true, sslReady: true } });
  const property = await prisma.hotelProperty.create({ data: { organizationId, organizationSlug: organization.slug, slug: "approved-hotel", name: "Approved Hotel" } }); propertyId = property.id;
  const room = await prisma.hotelRoomType.create({ data: { organizationId, propertyId, slug: "standard", name: "Standard", totalAllotment: 6, maxAdults: 2, maxChildren: 1, maxOccupancy: 3, beds: [{ kind: "queen", count: 1 }] } }); roomTypeId = room.id;
  const policy = await prisma.hotelCancellationPolicy.create({ data: { organizationId, propertyId, key: "flex", name: "Flexible", freeCancellationCutoffHours: 24 } }); policyId = policy.id;
  const plan = await prisma.hotelRatePlan.create({ data: { organizationId, propertyId, roomTypeId, code: "flex", name: "Flexible", baseNightlyRate: BigInt(125000), cancellationPolicyId: policyId } }); ratePlanId = plan.id;
  await prisma.hotelNightlyRate.create({ data: { organizationId, propertyId, ratePlanId, from: new Date(`${checkIn}T00:00:00Z`), to: new Date(`${checkOut}T00:00:00Z`), nightlyRate: BigInt(130000) } });
  await prisma.hotelInventory.createMany({ data: [checkIn, "2027-10-11"].map((date) => ({ organizationId, propertyId, roomTypeId, date: new Date(`${date}T00:00:00Z`), allotment: 6 })) });
  const scope = { availability: true, quote: true, policies: true };
  for (const item of [["PROPERTY", propertyId], ["ROOM_TYPE", roomTypeId], ["RATE_PLAN", ratePlanId], ["CANCELLATION_POLICY", policyId]] as const) await approveHotelPublication({ organizationId, propertyId, resourceType: item[0] as "PROPERTY" | "ROOM_TYPE" | "RATE_PLAN" | "CANCELLATION_POLICY", resourceId: item[1], scope, userId: adminId, role: "ADMIN" });
  for (const item of [["PROPERTY", propertyId], ["ROOM_TYPE", roomTypeId], ["RATE_PLAN", ratePlanId], ["CANCELLATION_POLICY", policyId]] as const) assert.ok(await resourceRevision(prisma, { organizationId, propertyId, resourceType: item[0] as "PROPERTY" | "ROOM_TYPE" | "RATE_PLAN" | "CANCELLATION_POLICY", resourceId: item[1] }));
});

after(async () => {
  if (!organizationId) { await prisma.$disconnect(); return; }
  await prisma.$executeRaw`DELETE FROM "HotelBookingHoldIdempotency" WHERE "organizationId"=${organizationId}`;
  await prisma.hotelPaymentAllocation.deleteMany({ where: { organizationId } }); await prisma.paymentRequest.deleteMany({ where: { organizationId } }); await prisma.hotelReservation.deleteMany({ where: { organizationId } }); await prisma.customerIdentity.deleteMany({ where: { organizationId } });
  await prisma.hotelBookingHold.deleteMany({ where: { organizationId } }); await prisma.hotelInventory.deleteMany({ where: { organizationId } }); await prisma.hotelNightlyRate.deleteMany({ where: { organizationId } }); await prisma.hotelRatePlan.deleteMany({ where: { organizationId } }); await prisma.hotelCancellationPolicy.deleteMany({ where: { organizationId } }); await prisma.hotelRoomType.deleteMany({ where: { organizationId } }); await prisma.hotelProperty.deleteMany({ where: { organizationId } }); await prisma.organizationDomain.deleteMany({ where: { organizationId } }); await prisma.organizationCapability.deleteMany({ where: { organizationId } }); await prisma.organizationMember.deleteMany({ where: { organizationId } }); await prisma.user.deleteMany({ where: { id: adminId } }); await prisma.organization.delete({ where: { id: organizationId } }); delete process.env.HOTEL_ANONYMOUS_HOLD_OPERATIONAL_ENABLED; delete process.env.HOTEL_ANONYMOUS_RESERVATION_OPERATIONAL_ENABLED; delete process.env.HOTEL_GUEST_CLAIM_PROOF_ENABLED; delete process.env.HOTEL_GUEST_RECOVERY_ISSUANCE_ENABLED; await prisma.$disconnect();
});

async function reserve(key: string, extra: Record<string, string> = {}) {
  const held = await POST(request(key));
  assert.equal(held.status, 201, await held.clone().text());
  const { holdId } = await held.json() as { holdId: string };
  const send = (headers: Record<string, string>) => createReservation(new NextRequest(`${origin}/api/hotel/v1/reservations`, { method: "POST", headers: { host, "content-type": "application/json", ...headers }, body: JSON.stringify({ ...payload, recoveryOptIn: true, idempotencyKey: key, holdId, holdIdempotencyKey: key }) }));
  const response = await send(extra);
  assert.equal(response.status, 201, await response.clone().text());
  const body = await response.json() as { reference: string; status: string; recoveryCredential: string };
  const reservation = await prisma.hotelReservation.findFirstOrThrow({ where: { organizationId, reference: body.reference } });
  return { response, body, reservation, send };
}

test("opt-in issuance is digest-only, no-store and replay never returns credential", async () => {
  const result = await reserve("hotel-recovery-on", { origin });
  assert.equal(result.response.headers.get("cache-control"), "private, no-store");
  assert.match(result.body.recoveryCredential, /^[A-Za-z0-9_-]{43}$/);
  const evidence = await prisma.hotelGuestRecoveryCredential.findUniqueOrThrow({ where: { reservationId: result.reservation.id } });
  assert.equal(matchesHotelRecoveryEvidence(evidence, { reservationId: result.reservation.id, organizationId, propertyId, origin }, result.body.recoveryCredential, payload.contact.phone, process.env.NEXTAUTH_SECRET!, new Date()), true);
  assert.equal(JSON.stringify(evidence).includes(result.body.recoveryCredential), false);
  const replay = await result.send({ origin }); assert.equal(replay.status, 200);
  assert.equal("recoveryCredential" in await replay.json(), false);
});
