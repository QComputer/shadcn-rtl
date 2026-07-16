import "server-only";
import { createHash } from "node:crypto";

import { prisma } from "@/lib/db";
import {
  planWorkerContributionReward,
  sanitizeWorkerContributionFact,
  type WorkerContributionFactInput,
} from "@/lib/ai-media/contribution-mirror";
import { appendAiMediaJobEvent } from "@/lib/services/ai-media-job-mirror-service";

type AiMediaDbClient = typeof prisma;

export type MirrorContributionFactInput = WorkerContributionFactInput & {
  organizationId: string;
  rewardPolicyKey?: string | null;
};

function stableHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export async function mirrorContributionFact(
  input: MirrorContributionFactInput,
  db: AiMediaDbClient = prisma,
) {
  const sanitized = sanitizeWorkerContributionFact(input);
  const rewardPlan = planWorkerContributionReward(input, input.rewardPolicyKey ?? null);

  if (!sanitized) {
    return {
      mirrored: false as const,
      rewardPlan,
      walletCreditProduced: false as const,
    };
  }

  const client = db as any;
  const mirror = await client.workerContributionMirror.upsert({
    where: {
      organizationId_providerContributionId: {
        organizationId: input.organizationId,
        providerContributionId: sanitized.providerContributionId,
      },
    },
    create: {
      organizationId: input.organizationId,
      mirrorId: sanitized.mirrorId,
      providerContributionId: sanitized.providerContributionId,
      workerOpaqueId: sanitized.workerOpaqueId,
      jobState: sanitized.jobState,
      importedAssetAccepted: sanitized.importedAssetAccepted,
      rewardPolicyKey: rewardPlan.rewardPolicyKey,
      rewardEligible: rewardPlan.rewardEligible,
      walletCreditProduced: false,
      safeFacts: sanitized.safeFacts,
      blockerCodes: rewardPlan.blockerCodes,
    },
    update: {
      jobState: sanitized.jobState,
      importedAssetAccepted: sanitized.importedAssetAccepted,
      rewardPolicyKey: rewardPlan.rewardPolicyKey,
      rewardEligible: rewardPlan.rewardEligible,
      walletCreditProduced: false,
      safeFacts: sanitized.safeFacts,
      blockerCodes: rewardPlan.blockerCodes,
    },
  });

  await appendAiMediaJobEvent({
    organizationId: input.organizationId,
    mirrorId: sanitized.mirrorId,
    action: "CONTRIBUTION_MIRRORED",
    state: sanitized.jobState,
    dedupeKey: stableHash({
      scope: "ai-media-contribution-mirror",
      organizationId: input.organizationId,
      providerContributionId: sanitized.providerContributionId,
      jobState: sanitized.jobState,
    }),
    safeMetadata: {
      rewardEligible: rewardPlan.rewardEligible,
      walletCreditProduced: false,
      rawMediaExposed: false,
    },
  }, db);

  return {
    mirrored: true as const,
    mirror,
    rewardPlan,
    walletCreditProduced: false as const,
  };
}
