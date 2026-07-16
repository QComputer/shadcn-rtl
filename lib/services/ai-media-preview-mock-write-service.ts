import "server-only";

import {
  AiMediaServiceError,
  createAiMediaJob,
  getAiMediaJob,
  type AiMediaJob,
  type AiMediaCreateJobResponse,
} from "@/lib/services/ai-media-service-client";
import { buildPreviewMockRenderJobRequest } from "@/lib/ai-media/preview-mock-render-request";
import { prisma } from "@/lib/db";
import {
  appendAiMediaJobEvent,
  createAiMediaJobMirror,
  updateMirrorFromNormalizedStatus,
} from "@/lib/services/ai-media-job-mirror-service";
import {
  createDraftAiMediaRequest,
  type CreateDraftAiMediaRequestInput,
} from "@/lib/services/ai-media-platform-request-service";

type AiMediaDbClient = typeof prisma;

type PreviewMockSubmitInput = CreateDraftAiMediaRequestInput & {
  productTitle?: string | null;
  category?: string | null;
};

function providerStatusPayload(job: AiMediaCreateJobResponse | AiMediaJob) {
  return {
    job_id: job.job_id,
    status: job.status,
    canonical_status: job.canonical_status,
    status_details: job.status_details,
    provider: job.provider,
    output_images: job.output_images ?? [],
    outputs: job.outputs ?? [],
  };
}

function providerSubmitFailureMetadata(error: unknown) {
  if (error instanceof AiMediaServiceError) {
    return {
      status: error.status,
      code: error.code ?? "PROVIDER_ERROR",
      retryAfterMs: error.retryAfterMs ?? null,
    };
  }

  return {
    code: "PROVIDER_ERROR",
  };
}

function providerSubmitFailureState(error: unknown) {
  return error instanceof AiMediaServiceError && error.status >= 400 && error.status < 500 && error.status !== 429
    ? "FAILED_FINAL" as const
    : "FAILED_RETRYABLE" as const;
}

export async function submitPreviewMockAiMediaJob(
  input: PreviewMockSubmitInput,
  db: AiMediaDbClient = prisma,
) {
  const client = db as any;
  const draft = await createDraftAiMediaRequest(input, db);
  const mirror = await createAiMediaJobMirror({
    requestId: draft.id,
    organizationId: input.organizationId,
    requestedByUserId: input.requestedByUserId,
    provider: "MOCK",
    idempotencyKey: draft.idempotencyKey,
    payloadHash: draft.payloadHash,
    state: "SUBMITTED_TO_RENDER",
    safeMetadata: {
      phase: "BAZAR-BAZ-AI-MEDIA-PREVIEW-MOCK-WRITE-E2E-01",
      renderMutation: true,
      blobWrite: false,
      realGeneration: false,
    },
  }, db);

  if (mirror.providerJobId) {
    return {
      request: draft,
      mirror,
      providerJob: {
        job_id: mirror.providerJobId,
        status: mirror.providerStatus ?? "accepted",
        provider: mirror.provider,
      },
      reused: true,
    };
  }

  await appendAiMediaJobEvent({
    organizationId: input.organizationId,
    requestId: draft.id,
    mirrorId: mirror.id,
    actorUserId: input.requestedByUserId,
    action: "JOB_MIRRORED",
    state: "SUBMITTED_TO_RENDER",
    dedupeKey: `preview-e2e:${input.organizationId}:${draft.idempotencyKey}:submitted-to-render`,
    safeMetadata: {
      provider: "MOCK",
      renderMutation: true,
      blobWrite: false,
      realGeneration: false,
    },
  }, db);

  let providerJob: AiMediaCreateJobResponse;
  try {
    providerJob = await createAiMediaJob(buildPreviewMockRenderJobRequest(input, mirror.correlationId));
  } catch (error) {
    const failedState = providerSubmitFailureState(error);
    const failureMetadata = providerSubmitFailureMetadata(error);
    const errorCode = failureMetadata.code;

    await client.aiMediaJobMirror.updateMany({
      where: { id: mirror.id, organizationId: input.organizationId },
      data: {
        state: failedState,
        errorCode,
        errorMessage: "AI media MOCK provider submission failed before a provider job was created.",
        failedAt: new Date(),
        statusPayload: failureMetadata,
        safeMetadata: {
          ...(mirror.safeMetadata && typeof mirror.safeMetadata === "object" ? mirror.safeMetadata : {}),
          providerSubmitFailure: failureMetadata,
        },
      },
    });

    await client.aiMediaRequest.updateMany({
      where: { id: draft.id, organizationId: input.organizationId },
      data: {
        status: "FAILED",
        errorCode,
        errorMessage: "AI media MOCK provider submission failed before a provider job was created.",
      },
    });

    await appendAiMediaJobEvent({
      organizationId: input.organizationId,
      requestId: draft.id,
      mirrorId: mirror.id,
      actorUserId: input.requestedByUserId,
      action: "STATUS_SYNCED",
      state: failedState,
      dedupeKey: `preview-e2e:${input.organizationId}:${draft.idempotencyKey}:provider-submit-failed`,
      safeMetadata: failureMetadata,
      errorCode,
    }, db);

    throw error;
  }
  const statusPayload = providerStatusPayload(providerJob);
  const sync = await updateMirrorFromNormalizedStatus({
    mirrorId: mirror.id,
    organizationId: input.organizationId,
    providerStatusPayload: statusPayload,
    providerJobId: providerJob.job_id,
  }, db);

  await client.aiMediaRequest.updateMany({
    where: { id: draft.id, organizationId: input.organizationId },
    data: {
      status: "SUBMITTED",
      submittedAt: new Date(),
    },
  });

  const updatedMirror = await client.aiMediaJobMirror.findFirst({
    where: { id: mirror.id, organizationId: input.organizationId },
  });

  return {
    request: draft,
    mirror: updatedMirror ?? mirror,
    providerJob,
    state: sync.state,
    reused: false,
  };
}

export async function syncPreviewMockAiMediaJobStatus(
  input: {
    mirrorId: string;
    organizationId: string;
    actorUserId?: string | null;
  },
  db: AiMediaDbClient = prisma,
) {
  const client = db as any;
  const mirror = await client.aiMediaJobMirror.findFirst({
    where: {
      id: input.mirrorId,
      organizationId: input.organizationId,
      provider: "MOCK",
    },
    include: { request: true },
  });

  if (!mirror) return { found: false as const };
  if (!mirror.providerJobId) {
    await appendAiMediaJobEvent({
      organizationId: input.organizationId,
      requestId: mirror.requestId,
      mirrorId: mirror.id,
      actorUserId: input.actorUserId ?? null,
      action: "STATUS_SYNCED",
      state: mirror.state,
      dedupeKey: `preview-e2e:${input.organizationId}:${mirror.id}:missing-provider-job`,
      safeMetadata: { provider: "MOCK", providerJobIdPresent: false },
      errorCode: "PROVIDER_JOB_ID_MISSING",
    }, db);
    return { found: true as const, mirror, synced: false as const, reason: "PROVIDER_JOB_ID_MISSING" };
  }

  const providerJob = await getAiMediaJob(mirror.providerJobId);
  const sync = await updateMirrorFromNormalizedStatus({
    mirrorId: mirror.id,
    organizationId: input.organizationId,
    providerStatusPayload: providerStatusPayload(providerJob),
    providerJobId: providerJob.job_id,
  }, db);
  const updatedMirror = await client.aiMediaJobMirror.findFirst({
    where: { id: mirror.id, organizationId: input.organizationId },
    include: { request: true, imports: { orderBy: { createdAt: "desc" }, take: 1 } },
  });

  return {
    found: true as const,
    synced: true as const,
    mirror: updatedMirror ?? mirror,
    providerJob,
    state: sync.state,
  };
}
