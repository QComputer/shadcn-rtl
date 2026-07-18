import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuthSession, requireCurrentOrganizationId } from "@/lib/api-guards";
import { listAvailableAiMediaAssets } from "@/lib/services/ai-media-asset-service";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuthSession();
    const requestedOrganizationId = request.nextUrl.searchParams.get("organizationId");
    const organizationId = await requireCurrentOrganizationId(session, requestedOrganizationId || undefined);

    const page = Number.parseInt(request.nextUrl.searchParams.get("page") || "1", 10);
    const pageSize = Number.parseInt(request.nextUrl.searchParams.get("pageSize") || "20", 10);
    const requestedByUserId = request.nextUrl.searchParams.get("requestedByUserId") || undefined;

    const result = await listAvailableAiMediaAssets({
      organizationId,
      page: Number.isFinite(page) && page > 0 ? page : 1,
      pageSize: Number.isFinite(pageSize) && pageSize > 0 ? pageSize : 20,
      requestedByUserId: requestedByUserId ?? null,
    });

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error, "Failed to list AI media assets");
  }
}
