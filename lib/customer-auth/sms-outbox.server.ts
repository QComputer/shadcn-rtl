import "server-only";
import type { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { decryptCustomerAuthPayload } from "./crypto";
import { normalizeDomainHost } from "@/lib/custom-domain-routing";

/** Dedicated transport: auth secrets must never pass through generic SmsDelivery/logging. */
export interface CustomerAuthSmsTransport {
  reviewedForAuthentication: true;
  available(): boolean;
  /** RETRYABLE is permitted only when the provider definitely did not accept the message. */
  send(input: { phone: string; url: string; organizationName?: string; idempotencyKey: string; signal: AbortSignal }): Promise<"SENT" | "REJECTED" | "RETRYABLE" | { status: "ACCEPTED"; providerMessageId: string }>;
}
export interface CustomerAuthSmsWorkerOptions {
  db: PrismaClient;
  secret: string;
  enabled: boolean;
  transport?: CustomerAuthSmsTransport;
  now?: () => Date;
  platformOrigins?: string[];
  /** Canary safety: when set, only this recipient's outbox records are eligible for dispatch. */
  allowedRecipient?: string;
}

export async function processCustomerAuthSmsOutbox(options: CustomerAuthSmsWorkerOptions) {
  if (!options.enabled || options.secret.length < 32 || !options.transport?.reviewedForAuthentication || !options.transport.available()) return { processed: false };
  const { db, transport } = options;
  const now = options.now?.() ?? new Date();
  // An expired send lease is ambiguous: never resend automatically after worker death.
  await db.customerAuthSmsOutbox.updateMany({ where: { status: "SENDING", lockedUntil: { lte: now } }, data: { status: "UNCERTAIN", encryptedPayload: "", lastErrorCode: "LEASE_EXPIRED", leaseId: null, lockedUntil: null } });
  const where: Record<string, unknown> = { status: "PENDING", attempts: { lt: 3 }, nextAttemptAt: { lte: now } };
  if (options.allowedRecipient) where.link = { phone: options.allowedRecipient };
  const candidate = await db.customerAuthSmsOutbox.findFirst({ where, orderBy: { createdAt: "asc" }, include: { link: true } });
  if (!candidate) return { processed: false };
  const leaseId = randomUUID();
  const claim = await db.customerAuthSmsOutbox.updateMany({ where: { id: candidate.id, status: "PENDING", attempts: { lt: 3 }, nextAttemptAt: { lte: now } }, data: { status: "SENDING", attempts: { increment: 1 }, leaseId, lockedUntil: new Date(now.getTime() + 30_000) } });
  if (claim.count !== 1) return { processed: false };
  const finish = (data: { status: string; encryptedPayload?: string; lastErrorCode: string | null; sentAt?: Date; providerMessageId?: string; nextAttemptAt?: Date }) => db.customerAuthSmsOutbox.updateMany({ where: { id: candidate.id, leaseId, status: "SENDING" }, data: { ...data, leaseId: null, lockedUntil: null } });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const organization = await db.organization.findFirst({ where: { id: candidate.link.organizationId, isActive: true, deletedAt: null }, select: { id: true, name: true, branding: { select: { displayName: true } } } });
    const origin = new URL(candidate.link.origin);
    const localHttp = origin.protocol === "http:" && process.env.NODE_ENV !== "production" && (["localhost", "127.0.0.1"].includes(origin.hostname) || origin.hostname.endsWith(".localhost"));
    const originAllowed = origin.origin === candidate.link.origin && !origin.username && !origin.password && (origin.protocol === "https:" || localHttp);
    const domain = options.platformOrigins?.includes(origin.origin) || await db.organizationDomain.findFirst({ where: { organizationId: candidate.link.organizationId, normalizedDomain: normalizeDomainHost(origin.hostname), status: "ACTIVE", providerVerified: true, dnsConfigured: true, sslReady: true, deletedAt: null, disabledAt: null, removedAt: null }, select: { id: true } });
    if (!organization || !domain || !originAllowed || candidate.link.consumedAt || candidate.link.expiresAt <= now) {
      await finish({ status: "CANCELLED", encryptedPayload: "", lastErrorCode: "LINK_UNAVAILABLE" });
      return { processed: true };
    }
    const payload = decryptCustomerAuthPayload(candidate.encryptedPayload, options.secret, candidate.linkId);
    if (payload.phone !== candidate.link.phone || (!payload.url.startsWith("OTP:") && new URL(payload.url).origin !== candidate.link.origin)) {
      await finish({ status: "CANCELLED", encryptedPayload: "", lastErrorCode: "PAYLOAD_MISMATCH" });
      return { processed: true };
    }
    const controller = new AbortController();
    const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error("SEND_UNCERTAIN")); }, 10_000); });
    const result = await Promise.race([transport.send({ ...payload, organizationName: organization.branding?.displayName || organization.name, idempotencyKey: candidate.linkId, signal: controller.signal }), timeout]);
    if (typeof result === "object" && result.status === "ACCEPTED") await finish({ status: "ACCEPTED", providerMessageId: result.providerMessageId, encryptedPayload: "", lastErrorCode: null, sentAt: options.now?.() ?? new Date() });
    else if (result === "SENT") await finish({ status: "SENT", encryptedPayload: "", lastErrorCode: null, sentAt: options.now?.() ?? new Date() });
    else if (result === "RETRYABLE" && candidate.attempts < 2) await finish({ status: "PENDING", lastErrorCode: "RETRYABLE_REJECTION", nextAttemptAt: new Date(now.getTime() + (candidate.attempts + 1) * 30_000) });
    else await finish({ status: "FAILED", encryptedPayload: "", lastErrorCode: "SEND_REJECTED" });
  } catch {
    await finish({ status: "UNCERTAIN", encryptedPayload: "", lastErrorCode: "SEND_UNCERTAIN" });
  } finally { if (timer) clearTimeout(timer); }
  return { processed: true };
}
