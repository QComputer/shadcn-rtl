import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, jsonError, requireAuthSession, requireRole } from "@/lib/api-guards";
import {
  getRealPilotLaunchWorkspace,
  updateRealPilotBusinessIntake,
} from "@/lib/pilot-operations/pilot-workspace.service";

export const dynamic = "force-dynamic";

const intakeSchema = z.object({
  name: z.string().trim().min(1).optional(),
  description: z.string().trim().nullable().optional(),
  industry: z.enum(["RESTAURANT", "PHARMACY", "DENTAL_CLINIC", "FASHION_BOUTIQUE", "RETAIL_SHOP", "OTHER"]).nullable().optional(),
  address: z.string().trim().nullable().optional(),
  phone: z.string().trim().nullable().optional(),
  email: z.string().trim().email().nullable().optional(),
  website: z.string().trim().url().nullable().optional(),
  socialUrls: z.array(z.string().trim().url()).optional(),
  operatingAreas: z.array(z.string().trim().min(1)).optional(),
  preferredGoals: z.array(z.string().trim().min(1)).optional(),
  preferredKeywords: z.array(z.string().trim().min(1)).optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export async function GET(_request: Request, { params }: { params: Promise<{ organizationId: string }> }) {
  try {
    const session = await requireAuthSession();
    requireRole(session, ["SUPER_ADMIN"]);
    const { organizationId } = await params;
    return NextResponse.json({ launch: await getRealPilotLaunchWorkspace({ organizationId }) });
  } catch (error) {
    return jsonError(error, "Failed to load pilot launch workspace");
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ organizationId: string }> }) {
  try {
    const session = await requireAuthSession();
    requireRole(session, ["SUPER_ADMIN"]);
    const { organizationId } = await params;
    const parsed = intakeSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Validation failed");
    return NextResponse.json({
      launch: await updateRealPilotBusinessIntake({
        organizationId,
        actorUserId: session.user.id,
        ...parsed.data,
      }),
    });
  } catch (error) {
    return jsonError(error, "Failed to update pilot launch intake");
  }
}

