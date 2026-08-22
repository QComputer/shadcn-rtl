import "server-only";

import type { IntegrationProvider, SeoContentType } from "@prisma/client";
import { sanitizeIntegrationConfig, type IntegrationConfig } from "@/lib/integrations/organization-integrations";

export type ContentProviderReadiness = {
  ready: boolean;
  dryRun: boolean;
  code: "DRY_RUN_READY" | "UNCONFIGURED" | "UNSUPPORTED_PROVIDER" | "INVALID_CONFIGURATION";
  message: string;
  metadata: IntegrationConfig;
};

export type ContentProviderRequest = {
  organizationId: string;
  contentRequestId: string;
  provider: IntegrationProvider;
  contentType: SeoContentType;
  locale: string;
  brief: {
    contentGoal: string;
    targetEntity: string;
    primaryKeyword: string | null;
    secondaryKeywords: string[];
    location: string | null;
    desiredSchemaType: string | null;
    factualContext: Record<string, unknown>;
    prohibitedClaims: string[];
    suggestedTitle: string | null;
    suggestedOutline: string[];
  };
};

export type ContentProviderResult = {
  provider: IntegrationProvider;
  providerRequestReference: string;
  providerResultReference: string;
  title: string;
  body: string;
  seoTitle: string;
  seoDescription: string;
  schemaType: string | null;
  metadata: IntegrationConfig;
};

export interface ContentProviderAdapter {
  provider: IntegrationProvider;
  validateConfiguration(config: unknown): { ok: boolean; errors: string[]; sanitized: IntegrationConfig };
  getReadiness(config?: unknown): ContentProviderReadiness;
  createContentRequest(request: ContentProviderRequest): Promise<ContentProviderResult>;
  getContentStatus(providerRequestReference: string): Promise<ContentProviderReadiness>;
  fetchContentResult(providerRequestReference: string): Promise<ContentProviderResult | null>;
}

class DryRunIamContentAdapter implements ContentProviderAdapter {
  provider: IntegrationProvider = "INOTI_IAM";

  validateConfiguration(config: unknown) {
    try {
      return { ok: true, errors: [], sanitized: sanitizeIntegrationConfig(config) };
    } catch (error) {
      return {
        ok: false,
        errors: [error instanceof Error ? error.message : "Invalid iAM configuration"],
        sanitized: {},
      };
    }
  }

  getReadiness(config?: unknown): ContentProviderReadiness {
    const validation = this.validateConfiguration(config);
    if (!validation.ok) {
      return {
        ready: false,
        dryRun: true,
        code: "INVALID_CONFIGURATION",
        message: validation.errors[0] ?? "Invalid iAM configuration",
        metadata: {},
      };
    }
    return {
      ready: true,
      dryRun: true,
      code: "DRY_RUN_READY",
      message: "iAM content adapter is available in dry-run mode only; no external request will be sent.",
      metadata: { provider: this.provider, dryRun: true, externalNetwork: false },
    };
  }

  async createContentRequest(request: ContentProviderRequest): Promise<ContentProviderResult> {
    const reference = `iam-dry-run-${request.contentRequestId}`;
    const secondary = request.brief.secondaryKeywords.length
      ? `\n\nRelated keyword candidates: ${request.brief.secondaryKeywords.join("، ")}`
      : "";
    const location = request.brief.location ? ` in ${request.brief.location}` : "";
    return {
      provider: this.provider,
      providerRequestReference: reference,
      providerResultReference: `${reference}-result`,
      title: request.brief.suggestedTitle ?? request.brief.targetEntity,
      body: [
        `Dry-run ${request.contentType} content for ${request.brief.targetEntity}${location}.`,
        request.brief.contentGoal,
        "This placeholder uses only verified BazarBaaz business data and must be reviewed before any publication.",
        secondary,
      ].filter(Boolean).join("\n\n"),
      seoTitle: request.brief.suggestedTitle ?? request.brief.targetEntity,
      seoDescription: `Draft SEO content for ${request.brief.targetEntity}`.slice(0, 160),
      schemaType: request.brief.desiredSchemaType,
      metadata: {
        dryRun: true,
        externalNetwork: false,
        provider: this.provider,
        prohibitedClaims: request.brief.prohibitedClaims,
      },
    };
  }

  async getContentStatus(): Promise<ContentProviderReadiness> {
    return this.getReadiness();
  }

  async fetchContentResult() {
    return null;
  }
}

const adapters: Partial<Record<IntegrationProvider, ContentProviderAdapter>> = {
  INOTI_IAM: new DryRunIamContentAdapter(),
};

export function getContentProviderAdapter(provider: IntegrationProvider) {
  const adapter = adapters[provider];
  if (!adapter) {
    return null;
  }
  return adapter;
}
