import { NextResponse } from "next/server";
import { ApiError, jsonError, requireAuthSession, requireRole } from "@/lib/api-guards";
import { completePilotChecklistItem } from "@/lib/pilot-operations/pilot-workspace.service";

export async function POST(request: Request, { params }: { params: Promise<{ organizationId: string }> }) {
  try {
    const session = await requireAuthSession();
    requireRole(session, ["SUPER_ADMIN"]);
    const { organizationId } = await params;
    const body = await request.json();
    if (!body?.itemKey || typeof body.itemKey !== "string") {
      throw new ApiError(400, "itemKey is required");
    }
    return NextResponse.json({
      pilot: await completePilotChecklistItem({
        organizationId,
        itemKey: body.itemKey,
        completed: body.completed !== false,
        actorUserId: session.user.id,
      }),
    });
  } catch (error) {
    return jsonError(error, "Failed to update pilot checklist");
  }
}
