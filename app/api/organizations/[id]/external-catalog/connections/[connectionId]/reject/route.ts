import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireAuthSession } from "@/lib/api-guards";
import { requireTenantContext } from "@/lib/tenant-context";
import { rejectExternalCatalogItems } from "@/lib/external-catalog/external-catalog.service";

const rejectSchema = z.object({
  itemIds: z.array(z.string()).min(1),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; connectionId: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { id, connectionId } = await params;
    await requireTenantContext(session, id, ["ADMIN", "MANAGER"]);
    const body = rejectSchema.parse(await request.json());
    return NextResponse.json(await rejectExternalCatalogItems({ organizationId: id, connectionId, itemIds: body.itemIds }));
  } catch (error) {
    return jsonError(error);
  }
}
