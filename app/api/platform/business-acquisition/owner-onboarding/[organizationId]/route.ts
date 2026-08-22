import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuthSession, requireRole } from "@/lib/api-guards";
import { getOwnerOnboardingReadModel } from "@/lib/business-acquisition/activation-plan.service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ organizationId: string }> },
) {
  try {
    const session = await requireAuthSession();
    requireRole(session, ["SUPER_ADMIN"]);
    const { organizationId } = await params;

    return NextResponse.json(await getOwnerOnboardingReadModel({ organizationId }));
  } catch (error) {
    return jsonError(error);
  }
}
