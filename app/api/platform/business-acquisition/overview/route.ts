import { NextResponse } from "next/server";
import { jsonError, requireAuthSession, requireRole } from "@/lib/api-guards";
import { getBusinessAcquisitionOperatorOverview } from "@/lib/business-acquisition/business-acquisition.service";

export async function GET() {
  try {
    const session = await requireAuthSession();
    requireRole(session, ["SUPER_ADMIN"]);

    return NextResponse.json(await getBusinessAcquisitionOperatorOverview());
  } catch (error) {
    return jsonError(error);
  }
}
