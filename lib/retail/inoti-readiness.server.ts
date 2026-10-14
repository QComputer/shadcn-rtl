import "server-only";

import { prisma } from "@/lib/db";
import { environmentInotiCredentialProvider } from "@/lib/integrations/inoti-ussd/credentials";
import { resolveInotiPaymentAccount } from "@/lib/integrations/inoti-ussd/account-routing.server";
import { inotiUssdProvider } from "@/lib/integrations/inoti-ussd/inoti-provider";
import { inotiLivePaymentsAllowed } from "@/lib/integrations/inoti-runtime-safety";
import { buildInotiUssdPaymentDialPrefix } from "@/lib/integrations/inoti-ussd/callback-url";

/** Read-only eligibility. This never initiates a provider call. */
export async function getRetailInotiReadiness(organizationId: string) {
  if (!inotiLivePaymentsAllowed()) return null;
  const integration = await prisma.organizationIntegration.findUnique({
    where: { organizationId_provider: { organizationId, provider: "INOTI_USSD" } },
    select: { id: true, status: true, healthStatus: true, disabledAt: true, revokedAt: true,
      codeName: true, configuration: true },
  });
  if (!integration || integration.status !== "ACTIVE" || integration.healthStatus !== "CONNECTED" ||
      integration.disabledAt || integration.revokedAt) return null;
  const configuration = integration.configuration;
  if (!configuration || typeof configuration !== "object" || Array.isArray(configuration) ||
      configuration.paymentEnabled !== true) return null;
  const account = await resolveInotiPaymentAccount(organizationId, environmentInotiCredentialProvider);
  if (!account || !inotiUssdProvider.getReadiness(account.profile).ready) return null;
  return {
    integrationId: integration.id,
    dialString: buildInotiUssdPaymentDialPrefix(account.codeName),
  };
}
