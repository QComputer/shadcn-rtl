export type AiMediaPreviewDbIdentityEvidence = {
  vercelEnv?: string | null;
  nodeEnv?: string | null;
  featureFlagEnabled?: boolean;
  databaseUrlPresent?: boolean;
  directUrlPresent?: boolean;
  databaseUrlEqualsDirectUrl?: boolean | null;
  previewDbFingerprint?: string | null;
  productionDbFingerprint?: string | null;
  previewDbBranchId?: string | null;
  productionDbBranchId?: string | null;
  explicitPreviewDbIdentityVerified?: boolean;
  nonIsolatedWriteAccepted?: boolean;
};

export type AiMediaPreviewDbIdentityDecision = {
  allowed: boolean;
  mode: "PREVIEW_DB" | "ACCEPTED_RISK_NON_ISOLATED_DB" | "BLOCKED";
  blockers: string[];
  warnings: string[];
  safeSummary: {
    productionBlocked: boolean;
    previewLikeEnvironment: boolean;
    featureFlagEnabled: boolean;
    databaseUrlPresent: boolean;
    directUrlPresent: boolean;
    urlsDiffer: boolean | null;
    fingerprintsDiffer: boolean | null;
    branchIdsDiffer: boolean | null;
    explicitPreviewDbIdentityVerified: boolean;
    nonIsolatedWriteAccepted: boolean;
    acceptedRiskNonIsolated: boolean;
  };
};

type EnvLike = Record<string, string | undefined>;

function normalize(value?: string | null) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function hasValue(value?: string | null) {
  return typeof value === "string" && value.trim().length > 0;
}

function isEnabled(value?: string | null) {
  const normalized = normalize(value);
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function normalizeComparable(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return "";
  return trimmed.replace(/\/$/, "").toLowerCase();
}

function compareDiffer(left?: string | null, right?: string | null): boolean | null {
  const normalizedLeft = normalizeComparable(left);
  const normalizedRight = normalizeComparable(right);
  if (!normalizedLeft || !normalizedRight) return null;
  return normalizedLeft !== normalizedRight;
}

function urlEquals(left?: string | null, right?: string | null): boolean | null {
  if (!hasValue(left) || !hasValue(right)) return null;
  return normalizeComparable(left) === normalizeComparable(right);
}

export function buildAiMediaPreviewDbIdentityEvidenceFromEnv(
  env: EnvLike = process.env,
): AiMediaPreviewDbIdentityEvidence {
  const databaseUrl = env.DATABASE_URL ?? null;
  const directUrl = env.DIRECT_URL ?? null;

  return {
    vercelEnv: env.VERCEL_ENV ?? null,
    nodeEnv: env.NODE_ENV ?? null,
    featureFlagEnabled: isEnabled(env.AI_MEDIA_PREVIEW_MOCK_WRITES_ENABLED),
    databaseUrlPresent: hasValue(databaseUrl),
    directUrlPresent: hasValue(directUrl),
    databaseUrlEqualsDirectUrl: urlEquals(databaseUrl, directUrl),
    previewDbFingerprint: env.AI_MEDIA_PREVIEW_DB_FINGERPRINT ?? null,
    productionDbFingerprint: env.AI_MEDIA_PRODUCTION_DB_FINGERPRINT ?? null,
    previewDbBranchId: env.AI_MEDIA_PREVIEW_DB_BRANCH_ID ?? null,
    productionDbBranchId: env.AI_MEDIA_PRODUCTION_DB_BRANCH_ID ?? null,
    explicitPreviewDbIdentityVerified: isEnabled(env.AI_MEDIA_PREVIEW_DB_IDENTITY_VERIFIED),
    nonIsolatedWriteAccepted: isEnabled(env.AI_MEDIA_PREVIEW_DB_NON_ISOLATED_WRITE_ACCEPTED),
  };
}

export function evaluateAiMediaPreviewDbIdentityGuard(
  evidence: AiMediaPreviewDbIdentityEvidence,
): AiMediaPreviewDbIdentityDecision {
  const vercelEnv = normalize(evidence.vercelEnv);
  const nodeEnv = normalize(evidence.nodeEnv);
  const productionBlocked = vercelEnv === "production" || nodeEnv === "production";
  const previewLikeEnvironment = vercelEnv === "preview" || nodeEnv === "test" || nodeEnv === "development";
  const featureFlagEnabled = evidence.featureFlagEnabled === true;
  const databaseUrlPresent = evidence.databaseUrlPresent === true;
  const directUrlPresent = evidence.directUrlPresent === true;
  const urlsDiffer = evidence.databaseUrlEqualsDirectUrl === null ? null : evidence.databaseUrlEqualsDirectUrl === false;
  const fingerprintsDiffer = compareDiffer(evidence.previewDbFingerprint, evidence.productionDbFingerprint);
  const branchIdsDiffer = compareDiffer(evidence.previewDbBranchId, evidence.productionDbBranchId);
  const explicitPreviewDbIdentityVerified = evidence.explicitPreviewDbIdentityVerified === true;
  const nonIsolatedWriteAccepted = evidence.nonIsolatedWriteAccepted === true;
  const isolatedPreviewDb = explicitPreviewDbIdentityVerified && fingerprintsDiffer === true && branchIdsDiffer !== false;
  const acceptedRiskNonIsolated = nonIsolatedWriteAccepted && branchIdsDiffer !== false;
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (productionBlocked) blockers.push("Preview DB writes are disabled in Production.");
  if (!previewLikeEnvironment) blockers.push("Preview DB writes require a Preview, test, or development environment.");
  if (!featureFlagEnabled) blockers.push("Preview DB writes require the Preview MOCK write feature flag.");
  if (!databaseUrlPresent) blockers.push("DATABASE_URL evidence is missing.");
  if (!directUrlPresent) blockers.push("DIRECT_URL evidence is missing.");
  if (evidence.databaseUrlEqualsDirectUrl === true) {
    warnings.push("DATABASE_URL and DIRECT_URL are identical inside this environment; this is allowed only as Preview-local evidence and is not proof of isolation.");
  }
  if (branchIdsDiffer === false) blockers.push("Preview and Production DB branch ids must not match.");
  if (!isolatedPreviewDb && !acceptedRiskNonIsolated) {
    blockers.push("Preview and Production DB fingerprints must be present and different, or accepted-risk non-isolated MOCK E2E must be explicitly marked.");
  }
  if (!explicitPreviewDbIdentityVerified && !nonIsolatedWriteAccepted) {
    blockers.push("Explicit Preview DB identity verification or accepted-risk non-isolated approval is missing.");
  }
  if (acceptedRiskNonIsolated && !isolatedPreviewDb) {
    warnings.push("accepted-risk non-isolated MOCK E2E");
  }

  const allowed = blockers.length === 0;
  const mode = allowed
    ? acceptedRiskNonIsolated && !isolatedPreviewDb
      ? "ACCEPTED_RISK_NON_ISOLATED_DB"
      : "PREVIEW_DB"
    : "BLOCKED";

  return {
    allowed,
    mode,
    blockers,
    warnings,
    safeSummary: {
      productionBlocked,
      previewLikeEnvironment,
      featureFlagEnabled,
      databaseUrlPresent,
      directUrlPresent,
      urlsDiffer,
      fingerprintsDiffer,
      branchIdsDiffer,
      explicitPreviewDbIdentityVerified,
      nonIsolatedWriteAccepted,
      acceptedRiskNonIsolated: mode === "ACCEPTED_RISK_NON_ISOLATED_DB",
    },
  };
}
