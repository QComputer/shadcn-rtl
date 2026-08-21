import "server-only";

import type {
  IntegrationHealthStatus,
  IntegrationProvider,
  OrganizationCapabilityKey,
} from "@prisma/client";
import { sanitizeIntegrationConfig, type IntegrationConfig } from "@/lib/integrations/organization-integrations";

export type IntegrationRuntimeAction =
  | "HEALTH_CHECK"
  | "BUSINESS_EVENT_RECORD"
  | "USSD_SESSION_START";

export type IntegrationRuntimeContext = {
  organizationId: string;
  integrationId: string;
  provider: IntegrationProvider;
  status: "DRAFT" | "ACTIVE" | "DISABLED" | "REVOKED";
  credentialProfileKey: string | null;
  configuration: unknown;
  capabilityKeys: OrganizationCapabilityKey[];
};

export type IntegrationHealthResult = {
  status: IntegrationHealthStatus;
  connected: boolean;
  checkedAt: Date;
  errorCode: string | null;
  errorMessage: string | null;
  metadata: IntegrationConfig;
};

export type IntegrationActionResult = {
  ok: boolean;
  action: IntegrationRuntimeAction;
  metadata: IntegrationConfig;
};

export interface IntegrationAdapter {
  provider: IntegrationProvider;
  supportedActions: readonly IntegrationRuntimeAction[];
  supportedCapabilities: readonly OrganizationCapabilityKey[];
  validateConfiguration(config: unknown): { ok: boolean; errors: string[]; sanitized: IntegrationConfig };
  checkHealth(context: IntegrationRuntimeContext): Promise<IntegrationHealthResult>;
  executeAction(action: IntegrationRuntimeAction, context: IntegrationRuntimeContext): Promise<IntegrationActionResult>;
}

export class DryRunIntegrationAdapter implements IntegrationAdapter {
  constructor(
    public readonly provider: IntegrationProvider,
    public readonly supportedCapabilities: readonly OrganizationCapabilityKey[],
    public readonly supportedActions: readonly IntegrationRuntimeAction[] = ["HEALTH_CHECK", "BUSINESS_EVENT_RECORD"],
  ) {}

  validateConfiguration(config: unknown) {
    try {
      return { ok: true, errors: [], sanitized: sanitizeIntegrationConfig(config) };
    } catch (error) {
      return {
        ok: false,
        errors: [error instanceof Error ? error.message : "Invalid integration configuration"],
        sanitized: {},
      };
    }
  }

  async checkHealth(context: IntegrationRuntimeContext): Promise<IntegrationHealthResult> {
    const validation = this.validateConfiguration(context.configuration);
    if (!validation.ok) {
      return {
        status: "BLOCKED",
        connected: false,
        checkedAt: new Date(),
        errorCode: "INVALID_CONFIGURATION",
        errorMessage: validation.errors[0] ?? "Invalid integration configuration",
        metadata: {},
      };
    }

    if (context.status !== "ACTIVE") {
      return {
        status: "BLOCKED",
        connected: false,
        checkedAt: new Date(),
        errorCode: "INTEGRATION_NOT_ACTIVE",
        errorMessage: "Integration must be ACTIVE before runtime actions can run",
        metadata: { dryRun: true, provider: context.provider },
      };
    }

    return {
      status: "CONNECTED",
      connected: true,
      checkedAt: new Date(),
      errorCode: null,
      errorMessage: null,
      metadata: { dryRun: true, provider: context.provider },
    };
  }

  async executeAction(action: IntegrationRuntimeAction, context: IntegrationRuntimeContext): Promise<IntegrationActionResult> {
    if (!this.supportedActions.includes(action)) {
      return { ok: false, action, metadata: { reason: "UNSUPPORTED_ACTION", provider: context.provider } };
    }
    const health = await this.checkHealth(context);
    return { ok: health.connected, action, metadata: health.metadata };
  }
}

export class InotiUssdAdapter extends DryRunIntegrationAdapter {
  constructor() {
    super("INOTI_USSD", ["USSD"], ["HEALTH_CHECK", "BUSINESS_EVENT_RECORD", "USSD_SESSION_START"]);
  }
}
