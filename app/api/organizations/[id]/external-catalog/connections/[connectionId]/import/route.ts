import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuthSession } from "@/lib/api-guards";
import { requireTenantContext } from "@/lib/tenant-context";
import { executeApprovedExternalCatalogImport } from "@/lib/external-catalog/external-catalog.service";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; connectionId: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { id, connectionId } = await params;
    await requireTenantContext(session, id, ["ADMIN", "MANAGER"]);
    return NextResponse.json(await executeApprovedExternalCatalogImport({ organizationId: id, connectionId }));
  } catch (error) {
    return jsonError(error);
  }
}
