import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-guards";
import { creativeStudioService } from "@/lib/services/creative-studio.service";
import { requireCreativeStudioOrganization } from "../_helpers";

export async function GET(request: NextRequest) {
  try {
    const requestedOrganizationId = request.nextUrl.searchParams.get("organizationId");
    const { organizationId } = await requireCreativeStudioOrganization(requestedOrganizationId);
    const status = await creativeStudioService.getStatus(organizationId);
    return NextResponse.json({ status });
  } catch (error) {
    return jsonError(error, "Failed to load Creative Studio status");
  }
}
