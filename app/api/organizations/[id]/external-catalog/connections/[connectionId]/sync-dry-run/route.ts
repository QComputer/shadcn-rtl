import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireAuthSession } from "@/lib/api-guards";
import { requireTenantContext } from "@/lib/tenant-context";
import { runExternalCatalogSyncDryRun } from "@/lib/external-catalog/external-catalog.service";

const syncSchema = z.object({
  entityType: z.enum(["CATEGORY", "PRODUCT", "SERVICE"]).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; connectionId: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { id, connectionId } = await params;
    await requireTenantContext(session, id, ["ADMIN", "MANAGER"]);
    const body = syncSchema.parse(await request.json().catch(() => ({})));
    return NextResponse.json(await runExternalCatalogSyncDryRun({ organizationId: id, connectionId, entityType: body.entityType }));
  } catch (error) {
    return jsonError(error);
  }
}
