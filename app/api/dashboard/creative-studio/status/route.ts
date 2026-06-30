import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-guards";
import { creativeStudioService } from "@/lib/services/creative-studio.service";
import { requireCreativeStudioOrganization } from "../_helpers";

export async function GET(request: NextRequest) {
  try {
    const requestedOrganizationId = request.nextUrl.searchParams.get("organizationId");
    const checkGenerationReadiness = request.nextUrl.searchParams.get("check") === "1";
    const { organizationId } = await requireCreativeStudioOrganization(requestedOrganizationId);
    const status = await creativeStudioService.getStatus(organizationId, { checkGenerationReadiness });
    return NextResponse.json({ status });
  } catch (error) {
    return jsonError(error, "Failed to load Creative Studio status");
  }
}
