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
export type DashboardOrganizationCapability = PublicRouteCapability | "HOTEL_BOOKING";

/** Internal dashboard capability context. Public route projection intentionally stays SHOP/APPOINTMENT only. */
export function dashboardOrganizationCapabilities(input: {
  legacyType: OrganizationType;
  vertical: string;
  capabilitiesInitializedAt?: Date | string | null;
  capabilities?: Array<CapabilityRecord & { enabledAt?: Date | string | null }> | null;
}): DashboardOrganizationCapability[] {
  const publicCapabilities = organizationPublicRouteCapabilities(input);
  const bookingEnabled = input.vertical === "HOTEL" && Boolean(input.capabilitiesInitializedAt)
    && (input.capabilities ?? []).some((capability) => capability.key === "HOTEL_BOOKING" && capability.status === "ACTIVE" && capability.enabledAt != null);
  return [...publicCapabilities, ...(bookingEnabled ? ["HOTEL_BOOKING" as const] : [])];
}

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
