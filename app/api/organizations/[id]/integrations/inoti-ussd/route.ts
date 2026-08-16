import { NextRequest, NextResponse } from "next/server";
import { ApiError, jsonError, requireAuthSession } from "@/lib/api-guards";
import prisma from "@/lib/db";
import { inotiUssdProvider } from "@/lib/integrations/inoti-ussd/inoti-provider";
import { environmentInotiCredentialProvider } from "@/lib/integrations/inoti-ussd/credentials";
import { requireTenantContext } from "@/lib/tenant-context";
import { updateInotiUssdIntegrationSchema } from "@/lib/validators/inoti-ussd";

function safeConfiguration(value: unknown) {
  const config = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  return {
    orderStatusEnabled: config.orderStatusEnabled === true,
    paymentEnabled: config.paymentEnabled === true,
  };
}

function resolvePlatformOrigin() {
  const appUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "";
  try {
    const url = new URL(appUrl);
    return `${url.protocol}//${url.host}`;
  } catch {
    return "";
  }
}

async function resolveCallbackOrigin(integration: {
  callbackOrigin: string | null;
  organizationId: string;
}): Promise<string | null> {
  if (integration.callbackOrigin) {
    return integration.callbackOrigin;
  }

  const primaryDomain = await prisma.organizationDomain.findFirst({
    where: {
      organizationId: integration.organizationId,
      status: "ACTIVE",
      isPrimary: true,
    },
    select: { normalizedDomain: true },
  });

  if (primaryDomain?.normalizedDomain) {
    return `https://${primaryDomain.normalizedDomain}`;
  }

  const platformOrigin = resolvePlatformOrigin();
  return platformOrigin || null;
}

function serializeIntegration(
  integration: {
    id: string;
    publicId: string;
    status: "DRAFT" | "ACTIVE" | "DISABLED" | "REVOKED";
    codeName: string;
    credentialProfileKey: string | null;
    configuration: unknown;
    callbackOrigin: string | null;
    lastCallbackAt: Date | null;
    disabledAt: Date | null;
    revokedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  } | null,
  callbackUrl: string | null,
  credentialConfigured: boolean,
) {
  if (!integration) return { configured: false };
  return {
    configured: true,
    id: integration.id,
    publicId: integration.publicId,
    provider: "INOTI_USSD",
    status: integration.status,
    codeName: integration.codeName,
    credentialProfileKey: integration.credentialProfileKey,
    credentialConfigured,
    configuration: safeConfiguration(integration.configuration),
    callbackPath: `/api/integrations/inoti/ussd/${integration.publicId}`,
    callbackUrl,
    lastCallbackAt: integration.lastCallbackAt,
    disabledAt: integration.disabledAt,
    revokedAt: integration.revokedAt,
    createdAt: integration.createdAt,
    updatedAt: integration.updatedAt,
  };
}

async function findIntegration(organizationId: string) {
  return prisma.organizationIntegration.findUnique({
    where: { organizationId_provider: { organizationId, provider: "INOTI_USSD" } },
    select: {
      id: true,
      publicId: true,
      organizationId: true,
      status: true,
      codeName: true,
      credentialProfileKey: true,
      configuration: true,
      callbackOrigin: true,
      lastCallbackAt: true,
      disabledAt: true,
      revokedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { id } = await params;
    await requireTenantContext(session, id, ["ADMIN", "MANAGER"]);
    const integration = await findIntegration(id);
    if (!integration) {
      return NextResponse.json({ configured: false });
    }

    const credentialProfile = await environmentInotiCredentialProvider.resolveProfile(id, integration.credentialProfileKey);
    const credentialConfigured = Boolean(credentialProfile);
    const callbackOrigin = await resolveCallbackOrigin(integration);
    const callbackUrl = callbackOrigin ? `${callbackOrigin}/api/integrations/inoti/ussd/${integration.publicId}` : null;

    return NextResponse.json(serializeIntegration(integration, callbackUrl, credentialConfigured));
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { id } = await params;
    const tenant = await requireTenantContext(session, id, ["ADMIN", "MANAGER"]);
    const parsed = updateInotiUssdIntegrationSchema.safeParse(await request.json());
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Invalid integration settings");

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.organizationIntegration.findUnique({
        where: { organizationId_provider: { organizationId: id, provider: "INOTI_USSD" } },
      });
      if (existing?.status === "REVOKED" && parsed.data.status !== "REVOKED") {
        throw new ApiError(409, "Revoked integration cannot be re-enabled");
      }

      const integration = await tx.organizationIntegration.upsert({
        where: { organizationId_provider: { organizationId: id, provider: "INOTI_USSD" } },
        create: {
          organizationId: id,
          provider: "INOTI_USSD",
          codeName: parsed.data.codeName,
          status: parsed.data.status,
          credentialProfileKey: parsed.data.credentialProfileKey,
          configuration: {
            orderStatusEnabled: parsed.data.orderStatusEnabled,
            paymentEnabled: parsed.data.paymentEnabled,
          },
          disabledAt: parsed.data.status === "DISABLED" ? new Date() : null,
          revokedAt: parsed.data.status === "REVOKED" ? new Date() : null,
        },
        update: {
          codeName: parsed.data.codeName,
          status: parsed.data.status,
          credentialProfileKey: parsed.data.credentialProfileKey,
          configuration: {
            orderStatusEnabled: parsed.data.orderStatusEnabled,
            paymentEnabled: parsed.data.paymentEnabled,
          },
          disabledAt: parsed.data.status === "DISABLED" ? new Date() : null,
          revokedAt: parsed.data.status === "REVOKED" ? existing?.revokedAt ?? new Date() : null,
        },
      });
      await tx.auditLog.create({
        data: {
          action: existing ? "UPDATE" : "CREATE",
          entityType: "OrganizationIntegration",
          entityId: integration.id,
          description: "iNoti USSD integration settings updated",
          previousValue: existing ? {
            status: existing.status,
            codeName: existing.codeName,
            credentialProfileKey: existing.credentialProfileKey,
            configuration: safeConfiguration(existing.configuration),
          } : undefined,
          newValue: {
            provider: "INOTI_USSD",
            status: integration.status,
            codeName: integration.codeName,
            credentialProfileKey: integration.credentialProfileKey,
            configuration: safeConfiguration(integration.configuration),
          },
          userId: tenant.actorUserId,
          organizationId: tenant.organizationId,
          organizationSlug: tenant.organizationSlug,
        },
      });
      return integration;
    });

    const credentialProfile = await environmentInotiCredentialProvider.resolveProfile(id, result.credentialProfileKey);
    const credentialConfigured = Boolean(credentialProfile);
    const callbackOrigin = await resolveCallbackOrigin(result);
    const callbackUrl = callbackOrigin ? `${callbackOrigin}/api/integrations/inoti/ussd/${result.publicId}` : null;

    return NextResponse.json(serializeIntegration(result, callbackUrl, credentialConfigured));
  } catch (error) {
    return jsonError(error);
  }
}
