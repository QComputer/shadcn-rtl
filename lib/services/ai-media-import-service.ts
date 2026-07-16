import "server-only";
import { createHash } from "node:crypto";

import { prisma } from "@/lib/db";
import { planAiMediaResultImport } from "@/lib/ai-media/import-planning";
import type { AiMediaJobMirrorState } from "@/lib/ai-media/job-mirror";
import { appendAiMediaJobEvent } from "@/lib/services/ai-media-job-mirror-service";

type AiMediaDbClient = typeof prisma;

export type PlanImportFromResultReadyInput = {
  organizationId: string;
  requestId: string;
  mirrorId: string;
  mirrorState: AiMediaJobMirrorState;
  outputIndex?: number;
  resultFingerprint?: string | null;
  validationFailures?: string[];
  rawOutputAvailable?: boolean;
};

function stableHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export async function planImportFromResultReady(
  input: PlanImportFromResultReadyInput,
  db: AiMediaDbClient = prisma,
) {
  const plan = planAiMediaResultImport({
    state: input.mirrorState,
    validationFailures: input.validationFailures,
    rawOutputAvailable: input.rawOutputAvailable,
  });
  const client = db as any;
  const outputIndex = input.outputIndex ?? 0;
  const importRecord = await client.aiMediaImport.upsert({
    where: {
      mirrorId_outputIndex: {
        mirrorId: input.mirrorId,
        outputIndex,
      },
    },
    create: {
      organizationId: input.organizationId,
      requestId: input.requestId,
      mirrorId: input.mirrorId,
      status: plan.importStatus === "PENDING" ? "PENDING" : plan.importStatus === "ACCEPTED" ? "IMPORTED" : "NOT_REQUESTED",
      outputIndex,
      resultFingerprint: input.resultFingerprint ?? null,
      validationRisk: plan.risk,
      validationErrors: input.validationFailures ?? [],
    },
    update: {},
  });

  await appendAiMediaJobEvent({
    organizationId: input.organizationId,
    requestId: input.requestId,
    mirrorId: input.mirrorId,
    action: "IMPORT_PLANNED",
    state: input.mirrorState,
    dedupeKey: stableHash({
      scope: "ai-media-import-plan",
      mirrorId: input.mirrorId,
      outputIndex,
      state: input.mirrorState,
    }),
    safeMetadata: {
      importStatus: plan.importStatus,
      risk: plan.risk,
      blobWrite: false,
      rawOutputExposed: false,
    },
  }, db);

  return {
    import: importRecord,
    plan: {
      ...plan,
      blobWritePlanned: false,
      rawOutputExposed: false,
    },
  };
}

export function buildDryRunAiMediaImportPlan(input: PlanImportFromResultReadyInput) {
  const plan = planAiMediaResultImport({
    state: input.mirrorState,
    validationFailures: input.validationFailures,
    rawOutputAvailable: input.rawOutputAvailable,
  });
  return {
    ...plan,
    organizationId: input.organizationId,
    requestId: input.requestId,
    mirrorId: input.mirrorId,
    outputIndex: input.outputIndex ?? 0,
    blobWritePlanned: false,
    renderMutationPlanned: false,
    rawOutputExposed: false,
  };
}
