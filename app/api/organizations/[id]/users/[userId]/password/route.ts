import { NextRequest, NextResponse } from "next/server";
import { ApiError, jsonError, requireAuthSession, requireSameOriginMutation } from "@/lib/api-guards";
import { resetOrganizationAccountPasswordSchema } from "@/lib/user-provisioning/contract";
import { organizationAccountProvisioningService } from "@/lib/user-provisioning/service";

const privateHeaders = { "Cache-Control": "private, no-store, max-age=0" };

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; userId: string }> }) {
  try {
    const session = await requireAuthSession();
    requireSameOriginMutation(request);
    const { id, userId } = await params;
    const body = await request.json().catch(() => null);
    const parsed = resetOrganizationAccountPasswordSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, "Invalid password reset request");
    const actor = { userId: session.user.id, sessionRole: session.user.role, sessionOrganizationId: session.user.organizationId } satisfies Parameters<typeof organizationAccountProvisioningService.resetPassword>[0];
    return NextResponse.json(await organizationAccountProvisioningService.resetPassword(actor, id, userId, parsed.data.password), { headers: privateHeaders });
  } catch (error) {
    return jsonError(error, "Could not reset organization account password");
  }
}
