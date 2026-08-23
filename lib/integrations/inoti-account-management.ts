import "server-only";

import type {
  IntegrationProvider,
  OrganizationCapabilityKey,
  OrganizationIntegrationStatus,
  Prisma,
} from "@prisma/client";
import prisma from "@/lib/db";
import { ApiError } from "@/lib/api-guards";
import { effectiveOrganizationCapabilities } from "@/lib/organization-capabilities";
import { sanitizeIntegrationConfig } from "@/lib/integrations/organization-integrations";
import { getIntegrationAdapter } from "@/lib/integrations/runtime/registry";
import { checkIntegrationRuntimeHealth } from "@/lib/integrations/runtime/service";
import { getInotiCredentialProfileState } from "@/lib/integrations/inoti-ussd/credentials";
import { buildInotiUssdCallbackPath, buildInotiUssdCallbackUrl } from "@/lib/integrations/inoti-ussd/callback-url";

export type InotiServiceKey = "iMenu" | "iAM" | "iCV" | "EBC" | "USSD" | "SMS";

type InotiServiceDefinition = {
  key: InotiServiceKey;
  provider: Extract<IntegrationProvider, "INOTI_IMENU" | "INOTI_IAM" | "INOTI_ICV" | "INOTI_EBC" | "INOTI_USSD" | "INOTI_SMS">;
  serviceKey: string;
  status: "AVAILABLE";
  version: "v1";
  label: string;
  description: string;
  purpose: string;
  featureMappings: string[];
  capabilityMappings: OrganizationCapabilityKey[];
  growthFeatureMappings: string[];
};

export const INOTI_SERVICE_CATALOG: readonly InotiServiceDefinition[] = [
  {
    key: "iMenu",
    provider: "INOTI_IMENU",
    serviceKey: "INOTI_IMENU",
    status: "AVAILABLE",
    version: "v1",
    label: "iMenu",
    description: "Catalog and menu service for public ordering readiness.",
    purpose: "Catalog and menu readiness",
    featureMappings: ["Catalog", "Menu setup", "Product discovery"],
    capabilityMappings: ["SHOP"],
    growthFeatureMappings: ["Catalog/menu"],
  },
  {
    key: "iAM",
    provider: "INOTI_IAM",
    serviceKey: "INOTI_IAM",
    status: "AVAILABLE",
    version: "v1",
    label: "iAM",
    description: "SEO/content growth service for page and content readiness.",
    purpose: "SEO and content page readiness",
    featureMappings: ["SEO readiness", "Content workflow", "Public page growth"],
    capabilityMappings: ["IAM"],
    growthFeatureMappings: ["SEO readiness", "Content workflow"],
  },
  {
    key: "iCV",
    provider: "INOTI_ICV",
    serviceKey: "INOTI_ICV",
    status: "AVAILABLE",
    version: "v1",
    label: "iCV",
    description: "Media/content readiness service for visual business content.",
    purpose: "Media and content readiness",
    featureMappings: ["Media assets", "Creative Studio", "Content workflow"],
    capabilityMappings: ["ICV"],
    growthFeatureMappings: ["Media assets", "Business content"],
  },
  {
    key: "EBC",
    provider: "INOTI_EBC",
    serviceKey: "INOTI_EBC",
    status: "AVAILABLE",
    version: "v1",
    label: "EBC",
    description: "Campaign and customer engagement readiness service.",
    purpose: "Campaign and customer engagement readiness",
    featureMappings: ["Campaigns", "Customer Club", "Customer engagement"],
    capabilityMappings: ["EBC", "CRM"],
    growthFeatureMappings: ["Campaigns", "Customer engagement"],
  },
  {
    key: "USSD",
    provider: "INOTI_USSD",
    serviceKey: "INOTI_USSD",
    status: "AVAILABLE",
    version: "v1",
    label: "USSD",
    description: "Customer communication readiness without app dependency.",
    purpose: "Customer communication without app dependency",
    featureMappings: ["Customer engagement", "USSD sessions", "Public customer reach"],
    capabilityMappings: ["USSD"],
    growthFeatureMappings: ["Customer communication"],
  },
  {
    key: "SMS",
    provider: "INOTI_SMS",
    serviceKey: "INOTI_SMS",
    status: "AVAILABLE",
    version: "v1",
    label: "SMS",
    description: "Transactional SMS messaging readiness through the organization's iNoti account.",
    purpose: "Transactional SMS messaging readiness",
    featureMappings: ["Order SMS", "Appointment SMS", "Payment SMS", "Review request SMS"],
    capabilityMappings: ["CRM", "SMS"],
    growthFeatureMappings: ["Customer engagement", "Transactional messaging"],
  },
] as const;

export function listInotiServiceMappings() {
  return INOTI_SERVICE_CATALOG.map((service) => ({
    serviceKey: service.serviceKey,
    key: service.key,
    provider: service.provider,
    status: service.status,
    version: service.version,
    mappedCapabilities: service.capabilityMappings,
    mappedGrowthFeatures: service.growthFeatureMappings,
    description: service.description,
    purpose: service.purpose,
  }));
}

export type InotiAccountReadModel = {
  organization: {
    id: string;
    name: string;
    slug: string;
    type: string;
    isPlatformOwner: boolean;
  };
  account: {
    status: "NOT_CONNECTED" | "DRAFT" | "CONNECTED" | "PARTIAL" | "DISABLED";
    externalAccountId: string | null;
    credentialProfileKey: string | null;
    credentialState: "NOT_CONFIGURED" | "CREDENTIALS_AVAILABLE" | "NEEDS_CREDENTIALS" | "ORGANIZATION_SCOPE_MISMATCH" | "UNSUPPORTED_CREDENTIAL_PROFILE";
    servicesDetectedAt: string | null;
    lastHealthCheckedAt: string | null;
    connectedServices: InotiServiceKey[];
    verificationState: "NOT_CONFIGURED" | "CREDENTIALS_AVAILABLE" | "AUTHENTICATION_FAILED" | "AUTHENTICATED" | "SERVICE_DISCOVERY_AVAILABLE" | "SERVICE_DISCOVERY_UNAVAILABLE" | "VERIFIED_READ_ONLY";
    ussdCodeNameConfigured: boolean;
    smsTokenConfigured: boolean;
    ussdDialStringConfigured: boolean;
  };
  services: Array<{
    key: InotiServiceKey;
    serviceKey: string;
    provider: IntegrationProvider;
    version: "v1";
    label: string;
    description: string;
    purpose: string;
    featureMappings: string[];
    growthFeatureMappings: string[];
    capabilityMappings: OrganizationCapabilityKey[];
    capabilityAvailable: boolean;
    expected: boolean;
    detected: boolean;
    status: OrganizationIntegrationStatus | "NOT_CONNECTED";
    healthStatus: string;
    integrationId: string | null;
    publicIntegrationId: string | null;
    callbackPath: string | null;
    callbackUrl: string | null;
    credentialState: "NOT_CONFIGURED" | "CREDENTIALS_AVAILABLE" | "NEEDS_CREDENTIALS" | "ORGANIZATION_SCOPE_MISMATCH" | "UNSUPPORTED_CREDENTIAL_PROFILE";
    readOnlyVerification: "NOT_CONFIGURED" | "CREDENTIALS_AVAILABLE" | "AUTHENTICATION_FAILED" | "AUTHENTICATED" | "SERVICE_DISCOVERY_AVAILABLE" | "SERVICE_DISCOVERY_UNAVAILABLE" | "VERIFIED_READ_ONLY";
    ussdCodeNameConfigured: boolean;
    smsTokenConfigured: boolean;
    ussdDialStringConfigured: boolean;
    realExecution: "DISABLED";
    action: "CREATE_DRAFT" | "CONNECT" | "CHECK_HEALTH" | "DISABLED";
  }>;
  activationImpact: Array<{
    taskKey: string;
    title: string;
    taskStatus: string;
    readinessStatus: "WAITING_FOR_INOTI_CONNECTION" | "AVAILABLE";
    waitingForInotiConnection: boolean;
    relatedServices: InotiServiceKey[];
    targetRoute: string | null;
  }>;
  safeMetadata: {
    externalProviderCalls: false;
    secretsStoredDirectly: false;
    serviceDiscoveryMode: "DRY_RUN" | "READ_ONLY_WHEN_CONFIGURED";
    realSmsEnabled: false;
    realPaymentsEnabled: false;
  };
};

function serviceForProvider(provider: IntegrationProvider) {
  return INOTI_SERVICE_CATALOG.find((service) => service.provider === provider) ?? null;
}

function providerForService(serviceKey: string) {
  const service = INOTI_SERVICE_CATALOG.find((entry) => entry.key === serviceKey);
  if (!service) throw new ApiError(400, `Unsupported iNoti service: ${serviceKey}`);
  return service.provider;
}

function typeForProvider(provider: InotiServiceDefinition["provider"]) {
  if (provider === "INOTI_IMENU") return "IMENU";
  if (provider === "INOTI_IAM") return "IAM";
  if (provider === "INOTI_ICV") return "ICV";
  if (provider === "INOTI_EBC") return "EBC";
  if (provider === "INOTI_SMS") return "SMS";
  return "USSD";
}

function normalizeServiceKeys(input: unknown): InotiServiceKey[] {
  if (!Array.isArray(input)) return [];
  return Array.from(new Set(input.map((item) => String(item)).filter((item): item is InotiServiceKey =>
    INOTI_SERVICE_CATALOG.some((service) => service.key === item),
  )));
}

async function requireOrganization(organizationId: string) {
  const organization = await prisma.organization.findFirst({
    where: { id: organizationId, isActive: true, deletedAt: null },
    select: {
      id: true,
      name: true,
      slug: true,
      type: true,
      isPlatformOwner: true,
      capabilitiesInitializedAt: true,
      capabilities: { select: { key: true, status: true } },
      activationTasks: {
        where: { category: "INTEGRATIONS" },
        select: { taskKey: true, title: true, status: true, targetRoute: true, metadata: true },
      },
    },
  });
  if (!organization) throw new ApiError(404, "Organization not found");
  return organization;
}

function organizationCapabilities(organization: Awaited<ReturnType<typeof requireOrganization>>) {
  return effectiveOrganizationCapabilities({
    legacyType: organization.type,
    capabilitiesInitializedAt: organization.capabilitiesInitializedAt,
    capabilities: organization.capabilities,
  });
}

function safeConnectionConfiguration(input: {
  externalAccountId?: string | null;
  accountLabel?: string | null;
  services: InotiServiceKey[];
}) {
  return sanitizeIntegrationConfig({
    inotiAccount: {
      externalAccountId: input.externalAccountId ?? null,
      accountLabel: input.accountLabel ?? null,
      serviceSnapshot: input.services,
      serviceDiscoveryMode: "READ_ONLY_WHEN_CONFIGURED",
      servicesDetectedAt: new Date().toISOString(),
      externalProviderCalls: false,
    },
  });
}

function verificationState(input: {
  status: OrganizationIntegrationStatus | "NOT_CONNECTED";
  healthStatus: string;
  credentialState: InotiAccountReadModel["account"]["credentialState"];
  healthMetadata?: unknown;
}): InotiAccountReadModel["account"]["verificationState"] {
  if (input.status === "NOT_CONNECTED") return "NOT_CONFIGURED";
  if (input.credentialState !== "CREDENTIALS_AVAILABLE") return input.credentialState === "NEEDS_CREDENTIALS" ? "NOT_CONFIGURED" : "AUTHENTICATION_FAILED";
  if (input.healthStatus === "CONNECTED") {
    const metadata = input.healthMetadata && typeof input.healthMetadata === "object" && !Array.isArray(input.healthMetadata)
      ? input.healthMetadata as Record<string, unknown>
      : {};
    return metadata.serviceDiscoverySupported === true ? "SERVICE_DISCOVERY_AVAILABLE" : "VERIFIED_READ_ONLY";
  }
  return "CREDENTIALS_AVAILABLE";
}

function selectSupportedCapabilities(input: {
  service: InotiServiceDefinition;
  availableCapabilities: OrganizationCapabilityKey[];
}) {
  return input.service.capabilityMappings.filter((capability) => input.availableCapabilities.includes(capability));
}

async function upsertServiceIntegration(input: {
  organizationId: string;
  service: InotiServiceDefinition;
  status: OrganizationIntegrationStatus;
  publicIntegrationId?: string | null;
  externalAccountId?: string | null;
  credentialProfileKey?: string | null;
  accountLabel?: string | null;
  availableCapabilities: OrganizationCapabilityKey[];
  actorUserId?: string | null;
}) {
  const configuration = safeConnectionConfiguration({
    externalAccountId: input.externalAccountId,
    accountLabel: input.accountLabel,
    services: [input.service.key],
  });
  const capabilityKeys = selectSupportedCapabilities({
    service: input.service,
    availableCapabilities: input.availableCapabilities,
  });

  return prisma.$transaction(async (tx) => {
    const integration = await tx.organizationIntegration.upsert({
      where: {
        organizationId_provider: {
          organizationId: input.organizationId,
          provider: input.service.provider,
        },
      },
      update: {
        status: input.status,
        type: typeForProvider(input.service.provider),
        displayName: input.service.label,
        externalAccountId: input.externalAccountId ?? null,
        credentialProfileKey: input.credentialProfileKey ?? null,
        configuration: configuration as Prisma.InputJsonObject,
        disabledAt: input.status === "DISABLED" ? new Date() : null,
      },
      create: {
        organizationId: input.organizationId,
        provider: input.service.provider,
        type: typeForProvider(input.service.provider),
        status: input.status,
        ...(input.publicIntegrationId ? { publicId: input.publicIntegrationId } : {}),
        codeName: `${input.service.key.toLowerCase()}-${input.organizationId.slice(0, 8)}`,
        displayName: input.service.label,
        externalAccountId: input.externalAccountId ?? null,
        credentialProfileKey: input.credentialProfileKey ?? null,
        configuration: configuration as Prisma.InputJsonObject,
        disabledAt: input.status === "DISABLED" ? new Date() : null,
      },
    });

    await tx.organizationIntegrationCapability.deleteMany({
      where: { organizationId: input.organizationId, integrationId: integration.id },
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

    await tx.auditLog.create({
      data: {
        action: "UPDATE",
        entityType: "OrganizationIntegration",
        entityId: integration.id,
        description: `INOTI_${input.status}`,
        newValue: {
          provider: input.service.provider,
          service: input.service.key,
          status: input.status,
          externalProviderCalls: false,
        },
        organizationId: input.organizationId,
        userId: input.actorUserId ?? null,
      },
    });

    return integration;
  });
}

export async function getInotiAccountReadModel(organizationId: string): Promise<InotiAccountReadModel> {
  const organization = await requireOrganization(organizationId);
  const availableCapabilities = organizationCapabilities(organization);
  const providers = INOTI_SERVICE_CATALOG.map((service) => service.provider);
  const integrations = await prisma.organizationIntegration.findMany({
    where: { organizationId, provider: { in: providers } },
    include: { capabilities: true },
    orderBy: [{ provider: "asc" }],
  });
  const byProvider = new Map(integrations.map((integration) => [integration.provider, integration]));
  const credentialStates: Map<IntegrationProvider, Awaited<ReturnType<typeof getInotiCredentialProfileState>>> = new Map(await Promise.all(INOTI_SERVICE_CATALOG.map(async (service) => {
    const integration = byProvider.get(service.provider);
    const state = await getInotiCredentialProfileState({
      organizationId,
      profileKey: integration?.credentialProfileKey ?? null,
    });
    return [service.provider, state] as const;
  })));
  const connected = integrations.filter((integration) => integration.status === "ACTIVE");
  const connectedServices = connected.map((integration) => serviceForProvider(integration.provider)?.key).filter(Boolean) as InotiServiceKey[];
  const firstIntegration = integrations[0] ?? null;
  const lastHealth = integrations
    .map((integration) => integration.lastHealthCheckedAt)
    .filter((date): date is Date => Boolean(date))
    .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
  const detectedAt = integrations
    .map((integration) => {
      const config = integration.configuration;
      if (!config || typeof config !== "object" || Array.isArray(config)) return null;
      const account = (config as Record<string, unknown>).inotiAccount;
      if (!account || typeof account !== "object" || Array.isArray(account)) return null;
      const value = (account as Record<string, unknown>).servicesDetectedAt;
      return typeof value === "string" ? value : null;
    })
    .find(Boolean) ?? null;

  const status =
    integrations.length === 0 ? "NOT_CONNECTED" :
    connected.length === INOTI_SERVICE_CATALOG.length ? "CONNECTED" :
    connected.length > 0 ? "PARTIAL" :
    integrations.some((integration) => integration.status === "DRAFT") ? "DRAFT" :
    "DISABLED";

  return {
    organization: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      type: organization.type,
      isPlatformOwner: organization.isPlatformOwner,
    },
    account: {
      status,
      externalAccountId: firstIntegration?.externalAccountId ?? null,
      credentialProfileKey: firstIntegration?.credentialProfileKey ?? null,
      credentialState: firstIntegration ? credentialStates.get(firstIntegration.provider)?.state ?? "NOT_CONFIGURED" : "NOT_CONFIGURED",
      servicesDetectedAt: detectedAt,
      lastHealthCheckedAt: lastHealth?.toISOString() ?? null,
      connectedServices,
      verificationState: firstIntegration ? verificationState({
        status: firstIntegration.status,
        healthStatus: firstIntegration.healthStatus,
        credentialState: credentialStates.get(firstIntegration.provider)?.state ?? "NOT_CONFIGURED",
        healthMetadata: firstIntegration.healthMetadata,
      }) : "NOT_CONFIGURED",
      ussdCodeNameConfigured: firstIntegration ? credentialStates.get(firstIntegration.provider)?.ussdCodeNameConfigured ?? false : false,
      smsTokenConfigured: firstIntegration ? credentialStates.get(firstIntegration.provider)?.smsTokenConfigured ?? false : false,
      ussdDialStringConfigured: firstIntegration ? credentialStates.get(firstIntegration.provider)?.ussdDialStringConfigured ?? false : false,
    },
    services: INOTI_SERVICE_CATALOG.map((service) => {
      const integration = byProvider.get(service.provider);
      const credentialState = credentialStates.get(service.provider)?.state ?? "NOT_CONFIGURED";
      const capabilityAvailable = service.capabilityMappings.some((capability) => availableCapabilities.includes(capability));
      const detected = Boolean(integration);
      return {
        key: service.key,
        serviceKey: service.serviceKey,
        provider: service.provider,
        version: service.version,
        label: service.label,
        description: service.description,
        purpose: service.purpose,
        featureMappings: service.featureMappings,
        growthFeatureMappings: service.growthFeatureMappings,
        capabilityMappings: service.capabilityMappings,
        capabilityAvailable,
        expected: capabilityAvailable,
        detected,
        status: integration?.status ?? "NOT_CONNECTED",
        healthStatus: integration?.healthStatus ?? "UNKNOWN",
        integrationId: integration?.id ?? null,
        publicIntegrationId: service.provider === "INOTI_USSD" ? integration?.publicId ?? null : null,
        callbackPath: service.provider === "INOTI_USSD" && integration ? buildInotiUssdCallbackPath(integration.publicId) : null,
        callbackUrl: service.provider === "INOTI_USSD" && integration ? buildInotiUssdCallbackUrl(integration.publicId) : null,
        credentialState,
        readOnlyVerification: verificationState({
          status: integration?.status ?? "NOT_CONNECTED",
          healthStatus: integration?.healthStatus ?? "UNKNOWN",
          credentialState,
          healthMetadata: integration?.healthMetadata,
        }),
        ussdCodeNameConfigured: credentialStates.get(service.provider)?.ussdCodeNameConfigured ?? false,
        smsTokenConfigured: credentialStates.get(service.provider)?.smsTokenConfigured ?? false,
        ussdDialStringConfigured: credentialStates.get(service.provider)?.ussdDialStringConfigured ?? false,
        realExecution: "DISABLED" as const,
        action: !integration ? "CREATE_DRAFT" : integration.status === "ACTIVE" ? "CHECK_HEALTH" : integration.status === "DISABLED" ? "DISABLED" : "CONNECT",
      };
    }),
    activationImpact: organization.activationTasks.map((task) => {
      const relatedServices = INOTI_SERVICE_CATALOG
        .filter((service) => JSON.stringify(task.metadata ?? {}).includes(service.key) || JSON.stringify(task.metadata ?? {}).includes(service.provider))
        .map((service) => service.key);
      const hasRelevantConnection = relatedServices.length === 0 ? connectedServices.length > 0 : relatedServices.some((service) => connectedServices.includes(service));
      return {
        taskKey: task.taskKey,
        title: task.title,
        taskStatus: task.status,
        readinessStatus: hasRelevantConnection ? "AVAILABLE" : "WAITING_FOR_INOTI_CONNECTION",
        waitingForInotiConnection: !hasRelevantConnection,
        relatedServices,
        targetRoute: task.targetRoute,
      };
    }),
    safeMetadata: {
      externalProviderCalls: false,
      secretsStoredDirectly: false,
      serviceDiscoveryMode: "READ_ONLY_WHEN_CONFIGURED",
      realSmsEnabled: false,
      realPaymentsEnabled: false,
    },
  };
}

export async function createInotiConnectionDraft(input: {
  organizationId: string;
  externalAccountId?: string | null;
  credentialProfileKey?: string | null;
  accountLabel?: string | null;
  publicIntegrationIds?: Partial<Record<InotiServiceKey, string>>;
  services: InotiServiceKey[];
  actorUserId?: string | null;
}) {
  const organization = await requireOrganization(input.organizationId);
  const availableCapabilities = organizationCapabilities(organization);
  const services = input.services.length > 0 ? input.services : INOTI_SERVICE_CATALOG.map((service) => service.key);
  for (const serviceKey of services) {
    const service = INOTI_SERVICE_CATALOG.find((entry) => entry.key === serviceKey)!;
    await upsertServiceIntegration({
      organizationId: input.organizationId,
      service,
      status: "DRAFT",
      publicIntegrationId: input.publicIntegrationIds?.[service.key] ?? null,
      externalAccountId: input.externalAccountId,
      credentialProfileKey: input.credentialProfileKey,
      accountLabel: input.accountLabel,
      availableCapabilities,
      actorUserId: input.actorUserId,
    });
  }
  return getInotiAccountReadModel(input.organizationId);
}

export async function connectInotiServices(input: {
  organizationId: string;
  externalAccountId?: string | null;
  credentialProfileKey: string;
  accountLabel?: string | null;
  services: InotiServiceKey[];
  actorUserId?: string | null;
}) {
  if (!input.credentialProfileKey || !/^[A-Za-z0-9_:-]+$/.test(input.credentialProfileKey)) {
    throw new ApiError(400, "A safe credential profile key is required");
  }
  const organization = await requireOrganization(input.organizationId);
  const availableCapabilities = organizationCapabilities(organization);
  const services = input.services.length > 0 ? input.services : INOTI_SERVICE_CATALOG.map((service) => service.key);
  for (const serviceKey of services) {
    const service = INOTI_SERVICE_CATALOG.find((entry) => entry.key === serviceKey)!;
    const adapter = getIntegrationAdapter(service.provider);
    const validation = adapter.validateConfiguration(safeConnectionConfiguration({
      externalAccountId: input.externalAccountId,
      accountLabel: input.accountLabel,
      services: [service.key],
    }));
    if (!validation.ok) throw new ApiError(400, validation.errors[0] ?? "Invalid iNoti connection");
    await upsertServiceIntegration({
      organizationId: input.organizationId,
      service,
      status: "ACTIVE",
      externalAccountId: input.externalAccountId,
      credentialProfileKey: input.credentialProfileKey,
      accountLabel: input.accountLabel,
      availableCapabilities,
      actorUserId: input.actorUserId,
    });
  }
  return getInotiAccountReadModel(input.organizationId);
}

export async function checkInotiServiceHealth(input: {
  organizationId: string;
  serviceKey?: string | null;
  actorUserId?: string | null;
}) {
  const providers = input.serviceKey ? [providerForService(input.serviceKey)] : INOTI_SERVICE_CATALOG.map((service) => service.provider);
  const integrations = await prisma.organizationIntegration.findMany({
    where: { organizationId: input.organizationId, provider: { in: providers } },
    select: { id: true },
  });
  for (const integration of integrations) {
    await checkIntegrationRuntimeHealth({ organizationId: input.organizationId, integrationId: integration.id });
  }
  await prisma.auditLog.create({
    data: {
      action: "UPDATE",
      entityType: "OrganizationIntegration",
      entityId: input.serviceKey ?? "INOTI_ACCOUNT",
      description: "INOTI_HEALTH_CHECKED",
      newValue: {
        serviceKey: input.serviceKey ?? "ALL",
        externalProviderCalls: false,
      },
      organizationId: input.organizationId,
      userId: input.actorUserId ?? null,
    },
  });
  return getInotiAccountReadModel(input.organizationId);
}

export async function disableInotiService(input: {
  organizationId: string;
  serviceKey: string;
  actorUserId?: string | null;
}) {
  const provider = providerForService(input.serviceKey);
  const integration = await prisma.organizationIntegration.findFirst({
    where: { organizationId: input.organizationId, provider },
    select: { id: true, provider: true },
  });
  if (!integration) throw new ApiError(404, "iNoti service integration not found");
  await prisma.organizationIntegration.update({
    where: { id: integration.id },
    data: { status: "DISABLED", disabledAt: new Date() },
  });
  await prisma.auditLog.create({
    data: {
      action: "UPDATE",
      entityType: "OrganizationIntegration",
      entityId: integration.id,
      description: "INOTI_SERVICE_DISABLED",
      newValue: {
        provider: integration.provider,
        serviceKey: input.serviceKey,
        externalProviderCalls: false,
      },
      organizationId: input.organizationId,
      userId: input.actorUserId ?? null,
    },
  });
  return getInotiAccountReadModel(input.organizationId);
}

export { normalizeServiceKeys };
