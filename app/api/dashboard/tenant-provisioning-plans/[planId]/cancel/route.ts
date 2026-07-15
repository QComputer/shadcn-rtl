import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuthSession, requireRole } from "@/lib/api-guards";
import { cancelTenantProvisioningPlan } from "@/lib/tenant-provisioning/tenant-provisioning-plan.service";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ planId: string }> },
) {
  try {
    const session = await requireAuthSession();
    requireRole(session, ["SUPER_ADMIN"]);

    const { planId } = await params;
    const plan = await cancelTenantProvisioningPlan(planId, session.user.id);
    return NextResponse.json(plan);
  } catch (error) {
    return jsonError(error, "Failed to cancel tenant provisioning plan");
  }
}
