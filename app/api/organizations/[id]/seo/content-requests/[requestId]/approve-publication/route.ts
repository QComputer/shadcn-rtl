import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuthSession } from "@/lib/api-guards";
import { requireTenantContext } from "@/lib/tenant-context";
import { approveContentPublication } from "@/lib/seo-content/seo-content.service";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; requestId: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { id, requestId } = await params;
    const context = await requireTenantContext(session, id, ["ADMIN", "MANAGER"]);
    return NextResponse.json({
      request: await approveContentPublication({
        organizationId: id,
        requestId,
        approvedByUserId: context.actorUserId,
      }),
    });
  } catch (error) {
    return jsonError(error);
  }
}
