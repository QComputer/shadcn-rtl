import { NextRequest, NextResponse } from "next/server";
import {
  ApiError,
  jsonError,
  requireAuthSession,
  requireOrgAccess,
} from "@/lib/api-guards";
import { aiMediaService } from "@/lib/services/ai-media.service";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuthSession();
    const requestedOrganizationId = request.nextUrl.searchParams.get("organizationId");
    const organizationId = session.user.role === "SUPER_ADMIN"
      ? requestedOrganizationId || session.user.organizationId
      : session.user.organizationId;

    if (!organizationId) {
      throw new ApiError(400, "Organization is required");
    }

    await requireOrgAccess(session, organizationId, ["ADMIN", "MANAGER"]);
    const usage = await aiMediaService.getUsageSummary(organizationId);

    return NextResponse.json({ usage });
  } catch (error) {
    return jsonError(error, "Failed to load AI media usage");
  }
}
