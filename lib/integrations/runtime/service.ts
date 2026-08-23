import "server-only";

import { ApiError } from "@/lib/api-guards";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import { getIntegrationAdapter } from "@/lib/integrations/runtime/registry";
import { recordBusinessEvent } from "@/lib/integrations/runtime/business-events";

async function getRuntimeContext(organizationId: string, integrationId: string) {
  const integration = await prisma.organizationIntegration.findFirst({
    where: { id: integrationId, organizationId },
    include: { capabilities: true },
  });
  if (!integration) throw new ApiError(404, "Integration not found");
  return {
    organizationId: integration.organizationId,
    integrationId: integration.id,
    provider: integration.provider,
    status: integration.status,
    codeName: integration.codeName,
    credentialProfileKey: integration.credentialProfileKey,
    configuration: integration.configuration,
    capabilityKeys: integration.capabilities.map((capability) => capability.capabilityKey),
  };
}

export async function checkIntegrationRuntimeHealth(input: {
  organizationId: string;
  integrationId: string;
}) {
  const context = await getRuntimeContext(input.organizationId, input.integrationId);
  const adapter = getIntegrationAdapter(context.provider);
  const result = await adapter.checkHealth(context);

  const updated = await prisma.organizationIntegration.update({
    where: { id: input.integrationId },
    data: {
      healthStatus: result.status,
      lastHealthCheckedAt: result.checkedAt,
      lastHealthErrorCode: result.errorCode,
      lastHealthErrorMessage: result.errorMessage,
      healthMetadata: result.metadata as Prisma.InputJsonObject,
    },
    include: { capabilities: true },
  });

  await recordBusinessEvent({
    organizationId: input.organizationId,
    integrationId: input.integrationId,
    type: result.connected ? "INTEGRATION_CONNECTED" : "INTEGRATION_HEALTH_CHECKED",
    entityType: "OrganizationIntegration",
    entityId: input.integrationId,
    payload: {
      provider: updated.provider,
      type: updated.type,
      healthStatus: updated.healthStatus,
      connected: result.connected,
    },
    metadata: result.metadata,
  });

  return {
    integrationId: updated.id,
    provider: updated.provider,
    type: updated.type,
    healthStatus: updated.healthStatus,
    connected: result.connected,
    checkedAt: result.checkedAt,
    errorCode: result.errorCode,
    errorMessage: result.errorMessage,
    metadata: result.metadata,
  };
}

export async function executeIntegrationRuntimeAction(input: {
  organizationId: string;
  integrationId: string;
  action: "HEALTH_CHECK" | "BUSINESS_EVENT_RECORD" | "USSD_SESSION_START" | "SMS_SEND" | "SMS_STATUS_CHECK" | "USSD_PAYMENT_INITIATE" | "USSD_PAYMENT_VERIFY";
}) {
  const context = await getRuntimeContext(input.organizationId, input.integrationId);
  if (context.status !== "ACTIVE") throw new ApiError(409, "Integration must be ACTIVE");
  const adapter = getIntegrationAdapter(context.provider);
  const result = await adapter.executeAction(input.action, context);
  if (!result.ok) throw new ApiError(409, "Integration action is not available");
  return result;
}
