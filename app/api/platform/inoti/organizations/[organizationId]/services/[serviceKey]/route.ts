import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuthSession, requireRole } from "@/lib/api-guards";
import { disableInotiService } from "@/lib/integrations/inoti-account-management";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ organizationId: string; serviceKey: string }> },
) {
  try {
    const session = await requireAuthSession();
    requireRole(session, ["SUPER_ADMIN"]);
    const { organizationId, serviceKey } = await params;
    return NextResponse.json({ inoti: await disableInotiService({ organizationId, serviceKey, actorUserId: session.user.id }) });
  } catch (error) {
    return jsonError(error, "Failed to disable iNoti service");
  }
}
