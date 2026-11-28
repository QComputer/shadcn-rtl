import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Prisma } from "@prisma/client";
import { recordProviderEvent } from "@/lib/payments/provider-event-ledger.server";

const eventInput = {
  organizationId: "synthetic-org",
  providerIntegrationId: "synthetic-integration",
  paymentRequestId: "synthetic-request",
  providerAttemptId: "synthetic-attempt",
  deduplicationMaterial: "synthetic-provider-event-id",
  payloadDigest: "a".repeat(64),
  eventKind: "PAYMENT_CALLBACK",
  sanitizedProviderCode: "OK_200",
  disposition: "ACCEPTED",
};

describe("provider event deduplication ledger", () => {
  it("stores only digests and sanitized tenant-scoped identifiers", async () => {
    let insertedData: unknown;
    const tx = {
      paymentProviderEvent: {
        createMany: async ({ data }: { data: unknown }) => { insertedData = data; return { count: 1 }; },
      },
    } as unknown as Prisma.TransactionClient;
    const result = await recordProviderEvent(tx, eventInput);
    assert.equal(result.kind, "RECORDED");
    const serialized = JSON.stringify(insertedData);
    assert.equal(serialized.includes(eventInput.deduplicationMaterial), false);
    assert.equal(serialized.includes("rawBody"), false);
    assert.equal(serialized.includes(eventInput.payloadDigest), true);
  });

  it("classifies identical delivery as replay and changed content as a conflict", async () => {
    let existingDigest = eventInput.payloadDigest;
    const tx = {
      paymentProviderEvent: {
        createMany: async () => ({ count: 0 }),
        findUnique: async () => ({ id: "existing-event", payloadDigest: existingDigest }),
      },
    } as unknown as Prisma.TransactionClient;
    assert.deepEqual(await recordProviderEvent(tx, eventInput), { kind: "REPLAY", eventId: "existing-event" });
    existingDigest = "b".repeat(64);
    assert.deepEqual(await recordProviderEvent(tx, eventInput), { kind: "CONFLICT" });
  });

  it("rejects unsafe event metadata before writing", async () => {
    let wrote = false;
    const tx = { paymentProviderEvent: { createMany: async () => { wrote = true; return { count: 1 }; } } } as unknown as Prisma.TransactionClient;
    await assert.rejects(() => recordProviderEvent(tx, { ...eventInput, sanitizedProviderCode: "raw token=secret" }), TypeError);
    assert.equal(wrote, false);
  });
});
