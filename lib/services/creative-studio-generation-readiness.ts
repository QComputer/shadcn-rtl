import "server-only";

import {
  checkAiMediaServiceReadiness,
  getAiMediaServiceConfigStatus,
  type AiMediaServiceReadiness,
} from "@/lib/services/ai-media-service-client";
import { getAiMediaPaidProviderStatus } from "@/lib/services/ai-media-paid-provider";
import { getOrganizationBrandProviderStatus } from "@/lib/services/creative-studio-organization-brand-provider";
import { getAiMediaCapabilitySummary } from "@/lib/services/ai-media-capability-registry";

export type CreativeStudioGenerationReadiness = {
  phase: "P112";
  generationRequestEnabled: boolean;
  generationUiEnabled: boolean;
  browserWorkerCallsAllowed: false;
  serverOnly: true;
  noNewProviders: true;
  service: ReturnType<typeof getAiMediaServiceConfigStatus>;
  paidProvider: ReturnType<typeof getAiMediaPaidProviderStatus>;
  organizationBrandProvider: ReturnType<typeof getOrganizationBrandProviderStatus>;
  capabilities: ReturnType<typeof getAiMediaCapabilitySummary>;
  remote: Pick<AiMediaServiceReadiness, "ok" | "checked" | "checks"> | null;
  contract: {
    version: "ai-media-product-image-suggestions-v1";
    upstream: "AI_MEDIA_SERVICE";
    createEndpoint: "/v1/product-image-suggestions/jobs";
    statusEndpoint: "/v1/product-image-suggestions/jobs/{jobId}";
    cancelEndpoint: "/v1/product-image-suggestions/jobs/{jobId}/cancel";
    supportedTargets: Array<{
      targetType: "PRODUCT";
      assetType: "PRODUCT_IMAGE";
      targetField: "product.image";
    }>;
    unsupportedTargets: Array<"ORGANIZATION_BRAND" | "FANPAGE_POST" | "CAMPAIGN" | "IMPORTED_MEDIA">;
    requiredCreateFields: Array<
      | "organization_id"
      | "product_id"
      | "requested_by_user_id"
      | "product_title"
      | "category"
    >;
    optionalCreateFields: Array<
      | "description"
      | "seller_prompt"
      | "brand"
      | "input_images"
      | "count"
      | "aspect_ratio"
      | "style_preset"
    >;
    outputFields: Array<"job_id" | "status" | "provider" | "outputs" | "output_images">;
    persistencePlan: {
      job: "CreativeStudioJob";
      asset: "CreativeStudioAsset";
      usage: "CreativeStudioUsageEvent";
      publicMutation: "deferred-to-P110-apply-controls";
    };
  };
  organizationBrandPlan: {
    phase: "P114";
    targetType: "ORGANIZATION_BRAND";
    generationRequestEnabled: false;
    generationUiEnabled: false;
    requestControlsPhase: "P115";
    requestControlsEnabled: true;
    providerExecutionGatePhase: "P117";
    providerExecutionRequested: boolean;
    providerExecutionConfigured: boolean;
    providerExecutionExplicitlyEnabled: boolean;
    providerExecutionDryRun: boolean;
    providerExecutionMode: "disabled" | "dry-run" | "provider-requested";
    providerExecutionEnabled: boolean;
    requestOnlyJobPersistence: true;
    providerContractReady: boolean;
    rolloutGate: ReturnType<typeof getOrganizationBrandProviderStatus>;
    selectionStillRequired: true;
    applyStillRequiresConfirmation: true;
    publicAutoApplyAllowed: false;
    supportedAssets: Array<{
      assetType: "LOGO" | "COVER";
      targetField: "organization.logo" | "organization.coverImage";
      recommendedAspectRatio: "1:1" | "16:9";
      publicApplyPath: "P110 confirmation-gated apply controls";
    }>;
    requiredProviderContract: {
      version: "unavailable-live-contract";
      upstream: "AI_MEDIA_SERVICE";
      createEndpoint: null;
      statusEndpoint: null;
      cancelEndpoint: null;
      requiredCreateFields: string[];
      optionalCreateFields: string[];
      outputFields: string[];
      unavailableReason: "live-openapi-does-not-expose-organization-brand-endpoints";
    };
    readinessChecklist: Array<
      | "server-only-provider-calls"
      | "settings-manage-permission"
      | "draft-asset-persistence"
      | "selected-candidate-review"
      | "manual-apply-confirmation"
      | "all-locale-cache-revalidation"
      | "provider-execution-approval"
      | "provider-rollback-control"
      | "secret-safe-status"
    >;
    blockers: string[];
  };
  blockers: string[];
    nextPhase: "P120E — SMS delivery reports and provider reconciliation";
};

export async function getCreativeStudioGenerationReadiness(options: { checkRemote?: boolean } = {}): Promise<CreativeStudioGenerationReadiness> {
  const service = getAiMediaServiceConfigStatus();
  const paidProvider = getAiMediaPaidProviderStatus();
  const capabilities = getAiMediaCapabilitySummary();
  const organizationBrandProvider = getOrganizationBrandProviderStatus();
  const remote = options.checkRemote ? await checkAiMediaServiceReadiness() : null;
  const blockers: string[] = [];

  if (!service.enabled) blockers.push("AI_MEDIA_SERVICE_ENABLED is not true");
  if (!service.urlConfigured) blockers.push("AI_MEDIA_SERVICE_URL is not configured");
  if (!service.internalKeyConfigured) blockers.push("AI_MEDIA_SERVICE_INTERNAL_KEY is not configured");
  if (paidProvider.rollback.paused) blockers.push("AI media paid-provider rollout is paused");
  if (remote && !remote.ok) blockers.push("AI media service remote readiness check failed");
  const productImageGenerationEnabled = service.ready && !paidProvider.rollback.paused;
  const organizationBrandBlockers = [
    ...(organizationBrandProvider.requested ? [] : ["Organization brand provider execution rollout is not requested"]),
    ...organizationBrandProvider.issues
      .filter((issue) => issue !== "not-requested")
      .map((issue) => `Organization brand provider gate issue: ${issue}`),
    "Public logo/cover apply still requires selected asset and confirmation",
  ];

  return {
    phase: "P112",
    generationRequestEnabled: productImageGenerationEnabled,
    generationUiEnabled: productImageGenerationEnabled,
    browserWorkerCallsAllowed: false,
    serverOnly: true,
    noNewProviders: true,
    service,
    paidProvider,
    organizationBrandProvider,
    capabilities,
    remote: remote
      ? {
          ok: remote.ok,
          checked: remote.checked,
          checks: remote.checks,
        }
      : null,
    contract: {
      version: "ai-media-product-image-suggestions-v1",
      upstream: "AI_MEDIA_SERVICE",
      createEndpoint: "/v1/product-image-suggestions/jobs",
      statusEndpoint: "/v1/product-image-suggestions/jobs/{jobId}",
      cancelEndpoint: "/v1/product-image-suggestions/jobs/{jobId}/cancel",
      supportedTargets: [
        {
          targetType: "PRODUCT",
          assetType: "PRODUCT_IMAGE",
          targetField: "product.image",
        },
      ],
      unsupportedTargets: ["ORGANIZATION_BRAND", "FANPAGE_POST", "CAMPAIGN", "IMPORTED_MEDIA"],
      requiredCreateFields: ["organization_id", "product_id", "requested_by_user_id", "product_title", "category"],
      optionalCreateFields: ["description", "seller_prompt", "brand", "input_images", "count", "aspect_ratio", "style_preset"],
      outputFields: ["job_id", "status", "provider", "outputs", "output_images"],
      persistencePlan: {
        job: "CreativeStudioJob",
        asset: "CreativeStudioAsset",
        usage: "CreativeStudioUsageEvent",
        publicMutation: "deferred-to-P110-apply-controls",
      },
    },
    organizationBrandPlan: {
      phase: "P114",
      targetType: "ORGANIZATION_BRAND",
      generationRequestEnabled: false,
      generationUiEnabled: false,
      requestControlsPhase: "P115",
      requestControlsEnabled: true,
      providerExecutionGatePhase: "P117",
      providerExecutionRequested: organizationBrandProvider.requested,
      providerExecutionConfigured: organizationBrandProvider.configured,
      providerExecutionExplicitlyEnabled: organizationBrandProvider.executionRequested,
      providerExecutionDryRun: organizationBrandProvider.dryRun,
      providerExecutionMode: organizationBrandProvider.executionMode,
      providerExecutionEnabled: organizationBrandProvider.providerExecutionEnabled,
      requestOnlyJobPersistence: true,
      providerContractReady: organizationBrandProvider.providerContractReady,
      rolloutGate: organizationBrandProvider,
      selectionStillRequired: true,
      applyStillRequiresConfirmation: true,
      publicAutoApplyAllowed: false,
      supportedAssets: [
        {
          assetType: "LOGO",
          targetField: "organization.logo",
          recommendedAspectRatio: "1:1",
          publicApplyPath: "P110 confirmation-gated apply controls",
        },
        {
          assetType: "COVER",
          targetField: "organization.coverImage",
          recommendedAspectRatio: "16:9",
          publicApplyPath: "P110 confirmation-gated apply controls",
        },
      ],
      requiredProviderContract: {
        version: "unavailable-live-contract",
        upstream: "AI_MEDIA_SERVICE",
        createEndpoint: null,
        statusEndpoint: null,
        cancelEndpoint: null,
        requiredCreateFields: [],
        optionalCreateFields: [],
        outputFields: [],
        unavailableReason: "live-openapi-does-not-expose-organization-brand-endpoints",
      },
      readinessChecklist: [
        "server-only-provider-calls",
        "settings-manage-permission",
        "draft-asset-persistence",
        "selected-candidate-review",
        "manual-apply-confirmation",
        "all-locale-cache-revalidation",
        "provider-execution-approval",
        "provider-rollback-control",
        "secret-safe-status",
      ],
      blockers: organizationBrandBlockers,
    },
    blockers,
    nextPhase: "P120E — SMS delivery reports and provider reconciliation",
  };
}
