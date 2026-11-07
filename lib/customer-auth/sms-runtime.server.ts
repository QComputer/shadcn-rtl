import "server-only";
import type { PrismaClient } from "@prisma/client";
import { InotiTokenSmsTransport } from "./inoti-token-transport.server";
import { processCustomerAuthSmsOutbox, type CustomerAuthSmsTransport } from "./sms-outbox.server";
import { normalizeIranianMobile } from "@/lib/integrations/inoti-ussd/parser";

/** Only the BazarBaaz platform token funds enrollment. No request or tenant token can override it. */
export function createCustomerAuthSmsRuntimeTransport() {
  return new InotiTokenSmsTransport({
    token: process.env.INOTI_PLATFORM_SMS_TOKEN?.trim() ?? "",
    lineNo: process.env.INOTI_PLATFORM_SMS_LINE_NO?.trim() ?? "",
    allowNetwork: process.env.CUSTOMER_AUTH_SMS_WORKER_ENABLED === "1",
  });
}

export function customerAuthSmsRuntimeAvailable() {
  return process.env.CUSTOMER_AUTH_SMS_WORKER_ENABLED === "1" &&
    (process.env.NEXTAUTH_SECRET?.length ?? 0) >= 32 && createCustomerAuthSmsRuntimeTransport().available();
}

/** Bounded one-shot worker. Scheduling and live activation remain operator-owned. */
export async function runCustomerAuthSmsOutboxBatch(options: { db?: PrismaClient; limit?: number; signal?: AbortSignal; allowedRecipient?: string; transport?: CustomerAuthSmsTransport } = {}) {
  const limit = options.limit ?? 10;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("INVALID_CUSTOMER_SMS_BATCH_LIMIT");
  if (!customerAuthSmsRuntimeAvailable()) return { available: false, processed: 0 };

  // Fail closed when canary mode is requested but the recipient is missing or invalid.
  let canaryRecipient: string | undefined;
  if (options.allowedRecipient !== undefined) {
    const normalized = normalizeIranianMobile(options.allowedRecipient);
    if (!normalized) throw new Error("INVALID_CANARY_RECIPIENT");
    canaryRecipient = normalized;
  }

  const db = options.db ?? (await import("@/lib/db")).prisma;
  const transport = options.transport ?? createCustomerAuthSmsRuntimeTransport();
  let processed = 0;
  while (processed < limit && !options.signal?.aborted) {
    const result = await processCustomerAuthSmsOutbox({ db, secret: process.env.NEXTAUTH_SECRET ?? "", enabled: true, transport, allowedRecipient: canaryRecipient });
    if (!result.processed) break;
    processed++;
    // Canary mode: exactly one real provider send attempt, then stop.
    if (canaryRecipient) break;
  }
  return { available: true, processed };
}
