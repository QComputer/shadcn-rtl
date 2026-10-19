import "server-only";

import { prisma } from "@/lib/db";
import { environmentInotiCredentialProvider } from "@/lib/integrations/inoti-ussd/credentials";
import { resolveInotiPaymentAccount } from "@/lib/integrations/inoti-ussd/account-routing.server";
import { inotiUssdProvider } from "@/lib/integrations/inoti-ussd/inoti-provider";
import { inotiAcceptanceSimulationAllowed, inotiLivePaymentsAllowed } from "@/lib/integrations/inoti-runtime-safety";
import { buildInotiUssdPaymentDialPrefix } from "@/lib/integrations/inoti-ussd/callback-url";

export type RetailInotiReadinessDiagnostic =
  | { ready: false; reason: string }
  | { ready: true; mode: "LIVE" | "SIMULATED"; integrationId: string; dialString: string };

function isAcceptanceLoopbackEndpoint(endpoint: string) {
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" && ["127.0.0.1", "localhost", "[::1]", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
}

/** Read-only, sanitized eligibility diagnosis. It never initiates a provider call. */
export async function diagnoseRetailInotiReadiness(organizationId: string): Promise<RetailInotiReadinessDiagnostic> {
  const liveAllowed = inotiLivePaymentsAllowed();
  const simulationAllowed = inotiAcceptanceSimulationAllowed();
  if (!liveAllowed && !simulationAllowed) return { ready: false, reason: "LIVE_PAYMENT_ROLLOUT_DISABLED" };

  const integration = await prisma.organizationIntegration.findUnique({
    where: { organizationId_provider: { organizationId, provider: "INOTI_USSD" } },
    select: { id: true, status: true, healthStatus: true, disabledAt: true, revokedAt: true,
      codeName: true, configuration: true },
  });
  if (!integration) return { ready: false, reason: "INTEGRATION_MISSING" };
  if (integration.status !== "ACTIVE" || integration.disabledAt || integration.revokedAt) {
    return { ready: false, reason: "INTEGRATION_INACTIVE" };
  }
  if (integration.healthStatus !== "CONNECTED") return { ready: false, reason: "INTEGRATION_NOT_CONNECTED" };
  const configuration = integration.configuration;
  if (!configuration || typeof configuration !== "object" || Array.isArray(configuration) ||
      configuration.paymentEnabled !== true) return { ready: false, reason: "INTEGRATION_PAYMENT_DISABLED" };
  const account = await resolveInotiPaymentAccount(organizationId, environmentInotiCredentialProvider);
  if (!account) return { ready: false, reason: "MERCHANT_ACCOUNT_OR_CREDENTIALS_NOT_READY" };

  if (simulationAllowed) {
    if (!account.profile.username || !account.profile.password || !isAcceptanceLoopbackEndpoint(account.profile.endpoint)) {
      return { ready: false, reason: "SIMULATION_REQUIRES_CREDENTIALS_AND_HTTPS_LOOPBACK" };
    }
    return {
      ready: true,
      mode: "SIMULATED",
      integrationId: integration.id,
      dialString: buildInotiUssdPaymentDialPrefix(account.codeName),
    };
  }

  const providerReadiness = inotiUssdProvider.getReadiness(account.profile);
  if (!providerReadiness.ready) return { ready: false, reason: `PROVIDER_${providerReadiness.code}` };
  return {
    ready: true,
    mode: "LIVE",
    integrationId: integration.id,
    dialString: buildInotiUssdPaymentDialPrefix(account.codeName),
  };
}

/** Read-only eligibility. This never initiates a provider call. */
export async function getRetailInotiReadiness(organizationId: string) {
  const result = await diagnoseRetailInotiReadiness(organizationId);
  if (!result.ready) return null;
  return { integrationId: result.integrationId, dialString: result.dialString };
}
