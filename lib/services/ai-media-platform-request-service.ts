import "server-only";
import { createHash, randomUUID } from "node:crypto";

import { prisma } from "@/lib/db";
import type { AiMediaJobPrivacyLevel } from "@/lib/ai-media/job-mirror";
import type { AiMediaPlatformTargetType, AiMediaPlatformVisibilityScope } from "@/lib/ai-media/platform-domain";

type AiMediaDbClient = typeof prisma;

export type CreateDraftAiMediaRequestInput = {
  organizationId: string;
  requestedByUserId: string;
  targetType: AiMediaPlatformTargetType;
  targetId?: string | null;
  locale?: "fa" | "en" | "ar";
  privacyLevel?: AiMediaJobPrivacyLevel;
  visibilityScope?: AiMediaPlatformVisibilityScope;
  idempotencyKey?: string | null;
  payload: Record<string, unknown>;
  prompt?: string | null;
  sourceAssetFingerprints?: string[];
};

export type CreateAiMediaQuoteDraftInput = {
  organizationId: string;
  requestId: string;
  requestedByUserId: string;
  bazAmount: number;
  policyKey: string;
  expiresAt: Date;
  idempotencyKey?: string | null;
  safeMetadata?: Record<string, unknown>;
};

function stableHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function nonEmpty(value: string | null | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

function positiveInt(value: number) {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

export function buildAiMediaRequestIdempotencyKey(input: Pick<CreateDraftAiMediaRequestInput, "organizationId" | "requestedByUserId" | "targetType" | "targetId" | "payload">) {
  return stableHash({
    scope: "ai-media-preview-request",
    organizationId: input.organizationId,
    requestedByUserId: input.requestedByUserId,
    targetType: input.targetType,
    targetId: input.targetId ?? null,
    payload: input.payload,
  });
}

export async function createDraftAiMediaRequest(
  input: CreateDraftAiMediaRequestInput,
  db: AiMediaDbClient = prisma,
) {
  const idempotencyKey = nonEmpty(input.idempotencyKey, buildAiMediaRequestIdempotencyKey(input));
  const payloadHash = stableHash(input.payload);
  const promptFingerprint = input.prompt?.trim() ? stableHash(input.prompt.trim()) : null;
  const client = db as any;

  return client.aiMediaRequest.upsert({
    where: {
      organizationId_idempotencyKey: {
        organizationId: input.organizationId,
        idempotencyKey,
      },
    },
    create: {
      organizationId: input.organizationId,
      requestedByUserId: input.requestedByUserId,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      locale: input.locale ?? "fa",
      privacyLevel: input.privacyLevel ?? "ORGANIZATION",
      visibilityScope: input.visibilityScope ?? "OWNER_ONLY",
      idempotencyKey,
      payloadHash,
      promptFingerprint,
      sourceFingerprints: input.sourceAssetFingerprints ?? [],
      requestPayload: input.payload,
    },
    update: {},
  });
}

export async function createAiMediaQuoteDraft(
  input: CreateAiMediaQuoteDraftInput,
  db: AiMediaDbClient = prisma,
) {
  const idempotencyKey = nonEmpty(input.idempotencyKey, stableHash({
    scope: "ai-media-preview-quote",
    organizationId: input.organizationId,
    requestId: input.requestId,
    policyKey: input.policyKey,
    bazAmount: positiveInt(input.bazAmount),
  }));
  const client = db as any;

  return client.aiMediaUsageQuote.upsert({
    where: {
      organizationId_idempotencyKey: {
        organizationId: input.organizationId,
        idempotencyKey,
      },
    },
    create: {
      organizationId: input.organizationId,
      requestId: input.requestId,
      requestedByUserId: input.requestedByUserId,
      bazAmount: positiveInt(input.bazAmount),
      currency: "BAZ_INTERNAL_CREDIT",
      policyKey: input.policyKey,
      idempotencyKey,
      expiresAt: input.expiresAt,
      safeMetadata: input.safeMetadata ?? {},
    },
    update: {},
  });
}

export function buildPreviewMockRequestPlan(input: CreateDraftAiMediaRequestInput) {
  const idempotencyKey = nonEmpty(input.idempotencyKey, buildAiMediaRequestIdempotencyKey(input));
  return {
    requestId: `planned-${randomUUID()}`,
    organizationId: input.organizationId,
    requestedByUserId: input.requestedByUserId,
    targetType: input.targetType,
    targetId: input.targetId ?? null,
    idempotencyKey,
    payloadHash: stableHash(input.payload),
    previewOnly: true,
    renderMutationPlanned: false,
    blobWritePlanned: false,
    bazLedgerMutationPlanned: false,
  };
}
