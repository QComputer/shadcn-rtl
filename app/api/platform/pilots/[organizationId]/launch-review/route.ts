import { NextResponse } from "next/server";
import { jsonError, requireAuthSession, requireRole } from "@/lib/api-guards";
import { recordPilotLaunchReview } from "@/lib/pilot-operations/pilot-workspace.service";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ organizationId: string }> }) {
  try {
    const session = await requireAuthSession();
    requireRole(session, ["SUPER_ADMIN"]);
    const { organizationId } = await params;
    const body = await request.json().catch(() => ({}));
    return NextResponse.json({
      launch: await recordPilotLaunchReview({
        organizationId,
        actorUserId: session.user.id,
        notes: typeof body?.notes === "string" ? body.notes : null,
      }),
    });
  } catch (error) {
    return jsonError(error, "Failed to complete pilot launch review");
  }
}

