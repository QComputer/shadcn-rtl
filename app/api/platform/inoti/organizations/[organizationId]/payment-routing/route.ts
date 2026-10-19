import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, jsonError, requireAuthSession, requireRole, requireSameOriginMutation } from "@/lib/api-guards";
import { setOrganizationInotiPaymentRouting } from "@/lib/integrations/inoti-ussd/account-routing.server";

export const dynamic = "force-dynamic";
const bodySchema = z.object({
  merchantAccountKey: z.enum(["PLATFORM_OWNER", "CAFE_LEO"]),
  reason: z.string().trim().min(10).max(500),
}).strict();

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ organizationId: string }> },
) {
  try {
    requireSameOriginMutation(request);
    const session = await requireAuthSession();
    requireRole(session, ["SUPER_ADMIN"]);
    const { organizationId } = await params;
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) throw new ApiError(400, "Invalid iNoti payment account policy");
    return NextResponse.json({ routing: await setOrganizationInotiPaymentRouting({
      organizationId,
      merchantAccountKey: parsed.data.merchantAccountKey,
      actorUserId: session.user.id,
      reason: parsed.data.reason,
    }) });
  } catch (error) {
    return jsonError(error, "Failed to update iNoti payment routing");
  }
}
