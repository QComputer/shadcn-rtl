import "server-only";

import type { InotiCredentialProfile, InotiCredentialProvider, InotiMerchantAccountKey } from "@/lib/integrations/inoti-ussd/types";
import prisma from "@/lib/db";

export type InotiPaymentAccountBinding = {
  merchantAccountKey: string;
  credentialProfileKey: string;
  codeName: string;
  profile: InotiCredentialProfile;
};

export async function resolveInotiPaymentAccount(
  organizationId: string,
  credentialProvider: InotiCredentialProvider,
  integration?: { id: string; credentialProfileKey: string | null; codeName: string },
): Promise<InotiPaymentAccountBinding | null> {
  // Preserve explicitly injected legacy credential providers (including existing
  // restaurant integrations). The production Environment provider implements
  // resolvePaymentAccount, so missing platform/Cafe credentials never fall back.
  if (!credentialProvider.resolvePaymentAccount) {
    if (!integration) return null;
    const profile = await credentialProvider.resolveProfile(organizationId, integration.credentialProfileKey);
    if (!profile?.profileKey) return null;
    return {
      merchantAccountKey: `LEGACY_INTEGRATION:${integration.id}`,
      credentialProfileKey: profile.profileKey,
      codeName: profile.ussdCodeName ?? integration.codeName,
      profile,
    };
  }
  const routing = await prisma.organizationInotiPaymentRouting.findUnique({
    where: { organizationId },
    select: { merchantAccountKey: true },
  });
  if (!routing) return null;
  const merchantAccountKey: InotiMerchantAccountKey = routing.merchantAccountKey;
  const profile = await credentialProvider.resolvePaymentAccount(merchantAccountKey);
  if (!profile?.profileKey || !profile.ussdCodeName) return null;
  return {
    merchantAccountKey,
    credentialProfileKey: profile.profileKey,
    codeName: profile.ussdCodeName,
    profile,
  };
}

export async function resolveBoundInotiPaymentAccount(input: {
  organizationId: string;
  merchantAccountKey: string;
  credentialProfileKey: string | null;
  merchantCodeName: string;
  credentialProvider: InotiCredentialProvider;
}) {
  if (input.merchantAccountKey.startsWith("LEGACY_INTEGRATION:")) {
    return input.credentialProvider.resolveProfile(input.organizationId, input.credentialProfileKey);
  }
  if (input.merchantAccountKey !== "PLATFORM_OWNER" && input.merchantAccountKey !== "CAFE_LEO") return null;
  const profile = await input.credentialProvider.resolvePaymentAccount?.(input.merchantAccountKey);
  if (!profile || profile.profileKey !== input.credentialProfileKey || profile.ussdCodeName !== input.merchantCodeName) return null;
  return profile;
}

export async function setOrganizationInotiPaymentRouting(input: {
  organizationId: string;
  merchantAccountKey: InotiMerchantAccountKey;
  actorUserId: string;
  reason: string;
}) {
  return prisma.$transaction(async (tx) => {
    const organization = await tx.organization.findFirst({
      where: { id: input.organizationId, isActive: true, deletedAt: null },
      select: { id: true, slug: true },
    });
    if (!organization) throw new Error("ORGANIZATION_NOT_FOUND");
    if (input.merchantAccountKey === "CAFE_LEO" && process.env.INOTI_CAFE_LEO_ORGANIZATION_ID !== organization.id) {
      throw new Error("CAFE_LEO_ORGANIZATION_ID_MISMATCH");
    }
    if (input.merchantAccountKey === "CAFE_LEO") {
      const assigned = await tx.organizationInotiPaymentRouting.findFirst({
        where: { merchantAccountKey: "CAFE_LEO" },
        select: { organizationId: true },
      });
      if (assigned && assigned.organizationId !== organization.id) {
        throw new Error("CAFE_LEO_ACCOUNT_ALREADY_ASSIGNED");
      }
    }
    const previous = await tx.organizationInotiPaymentRouting.findUnique({
      where: { organizationId: organization.id },
      select: { merchantAccountKey: true },
    });
    if (previous?.merchantAccountKey === "CAFE_LEO" && input.merchantAccountKey !== "CAFE_LEO") {
      throw new Error("CAFE_LEO_ACCOUNT_POLICY_IS_IMMUTABLE");
    }
    await tx.organizationInotiPaymentRouting.upsert({
      where: { organizationId: organization.id },
      create: {
        organizationId: organization.id,
        merchantAccountKey: input.merchantAccountKey,
        updatedByUserId: input.actorUserId,
      },
      update: {
        merchantAccountKey: input.merchantAccountKey,
        updatedByUserId: input.actorUserId,
      },
    });
    await tx.auditLog.create({
      data: {
        action: "UPDATE",
        entityType: "OrganizationInotiPaymentRouting",
        entityId: organization.id,
        description: `Updated trusted iNoti payment merchant account routing: ${input.reason.trim()}`,
        previousValue: previous ? { merchantAccountKey: previous.merchantAccountKey } : null,
        newValue: { merchantAccountKey: input.merchantAccountKey, reason: input.reason.trim() },
        userId: input.actorUserId,
        organizationId: organization.id,
        organizationSlug: organization.slug,
      },
    });
    return { organizationId: organization.id, merchantAccountKey: input.merchantAccountKey };
  });
}
