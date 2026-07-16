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
};

export type AiMediaPreviewDbIdentityDecision = {
  allowed: boolean;
  mode: "PREVIEW_DB" | "BLOCKED";
  blockers: string[];
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
  };
};

type EnvLike = Record<string, string | undefined>;

function normalize(value?: string | null) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function hasValue(value?: string | null) {
  return typeof value === "string" && value.trim().length > 0;
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
    featureFlagEnabled: env.AI_MEDIA_PREVIEW_MOCK_WRITES_ENABLED === "true",
    databaseUrlPresent: hasValue(databaseUrl),
    directUrlPresent: hasValue(directUrl),
    databaseUrlEqualsDirectUrl: urlEquals(databaseUrl, directUrl),
    previewDbFingerprint: env.AI_MEDIA_PREVIEW_DB_FINGERPRINT ?? null,
    productionDbFingerprint: env.AI_MEDIA_PRODUCTION_DB_FINGERPRINT ?? null,
    previewDbBranchId: env.AI_MEDIA_PREVIEW_DB_BRANCH_ID ?? null,
    productionDbBranchId: env.AI_MEDIA_PRODUCTION_DB_BRANCH_ID ?? null,
    explicitPreviewDbIdentityVerified: env.AI_MEDIA_PREVIEW_DB_IDENTITY_VERIFIED === "true",
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
  const blockers: string[] = [];

  if (productionBlocked) blockers.push("Preview DB writes are disabled in Production.");
  if (!previewLikeEnvironment) blockers.push("Preview DB writes require a Preview, test, or development environment.");
  if (!featureFlagEnabled) blockers.push("Preview DB writes require the Preview MOCK write feature flag.");
  if (!databaseUrlPresent) blockers.push("DATABASE_URL evidence is missing.");
  if (!directUrlPresent) blockers.push("DIRECT_URL evidence is missing.");
  if (evidence.databaseUrlEqualsDirectUrl === true) blockers.push("DATABASE_URL and DIRECT_URL must not be identical for Preview write proof.");
  if (fingerprintsDiffer !== true) blockers.push("Preview and Production DB fingerprints must be present and different.");
  if (branchIdsDiffer === false) blockers.push("Preview and Production DB branch ids must not match.");
  if (!explicitPreviewDbIdentityVerified) blockers.push("Explicit Preview DB identity verification is missing.");

  return {
    allowed: blockers.length === 0,
    mode: blockers.length === 0 ? "PREVIEW_DB" : "BLOCKED",
    blockers,
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
    },
  };
}
