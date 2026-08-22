import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, jsonError, requireAuthSession, requireRole } from "@/lib/api-guards";
import {
  generateGrowthRecommendations,
  getGrowthPlan,
  upsertBusinessGrowthProfile,
} from "@/lib/growth-intelligence/growth-intelligence.service";

export const dynamic = "force-dynamic";

const profileSchema = z.object({
  primaryGoals: z.array(z.string().trim().min(1)).optional(),
  targetAudience: z.array(z.string().trim().min(1)).optional(),
  preferredKeywords: z.array(z.string().trim().min(1)).optional(),
  preferredLocations: z.array(z.string().trim().min(1)).optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "READY", "ARCHIVED"]).optional(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ organizationId: string }> }) {
  try {
    const session = await requireAuthSession();
    requireRole(session, ["SUPER_ADMIN"]);
    const { organizationId } = await params;
    const refresh = request.nextUrl.searchParams.get("refresh") === "1";

    return NextResponse.json({
      growthPlan: await getGrowthPlan({ organizationId, refresh, actorUserId: session.user.id }),
    });
  } catch (error) {
    return jsonError(error, "Failed to load growth intelligence plan");
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ organizationId: string }> }) {
  try {
    const session = await requireAuthSession();
    requireRole(session, ["SUPER_ADMIN"]);
    const { organizationId } = await params;
    const parsed = profileSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Validation failed");

    await upsertBusinessGrowthProfile({
      organizationId,
      actorUserId: session.user.id,
      ...parsed.data,
    });
    await generateGrowthRecommendations({ organizationId, actorUserId: session.user.id });

    return NextResponse.json({
      growthPlan: await getGrowthPlan({ organizationId, actorUserId: session.user.id }),
    });
  } catch (error) {
    return jsonError(error, "Failed to update growth intelligence plan");
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ organizationId: string }> }) {
  return PATCH(request, context);
}
