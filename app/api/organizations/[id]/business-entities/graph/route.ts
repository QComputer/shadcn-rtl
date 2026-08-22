import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuthSession } from "@/lib/api-guards";
import { getBusinessEntityGraph } from "@/lib/business-entity/business-entity.service";
import { requireTenantContext } from "@/lib/tenant-context";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { id } = await params;
    await requireTenantContext(session, id, ["ADMIN", "MANAGER"]);
    return NextResponse.json(await getBusinessEntityGraph({
      organizationId: id,
      rootEntityId: request.nextUrl.searchParams.get("rootEntityId") ?? undefined,
      limit: Number(request.nextUrl.searchParams.get("limit") ?? "100"),
    }));
  } catch (error) {
    return jsonError(error);
  }
}
