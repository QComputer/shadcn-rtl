import "server-only";
import { createHash, randomUUID } from "node:crypto";

import { prisma } from "@/lib/db";
import {
  getNormalUserJobVisibility,
  getSuperAdminJobVisibility,
  getWorkerOperatorJobVisibility,
  mapNetworkStatusToJobMirrorState,
  type AiMediaJobMirrorState,
  type AiMediaJobMirrorViewerRole,
  type AiMediaJobPrivacyLevel,
} from "@/lib/ai-media/job-mirror";
import { AI_MEDIA_PINNED_RENDER_CONTRACT } from "@/lib/ai-media/pinned-render-contract";

type AiMediaDbClient = typeof prisma;

export type CreateAiMediaJobMirrorInput = {
  requestId: string;
  organizationId: string;
  requestedByUserId: string;
  provider?: string | null;
  providerJobId?: string | null;
  providerStatus?: string | null;
  correlationId?: string | null;
  idempotencyKey: string;
  payloadHash: string;
  state?: AiMediaJobMirrorState;
  safeMetadata?: Record<string, unknown>;
};

export type AppendAiMediaJobEventInput = {
  organizationId: string;
  requestId?: string | null;
  mirrorId?: string | null;
  actorUserId?: string | null;
  action:
    | "REQUEST_DRAFTED"
    | "QUOTE_CREATED"
    | "HOLD_PLANNED"
    | "JOB_MIRRORED"
    | "STATUS_SYNCED"
    | "IMPORT_PLANNED"
    | "ASSET_ACCEPTED"
    | "SPEND_RELEASE_PLANNED"
    | "CONTRIBUTION_MIRRORED";
  state?: AiMediaJobMirrorState | null;
  dedupeKey: string;
  safeMetadata?: Record<string, unknown>;
  errorCode?: string | null;
};

function stableHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export async function createAiMediaJobMirror(
  input: CreateAiMediaJobMirrorInput,
  db: AiMediaDbClient = prisma,
) {
  const client = db as any;
  const provider = input.provider?.trim() || "MOCK";

  return client.aiMediaJobMirror.upsert({
    where: {
      organizationId_idempotencyKey: {
        organizationId: input.organizationId,
        idempotencyKey: input.idempotencyKey,
      },
    },
    create: {
      requestId: input.requestId,
      organizationId: input.organizationId,
      requestedByUserId: input.requestedByUserId,
      state: input.state ?? "DRAFT",
      provider,
      providerJobId: input.providerJobId ?? null,
      providerStatus: input.providerStatus ?? null,
      contractFingerprint: AI_MEDIA_PINNED_RENDER_CONTRACT.openApiFingerprintSha256,
      correlationId: input.correlationId?.trim() || `bb-ai-preview-${randomUUID()}`,
      idempotencyKey: input.idempotencyKey,
      payloadHash: input.payloadHash,
      safeMetadata: input.safeMetadata ?? {},
    },
    update: {},
  });
}

export async function appendAiMediaJobEvent(
  input: AppendAiMediaJobEventInput,
  db: AiMediaDbClient = prisma,
) {
  const client = db as any;
  return client.aiMediaJobEvent.upsert({
    where: {
      organizationId_dedupeKey: {
        organizationId: input.organizationId,
        dedupeKey: input.dedupeKey,
      },
    },
    create: {
      organizationId: input.organizationId,
      requestId: input.requestId ?? null,
      mirrorId: input.mirrorId ?? null,
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      state: input.state ?? null,
      dedupeKey: input.dedupeKey,
      safeMetadata: input.safeMetadata ?? {},
      errorCode: input.errorCode ?? null,
    },
    update: {},
  });
}

export async function updateMirrorFromNormalizedStatus(
  input: {
    mirrorId: string;
    organizationId: string;
    providerStatusPayload: unknown;
    providerJobId?: string | null;
  },
  db: AiMediaDbClient = prisma,
) {
  const nextState = mapNetworkStatusToJobMirrorState(input.providerStatusPayload);
  const client = db as any;
  const updated = await client.aiMediaJobMirror.updateMany({
    where: {
      id: input.mirrorId,
      organizationId: input.organizationId,
    },
    data: {
      state: nextState,
      providerJobId: input.providerJobId ?? undefined,
      providerStatus: typeof input.providerStatusPayload === "object" && input.providerStatusPayload
        ? JSON.stringify(input.providerStatusPayload).slice(0, 120)
        : String(input.providerStatusPayload ?? "").slice(0, 120),
      statusPayload: input.providerStatusPayload ?? {},
      resultReadyAt: nextState === "RESULT_READY" ? new Date() : undefined,
      importedAt: nextState === "IMPORTED" ? new Date() : undefined,
      failedAt: nextState === "FAILED_FINAL" || nextState === "FAILED_RETRYABLE" ? new Date() : undefined,
      cancelledAt: nextState === "CANCELLED" ? new Date() : undefined,
    },
  });

  await appendAiMediaJobEvent({
    organizationId: input.organizationId,
    mirrorId: input.mirrorId,
    action: "STATUS_SYNCED",
    state: nextState,
    dedupeKey: stableHash({
      scope: "ai-media-status-sync",
      mirrorId: input.mirrorId,
      nextState,
      payload: input.providerStatusPayload,
    }),
    safeMetadata: {
      providerJobId: input.providerJobId ?? null,
      state: nextState,
    },
  }, db);

  return { updatedCount: updated.count ?? 0, state: nextState };
}

export function buildSafeUserAiMediaJobView(input: {
  viewerUserId: string;
  viewerOrganizationId: string;
  job: {
    id: string;
    organizationId: string;
    requestedByUserId: string;
    state: AiMediaJobMirrorState;
    provider: string;
    providerJobId?: string | null;
    privacyLevel?: AiMediaJobPrivacyLevel;
    errorCode?: string | null;
  };
}) {
  const visibility = getNormalUserJobVisibility({
    viewerUserId: input.viewerUserId,
    viewerOrganizationId: input.viewerOrganizationId,
    jobRequestedByUserId: input.job.requestedByUserId,
    jobOrganizationId: input.job.organizationId,
    privacyLevel: input.job.privacyLevel,
  });

  if (!visibility.canSeeJob) return { visible: false as const };
  return {
    visible: true as const,
    id: input.job.id,
    organizationId: input.job.organizationId,
    state: input.job.state,
    provider: input.job.provider,
    providerJobId: visibility.canSeeProviderDiagnostics ? input.job.providerJobId ?? null : null,
    errorCode: input.job.errorCode ?? null,
    visibility,
  };
}

export function buildSafeSuperAdminAiMediaJobView(input: {
  job: {
    id: string;
    organizationId: string;
    requestedByUserId: string;
    state: AiMediaJobMirrorState;
    provider: string;
    providerJobId?: string | null;
    payloadHash?: string | null;
  };
}) {
  return {
    visible: true as const,
    diagnosticMarker: "SUPER_ADMIN_AI_MEDIA_JOB_VIEW",
    ...input.job,
    visibility: getSuperAdminJobVisibility(),
  };
}

export function buildSafeWorkerOperatorAiMediaJobView(input: {
  job: {
    id: string;
    organizationId: string;
    state: AiMediaJobMirrorState;
    provider: string;
    providerJobId?: string | null;
  };
}) {
  return {
    visible: true as const,
    id: input.job.id,
    organizationId: input.job.organizationId,
    state: input.job.state,
    provider: input.job.provider,
    providerJobId: input.job.providerJobId ?? null,
    prompt: null,
    sourceImages: [],
    generatedFiles: [],
    visibility: getWorkerOperatorJobVisibility(),
  };
}

export function buildSafeAiMediaJobViewForRole(role: AiMediaJobMirrorViewerRole, job: Parameters<typeof buildSafeWorkerOperatorAiMediaJobView>[0]["job"]) {
  if (role === "SUPER_ADMIN") return buildSafeSuperAdminAiMediaJobView({ job: { ...job, requestedByUserId: "hidden" } });
  if (role === "WORKER_OPERATOR") return buildSafeWorkerOperatorAiMediaJobView({ job });
  return { visible: false as const };
}
