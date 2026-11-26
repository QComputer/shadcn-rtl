import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomInt, randomUUID, timingSafeEqual } from "node:crypto";
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

function generateOtp(): string {
  const num = randomInt(0, 10000);
  return num.toString().padStart(4, "0");
}

function hashOtp(otp: string, secret: string): string {
  return customerAuthDigest(`otp:${otp}`, secret);
}

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

  async request(input: { phone: string; organizationId: string; origin: string; ip: string; source: "WEB" | "USSD"; idempotencyKey?: string }): Promise<{ accepted: true; requiresOtp?: boolean }> {
    const accepted = { accepted: true as const };
    const phone = normalizeIranianMobile(input.phone);
    if (!phone || !this.enabled() || !(this.options.senderAvailable ?? customerPhoneAuthSenderAvailable)()) return accepted;
    const secret = this.secret();
    if (secret.length < 32 || !input.ip || input.ip.length > 256 || (input.idempotencyKey?.length ?? 0) > 256) return accepted;
    try {
      const db = await database(this.db);
      await db.$transaction(async tx => {
        const destination = await this.destination(tx, input.organizationId, input.origin);
        // Serialize issuance and consumption for this phone before checking quota or challenge state.
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`identity:${phone}`}, 0))::text`;
        const issuanceKey = input.idempotencyKey ? customerAuthDigest(`${input.source}:${input.organizationId}:${phone}:${input.idempotencyKey}`, secret) : null;
        const keys = [
          { key: `phone:${customerAuthDigest(phone, secret)}`, limit: 3 },
          { key: `ip:${customerAuthDigest(input.ip, secret)}`, limit: 15 },
          { key: `org:${input.organizationId}`, limit: 100 },
        ].sort((a, b) => a.key.localeCompare(b.key));
        for (const item of keys) await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${item.key}, 0))::text`;
        const now = this.now();
        if (issuanceKey && await tx.customerAccessLink.findUnique({ where: { issuanceKey }, select: { id: true } })) return;
        // 60-second resend cooldown: do not issue a new OTP if an unconsumed
        // link for the same phone+org+origin was created within the last 60s.
        const cooldownWindow = new Date(now.getTime() - 60_000);
        const recentLink = await tx.customerAccessLink.findFirst?.({
          where: {
            phone,
            organizationId: input.organizationId,
            origin: input.origin,
            consumedAt: null,
            createdAt: { gt: cooldownWindow },
          },
          select: { id: true },
        });
        if (recentLink) return;
        const windowStart = new Date(Math.floor(now.getTime() / 900_000) * 900_000);
        for (const item of keys) {
          const counter = await tx.customerPhoneAuthQuota.findUnique({ where: { key_windowStart: { key: item.key, windowStart } } });
          if ((counter?.count ?? 0) >= item.limit) return;
        }
        for (const item of keys) await tx.customerPhoneAuthQuota.upsert({ where: { key_windowStart: { key: item.key, windowStart } }, create: { key: item.key, windowStart, count: 1 }, update: { count: { increment: 1 } } });
        // Reissuing an OTP supersedes older OTP challenges in this exact origin/tenant scope.
        // Never revive an older still-valid code after consuming the replacement.
        await tx.customerAccessLink.updateMany({ where: { phone, organizationId: input.organizationId, origin: input.origin, consumedAt: null, otpCodeHash: { not: null }, expiresAt: { gt: now } }, data: { expiresAt: now, otpExpiresAt: now } });
        const otp = generateOtp();
        const token = createCustomerAccessToken();
        const id = randomUUID();
        const locale = ["fa", "en", "ar"].includes(destination.locale) ? destination.locale : "fa";
        const url = new URL(`/${locale}/login/phone`, input.origin);
        url.searchParams.set("organization", destination.slug);
        url.hash = new URLSearchParams({ token }).toString();
        await tx.customerAccessLink.create({ data: { id, phone, organizationId: input.organizationId, origin: input.origin, source: input.source, tokenDigest: customerAuthDigest(token, secret), issuanceKey, expiresAt: new Date(now.getTime() + 300_000), createdAt: now, otpCodeHash: hashOtp(otp, secret), otpExpiresAt: new Date(now.getTime() + 120_000), otpAttempts: 0, smsOutbox: { create: { encryptedPayload: encryptCustomerAuthPayload({ phone, url: `OTP:${otp}` }, secret, id), nextAttemptAt: now } } } });
      }, { maxWait: 5000, timeout: 10_000 });
    } catch (error) {
      if (!(error instanceof CustomerPhoneAuthError)) console.warn("CUSTOMER_PHONE_AUTH_REQUEST_FAILED");
    }
    return accepted;
  }
  async consume(input: { token?: string; otp?: string; phone?: string; organizationId: string; origin: string }) {
    if (!this.enabled() || this.secret().length < 32) throw new CustomerPhoneAuthError();
    try {
      const db = await database(this.db);
      const result = await db.$transaction(async tx => {
        await this.destination(tx, input.organizationId, input.origin);
        let link;
        let now: Date;
        const usingOtp = Boolean(input.otp);
        if (usingOtp) {
          const phone = normalizeIranianMobile(input.phone ?? "");
          if (!phone || !input.otp || input.token) throw new CustomerPhoneAuthError();
          // The lock must precede the challenge read, including the attempt counter.
          await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`identity:${phone}`}, 0))::text`;
          now = this.now();
          // Do not fall back to an older challenge when the latest is consumed or expired.
          link = await tx.customerAccessLink.findFirst({ where: { phone, organizationId: input.organizationId, origin: input.origin, otpCodeHash: { not: null } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
          if (!link || link.consumedAt || link.otpConsumedAt || link.expiresAt <= now || !link.otpExpiresAt || link.otpExpiresAt <= now || link.otpAttempts >= 3 || !link.otpCodeHash) throw new CustomerPhoneAuthError();
          const code = input.otp.replace(/\s/g, "");
          const expectedHash = Buffer.from(link.otpCodeHash);
          const hash = Buffer.from(hashOtp(code, this.secret()));
          if (!/^\d{4}$/.test(code) || expectedHash.length !== hash.length || !timingSafeEqual(expectedHash, hash)) {
            await tx.customerAccessLink.updateMany({ where: { id: link.id, otpAttempts: { lt: 3 }, consumedAt: null, otpConsumedAt: null, expiresAt: { gt: now }, otpExpiresAt: { gt: now } }, data: { otpAttempts: { increment: 1 } } });
            // Returning rather than throwing commits the failed attempt in this transaction.
            return null;
          }
        } else if (input.token && /^[A-Za-z0-9_-]{43}$/.test(input.token)) {
          const tokenDigest = customerAuthDigest(input.token, this.secret());
          const candidate = await tx.customerAccessLink.findUnique({ where: { tokenDigest } });
          if (!candidate || candidate.organizationId !== input.organizationId || candidate.origin !== input.origin) throw new CustomerPhoneAuthError();
          await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`identity:${candidate.phone}`}, 0))::text`;
          now = this.now();
          link = await tx.customerAccessLink.findUnique({ where: { tokenDigest } });
        } else {
          throw new CustomerPhoneAuthError();
        }
        if (!link || link.organizationId !== input.organizationId || link.origin !== input.origin || link.consumedAt || link.expiresAt <= now) throw new CustomerPhoneAuthError();
        const claimed = await tx.customerAccessLink.updateMany({ where: { id: link.id, consumedAt: null, expiresAt: { gt: now }, ...(usingOtp ? { otpConsumedAt: null, otpExpiresAt: { gt: now }, otpAttempts: { lt: 3 } } : {}) }, data: { consumedAt: now, otpConsumedAt: now } });
        if (claimed.count !== 1) throw new CustomerPhoneAuthError();
        const identity = await tx.customerPhoneIdentity.findUnique({ where: { phone: link.phone } });
        let user;
        if (identity) {
          await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${identity.userId} FOR UPDATE`;
          user = await tx.user.findFirst({ where: { id: identity.userId, ...safeCustomer } });
          if (!user) throw new CustomerPhoneAuthError();
        } else {
          if (await tx.user.findFirst({ where: { OR: [{ name: link.phone }, { phone: { in: [link.phone, link.phone.slice(1), `98${link.phone.slice(1)}`, `+98${link.phone.slice(1)}`, `0098${link.phone.slice(1)}`] } }] }, select: { id: true } })) throw new CustomerPhoneAuthError();
          user = await tx.user.create({ data: { name: link.phone, phone: link.phone, password: await bcrypt.hash(createCustomerAccessToken(), 12), role: "CUSTOMER", isTeamMember: false } });
          await tx.customerPhoneIdentity.create({ data: { phone: link.phone, userId: user.id, verifiedAt: now } });
        }
        // Signing in is not club consent. Absence of membership is valid; existing
        // explicit non-active restrictions remain fail-closed until a separate access policy exists.
        const membership = await tx.customerClubMembership.findUnique({ where: { organizationId_customerId: { organizationId: link.organizationId, customerId: user.id } }, select: { status: true } });
        if (membership && membership.status !== "ACTIVE") throw new CustomerPhoneAuthError();
        const session = await tx.customerPhoneSession.create({ data: { userId: user.id, organizationId: link.organizationId, expiresAt: new Date(now.getTime() + 30 * 86_400_000) } });
        return { id: user.id, name: user.name, password: user.password, locale: user.locale, theme: user.theme, phoneSessionId: session.id, organizationId: link.organizationId };
      }, { maxWait: 5000, timeout: 15_000 });
      if (!result) throw new CustomerPhoneAuthError();
      return result;
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
    return !!await client.customerPhoneSession.findFirst({ where: { id: input.sessionId, userId: input.userId, organizationId: input.organizationId, revokedAt: null, expiresAt: { gt: new Date() }, organization: { isActive: true, deletedAt: null }, user: { ...safeCustomer, customerClubMemberships: { none: { organizationId: input.organizationId, status: { not: "ACTIVE" } } } } }, select: { id: true } });
  } catch { console.warn("CUSTOMER_PHONE_AUTH_SESSION_CHECK_FAILED"); return false; }
}

/** Create a persisted tenant-bound session for an existing customer password login. */
export async function createCustomerPasswordSession(userId: string, organizationId: string, db?: PrismaClient) {
  try {
    const client = await database(db);
    return await client.$transaction(async tx => {
      const user = await tx.user.findFirst({ where: { id: userId, ...safeCustomer }, select: { id: true } });
      const organization = await tx.organization.findFirst({ where: { id: organizationId, isActive: true, deletedAt: null }, select: { id: true } });
      const membership = user && organization
        ? await tx.customerClubMembership.findUnique({ where: { organizationId_customerId: { organizationId, customerId: user.id } }, select: { status: true } })
        : null;
      if (!user || !organization || (membership && membership.status !== "ACTIVE")) throw new CustomerPhoneAuthError();
      const session = await tx.customerPhoneSession.create({
        data: { userId: user.id, organizationId, expiresAt: new Date(Date.now() + 30 * 86_400_000) },
        select: { id: true },
      });
      return session.id;
    }, { maxWait: 5000, timeout: 10_000 });
  } catch (error) {
    if (!(error instanceof CustomerPhoneAuthError)) console.warn("CUSTOMER_PASSWORD_SESSION_CREATE_FAILED");
    throw new CustomerPhoneAuthError();
  }
}

export async function revokeCustomerPhoneSession(input: { sessionId: string; userId: string }, db?: PrismaClient) {
  return (await database(db)).customerPhoneSession.updateMany({ where: { id: input.sessionId, userId: input.userId, revokedAt: null }, data: { revokedAt: new Date() } });
}
export async function revokeAllCustomerPhoneSessions(userId: string, db?: PrismaClient) {
  return (await database(db)).customerPhoneSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
}
