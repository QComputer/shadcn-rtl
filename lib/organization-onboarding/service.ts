import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { Prisma, type PrismaClient, type UserRole } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db-runtime";
import {
  bootstrapHotelOrganizationSchema, issueBoundInvitationSchema, onboardingIdempotencyKeySchema,
  redeemOrganizationInvitationSchema, type BootstrapHotelOrganizationInput, type IssueBoundInvitationInput,
} from "./contract";

import { initializeOrganizationTx } from "./initialize-organization";

type Tx = Prisma.TransactionClient;
export type OnboardingActor = { userId: string; role: UserRole };
export class OrganizationOnboardingError extends Error {
  constructor(public readonly status: number, public readonly code: string) { super(code); }
}
const fail = (status: number, code: string): never => { throw new OrganizationOnboardingError(status, code); };
const digest = (value: string) => createHash("sha256").update(value).digest("hex");

/** Existing organization, identity, invitation, membership and audit tables only. */
export class OrganizationOnboardingService {
  constructor(private readonly db: PrismaClient = defaultPrisma) {}

  private async transaction<T>(callback: (tx: Tx) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try { return await this.db.$transaction(callback, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 }); }
      catch (error) {
        // Only retry database races; every attempt rechecks persisted authority.
        if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2034", "P2002"].includes(error.code)) {
          if (attempt < 3) continue;
          return fail(409, "ONBOARDING_CONFLICT_RETRY");
        }
        throw error;
      }
    }
  }

  async assertActorTx(tx: Tx, actor: OnboardingActor, platformOnly: boolean) {
    const user = await tx.user.findFirst({ where: { id: actor.userId, isActive: true, deletedAt: null }, select: { id: true, role: true, email: true, emailVerified: true, name: true, lockedUntil: true } });
    if (!user || (user.lockedUntil && user.lockedUntil > new Date())) return fail(403, "ACTIVE_IDENTITY_REQUIRED");
    if (platformOnly && (actor.role !== "SUPER_ADMIN" || user.role !== "SUPER_ADMIN")) return fail(403, "PLATFORM_ADMIN_REQUIRED");
    return user;
  }

  private async hotel(tx: Tx, organizationId: string) {
    const organization = await tx.organization.findFirst({ where: { id: organizationId, vertical: "HOTEL", isActive: true, deletedAt: null,
      capabilities: { some: { key: "HOTEL_WEBSITE", status: "ACTIVE", enabledAt: { not: null }, disabledAt: null } },
    }, select: { id: true, slug: true } });
    return organization ?? fail(403, "ACTIVE_HOTEL_WEBSITE_REQUIRED");
  }

  private async verifyEmail(tx: Tx, userId: string, email: string) {
    // A profile can contain a historical emailVerified timestamp. Require the
    // existing verification record to attest this exact address as well.
    const proof = await tx.emailVerification.findFirst({ where: { userId, email, verifiedAt: { not: null, lte: new Date() } }, select: { id: true } });
    if (!proof) return fail(403, "VERIFIED_RECIPIENT_IDENTITY_REQUIRED");
  }

  async bootstrapHotel(actor: OnboardingActor, unparsed: BootstrapHotelOrganizationInput, key: string) {
    const input = bootstrapHotelOrganizationSchema.parse(unparsed);
    onboardingIdempotencyKeySchema.parse(key);
    const fingerprint = digest(JSON.stringify(input));
    return this.transaction(async (tx) => {
      await this.assertActorTx(tx, actor, true);
      const existing = await tx.organization.findUnique({ where: { slug: input.slug }, include: { acquisition: true } });
      if (existing) {
        const marker = existing.acquisition?.metadata as Prisma.JsonObject | null;
        if (existing.acquisition?.createdByUserId !== actor.userId || marker?.workflow !== "SECURE_HOTEL_BOOTSTRAP_V1" || marker?.key !== key || marker?.fingerprint !== fingerprint) return fail(409, "ORGANIZATION_IDENTITY_CONFLICT");
        await this.hotel(tx, existing.id);
        const property = await tx.hotelProperty.findFirst({ where: { organizationId: existing.id, slug: input.property.slug, isActive: true, deletedAt: null }, select: { id: true, slug: true } });
        if (!property) return fail(409, "BOOTSTRAP_STATE_CHANGED");
        return { organizationId: existing.id, organizationSlug: existing.slug, propertyId: property.id, propertySlug: property.slug, replayed: true };
      }
      // Prevent a key being reused for another tenant, even by the same operator.
      const duplicate = await tx.organizationAcquisition.findFirst({ where: { AND: [
        { metadata: { path: ["workflow"], equals: "SECURE_HOTEL_BOOTSTRAP_V1" } },
        { metadata: { path: ["key"], equals: key } },
      ] }, select: { id: true } });
      if (duplicate) return fail(409, "IDEMPOTENCY_CONFLICT");
      const initialized = await initializeOrganizationTx(tx, { ...input, type: "SHOP", vertical: "HOTEL", capabilities: ["HOTEL_WEBSITE"] });
      const { organization } = initialized;
      const property = initialized.property!;
      await tx.organizationAcquisition.create({ data: { organizationId: organization.id, sourceType: "BAZARBAAZ_TEAM", industryKey: "OTHER", createdByUserId: actor.userId,
        metadata: { workflow: "SECURE_HOTEL_BOOTSTRAP_V1", key, fingerprint },
      } });
      await tx.auditLog.create({ data: { action: "CREATE", entityType: "HotelOrganizationOnboarding", entityId: organization.id, userId: actor.userId,
        organizationId: organization.id, organizationSlug: organization.slug, newValue: { vertical: "HOTEL", capability: "HOTEL_WEBSITE", propertyId: property.id, bookingEnabled: false },
      } });
      return { organizationId: organization.id, organizationSlug: organization.slug, propertyId: property.id, propertySlug: property.slug, replayed: false };
    });
  }

  async invitationOrganizationTx(tx: Tx, organizationId: string) {
    const existing = await tx.organization.findUnique({ where: { id: organizationId }, select: { vertical: true } });
    // Preserve the accepted Hotel scope/error contract, including revocation.
    if (existing?.vertical === "HOTEL") return this.hotel(tx, organizationId);
    const organization = await tx.organization.findFirst({ where: { id: organizationId, isActive: true, deletedAt: null,
      capabilities: { some: { status: "ACTIVE", enabledAt: { not: null }, disabledAt: null } },
    }, select: { id: true, slug: true, vertical: true, acquisition: { select: { metadata: true } } } });
    if (!organization) return fail(403, "ACTIVE_ORGANIZATION_REQUIRED");
    if (organization.vertical === "HOTEL") return this.hotel(tx, organizationId);
    const metadata = organization.acquisition?.metadata as Prisma.JsonObject | null;
    if (metadata?.workflow !== "UNIVERSAL_PROVISIONING_V1") return fail(403, "SECURE_PROVISIONING_REQUIRED");
    return organization;
  }

  async assertInvitationRecipientTx(tx: Tx, input: Omit<IssueBoundInvitationInput, "organizationId">, organizationId?: string) {
    const recipient = await tx.user.findFirst({ where: { id: input.recipientUserId, name: input.recipientUsername, email: input.recipientEmail,
      emailVerified: { not: null }, isActive: true, deletedAt: null }, select: { id: true, role: true } });
    if (!recipient || recipient.role !== "CUSTOMER") return fail(409, "VERIFIED_RECIPIENT_IDENTITY_REQUIRED");
    await this.verifyEmail(tx, recipient.id, input.recipientEmail);
    const other = await tx.organizationMember.findFirst({ where: { userId: recipient.id, isActive: true,
      role: { in: ["ADMIN", "MANAGER", "STAFF", "DRIVER", "SUPER_ADMIN"] }, ...(organizationId ? { organizationId: { not: organizationId } } : {}),
    }, select: { id: true } });
    if (other) return fail(409, "RECIPIENT_MEMBERSHIP_CONFLICT");
    if (organizationId) {
      const membership = await tx.organizationMember.findUnique({ where: { organizationId_userId: { organizationId, userId: recipient.id } } });
      if (membership && (!membership.isActive || membership.role !== input.invitedRole)) return fail(409, "RECIPIENT_MEMBERSHIP_CONFLICT");
    }
    return recipient;
  }

  async issueInvitation(actor: OnboardingActor, input: IssueBoundInvitationInput, key: string) {
    return this.transaction((tx) => this.issueInvitationTx(tx, actor, input, key));
  }

  async issueInvitationTx(tx: Tx, actor: OnboardingActor, unparsed: IssueBoundInvitationInput, key: string) {
    const input = issueBoundInvitationSchema.parse(unparsed);
    onboardingIdempotencyKeySchema.parse(key);
    const fingerprint = digest(JSON.stringify(input));
    await this.assertActorTx(tx, actor, true);
    const organization = await this.invitationOrganizationTx(tx, input.organizationId);
    const recipient = await this.assertInvitationRecipientTx(tx, input, organization.id);
      const existing = await tx.organizationInvitation.findUnique({ where: { issuanceKey: key } });
      if (existing) {
        if (existing.createdByUserId !== actor.userId || existing.requestSha256 !== fingerprint) return fail(409, "IDEMPOTENCY_CONFLICT");
        // Secrets are never persisted or recovered on retry. Revoke/reissue with a new key if delivery was lost.
        return { invitationId: existing.id, status: existing.status, expiresAt: existing.expiresAt.toISOString(), oneTimeToken: null, replayed: true };
      }
      const token = randomBytes(32).toString("base64url");
      const invitation = await tx.organizationInvitation.create({ data: {
        organizationId: input.organizationId, recipientUserId: input.recipientUserId, recipientEmail: input.recipientEmail,
        recipientUsername: input.recipientUsername, invitedRole: input.invitedRole,
        tokenHash: digest(token), expiresAt: new Date(Date.now() + input.ttlHours * 3600000), createdByUserId: actor.userId,
        issuanceKey: key, requestSha256: fingerprint,
      } });
      await tx.auditLog.create({ data: { action: "CREATE", entityType: "BoundOrganizationInvitation", entityId: invitation.id, userId: actor.userId,
        organizationId: organization.id, organizationSlug: organization.slug, newValue: { invitedRole: input.invitedRole, recipientUserId: recipient.id },
      } });
      return { invitationId: invitation.id, status: invitation.status, expiresAt: invitation.expiresAt.toISOString(), oneTimeToken: token, replayed: false };
  }

  async redeemInvitation(actor: OnboardingActor, token: string) {
    redeemOrganizationInvitationSchema.parse({ token });
    return this.transaction(async (tx) => {
      const user = await this.assertActorTx(tx, actor, false);
      const invitation = await tx.organizationInvitation.findUnique({ where: { tokenHash: digest(token) } });
      if (!invitation || !invitation.recipientUserId || invitation.recipientUserId !== user.id) return fail(404, "INVITATION_INVALID");
      if (user.role !== "CUSTOMER" || !user.emailVerified || user.email !== invitation.recipientEmail || user.name !== invitation.recipientUsername) return fail(403, "VERIFIED_RECIPIENT_IDENTITY_REQUIRED");
      await this.verifyEmail(tx, user.id, invitation.recipientEmail);
      if (invitation.status === "REVOKED") return fail(410, "INVITATION_REVOKED");
      if (invitation.status === "CLAIMED") return fail(409, "INVITATION_ALREADY_USED");
      if (invitation.status === "EXPIRED" || invitation.expiresAt <= new Date()) return fail(410, "INVITATION_EXPIRED");
      if (!["CREATED", "SENT"].includes(invitation.status) || !["ADMIN", "MANAGER"].includes(invitation.invitedRole)) return fail(409, "INVITATION_STATE_CONFLICT");
      const organization = await this.invitationOrganizationTx(tx, invitation.organizationId);
      const otherMembership = await tx.organizationMember.findFirst({ where: { userId: user.id, isActive: true, organizationId: { not: organization.id }, role: { in: ["ADMIN", "MANAGER", "STAFF", "DRIVER", "SUPER_ADMIN"] } }, select: { id: true } });
      if (otherMembership) return fail(409, "RECIPIENT_MEMBERSHIP_CONFLICT");
      const prior = await tx.organizationMember.findUnique({ where: { organizationId_userId: { organizationId: organization.id, userId: user.id } } });
      if (prior && (!prior.isActive || prior.role !== invitation.invitedRole)) return fail(409, "RECIPIENT_MEMBERSHIP_CONFLICT");
      const claimed = await tx.organizationInvitation.updateMany({ where: { id: invitation.id, status: { in: ["CREATED", "SENT"] }, expiresAt: { gt: new Date() } }, data: { status: "CLAIMED", claimedByUserId: user.id } });
      if (claimed.count !== 1) return fail(409, "INVITATION_STATE_CONFLICT");
      const membership = prior ?? await tx.organizationMember.create({ data: { organizationId: organization.id, organizationSlug: organization.slug, userId: user.id, role: invitation.invitedRole } });
      // Team navigation context only: never promote User.role to ADMIN/MANAGER/SUPER_ADMIN.
      await tx.user.update({ where: { id: user.id }, data: { isTeamMember: true } });
      await tx.auditLog.create({ data: { action: "UPDATE", entityType: "BoundOrganizationInvitation", entityId: invitation.id, userId: user.id,
        organizationId: organization.id, organizationSlug: organization.slug, newValue: { status: "CLAIMED", membershipId: membership.id, role: membership.role },
      } });
      return { organizationId: organization.id, organizationSlug: organization.slug, role: membership.role, reauthenticationRequired: true };
    });
  }

  async revokeInvitation(actor: OnboardingActor, invitationId: string) {
    return this.transaction(async (tx) => {
      await this.assertActorTx(tx, actor, true);
      const invitation = await tx.organizationInvitation.findUnique({ where: { id: invitationId } });
      if (!invitation?.recipientUserId) return fail(404, "INVITATION_INVALID");
      if (invitation.status === "REVOKED") return { revoked: true, replayed: true };
      if (invitation.status === "CLAIMED") return fail(409, "INVITATION_ALREADY_USED");
      const changed = await tx.organizationInvitation.updateMany({ where: { id: invitationId, status: { in: ["CREATED", "SENT", "EXPIRED"] } }, data: { status: "REVOKED" } });
      if (changed.count !== 1) return fail(409, "INVITATION_STATE_CONFLICT");
      const organization = await tx.organization.findUniqueOrThrow({ where: { id: invitation.organizationId }, select: { slug: true } });
      await tx.auditLog.create({ data: { action: "UPDATE", entityType: "BoundOrganizationInvitation", entityId: invitation.id, userId: actor.userId,
        organizationId: invitation.organizationId, organizationSlug: organization.slug, newValue: { status: "REVOKED" },
      } });
      return { revoked: true, replayed: false };
    });
  }
}
