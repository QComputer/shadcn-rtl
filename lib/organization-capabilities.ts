import type {
  OrganizationCapabilityKey,
  OrganizationCapabilityStatus,
  OrganizationType,
} from "@prisma/client";

export type CapabilityRecord = {
  key: OrganizationCapabilityKey;
  status: OrganizationCapabilityStatus;
};

export type PublicRouteCapability = Extract<OrganizationCapabilityKey, "SHOP" | "APPOINTMENT">;

export function effectiveOrganizationCapabilities(input: {
  legacyType: OrganizationType;
  capabilitiesInitializedAt?: Date | string | null;
  capabilities?: CapabilityRecord[] | null;
}): OrganizationCapabilityKey[] {
  if (!input.capabilitiesInitializedAt) return [input.legacyType];

  return Array.from(
    new Set(
      (input.capabilities ?? [])
        .filter((capability) => capability.status === "ACTIVE")
        .map((capability) => capability.key),
    ),
  );
}

export function hasOrganizationCapability(
  input: Parameters<typeof effectiveOrganizationCapabilities>[0],
  capability: OrganizationCapabilityKey,
) {
  return effectiveOrganizationCapabilities(input).includes(capability);
}

export function organizationPublicRouteCapabilities(
  input: Parameters<typeof effectiveOrganizationCapabilities>[0],
): PublicRouteCapability[] {
  return effectiveOrganizationCapabilities(input).filter(
    (capability): capability is PublicRouteCapability => capability === "SHOP" || capability === "APPOINTMENT",
  );
}

export function legacyTypeForCapabilities(
  capabilities: OrganizationCapabilityKey[],
  fallback: OrganizationType = "SHOP",
): OrganizationType {
  const legacy = capabilities.find((capability) => capability === "SHOP" || capability === "APPOINTMENT");
  return legacy ?? fallback;
}
