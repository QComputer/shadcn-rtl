import type { AiMediaJobMirrorState } from "@/lib/ai-media/job-mirror";
import type { AiMediaPlatformVisibilityScope } from "@/lib/ai-media/platform-domain";

export type AiMediaImportRisk = "LOW" | "REVIEW" | "BLOCK";

export type AiMediaImportPlanningInput = {
  state: AiMediaJobMirrorState;
  viewerUserId?: string | null;
  viewerOrganizationId?: string | null;
  assetOwnerUserId?: string | null;
  assetOrganizationId?: string | null;
  validationFailures?: string[];
  rawOutputAvailable?: boolean;
};

export type AiMediaResultImportPlan = {
  shouldAttemptImport: boolean;
  userVisibleSuccess: boolean;
  exposeRawOutput: boolean;
  importStatus: "NOT_READY" | "PENDING" | "ACCEPTED" | "FAILED_HIDDEN";
  risk: AiMediaImportRisk;
  visibilityScope: AiMediaPlatformVisibilityScope;
};

function sameNonEmpty(left?: string | null, right?: string | null) {
  return typeof left === "string" && left.length > 0 && left === right;
}

export function classifyAiMediaImportRisk(input: Pick<AiMediaImportPlanningInput, "validationFailures" | "rawOutputAvailable">): AiMediaImportRisk {
  const failures = input.validationFailures ?? [];
  if (failures.some((failure) => ["PRIVATE_IP", "INVALID_MIME", "HTML_BODY", "OVERSIZED", "MALWARE_SUSPECTED"].includes(failure))) {
    return "BLOCK";
  }
  if (failures.length > 0 || input.rawOutputAvailable !== true) return "REVIEW";
  return "LOW";
}

export function decideAiMediaImportVisibility(input: AiMediaImportPlanningInput): AiMediaPlatformVisibilityScope {
  if (input.state === "IMPORTED") return "ORGANIZATION";
  if (input.state === "FAILED_FINAL" || input.state === "CANCELLED" || input.state === "EXPIRED") return "OWNER_ONLY";
  return "OWNER_ONLY";
}

export function planAiMediaResultImport(input: AiMediaImportPlanningInput): AiMediaResultImportPlan {
  const risk = classifyAiMediaImportRisk(input);
  const visibilityScope = decideAiMediaImportVisibility(input);

  if (input.state === "RESULT_READY") {
    return {
      shouldAttemptImport: risk !== "BLOCK",
      userVisibleSuccess: false,
      exposeRawOutput: false,
      importStatus: "PENDING",
      risk,
      visibilityScope,
    };
  }

  if (input.state === "IMPORTED") {
    return {
      shouldAttemptImport: false,
      userVisibleSuccess: true,
      exposeRawOutput: false,
      importStatus: "ACCEPTED",
      risk,
      visibilityScope,
    };
  }

  if (input.state === "FAILED_FINAL" || input.state === "CANCELLED" || input.state === "EXPIRED") {
    return {
      shouldAttemptImport: false,
      userVisibleSuccess: false,
      exposeRawOutput: false,
      importStatus: "FAILED_HIDDEN",
      risk,
      visibilityScope,
    };
  }

  return {
    shouldAttemptImport: false,
    userVisibleSuccess: false,
    exposeRawOutput: false,
    importStatus: "NOT_READY",
    risk,
    visibilityScope,
  };
}

export function shouldExposeImportedAssetToNormalUser(input: AiMediaImportPlanningInput): boolean {
  return input.state === "IMPORTED" && (
    sameNonEmpty(input.viewerUserId, input.assetOwnerUserId)
    || sameNonEmpty(input.viewerOrganizationId, input.assetOrganizationId)
  );
}

export function shouldExposeImportedAssetToWorkerOperator(input: AiMediaImportPlanningInput & { workerIsAuthorizedOwner?: boolean }): boolean {
  return input.state === "IMPORTED" && input.workerIsAuthorizedOwner === true;
}

export function shouldExposeImportedAssetToSuperAdmin(input: AiMediaImportPlanningInput): boolean {
  return input.state === "IMPORTED" || input.state === "RESULT_READY";
}
