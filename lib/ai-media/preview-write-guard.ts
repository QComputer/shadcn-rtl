import type { UserRole } from "@/lib/types";

export type AiMediaPreviewWriteGuardEvidence = {
  vercelEnv?: string | null;
  nodeEnv?: string | null;
  featureFlagEnabled?: boolean;
  previewIsolationVerified?: boolean;
  pinnedRenderContractVerified?: boolean;
  provider?: string | null;
  realGenerationEnabled?: boolean;
  userRole?: UserRole | string | null;
};

export type AiMediaPreviewWriteGuardDecision = {
  allowed: boolean;
  mode: "PREVIEW_MOCK" | "BLOCKED";
  provider: "MOCK" | "UNKNOWN";
  realGeneration: "DISABLED" | "ENABLED";
  blockers: string[];
  safeSummary: {
    productionBlocked: boolean;
    previewLikeEnvironment: boolean;
    featureFlagEnabled: boolean;
    previewIsolationVerified: boolean;
    pinnedRenderContractVerified: boolean;
    providerMock: boolean;
    privilegedUser: boolean;
  };
};

function normalize(value?: string | null) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isEnabled(value?: string | null) {
  const normalized = normalize(value);
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

export function buildAiMediaPreviewWriteGuardEvidenceFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  userRole?: UserRole | string | null,
): AiMediaPreviewWriteGuardEvidence {
  return {
    vercelEnv: env.VERCEL_ENV ?? null,
    nodeEnv: env.NODE_ENV ?? null,
    featureFlagEnabled: isEnabled(env.AI_MEDIA_PREVIEW_MOCK_WRITES_ENABLED),
    previewIsolationVerified: isEnabled(env.AI_MEDIA_PREVIEW_ISOLATION_VERIFIED),
    pinnedRenderContractVerified: isEnabled(env.AI_MEDIA_RENDER_PINNED_CONTRACT_VERIFIED),
    provider: env.AI_MEDIA_PREVIEW_PROVIDER ?? "MOCK",
    realGenerationEnabled: isEnabled(env.AI_MEDIA_REAL_GENERATION_ENABLED),
    userRole,
  };
}

export function evaluateAiMediaPreviewWriteGuard(
  evidence: AiMediaPreviewWriteGuardEvidence,
): AiMediaPreviewWriteGuardDecision {
  const vercelEnv = normalize(evidence.vercelEnv);
  const nodeEnv = normalize(evidence.nodeEnv);
  const provider = normalize(evidence.provider);
  const productionBlocked = vercelEnv === "production" || nodeEnv === "production";
  const previewLikeEnvironment = vercelEnv === "preview" || nodeEnv === "test" || nodeEnv === "development";
  const featureFlagEnabled = evidence.featureFlagEnabled === true;
  const previewIsolationVerified = evidence.previewIsolationVerified === true;
  const pinnedRenderContractVerified = evidence.pinnedRenderContractVerified === true;
  const providerMock = provider === "mock";
  const realGenerationEnabled = evidence.realGenerationEnabled === true;
  const privilegedUser = evidence.userRole === "SUPER_ADMIN";
  const blockers: string[] = [];

  if (productionBlocked) blockers.push("AI media Preview MOCK writes are disabled in Production.");
  if (!previewLikeEnvironment) blockers.push("AI media Preview MOCK writes require a Preview, test, or development environment.");
  if (!featureFlagEnabled) blockers.push("AI media Preview MOCK write feature flag is disabled.");
  if (!previewIsolationVerified) blockers.push("Preview isolation evidence is missing or not verified.");
  if (!pinnedRenderContractVerified) blockers.push("Pinned Render MOCK contract evidence is missing or stale.");
  if (!providerMock) blockers.push("AI media Preview writes require provider MOCK.");
  if (realGenerationEnabled) blockers.push("Real generation must remain disabled.");
  if (!privilegedUser) blockers.push("AI media Preview write foundation is restricted to SUPER_ADMIN.");

  return {
    allowed: blockers.length === 0,
    mode: blockers.length === 0 ? "PREVIEW_MOCK" : "BLOCKED",
    provider: providerMock ? "MOCK" : "UNKNOWN",
    realGeneration: realGenerationEnabled ? "ENABLED" : "DISABLED",
    blockers,
    safeSummary: {
      productionBlocked,
      previewLikeEnvironment,
      featureFlagEnabled,
      previewIsolationVerified,
      pinnedRenderContractVerified,
      providerMock,
      privilegedUser,
    },
  };
}
