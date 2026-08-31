import "server-only";

import { timingSafeEqual } from "node:crypto";

const WORKER_NAME = "durable-payment-verification";
export const DURABLE_PAYMENT_CRON_BATCH_LIMIT = 10;

type DurableVerificationSummary = {
  claimed: number;
  succeeded: number;
  retried: number;
  manualReview: number;
  exhausted: number;
};

type DurableVerificationCronDependencies = {
  processDuePaymentVerifications: (input: { limit: number }) => Promise<DurableVerificationSummary>;
};

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function configuredSecret() {
  return process.env.CRON_SECRET || process.env.INOTI_PAYMENT_WORKER_SECRET || "";
}

function sameSecret(actual: string | null, expected: string) {
  const left = Buffer.from(actual ?? "", "utf8");
  const right = Buffer.from(expected, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

function authorized(request: Request) {
  const secret = configuredSecret();
  if (!secret) return false;
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  return sameSecret(bearer, secret);
}

export function durablePaymentCronExecutionEnabled() {
  return process.env.INOTI_PAYMENT_RECONCILIATION_WORKER_ENABLED === "true";
}

export function createDurablePaymentVerificationCronHandler(dependencies: DurableVerificationCronDependencies) {
  return async function durablePaymentVerificationCron(request: Request) {
    if (!authorized(request)) return json({ ok: false, error: "Unauthorized" }, 401);

    if (!durablePaymentCronExecutionEnabled()) {
      return json({
        ok: true,
        worker: WORKER_NAME,
        status: "SKIPPED",
        executionEnabled: false,
        providerCalls: 0,
        paymentMutations: 0,
      });
    }

    try {
      const summary = await dependencies.processDuePaymentVerifications({ limit: DURABLE_PAYMENT_CRON_BATCH_LIMIT });
      return json({
        ok: true,
        worker: WORKER_NAME,
        status: "PROCESSED",
        executionEnabled: true,
        summary,
      });
    } catch {
      console.error("Durable payment verification cron invocation failed");
      return json({ ok: false, error: "Worker unavailable" }, 503);
    }
  };
}
