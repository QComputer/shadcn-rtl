import "server-only";
import type { PrismaClient } from "@prisma/client";
import { InotiTokenSmsTransport } from "./inoti-token-transport.server";
import { processCustomerAuthSmsOutbox } from "./sms-outbox.server";

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
export async function runCustomerAuthSmsOutboxBatch(options: { db?: PrismaClient; limit?: number; signal?: AbortSignal } = {}) {
  const limit = options.limit ?? 10;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("INVALID_CUSTOMER_SMS_BATCH_LIMIT");
  if (!customerAuthSmsRuntimeAvailable()) return { available: false, processed: 0 };
  const db = options.db ?? (await import("@/lib/db")).prisma;
  const transport = createCustomerAuthSmsRuntimeTransport();
  let processed = 0;
  while (processed < limit && !options.signal?.aborted) {
    const result = await processCustomerAuthSmsOutbox({ db, secret: process.env.NEXTAUTH_SECRET ?? "", enabled: true, transport });
    if (!result.processed) break;
    processed++;
  }
  return { available: true, processed };
}
