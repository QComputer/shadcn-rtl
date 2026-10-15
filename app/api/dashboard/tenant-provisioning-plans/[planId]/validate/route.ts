import { provisioningError as jsonError } from "@/lib/tenant-provisioning/http";
import { prisma } from "@/lib/db";
import { universalProvisioningService } from "@/lib/tenant-provisioning/universal-provisioning.service";
import { NextRequest, NextResponse } from "next/server";
import { requireAuthSession, requireRole, requireSameOriginMutation } from "@/lib/api-guards";
import { validateTenantProvisioningPlan } from "@/lib/tenant-provisioning/tenant-provisioning-plan.service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ planId: string }> },
) {
  try {
    const session = await requireAuthSession();
    requireRole(session, ["SUPER_ADMIN"]);

    const { planId } = await params;
    requireSameOriginMutation(request);
    const current = await prisma.tenantProvisioningPlan.findUnique({ where: { id: planId }, select: { executionConfiguration: true } });
    if (current?.executionConfiguration) return NextResponse.json(await universalProvisioningService.validate({ userId: session.user.id, role: session.user.role }, planId), { headers: { "Cache-Control": "private, no-store" } });
    const plan = await validateTenantProvisioningPlan(planId, session.user.id);
    return NextResponse.json(plan);
  } catch (error) {
    return jsonError(error, "Failed to validate tenant provisioning plan");
  }
}
