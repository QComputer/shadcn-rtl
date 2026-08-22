import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireAuthSession } from "@/lib/api-guards";
import { requireTenantContext } from "@/lib/tenant-context";
import { approveExternalCatalogItems } from "@/lib/external-catalog/external-catalog.service";

const approveSchema = z.object({
  itemIds: z.array(z.string()).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; connectionId: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { id, connectionId } = await params;
    await requireTenantContext(session, id, ["ADMIN", "MANAGER"]);
    const body = approveSchema.parse(await request.json().catch(() => ({})));
    return NextResponse.json(await approveExternalCatalogItems({ organizationId: id, connectionId, itemIds: body.itemIds }));
  } catch (error) {
    return jsonError(error);
  }
}
