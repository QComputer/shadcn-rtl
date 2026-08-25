import type { OrganizationCapabilityKey, OrganizationCapabilityStatus } from "@prisma/client";
import {
  BUSINESS_CAPABILITIES,
  BUSINESS_CAPABILITY_REGISTRY,
  type BusinessCapability,
} from "./business-capability-registry";

export const DEFAULT_PUBLIC_CAPABILITY_SETTINGS_KEY = "defaultPublicCapability";

export type PublicBusinessCapabilityRecord = {
  key: OrganizationCapabilityKey;
  status: OrganizationCapabilityStatus | string;
};

export type OrganizationPublicHome =
  | {
      kind: "business";
      capability: BusinessCapability;
      publicSurface: (typeof BUSINESS_CAPABILITY_REGISTRY)[BusinessCapability]["publicSurface"];
      publicEntryPath: (typeof BUSINESS_CAPABILITY_REGISTRY)[BusinessCapability]["publicEntryPath"];
    }
  | {
      kind: "generic";
      reason: "NO_PUBLIC_CAPABILITY" | "MULTIPLE_WITHOUT_VALID_DEFAULT";
    };

const PUBLIC_BUSINESS_CAPABILITY_SET = new Set<OrganizationCapabilityKey>(
  BUSINESS_CAPABILITIES as readonly OrganizationCapabilityKey[],
);

export function isPublicBusinessCapability(
  capability: OrganizationCapabilityKey | string | null | undefined,
): capability is BusinessCapability {
  return PUBLIC_BUSINESS_CAPABILITY_SET.has(capability as OrganizationCapabilityKey);
}

export function activePublicBusinessCapabilities(
  capabilities: PublicBusinessCapabilityRecord[] | null | undefined,
): BusinessCapability[] {
  return Array.from(
    new Set(
      (capabilities ?? [])
        .filter((capability) => capability.status === "ACTIVE")
        .map((capability) => capability.key)
        .filter(isPublicBusinessCapability),
    ),
  );
}

function settingsObject(settings: unknown): Record<string, unknown> {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return {};
  }

  return { ...(settings as Record<string, unknown>) };
}

export function getConfiguredDefaultPublicCapability(settings: unknown): BusinessCapability | null {
  const value = settingsObject(settings)[DEFAULT_PUBLIC_CAPABILITY_SETTINGS_KEY];
  return isPublicBusinessCapability(value as string) ? value as BusinessCapability : null;
}

export function writeDefaultPublicCapabilitySetting(
  settings: unknown,
  capability: BusinessCapability | null,
): Record<string, unknown> | null {
  const next = settingsObject(settings);

  if (capability) {
    next[DEFAULT_PUBLIC_CAPABILITY_SETTINGS_KEY] = capability;
    return next;
  }

  delete next[DEFAULT_PUBLIC_CAPABILITY_SETTINGS_KEY];
  return Object.keys(next).length > 0 ? next : null;
}

export function assertDefaultPublicCapabilityAllowed(input: {
  selected: BusinessCapability | null;
  activePublicCapabilities: readonly BusinessCapability[];
}) {
  if (!input.selected) return;

  if (!input.activePublicCapabilities.includes(input.selected)) {
    throw new Error("Default public capability must be an active public business capability");
  }
}

export function resolveOrganizationPublicHome(input: {
  capabilities: PublicBusinessCapabilityRecord[] | null | undefined;
  settings?: unknown;
}): OrganizationPublicHome {
  const activeCapabilities = activePublicBusinessCapabilities(input.capabilities);

  if (activeCapabilities.length === 0) {
    return { kind: "generic", reason: "NO_PUBLIC_CAPABILITY" };
  }

  if (activeCapabilities.length === 1) {
    const capability = activeCapabilities[0];
    return {
      kind: "business",
      capability,
      publicSurface: BUSINESS_CAPABILITY_REGISTRY[capability].publicSurface,
      publicEntryPath: BUSINESS_CAPABILITY_REGISTRY[capability].publicEntryPath,
    };
  }

  const configuredDefault = getConfiguredDefaultPublicCapability(input.settings);
  if (configuredDefault && activeCapabilities.includes(configuredDefault)) {
    return {
      kind: "business",
      capability: configuredDefault,
      publicSurface: BUSINESS_CAPABILITY_REGISTRY[configuredDefault].publicSurface,
      publicEntryPath: BUSINESS_CAPABILITY_REGISTRY[configuredDefault].publicEntryPath,
    };
  }

  return { kind: "generic", reason: "MULTIPLE_WITHOUT_VALID_DEFAULT" };
}
