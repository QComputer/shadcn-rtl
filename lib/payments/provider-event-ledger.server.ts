import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";

const safeCode = /^[A-Z0-9_.-]{1,80}$/;
const safeKind = /^[A-Z0-9_]{1,48}$/;
const safeDisposition = /^[A-Z0-9_]{1,32}$/;

export type ProviderEventLedgerInput = {
  organizationId: string;
  providerIntegrationId: string;
  paymentRequestId?: string | null;
  providerAttemptId?: string | null;
  /** Normalized provider event identity; never persisted and must not be a credential. */
  deduplicationMaterial: string;
  /** Digest of the normalized callback or response; never the original body. */
  payloadDigest: string;
  eventKind: string;
  sanitizedProviderCode?: string | null;
  disposition: string;
};

export type ProviderEventLedgerResult = { kind: "RECORDED"; eventId: string } | { kind: "REPLAY"; eventId: string } | { kind: "CONFLICT" };

const sha256 = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

/**
 * Append a digest-only provider event inside the caller's payment transaction.
 * The unique tenant+integration+dedupe index serializes concurrent callbacks.
 * Matching retries return the original event; key reuse with different content
 * is a conflict. Authentication and signature verification must happen first.
 */
export async function recordProviderEvent(tx: Prisma.TransactionClient, input: ProviderEventLedgerInput): Promise<ProviderEventLedgerResult> {
  if (!input.organizationId || !input.providerIntegrationId || !input.deduplicationMaterial ||
      !/^[0-9a-f]{64}$/.test(input.payloadDigest) || !safeKind.test(input.eventKind) ||
      !safeDisposition.test(input.disposition) ||
      (input.sanitizedProviderCode != null && !safeCode.test(input.sanitizedProviderCode))) {
    throw new TypeError("Provider event fields are invalid or not sanitized.");
  }

  const deduplicationKeyHash = sha256(input.deduplicationMaterial);
  const id = randomUUID();
  const inserted = await tx.paymentProviderEvent.createMany({
    data: [{
      id,
      organizationId: input.organizationId,
      providerIntegrationId: input.providerIntegrationId,
      paymentRequestId: input.paymentRequestId ?? null,
      providerAttemptId: input.providerAttemptId ?? null,
      deduplicationKeyHash,
      payloadDigest: input.payloadDigest,
      eventKind: input.eventKind,
      sanitizedProviderCode: input.sanitizedProviderCode ?? null,
      disposition: input.disposition,
      processedAt: new Date(),
    }],
    skipDuplicates: true,
  });
  if (inserted.count === 1) return { kind: "RECORDED", eventId: id };

  const existing = await tx.paymentProviderEvent.findUnique({
    where: { organizationId_providerIntegrationId_deduplicationKeyHash: {
      organizationId: input.organizationId,
      providerIntegrationId: input.providerIntegrationId,
      deduplicationKeyHash,
    } },
    select: { id: true, payloadDigest: true },
  });
  if (!existing) throw new Error("Provider event deduplication conflict could not be resolved.");
  return existing.payloadDigest === input.payloadDigest
    ? { kind: "REPLAY", eventId: existing.id }
    : { kind: "CONFLICT" };
}
