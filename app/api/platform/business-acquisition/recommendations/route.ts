import { NextRequest, NextResponse } from "next/server";
import { ApiError, jsonError, requireAuthSession, requireRole } from "@/lib/api-guards";
import { reviewRecommendedCapabilities } from "@/lib/business-acquisition/business-acquisition.service";
import { reviewRecommendedCapabilitiesSchema } from "@/lib/business-acquisition/validators";

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuthSession();
    requireRole(session, ["SUPER_ADMIN"]);

    const parsed = reviewRecommendedCapabilitiesSchema.safeParse(await request.json());
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Validation failed");

    return NextResponse.json(reviewRecommendedCapabilities(parsed.data));
  } catch (error) {
    return jsonError(error);
  }
}
