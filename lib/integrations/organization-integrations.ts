import "server-only";

import type {
  IntegrationProvider,
  IntegrationType,
  OrganizationCapabilityKey,
  OrganizationIntegrationStatus,
  Prisma,
} from "@prisma/client";
import { ApiError } from "@/lib/api-guards";
import prisma from "@/lib/db";
import { effectiveOrganizationCapabilities } from "@/lib/organization-capabilities";

export type IntegrationConfig = Record<string, unknown>;
export type IntegrationSecret = {
  credentialProfileKey: string | null;
  configured: boolean;
};

export type IntegrationDescriptor = {
  provider: IntegrationProvider;
  type: IntegrationType;
  supportedCapabilities: readonly OrganizationCapabilityKey[];
  secretStrategy: "credentialProfile";
};

export const INTEGRATION_CATALOG = {
  INOTI_IMENU: {
    provider: "INOTI_IMENU",
    type: "IMENU",
    supportedCapabilities: ["SHOP"],
    secretStrategy: "credentialProfile",
  },
  INOTI_ICV: {
    provider: "INOTI_ICV",
    type: "ICV",
    supportedCapabilities: ["ICV"],
    secretStrategy: "credentialProfile",
  },
  INOTI_IAM: {
    provider: "INOTI_IAM",
    type: "IAM",
    supportedCapabilities: ["IAM"],
    secretStrategy: "credentialProfile",
  },
  INOTI_EBC: {
    provider: "INOTI_EBC",
    type: "EBC",
    supportedCapabilities: ["CRM", "EBC"],
    secretStrategy: "credentialProfile",
  },
  INOTI_USSD: {
    provider: "INOTI_USSD",
    type: "USSD",
    supportedCapabilities: ["USSD"],
    secretStrategy: "credentialProfile",
  },
  PAYMENT: {
    provider: "PAYMENT",
    type: "PAYMENT",
    supportedCapabilities: ["SHOP"],
    secretStrategy: "credentialProfile",
  },
  SMS: {
    provider: "SMS",
    type: "SMS",
    supportedCapabilities: ["CRM", "SMS"],
    secretStrategy: "credentialProfile",
  },
  OTHER: {
    provider: "OTHER",
    type: "OTHER",
    supportedCapabilities: [],
    secretStrategy: "credentialProfile",
  },
} as const satisfies Record<IntegrationProvider, IntegrationDescriptor>;

const SENSITIVE_CONFIG_KEY_PATTERN = /(secret|password|credential|token|api[-_]?key|private[-_]?key|username)/i;

function uniqueCapabilities(capabilities: OrganizationCapabilityKey[]) {
  return Array.from(new Set(capabilities));
}

export function sanitizeIntegrationConfig(input: unknown): IntegrationConfig {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const output: IntegrationConfig = {};
  for (const [key, value] of Object.entries(input)) {
    if (SENSITIVE_CONFIG_KEY_PATTERN.test(key)) {
      throw new ApiError(400, `Integration configuration field '${key}' must be stored as a secret reference`);
    }
    if (value === undefined) continue;
    output[key] = value;
  }
  return output;
}

function serializeIntegration(row: Prisma.OrganizationIntegrationGetPayload<{
  include: { capabilities: true };
}>) {
  return {
    id: row.id,
    publicId: row.publicId,
    organizationId: row.organizationId,
    provider: row.provider,
    type: row.type,
    status: row.status,
    codeName: row.codeName,
    displayName: row.displayName,
    externalAccountId: row.externalAccountId,
    credentialProfileKey: row.credentialProfileKey,
    secret: {
      credentialProfileKey: row.credentialProfileKey,
      configured: Boolean(row.credentialProfileKey),
    } satisfies IntegrationSecret,
    configuration: sanitizeIntegrationConfig(row.configuration),
    capabilityKeys: row.capabilities.map((capability) => capability.capabilityKey).sort(),
    callbackOrigin: row.callbackOrigin,
    lastCallbackAt: row.lastCallbackAt,
    disabledAt: row.disabledAt,
    revokedAt: row.revokedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function requireOrganizationWithCapabilities(organizationId: string) {
  const organization = await prisma.organization.findFirst({
    where: { id: organizationId, isActive: true, deletedAt: null },
    select: {
      id: true,
      slug: true,
      type: true,
      capabilitiesInitializedAt: true,
      capabilities: { select: { key: true, status: true } },
    },
  });
  if (!organization) throw new ApiError(404, "Organization not found");
  return organization;
}

async function requireCapabilityCompatibility(
  organizationId: string,
  capabilityKeys: OrganizationCapabilityKey[],
) {
  if (capabilityKeys.length === 0) return;
  const organization = await requireOrganizationWithCapabilities(organizationId);
  const effective = effectiveOrganizationCapabilities({
    legacyType: organization.type,
    capabilitiesInitializedAt: organization.capabilitiesInitializedAt,
    capabilities: organization.capabilities,
  });
  const missing = capabilityKeys.filter((capability) => !effective.includes(capability));
  if (missing.length > 0) {
    throw new ApiError(409, `Organization is missing active capabilities: ${missing.join(", ")}`);
  }
}

function defaultCapabilitiesForProvider(provider: IntegrationProvider) {
  return [...INTEGRATION_CATALOG[provider].supportedCapabilities];
}

function resolveIntegrationType(provider: IntegrationProvider, type?: IntegrationType | null) {
  return type ?? INTEGRATION_CATALOG[provider].type;
}

export async function listOrganizationIntegrations(organizationId: string) {
  await requireOrganizationWithCapabilities(organizationId);
  const rows = await prisma.organizationIntegration.findMany({
    where: { organizationId },
    include: { capabilities: true },
    orderBy: [{ type: "asc" }, { provider: "asc" }, { createdAt: "asc" }],
  });
  return rows.map(serializeIntegration);
}

export async function createOrganizationIntegration(input: {
  organizationId: string;
  provider: IntegrationProvider;
  type?: IntegrationType;
  status?: OrganizationIntegrationStatus;
  codeName: string;
  displayName?: string | null;
  externalAccountId?: string | null;
  credentialProfileKey?: string | null;
  configuration?: unknown;
  capabilityKeys?: OrganizationCapabilityKey[];
}) {
  const type = resolveIntegrationType(input.provider, input.type);
  const capabilityKeys = uniqueCapabilities(input.capabilityKeys ?? defaultCapabilitiesForProvider(input.provider));
  await requireCapabilityCompatibility(input.organizationId, capabilityKeys);
  const configuration = sanitizeIntegrationConfig(input.configuration);

  const row = await prisma.$transaction(async (tx) => {
    const integration = await tx.organizationIntegration.create({
      data: {
        organizationId: input.organizationId,
        provider: input.provider,
        type,
        status: input.status ?? "DRAFT",
        codeName: input.codeName,
        displayName: input.displayName ?? null,
        externalAccountId: input.externalAccountId ?? null,
        credentialProfileKey: input.credentialProfileKey ?? null,
        configuration: configuration as Prisma.InputJsonObject,
        disabledAt: input.status === "DISABLED" ? new Date() : null,
        revokedAt: input.status === "REVOKED" ? new Date() : null,
      },
    });
    if (capabilityKeys.length > 0) {
      await tx.organizationIntegrationCapability.createMany({
        data: capabilityKeys.map((capabilityKey) => ({
          organizationId: input.organizationId,
          integrationId: integration.id,
          capabilityKey,
        })),
      });
    }
    return tx.organizationIntegration.findUniqueOrThrow({
      where: { id: integration.id },
      include: { capabilities: true },
    });
  });
  return serializeIntegration(row);
}

export async function updateOrganizationIntegrationStatus(input: {
  organizationId: string;
  integrationId: string;
  status: OrganizationIntegrationStatus;
}) {
  const existing = await prisma.organizationIntegration.findFirst({
    where: { id: input.integrationId, organizationId: input.organizationId },
    include: { capabilities: true },
  });
  if (!existing) throw new ApiError(404, "Integration not found");
  if (existing.status === "REVOKED" && input.status !== "REVOKED") {
    throw new ApiError(409, "Revoked integration cannot be re-enabled");
  }

  if (input.status === "ACTIVE") {
    await requireCapabilityCompatibility(
      input.organizationId,
      existing.capabilities.map((capability) => capability.capabilityKey),
    );
  }

  const row = await prisma.organizationIntegration.update({
    where: { id: input.integrationId },
    data: {
      status: input.status,
      disabledAt: input.status === "DISABLED" ? new Date() : null,
      revokedAt: input.status === "REVOKED" ? existing.revokedAt ?? new Date() : null,
    },
    include: { capabilities: true },
  });
  return serializeIntegration(row);
}

export async function getOrganizationIntegration(input: {
  organizationId: string;
  integrationId: string;
}) {
  const row = await prisma.organizationIntegration.findFirst({
    where: { id: input.integrationId, organizationId: input.organizationId },
    include: { capabilities: true },
  });
  if (!row) throw new ApiError(404, "Integration not found");
  return serializeIntegration(row);
}
