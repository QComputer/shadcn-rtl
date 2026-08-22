import { NextResponse } from "next/server";
import { jsonError, requireAuthSession, requireRole } from "@/lib/api-guards";
import { getPilotWorkspace, updatePilotWorkspace } from "@/lib/pilot-operations/pilot-workspace.service";

export async function GET(_request: Request, { params }: { params: Promise<{ organizationId: string }> }) {
  try {
    const session = await requireAuthSession();
    requireRole(session, ["SUPER_ADMIN"]);
    const { organizationId } = await params;
    return NextResponse.json({ pilot: await getPilotWorkspace({ organizationId }) });
  } catch (error) {
    return jsonError(error, "Failed to load pilot workspace");
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ organizationId: string }> }) {
  try {
    const session = await requireAuthSession();
    requireRole(session, ["SUPER_ADMIN"]);
    const { organizationId } = await params;
    const body = await request.json();
    return NextResponse.json({
      pilot: await updatePilotWorkspace({
        organizationId,
        actorUserId: session.user.id,
        status: body.status,
        assignedOperatorId: body.assignedOperatorId ?? undefined,
        notes: body.notes ?? undefined,
        seoGrowthPlanner: body.seoGrowthPlanner,
      }),
    });
  } catch (error) {
    return jsonError(error, "Failed to update pilot workspace");
  }
}
