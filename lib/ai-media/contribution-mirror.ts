import type { AiMediaJobMirrorState } from "@/lib/ai-media/job-mirror";

export type WorkerContributionBlockerCode =
  | "RESULT_NOT_IMPORTED"
  | "JOB_FAILED"
  | "JOB_CANCELLED"
  | "JOB_EXPIRED"
  | "FRAUD_SUSPECTED"
  | "REJECTED_OUTPUT"
  | "MISSING_PROVIDER_FACT";

export type WorkerContributionFactInput = {
  providerContributionId?: string | null;
  workerOpaqueId?: string | null;
  mirrorId?: string | null;
  jobState: AiMediaJobMirrorState;
  importedAssetAccepted?: boolean;
  suspicious?: boolean;
  rejected?: boolean;
  capabilityKey?: string | null;
  durationMs?: number | null;
  rawPrompt?: unknown;
  rawImageUrl?: unknown;
  rawFileUrl?: unknown;
};

export type SanitizedWorkerContributionFact = {
  providerContributionId: string;
  workerOpaqueId: string;
  mirrorId: string;
  jobState: AiMediaJobMirrorState;
  importedAssetAccepted: boolean;
  safeFacts: {
    capabilityKey: string | null;
    durationMs: number | null;
  };
  blockedFieldsRemoved: true;
};

export type WorkerContributionRewardPlan = {
  rewardEligible: boolean;
  pendingReward: boolean;
  rewardPolicyKey: string | null;
  blockerCodes: WorkerContributionBlockerCode[];
  walletCreditProduced: false;
};

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function sanitizeWorkerContributionFact(input: WorkerContributionFactInput): SanitizedWorkerContributionFact | null {
  const providerContributionId = nonEmptyString(input.providerContributionId);
  const workerOpaqueId = nonEmptyString(input.workerOpaqueId);
  const mirrorId = nonEmptyString(input.mirrorId);
  if (!providerContributionId || !workerOpaqueId || !mirrorId) return null;

  return {
    providerContributionId,
    workerOpaqueId,
    mirrorId,
    jobState: input.jobState,
    importedAssetAccepted: input.importedAssetAccepted === true,
    safeFacts: {
      capabilityKey: nonEmptyString(input.capabilityKey),
      durationMs: typeof input.durationMs === "number" && Number.isFinite(input.durationMs) && input.durationMs >= 0
        ? input.durationMs
        : null,
    },
    blockedFieldsRemoved: true,
  };
}

export function planWorkerContributionReward(
  input: WorkerContributionFactInput,
  rewardPolicyKey: string | null = null,
): WorkerContributionRewardPlan {
  const sanitized = sanitizeWorkerContributionFact(input);
  const blockerCodes: WorkerContributionBlockerCode[] = [];

  if (!sanitized) blockerCodes.push("MISSING_PROVIDER_FACT");
  if (input.suspicious) blockerCodes.push("FRAUD_SUSPECTED");
  if (input.rejected) blockerCodes.push("REJECTED_OUTPUT");
  if (input.jobState === "FAILED_FINAL" || input.jobState === "FAILED_RETRYABLE") blockerCodes.push("JOB_FAILED");
  if (input.jobState === "CANCELLED") blockerCodes.push("JOB_CANCELLED");
  if (input.jobState === "EXPIRED") blockerCodes.push("JOB_EXPIRED");
  if (input.jobState !== "IMPORTED" || input.importedAssetAccepted !== true) blockerCodes.push("RESULT_NOT_IMPORTED");

  const rewardEligible = blockerCodes.length === 0;

  return {
    rewardEligible,
    pendingReward: rewardEligible,
    rewardPolicyKey: rewardEligible ? rewardPolicyKey : null,
    blockerCodes,
    walletCreditProduced: false,
  };
}

export function contributionFactExposesRawMedia(input: SanitizedWorkerContributionFact | null): false {
  void input;
  return false;
}
