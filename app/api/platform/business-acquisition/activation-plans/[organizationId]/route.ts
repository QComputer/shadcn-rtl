import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireAuthSession, requireRole } from "@/lib/api-guards";
import { generateActivationPlan, getActivationPlan } from "@/lib/business-acquisition/activation-plan.service";
import { industryKeys } from "@/lib/business-acquisition/validators";

const generateSchema = z.object({
  industryKey: z.enum(industryKeys).optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ organizationId: string }> },
) {
  try {
    const session = await requireAuthSession();
    requireRole(session, ["SUPER_ADMIN"]);
    const { organizationId } = await params;

    return NextResponse.json({ activationPlan: await getActivationPlan({ organizationId }) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ organizationId: string }> },
) {
  try {
    const session = await requireAuthSession();
    requireRole(session, ["SUPER_ADMIN"]);
    const { organizationId } = await params;
    const parsed = generateSchema.parse(await request.json().catch(() => ({})));

    return NextResponse.json({
      activationPlan: await generateActivationPlan({
        organizationId,
        industryKey: parsed.industryKey,
        generatedByUserId: session.user.id,
      }),
    });
  } catch (error) {
    return jsonError(error);
  }
}
