import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, jsonError, requireAuthSession, requireRole } from "@/lib/api-guards";
import {
  getRealPilotLaunchWorkspace,
  registerPilotSourceAssessment,
} from "@/lib/pilot-operations/pilot-workspace.service";

export const dynamic = "force-dynamic";

const sourceSchema = z.object({
  sourceKind: z.enum(["SNAPPFOOD", "WEBSITE", "INSTAGRAM", "INOTI", "IAM", "MANUAL", "CSV", "OTHER"]),
  displayName: z.string().trim().min(1).optional(),
  sourceUrl: z.string().trim().url().nullable().optional(),
  intendedPurpose: z.string().trim().min(1),
  assessmentStatus: z.enum([
    "NOT_ASSESSED",
    "MANUAL_ONLY",
    "ADAPTER_AVAILABLE",
    "READY_FOR_REVIEW",
    "REQUIRES_CREDENTIALS",
    "REQUIRES_EXTERNAL_APPROVAL",
    "UNSUPPORTED",
  ]).optional(),
  legalAssessmentStatus: z.enum([
    "NOT_ASSESSED",
    "MANUAL_ONLY",
    "ADAPTER_AVAILABLE",
    "READY_FOR_REVIEW",
    "REQUIRES_CREDENTIALS",
    "REQUIRES_EXTERNAL_APPROVAL",
    "UNSUPPORTED",
  ]).optional(),
  technicalAssessmentStatus: z.enum([
    "NOT_ASSESSED",
    "MANUAL_ONLY",
    "ADAPTER_AVAILABLE",
    "READY_FOR_REVIEW",
    "REQUIRES_CREDENTIALS",
    "REQUIRES_EXTERNAL_APPROVAL",
    "UNSUPPORTED",
  ]).optional(),
  dataExpected: z.array(z.string().trim().min(1)).optional(),
  manualImportRequired: z.boolean().optional(),
  adapterSupport: z.enum(["NONE", "LOCAL_PREVIEW_FIXTURE", "MANUAL_INPUT", "FUTURE_CONNECTOR"]).optional(),
  externalVerificationRequired: z.boolean().optional(),
  provenance: z.enum(["MANUAL_OPERATOR", "BUSINESS_OWNER", "EXTERNAL_CATALOG", "WEBSITE", "SOCIAL", "INOTI", "IAM", "LEGACY_IMPORT"]).optional(),
});

export async function GET(_request: Request, { params }: { params: Promise<{ organizationId: string }> }) {
  try {
    const session = await requireAuthSession();
    requireRole(session, ["SUPER_ADMIN"]);
    const { organizationId } = await params;
    const launch = await getRealPilotLaunchWorkspace({ organizationId });
    return NextResponse.json({ sources: launch.sourceAssessments });
  } catch (error) {
    return jsonError(error, "Failed to load pilot source assessments");
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ organizationId: string }> }) {
  try {
    const session = await requireAuthSession();
    requireRole(session, ["SUPER_ADMIN"]);
    const { organizationId } = await params;
    const parsed = sourceSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Validation failed");
    return NextResponse.json({
      source: await registerPilotSourceAssessment({
        organizationId,
        actorUserId: session.user.id,
        ...parsed.data,
      }),
    });
  } catch (error) {
    return jsonError(error, "Failed to register pilot source assessment");
  }
}

