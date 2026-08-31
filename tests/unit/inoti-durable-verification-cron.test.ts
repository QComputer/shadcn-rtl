import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  createDurablePaymentVerificationCronHandler,
  DURABLE_PAYMENT_CRON_BATCH_LIMIT,
} from "@/lib/integrations/inoti-ussd/durable-verification-cron";

const originalEnv = {
  cronSecret: process.env.CRON_SECRET,
  workerSecret: process.env.INOTI_PAYMENT_WORKER_SECRET,
  workerEnabled: process.env.INOTI_PAYMENT_RECONCILIATION_WORKER_ENABLED,
};

afterEach(() => {
  for (const [key, value] of [
    ["CRON_SECRET", originalEnv.cronSecret],
    ["INOTI_PAYMENT_WORKER_SECRET", originalEnv.workerSecret],
    ["INOTI_PAYMENT_RECONCILIATION_WORKER_ENABLED", originalEnv.workerEnabled],
  ] as const) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function cronRequest(secret?: string) {
  return new Request("https://bazarbaaz.ir/api/internal/payments/inoti-verification", {
    headers: secret ? { authorization: `Bearer ${secret}` } : undefined,
  });
}

function summary() {
  return { claimed: 1, succeeded: 0, retried: 1, manualReview: 0, exhausted: 0 };
}

describe("durable payment verification cron adapter", () => {
  it("fails closed for unauthenticated and incorrectly authenticated invocations", async () => {
    process.env.CRON_SECRET = "cron-test-secret";
    const handler = createDurablePaymentVerificationCronHandler({
      processDuePaymentVerifications: async () => summary(),
    });

    assert.equal((await handler(cronRequest())).status, 401);
    assert.equal((await handler(cronRequest("wrong-secret"))).status, 401);
  });

  it("returns an authenticated success no-op with zero worker/provider/payment activity while disabled", async () => {
    process.env.CRON_SECRET = "cron-test-secret";
    process.env.INOTI_PAYMENT_RECONCILIATION_WORKER_ENABLED = "false";
    let workerCalls = 0;
    const handler = createDurablePaymentVerificationCronHandler({
      processDuePaymentVerifications: async () => {
        workerCalls += 1;
        return summary();
      },
    });

    for (let invocation = 0; invocation < 2; invocation += 1) {
      const response = await handler(cronRequest("cron-test-secret"));
      const body = await response.json();
      assert.equal(response.status, 200);
      assert.deepEqual(body, {
        ok: true,
        worker: "durable-payment-verification",
        status: "SKIPPED",
        executionEnabled: false,
        providerCalls: 0,
        paymentMutations: 0,
      });
    }
    assert.equal(workerCalls, 0);
  });

  it("delegates enabled invocations to the shared bounded durable worker", async () => {
    process.env.CRON_SECRET = "cron-test-secret";
    process.env.INOTI_PAYMENT_RECONCILIATION_WORKER_ENABLED = "true";
    const limits: number[] = [];
    const handler = createDurablePaymentVerificationCronHandler({
      processDuePaymentVerifications: async ({ limit }) => {
        limits.push(limit);
        return summary();
      },
    });

    const response = await handler(cronRequest("cron-test-secret"));
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.status, "PROCESSED");
    assert.deepEqual(limits, [DURABLE_PAYMENT_CRON_BATCH_LIMIT]);
    assert.equal(DURABLE_PAYMENT_CRON_BATCH_LIMIT, 10);
  });

  it("returns a controlled non-sensitive failure when the shared worker throws", async () => {
    process.env.CRON_SECRET = "cron-test-secret";
    process.env.INOTI_PAYMENT_RECONCILIATION_WORKER_ENABLED = "true";
    const previousConsoleError = console.error;
    console.error = () => undefined;
    try {
      const handler = createDurablePaymentVerificationCronHandler({
        processDuePaymentVerifications: async () => {
          throw new Error("provider-secret-sensitive-value");
        },
      });
      const response = await handler(cronRequest("cron-test-secret"));
      const text = await response.text();
      assert.equal(response.status, 503);
      assert.equal(text.includes("provider-secret-sensitive-value"), false);
      assert.deepEqual(JSON.parse(text), { ok: false, error: "Worker unavailable" });
    } finally {
      console.error = previousConsoleError;
    }
  });
});
