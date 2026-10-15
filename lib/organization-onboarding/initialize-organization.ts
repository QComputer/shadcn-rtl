import type { Prisma, OrganizationType, OrganizationCapabilityKey } from "@prisma/client";
import type { BusinessVertical } from "@/lib/business-verticals";

/** Shared database-only initializer; caller owns authorization, transaction,
 * approval, idempotency and audit. No provider operations or domain activation. */
export async function initializeOrganizationTx(tx: Prisma.TransactionClient, input: {
  name: string; slug: string; type: OrganizationType; vertical: BusinessVertical | null;
  locale: string; capabilities: readonly OrganizationCapabilityKey[]; property?: { name: string; slug: string };
}) {
  const now = new Date();
  const organization = await tx.organization.create({ data: {
    name: input.name, slug: input.slug, type: input.type, vertical: input.vertical, locale: input.locale,
    isOpen: false, capabilitiesInitializedAt: now,
    capabilities: { create: input.capabilities.map((key) => ({ key, status: "ACTIVE", enabledAt: now })) },
  } });
  await tx.organizationSettings.create({ data: { organizationSlug: organization.slug } });
  await tx.paymentSettings.create({ data: { organizationSlug: organization.slug, paymentCondition: false } });
  if (input.capabilities.includes("APPOINTMENT")) await tx.bookingSettings.create({ data: { organizationSlug: organization.slug, autoConfirm: false } });
  // No tenant icon/logo impersonation; incomplete tenant PWA remains non-installable.
  await tx.organizationBranding.create({ data: { organizationId: organization.id, displayName: input.name, shortName: input.name.slice(0, 30) } });
  const property = input.vertical === "HOTEL" && input.property
    ? await tx.hotelProperty.create({ data: { organizationId: organization.id, organizationSlug: organization.slug, name: input.property.name, slug: input.property.slug } }) : null;
  return { organization, property };
}
