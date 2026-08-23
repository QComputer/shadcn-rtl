import "server-only";

import type {
  IntegrationHealthStatus,
  IntegrationProvider,
  OrganizationCapabilityKey,
} from "@prisma/client";
import { randomUUID } from "node:crypto";
import { sanitizeIntegrationConfig, type IntegrationConfig } from "@/lib/integrations/organization-integrations";
import { environmentInotiCredentialProvider } from "@/lib/integrations/inoti-ussd/credentials";
import { inotiUssdProvider } from "@/lib/integrations/inoti-ussd/inoti-provider";
import { inotiSmsProvider } from "@/lib/integrations/inoti-sms/provider";

export type IntegrationRuntimeAction =
  | "HEALTH_CHECK"
  | "BUSINESS_EVENT_RECORD"
  | "USSD_SESSION_START"
  | "SMS_SEND"
  | "SMS_STATUS_CHECK"
  | "USSD_PAYMENT_INITIATE"
  | "USSD_PAYMENT_VERIFY";

export type IntegrationRuntimeContext = {
  organizationId: string;
  integrationId: string;
  provider: IntegrationProvider;
  status: "DRAFT" | "ACTIVE" | "DISABLED" | "REVOKED";
  codeName: string;
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
    super("INOTI_USSD", ["USSD"], ["HEALTH_CHECK", "BUSINESS_EVENT_RECORD", "USSD_SESSION_START", "USSD_PAYMENT_INITIATE", "USSD_PAYMENT_VERIFY"]);
  }

  async checkHealth(context: IntegrationRuntimeContext): Promise<IntegrationHealthResult> {
    if (context.status !== "ACTIVE") {
      return {
        status: "BLOCKED",
        connected: false,
        checkedAt: new Date(),
        errorCode: "INTEGRATION_NOT_ACTIVE",
        errorMessage: "Integration must be ACTIVE before read-only verification can run",
        metadata: { provider: context.provider, readOnly: true, realPaymentExecution: false },
      };
    }
    const credentialProfile = await environmentInotiCredentialProvider.resolveProfile(context.organizationId, context.credentialProfileKey);
    const result = await inotiUssdProvider.probeReadOnlyPayments({
      credentialProfile,
      codeName: credentialProfile?.ussdCodeName || context.codeName,
      merchantFactorId: `BZ${randomUUID().replace(/-/g, "")}`,
    });
    return {
      status: result.ok ? "CONNECTED" : "DEGRADED",
      connected: result.ok,
      checkedAt: new Date(),
      errorCode: result.ok ? null : result.code,
      errorMessage: result.ok ? null : "iNoti USSD read-only verification did not complete",
      metadata: {
        provider: context.provider,
        readOnly: true,
        readOnlyVerification: result.code,
        codeNameConfigured: Boolean(credentialProfile?.ussdCodeName || context.codeName),
        realPaymentExecution: false,
      },
    };
  }

  async executeAction(action: IntegrationRuntimeAction, context: IntegrationRuntimeContext): Promise<IntegrationActionResult> {
    if (action === "USSD_SESSION_START") {
      return {
        ok: context.status === "ACTIVE",
        action,
        metadata: {
          provider: context.provider,
          readOnly: true,
          runtimeSessionOnly: true,
          realPaymentExecution: false,
        },
      };
    }
    if (action === "USSD_PAYMENT_INITIATE" || action === "USSD_PAYMENT_VERIFY") {
      return {
        ok: false,
        action,
        metadata: {
          provider: context.provider,
          reason: "REAL_PAYMENT_EXECUTION_DISABLED",
          realPaymentExecution: false,
        },
      };
    }
    return super.executeAction(action, context);
  }
}

export class InotiSmsAdapter extends DryRunIntegrationAdapter {
  constructor() {
    super("INOTI_SMS", ["CRM", "SMS"], ["HEALTH_CHECK", "BUSINESS_EVENT_RECORD", "SMS_SEND", "SMS_STATUS_CHECK"]);
  }

  async checkHealth(context: IntegrationRuntimeContext): Promise<IntegrationHealthResult> {
    if (context.status !== "ACTIVE") {
      return {
        status: "BLOCKED",
        connected: false,
        checkedAt: new Date(),
        errorCode: "INTEGRATION_NOT_ACTIVE",
        errorMessage: "Integration must be ACTIVE before read-only verification can run",
        metadata: { provider: context.provider, readOnly: true, realSmsExecution: false },
      };
    }
    const credentialProfile = await environmentInotiCredentialProvider.resolveSmsProfile(context.organizationId, context.credentialProfileKey);
    const result = await inotiSmsProvider.activeLinesReadOnly(credentialProfile);
    return {
      status: result.ok ? "CONNECTED" : "DEGRADED",
      connected: result.ok,
      checkedAt: new Date(),
      errorCode: result.ok ? null : result.code,
      errorMessage: result.ok ? null : "iNoti SMS ActiveLines read-only verification did not complete",
      metadata: {
        provider: context.provider,
        readOnly: true,
        readOnlyVerification: result.code,
        smsTokenConfigured: Boolean(credentialProfile?.smsToken),
        activeLineCount: result.ok ? result.activeLineCount : 0,
        lineTypes: result.ok ? result.lineTypes : [],
        realSmsExecution: false,
      },
    };
  }
}
