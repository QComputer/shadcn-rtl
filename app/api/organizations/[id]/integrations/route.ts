import { NextRequest, NextResponse } from "next/server";
import { ApiError, jsonError, requireAuthSession } from "@/lib/api-guards";
import {
  createOrganizationIntegration,
  listOrganizationIntegrations,
} from "@/lib/integrations/organization-integrations";
import { requireTenantContext } from "@/lib/tenant-context";
import { createOrganizationIntegrationSchema } from "@/lib/validators/organization-integrations";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { id } = await params;
    await requireTenantContext(session, id, ["ADMIN", "MANAGER", "STAFF"]);

    return NextResponse.json({ integrations: await listOrganizationIntegrations(id) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { id } = await params;
    await requireTenantContext(session, id, ["ADMIN", "MANAGER"]);

    const parsed = createOrganizationIntegrationSchema.safeParse(await request.json());
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Invalid integration");

    const integration = await createOrganizationIntegration({
      organizationId: id,
      provider: parsed.data.provider,
      type: parsed.data.type,
      status: parsed.data.status,
      codeName: parsed.data.codeName,
      displayName: parsed.data.displayName,
      externalAccountId: parsed.data.externalAccountId,
      credentialProfileKey: parsed.data.credentialProfileKey,
      configuration: parsed.data.configuration,
      capabilityKeys: parsed.data.capabilityKeys,
    });

    return NextResponse.json(integration, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
