import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { prisma } from "@/lib/db";
import { getOrganizationReconciliationQueue, getPublicPaymentStatus } from "@/lib/payments/payment-operations.service";

const databaseUrl = process.env.DATABASE_URL ?? "";
const isDisposable = /(?:localhost|127\.0\.0\.1)(?::\d+)?\//i.test(databaseUrl);

describe("BB-P3 payment status and reconciliation on disposable PostgreSQL", { skip: !isDisposable }, () => {
  const suffix = randomUUID().replace(/-/g, "");
  let organizationA: { id: string };
  let organizationB: { id: string };
  let paymentA: { id: string; publicPaymentId: string };
  let paymentB: { id: string; publicPaymentId: string };

  before(async () => {
    organizationA = await prisma.organization.create({ data: { type: "SHOP", name: `P3 A ${suffix}`, slug: `p3-a-${suffix}` }, select: { id: true } });
    organizationB = await prisma.organization.create({ data: { type: "SHOP", name: `P3 B ${suffix}`, slug: `p3-b-${suffix}` }, select: { id: true } });
    paymentA = await prisma.paymentRequest.create({
      data: { organizationId: organizationA.id, amountToman: BigInt(1200), purpose: "P3_PENDING", status: "PENDING_VERIFICATION" },
      select: { id: true, publicPaymentId: true },
    });
    paymentB = await prisma.paymentRequest.create({
      data: { organizationId: organizationB.id, amountToman: BigInt(2300), purpose: "P3_OTHER_TENANT", status: "FAILED" },
      select: { id: true, publicPaymentId: true },
    });
    await prisma.paymentProviderAttempt.createMany({ data: [
      { organizationId: organizationA.id, paymentRequestId: paymentA.id, provider: "INOTI_USSD", amountToman: BigInt(1200), status: "PENDING_VERIFICATION", failureReason: "TIMEOUT" },
      { organizationId: organizationB.id, paymentRequestId: paymentB.id, provider: "INOTI_USSD", amountToman: BigInt(2300), status: "FAILED", failureReason: "CORRELATION_MISMATCH" },
    ] });
  });

  after(async () => {
    const organizationIds = [organizationA.id, organizationB.id];
    await prisma.paymentProviderAttempt.deleteMany({ where: { organizationId: { in: organizationIds } } });
    await prisma.paymentRequest.deleteMany({ where: { organizationId: { in: organizationIds } } });
    await prisma.organization.deleteMany({ where: { id: { in: organizationIds } } });
    await prisma.$disconnect();
  });

  it("returns a possession-authorized safe customer status", async () => {
    const status = await getPublicPaymentStatus(paymentA.publicPaymentId);
    assert.equal(status?.publicPaymentId, paymentA.publicPaymentId);
    assert.equal(status?.status, "VERIFYING");
    assert.equal(status?.amountToman, "1200");
    assert.equal("providerReference" in (status ?? {}), false);
    assert.equal("organizationId" in (status ?? {}), false);
  });

  it("scopes the operator queue to one organization", async () => {
    const queueA = await getOrganizationReconciliationQueue({ organizationId: organizationA.id });
    assert.deepEqual(queueA.map((item) => item.publicPaymentId), [paymentA.publicPaymentId]);
    assert.equal(queueA[0]?.category, "PROVIDER_RESULT_PENDING");
    assert.doesNotMatch(JSON.stringify(queueA), /P3_OTHER_TENANT|CORRELATION_MISMATCH/);

    const queueB = await getOrganizationReconciliationQueue({ organizationId: organizationB.id });
    assert.deepEqual(queueB.map((item) => item.publicPaymentId), [paymentB.publicPaymentId]);
    assert.equal(queueB[0]?.category, "SECURITY_ANOMALY");
  });
});
