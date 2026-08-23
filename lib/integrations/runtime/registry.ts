import "server-only";

import type { IntegrationProvider } from "@prisma/client";
import { ApiError } from "@/lib/api-guards";
import { INTEGRATION_CATALOG } from "@/lib/integrations/organization-integrations";
import {
  DryRunIntegrationAdapter,
  InotiSmsAdapter,
  InotiUssdAdapter,
  type IntegrationAdapter,
} from "@/lib/integrations/runtime/adapters";

const adapters = {
  INOTI_USSD: new InotiUssdAdapter(),
  INOTI_SMS: new InotiSmsAdapter(),
  INOTI_IMENU: new DryRunIntegrationAdapter("INOTI_IMENU", INTEGRATION_CATALOG.INOTI_IMENU.supportedCapabilities),
  INOTI_ICV: new DryRunIntegrationAdapter("INOTI_ICV", INTEGRATION_CATALOG.INOTI_ICV.supportedCapabilities),
  INOTI_IAM: new DryRunIntegrationAdapter("INOTI_IAM", INTEGRATION_CATALOG.INOTI_IAM.supportedCapabilities),
  INOTI_EBC: new DryRunIntegrationAdapter("INOTI_EBC", INTEGRATION_CATALOG.INOTI_EBC.supportedCapabilities),
  PAYMENT: new DryRunIntegrationAdapter("PAYMENT", INTEGRATION_CATALOG.PAYMENT.supportedCapabilities),
  SMS: new DryRunIntegrationAdapter("SMS", INTEGRATION_CATALOG.SMS.supportedCapabilities),
  OTHER: new DryRunIntegrationAdapter("OTHER", INTEGRATION_CATALOG.OTHER.supportedCapabilities),
} as const satisfies Record<IntegrationProvider, IntegrationAdapter>;

export function getIntegrationAdapter(provider: IntegrationProvider): IntegrationAdapter {
  const adapter = adapters[provider];
  if (!adapter) throw new ApiError(501, `Unsupported integration provider: ${provider}`);
  return adapter;
}

export function listIntegrationAdapters() {
  return Object.values(adapters);
}
