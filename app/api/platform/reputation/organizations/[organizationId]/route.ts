import { NextResponse } from "next/server";
import { jsonError, requireAuthSession, requireRole } from "@/lib/api-guards";
import { getOrganizationReputationOverview, getReviewSeoReadiness } from "@/lib/customer-reputation/customer-reputation.service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ organizationId: string }> },
) {
  try {
    const session = await requireAuthSession();
    requireRole(session, ["SUPER_ADMIN"]);
    const { organizationId } = await params;
    const [overview, seoReadiness] = await Promise.all([
      getOrganizationReputationOverview({ organizationId }),
      getReviewSeoReadiness({ organizationId }),
    ]);

    return NextResponse.json({ overview, seoReadiness });
  } catch (error) {
    return jsonError(error, "Failed to load reputation overview");
  }
}
