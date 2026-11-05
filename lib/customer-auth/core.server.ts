import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { normalizeIranianMobile } from "@/lib/integrations/inoti-ussd/parser";
import { normalizeDomainHost } from "@/lib/custom-domain-routing";
import { createCustomerAccessToken, customerAuthDigest, encryptCustomerAuthPayload } from "./crypto";
import { customerAuthSmsRuntimeAvailable } from "./sms-runtime.server";

export class CustomerPhoneAuthError extends Error {
  readonly code = "CUSTOMER_AUTH_UNAVAILABLE";
  constructor() { super("CUSTOMER_AUTH_UNAVAILABLE"); }
}
export interface CustomerPhoneAuthOptions {
  enabled?: boolean;
  secret?: string;
  senderAvailable?: () => boolean;
  now?: () => Date;
  /** Trusted platform origins, supplied by server configuration, never request input. */
  platformOrigins?: string[];
}
export function customerPhoneAuthSenderAvailable() { return customerAuthSmsRuntimeAvailable(); }
export function customerPhoneAuthAvailable() {
  return process.env.CUSTOMER_PHONE_AUTH_ENABLED === "1" && (process.env.NEXTAUTH_SECRET?.length ?? 0) >= 32 && customerPhoneAuthSenderAvailable();
}
const privilegedRoles = ["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF", "DRIVER"] as const;
const safeCustomer = {
  role: "CUSTOMER" as const, isActive: true, isTeamMember: false, deletedAt: null,
  memberOf: { none: { isActive: true, role: { in: [...privilegedRoles] } } },
};
async function database(db?: PrismaClient) { return db ?? (await import("@/lib/db")).prisma; }

export class CustomerPhoneAuthService {
  constructor(private readonly db?: PrismaClient, private readonly options: CustomerPhoneAuthOptions = {}) {}
  private now() { return this.options.now?.() ?? new Date(); }
  private secret() { return this.options.secret ?? process.env.NEXTAUTH_SECRET ?? ""; }
  private enabled() { return this.options.enabled ?? process.env.CUSTOMER_PHONE_AUTH_ENABLED === "1"; }
  private async destination(tx: Prisma.TransactionClient, organizationId: string, origin: string) {
    let url: URL;
    try { url = new URL(origin); } catch { throw new CustomerPhoneAuthError(); }
    const localHttp = url.protocol === "http:" && process.env.NODE_ENV !== "production" && (["localhost", "127.0.0.1"].includes(url.hostname) || url.hostname.endsWith(".localhost"));
    if (url.origin !== origin || url.username || url.password || (url.protocol !== "https:" && !localHttp)) throw new CustomerPhoneAuthError();
    const organization = await tx.organization.findFirst({ where: { id: organizationId, isActive: true, deletedAt: null }, select: { id: true, slug: true, locale: true } });
    if (!organization) throw new CustomerPhoneAuthError();
    if (this.options.platformOrigins?.includes(origin)) return organization;
    const domain = await tx.organizationDomain.findFirst({ where: { organizationId, normalizedDomain: normalizeDomainHost(url.hostname), status: "ACTIVE", providerVerified: true, dnsConfigured: true, sslReady: true, deletedAt: null, disabledAt: null, removedAt: null }, select: { id: true } });
    if (!domain) throw new CustomerPhoneAuthError();
    return organization;
  }
  async request(input: { phone: string; organizationId: string; origin: string; ip: string; source: "WEB" | "USSD"; idempotencyKey?: string }): Promise<{ accepted: true }> {
    const accepted = { accepted: true as const };
    const phone = normalizeIranianMobile(input.phone);
    if (!phone || !this.enabled() || !(this.options.senderAvailable ?? customerPhoneAuthSenderAvailable)()) return accepted;
    const secret = this.secret();
    if (secret.length < 32 || !input.ip || input.ip.length > 256 || (input.idempotencyKey?.length ?? 0) > 256) return accepted;
    try {
      const db = await database(this.db);
      await db.$transaction(async tx => {
        const destination = await this.destination(tx, input.organizationId, input.origin);
        const now = this.now();
        const issuanceKey = input.idempotencyKey ? customerAuthDigest(`${input.source}:${input.organizationId}:${phone}:${input.idempotencyKey}`, secret) : null;
        const keys = [
          { key: `phone:${customerAuthDigest(phone, secret)}`, limit: 3 },
          { key: `ip:${customerAuthDigest(input.ip, secret)}`, limit: 15 },
          { key: `org:${input.organizationId}`, limit: 100 },
        ].sort((a, b) => a.key.localeCompare(b.key));
        // Sorted transaction advisory locks serialize quotas across workers and restarts.
        for (const item of keys) await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${item.key}, 0))::text`;
        if (issuanceKey && await tx.customerAccessLink.findUnique({ where: { issuanceKey }, select: { id: true } })) return;
        const windowStart = new Date(Math.floor(now.getTime() / 900_000) * 900_000);
        for (const item of keys) {
          const counter = await tx.customerPhoneAuthQuota.findUnique({ where: { key_windowStart: { key: item.key, windowStart } } });
          if ((counter?.count ?? 0) >= item.limit) return;
        }
        for (const item of keys) await tx.customerPhoneAuthQuota.upsert({ where: { key_windowStart: { key: item.key, windowStart } }, create: { key: item.key, windowStart, count: 1 }, update: { count: { increment: 1 } } });
        const token = createCustomerAccessToken();
        const id = randomUUID();
        const locale = ["fa", "en", "ar"].includes(destination.locale) ? destination.locale : "fa";
        const url = new URL(`/${locale}/login/phone`, input.origin);
        url.searchParams.set("organization", destination.slug);
        // Fragment keeps the secret out of HTTP request/access logs and referrers.
        url.hash = new URLSearchParams({ token }).toString();
        await tx.customerAccessLink.create({ data: { id, phone, organizationId: input.organizationId, origin: input.origin, source: input.source, tokenDigest: customerAuthDigest(token, secret), issuanceKey, expiresAt: new Date(now.getTime() + 300_000), createdAt: now, smsOutbox: { create: { encryptedPayload: encryptCustomerAuthPayload({ phone, url: url.toString() }, secret, id), nextAttemptAt: now } } } });
      }, { maxWait: 5000, timeout: 10_000 });
    } catch (error) {
      // Fixed diagnostics preserve operational visibility without logging phone, token, URL or DB payloads.
      if (!(error instanceof CustomerPhoneAuthError)) console.warn("CUSTOMER_PHONE_AUTH_REQUEST_FAILED");
    }
    return accepted;
  }
  async consume(input: { token: string; organizationId: string; origin: string }) {
    if (!this.enabled() || !/^[A-Za-z0-9_-]{43}$/.test(input.token) || this.secret().length < 32) throw new CustomerPhoneAuthError();
    try {
      const db = await database(this.db);
      return await db.$transaction(async tx => {
        await this.destination(tx, input.organizationId, input.origin);
        const now = this.now();
        const link = await tx.customerAccessLink.findUnique({ where: { tokenDigest: customerAuthDigest(input.token, this.secret()) } });
        if (!link || link.organizationId !== input.organizationId || link.origin !== input.origin || link.consumedAt || link.expiresAt <= now) throw new CustomerPhoneAuthError();
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`identity:${link.phone}`}, 0))::text`;
        const claimed = await tx.customerAccessLink.updateMany({ where: { id: link.id, consumedAt: null, expiresAt: { gt: now } }, data: { consumedAt: now } });
        if (claimed.count !== 1) throw new CustomerPhoneAuthError();
        const identity = await tx.customerPhoneIdentity.findUnique({ where: { phone: link.phone } });
        let user;
        if (identity) {
          // Lock user against concurrent promotion before reading customer eligibility.
          await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${identity.userId} FOR UPDATE`;
          user = await tx.user.findFirst({ where: { id: identity.userId, ...safeCustomer } });
          if (!user) throw new CustomerPhoneAuthError();
        } else {
          // Existing legacy phone/name ownership is never silently converted to a verified identity.
          if (await tx.user.findFirst({ where: { OR: [{ name: link.phone }, { phone: { in: [link.phone, link.phone.slice(1), `98${link.phone.slice(1)}`, `+98${link.phone.slice(1)}`, `0098${link.phone.slice(1)}`] } }] }, select: { id: true } })) throw new CustomerPhoneAuthError();
          user = await tx.user.create({ data: { name: link.phone, phone: link.phone, password: await bcrypt.hash(createCustomerAccessToken(), 12), role: "CUSTOMER", isTeamMember: false } });
          await tx.customerPhoneIdentity.create({ data: { phone: link.phone, userId: user.id, verifiedAt: now } });
        }
        const membership = await tx.customerClubMembership.upsert({ where: { organizationId_customerId: { organizationId: link.organizationId, customerId: user.id } }, create: { organizationId: link.organizationId, customerId: user.id, source: "PUBLIC_SHOP" }, update: {} });
        if (membership.status !== "ACTIVE") throw new CustomerPhoneAuthError();
        const session = await tx.customerPhoneSession.create({ data: { userId: user.id, organizationId: link.organizationId, expiresAt: new Date(now.getTime() + 30 * 86_400_000) } });
        return { id: user.id, name: user.name, password: user.password, locale: user.locale, theme: user.theme, phoneSessionId: session.id, organizationId: link.organizationId };
      }, { maxWait: 5000, timeout: 15_000 });
    } catch (error) {
      if (!(error instanceof CustomerPhoneAuthError)) console.warn("CUSTOMER_PHONE_AUTH_CONSUME_FAILED");
      throw new CustomerPhoneAuthError();
    }
  }
}

export const customerPhoneAuthService = new CustomerPhoneAuthService();

export async function validateCustomerPhoneSession(input: { sessionId: string; userId: string; organizationId: string }, db?: PrismaClient) {
  try {
    const client = await database(db);
    return !!await client.customerPhoneSession.findFirst({ where: { id: input.sessionId, userId: input.userId, organizationId: input.organizationId, revokedAt: null, expiresAt: { gt: new Date() }, organization: { isActive: true, deletedAt: null }, user: { ...safeCustomer, customerClubMemberships: { some: { organizationId: input.organizationId, status: "ACTIVE" } } } }, select: { id: true } });
  } catch { console.warn("CUSTOMER_PHONE_AUTH_SESSION_CHECK_FAILED"); return false; }
}
export async function revokeCustomerPhoneSession(input: { sessionId: string; userId: string }, db?: PrismaClient) {
  return (await database(db)).customerPhoneSession.updateMany({ where: { id: input.sessionId, userId: input.userId, revokedAt: null }, data: { revokedAt: new Date() } });
}
export async function revokeAllCustomerPhoneSessions(userId: string, db?: PrismaClient) {
  return (await database(db)).customerPhoneSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
}
