import { NextRequest, NextResponse } from "next/server";
import { ApiError, jsonError, requireAuthSession, requireSameOriginMutation } from "@/lib/api-guards";
import { submitCourierCashCollection } from "@/lib/retail/cash.server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ orderNumber: string }> }) {
  try {
    requireSameOriginMutation(request);
    const session = await requireAuthSession();
    const { orderNumber } = await params;
    const organizationSlug = request.nextUrl.searchParams.get("organization")?.trim();
    if (!organizationSlug) throw new ApiError(400, "Store is required.");
    const report = await submitCourierCashCollection({
      organizationSlug, orderNumber, actorUserId: session.user.id,
    });
    return NextResponse.json({ report }, { status: 201 });
  } catch (error) { return jsonError(error, "Could not report courier cash collection."); }
}
