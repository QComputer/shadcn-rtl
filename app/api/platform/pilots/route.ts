import { NextResponse } from "next/server";
import { ApiError, jsonError, requireAuthSession, requireRole } from "@/lib/api-guards";
import { createOrRefreshPilotWorkspace, listPilotWorkspaces } from "@/lib/pilot-operations/pilot-workspace.service";

export async function GET() {
  try {
    const session = await requireAuthSession();
    requireRole(session, ["SUPER_ADMIN"]);
    return NextResponse.json(await listPilotWorkspaces());
  } catch (error) {
    return jsonError(error, "Failed to load pilot workspaces");
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuthSession();
    requireRole(session, ["SUPER_ADMIN"]);
    const body = await request.json();
    if (!body?.organizationId || typeof body.organizationId !== "string") {
      throw new ApiError(400, "organizationId is required");
    }
    return NextResponse.json({
      pilot: await createOrRefreshPilotWorkspace({
        organizationId: body.organizationId,
        actorUserId: session.user.id,
        status: body.status,
        assignedOperatorId: body.assignedOperatorId ?? undefined,
        notes: body.notes ?? undefined,
        seoGrowthPlanner: body.seoGrowthPlanner,
      }),
    });
  } catch (error) {
    return jsonError(error, "Failed to create pilot workspace");
  }
}
