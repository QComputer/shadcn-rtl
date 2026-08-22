import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, jsonError, requireAuthSession, requireRole } from "@/lib/api-guards";
import { completeActivationStep } from "@/lib/business-acquisition/activation-plan.service";

const completeStepSchema = z.object({
  actionKey: z.string().trim().min(3).max(120),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ organizationId: string }> },
) {
  try {
    const session = await requireAuthSession();
    requireRole(session, ["SUPER_ADMIN"]);
    const { organizationId } = await params;
    const parsed = completeStepSchema.safeParse(await request.json());
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Validation failed");

    return NextResponse.json({
      activationPlan: await completeActivationStep({
        organizationId,
        actionKey: parsed.data.actionKey,
        completedByUserId: session.user.id,
      }),
    });
  } catch (error) {
    return jsonError(error);
  }
}
