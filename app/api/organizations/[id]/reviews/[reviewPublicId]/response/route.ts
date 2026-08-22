import { NextResponse } from "next/server";
import { jsonError, requireAuthSession } from "@/lib/api-guards";
import { respondToReview } from "@/lib/customer-reputation/customer-reputation.service";
import { requireTenantContext } from "@/lib/tenant-context";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; reviewPublicId: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { id, reviewPublicId } = await params;
    await requireTenantContext(session, id, ["ADMIN", "MANAGER"]);
    const body = await request.json();
    const response = await respondToReview({
      organizationId: id,
      reviewPublicId,
      responseText: String(body.responseText ?? ""),
      actorUserId: session.user.id,
    });

    return NextResponse.json({ response });
  } catch (error) {
    return jsonError(error, "Failed to respond to review");
  }
}
