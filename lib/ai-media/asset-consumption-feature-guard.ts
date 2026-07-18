import "server-only";

import { getAiMediaEnvironmentSummary } from "@/lib/ai-media/env-isolation";

export type AiMediaAssetConsumptionFeatureState = {
  enabled: boolean;
  environment: string;
  reason: string;
  storageKeyColumnExpected: boolean;
};

function isPreviewStorageKeyActivated(): boolean {
  // Preview may opt in only through an explicit accepted-risk guard.
  // This is not a NEXT_PUBLIC flag and never enables Production.
  return process.env.AI_MEDIA_ASSET_CONSUMPTION_PREVIEW_ENABLED === "true"
    && process.env.AI_MEDIA_PREVIEW_MOCK_WRITES_ENABLED === "true";
}

export function getAiMediaAssetConsumptionFeatureState(): AiMediaAssetConsumptionFeatureState {
  const summary = getAiMediaEnvironmentSummary(process.env);
  const environment = summary.environment;

  // Production: disabled by default until schema/storage activation is explicitly approved.
  // No Production migration is run in this phase, so the storageKey column does not exist yet.
  if (environment === "production") {
    return {
      enabled: false,
      environment,
      reason: "Asset consumption is disabled in Production until storageKey migration and storage activation are explicitly approved.",
      storageKeyColumnExpected: false,
    };
  }

  // Preview: enabled only through the existing accepted-risk/feature guard.
  if (environment === "preview") {
    const activated = isPreviewStorageKeyActivated();
    return {
      enabled: activated,
      environment,
      reason: activated
        ? "Preview asset consumption enabled through accepted-risk guard."
        : "Preview asset consumption disabled; requires AI_MEDIA_ASSET_CONSUMPTION_PREVIEW_ENABLED + AI_MEDIA_PREVIEW_MOCK_WRITES_ENABLED.",
      storageKeyColumnExpected: activated,
    };
  }

  // development / test / unknown: enabled locally for hermetic verification.
  return {
    enabled: true,
    environment,
    reason: "Local/development/test environment: asset consumption enabled for hermetic verification.",
    storageKeyColumnExpected: true,
  };
}

export function assertAiMediaAssetConsumptionEnabled(): AiMediaAssetConsumptionFeatureState {
  const state = getAiMediaAssetConsumptionFeatureState();
  if (!state.enabled) {
    throw new Error(`AI media asset consumption is not available in this environment: ${state.reason}`);
  }
  return state;
}
