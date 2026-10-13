import "server-only";

import { prisma } from "@/lib/db";
import { getInotiCredentialProfileState, environmentInotiCredentialProvider } from "@/lib/integrations/inoti-ussd/credentials";
import { inotiUssdProvider } from "@/lib/integrations/inoti-ussd/inoti-provider";
import { inotiLivePaymentsAllowed } from "@/lib/integrations/inoti-runtime-safety";

/** Read-only eligibility. This never initiates a provider call. */
export async function getRetailInotiReadiness(organizationId: string) {
  if (!inotiLivePaymentsAllowed()) return null;
  const integration = await prisma.organizationIntegration.findUnique({
    where: { organizationId_provider: { organizationId, provider: "INOTI_USSD" } },
    select: { id: true, status: true, healthStatus: true, disabledAt: true, revokedAt: true,
      codeName: true, credentialProfileKey: true, configuration: true },
  });
  if (!integration || integration.status !== "ACTIVE" || integration.healthStatus !== "CONNECTED" ||
      integration.disabledAt || integration.revokedAt || !integration.credentialProfileKey) return null;
  const configuration = integration.configuration;
  if (!configuration || typeof configuration !== "object" || Array.isArray(configuration) ||
      configuration.paymentEnabled !== true) return null;
  const profileState = await getInotiCredentialProfileState({ organizationId, profileKey: integration.credentialProfileKey });
  if (profileState.state !== "CREDENTIALS_AVAILABLE" || profileState.platformOnly || !profileState.ussdDialStringConfigured) return null;
  const profile = await environmentInotiCredentialProvider.resolveProfile(organizationId, integration.credentialProfileKey);
  if (!profile?.ussdDialString || profile.ussdCodeName !== integration.codeName || !inotiUssdProvider.getReadiness(profile).ready) return null;
  return { integrationId: integration.id, dialString: profile.ussdDialString };
}
