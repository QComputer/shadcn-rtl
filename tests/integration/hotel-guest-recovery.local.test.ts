import assert from "node:assert/strict";
import { randomUUID, randomInt } from "node:crypto";
import { after, before, test } from "node:test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { CustomerPhoneAuthService } from "../../lib/customer-auth/core.server";
import { decryptCustomerAuthPayload } from "../../lib/customer-auth/crypto";
import { buildHotelRecoveryEvidence, createHotelRecoverySecret } from "../../lib/hotel/domain/guest-recovery-secret";
import type { GuestClaimScope } from "../../lib/customer-auth/guest-claim.contract";
const url = new URL(process.env.DATABASE_URL ?? "");
assert.equal(url.hostname, "127.0.0.1"); assert.equal(url.port, "55439"); assert.equal(url.pathname, "/retail_hero_test"); assert.equal(url.username, "hero_test"); assert.equal(process.env.DATABASE_URL, process.env.DIRECT_URL);
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString() }) });
const secret = `hotel-recovery-test-${randomUUID()}-${randomUUID()}`, token = createHotelRecoverySecret(), phone = `09${randomInt(100000000,1000000000)}`, tag = `hotel-claim-${randomUUID()}`;
const service = new CustomerPhoneAuthService(db, { enabled: true, guestClaimEnabled: true, secret, senderAvailable: () => true });
let scope: GuestClaimScope;
before(async () => {
  assert.deepEqual(await db.$queryRaw`SELECT current_database()::text AS db, current_user::text AS role`, [{ db: "retail_hero_test", role: "hero_test" }]);
  process.env.HOTEL_GUEST_RESERVATION_CLAIM_ENABLED = "1";
  process.env.HOTEL_GUEST_RECOVERY_REDEMPTION_ENABLED = "1";
  const org = await db.organization.create({ data: { name: tag, slug: tag, type: "SHOP", vertical: "HOTEL", capabilitiesInitializedAt: new Date() } });
  await db.organizationCapability.create({ data: { organizationId: org.id, key: "HOTEL_BOOKING", status: "ACTIVE", enabledAt: new Date() } });
  const host = `${tag}.example.test`, origin = `https://${host}`;
  await db.organizationDomain.create({ data: { organizationId: org.id, domain: host, normalizedDomain: host, status: "ACTIVE", providerVerified: true, dnsConfigured: true, sslReady: true } });
  const user = await db.user.create({ data: { name: tag, role: "CUSTOMER", password: "fixture", phone } });
  await db.customerPhoneIdentity.create({ data: { userId: user.id, phone, verifiedAt: new Date(Date.now()-10000) } });
  const session = await db.customerPhoneSession.create({ data: { userId: user.id, organizationId: org.id, expiresAt: new Date(Date.now()+3600000) } });
  const property = await db.hotelProperty.create({ data: { organizationId: org.id, organizationSlug: org.slug, slug: "hotel", name: "Hotel" } });
  const room = await db.hotelRoomType.create({ data: { organizationId: org.id, propertyId: property.id, slug: "room", name: "Room", maxAdults: 2, maxChildren: 0, maxOccupancy: 2, beds: [] } });
  const reservation = await db.hotelReservation.create({ data: { organizationId: org.id, propertyId: property.id, roomTypeId: room.id, ratePlanId: "fixture", reference: tag, checkIn: new Date("2025-01-01"), checkOut: new Date(Date.now()-86400000), status: "CHECKED_OUT", checkedOutAt: new Date(Date.now()-10000), totalAmount: BigInt(100), cancellationPolicyKey: "fixture", cancellationPolicySnapshot: {}, idempotencyKey: tag } });
  const proof = buildHotelRecoveryEvidence({ reservationId: reservation.id, organizationId: org.id, propertyId: property.id, origin }, token, phone, secret, new Date(), reservation.checkOut); assert.ok(proof);
  await db.hotelGuestRecoveryCredential.create({ data: proof });
  scope = { kind: "HOTEL", recordId: reservation.id, organizationId: org.id, userId: user.id, sessionId: session.id, origin, phone, guestSessionId: token, recovery: true, claimConfirmed: true };
});
after(async () => { delete process.env.HOTEL_GUEST_RESERVATION_CLAIM_ENABLED; delete process.env.HOTEL_GUEST_RECOVERY_REDEMPTION_ENABLED; await db.$disconnect(); });
test("recovery requires scoped secret and OTP, deletes credential atomically and rejects replay", async () => {
  for (const bad of [
    { ...scope, guestSessionId: createHotelRecoverySecret() },
    { ...scope, origin: "https://wrong.example" },
    { ...scope, phone: "09111111111" },
    { ...scope, organizationId: "foreign-tenant" },
    { ...scope, claimConfirmed: false } as unknown as GuestClaimScope,
  ]) {
    const issued = await service.requestGuestClaim(bad, "synthetic-negative");
    assert.equal(await db.customerAccessLink.count({ where: { id: issued.challengeId } }), 0);
  }
  const issued = await service.requestGuestClaim(scope, "synthetic-recovery");
  const link = await db.customerAccessLink.findUniqueOrThrow({ where: { id: issued.challengeId }, include: { smsOutbox: true } }); assert.ok(link.smsOutbox);
  const otp = decryptCustomerAuthPayload(link.smsOutbox.encryptedPayload, secret, link.id).url.slice(4);
  await assert.rejects(() => service.claimGuestRecord({ ...scope, guestSessionId: createHotelRecoverySecret() }, issued.challengeId, otp));
  assert.ok(await db.hotelGuestRecoveryCredential.findUnique({ where: { reservationId: scope.recordId } }));
  // A failure after OTP consumption and credential deletion must roll back both.
  await db.$executeRawUnsafe(`CREATE FUNCTION g3b32_test_reject_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."entityType" = 'HotelGuestReservationClaim' AND NEW."entityId" = '${scope.recordId}' THEN RAISE EXCEPTION 'synthetic audit failure'; END IF; RETURN NEW; END $$`);
  await db.$executeRawUnsafe(`CREATE TRIGGER g3b32_test_reject_audit BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION g3b32_test_reject_audit()`);
  try {
    await assert.rejects(() => service.claimGuestRecord(scope, issued.challengeId, otp));
    assert.ok(await db.hotelGuestRecoveryCredential.findUnique({ where: { reservationId: scope.recordId } }));
    const unchanged = await db.customerAccessLink.findUniqueOrThrow({ where: { id: issued.challengeId } });
    assert.equal(unchanged.consumedAt, null); assert.equal(unchanged.otpConsumedAt, null);
    assert.equal(await db.hotelReservationOwnership.count({ where: { reservationId: scope.recordId } }), 0);
  } finally {
    await db.$executeRawUnsafe(`DROP TRIGGER g3b32_test_reject_audit ON "AuditLog"`);
    await db.$executeRawUnsafe(`DROP FUNCTION g3b32_test_reject_audit()`);
  }
  const attempts = await Promise.allSettled([service.claimGuestRecord(scope, issued.challengeId, otp), service.claimGuestRecord(scope, issued.challengeId, otp)]);
  assert.equal(attempts.filter(result => result.status === "fulfilled").length, 1);
  assert.equal(attempts.filter(result => result.status === "rejected").length, 1);
  assert.equal(await db.hotelGuestRecoveryCredential.findUnique({ where: { reservationId: scope.recordId } }), null);
  assert.equal((await db.hotelReservationOwnership.findUniqueOrThrow({ where: { reservationId: scope.recordId } })).userId, scope.userId);
  assert.equal(await db.auditLog.count({ where: { entityType: "HotelGuestReservationClaim", entityId: scope.recordId } }), 1);
  await assert.rejects(() => service.claimGuestRecord(scope, issued.challengeId, otp));
});
