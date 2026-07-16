import type {
  AiMediaImportStatus,
  AiMediaJobMirrorState,
  AiMediaJobPrivacyLevel,
} from "@/lib/ai-media/job-mirror";

export type AiMediaPlatformTargetType =
  | "PRODUCT_IMAGE"
  | "ORGANIZATION_LOGO"
  | "ORGANIZATION_COVER"
  | "GENERAL_CREATIVE";

export type AiMediaPlatformVisibilityScope =
  | "OWNER_ONLY"
  | "ORGANIZATION"
  | "SUPER_ADMIN"
  | "WORKER_SAFE";

export type AiMediaPlatformAuditAction =
  | "REQUEST_DRAFTED"
  | "QUOTE_CREATED"
  | "HOLD_PLANNED"
  | "JOB_MIRRORED"
  | "STATUS_SYNCED"
  | "IMPORT_PLANNED"
  | "ASSET_ACCEPTED"
  | "SPEND_RELEASE_PLANNED"
  | "CONTRIBUTION_MIRRORED";

export type AiMediaPlatformRequestDraft = {
  requestId: string;
  organizationId: string;
  requestedByUserId: string;
  targetType: AiMediaPlatformTargetType;
  targetId: string | null;
  locale: "fa" | "en" | "ar";
  privacyLevel: AiMediaJobPrivacyLevel;
  idempotencyKey: string;
  payloadHash: string;
  promptFingerprint: string | null;
  sourceAssetFingerprints: string[];
  visibilityScope: AiMediaPlatformVisibilityScope;
};

export type AiMediaPlatformJobMirrorDraft = {
  mirrorId: string;
  requestId: string;
  organizationId: string;
  requestedByUserId: string;
  state: AiMediaJobMirrorState;
  provider: "AI_MEDIA_SERVICE" | "MOCK" | string;
  providerJobId: string | null;
  providerStatus: string | null;
  contractFingerprint: string | null;
  correlationId: string;
  idempotencyKey: string;
  payloadHash: string;
};

export type AiMediaPlatformJobEventDraft = {
  eventId: string;
  organizationId: string;
  requestId: string | null;
  mirrorId: string | null;
  actorUserId: string | null;
  action: AiMediaPlatformAuditAction;
  dedupeKey: string;
  safeMetadata: Record<string, string | number | boolean | null>;
};

export type AiMediaPlatformAssetDraft = {
  assetId: string;
  organizationId: string;
  requestId: string;
  mirrorId: string;
  importId: string;
  requestedByUserId: string;
  storageProvider: "APPLICATION_STORAGE";
  storageKeyFingerprint: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  checksumSha256: string;
  visibilityScope: AiMediaPlatformVisibilityScope;
};

export type AiMediaPlatformImportDraft = {
  importId: string;
  organizationId: string;
  requestId: string;
  mirrorId: string;
  status: AiMediaImportStatus;
  outputIndex: number;
  resultFingerprint: string;
  validationRisk: "LOW" | "REVIEW" | "BLOCK";
  acceptedAssetId: string | null;
};

export type AiMediaPlatformUsageQuoteDraft = {
  quoteId: string;
  organizationId: string;
  requestId: string;
  requestedByUserId: string;
  bazAmount: number;
  currency: "BAZ_INTERNAL_CREDIT";
  expiresAtIso: string;
  policyKey: string;
  idempotencyKey: string;
};

export type AiMediaPlatformSpendHoldDraft = {
  holdId: string;
  organizationId: string;
  requestId: string;
  quoteId: string;
  state: "PLANNED" | "ACTIVE" | "SETTLEMENT_ELIGIBLE" | "RELEASE_ELIGIBLE";
  bazAmount: number;
  currency: "BAZ_INTERNAL_CREDIT";
  ledgerMutationAllowed: false;
  idempotencyKey: string;
};

export type WorkerContributionMirrorDraft = {
  contributionMirrorId: string;
  organizationId: string;
  mirrorId: string;
  providerContributionId: string;
  workerOpaqueId: string;
  jobState: AiMediaJobMirrorState;
  importedAssetAccepted: boolean;
  rewardPolicyKey: string | null;
  rewardEligible: boolean;
  safeFacts: Record<string, string | number | boolean | null>;
};

export type AiMediaPlatformAuditEventDraft = AiMediaPlatformJobEventDraft & {
  visibilityScope: AiMediaPlatformVisibilityScope;
  redacted: true;
};

export function buildAiMediaPlatformAuditEventDraft(
  event: AiMediaPlatformJobEventDraft,
  visibilityScope: AiMediaPlatformVisibilityScope,
): AiMediaPlatformAuditEventDraft {
  return {
    ...event,
    visibilityScope,
    redacted: true,
  };
}

export function assertBazInternalCreditCurrency(value: string): value is "BAZ_INTERNAL_CREDIT" {
  return value === "BAZ_INTERNAL_CREDIT";
}
