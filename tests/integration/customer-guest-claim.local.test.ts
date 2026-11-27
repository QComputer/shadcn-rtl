import assert from "node:assert/strict";
import { randomInt, randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { PrismaClient, type Organization } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { CustomerPhoneAuthError, CustomerPhoneAuthService } from "../../lib/customer-auth/core.server";
import { customerAuthDigest, decryptCustomerAuthPayload } from "../../lib/customer-auth/crypto";
import type { GuestClaimScope } from "../../lib/customer-auth/guest-claim.contract";
import { appointmentGuestScope } from "../../lib/appointments/guest-scope";
import { guestOrderScope } from "../../lib/retail/guest-order-scope";

// Exact disposable fixture contract, matching the existing accepted PG runner.
const connection = new URL(process.env.DATABASE_URL ?? "https://missing.invalid");
assert.ok(["postgres:", "postgresql:"].includes(connection.protocol));
assert.ok(["127.0.0.1", "localhost"].includes(connection.hostname));
assert.equal(connection.port, "55439");
assert.equal(connection.pathname, "/retail_hero_test");
assert.equal(decodeURIComponent(connection.username), "hero_test");
assert.equal(decodeURIComponent(connection.password), "local_admin_fixture_only");
assert.equal(connection.search, "");
assert.equal(process.env.DATABASE_URL, process.env.DIRECT_URL);
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: connection.toString(), max: 8 }), log: [] });
const secret = `g3b1-fixture-only-${randomUUID()}-${randomUUID()}`;
const tag = `g3b1-${randomUUID()}`;
const orgs: Organization[] = [], users: string[] = [], orders: string[] = [], appointments: string[] = [], guests: string[] = [];
const services: string[] = [], categories: string[] = [];
const quotaKeys = new Set<string>();
let requestSequence = 0;
let shop: Organization, otherShop: Organization, appointmentOrg: Organization, serviceId: string;
const auth = new CustomerPhoneAuthService(db, { enabled: true, guestClaimEnabled: true, secret, senderAvailable: () => true });
const origin = (org: Organization) => `https://${org.slug}.example.test`;
const old = () => new Date(Date.now() - 3_600_000);
const ip = () => { const value = `2001:db8:bb3::${++requestSequence}`; quotaKeys.add(`ip:${customerAuthDigest(value, secret)}`); return value; };

before(async () => {
  const target = await db.$queryRaw<Array<{ name: string; role: string }>>`SELECT current_database()::text AS name, current_user::text AS role`;
  assert.deepEqual(target, [{ name: "retail_hero_test", role: "hero_test" }]);
  for (const [label, type] of [["shop", "SHOP"], ["other", "SHOP"], ["appointment", "APPOINTMENT"]] as const) {
    const org = await db.organization.create({ data: { name: `${tag}-${label}`, slug: `${tag}-${label}`, type } });
    orgs.push(org); quotaKeys.add(`org:${org.id}`);
    await db.organizationDomain.create({ data: { organizationId: org.id, domain: `${org.slug}.example.test`, normalizedDomain: `${org.slug}.example.test`, status: "ACTIVE", providerVerified: true, dnsConfigured: true, sslReady: true, verifiedAt: old() } });
  }
  [shop, otherShop, appointmentOrg] = orgs as [Organization, Organization, Organization];
  const category = await db.serviceCategory.create({ data: { name: tag, organizationId: appointmentOrg.id } }); categories.push(category.id);
  const service = await db.service.create({ data: { name: tag, organizationId: appointmentOrg.id, categoryId: category.id, price: 10, duration: 30 } }); services.push(service.id); serviceId = service.id;
});
after(async () => {
  const orgIds = orgs.map(o => o.id);
  try {
    await db.auditLog.deleteMany({ where: { organizationId: { in: orgIds }, entityType: { in: ["GuestOrderClaim", "GuestAppointmentClaim"] } } });
    await db.payment.deleteMany({ where: { orderId: { in: orders } } });
    await db.order.deleteMany({ where: { id: { in: orders } } });
    await db.appointment.deleteMany({ where: { id: { in: appointments } } });
    await db.guestCustomer.deleteMany({ where: { id: { in: guests } } });
    await db.service.deleteMany({ where: { id: { in: services } } });
    await db.serviceCategory.deleteMany({ where: { id: { in: categories } } });
    await db.customerClubMembership.deleteMany({ where: { organizationId: { in: orgIds }, customerId: { in: users } } });
    await db.organizationMember.deleteMany({ where: { organizationId: { in: orgIds }, userId: { in: users } } });
    await db.customerPhoneSession.deleteMany({ where: { userId: { in: users } } });
    await db.customerPhoneIdentity.deleteMany({ where: { userId: { in: users } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.organizationDomain.deleteMany({ where: { organizationId: { in: orgIds } } });
    await db.organization.deleteMany({ where: { id: { in: orgIds } } });
    await db.customerPhoneAuthQuota.deleteMany({ where: { key: { in: [...quotaKeys] } } });
    assert.equal(await db.organization.count({ where: { id: { in: orgIds } } }), 0);
    assert.equal(await db.customerAccessLink.count({ where: { organizationId: { in: orgIds } } }), 0);
  } finally { await db.$disconnect(); }
});
async function actor(org: Organization, verified = true) {
  let phone = "";
  for (let i = 0; i < 20; i++) {
    const candidate = `09${randomInt(100_000_000, 1_000_000_000)}`;
    if (!await db.user.findFirst({ where: { OR: [{ phone: candidate }, { name: candidate }] } }) && !await db.customerPhoneIdentity.findUnique({ where: { phone: candidate } })) { phone = candidate; break; }
  }
  assert.ok(phone); quotaKeys.add(`phone:${customerAuthDigest(phone, secret)}`);
  const user = await db.user.create({ data: { name: `${tag}-${randomUUID()}`, phone, password: "fixture-not-a-login-credential", role: "CUSTOMER" } }); users.push(user.id);
  if (verified) await db.customerPhoneIdentity.create({ data: { phone, userId: user.id, verifiedAt: old() } });
  const session = await db.customerPhoneSession.create({ data: { userId: user.id, organizationId: org.id, expiresAt: new Date(Date.now() + 3600_000) } });
  return { userId: user.id, sessionId: session.id, organizationId: org.id, origin: origin(org), phone, guestSessionId: randomUUID(), claimConfirmed: true as const };
}
async function makeOrder(org: Organization, phone: string, browser: string, options: { recent?: boolean; legacy?: boolean; pending?: boolean } = {}) {
  const key = randomUUID();
  const guest = await db.guestCustomer.create({ data: { name: "synthetic guest", phone, sessionId: options.legacy ? browser : `${guestOrderScope(org.slug, browser)}${key}` } }); guests.push(guest.id);
  const row = await db.order.create({ data: { orderNumber: `G3B1-${randomUUID()}`, retailCheckoutKey: key, organizationSlug: org.slug, guestCustomerId: guest.id,
    type: "PICK_UP", status: options.pending ? "PENDING" : "PICKED_UP", subtotal: 100, total: 100, paymentMethod: "CASH",
    paymentStatus: options.pending ? "PENDING" : "COMPLETED", createdAt: options.recent ? new Date() : old(), notes: "synthetic original snapshot",
    payment: { create: { amount: 100, method: "CASH", status: options.pending ? "PENDING" : "COMPLETED", metadata: { marker: "unchanged" } } } } }); orders.push(row.id);
  return row;
}
async function orderFixture(options: { recent?: boolean; legacy?: boolean; pending?: boolean; unverified?: boolean } = {}) {
  const account = await actor(shop, !options.unverified);
  const order = await makeOrder(shop, account.phone, account.guestSessionId, options);
  const scope: GuestClaimScope = { ...account, kind: "ORDER", recordId: order.id };
  return { order, scope };
}
async function appointmentFixture() {
  const account = await actor(appointmentOrg);
  const guest = await db.guestCustomer.create({ data: { name: "synthetic appointment guest", phone: account.phone, sessionId: `${appointmentGuestScope(appointmentOrg.id, account.guestSessionId)}${randomUUID()}` } }); guests.push(guest.id);
  const row = await db.appointment.create({ data: { serviceId, guestCustomerId: guest.id, status: "COMPLETED", date: old(), startTime: old(), endTime: old(), createdAt: old(), customerPhoneAtBooking: account.phone, customerNameAtBooking: "original", notes: "original appointment notes" } }); appointments.push(row.id);
  const scope: GuestClaimScope = { ...account, kind: "APPOINTMENT", recordId: row.id };
  return { row, scope };
}
async function issue(scope: GuestClaimScope, service = auth) {
  const result = await service.requestGuestClaim(scope, ip()); assert.equal(result.accepted, true);
  const row = await db.customerAccessLink.findUniqueOrThrow({ where: { id: result.challengeId }, include: { smsOutbox: true } });
  assert.ok(row.smsOutbox); assert.match(row.otpCodeHash ?? "", /^g3:v1:GUEST_RECORD_CLAIM:[a-f0-9]{64}:[a-f0-9]{64}$/);
  const payload = decryptCustomerAuthPayload(row.smsOutbox.encryptedPayload, secret, row.id); assert.match(payload.url, /^OTP:\d{4}$/);
  return { challengeId: row.id, otp: payload.url.slice(4) };
}
async function suppressed(scope: GuestClaimScope, service = auth) {
  const result = await service.requestGuestClaim(scope, ip()); assert.equal(result.accepted, true);
  assert.equal(await db.customerAccessLink.count({ where: { id: result.challengeId } }), 0);
}
async function claim(scope: GuestClaimScope, proof: { challengeId: string; otp: string }, service = auth) {
  return service.claimGuestRecord(scope, proof.challengeId, proof.otp);
}
async function auditCount(scope: GuestClaimScope) {
  return db.auditLog.count({ where: { entityType: scope.kind === "ORDER" ? "GuestOrderClaim" : "GuestAppointmentClaim", entityId: scope.recordId, organizationId: scope.organizationId } });
}
async function assertNoEnrollmentSideEffects(scope: GuestClaimScope) {
  assert.equal(await db.customerClubMembership.count({ where: { customerId: scope.userId } }), 0);
  assert.equal(await db.customerIdentity.count({ where: { userId: scope.userId } }), 0);
  assert.equal(await db.customerPhoneSession.count({ where: { userId: scope.userId } }), 1);
}

test("claim attaches one settled order, preserves original guest/payment/snapshot and audits once", async () => {
  const { scope, order } = await orderFixture();
  const payment = await db.payment.findUniqueOrThrow({ where: { orderId: order.id } });
  const guest = await db.guestCustomer.findUniqueOrThrow({ where: { id: order.guestCustomerId! } });
  const proof = await issue(scope);
  assert.deepEqual(await claim(scope, proof), { outcome: "CLAIMED", kind: "ORDER", recordId: order.id });
  const saved = await db.order.findUniqueOrThrow({ where: { id: order.id } });
  assert.equal(saved.customerId, scope.userId);
  assert.deepEqual({ ...saved, updatedAt: order.updatedAt, customerId: order.customerId }, order);
  assert.deepEqual(await db.payment.findUniqueOrThrow({ where: { orderId: order.id } }), payment);
  assert.deepEqual(await db.guestCustomer.findUniqueOrThrow({ where: { id: guest.id } }), guest);
  assert.equal(await auditCount(scope), 1); await assertNoEnrollmentSideEffects(scope);
  const audit = await db.auditLog.findFirstOrThrow({ where: { entityId: order.id, entityType: "GuestOrderClaim" } });
  assert.equal(audit.userId, scope.userId); assert.equal(audit.organizationId, scope.organizationId);
  assert.deepEqual(audit.newValue, { customerId: scope.userId });
  assert.ok(!JSON.stringify(audit).includes(scope.phone)); assert.ok(!JSON.stringify(audit).includes(scope.guestSessionId));
  await assert.rejects(() => claim(scope, proof), CustomerPhoneAuthError); assert.equal(await auditCount(scope), 1);
});
test("claim attaches completed appointment without changing booking snapshot or club", async () => {
  const { row, scope } = await appointmentFixture(); const proof = await issue(scope);
  assert.deepEqual(await claim(scope, proof), { outcome: "CLAIMED", kind: "APPOINTMENT", recordId: row.id });
  const saved = await db.appointment.findUniqueOrThrow({ where: { id: row.id } });
  assert.equal(saved.customerId, scope.userId); assert.equal(saved.guestCustomerId, row.guestCustomerId); assert.equal(saved.customerPhoneAtBooking, row.customerPhoneAtBooking);
  assert.equal(saved.notes, row.notes); assert.equal(saved.status, row.status); assert.deepEqual(saved.startTime, row.startTime); assert.deepEqual(saved.endTime, row.endTime);
  assert.equal(await auditCount(scope), 1); await assertNoEnrollmentSideEffects(scope);
});
test("one challenge cannot claim another record sharing the same phone and browser", async () => {
  const { scope } = await orderFixture(); const second = await makeOrder(shop, scope.phone, scope.guestSessionId); const proof = await issue(scope);
  await assert.rejects(() => claim({ ...scope, recordId: second.id }, proof), CustomerPhoneAuthError);
  assert.equal((await db.customerAccessLink.findUniqueOrThrow({ where: { id: proof.challengeId } })).otpAttempts, 0);
  await claim(scope, proof); assert.equal((await db.order.findUniqueOrThrow({ where: { id: second.id } })).customerId, null);
});
test("wrong browser, another session, account or tenant cannot reuse proof", async () => {
  const { scope } = await orderFixture(); const proof = await issue(scope);
  const otherSession = await db.customerPhoneSession.create({ data: { userId: scope.userId, organizationId: shop.id, expiresAt: new Date(Date.now()+60_000) } });
  const other = await actor(otherShop);
  for (const altered of [{ ...scope, guestSessionId: randomUUID() }, { ...scope, sessionId: otherSession.id }, { ...scope, userId: other.userId }, { ...scope, organizationId: otherShop.id, origin: origin(otherShop) }]) await assert.rejects(() => claim(altered, proof), CustomerPhoneAuthError);
  assert.equal((await db.customerAccessLink.findUniqueOrThrow({ where: { id: proof.challengeId } })).otpAttempts, 0);
  await claim(scope, proof);
});
test("unowned browser and another tenant cannot obtain a persisted challenge", async () => {
  const { scope } = await orderFixture();
  await suppressed({ ...scope, guestSessionId: randomUUID() });
  const other = await actor(otherShop);
  await suppressed({ ...scope, ...other });
  assert.equal(await auditCount(scope), 0);
});
test("unverified account, legacy row, recent row and pending order remain ineligible", async () => {
  for (const options of [{ unverified: true }, { legacy: true }, { recent: true }, { pending: true }]) {
    const { scope } = await orderFixture(options); await suppressed(scope);
    assert.equal((await db.order.findUniqueOrThrow({ where: { id: scope.recordId } })).customerId, null);
  }
});
test("revocation after issuance rolls back consumption and ownership", async () => {
  const { scope } = await orderFixture(); const proof = await issue(scope);
  await db.customerPhoneSession.update({ where: { id: scope.sessionId }, data: { revokedAt: new Date() } });
  await assert.rejects(() => claim(scope, proof), CustomerPhoneAuthError);
  const link = await db.customerAccessLink.findUniqueOrThrow({ where: { id: proof.challengeId } }); assert.equal(link.consumedAt, null); assert.equal(link.otpConsumedAt, null);
  assert.equal((await db.order.findUniqueOrThrow({ where: { id: scope.recordId } })).customerId, null); assert.equal(await auditCount(scope), 0);
});
test("blocked club, disabled user, privileged role and changed guest contact fail closed", async () => {
  const first = await orderFixture(); const proof = await issue(first.scope);
  await db.customerClubMembership.create({ data: { organizationId: shop.id, customerId: first.scope.userId, status: "BLOCKED" } });
  await assert.rejects(() => claim(first.scope, proof), CustomerPhoneAuthError);
  const second = await orderFixture(); await db.user.update({ where: { id: second.scope.userId }, data: { isActive: false } }); await suppressed(second.scope);
  const third = await orderFixture(); await db.user.update({ where: { id: third.scope.userId }, data: { role: "ADMIN" } }); await suppressed(third.scope);
  const fourth = await orderFixture(); const proof4 = await issue(fourth.scope);
  await db.guestCustomer.update({ where: { id: fourth.order.guestCustomerId! }, data: { phone: "09000000000" } });
  await assert.rejects(() => claim(fourth.scope, proof4), CustomerPhoneAuthError);
  assert.equal(await auditCount(first.scope), 0); assert.equal(await auditCount(fourth.scope), 0);
});
test("existing owner assigned after issuance is never overwritten", async () => {
  const { scope } = await orderFixture(); const proof = await issue(scope); const other = await actor(shop);
  await db.order.update({ where: { id: scope.recordId }, data: { customerId: other.userId } });
  await assert.rejects(() => claim(scope, proof), CustomerPhoneAuthError);
  assert.equal((await db.order.findUniqueOrThrow({ where: { id: scope.recordId } })).customerId, other.userId); assert.equal(await auditCount(scope), 0);
});
test("three wrong attempts persist and block a correct code", async () => {
  const { scope } = await orderFixture(); const proof = await issue(scope); const wrong = proof.otp === "0000" ? "0001" : "0000";
  for (let i = 0; i < 3; i++) await assert.rejects(() => claim(scope, { ...proof, otp: wrong }), CustomerPhoneAuthError);
  assert.equal((await db.customerAccessLink.findUniqueOrThrow({ where: { id: proof.challengeId } })).otpAttempts, 3);
  await assert.rejects(() => claim(scope, proof), CustomerPhoneAuthError); assert.equal(await auditCount(scope), 0);
});
test("expired and wrong-purpose challenges cannot authorize ownership", async () => {
  const { scope } = await orderFixture(); const proof = await issue(scope);
  await assert.rejects(() => auth.verifyPhone({ ...scope, ...proof }), CustomerPhoneAuthError);
  await assert.rejects(() => auth.signInVerified({ ...scope, ...proof }), CustomerPhoneAuthError);
  await db.customerAccessLink.update({ where: { id: proof.challengeId }, data: { otpExpiresAt: old() } });
  await assert.rejects(() => claim(scope, proof), CustomerPhoneAuthError);
  const second = await orderFixture(); const issued = await auth.requestVerification({ ...second.scope, ip: ip() }, "PHONE_PROOF");
  const row = await db.customerAccessLink.findUniqueOrThrow({ where: { id: issued.challengeId }, include: { smsOutbox: true } }); assert.ok(row.smsOutbox);
  const code = decryptCustomerAuthPayload(row.smsOutbox.encryptedPayload, secret, row.id).url.slice(4);
  await assert.rejects(() => claim(second.scope, { challengeId: row.id, otp: code }), CustomerPhoneAuthError);
  assert.equal(await auditCount(scope), 0); assert.equal(await auditCount(second.scope), 0);
});
test("concurrent exact claim has one winner and one audit; default-off refuses mutations", async () => {
  const { scope } = await orderFixture();
  const disabled = new CustomerPhoneAuthService(db, { enabled: true, guestClaimEnabled: false, secret, senderAvailable: () => true });
  const runtimeDefault = new CustomerPhoneAuthService(db, { enabled: true, secret, senderAvailable: () => true });
  assert.equal(process.env.CUSTOMER_GUEST_CLAIM_ENABLED, "0"); assert.equal(process.env.CUSTOMER_PROGRESSIVE_ENROLLMENT_ENABLED, "0");
  await suppressed(scope, disabled); await suppressed(scope, runtimeDefault);
  const proof = await issue(scope); await assert.rejects(() => claim(scope, proof, disabled), CustomerPhoneAuthError);
  await assert.rejects(() => claim(scope, proof, runtimeDefault), CustomerPhoneAuthError);
  const results = await Promise.allSettled([claim(scope, proof), claim(scope, proof), claim(scope, proof)]);
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  assert.equal((await db.order.findUniqueOrThrow({ where: { id: scope.recordId } })).customerId, scope.userId); assert.equal(await auditCount(scope), 1);
});


test("same verified phone and valid account session in another tenant do not authorize the original record", async () => {
  const { scope } = await orderFixture();
  const session = await db.customerPhoneSession.create({ data: { userId: scope.userId, organizationId: otherShop.id, expiresAt: new Date(Date.now() + 3600_000) } });
  await suppressed({ ...scope, organizationId: otherShop.id, origin: origin(otherShop), sessionId: session.id });
  await suppressed({ ...scope, origin: origin(otherShop) });
  const proof = await issue(scope);
  await assert.rejects(() => claim({ ...scope, organizationId: otherShop.id, origin: origin(otherShop), sessionId: session.id }, proof), CustomerPhoneAuthError);
  assert.equal(await auditCount(scope), 0);
  await claim(scope, proof);
});
test("appointment contact mismatch and expired customer session prevent issuance", async () => {
  const first = await appointmentFixture();
  await db.appointment.update({ where: { id: first.row.id }, data: { customerPhoneAtBooking: "09000000000" } });
  await suppressed(first.scope);
  const second = await orderFixture();
  await db.customerPhoneSession.update({ where: { id: second.scope.sessionId }, data: { expiresAt: old() } });
  await suppressed(second.scope);
  assert.equal(await auditCount(first.scope), 0); assert.equal(await auditCount(second.scope), 0);
});
test("tenant capability disabled after issuance blocks claim and leaves proof unconsumed", async () => {
  const { scope, order } = await orderFixture(); const proof = await issue(scope);
  await db.organization.update({ where: { id: shop.id }, data: { capabilitiesInitializedAt: new Date() } });
  try {
    await assert.rejects(() => claim(scope, proof), CustomerPhoneAuthError);
    assert.equal((await db.order.findUniqueOrThrow({ where: { id: order.id } })).customerId, null);
    const challenge = await db.customerAccessLink.findUniqueOrThrow({ where: { id: proof.challengeId } });
    assert.equal(challenge.consumedAt, null); assert.equal(await auditCount(scope), 0);
  } finally { await db.organization.update({ where: { id: shop.id }, data: { capabilitiesInitializedAt: null } }); }
});
