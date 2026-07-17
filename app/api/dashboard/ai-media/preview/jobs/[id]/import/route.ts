import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";

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
import { importResultReadyOutput } from "@/lib/services/ai-media-result-import-service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function buildSafety() {
  return {
    renderMutation: false,
    blobWrite: false,
    productionWrite: false,
    browserSecretExposure: false,
    realGeneration: false,
    walletSettlement: false,
    rawProviderUrlExposed: false,
  };
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
        warnings: dbGuard.warnings,
        dbIdentity: dbGuard.safeSummary,
        safety: buildSafety(),
      }, { status: 403 });
    }

    const requestedOrganizationId = request.nextUrl.searchParams.get("organizationId");
    const organizationId = await requireCurrentOrganizationId(session, requestedOrganizationId);
    const body = (await request.json().catch(() => ({}))) as {
      idempotencyKey?: string;
      outputIndex?: number;
      purpose?: string;
      access?: "public" | "private";
    };

    const idempotencyKey = body.idempotencyKey?.trim();
    if (!idempotencyKey) {
      return jsonError(new Error("AI media app-managed import requires an idempotency key"), "Missing idempotency key");
    }

    const mirror = await (prisma as any).aiMediaJobMirror.findFirst({
      where: { id, organizationId },
      include: { request: true },
    });
    if (!mirror) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (mirror.state !== "RESULT_READY") {
      return NextResponse.json({
        error: "Import requires RESULT_READY mirror state",
        state: mirror.state,
      }, { status: 409 });
    }

    const result = await importResultReadyOutput({
      organizationId,
      requestId: mirror.requestId,
      mirrorId: mirror.id,
      requestedByUserId: session.user.id,
      idempotencyKey,
      outputIndex: typeof body.outputIndex === "number" ? body.outputIndex : 0,
      purpose: body.purpose ?? "ai-media-import",
      access: body.access ?? "private",
    });

    return NextResponse.json({
      allowed: true,
      idempotencyKey,
      result: {
        importId: result.importId,
        assetId: result.assetId,
        storageProvider: result.storageProvider,
        storageKeyFingerprint: result.storageKey ? hashKey(result.storageKey) : null,
        mimeType: result.mimeType,
        byteSize: result.byteSize,
        state: result.state,
        requestStatus: result.requestStatus,
        reused: result.reused,
      },
      dbIdentity: dbGuard.safeSummary,
      warnings: dbGuard.warnings,
      safety: buildSafety(),
    }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && /idempotency/.test(error.message)) {
      return jsonError(error, "Missing idempotency key");
    }
    return jsonError(error, "Failed to import AI media result");
  }
}

function hashKey(key: string) {
  return createHash("sha256").update(key).digest("hex").slice(0, 16);
}
