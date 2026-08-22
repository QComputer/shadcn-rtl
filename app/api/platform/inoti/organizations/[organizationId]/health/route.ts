import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuthSession, requireRole } from "@/lib/api-guards";
import { checkInotiServiceHealth } from "@/lib/integrations/inoti-account-management";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ organizationId: string }> },
) {
  try {
    const session = await requireAuthSession();
    requireRole(session, ["SUPER_ADMIN"]);
    const { organizationId } = await params;
    const body = await request.json().catch(() => ({}));
    const serviceKey = typeof body?.serviceKey === "string" ? body.serviceKey : null;
    return NextResponse.json({ inoti: await checkInotiServiceHealth({ organizationId, serviceKey, actorUserId: session.user.id }) });
  } catch (error) {
    return jsonError(error, "Failed to check iNoti health");
  }
}
