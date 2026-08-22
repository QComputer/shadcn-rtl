import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuthSession } from "@/lib/api-guards";
import { getOwnerActivationDashboard } from "@/lib/business-acquisition/owner-activation.service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuthSession();
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");
    const locale = searchParams.get("locale") || session.user.locale || "fa";
    const dashboard = await getOwnerActivationDashboard({ session, organizationId, locale });

    return NextResponse.json({ dashboard });
  } catch (error) {
    return jsonError(error, "Failed to load business activation dashboard");
  }
}
