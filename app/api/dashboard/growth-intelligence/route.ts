import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuthSession, requireCurrentOrganizationId } from "@/lib/api-guards";
import { getOwnerGrowthReadModel } from "@/lib/growth-intelligence/growth-intelligence.service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuthSession();
    const organizationId = await requireCurrentOrganizationId(
      session,
      request.nextUrl.searchParams.get("organizationId"),
    );

    return NextResponse.json({
      growth: await getOwnerGrowthReadModel({ organizationId }),
    });
  } catch (error) {
    return jsonError(error, "Failed to load growth intelligence dashboard");
  }
}
