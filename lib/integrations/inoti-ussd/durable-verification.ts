import "server-only";

import { randomUUID } from "node:crypto";
import { Prisma, type UssdPaymentVerificationJobStatus } from "@prisma/client";
import prisma from "@/lib/db";
import { customerOrderLifecycleRouter } from "@/lib/notifications/customer-order-lifecycle-router";
import { environmentInotiCredentialProvider } from "@/lib/integrations/inoti-ussd/credentials";
import {
  correlationFingerprint,
  correlationKeyReadiness,
  decryptPaymentCorrelation,
  encryptPaymentCorrelation,
  type CorrelationEnvelope,
  type DurablePaymentCorrelation,
} from "@/lib/integrations/inoti-ussd/correlation-envelope";
import { hashInotiEvidence } from "@/lib/integrations/inoti-ussd/evidence";
import { inotiUssdProvider } from "@/lib/integrations/inoti-ussd/inoti-provider";
import { prismaUssdIntegrationRepository } from "@/lib/integrations/inoti-ussd/repository";
import type { InotiVerificationResult, ResolvedInotiIntegration, UssdProvider } from "@/lib/integrations/inoti-ussd/types";
import { inotiLivePaymentsAllowed } from "@/lib/integrations/inoti-runtime-safety";
import { durableRetryDecision } from "@/lib/integrations/inoti-ussd/durable-retry-policy";

const LEASE_MS = 60_000;

export async function scheduleDurablePaymentVerification(input: {
  organizationId: string;
  integrationId: string;
  paymentIntentId: string;
  providerAttemptId: string | null;
  correlation: DurablePaymentCorrelation;
  now?: Date;
}): Promise<{ kind: "CREATED" | "DUPLICATE" | "CONFLICT"; jobId: string }> {
  const fingerprint = correlationFingerprint(input.correlation);
  const context = {
    organizationId: input.organizationId,
    integrationId: input.integrationId,
    paymentIntentId: input.paymentIntentId,
  };
  const envelope = encryptPaymentCorrelation(input.correlation, context);
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.ussdPaymentVerificationJob.findUnique({ where: { paymentIntentId: input.paymentIntentId } });
      if (existing) {
        let matches = existing.correlationFingerprint === fingerprint;
        if (!matches && existing.encryptedCorrelation) {
          try {
            matches = JSON.stringify(decryptPaymentCorrelation(existing.encryptedCorrelation as unknown as CorrelationEnvelope, context)) === JSON.stringify(input.correlation);
          } catch {
            matches = false;
          }
        }
        if (matches) return { kind: "DUPLICATE" as const, jobId: existing.id };
        await tx.ussdPaymentVerificationJob.update({
          where: { id: existing.id },
          data: { status: "MANUAL_REVIEW", lastFailureClass: "CORRELATION_MISMATCH", nextAttemptAt: input.now ?? new Date() },
        });
        await tx.paymentProviderAttempt.updateMany({
          where: { id: input.providerAttemptId ?? "", organizationId: input.organizationId },
          data: { failureReason: "DURABLE_CORRELATION_CONFLICT" },
        });
        return { kind: "CONFLICT" as const, jobId: existing.id };
      }
      const job = await tx.ussdPaymentVerificationJob.create({
        data: {
          organizationId: input.organizationId,
          integrationId: input.integrationId,
          paymentIntentId: input.paymentIntentId,
          providerAttemptId: input.providerAttemptId,
          encryptedCorrelation: envelope as unknown as Prisma.InputJsonValue,
          correlationFingerprint: fingerprint,
          encryptionKeyVersion: envelope.keyVersion,
          nextAttemptAt: input.now ?? new Date(),
        },
      });
      return { kind: "CREATED" as const, jobId: job.id };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return scheduleDurablePaymentVerification(input);
    }
    throw error;
  }
}

async function claimDueJobs(limit: number, now: Date) {
  const leaseToken = randomUUID();
  const leaseExpiresAt = new Date(now.getTime() + LEASE_MS);
  const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    WITH due AS (
      SELECT "id"
      FROM "UssdPaymentVerificationJob"
      WHERE "status" IN ('QUEUED', 'RETRY', 'CLAIMED')
        AND "nextAttemptAt" <= ${now}
        AND ("leaseExpiresAt" IS NULL OR "leaseExpiresAt" <= ${now})
      ORDER BY "nextAttemptAt", "createdAt"
      FOR UPDATE SKIP LOCKED
      LIMIT ${limit}
    )
    UPDATE "UssdPaymentVerificationJob" AS job
    SET "status" = 'CLAIMED', "leaseToken" = ${leaseToken}, "leaseExpiresAt" = ${leaseExpiresAt}, "updatedAt" = ${now}
    FROM due
    WHERE job."id" = due."id"
    RETURNING job."id"
  `);
  return { ids: rows.map((row) => row.id), leaseToken };
}

async function finishJob(input: {
  id: string;
  leaseToken: string;
  status: UssdPaymentVerificationJobStatus;
  failureClass?: string | null;
  nextAttemptAt?: Date;
  retire?: boolean;
  now: Date;
}) {
  await prisma.ussdPaymentVerificationJob.updateMany({
    where: { id: input.id, leaseToken: input.leaseToken, status: "CLAIMED" },
    data: {
      status: input.status,
      lastFailureClass: input.failureClass ?? null,
      nextAttemptAt: input.nextAttemptAt ?? input.now,
      leaseToken: null,
      leaseExpiresAt: null,
      completedAt: ["SUCCEEDED", "MANUAL_REVIEW", "EXHAUSTED"].includes(input.status) ? input.now : null,
      encryptedCorrelation: input.retire ? Prisma.DbNull : undefined,
      correlationRetiredAt: input.retire ? input.now : undefined,
    },
  });
}

function integrationProjection(job: {
  organizationId: string;
  integration: {
    id: string;
    publicId: string;
    status: "DRAFT" | "ACTIVE" | "DISABLED" | "REVOKED";
    codeName: string;
    credentialProfileKey: string | null;
    callbackOrigin: string | null;
    configuration: unknown;
    organization: { slug: string };
  };
}): ResolvedInotiIntegration {
  const configuration = job.integration.configuration && typeof job.integration.configuration === "object"
    ? job.integration.configuration as Record<string, unknown>
    : {};
  return {
    id: job.integration.id,
    publicId: job.integration.publicId,
    organizationId: job.organizationId,
    organizationSlug: job.integration.organization.slug,
    status: job.integration.status,
    codeName: job.integration.codeName,
    credentialProfileKey: job.integration.credentialProfileKey,
    callbackOrigin: job.integration.callbackOrigin,
    config: {
      orderStatusEnabled: configuration.orderStatusEnabled === true,
      paymentEnabled: configuration.paymentEnabled === true,
    },
  };
}

export async function processDuePaymentVerifications(input: {
  limit?: number;
  now?: Date;
  provider?: UssdProvider;
  settlementAllowed?: () => boolean;
} = {}) {
  const now = input.now ?? new Date();
  const limit = Math.min(Math.max(input.limit ?? 10, 1), 50);
  const provider = input.provider ?? inotiUssdProvider;
  if (!(input.settlementAllowed ?? inotiLivePaymentsAllowed)()) return { claimed: 0, succeeded: 0, retried: 0, manualReview: 0, exhausted: 0 };
  const claim = await claimDueJobs(limit, now);
  const summary = { claimed: claim.ids.length, succeeded: 0, retried: 0, manualReview: 0, exhausted: 0 };

  for (const id of claim.ids) {
    const job = await prisma.ussdPaymentVerificationJob.findFirst({
      where: { id, leaseToken: claim.leaseToken },
      include: { integration: { include: { organization: { select: { slug: true } } } }, paymentIntent: true },
    });
    if (!job) continue;
    const attemptCount = job.attemptCount + 1;
    await prisma.ussdPaymentVerificationJob.updateMany({
      where: { id, leaseToken: claim.leaseToken },
      data: { attemptCount, lastAttemptAt: now },
    });
    let correlation: DurablePaymentCorrelation;
    try {
      correlation = decryptPaymentCorrelation(job.encryptedCorrelation as unknown as CorrelationEnvelope, {
        organizationId: job.organizationId,
        integrationId: job.integrationId,
        paymentIntentId: job.paymentIntentId,
      });
    } catch {
      await finishJob({ id, leaseToken: claim.leaseToken, status: "MANUAL_REVIEW", failureClass: "ENCRYPTION_ERROR", retire: true, now });
      summary.manualReview += 1;
      continue;
    }

    const integration = integrationProjection(job);
    const credentials = await environmentInotiCredentialProvider.resolveProfile(job.organizationId, integration.credentialProfileKey);
    let verification: InotiVerificationResult;
    try {
      verification = await provider.verifyPayment(credentials, {
        codeName: integration.codeName,
        sessionId: correlation.sessionId,
        mobile: correlation.mobile,
        amountRial: job.paymentIntent.amountRial,
        merchantFactorId: correlation.merchantFactorId,
        providerFactorId: correlation.providerFactorId,
        rrn: correlation.rrn,
      });
    } catch {
      verification = { ok: false, code: "PROVIDER_ERROR" };
    }
    if ("code" in verification) {
      const decision = durableRetryDecision(verification.code, attemptCount);
      const nextAttemptAt = decision.retryAfterSeconds === null ? now : new Date(now.getTime() + decision.retryAfterSeconds * 1000);
      await finishJob({ id, leaseToken: claim.leaseToken, status: decision.status, failureClass: decision.failureClass, nextAttemptAt, retire: decision.status !== "RETRY", now });
      await prisma.paymentProviderAttempt.updateMany({
        where: { id: job.providerAttemptId ?? "", organizationId: job.organizationId },
        data: { status: decision.status === "RETRY" ? "PENDING_VERIFICATION" : "FAILED", failureReason: decision.failureClass },
      });
      if (decision.status === "RETRY") summary.retried += 1;
      else if (decision.status === "EXHAUSTED") summary.exhausted += 1;
      else summary.manualReview += 1;
      continue;
    }

    try {
      const settlement = await prismaUssdIntegrationRepository.settleVerifiedPayment({
        integration,
        intent: {
          id: job.paymentIntent.id,
          organizationId: job.paymentIntent.organizationId,
          integrationId: job.paymentIntent.integrationId,
          orderId: job.paymentIntent.orderId,
          paymentRequestId: job.paymentIntent.paymentRequestId,
          providerAttemptId: job.paymentIntent.providerAttemptId,
          merchantFactorId: job.paymentIntent.merchantFactorId,
          amountRial: job.paymentIntent.amountRial,
          sessionIdHash: job.paymentIntent.sessionIdHash,
          mobileHash: job.paymentIntent.mobileHash,
          mobileMasked: job.paymentIntent.mobileMasked,
          status: job.paymentIntent.status,
          providerFactorId: job.paymentIntent.providerFactorId,
          rrn: job.paymentIntent.rrn,
        },
        idempotencyKey: `durable:${job.id}`,
        sessionIdHash: hashInotiEvidence(correlation.sessionId),
        mobileHash: hashInotiEvidence(correlation.mobile),
        callHash: hashInotiEvidence(correlation.call),
        rrnHash: hashInotiEvidence(correlation.rrn),
        rrn: verification.record.rrn,
        providerFactorId: verification.record.providerFactorId,
        providerResult: verification.record.result,
      });
      if (settlement.notification) {
        await customerOrderLifecycleRouter.notifyPaymentStatusChangedSafe({
          organizationId: settlement.notification.organizationId,
          orderId: settlement.notification.orderId,
          orderNumber: settlement.notification.orderNumber,
          previousStatus: settlement.notification.previousStatus,
          newStatus: "COMPLETED",
          customerId: settlement.notification.customerId,
          guestCustomerId: settlement.notification.guestCustomerId,
          guestPhone: settlement.notification.guestPhone,
          actorUserId: null,
        });
        await prismaUssdIntegrationRepository.markNotificationAttempted(settlement.notification.intentId);
      }
      const manual = settlement.kind === "RECONCILIATION_REQUIRED";
      await finishJob({ id, leaseToken: claim.leaseToken, status: manual ? "MANUAL_REVIEW" : "SUCCEEDED", failureClass: manual ? `LATE_VERIFIED_${settlement.requestStatus}` : null, retire: true, now });
      if (manual) summary.manualReview += 1;
      else summary.succeeded += 1;
    } catch {
      const decision = durableRetryDecision("PROVIDER_ERROR", attemptCount);
      const nextAttemptAt = decision.retryAfterSeconds === null ? now : new Date(now.getTime() + decision.retryAfterSeconds * 1000);
      await finishJob({ id, leaseToken: claim.leaseToken, status: decision.status, failureClass: "SETTLEMENT_ERROR", nextAttemptAt, retire: decision.status !== "RETRY", now });
      if (decision.status === "RETRY") summary.retried += 1;
      else summary.exhausted += 1;
    }
  }
  return summary;
}

export async function getDurablePaymentVerificationHealth(now = new Date()) {
  const [pending, overdue, exhausted, manualReview, latestSuccess] = await Promise.all([
    prisma.ussdPaymentVerificationJob.count({ where: { status: { in: ["QUEUED", "CLAIMED", "RETRY"] } } }),
    prisma.ussdPaymentVerificationJob.count({ where: { status: { in: ["QUEUED", "CLAIMED", "RETRY"] }, nextAttemptAt: { lt: now } } }),
    prisma.ussdPaymentVerificationJob.count({ where: { status: "EXHAUSTED" } }),
    prisma.ussdPaymentVerificationJob.count({ where: { status: "MANUAL_REVIEW" } }),
    prisma.ussdPaymentVerificationJob.findFirst({ where: { status: "SUCCEEDED" }, orderBy: { completedAt: "desc" }, select: { completedAt: true } }),
  ]);
  return {
    workerReady: correlationKeyReadiness().configured,
    encryption: correlationKeyReadiness(),
    pending,
    overdue,
    exhausted,
    manualReview,
    latestSuccessfulVerificationAt: latestSuccess?.completedAt?.toISOString() ?? null,
  };
}
