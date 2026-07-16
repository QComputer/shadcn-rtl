import { NextRequest, NextResponse } from "next/server";

import { ApiError, jsonError, requireAuthSession, requireCurrentOrganizationId } from "@/lib/api-guards";
import {
  buildAiMediaPreviewWriteGuardEvidenceFromEnv,
  evaluateAiMediaPreviewWriteGuard,
} from "@/lib/ai-media/preview-write-guard";
import {
  buildAiMediaPreviewDbIdentityEvidenceFromEnv,
  evaluateAiMediaPreviewDbIdentityGuard,
} from "@/lib/ai-media/preview-db-identity-guard";
import {
  buildPreviewMockRequestPlan,
} from "@/lib/services/ai-media-platform-request-service";
import { submitPreviewMockAiMediaJob } from "@/lib/services/ai-media-preview-mock-write-service";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function buildSafety(renderMutation = false) {
  return {
    renderMutation,
    blobWrite: false,
    productionWrite: false,
    browserSecretExposure: false,
    realGeneration: false,
  };
}

export async function GET() {
  try {
    const session = await requireAuthSession();
    const guard = evaluateAiMediaPreviewWriteGuard(
      buildAiMediaPreviewWriteGuardEvidenceFromEnv(process.env, session.user.role),
    );
    const dbGuard = evaluateAiMediaPreviewDbIdentityGuard(
      buildAiMediaPreviewDbIdentityEvidenceFromEnv(process.env),
    );

    return NextResponse.json({
      allowed: guard.allowed && dbGuard.allowed,
      mode: guard.mode,
      provider: guard.provider,
      realGeneration: guard.realGeneration,
      blockers: [...guard.blockers, ...dbGuard.blockers],
      dbIdentity: dbGuard.safeSummary,
      safety: buildSafety(false),
    }, { status: guard.allowed && dbGuard.allowed ? 200 : 403 });
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
    const dbGuard = evaluateAiMediaPreviewDbIdentityGuard(
      buildAiMediaPreviewDbIdentityEvidenceFromEnv(process.env),
    );

    if (!guard.allowed || !dbGuard.allowed) {
      return NextResponse.json({
        allowed: false,
        mode: guard.mode,
        blockers: [...guard.blockers, ...dbGuard.blockers],
        dbIdentity: dbGuard.safeSummary,
        safety: buildSafety(false),
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

    if (!idempotencyKey?.trim()) {
      return jsonError(new ApiError(400, "AI media Preview MOCK write requires an idempotency key."));
    }

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
        dbIdentity: dbGuard.safeSummary,
        safety: buildSafety(false),
      });
    }

    const submitted = await submitPreviewMockAiMediaJob({
      ...requestInput,
      productTitle: typeof payload.productTitle === "string" ? payload.productTitle : null,
      category: typeof payload.category === "string" ? payload.category : null,
    });

    return NextResponse.json({
      allowed: true,
      dryRun: false,
      request: { id: submitted.request.id, status: submitted.request.status },
      mirror: {
        id: submitted.mirror.id,
        state: submitted.mirror.state,
        provider: submitted.mirror.provider,
        providerJobId: submitted.mirror.providerJobId ?? null,
      },
      provider: {
        provider: submitted.providerJob.provider,
        jobId: submitted.providerJob.job_id,
        status: submitted.providerJob.status,
      },
      reused: submitted.reused,
      dbIdentity: dbGuard.safeSummary,
      safety: buildSafety(true),
    }, { status: 201 });
  } catch (error) {
    if (error instanceof TypeError) return jsonError(new ApiError(400, "Invalid request body"));
    return jsonError(error, "Failed to plan AI media Preview job");
  }
}
