import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuthSession } from "@/lib/api-guards";
import { analyzeOrganizationEntity } from "@/lib/seo-intelligence/seo-intelligence.service";
import { requireTenantContext } from "@/lib/tenant-context";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { id } = await params;
    await requireTenantContext(session, id, ["ADMIN", "MANAGER"]);
    return NextResponse.json(await analyzeOrganizationEntity(id));
  } catch (error) {
    return jsonError(error);
  }
}
