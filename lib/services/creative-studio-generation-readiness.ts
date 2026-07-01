import "server-only";

import {
  checkAiMediaServiceReadiness,
  getAiMediaServiceConfigStatus,
  type AiMediaServiceReadiness,
} from "@/lib/services/ai-media-service-client";
import { getAiMediaPaidProviderStatus } from "@/lib/services/ai-media-paid-provider";

export type CreativeStudioGenerationReadiness = {
  phase: "P112";
  generationRequestEnabled: boolean;
  generationUiEnabled: boolean;
  browserWorkerCallsAllowed: false;
  serverOnly: true;
  noNewProviders: true;
  service: ReturnType<typeof getAiMediaServiceConfigStatus>;
  paidProvider: ReturnType<typeof getAiMediaPaidProviderStatus>;
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
    providerContractReady: false;
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
      version: "creative-studio-organization-brand-v1";
      upstream: "AI_MEDIA_SERVICE";
      createEndpoint: "/v1/organization-brand/jobs";
      statusEndpoint: "/v1/organization-brand/jobs/{jobId}";
      cancelEndpoint: "/v1/organization-brand/jobs/{jobId}/cancel";
      requiredCreateFields: Array<"organization_id" | "requested_by_user_id" | "asset_type" | "brand_name">;
      optionalCreateFields: Array<"brand_description" | "style_preset" | "count" | "aspect_ratio" | "input_images">;
      outputFields: Array<"job_id" | "status" | "provider" | "outputs" | "output_images">;
    };
    readinessChecklist: Array<
      | "server-only-provider-calls"
      | "settings-manage-permission"
      | "draft-asset-persistence"
      | "selected-candidate-review"
      | "manual-apply-confirmation"
      | "all-locale-cache-revalidation"
    >;
    blockers: string[];
  };
  blockers: string[];
  nextPhase: "P115 - Creative Studio organization logo and cover generation request controls";
};

export async function getCreativeStudioGenerationReadiness(options: { checkRemote?: boolean } = {}): Promise<CreativeStudioGenerationReadiness> {
  const service = getAiMediaServiceConfigStatus();
  const paidProvider = getAiMediaPaidProviderStatus();
  const remote = options.checkRemote ? await checkAiMediaServiceReadiness() : null;
  const blockers: string[] = [];

  if (!service.enabled) blockers.push("AI_MEDIA_SERVICE_ENABLED is not true");
  if (!service.urlConfigured) blockers.push("AI_MEDIA_SERVICE_URL is not configured");
  if (!service.internalKeyConfigured) blockers.push("AI_MEDIA_SERVICE_INTERNAL_KEY is not configured");
  if (paidProvider.rollback.paused) blockers.push("AI media paid-provider rollout is paused");
  if (remote && !remote.ok) blockers.push("AI media service remote readiness check failed");
  const productImageGenerationEnabled = service.ready && !paidProvider.rollback.paused;
  const organizationBrandBlockers = [
    "Organization brand provider contract is not implemented",
    "Organization logo/cover generation UI remains disabled",
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
      providerContractReady: false,
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
        version: "creative-studio-organization-brand-v1",
        upstream: "AI_MEDIA_SERVICE",
        createEndpoint: "/v1/organization-brand/jobs",
        statusEndpoint: "/v1/organization-brand/jobs/{jobId}",
        cancelEndpoint: "/v1/organization-brand/jobs/{jobId}/cancel",
        requiredCreateFields: ["organization_id", "requested_by_user_id", "asset_type", "brand_name"],
        optionalCreateFields: ["brand_description", "style_preset", "count", "aspect_ratio", "input_images"],
        outputFields: ["job_id", "status", "provider", "outputs", "output_images"],
      },
      readinessChecklist: [
        "server-only-provider-calls",
        "settings-manage-permission",
        "draft-asset-persistence",
        "selected-candidate-review",
        "manual-apply-confirmation",
        "all-locale-cache-revalidation",
      ],
      blockers: organizationBrandBlockers,
    },
    blockers,
    nextPhase: "P115 - Creative Studio organization logo and cover generation request controls",
  };
}
