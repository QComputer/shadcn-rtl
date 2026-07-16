import { NextRequest, NextResponse } from "next/server";

import { ApiError, jsonError, requireAuthSession, requireCurrentOrganizationId } from "@/lib/api-guards";
import {
  buildAiMediaPreviewWriteGuardEvidenceFromEnv,
  evaluateAiMediaPreviewWriteGuard,
} from "@/lib/ai-media/preview-write-guard";
import {
  buildPreviewMockRequestPlan,
  createDraftAiMediaRequest,
} from "@/lib/services/ai-media-platform-request-service";
import {
  appendAiMediaJobEvent,
  createAiMediaJobMirror,
} from "@/lib/services/ai-media-job-mirror-service";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export async function GET() {
  try {
    const session = await requireAuthSession();
    const guard = evaluateAiMediaPreviewWriteGuard(
      buildAiMediaPreviewWriteGuardEvidenceFromEnv(process.env, session.user.role),
    );

    return NextResponse.json({
      allowed: guard.allowed,
      mode: guard.mode,
      provider: guard.provider,
      realGeneration: guard.realGeneration,
      blockers: guard.blockers,
      safety: {
        renderMutation: false,
        blobWrite: false,
        productionWrite: false,
        browserSecretExposure: false,
      },
    }, { status: guard.allowed ? 200 : 403 });
  } catch (error) {
    return jsonError(error, "Failed to load AI media Preview write status");
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuthSession();
    const body = asRecord(await request.json().catch(() => ({})));
    const guard = evaluateAiMediaPreviewWriteGuard(
      buildAiMediaPreviewWriteGuardEvidenceFromEnv(process.env, session.user.role),
    );

    if (!guard.allowed) {
      return NextResponse.json({
        allowed: false,
        mode: guard.mode,
        blockers: guard.blockers,
        safety: {
          renderMutation: false,
          blobWrite: false,
          productionWrite: false,
          browserSecretExposure: false,
        },
      }, { status: 403 });
    }

    const organizationId = await requireCurrentOrganizationId(
      session,
      typeof body.organizationId === "string" ? body.organizationId : null,
    );
    const payload = asRecord(body.payload);
    const targetType = typeof body.targetType === "string" ? body.targetType : "PRODUCT_IMAGE";
    const targetId = typeof body.targetId === "string" ? body.targetId : null;
    const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey : null;
    const dryRun = body.dryRun !== false;

    const requestInput = {
      organizationId,
      requestedByUserId: session.user.id,
      targetType: targetType as any,
      targetId,
      idempotencyKey,
      payload,
      prompt: typeof payload.prompt === "string" ? payload.prompt : null,
    };

    if (dryRun) {
      return NextResponse.json({
        allowed: true,
        dryRun: true,
        plan: buildPreviewMockRequestPlan(requestInput),
        safety: {
          renderMutation: false,
          blobWrite: false,
          productionWrite: false,
          browserSecretExposure: false,
        },
      });
    }

    const draft = await createDraftAiMediaRequest(requestInput);
    const mirror = await createAiMediaJobMirror({
      requestId: draft.id,
      organizationId,
      requestedByUserId: session.user.id,
      provider: "MOCK",
      idempotencyKey: draft.idempotencyKey,
      payloadHash: draft.payloadHash,
      state: "READY_TO_SUBMIT",
      safeMetadata: {
        phase: "BAZAR-BAZ-AI-NETWORK-PREVIEW-MOCK-WRITE-FOUNDATION-01",
        renderMutation: false,
      },
    });

    await appendAiMediaJobEvent({
      organizationId,
      requestId: draft.id,
      mirrorId: mirror.id,
      actorUserId: session.user.id,
      action: "JOB_MIRRORED",
      state: "READY_TO_SUBMIT",
      dedupeKey: `preview-foundation:${organizationId}:${draft.idempotencyKey}:job-mirrored`,
      safeMetadata: {
        provider: "MOCK",
        renderMutation: false,
        blobWrite: false,
      },
    });

    return NextResponse.json({
      allowed: true,
      dryRun: false,
      request: { id: draft.id, status: draft.status },
      mirror: { id: mirror.id, state: mirror.state, provider: mirror.provider },
      safety: {
        renderMutation: false,
        blobWrite: false,
        productionWrite: false,
        browserSecretExposure: false,
      },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof TypeError) return jsonError(new ApiError(400, "Invalid request body"));
    return jsonError(error, "Failed to plan AI media Preview job");
  }
}
