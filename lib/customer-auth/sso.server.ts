import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { normalizeDomainHost } from "@/lib/custom-domain-routing";

export class CustomerSsoError extends Error {
  readonly code = "CUSTOMER_SSO_UNAVAILABLE";
  constructor() { super("CUSTOMER_SSO_UNAVAILABLE"); }
}
export interface CustomerSsoOptions {
  enabled?: boolean;
  secret?: string;
  now?: () => Date;
  /** Nonproduction fixture origins only. Production always requires a verified tenant domain. */
  platformOrigins?: string[];
}
const opaque = /^[A-Za-z0-9_-]{43}$/;
const privilegedRoles = ["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF", "DRIVER"] as const;
const safeCustomer = {
  role: "CUSTOMER" as const, isActive: true, isTeamMember: false, deletedAt: null,
  memberOf: { none: { isActive: true, role: { in: [...privilegedRoles] } } },
  customerPhoneIdentity: { isNot: null },
};
function configuredSecret() { return process.env.CUSTOMER_SSO_SECRET ?? process.env.NEXTAUTH_SECRET ?? ""; }
export function customerSsoAvailable() { return process.env.CUSTOMER_SSO_ENABLED === "1" && configuredSecret().length >= 32; }
export function createCustomerSsoVerifier() { return randomBytes(32).toString("base64url"); }
export function customerSsoChallenge(verifier: string) {
  if (!opaque.test(verifier)) throw new CustomerSsoError();
  return createHash("sha256").update(verifier).digest("base64url");
}
function digest(ticket: string, secret: string) {
  return createHmac("sha256", secret).update("bazarbaaz:customer-sso:ticket:v1\0").update(ticket).digest("hex");
}
async function database(db?: PrismaClient) { return db ?? (await import("@/lib/db")).prisma; }

export class CustomerSsoService {
  constructor(private readonly db?: PrismaClient, private readonly options: CustomerSsoOptions = {}) {}
  private now() { return this.options.now?.() ?? new Date(); }
  private secret() { return this.options.secret ?? configuredSecret(); }
  private requireEnabled() {
    if (!(this.options.enabled ?? process.env.CUSTOMER_SSO_ENABLED === "1") || this.secret().length < 32) throw new CustomerSsoError();
  }
  private async destination(tx: Prisma.TransactionClient, organizationId: string, origin: string) {
    let url: URL;
    try { url = new URL(origin); } catch { throw new CustomerSsoError(); }
    const localHttp = process.env.NODE_ENV !== "production" && url.protocol === "http:" &&
      (["127.0.0.1", "localhost"].includes(url.hostname) || url.hostname.endsWith(".localhost"));
    if (url.origin !== origin || url.username || url.password || (url.protocol !== "https:" && !localHttp) || (!localHttp && url.port)) throw new CustomerSsoError();
    await tx.$queryRaw`SELECT id FROM "Organization" WHERE id = ${organizationId} FOR SHARE`;
    const organization = await tx.organization.findFirst({ where: { id: organizationId, isActive: true, deletedAt: null, isPlatformOwner: false }, select: { id: true } });
    if (!organization) throw new CustomerSsoError();
    if (process.env.NODE_ENV !== "production" && this.options.platformOrigins?.includes(origin)) return;
    const host = normalizeDomainHost(url.hostname);
    await tx.$queryRaw`SELECT id FROM "OrganizationDomain" WHERE "organizationId" = ${organizationId} AND "normalizedDomain" = ${host} FOR SHARE`;
    const domain = await tx.organizationDomain.findFirst({ where: { organizationId, normalizedDomain: host, status: "ACTIVE", providerVerified: true, dnsConfigured: true, sslReady: true, deletedAt: null, disabledAt: null, removedAt: null }, select: { id: true } });
    if (!domain) throw new CustomerSsoError();
  }
  private async principal(tx: Prisma.TransactionClient, input: { userId: string; sourceSessionId: string; sourceOrganizationId: string; targetOrganizationId: string }, now: Date) {
    // User lock coordinates with existing privilege-revocation triggers and new staff membership inserts.
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${input.userId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM "CustomerPhoneIdentity" WHERE "userId" = ${input.userId} FOR SHARE`;
    await tx.$queryRaw`SELECT id FROM "CustomerPhoneSession" WHERE id = ${input.sourceSessionId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM "Organization" WHERE id = ${input.sourceOrganizationId} FOR SHARE`;
    await tx.$queryRaw`SELECT id FROM "CustomerClubMembership" WHERE "customerId" = ${input.userId} AND "organizationId" IN (${input.sourceOrganizationId}, ${input.targetOrganizationId}) ORDER BY id FOR SHARE`;
    now = this.now();
    const user = await tx.user.findFirst({ where: { id: input.userId, ...safeCustomer }, select: { id: true, name: true, password: true, locale: true, theme: true, customerPhoneIdentity: { select: { verifiedAt: true } } } });
    if (!user?.customerPhoneIdentity || user.customerPhoneIdentity.verifiedAt > now) throw new CustomerSsoError();
    const source = await tx.customerPhoneSession.findFirst({ where: {
      id: input.sourceSessionId, userId: input.userId, organizationId: input.sourceOrganizationId,
      revokedAt: null, expiresAt: { gt: now }, organization: { isActive: true, deletedAt: null, isPlatformOwner: false },
    }, select: { id: true } });
    if (!source) throw new CustomerSsoError();
    for (const organizationId of new Set([input.sourceOrganizationId, input.targetOrganizationId])) {
      const membership = await tx.customerClubMembership.findUnique({ where: { organizationId_customerId: { organizationId, customerId: input.userId } }, select: { status: true } });
      if (membership?.status !== "ACTIVE") throw new CustomerSsoError();
    }
    return user;
  }
  async issue(input: { userId: string; sourceSessionId: string; sourceOrganizationId: string; targetOrganizationId: string; targetOrigin: string; challenge: string }): Promise<{ ticket: string }> {
    this.requireEnabled();
    if (!opaque.test(input.challenge) || !input.userId || !input.sourceSessionId || !input.sourceOrganizationId || !input.targetOrganizationId || input.sourceOrganizationId === input.targetOrganizationId) throw new CustomerSsoError();
    try {
      return await (await database(this.db)).$transaction(async tx => {
        const now = this.now();
        await this.destination(tx, input.targetOrganizationId, input.targetOrigin);
        await this.principal(tx, input, now);
        const ticket = createCustomerSsoVerifier();
        await tx.customerSsoTicket.create({ data: { ticketDigest: digest(ticket, this.secret()), userId: input.userId, sourceSessionId: input.sourceSessionId, sourceOrganizationId: input.sourceOrganizationId, targetOrganizationId: input.targetOrganizationId, targetOrigin: input.targetOrigin, challenge: input.challenge, createdAt: now, expiresAt: new Date(now.getTime() + 60_000) } });
        return { ticket };
      }, { maxWait: 5000, timeout: 10_000 });
    } catch (error) {
      if (!(error instanceof CustomerSsoError)) console.warn("CUSTOMER_SSO_ISSUE_FAILED");
      throw new CustomerSsoError();
    }
  }
  /** Internal credentials DTO. The password hash must never be serialized to an HTTP/client response. */
  async redeem(input: { ticket: string; organizationId: string; origin: string; verifier: string }) {
    this.requireEnabled();
    if (!opaque.test(input.ticket) || !opaque.test(input.verifier)) throw new CustomerSsoError();
    try {
      return await (await database(this.db)).$transaction(async tx => {
        const now = this.now();
        const ticket = await tx.customerSsoTicket.findUnique({ where: { ticketDigest: digest(input.ticket, this.secret()) } });
        if (!ticket || ticket.targetOrganizationId !== input.organizationId || ticket.targetOrigin !== input.origin || ticket.consumedAt || ticket.expiresAt <= now || !opaque.test(ticket.challenge) || !timingSafeEqual(Buffer.from(ticket.challenge), Buffer.from(customerSsoChallenge(input.verifier)))) throw new CustomerSsoError();
        await this.destination(tx, input.organizationId, input.origin);
        const user = await this.principal(tx, { userId: ticket.userId, sourceSessionId: ticket.sourceSessionId, sourceOrganizationId: ticket.sourceOrganizationId, targetOrganizationId: ticket.targetOrganizationId }, now);
        const claimTime = this.now();
        const claimed = await tx.customerSsoTicket.updateMany({ where: { id: ticket.id, consumedAt: null, expiresAt: { gt: claimTime } }, data: { consumedAt: claimTime } });
        if (claimed.count !== 1) throw new CustomerSsoError();
        const session = await tx.customerPhoneSession.create({ data: { userId: user.id, organizationId: input.organizationId, expiresAt: new Date(now.getTime() + 30 * 86_400_000) } });
        return { id: user.id, name: user.name, password: user.password, locale: user.locale, theme: user.theme, phoneSessionId: session.id, organizationId: input.organizationId };
      }, { maxWait: 5000, timeout: 10_000 });
    } catch (error) {
      if (!(error instanceof CustomerSsoError)) console.warn("CUSTOMER_SSO_REDEEM_FAILED");
      throw new CustomerSsoError();
    }
  }
}
export const customerSsoService = new CustomerSsoService();
