import "server-only";

import type { IntegrationProvider } from "@prisma/client";
import { ApiError } from "@/lib/api-guards";
import prisma from "@/lib/db";
import { INOTI_PLATFORM_ORGANIZATION_ID } from "@/lib/integrations/inoti-ussd/credentials";

export type InotiSmsRoutingPurpose =
  | "PLATFORM_OTP"
  | "PLATFORM_SECURITY"
  | "ORDER_EVENT"
  | "APPOINTMENT_EVENT"
  | "PAYMENT_EVENT"
  | "REVIEW_REQUEST"
  | "TRANSACTIONAL_CRM"
  | "MARKETING";

export type ResolvedInotiSmsRoute = {
  scope: "PLATFORM" | "ORGANIZATION";
  organizationId: string;
  integrationId: string | null;
  provider: IntegrationProvider;
  credentialProfileKey: string | null;
  purpose: InotiSmsRoutingPurpose;
};

export async function resolveInotiSmsRoute(input: {
  scope: "PLATFORM";
  purpose: Extract<InotiSmsRoutingPurpose, "PLATFORM_OTP" | "PLATFORM_SECURITY">;
  requestedIntegrationId?: string | null;
} | {
  scope: "ORGANIZATION";
  organizationId: string;
  purpose: Exclude<InotiSmsRoutingPurpose, "PLATFORM_OTP" | "PLATFORM_SECURITY">;
  requestedIntegrationId?: string | null;
}): Promise<ResolvedInotiSmsRoute> {
  if (input.scope === "PLATFORM") {
    if (input.requestedIntegrationId) {
      throw new ApiError(403, "Platform SMS routing does not accept organization integration IDs");
    }
    return {
      scope: "PLATFORM",
      organizationId: INOTI_PLATFORM_ORGANIZATION_ID,
      integrationId: null,
      provider: "INOTI_SMS",
      credentialProfileKey: "local-env:inoti:platform",
      purpose: input.purpose,
    };
  }

  const integration = await prisma.organizationIntegration.findFirst({
    where: {
      organizationId: input.organizationId,
      provider: "INOTI_SMS",
      status: "ACTIVE",
      ...(input.requestedIntegrationId ? { id: input.requestedIntegrationId } : {}),
    },
    select: { id: true, organizationId: true, credentialProfileKey: true, provider: true },
  });

  if (!integration) {
    if (input.requestedIntegrationId) {
      throw new ApiError(403, "Requested SMS integration is not available for this organization");
    }
    throw new ApiError(409, "Organization iNoti SMS integration is not configured");
  }

  return {
    scope: "ORGANIZATION",
    organizationId: integration.organizationId,
    integrationId: integration.id,
    provider: integration.provider,
    credentialProfileKey: integration.credentialProfileKey,
    purpose: input.purpose,
  };
}
