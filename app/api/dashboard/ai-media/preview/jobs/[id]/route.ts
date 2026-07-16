import { NextRequest, NextResponse } from "next/server";

import { jsonError, requireAuthSession, requireCurrentOrganizationId } from "@/lib/api-guards";
import {
  buildAiMediaPreviewWriteGuardEvidenceFromEnv,
  evaluateAiMediaPreviewWriteGuard,
} from "@/lib/ai-media/preview-write-guard";
import {
  buildAiMediaPreviewDbIdentityEvidenceFromEnv,
  evaluateAiMediaPreviewDbIdentityGuard,
} from "@/lib/ai-media/preview-db-identity-guard";
import { prisma } from "@/lib/db";
import {
  buildSafeSuperAdminAiMediaJobView,
  buildSafeUserAiMediaJobView,
} from "@/lib/services/ai-media-job-mirror-service";
import { buildDryRunAiMediaImportPlan } from "@/lib/services/ai-media-import-service";
import { syncPreviewMockAiMediaJobStatus } from "@/lib/services/ai-media-preview-mock-write-service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function buildSafety(renderRead = false) {
  return {
    renderRead,
    renderMutation: false,
    blobWrite: false,
    productionWrite: false,
    browserSecretExposure: false,
    realGeneration: false,
  };
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireAuthSession();
    const guard = evaluateAiMediaPreviewWriteGuard(
      buildAiMediaPreviewWriteGuardEvidenceFromEnv(process.env, session.user.role),
    );
    const dbGuard = evaluateAiMediaPreviewDbIdentityGuard(
      buildAiMediaPreviewDbIdentityEvidenceFromEnv(process.env),
    );
    const { id } = await context.params;

    if (!guard.allowed || !dbGuard.allowed) {
      return NextResponse.json({
        allowed: false,
        id,
        mode: guard.mode,
        blockers: [...guard.blockers, ...dbGuard.blockers],
        dbIdentity: dbGuard.safeSummary,
        safety: buildSafety(false),
      }, { status: 403 });
    }

    const requestedOrganizationId = request.nextUrl.searchParams.get("organizationId");
    const organizationId = await requireCurrentOrganizationId(session, requestedOrganizationId);
    const mirror = await prisma.aiMediaJobMirror.findFirst({
      where: { id, organizationId },
      include: { request: true, imports: { orderBy: { createdAt: "desc" }, take: 1 } },
    });

    if (!mirror) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const view = session.user.role === "SUPER_ADMIN"
      ? buildSafeSuperAdminAiMediaJobView({ job: mirror as any })
      : buildSafeUserAiMediaJobView({
        viewerUserId: session.user.id,
        viewerOrganizationId: organizationId,
        job: {
          id: mirror.id,
          organizationId: mirror.organizationId,
          requestedByUserId: mirror.requestedByUserId,
          state: mirror.state as any,
          provider: mirror.provider,
          providerJobId: mirror.providerJobId,
          privacyLevel: mirror.request.privacyLevel as any,
          errorCode: mirror.errorCode,
        },
      });

    return NextResponse.json({
      view,
      importPlan: buildDryRunAiMediaImportPlan({
        organizationId: mirror.organizationId,
        requestId: mirror.requestId,
        mirrorId: mirror.id,
        mirrorState: mirror.state as any,
        outputIndex: mirror.imports[0]?.outputIndex ?? 0,
        resultFingerprint: mirror.imports[0]?.resultFingerprint ?? null,
        rawOutputAvailable: false,
      }),
      dbIdentity: dbGuard.safeSummary,
      safety: buildSafety(false),
    });
  } catch (error) {
    return jsonError(error, "Failed to load AI media Preview job");
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireAuthSession();
    const guard = evaluateAiMediaPreviewWriteGuard(
      buildAiMediaPreviewWriteGuardEvidenceFromEnv(process.env, session.user.role),
    );
    const dbGuard = evaluateAiMediaPreviewDbIdentityGuard(
      buildAiMediaPreviewDbIdentityEvidenceFromEnv(process.env),
    );
    const { id } = await context.params;

    if (!guard.allowed || !dbGuard.allowed) {
      return NextResponse.json({
        allowed: false,
        id,
        mode: guard.mode,
        blockers: [...guard.blockers, ...dbGuard.blockers],
        dbIdentity: dbGuard.safeSummary,
        safety: buildSafety(false),
      }, { status: 403 });
    }

    const requestedOrganizationId = request.nextUrl.searchParams.get("organizationId");
    const organizationId = await requireCurrentOrganizationId(session, requestedOrganizationId);
    const result = await syncPreviewMockAiMediaJobStatus({
      mirrorId: id,
      organizationId,
      actorUserId: session.user.id,
    });

    if (!result.found) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const mirror = result.mirror as any;
    const view = session.user.role === "SUPER_ADMIN"
      ? buildSafeSuperAdminAiMediaJobView({ job: mirror })
      : buildSafeUserAiMediaJobView({
        viewerUserId: session.user.id,
        viewerOrganizationId: organizationId,
        job: {
          id: mirror.id,
          organizationId: mirror.organizationId,
          requestedByUserId: mirror.requestedByUserId,
          state: mirror.state,
          provider: mirror.provider,
          providerJobId: mirror.providerJobId,
          privacyLevel: mirror.request?.privacyLevel,
          errorCode: mirror.errorCode,
        },
      });

    return NextResponse.json({
      synced: result.synced,
      state: "state" in result ? result.state : mirror.state,
      view,
      provider: result.synced ? {
        provider: result.providerJob.provider,
        jobId: result.providerJob.job_id,
        status: result.providerJob.status,
      } : null,
      dbIdentity: dbGuard.safeSummary,
      safety: buildSafety(result.synced),
    });
  } catch (error) {
    return jsonError(error, "Failed to synchronize AI media Preview job");
  }
}
