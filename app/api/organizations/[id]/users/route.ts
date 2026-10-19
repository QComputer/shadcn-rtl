import { NextRequest, NextResponse } from "next/server";
import { ApiError, jsonError, requireAuthSession, requireSameOriginMutation, type SessionWithUser } from "@/lib/api-guards";
import { provisionOrganizationAccountSchema } from "@/lib/user-provisioning/contract";
import { organizationAccountProvisioningService } from "@/lib/user-provisioning/service";

const privateHeaders = { "Cache-Control": "private, no-store, max-age=0" };

function trustedActor(session: SessionWithUser) {
  return { userId: session.user.id, sessionRole: session.user.role, sessionOrganizationId: session.user.organizationId };
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuthSession();
    requireSameOriginMutation(request);
    const { id } = await params;
    const body = await request.json().catch(() => null);
    const parsed = provisionOrganizationAccountSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, "Invalid account details");
    const result = await organizationAccountProvisioningService.provision(trustedActor(session), id, parsed.data);
    return NextResponse.json(result, { status: result.created ? 201 : 200, headers: privateHeaders });
  } catch (error) {
    return jsonError(error, "Could not create organization account");
  }
}
