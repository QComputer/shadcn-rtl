import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { InotiUssdWorkflow } from "@/lib/integrations/inoti-ussd/workflow";
import { tomanToInotiRial } from "@/lib/integrations/inoti-ussd/currency";
import type { ResolvedInotiIntegration, UssdIntegrationRepository, UssdProvider, InotiCredentialProfile } from "@/lib/integrations/inoti-ussd/types";

const integrationA: ResolvedInotiIntegration = {
  id: "integration-a",
  publicId: "11111111-1111-4111-8111-111111111111",
  organizationId: "tenant-a",
  organizationSlug: "tenant-a",
  status: "ACTIVE",
  codeName: "alpha",
  credentialProfileKey: "INOTI_DEFAULT",
  callbackOrigin: null,
  config: { orderStatusEnabled: true, paymentEnabled: true },
};

const factor = `BZ${"a".repeat(32)}`;

class FakeRepository implements UssdIntegrationRepository {
  integrations = new Map([[integrationA.publicId, integrationA]]);
  orders = new Map([[`${integrationA.id}:track-a`, { id: "order-a", orderNumber: "ORDER-A", publicTrackingToken: "track-a", status: "PREPARING", paymentStatus: "PENDING", paymentMethod: null, totalToman: "1250", customerId: "customer-a", guestCustomerId: null, guestPhone: null, organizationId: "tenant-a" }]]);
  intents = new Map<string, any>();
  events: Array<{ outcome: string; errorCode?: string | null }> = [];
  settlementKeys = new Set<string>();
  notificationMarks = 0;
  verificationFailures: Array<{ reason: string; retryable: boolean }> = [];

  async resolveIntegration(publicId: string) { return this.integrations.get(publicId) ?? null; }
  async touchIntegration() {}
  async touchUssdSession(input: { integrationId: string; sessionIdHash: string; lastAction: string; status?: string }) { void input; }
  async findUssdSession(_integrationId: string, _sessionIdHash: string) { return null; }
  async recordUssdEvent(input: { sessionIdHash: string; eventType: string; metadata?: unknown }) {
    this.events.push({ outcome: input.eventType, errorCode: input.metadata ? JSON.stringify(input.metadata) : null });
  }
  async findOrderByTrackingToken(integration: ResolvedInotiIntegration, token: string) {
    return this.orders.get(`${integration.id}:${token}`) ?? null;
  }
  async createOrGetPaymentIntent(input: any) {
    const key = `${input.integration.id}:${input.order.id}:${input.sessionIdHash}`;
    const existing = this.intents.get(key);
    if (existing) return existing;
    const intent = {
      id: `intent-${this.intents.size + 1}`,
      organizationId: input.integration.organizationId,
      integrationId: input.integration.id,
      orderId: input.order.id,
      paymentRequestId: null,
      providerAttemptId: null,
      merchantFactorId: factor,
      amountRial: tomanToInotiRial(input.amountToman),
      sessionIdHash: input.sessionIdHash,
      mobileHash: input.mobileHash,
      mobileMasked: input.mobileMasked,
      status: "REQUESTED",
      providerFactorId: null,
      rrn: null,
    };
    this.intents.set(key, intent);
    return intent;
  }
  async findPaymentIntent(integrationId: string, merchantFactorId: string) {
    return [...this.intents.values()].find((intent) => intent.integrationId === integrationId && intent.merchantFactorId === merchantFactorId) ?? null;
  }
  async recordCallbackEvent(input: any) {
    this.events.push({ outcome: input.outcome, errorCode: input.errorCode });
  }
  async markPaymentVerificationStarted() {}
  async markPaymentVerificationFailed(input: { reason: string; retryable: boolean }) {
    this.verificationFailures.push(input);
  }
  async settleVerifiedPayment(input: any) {
    if (this.settlementKeys.has(input.idempotencyKey) || input.intent.status === "SETTLED") {
      return { kind: "DUPLICATE" as const, notification: null };
    }
    this.settlementKeys.add(input.idempotencyKey);
    input.intent.status = "SETTLED";
    input.intent.providerFactorId = input.providerFactorId;
    input.intent.rrn = input.rrn;
    return {
      kind: "SETTLED" as const,
      notification: {
        intentId: input.intent.id,
        organizationId: input.integration.organizationId,
        orderId: input.intent.orderId,
        orderNumber: "ORDER-A",
        previousStatus: "PENDING",
        customerId: "customer-a",
        guestCustomerId: null,
        guestPhone: null,
      },
    };
  }
  async markNotificationAttempted() { this.notificationMarks += 1; }
}

class FakeProvider implements UssdProvider {
  ready = true;
  mode: "SUCCESS" | "TIMEOUT" | "MALFORMED" | "NOT_FOUND" = "SUCCESS";
  overrides: any = {};
  calls = 0;
  getReadiness(profile: InotiCredentialProfile | null) {
    void profile;
    return this.ready
      ? { ready: true, transportSecure: true, code: "READY" as const }
      : { ready: false, transportSecure: true, code: "CONFIG_DISABLED" as const };
  }
  async verifyPayment(profile: InotiCredentialProfile | null, query: any) {
    void profile;
    this.calls += 1;
    if (this.mode === "TIMEOUT") return { ok: false as const, code: "TIMEOUT" as const };
    if (this.mode === "MALFORMED") return { ok: false as const, code: "MALFORMED_RESPONSE" as const };
    if (this.mode === "NOT_FOUND") return { ok: false as const, code: "NOT_FOUND" as const };
    return {
      ok: true as const,
      record: {
        sessionId: query.sessionId,
        mobile: query.mobile,
        amountRial: query.amountRial,
        merchantFactorId: query.merchantFactorId,
        providerFactorId: query.providerFactorId,
        rrn: query.rrn,
        result: "true",
        successful: true,
        ...this.overrides,
      },
    };
  }
  async activeLinesReadOnly(profile: InotiCredentialProfile | null) {
    void profile;
    return { state: "SMS_READ_ONLY_VERIFIED" as const, errorCode: null };
  }
  async probeReadOnlyPayments(input: any) {
    void input;
    return { ok: true as const, code: "VERIFIED_READ_ONLY" as const };
  }
}

class FakeCredentialProvider {
  async resolveProfile(): Promise<InotiCredentialProfile | null> {
    return {
      organizationId: "_organizationId",
      profileKey: "INOTI_DEFAULT",
      username: "x",
      password: "y",
      endpoint: "https://login.inoti.com/_services/ExternalUssdPay.asmx",
    };
  }
}

function query(call: string, extras: Record<string, string> = {}) {
  return new URLSearchParams({ mobile: "09123456789", sessionid: "123456", call, ...extras });
}

describe("iNoti callback activation preparation", () => {
  it("rejects settlement when live payments are disabled even after provider verification", async () => {
    const repository = new FakeRepository();
    const provider = new FakeProvider();
    const workflow = new InotiUssdWorkflow(repository, provider, new FakeCredentialProvider(), async () => undefined);
    const sessionId = "123e4567-e89b-12d3-a456-426614174000";

    await workflow.handle(integrationA.publicId, null, query("6655*alpha*2*track-a", { sessionid: sessionId }));
    const callback = query(`6655*alpha*2*track-a*${factor}*provider1`, {
      RRN: "rrn1",
      sessionid: sessionId.toUpperCase(),
    });

    const original = process.env.INOTI_ALLOW_LIVE_PAYMENTS;
    const originalRuntime = process.env.INOTI_RUNTIME_MUTATIONS_APPROVED;
    process.env.INOTI_ALLOW_LIVE_PAYMENTS = "false";
    process.env.INOTI_RUNTIME_MUTATIONS_APPROVED = "false";

    try {
      const result = await workflow.handle(integrationA.publicId, null, callback);
      assert.equal(result, "تایید پرداخت ناموفق بود");
      assert.equal(repository.settlementKeys.size, 0);
      assert.equal(provider.calls, 1);
      const rejectedEvents = repository.events.filter((e) => e.outcome === "REJECTED" && e.errorCode === "PAYMENT_SETTLEMENT_DISABLED");
      assert.equal(rejectedEvents.length, 1);
    } finally {
      process.env.INOTI_ALLOW_LIVE_PAYMENTS = original;
      process.env.INOTI_RUNTIME_MUTATIONS_APPROVED = originalRuntime;
    }
  });

  it("settles when live payments are enabled after provider verification", async () => {
    const repository = new FakeRepository();
    const provider = new FakeProvider();
    const workflow = new InotiUssdWorkflow(repository, provider, new FakeCredentialProvider(), async () => undefined);

    await workflow.handle(integrationA.publicId, null, query("6655*alpha*2*track-a"));
    const callback = query(`6655*alpha*2*track-a*${factor}*provider1`, { RRN: "rrn1" });

    const original = process.env.INOTI_ALLOW_LIVE_PAYMENTS;
    const originalRuntime = process.env.INOTI_RUNTIME_MUTATIONS_APPROVED;
    process.env.INOTI_ALLOW_LIVE_PAYMENTS = "true";
    process.env.INOTI_RUNTIME_MUTATIONS_APPROVED = "true";

    try {
      const result = await workflow.handle(integrationA.publicId, null, callback);
      assert.equal(result, "پرداخت تایید شد");
      assert.equal(repository.settlementKeys.size, 1);
    } finally {
      process.env.INOTI_ALLOW_LIVE_PAYMENTS = original;
      process.env.INOTI_RUNTIME_MUTATIONS_APPROVED = originalRuntime;
    }
  });

  it("rejects malformed callback parameters without leaking secrets", async () => {
    const repository = new FakeRepository();
    const workflow = new InotiUssdWorkflow(repository, new FakeProvider(), new FakeCredentialProvider(), async () => undefined);

    // RRN without a prior payment intent goes to payment callback and fails closed
    const withRrn = query("6655*alpha", { RRN: "rrn1" });
    let result = await workflow.handle(integrationA.publicId, null, withRrn);
    assert.equal(result, "تایید پرداخت ناموفق بود");
    assert.equal(repository.settlementKeys.size, 0);

    // Invalid mobile is rejected by parser
    const invalidMobile = query("6655*alpha*2*track-a", { mobile: "invalid" });
    result = await workflow.handle(integrationA.publicId, null, invalidMobile);
    assert.equal(result, "درخواست نامعتبر است");
    assert.equal(repository.settlementKeys.size, 0);

    // Invalid sessionid is rejected by parser
    const invalidSession = query("6655*alpha*2*track-a", { sessionid: "invalid" });
    result = await workflow.handle(integrationA.publicId, null, invalidSession);
    assert.equal(result, "درخواست نامعتبر است");
    assert.equal(repository.settlementKeys.size, 0);
  });

  it("enforces tenant isolation on callback resolution", async () => {
    const repository = new FakeRepository();
    const workflow = new InotiUssdWorkflow(repository, new FakeProvider(), new FakeCredentialProvider(), async () => undefined);

    const result = await workflow.handle(integrationA.publicId, null, query("6655*alpha*2*track-b"));
    assert.equal(result, "سفارش یافت نشد");
    assert.equal(repository.settlementKeys.size, 0);
  });

  it("does not settle payment from callback/RRN alone without provider verification", async () => {
    const repository = new FakeRepository();
    const provider = new FakeProvider();
    const workflow = new InotiUssdWorkflow(repository, provider, new FakeCredentialProvider(), async () => undefined);

    await workflow.handle(integrationA.publicId, null, query("6655*alpha*2*track-a"));
    const callback = query(`6655*alpha*2*track-a*${factor}*provider1`, { RRN: "rrn1" });

    provider.mode = "NOT_FOUND";
    const original = process.env.INOTI_ALLOW_LIVE_PAYMENTS;
    const originalRuntime = process.env.INOTI_RUNTIME_MUTATIONS_APPROVED;
    process.env.INOTI_ALLOW_LIVE_PAYMENTS = "true";
    process.env.INOTI_RUNTIME_MUTATIONS_APPROVED = "true";

    try {
      const result = await workflow.handle(integrationA.publicId, null, callback);
      assert.equal(result, "تایید پرداخت ناموفق بود");
      assert.equal(repository.settlementKeys.size, 0);
      assert.equal(repository.verificationFailures.length, 1);
      assert.equal(repository.verificationFailures[0]?.reason, "PROVIDER_NOT_FOUND");
      assert.equal(repository.verificationFailures[0]?.retryable, true);
    } finally {
      process.env.INOTI_ALLOW_LIVE_PAYMENTS = original;
      process.env.INOTI_RUNTIME_MUTATIONS_APPROVED = originalRuntime;
    }
  });

  it("preserves idempotency when the same callback arrives twice", async () => {
    const repository = new FakeRepository();
    const provider = new FakeProvider();
    const workflow = new InotiUssdWorkflow(repository, provider, new FakeCredentialProvider(), async () => undefined);

    await workflow.handle(integrationA.publicId, null, query("6655*alpha*2*track-a"));
    const callback = query(`6655*alpha*2*track-a*${factor}*provider1`, { RRN: "rrn1" });

    const original = process.env.INOTI_ALLOW_LIVE_PAYMENTS;
    const originalRuntime = process.env.INOTI_RUNTIME_MUTATIONS_APPROVED;
    process.env.INOTI_ALLOW_LIVE_PAYMENTS = "true";
    process.env.INOTI_RUNTIME_MUTATIONS_APPROVED = "true";

    try {
      const first = await workflow.handle(integrationA.publicId, null, callback);
      assert.equal(first, "پرداخت تایید شد");
      assert.equal(repository.settlementKeys.size, 1);

      const second = await workflow.handle(integrationA.publicId, null, callback);
      assert.equal(second, "پرداخت تایید شد");
      assert.equal(repository.settlementKeys.size, 1);
      assert.equal(provider.calls, 1);
    } finally {
      process.env.INOTI_ALLOW_LIVE_PAYMENTS = original;
      process.env.INOTI_RUNTIME_MUTATIONS_APPROVED = originalRuntime;
    }
  });

  it("rejects callback when provider amount does not match intent amount", async () => {
    const repository = new FakeRepository();
    const provider = new FakeProvider();
    provider.overrides = { amountRial: BigInt(9999) };
    const workflow = new InotiUssdWorkflow(repository, provider, new FakeCredentialProvider(), async () => undefined);

    await workflow.handle(integrationA.publicId, null, query("6655*alpha*2*track-a"));
    const callback = query(`6655*alpha*2*track-a*${factor}*provider1`, { RRN: "rrn1" });

    const original = process.env.INOTI_ALLOW_LIVE_PAYMENTS;
    const originalRuntime = process.env.INOTI_RUNTIME_MUTATIONS_APPROVED;
    process.env.INOTI_ALLOW_LIVE_PAYMENTS = "true";
    process.env.INOTI_RUNTIME_MUTATIONS_APPROVED = "true";

    try {
      const result = await workflow.handle(integrationA.publicId, null, callback);
      assert.equal(result, "تایید پرداخت ناموفق بود");
      assert.equal(repository.settlementKeys.size, 0);
      assert.equal(repository.verificationFailures.length, 1);
      assert.equal(repository.verificationFailures[0]?.retryable, false);
    } finally {
      process.env.INOTI_ALLOW_LIVE_PAYMENTS = original;
      process.env.INOTI_RUNTIME_MUTATIONS_APPROVED = originalRuntime;
    }
  });

  it("rejects cross-tenant callback resolution", async () => {
    const repository = new FakeRepository();
    const workflow = new InotiUssdWorkflow(repository, new FakeProvider(), new FakeCredentialProvider(), async () => undefined);

    const crossTenantIntegration: ResolvedInotiIntegration = {
      ...integrationA,
      id: "integration-b",
      publicId: "22222222-2222-4222-8222-222222222222",
      organizationId: "tenant-b",
      organizationSlug: "tenant-b",
      codeName: "beta",
    };
    repository.integrations.set(crossTenantIntegration.publicId, crossTenantIntegration);

    const result = await workflow.handle(crossTenantIntegration.publicId, null, query("6655*beta*2*track-a"));
    assert.equal(result, "سفارش یافت نشد");
    assert.equal(repository.settlementKeys.size, 0);
  });
});
