import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { prisma } from "@/lib/db";
import { createPaymentRequest } from "@/lib/payments/payment-request.service";
import { InotiPaymentLifecycleService } from "@/lib/payments/inoti-payment-lifecycle.service";
import { PrismaUssdIntegrationRepository } from "@/lib/integrations/inoti-ussd/repository";
import { InotiUssdWorkflow } from "@/lib/integrations/inoti-ussd/workflow";
import { createInotiUssdCallbackHandler } from "@/app/api/integrations/inoti/ussd/[publicIntegrationId]/route";
import type {
  InotiCredentialProfile,
  InotiPaymentVerificationQuery,
  InotiVerificationResult,
  UssdProvider,
} from "@/lib/integrations/inoti-ussd/types";
import { processDuePaymentVerifications } from "@/lib/integrations/inoti-ussd/durable-verification";

const databaseUrl = process.env.DATABASE_URL ?? "";
const isDisposable = /(?:localhost|127\.0\.0\.1)(?::\d+)?\//i.test(databaseUrl);

class FixtureProvider implements UssdProvider {
  mode: "SUCCESS" | "NOT_FOUND" | "TIMEOUT" | "MALFORMED" = "SUCCESS";
  calls = 0;
  queries: InotiPaymentVerificationQuery[] = [];
  getReadiness() { return { ready: true, transportSecure: true, code: "READY" as const }; }
  async verifyPayment(_profile: InotiCredentialProfile | null, query: InotiPaymentVerificationQuery): Promise<InotiVerificationResult> {
    this.calls += 1;
    this.queries.push(query);
    if (this.mode === "NOT_FOUND") return { ok: false, code: "NOT_FOUND" };
    if (this.mode === "TIMEOUT") return { ok: false, code: "TIMEOUT" };
    if (this.mode === "MALFORMED") return { ok: false, code: "MALFORMED_RESPONSE" };
    return {
      ok: true,
      record: {
        sessionId: query.sessionId,
        mobile: query.mobile,
        amountRial: query.amountRial,
        merchantFactorId: query.merchantFactorId,
        providerFactorId: query.providerFactorId,
        rrn: query.rrn,
        result: "true",
        successful: true,
      },
    };
  }
}

const credentials = {
  async resolveProfile(organizationId: string, profileKey: string | null) {
    return {
      organizationId,
      profileKey: profileKey ?? "fixture",
      username: "fixture-user",
      password: "fixture-password",
      endpoint: "https://fixture.invalid/GetPayments",
    };
  },
};

function callbackUrl(publicId: string, input: { codeName: string; sessionId: string; factor: string; providerFactor?: string; rrn?: string; mobile?: string }) {
  const params = new URLSearchParams({
    mobile: input.mobile ?? "09123456789",
    sessionid: input.sessionId,
    call: `6655*${input.codeName}*payment*request*${input.factor}*${input.providerFactor ?? `provider-${input.sessionId}`}`,
    RRN: input.rrn ?? `rrn-${input.sessionId}`,
  });
  return `http://localhost/api/integrations/inoti/ussd/${publicId}?${params}`;
}

describe("BB-P2 PaymentRequest and iNoti lifecycle on disposable PostgreSQL", { skip: !isDisposable }, () => {
  const suffix = randomUUID().replace(/-/g, "");
  const repository = new PrismaUssdIntegrationRepository();
  const provider = new FixtureProvider();
  let organizationA: Awaited<ReturnType<typeof prisma.organization.create>>;
  let organizationB: Awaited<ReturnType<typeof prisma.organization.create>>;
  let integrationA: Awaited<ReturnType<typeof prisma.organizationIntegration.create>>;
  let integrationB: Awaited<ReturnType<typeof prisma.organizationIntegration.create>>;
  let orderA: Awaited<ReturnType<typeof prisma.order.create>>;
  let orderB: Awaited<ReturnType<typeof prisma.order.create>>;

  before(async () => {
    organizationA = await prisma.organization.create({ data: { type: "SHOP", name: `P2 A ${suffix}`, slug: `p2-a-${suffix}` } });
    organizationB = await prisma.organization.create({ data: { type: "SHOP", name: `P2 B ${suffix}`, slug: `p2-b-${suffix}` } });
    integrationA = await prisma.organizationIntegration.create({
      data: { organizationId: organizationA.id, provider: "INOTI_USSD", status: "ACTIVE", codeName: "alpha", credentialProfileKey: "fixture-a", configuration: { paymentEnabled: true, orderStatusEnabled: true } },
    });
    integrationB = await prisma.organizationIntegration.create({
      data: { organizationId: organizationB.id, provider: "INOTI_USSD", status: "ACTIVE", codeName: "beta", credentialProfileKey: "fixture-b", configuration: { paymentEnabled: true, orderStatusEnabled: true } },
    });
    orderA = await prisma.order.create({ data: { orderNumber: `P2-A-${suffix}`, type: "PICK_UP", subtotal: 220000, total: 220000, organizationSlug: organizationA.slug, publicTrackingToken: `track-a-${suffix}`, status: "PREPARING" } });
    orderB = await prisma.order.create({ data: { orderNumber: `P2-B-${suffix}`, type: "PICK_UP", subtotal: 1000, total: 1000, organizationSlug: organizationB.slug, publicTrackingToken: `track-b-${suffix}` } });
  });

  after(async () => {
    const organizationIds = [organizationA.id, organizationB.id];
    await prisma.ussdPaymentVerificationJob.deleteMany({ where: { organizationId: { in: organizationIds } } });
    await prisma.ussdCallbackEvent.deleteMany({ where: { organizationId: { in: organizationIds } } });
    await prisma.ussdPaymentIntent.deleteMany({ where: { organizationId: { in: organizationIds } } });
    await prisma.paymentProviderAttempt.deleteMany({ where: { organizationId: { in: organizationIds } } });
    await prisma.paymentRequest.deleteMany({ where: { organizationId: { in: organizationIds } } });
    await prisma.ussdEvent.deleteMany({ where: { organizationId: { in: organizationIds } } });
    await prisma.ussdSession.deleteMany({ where: { organizationId: { in: organizationIds } } });
    await prisma.auditLog.deleteMany({ where: { organizationId: { in: organizationIds } } });
    await prisma.businessEvent.deleteMany({ where: { organizationId: { in: organizationIds } } });
    await prisma.payment.deleteMany({ where: { orderId: { in: [orderA.id, orderB.id] } } });
    await prisma.paymentEvent.deleteMany({ where: { orderId: { in: [orderA.id, orderB.id] } } });
    await prisma.order.deleteMany({ where: { id: { in: [orderA.id, orderB.id] } } });
    await prisma.organizationIntegration.deleteMany({ where: { organizationId: { in: organizationIds } } });
    await prisma.organization.deleteMany({ where: { id: { in: organizationIds } } });
    await prisma.$disconnect();
  });

  it("creates order-backed and standalone requests and rejects cross-tenant payables", async () => {
    const orderRequest = await createPaymentRequest({ organizationId: organizationA.id, orderId: orderA.id, providerIntegrationId: integrationA.id, amountToman: BigInt(220000), purpose: "ORDER_PAYMENT" });
    assert.equal(orderRequest.orderId, orderA.id);
    assert.equal(orderRequest.amountToman, BigInt(220000));
    const standalone = await createPaymentRequest({ organizationId: organizationA.id, providerIntegrationId: integrationA.id, amountToman: BigInt(1000), purpose: "PLATFORM_INVOICE" });
    assert.equal(standalone.orderId, null);
    await assert.rejects(
      createPaymentRequest({ organizationId: organizationA.id, orderId: orderB.id, providerIntegrationId: integrationA.id, amountToman: BigInt(1000), purpose: "ORDER_PAYMENT" }),
      /Order not found for organization/,
    );
  });

  it("blocks new initiation when payment is disabled while preserving existing reconciliation", async () => {
    const existingRequest = await createPaymentRequest({ organizationId: organizationA.id, providerIntegrationId: integrationA.id, amountToman: BigInt(1000), purpose: "EXISTING_RECONCILIATION" });
    const lifecycle = new InotiPaymentLifecycleService(repository, provider, credentials, () => true);
    const initiated = await lifecycle.initiate({ publicIntegrationId: integrationA.publicId, organizationId: organizationA.id, paymentRequestId: existingRequest.id, sessionId: "101", mobile: "09123456789" });
    await prisma.organizationIntegration.update({ where: { id: integrationA.id }, data: { configuration: { paymentEnabled: false, orderStatusEnabled: true } } });
    try {
      const newRequest = await createPaymentRequest({ organizationId: organizationA.id, providerIntegrationId: integrationA.id, amountToman: BigInt(1000), purpose: "DISABLED_NEW_INITIATION" });
      await assert.rejects(lifecycle.initiate({ publicIntegrationId: integrationA.publicId, organizationId: organizationA.id, paymentRequestId: newRequest.id, sessionId: "102", mobile: "09123456789" }), /disabled/);

      const workflow = new InotiUssdWorkflow(repository, provider, credentials, async () => undefined, () => true, () => true);
      provider.mode = "SUCCESS";
      await workflow.handle(integrationA.publicId, null, new URL(callbackUrl(integrationA.publicId, { codeName: "alpha", sessionId: "101", factor: initiated.merchantFactorId })).searchParams);
      assert.equal((await prisma.paymentRequest.findUniqueOrThrow({ where: { id: existingRequest.id } })).status, "PAID");
    } finally {
      await prisma.organizationIntegration.update({ where: { id: integrationA.id }, data: { configuration: { paymentEnabled: true, orderStatusEnabled: true } } });
    }
  });

  it("initiates standalone payment idempotently with exact Toman-to-Rial payload", async () => {
    const request = await createPaymentRequest({ organizationId: organizationA.id, providerIntegrationId: integrationA.id, amountToman: BigInt(220000), purpose: "PLATFORM_INVOICE" });
    const lifecycle = new InotiPaymentLifecycleService(repository, provider, credentials, () => true);
    const input = { publicIntegrationId: integrationA.publicId, organizationId: organizationA.id, paymentRequestId: request.id, sessionId: "202", mobile: "09123456789" };
    const first = await lifecycle.initiate(input);
    const repeated = await lifecycle.initiate(input);
    assert.equal(first.payload, `9900|${first.merchantFactorId}|2200000`);
    assert.equal(repeated.providerAttemptId, first.providerAttemptId);
    assert.equal(await prisma.paymentProviderAttempt.count({ where: { paymentRequestId: request.id } }), 1);
  });

  it("runs actual callback HTTP handler and settles order financial state exactly once", async () => {
    provider.mode = "SUCCESS";
    provider.calls = 0;
    const workflow = new InotiUssdWorkflow(repository, provider, credentials, async () => undefined, () => true, () => true);
    const start = new URLSearchParams({ mobile: "09123456789", sessionid: "303", call: `6655*alpha*2*${orderA.publicTrackingToken}` });
    const payload = await workflow.handle(integrationA.publicId, null, start);
    const [, factor, amount] = payload.split("|");
    assert.equal(amount, "2200000");
    const handler = createInotiUssdCallbackHandler(workflow, async () => undefined);
    const url = callbackUrl(integrationA.publicId, { codeName: "alpha", sessionId: "303", factor });
    const firstResponse = await handler(new Request(url), { params: Promise.resolve({ publicIntegrationId: integrationA.publicId }) });
    assert.equal(await firstResponse.text(), "پرداخت تایید شد");
    await Promise.all(Array.from({ length: 10 }, () => handler(new Request(url), { params: Promise.resolve({ publicIntegrationId: integrationA.publicId }) })));

    const request = await prisma.paymentRequest.findFirstOrThrow({ where: { orderId: orderA.id, attempts: { some: {} } }, orderBy: { createdAt: "desc" } });
    const attempt = await prisma.paymentProviderAttempt.findFirstOrThrow({ where: { paymentRequestId: request.id } });
    const intent = await prisma.ussdPaymentIntent.findFirstOrThrow({ where: { paymentRequestId: request.id } });
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderA.id } });
    assert.equal(request.status, "PAID");
    assert.equal(attempt.status, "VERIFIED");
    assert.equal(order.paymentStatus, "COMPLETED");
    assert.equal(order.status, "PREPARING");
    assert.equal(await prisma.paymentEvent.count({ where: { orderId: orderA.id, newStatus: "COMPLETED" } }), 1);
    assert.equal(await prisma.auditLog.count({ where: { organizationId: organizationA.id, entityId: intent.id, description: "iNoti USSD payment verified and settled" } }), 1);
    assert.equal(provider.calls, 1);
  });

  it("persists encrypted callback correlation and settles from fresh bounded workers after retry and lease recovery", async () => {
    const priorVersion = process.env.INOTI_PAYMENT_CORRELATION_ACTIVE_KEY_VERSION;
    const priorKey = process.env.INOTI_PAYMENT_CORRELATION_KEY_V91;
    process.env.INOTI_PAYMENT_CORRELATION_ACTIVE_KEY_VERSION = "91";
    process.env.INOTI_PAYMENT_CORRELATION_KEY_V91 = Buffer.alloc(32, 91).toString("base64");
    try {
      const request = await createPaymentRequest({ organizationId: organizationA.id, providerIntegrationId: integrationA.id, amountToman: BigInt(9000), purpose: "DURABLE_E2E" });
      const lifecycle = new InotiPaymentLifecycleService(repository, provider, credentials, () => true);
      const initiated = await lifecycle.initiate({ publicIntegrationId: integrationA.publicId, organizationId: organizationA.id, paymentRequestId: request.id, sessionId: "808", mobile: "09123456789" });
      const workflow = new InotiUssdWorkflow(repository, provider, credentials, async () => undefined, () => true, () => true);
      const url = new URL(callbackUrl(integrationA.publicId, {
        codeName: "alpha",
        sessionId: "808",
        factor: initiated.merchantFactorId,
        providerFactor: "provider-durable-808",
        rrn: "rrn-durable-808",
      }));
      const acknowledged = await workflow.handle(integrationA.publicId, null, url.searchParams);
      assert.equal(acknowledged, "پرداخت در حال بررسی است");
      await Promise.all(Array.from({ length: 9 }, () => workflow.handle(integrationA.publicId, null, url.searchParams)));

      const intent = await prisma.ussdPaymentIntent.findUniqueOrThrow({ where: { paymentRequestId_organizationId: { paymentRequestId: request.id, organizationId: organizationA.id } } });
      const job = await prisma.ussdPaymentVerificationJob.findUniqueOrThrow({ where: { paymentIntentId: intent.id } });
      assert.equal(await prisma.ussdPaymentVerificationJob.count({ where: { paymentIntentId: intent.id } }), 1);
      assert.equal(JSON.stringify(job.encryptedCorrelation).includes("09123456789"), false);

      const firstWorker = new FixtureProvider();
      firstWorker.mode = "NOT_FOUND";
      const startedAt = new Date(Date.now() + 60_000);
      const first = await processDuePaymentVerifications({ provider: firstWorker, settlementAllowed: () => true, now: startedAt });
      assert.equal(first.retried, 1);
      const retry = await prisma.ussdPaymentVerificationJob.findUniqueOrThrow({ where: { id: job.id } });
      assert.equal(retry.status, "RETRY");
      assert.equal(retry.attemptCount, 1);

      await prisma.ussdPaymentVerificationJob.update({
        where: { id: job.id },
        data: { status: "CLAIMED", leaseToken: "crashed-worker", leaseExpiresAt: new Date(startedAt.getTime() + 120_000), nextAttemptAt: startedAt },
      });
      const blockedByLease = await processDuePaymentVerifications({ provider: new FixtureProvider(), settlementAllowed: () => true, now: new Date(startedAt.getTime() + 31_000) });
      assert.equal(blockedByLease.claimed, 0);
      await prisma.ussdPaymentVerificationJob.update({ where: { id: job.id }, data: { leaseExpiresAt: new Date(startedAt.getTime() + 30_000) } });

      const recoveredProvider = new FixtureProvider();
      const concurrent = await Promise.all([
        processDuePaymentVerifications({ provider: recoveredProvider, settlementAllowed: () => true, now: new Date(startedAt.getTime() + 31_000) }),
        processDuePaymentVerifications({ provider: recoveredProvider, settlementAllowed: () => true, now: new Date(startedAt.getTime() + 31_000) }),
      ]);
      assert.equal(concurrent.reduce((sum, result) => sum + result.succeeded, 0), 1);
      assert.equal(recoveredProvider.calls, 1);
      const completed = await prisma.ussdPaymentVerificationJob.findUniqueOrThrow({ where: { id: job.id } });
      assert.equal(completed.status, "SUCCEEDED");
      assert.equal(completed.encryptedCorrelation, null);
      assert.ok(completed.correlationRetiredAt);
      assert.equal((await prisma.paymentRequest.findUniqueOrThrow({ where: { id: request.id } })).status, "PAID");
      assert.equal((await prisma.paymentProviderAttempt.findUniqueOrThrow({ where: { id: initiated.providerAttemptId } })).status, "VERIFIED");
      assert.equal(await prisma.ussdCallbackEvent.count({ where: { paymentIntentId: intent.id, idempotencyKey: `settlement:durable:${job.id}` } }), 1);
    } finally {
      if (priorVersion === undefined) delete process.env.INOTI_PAYMENT_CORRELATION_ACTIVE_KEY_VERSION;
      else process.env.INOTI_PAYMENT_CORRELATION_ACTIVE_KEY_VERSION = priorVersion;
      if (priorKey === undefined) delete process.env.INOTI_PAYMENT_CORRELATION_KEY_V91;
      else process.env.INOTI_PAYMENT_CORRELATION_KEY_V91 = priorKey;
    }
  });

  it("recovers from temporary not-found and timeout without terminal failure", async () => {
    for (const mode of ["NOT_FOUND", "TIMEOUT"] as const) {
      const request = await createPaymentRequest({ organizationId: organizationA.id, providerIntegrationId: integrationA.id, amountToman: BigInt(1000), purpose: `RECOVERY_${mode}` });
      const lifecycle = new InotiPaymentLifecycleService(repository, provider, credentials, () => true);
      const initiated = await lifecycle.initiate({ publicIntegrationId: integrationA.publicId, organizationId: organizationA.id, paymentRequestId: request.id, sessionId: mode === "NOT_FOUND" ? "404" : "405", mobile: "09123456789" });
      const workflow = new InotiUssdWorkflow(repository, provider, credentials, async () => undefined, () => true, () => true);
      const handler = createInotiUssdCallbackHandler(workflow, async () => undefined);
      const url = callbackUrl(integrationA.publicId, { codeName: "alpha", sessionId: mode === "NOT_FOUND" ? "404" : "405", factor: initiated.merchantFactorId, providerFactor: `provider-${mode}`, rrn: `rrn-${mode}` });
      provider.mode = mode;
      await handler(new Request(url), { params: Promise.resolve({ publicIntegrationId: integrationA.publicId }) });
      assert.equal((await prisma.paymentRequest.findUniqueOrThrow({ where: { id: request.id } })).status, "PENDING_VERIFICATION");
      provider.mode = "SUCCESS";
      const response = await handler(new Request(url), { params: Promise.resolve({ publicIntegrationId: integrationA.publicId }) });
      assert.equal(await response.text(), "پرداخت تایید شد");
      assert.equal((await prisma.paymentRequest.findUniqueOrThrow({ where: { id: request.id } })).status, "PAID");
    }
  });

  it("settles a standalone request without mutating an order", async () => {
    const request = await createPaymentRequest({ organizationId: organizationA.id, providerIntegrationId: integrationA.id, amountToman: BigInt(5000), purpose: "STANDALONE_E2E" });
    const lifecycle = new InotiPaymentLifecycleService(repository, provider, credentials, () => true);
    const initiated = await lifecycle.initiate({ publicIntegrationId: integrationA.publicId, organizationId: organizationA.id, paymentRequestId: request.id, sessionId: "505", mobile: "09123456789" });
    const workflow = new InotiUssdWorkflow(repository, provider, credentials, async () => undefined, () => true, () => true);
    const handler = createInotiUssdCallbackHandler(workflow, async () => undefined);
    provider.mode = "SUCCESS";
    const response = await handler(new Request(callbackUrl(integrationA.publicId, { codeName: "alpha", sessionId: "505", factor: initiated.merchantFactorId })), { params: Promise.resolve({ publicIntegrationId: integrationA.publicId }) });
    assert.equal(await response.text(), "پرداخت تایید شد");
    const settled = await prisma.paymentRequest.findUniqueOrThrow({ where: { id: request.id } });
    assert.equal(settled.status, "PAID");
    assert.equal(settled.orderId, null);
  });

  it("preserves terminal requests and records verified late-payment reconciliation evidence", async () => {
    for (const status of ["EXPIRED", "CANCELLED"] as const) {
      const request = await createPaymentRequest({ organizationId: organizationA.id, providerIntegrationId: integrationA.id, amountToman: BigInt(7000), purpose: `LATE_${status}` });
      const lifecycle = new InotiPaymentLifecycleService(repository, provider, credentials, () => true);
      const sessionId = status === "EXPIRED" ? "606" : "607";
      const initiated = await lifecycle.initiate({ publicIntegrationId: integrationA.publicId, organizationId: organizationA.id, paymentRequestId: request.id, sessionId, mobile: "09123456789" });
      await prisma.paymentRequest.update({ where: { id: request.id }, data: { status } });
      const workflow = new InotiUssdWorkflow(repository, provider, credentials, async () => undefined, () => true, () => true);
      provider.mode = "SUCCESS";
      await workflow.handle(integrationA.publicId, null, new URL(callbackUrl(integrationA.publicId, { codeName: "alpha", sessionId, factor: initiated.merchantFactorId })).searchParams);
      assert.equal((await prisma.paymentRequest.findUniqueOrThrow({ where: { id: request.id } })).status, status);
      const attempt = await prisma.paymentProviderAttempt.findFirstOrThrow({ where: { paymentRequestId: request.id } });
      assert.equal(attempt.status, "VERIFIED");
      assert.match(JSON.stringify(attempt.verificationEvidence), /reconciliationRequired/);
      provider.mode = "TIMEOUT";
      await workflow.handle(integrationA.publicId, null, new URL(callbackUrl(integrationA.publicId, { codeName: "alpha", sessionId, factor: initiated.merchantFactorId })).searchParams);
      assert.equal((await prisma.paymentProviderAttempt.findFirstOrThrow({ where: { paymentRequestId: request.id } })).status, "VERIFIED");
    }
  });

  it("rejects a copied Organization A transaction through Organization B callback", async () => {
    const request = await createPaymentRequest({ organizationId: organizationA.id, providerIntegrationId: integrationA.id, amountToman: BigInt(8000), purpose: "TENANT_ISOLATION" });
    const lifecycle = new InotiPaymentLifecycleService(repository, provider, credentials, () => true);
    const initiated = await lifecycle.initiate({ publicIntegrationId: integrationA.publicId, organizationId: organizationA.id, paymentRequestId: request.id, sessionId: "707", mobile: "09123456789" });
    const workflow = new InotiUssdWorkflow(repository, provider, credentials, async () => undefined, () => true, () => true);
    const result = await workflow.handle(integrationB.publicId, null, new URL(callbackUrl(integrationB.publicId, { codeName: "beta", sessionId: "707", factor: initiated.merchantFactorId })).searchParams);
    assert.equal(result, "تایید پرداخت ناموفق بود");
    assert.equal((await prisma.paymentRequest.findUniqueOrThrow({ where: { id: request.id } })).status, "AWAITING_CUSTOMER");
  });
});
