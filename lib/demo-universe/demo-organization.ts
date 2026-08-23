import "server-only";

import type { OrganizationCapabilityKey, UserRole } from "@prisma/client";
import { ApiError } from "@/lib/api-guards";
import prisma from "@/lib/db";
import { sanitizeIntegrationConfig } from "@/lib/integrations/organization-integrations";
import { isRealPilotBusinessSlug } from "@/lib/pilot-operations/real-pilot-businesses";

export const DEMO_ROLES = ["PLATFORM_ADMIN", "ORGANIZATION_OWNER", "CUSTOMER", "MANAGER", "STAFF", "DRIVER"] as const;

export type DemoRole = (typeof DEMO_ROLES)[number];

export const DEMO_ROLE_CAPABILITIES: Record<DemoRole, readonly string[]> = {
  PLATFORM_ADMIN: ["view-platform", "compare-tenants", "view-demo-ecosystem"],
  ORGANIZATION_OWNER: ["view-business-state", "manage-demo-flow", "view-customer-crm", "view-integrations"],
  CUSTOMER: ["browse", "order", "track-own-activity"],
  MANAGER: ["view-business-state", "manage-demo-flow", "view-customer-crm"],
  STAFF: ["view-assigned-work", "advance-preparation"],
  DRIVER: ["view-assigned-deliveries", "advance-delivery"],
};

export const DEMO_ROLE_INTERNAL_ROLE: Record<DemoRole, UserRole> = {
  PLATFORM_ADMIN: "SUPER_ADMIN",
  ORGANIZATION_OWNER: "ADMIN",
  CUSTOMER: "CUSTOMER",
  MANAGER: "MANAGER",
  STAFF: "STAFF",
  DRIVER: "DRIVER",
};

type DemoSettings = {
  enabled: boolean;
  roles: DemoRole[];
  capabilities?: OrganizationCapabilityKey[];
};

function isDemoRole(value: unknown): value is DemoRole {
  return typeof value === "string" && DEMO_ROLES.includes(value as DemoRole);
}

function settingsObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function parseDemoSettings(settings: unknown): DemoSettings {
  const root = settingsObject(settings);
  const demo = settingsObject(root.demo);
  return {
    enabled: demo.enabled === true,
    roles: Array.isArray(demo.roles) ? demo.roles.filter(isDemoRole) : [],
    capabilities: Array.isArray(demo.capabilities)
      ? demo.capabilities.filter((capability): capability is OrganizationCapabilityKey =>
          typeof capability === "string" &&
          ["SHOP", "APPOINTMENT", "CRM", "USSD", "LOYALTY", "IAM", "ICV", "EBC", "SMS"].includes(capability),
        )
      : undefined,
  };
}

export function validateDemoSettings(settings: unknown) {
  sanitizeIntegrationConfig(settings);
  const parsed = parseDemoSettings(settings);
  if (!parsed.enabled) return parsed;
  if (parsed.roles.length === 0) throw new ApiError(400, "Demo organizations must expose at least one demo role");
  return parsed;
}

export async function getDemoOrganization(organizationId: string) {
  const organization = await prisma.organization.findFirst({
    where: { id: organizationId, isActive: true, deletedAt: null },
    include: {
      settings: { select: { settings: true } },
      capabilities: { select: { key: true, status: true } },
      integrations: { select: { provider: true, type: true, status: true, healthStatus: true } },
    },
  });
  if (!organization) throw new ApiError(404, "Organization not found");
  const demo = isRealPilotBusinessSlug(organization.slug)
    ? { enabled: false, roles: [], capabilities: undefined }
    : parseDemoSettings(organization.settings?.settings);
  return { organization, demo };
}

export async function requireDemoOrganization(organizationId: string) {
  const result = await getDemoOrganization(organizationId);
  if (!result.demo.enabled) throw new ApiError(409, "Organization is not demo-enabled");
  return result;
}

export function requireDemoRole(settings: DemoSettings, role: string): asserts role is DemoRole {
  if (!isDemoRole(role) || !settings.roles.includes(role)) {
    throw new ApiError(403, "Demo role is not enabled for this organization");
  }
}
