import { normalizeAiMediaServiceStatusPayload, type AiMediaCanonicalStatus } from "@/lib/ai-media/status";

export type AiMediaJobMirrorState =
  | "DRAFT"
  | "QUOTED"
  | "HOLD_PENDING"
  | "READY_TO_SUBMIT"
  | "SUBMITTED_TO_RENDER"
  | "QUEUED"
  | "CLAIMED"
  | "PROCESSING"
  | "RESULT_READY"
  | "IMPORT_PENDING"
  | "IMPORTED"
  | "FAILED_RETRYABLE"
  | "FAILED_FINAL"
  | "CANCELLED"
  | "EXPIRED"
  | "REFUNDED";

export type AiMediaJobPrivacyLevel =
  | "PRIVATE"
  | "ORGANIZATION"
  | "SUPER_ADMIN_ONLY"
  | "ANONYMIZED_NETWORK";

export type AiMediaImportStatus =
  | "NOT_REQUESTED"
  | "PENDING"
  | "VALIDATING"
  | "IMPORTED"
  | "FAILED"
  | "ROLLED_BACK";

export type AiMediaSpendHoldAction = "none" | "create" | "keep" | "settle" | "release_refund";

export type AiMediaJobMirrorViewerRole = "NORMAL_USER" | "SUPER_ADMIN" | "WORKER_OPERATOR";

export type AiMediaNormalUserVisibilityInput = {
  viewerUserId: string | null | undefined;
  viewerOrganizationId: string | null | undefined;
  jobRequestedByUserId: string | null | undefined;
  jobOrganizationId: string | null | undefined;
  privacyLevel?: AiMediaJobPrivacyLevel;
};

export type AiMediaJobVisibility = {
  canSeeJob: boolean;
  canSeePrompt: boolean;
  canSeeImages: boolean;
  canSeeFiles: boolean;
  canSeeProviderDiagnostics: boolean;
  canSeeWorkerContributionFacts: boolean;
  fullDiagnosticMarker: boolean;
  redaction: "none" | "tenant_safe" | "worker_safe" | "hidden";
};

const NETWORK_TO_MIRROR_STATE: Record<AiMediaCanonicalStatus, AiMediaJobMirrorState> = {
  ACCEPTED: "QUEUED",
  QUEUED_WAITING_FOR_GPU: "QUEUED",
  QUEUED_GPU_OFFLINE: "QUEUED",
  QUEUED_GPU_BUSY: "QUEUED",
  CLAIMED_BY_WORKER: "CLAIMED",
  PROCESSING: "PROCESSING",
  RESULT_READY: "RESULT_READY",
  IMPORTED_BY_BAZAR_BAZ: "IMPORTED",
  FAILED_RETRYABLE: "FAILED_RETRYABLE",
  FAILED_FINAL: "FAILED_FINAL",
  CANCELLED: "CANCELLED",
  EXPIRED: "EXPIRED",
  UNKNOWN: "QUEUED",
};

export function mapNetworkStatusToJobMirrorState(value: unknown): AiMediaJobMirrorState {
  const normalized = normalizeAiMediaServiceStatusPayload(value);
  return NETWORK_TO_MIRROR_STATE[normalized.canonicalStatus];
}

export function getSpendHoldActionForMirrorState(
  state: AiMediaJobMirrorState,
  options: { hasActiveHold?: boolean } = {},
): AiMediaSpendHoldAction {
  const hasActiveHold = options.hasActiveHold === true;

  switch (state) {
    case "DRAFT":
      return "none";
    case "QUOTED":
    case "HOLD_PENDING":
      return hasActiveHold ? "keep" : "create";
    case "READY_TO_SUBMIT":
    case "SUBMITTED_TO_RENDER":
    case "QUEUED":
    case "CLAIMED":
    case "PROCESSING":
    case "RESULT_READY":
    case "IMPORT_PENDING":
    case "FAILED_RETRYABLE":
      return hasActiveHold ? "keep" : "none";
    case "IMPORTED":
      return hasActiveHold ? "settle" : "none";
    case "FAILED_FINAL":
    case "CANCELLED":
    case "EXPIRED":
    case "REFUNDED":
      return hasActiveHold ? "release_refund" : "none";
    default:
      return "none";
  }
}

function hasSameIdentity(left: string | null | undefined, right: string | null | undefined) {
  return typeof left === "string" && left.length > 0 && left === right;
}

export function getNormalUserJobVisibility(input: AiMediaNormalUserVisibilityInput): AiMediaJobVisibility {
  if (input.privacyLevel === "SUPER_ADMIN_ONLY" || input.privacyLevel === "ANONYMIZED_NETWORK") {
    return hiddenVisibility();
  }

  const ownsJob = hasSameIdentity(input.viewerUserId, input.jobRequestedByUserId);
  const sameOrganization = hasSameIdentity(input.viewerOrganizationId, input.jobOrganizationId);
  const canSeeJob = ownsJob || sameOrganization;
  const canSeeSensitiveContent = ownsJob || (sameOrganization && input.privacyLevel === "ORGANIZATION");

  if (!canSeeJob) return hiddenVisibility();

  return {
    canSeeJob: true,
    canSeePrompt: canSeeSensitiveContent,
    canSeeImages: canSeeSensitiveContent,
    canSeeFiles: canSeeSensitiveContent,
    canSeeProviderDiagnostics: false,
    canSeeWorkerContributionFacts: false,
    fullDiagnosticMarker: false,
    redaction: canSeeSensitiveContent ? "tenant_safe" : "hidden",
  };
}

export function getSuperAdminJobVisibility(): AiMediaJobVisibility {
  return {
    canSeeJob: true,
    canSeePrompt: true,
    canSeeImages: true,
    canSeeFiles: true,
    canSeeProviderDiagnostics: true,
    canSeeWorkerContributionFacts: true,
    fullDiagnosticMarker: true,
    redaction: "none",
  };
}

export function getWorkerOperatorJobVisibility(): AiMediaJobVisibility {
  return {
    canSeeJob: true,
    canSeePrompt: false,
    canSeeImages: false,
    canSeeFiles: false,
    canSeeProviderDiagnostics: false,
    canSeeWorkerContributionFacts: true,
    fullDiagnosticMarker: false,
    redaction: "worker_safe",
  };
}

function hiddenVisibility(): AiMediaJobVisibility {
  return {
    canSeeJob: false,
    canSeePrompt: false,
    canSeeImages: false,
    canSeeFiles: false,
    canSeeProviderDiagnostics: false,
    canSeeWorkerContributionFacts: false,
    fullDiagnosticMarker: false,
    redaction: "hidden",
  };
}
