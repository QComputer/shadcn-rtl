import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuthSession } from "@/lib/api-guards";
import { checkIntegrationRuntimeHealth } from "@/lib/integrations/runtime/service";
import { requireTenantContext } from "@/lib/tenant-context";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; integrationId: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { id, integrationId } = await params;
    await requireTenantContext(session, id, ["ADMIN", "MANAGER", "STAFF"]);

    return NextResponse.json(await checkIntegrationRuntimeHealth({
      organizationId: id,
      integrationId,
    }));
  } catch (error) {
    return jsonError(error);
  }
}
