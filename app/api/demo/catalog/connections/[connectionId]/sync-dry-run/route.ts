import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/api-guards";
import { resolveDemoSessionContext } from "@/lib/demo-universe/demo-session-context";
import { runExternalCatalogSyncDryRun } from "@/lib/external-catalog/external-catalog.service";

const syncSchema = z.object({
  entityType: z.enum(["CATEGORY", "PRODUCT", "SERVICE"]).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ connectionId: string }> },
) {
  try {
    const context = await resolveDemoSessionContext({ request, allowedDemoRoles: ["ORGANIZATION_OWNER", "MANAGER"] });
    const { connectionId } = await params;
    const body = syncSchema.parse(await request.json().catch(() => ({})));
    return NextResponse.json(await runExternalCatalogSyncDryRun({
      organizationId: context.organizationId,
      connectionId,
      entityType: body.entityType,
    }));
  } catch (error) {
    return jsonError(error);
  }
}
