import { NextRequest, NextResponse } from "next/server";
import { ApiError, jsonError, requireAuthSession } from "@/lib/api-guards";
import {
  getOrganizationIntegration,
  updateOrganizationIntegrationStatus,
} from "@/lib/integrations/organization-integrations";
import { requireTenantContext } from "@/lib/tenant-context";
import { updateOrganizationIntegrationStatusSchema } from "@/lib/validators/organization-integrations";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; integrationId: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { id, integrationId } = await params;
    await requireTenantContext(session, id, ["ADMIN", "MANAGER", "STAFF"]);

    return NextResponse.json(await getOrganizationIntegration({ organizationId: id, integrationId }));
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; integrationId: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { id, integrationId } = await params;
    await requireTenantContext(session, id, ["ADMIN", "MANAGER"]);

    const parsed = updateOrganizationIntegrationStatusSchema.safeParse(await request.json());
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Invalid integration status");

    return NextResponse.json(await updateOrganizationIntegrationStatus({
      organizationId: id,
      integrationId,
      status: parsed.data.status,
    }));
  } catch (error) {
    return jsonError(error);
  }
}
